import io
from datetime import datetime
from typing import Optional, List, Any

from app.db.database import get_db
from app.models.meeting import Meeting
from app.models.project import Project
from app.services.ai_summariser import generate_mom
from app.services.vtt_parser import parse_vtt, transcript_to_text, get_speakers
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────

class ActionItem(BaseModel):
    owner: str
    task:  str
    due:   Optional[str] = None

class MeetingResponse(BaseModel):
    id:            str
    project_id:    str
    title:         str
    platform:      Optional[str]
    meeting_date:  Optional[datetime]
    created_at:    datetime
    status:        str
    attendees:     Optional[List[str]]     = None
    decisions:     Optional[List[str]]     = None
    action_items:  Optional[List[Any]]     = None
    blockers:      Optional[List[str]]     = None
    summary:       Optional[str]           = None
    full_mom:      Optional[str]           = None

    class Config:
        from_attributes = True

class MeetingListItem(BaseModel):
    id:           str
    project_id:   str
    title:        str
    platform:     Optional[str]
    meeting_date: Optional[datetime]
    created_at:   datetime
    status:       str
    attendee_count: int = 0
    action_count:   int = 0

    class Config:
        from_attributes = True

# ── Endpoints ─────────────────────────────────────────────

@router.post("/upload", response_model=MeetingResponse, status_code=201)
async def upload_vtt(
    project_id:   str              = Form(..., description="Project ID to link this meeting to"),
    title:        str              = Form(..., description="Meeting title e.g. 'Sprint 14 Review'"),
    platform:     Optional[str]   = Form(None, description="teams / zoom / meet / webex"),
    meeting_date: Optional[str]   = Form(None, description="ISO date string e.g. 2025-03-07"),
    vtt_file:     UploadFile       = File(..., description=".vtt transcript file"),
    db:           AsyncSession     = Depends(get_db)
):
    """
    Upload a .vtt transcript file for a project meeting.
    RavenLens will parse it and use Claude AI to generate a structured MOM.

    ---
    **Postman usage:**
    - POST /meetings/upload
    - Body: form-data
      - project_id  (text)
      - title       (text)
      - platform    (text, optional) — teams / zoom / meet / webex
      - meeting_date (text, optional) — ISO format e.g. 2025-03-07
      - vtt_file    (file — select your .vtt file)
    """

    # 1. Validate project exists
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found. Create it first via POST /projects/")

    # 2. Validate file type
    filename = vtt_file.filename or ""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("vtt", "docx"):
        raise HTTPException(status_code=400, detail="Only .vtt and .docx files are supported.")

    # 3. Read file content
    raw_bytes = await vtt_file.read()

    if ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(raw_bytes))
            vtt_content = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not read Word document: {str(e)}")
    else:
        try:
            vtt_content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            vtt_content = raw_bytes.decode("latin-1")

    if not vtt_content.strip():
        raise HTTPException(status_code=400, detail="File is empty.")

    # 4. Parse meeting date
    parsed_date = None
    if meeting_date:
        try:
            parsed_date = datetime.fromisoformat(meeting_date)
        except ValueError:
            pass

    # 5. Create meeting record (status: processing)
    meeting = Meeting(
        project_id    = project_id,
        title         = title,
        platform      = platform,
        meeting_date  = parsed_date,
        raw_vtt       = vtt_content,
        status        = "processing"
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    # 6. Parse transcript
    try:
        if ext == "docx":
            clean_transcript = vtt_content
        else:
            transcript_lines = parse_vtt(vtt_content)
            if not transcript_lines:
                raise ValueError("No transcript lines found. Check your .vtt file format.")
            clean_transcript = transcript_to_text(transcript_lines)

        meeting.raw_transcript = clean_transcript

    except Exception as e:
        meeting.status = "failed"
        await db.commit()
        raise HTTPException(status_code=422, detail=f"Transcript parsing failed: {str(e)}")

    # 7. Generate MOM via Claude AI
    try:
        mom_data = await generate_mom(clean_transcript, meeting_title=title)

        meeting.attendees    = mom_data.get("attendees",    [])
        meeting.decisions    = mom_data.get("decisions",    [])
        meeting.action_items = mom_data.get("action_items", [])
        meeting.blockers     = mom_data.get("blockers",     [])
        meeting.summary      = mom_data.get("summary",      "")
        meeting.full_mom     = mom_data.get("full_mom",     "")
        meeting.status       = "done"

    except Exception as e:
        meeting.status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"AI summarisation failed: {str(e)}")

    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.get("/project/{project_id}", response_model=List[MeetingListItem])
async def list_meetings_for_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get all meetings for a specific project."""
    result   = await db.execute(
        select(Meeting)
        .where(Meeting.project_id == project_id)
        .order_by(Meeting.created_at.desc())
    )
    meetings = result.scalars().all()

    output = []
    for m in meetings:
        output.append({
            **m.__dict__,
            "attendee_count": len(m.attendees or []),
            "action_count":   len(m.action_items or [])
        })
    return output


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Get full MOM details for a specific meeting."""
    result  = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.get("/{meeting_id}/mom", response_model=dict)
async def get_mom_by_member(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get MOM broken down by team member.
    Returns each attendee with their specific action items.
    Useful for sending individual summaries.
    """
    result  = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status != "done":
        raise HTTPException(status_code=400, detail=f"Meeting MOM is not ready yet. Status: {meeting.status}")

    # Build per-member breakdown
    members = {}
    for attendee in (meeting.attendees or []):
        members[attendee] = {
            "name":         attendee,
            "action_items": [],
            "summary":      meeting.summary
        }

    for item in (meeting.action_items or []):
        owner = item.get("owner", "")
        # fuzzy match — handle partial names
        matched = next(
            (name for name in members if owner.lower() in name.lower() or name.lower() in owner.lower()),
            None
        )
        if matched:
            members[matched]["action_items"].append(item)
        else:
            # unknown owner — add to a general bucket
            if "Unassigned" not in members:
                members["Unassigned"] = {"name": "Unassigned", "action_items": [], "summary": ""}
            members["Unassigned"]["action_items"].append(item)

    return {
        "meeting_id":   meeting_id,
        "title":        meeting.title,
        "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
        "platform":     meeting.platform,
        "summary":      meeting.summary,
        "decisions":    meeting.decisions,
        "blockers":     meeting.blockers,
        "by_member":    list(members.values())
    }


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await db.delete(meeting)
    await db.commit()
