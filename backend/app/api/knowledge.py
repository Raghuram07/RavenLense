import io
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.knowledge import KnowledgeFolder, KnowledgeFile
from app.services.s3_uploader import upload_file_to_s3
from app.services.bedrock_service import trigger_ingestion

logger = logging.getLogger("ravenlens.knowledge")
router = APIRouter()

# ── Helpers ───────────────────────────────────────────────

def _extract_text(raw_bytes: bytes, filename: str) -> str:
    """Best-effort plain-text extraction for supported file types."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext in ("txt", "vtt"):
        try:
            return raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return raw_bytes.decode("latin-1", errors="replace")

    if ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(raw_bytes))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception:
            return ""

    if ext == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""

    return ""


# ── Schemas ──────────────────────────────────────────────

class FolderCreate(BaseModel):
    name:       str
    emoji:      Optional[str] = "📁"
    project_id: Optional[str] = None


class FolderResponse(BaseModel):
    id:         str
    project_id: Optional[str]
    name:       str
    emoji:      Optional[str]
    created_at: datetime
    file_count: int = 0

    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    id:               str
    folder_id:        Optional[str]
    project_id:       Optional[str]
    name:             str
    mime_type:        Optional[str]
    size_bytes:       Optional[int]
    s3_key:           Optional[str] = None
    status:           str
    uploaded_by_name: Optional[str]
    rejection_reason: Optional[str]
    reviewed_by_name: Optional[str]
    reviewed_at:      Optional[datetime]
    created_at:       datetime

    class Config:
        from_attributes = True


class RejectBody(BaseModel):
    reason: Optional[str] = None


class ApproveBody(BaseModel):
    reviewed_by: Optional[str] = None


# ── Folder endpoints ──────────────────────────────────────

@router.get("/folders", response_model=List[FolderResponse])
async def list_folders(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(KnowledgeFolder).order_by(KnowledgeFolder.created_at.desc())
    if project_id:
        query = query.where(KnowledgeFolder.project_id == project_id)
    result = await db.execute(query)
    folders = result.scalars().all()

    output = []
    for f in folders:
        count = len((await db.execute(
            select(KnowledgeFile).where(KnowledgeFile.folder_id == f.id)
        )).scalars().all())
        output.append({**f.__dict__, "file_count": count})
    return output


@router.post("/folders", response_model=FolderResponse, status_code=201)
async def create_folder(body: FolderCreate, db: AsyncSession = Depends(get_db)):
    folder = KnowledgeFolder(name=body.name, emoji=body.emoji or "📁", project_id=body.project_id)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {**folder.__dict__, "file_count": 0}


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(folder_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeFolder).where(KnowledgeFolder.id == folder_id))
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    await db.delete(folder)
    await db.commit()


# ── File endpoints ────────────────────────────────────────

@router.get("/files", response_model=List[FileResponse])
async def list_files(
    folder_id:  Optional[str] = None,
    project_id: Optional[str] = None,
    status:     Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(KnowledgeFile).order_by(KnowledgeFile.created_at.desc())
    if folder_id:
        query = query.where(KnowledgeFile.folder_id == folder_id)
    if project_id:
        query = query.where(KnowledgeFile.project_id == project_id)
    if status:
        query = query.where(KnowledgeFile.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/review-queue", response_model=List[FileResponse])
async def review_queue(db: AsyncSession = Depends(get_db)):
    """Return all pending files for manager review, newest first."""
    result = await db.execute(
        select(KnowledgeFile)
        .where(KnowledgeFile.status == "pending")
        .order_by(KnowledgeFile.created_at.desc())
    )
    return result.scalars().all()


@router.post("/files/upload", response_model=FileResponse, status_code=201)
async def upload_file(
    file:             UploadFile      = File(...),
    folder_id:        Optional[str]  = Form(None),
    project_id:       Optional[str]  = Form(None),
    uploaded_by_name: Optional[str]  = Form(None),
    db:               AsyncSession    = Depends(get_db),
):
    """Upload a file to the knowledge base. File goes to S3 immediately; review controls indexing."""
    filename = file.filename or "untitled"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    allowed = {"pdf", "txt", "vtt", "docx", "md"}
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type .{ext}. Allowed: {', '.join(sorted(allowed))}"
        )

    raw_bytes  = await file.read()
    size_bytes = len(raw_bytes)
    content    = _extract_text(raw_bytes, filename)

    # Resolve project_id from folder if not supplied directly
    resolved_project_id = project_id
    if not resolved_project_id and folder_id:
        fr = await db.execute(select(KnowledgeFolder).where(KnowledgeFolder.id == folder_id))
        folder = fr.scalar_one_or_none()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        resolved_project_id = folder.project_id
    elif folder_id:
        fr = await db.execute(select(KnowledgeFolder).where(KnowledgeFolder.id == folder_id))
        if not fr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Folder not found")

    # Upload to S3 immediately (status=pending — Bedrock ingestion triggered on approval)
    s3_key = None
    if resolved_project_id:
        try:
            s3_key = upload_file_to_s3(
                file_data=raw_bytes,
                filename=filename,
                project_id=resolved_project_id,
                file_id="pending",   # placeholder; overwritten below with real id
                mime_type=file.content_type,
            )
        except Exception:
            logger.exception("S3 upload failed during file upload for %s", filename)

    kf = KnowledgeFile(
        folder_id=folder_id,
        project_id=resolved_project_id,
        name=filename,
        mime_type=file.content_type,
        size_bytes=size_bytes,
        content=content,
        s3_key=s3_key,
        status="pending",
        uploaded_by_name=uploaded_by_name,
    )
    db.add(kf)
    await db.commit()
    await db.refresh(kf)

    # Re-upload with real file_id in key if S3 succeeded with placeholder
    if resolved_project_id and s3_key:
        try:
            real_s3_key = upload_file_to_s3(
                file_data=raw_bytes,
                filename=filename,
                project_id=resolved_project_id,
                file_id=kf.id,
                mime_type=file.content_type,
            )
            kf.s3_key = real_s3_key
            await db.commit()
            await db.refresh(kf)
        except Exception:
            logger.exception("S3 re-upload with real file_id failed for %s", kf.id)

    return kf


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File not found")
    return kf


@router.post("/files/{file_id}/approve", response_model=FileResponse)
async def approve_file(
    file_id: str,
    body: ApproveBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File not found")

    kf.status           = "approved"
    kf.reviewed_by_name = body.reviewed_by
    kf.reviewed_at      = datetime.now(timezone.utc)
    kf.rejection_reason = None
    await db.commit()
    await db.refresh(kf)

    # Trigger Bedrock ingestion so the approved file gets indexed
    if kf.s3_key:
        background_tasks.add_task(_trigger_ingestion_job)
        logger.info("Queued Bedrock ingestion for approved file %s", kf.id)
    else:
        logger.warning("Approved file %s has no s3_key — skipping Bedrock ingestion", kf.id)

    return kf


async def _trigger_ingestion_job():
    try:
        job_id = trigger_ingestion()
        if job_id:
            logger.info("Bedrock ingestion triggered — job=%s", job_id)
    except Exception:
        logger.exception("Bedrock ingestion trigger failed (non-blocking)")


@router.post("/files/{file_id}/reject", response_model=FileResponse)
async def reject_file(file_id: str, body: RejectBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File not found")

    kf.status           = "rejected"
    kf.rejection_reason = body.reason
    kf.reviewed_at      = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(kf)
    return kf


@router.delete("/files/{file_id}", status_code=204)
async def delete_file(file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(kf)
    await db.commit()
