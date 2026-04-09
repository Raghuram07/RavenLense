import io
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, AsyncSessionLocal
from app.models.knowledge import KnowledgeFolder, KnowledgeFile
from app.services.s3_uploader import upload_file_to_s3
from app.services.bedrock_service import trigger_ingestion

logger = logging.getLogger("ravenlens.knowledge")
router = APIRouter()

# ── Helpers ───────────────────────────────────────────────

def _extract_text(raw_bytes: bytes, filename: str) -> str:
    """Best-effort plain-text extraction for supported file types."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "txt" or ext == "vtt":
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
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages)
        except Exception:
            return ""

    return ""  # binary or unsupported


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
        files_result = await db.execute(
            select(KnowledgeFile).where(KnowledgeFile.folder_id == f.id)
        )
        count = len(files_result.scalars().all())
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
    """Upload a file to the knowledge base. Supported: .pdf, .txt, .vtt, .docx"""
    filename = file.filename or "untitled"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    allowed = {"pdf", "txt", "vtt", "docx", "md"}
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type .{ext}. Allowed: {', '.join(sorted(allowed))}"
        )

    raw_bytes = await file.read()
    size_bytes = len(raw_bytes)
    content = _extract_text(raw_bytes, filename)

    # Validate folder exists if provided
    if folder_id:
        fr = await db.execute(select(KnowledgeFolder).where(KnowledgeFolder.id == folder_id))
        if not fr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Folder not found")

    kf = KnowledgeFile(
        folder_id=folder_id,
        project_id=project_id,
        name=filename,
        mime_type=file.content_type,
        size_bytes=size_bytes,
        content=content,
        file_data=raw_bytes,
        status="pending",
        uploaded_by_name=uploaded_by_name,
    )
    db.add(kf)
    await db.commit()
    await db.refresh(kf)
    return kf


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File not found")
    return kf


def _s3_upload_job(file_id: str, file_data: bytes, filename: str,
                   project_id: str, mime_type: Optional[str]):
    """
    Synchronous background job — runs after the response is sent.
    Uploads the file to S3, then clears file_data in the DB.
    """
    import asyncio

    async def _do_upload():
        try:
            s3_key = upload_file_to_s3(
                file_data=file_data,
                filename=filename,
                project_id=project_id,
                file_id=file_id,
                mime_type=mime_type,
            )
            # Persist the s3_key and clear raw bytes
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(KnowledgeFile).where(KnowledgeFile.id == file_id)
                )
                kf = result.scalar_one_or_none()
                if kf:
                    kf.s3_key = s3_key
                    kf.file_data = None  # free DB space
                    await session.commit()
                    logger.info("S3 upload complete for file %s → %s", file_id, s3_key)

            # Trigger Bedrock ingestion to index the new file
            try:
                job_id = trigger_ingestion()
                if job_id:
                    logger.info("Bedrock ingestion triggered — job=%s", job_id)
            except Exception:
                logger.exception("Bedrock ingestion trigger failed (non-blocking)")

        except Exception:
            logger.exception("S3 upload failed for file %s", file_id)

    asyncio.run(_do_upload())


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

    kf.status = "approved"
    kf.reviewed_by_name = body.reviewed_by
    kf.reviewed_at = datetime.now(timezone.utc)
    kf.rejection_reason = None
    await db.commit()
    await db.refresh(kf)

    # Schedule S3 upload as a background job
    if kf.file_data and kf.project_id:
        background_tasks.add_task(
            _s3_upload_job,
            file_id=kf.id,
            file_data=kf.file_data,
            filename=kf.name,
            project_id=kf.project_id,
            mime_type=kf.mime_type,
        )
        logger.info("Queued S3 upload for file %s (project %s)", kf.id, kf.project_id)
    elif not kf.project_id:
        logger.warning("Skipping S3 upload for file %s — no project_id", kf.id)

    return kf


@router.post("/files/{file_id}/reject", response_model=FileResponse)
async def reject_file(file_id: str, body: RejectBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    kf = result.scalar_one_or_none()
    if not kf:
        raise HTTPException(status_code=404, detail="File not found")

    kf.status = "rejected"
    kf.rejection_reason = body.reason
    kf.reviewed_at = datetime.now(timezone.utc)
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
