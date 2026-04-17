import io
from datetime import datetime
from typing import Optional, List, Any

from app.db.database import get_db
from app.models.meeting import Meeting
from app.models.meeting_transcript import MeetingTranscript
from app.models.meeting_ai_output import MeetingAIOutput
from app.models.meeting_action_item import MeetingActionItem
from app.models.project import Project
from app.services.ai_summariser import generate_mom
from app.services.vtt_parser import parse_vtt, transcript_to_text, get_speakers
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────

class ActionItemResponse(BaseModel):
    id:       str
    owner:    Optional[str]
    task:     str
    due_date: Optional[str]
    status:   str

    class Config:
        from_attributes = True


class MeetingResponse(BaseModel):
    id:           str
    project_id:   str
    title:        str
    platform:     Optional[str]
    meeting_date: Optional[datetime]
    meeting_url:  Optional[str]
    created_at:   datetime
    status:       str
    # flattened from ai_output
    attendees:    Optional[List[str]]           = None
    decisions:    Optional[List[str]]           = None
    blockers:     Optional[List[str]]           = None
    summary:      Optional[str]                 = None
    full_mom:     Optional[str]                 = None
    action_items: Optional[List[ActionItemResponse]] = None

    class Config:
        from_attributes = True


class MeetingListItem(BaseModel):
    id:             str
    project_id:     str
    title:          str
    platform:       Optional[str]
    meeting_date:   Optional[datetime]
    created_at:     datetime
    status:         str
    attendee_count: int = 0
    action_count:   int = 0

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────

async def _load_meeting(db: AsyncSession, meeting_id: str) -> Optional[Meeting]:
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.transcript),
            selectinload(Meeting.ai_output),
            selectinload(Meeting.action_items),
        )
        .where(Meeting.id == meeting_id)
    )
    return result.scalar_one_or_none()


def _meeting_response(m: Meeting) -> dict:
    ai = m.ai_output
    return {
        "id":           m.id,
        "project_id":   m.project_id,
        "title":        m.title,
        "platform":     m.platform,
        "meeting_date": m.meeting_date,
        "meeting_url":  m.meeting_url,
        "created_at":   m.created_at,
        "status":       m.status,
        "attendees":    ai.attendees  if ai else None,
        "decisions":    ai.decisions  if ai else None,
        "blockers":     ai.blockers   if ai else None,
        "summary":      ai.summary    if ai else None,
        "full_mom":     ai.full_mom   if ai else None,
        "action_items": m.action_items,
    }


async def _save_mom(db: AsyncSession, meeting: Meeting, mom_data: dict) -> None:
    """Write AI outputs + action items to their respective tables."""
    # Upsert ai_output
    if meeting.ai_output:
        ai = meeting.ai_output
    else:
        ai = MeetingAIOutput(meeting_id=meeting.id)
        db.add(ai)

    ai.attendees = mom_data.get("attendees", [])
    ai.decisions = mom_data.get("decisions", [])
    ai.blockers  = mom_data.get("blockers",  [])
    ai.summary   = mom_data.get("summary",   "")
    ai.full_mom  = mom_data.get("full_mom",  "")

    # Replace action items
    for existing in list(meeting.action_items):
        await db.delete(existing)

    for item in mom_data.get("action_items", []):
        db.add(MeetingActionItem(
            meeting_id=meeting.id,
            owner=item.get("owner"),
            task=item.get("task", ""),
            due_date=item.get("due"),
        ))


# ── Endpoints ─────────────────────────────────────────────

@router.post("/upload", response_model=MeetingResponse, status_code=201)
async def upload_vtt(
    project_id:   str            = Form(...),
    title:        str            = Form(...),
    platform:     Optional[str] = Form(None),
    meeting_date: Optional[str] = Form(None),
    vtt_file:     UploadFile     = File(...),
    db:           AsyncSession   = Depends(get_db),
):
    """Upload a .vtt or .docx transcript. RavenLens parses it and generates a structured MOM."""

    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    if not proj_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    filename = vtt_file.filename or ""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("vtt", "docx"):
        raise HTTPException(status_code=400, detail="Only .vtt and .docx files are supported.")

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

    parsed_date = None
    if meeting_date:
        try:
            parsed_date = datetime.fromisoformat(meeting_date)
        except ValueError:
            pass

    meeting = Meeting(
        project_id=project_id,
        title=title,
        platform=platform,
        meeting_date=parsed_date,
        status="processing",
    )
    db.add(meeting)
    await db.flush()  # get meeting.id

    # Parse transcript
    try:
        if ext == "docx":
            clean_transcript = vtt_content
        else:
            transcript_lines = parse_vtt(vtt_content)
            if not transcript_lines:
                raise ValueError("No transcript lines found.")
            clean_transcript = transcript_to_text(transcript_lines)
    except Exception as e:
        meeting.status = "failed"
        await db.commit()
        raise HTTPException(status_code=422, detail=f"Transcript parsing failed: {str(e)}")

    db.add(MeetingTranscript(
        meeting_id=meeting.id,
        raw_vtt=vtt_content if ext == "vtt" else None,
        raw_transcript=clean_transcript,
    ))

    # Generate MOM
    try:
        mom_data = await generate_mom(clean_transcript, meeting_title=title)
        await _save_mom(db, meeting, mom_data)
        meeting.status = "done"
    except Exception as e:
        meeting.status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"AI summarisation failed: {str(e)}")

    await db.commit()

    meeting = await _load_meeting(db, meeting.id)
    return _meeting_response(meeting)


@router.get("/project/{project_id}", response_model=List[MeetingListItem])
async def list_meetings_for_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.ai_output), selectinload(Meeting.action_items))
        .where(Meeting.project_id == project_id)
        .order_by(Meeting.created_at.desc())
    )
    meetings = result.scalars().all()

    return [
        {
            **m.__dict__,
            "attendee_count": len(m.ai_output.attendees or []) if m.ai_output else 0,
            "action_count":   len(m.action_items or []),
        }
        for m in meetings
    ]


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await _load_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return _meeting_response(meeting)


@router.get("/{meeting_id}/mom", response_model=dict)
async def get_mom_by_member(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Get MOM broken down by team member."""
    meeting = await _load_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.status != "done":
        raise HTTPException(status_code=400, detail=f"MOM not ready. Status: {meeting.status}")

    ai = meeting.ai_output

    members = {}
    for attendee in (ai.attendees if ai else []) or []:
        members[attendee] = {
            "name":         attendee,
            "action_items": [],
            "summary":      ai.summary if ai else "",
        }

    for item in meeting.action_items:
        owner = item.owner or ""
        matched = next(
            (name for name in members
             if owner.lower() in name.lower() or name.lower() in owner.lower()),
            None,
        )
        target = matched or "Unassigned"
        if target not in members:
            members[target] = {"name": target, "action_items": [], "summary": ""}
        members[target]["action_items"].append({
            "id":       item.id,
            "task":     item.task,
            "due_date": item.due_date,
            "status":   item.status,
        })

    return {
        "meeting_id":   meeting_id,
        "title":        meeting.title,
        "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
        "platform":     meeting.platform,
        "summary":      ai.summary    if ai else None,
        "decisions":    ai.decisions  if ai else [],
        "blockers":     ai.blockers   if ai else [],
        "by_member":    list(members.values()),
    }


@router.patch("/{meeting_id}/action-items/{item_id}", response_model=ActionItemResponse)
async def update_action_item_status(
    meeting_id: str,
    item_id:    str,
    status:     str,
    db:         AsyncSession = Depends(get_db),
):
    """Update action item status: open / in_progress / done"""
    result = await db.execute(
        select(MeetingActionItem)
        .where(MeetingActionItem.id == item_id, MeetingActionItem.meeting_id == meeting_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")

    allowed = {"open", "in_progress", "done"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of: {allowed}")

    item.status = status
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await db.delete(meeting)
    await db.commit()
