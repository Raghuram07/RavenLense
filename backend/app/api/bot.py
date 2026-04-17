import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal, get_db
from app.models.meeting import Meeting
from app.models.meeting_transcript import MeetingTranscript
from app.models.meeting_ai_output import MeetingAIOutput
from app.models.meeting_action_item import MeetingActionItem
from app.models.project import Project
from app.services.ai_summariser import generate_mom
from app.api.meetings import _save_mom, _load_meeting

router = APIRouter()

RECALL_BASE = "https://us-west-2.recall.ai/api/v1"


def _detect_platform(url: str) -> str:
    if "teams.microsoft.com" in url:
        return "teams"
    if "meet.google.com" in url:
        return "meet"
    if "zoom.us" in url:
        return "zoom"
    return "unknown"


class JoinRequest(BaseModel):
    project_id: str
    title: str
    meeting_url: str
    platform: str | None = None


# ── POST /bot/join ────────────────────────────────────────

@router.post("/join")
async def join_meeting(body: JoinRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == body.project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    platform = body.platform or _detect_platform(body.meeting_url)

    recall_key = os.getenv("RECALL_API_KEY")
    if not recall_key:
        raise HTTPException(status_code=500, detail="RECALL_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{RECALL_BASE}/bot",
            headers={"Authorization": f"Token {recall_key}"},
            json={
                "meeting_url": body.meeting_url,
                "bot_name": "RavenLens Bot",
                "recording_config": {
                    "transcript": {
                        "provider": {
                            "recallai_streaming": {}
                        }
                    }
                }
            },
            timeout=30,
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Recall.ai error: {resp.text}")

    bot_id = resp.json().get("id")

    meeting = Meeting(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        title=body.title,
        platform=platform,
        meeting_url=body.meeting_url,
        status="processing..",
        bot_status="joining",
        recall_bot_id=bot_id,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    return {
        "meeting_id": meeting.id,
        "recall_bot_id": bot_id,
        "status": "bot_dispatched",
        "message": f"RavenLens Bot is joining your {platform} meeting. MOM will appear when the call ends.",
    }


# ── GET /bot/status/{meeting_id} ──────────────────────────

@router.get("/status/{meeting_id}")
async def bot_status(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Optionally refresh bot_status from Recall
    recall_key = os.getenv("RECALL_API_KEY")
    if meeting.recall_bot_id and recall_key:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{RECALL_BASE}/bot/{meeting.recall_bot_id}",
                    headers={"Authorization": f"Token {recall_key}"},
                    timeout=10,
                )
            if resp.status_code == 200:
                status_changes = resp.json().get("status_changes", [])
                if status_changes:
                    latest = status_changes[-1].get("code", "")
                    status_map = {
                        "joining_call": "joining",
                        "in_call_recording": "recording",
                        "done": "done",
                        "fatal": "failed",
                    }
                    if latest in status_map:
                        meeting.bot_status = status_map[latest]
                        await db.commit()
        except Exception:
            pass

    return {
        "meeting_id": meeting.id,
        "title": meeting.title,
        "platform": meeting.platform,
        "meeting_url": meeting.meeting_url,
        "recall_bot_id": meeting.recall_bot_id,
        "bot_status": meeting.bot_status,
        "meeting_status": meeting.status,
        "bot_joined_at": meeting.bot_joined_at.isoformat() if meeting.bot_joined_at else None,
        "bot_left_at": meeting.bot_left_at.isoformat() if meeting.bot_left_at else None,
    }


# ── POST /bot/reprocess/{meeting_id} ─────────────────────

@router.post("/reprocess/{meeting_id}")
async def reprocess_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """
    Manually re-trigger transcript fetch + AI summarisation for a completed bot meeting.
    Use this when the webhook didn't fire (e.g. local dev without ngrok).
    """
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not meeting.recall_bot_id:
        raise HTTPException(status_code=400, detail="This meeting has no associated Recall.ai bot")

    recall_key = os.getenv("RECALL_API_KEY")
    if not recall_key:
        raise HTTPException(status_code=500, detail="RECALL_API_KEY not configured")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: List transcripts for this bot
            list_resp = await client.get(
                f"{RECALL_BASE}/transcript/?bot_id={meeting.recall_bot_id}",
                headers={"Authorization": f"Token {recall_key}"},
            )
            results = list_resp.json().get("results", [])

            if not results:
                raise HTTPException(status_code=404, detail="No transcript found on Recall.ai for this bot")

            # Step 2: Get S3 download URL
            download_url = results[0]["data"]["download_url"]

            # Step 3: Download transcript JSON from S3 (no auth needed)
            s3_resp = await client.get(download_url)
            transcript_data = s3_resp.json()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch transcript from Recall.ai: {str(e)}")

    # Step 4: Flatten transcript to plain text
    lines = []
    for segment in transcript_data:
        speaker = segment.get("participant", {}).get("name", "Unknown")
        words = " ".join(w["text"] for w in segment.get("words", []))
        if words.strip():
            lines.append(f"{speaker}: {words.strip()}")

    clean_transcript = "\n".join(lines)
    if not clean_transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty — the meeting may not have had any speech")

    # Step 5: Save transcript + run AI summarisation
    if meeting.transcript:
        meeting.transcript.raw_transcript = clean_transcript
    else:
        db.add(MeetingTranscript(meeting_id=meeting.id, raw_transcript=clean_transcript))

    meeting.status = "processing"
    await db.commit()

    # reload relationships for _save_mom
    meeting = await _load_meeting(db, meeting_id)

    try:
        mom_data = await generate_mom(clean_transcript, meeting_title=meeting.title)
        await _save_mom(db, meeting, mom_data)
        meeting.status = "done"
    except Exception as e:
        meeting.status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"AI summarisation failed: {str(e)}")

    await db.commit()
    meeting = await _load_meeting(db, meeting_id)

    return {
        "status": "done",
        "meeting_id": meeting_id,
        "title": meeting.title,
        "attendees": meeting.ai_output.attendees if meeting.ai_output else [],
        "action_items_count": len(meeting.action_items),
        "summary": meeting.ai_output.summary if meeting.ai_output else "",
    }


# ── Background task: fetch transcript + run AI ────────────

async def _process_bot_done(bot_id: str, meeting_id: str) -> None:
    recall_key = os.getenv("RECALL_API_KEY")
    if not recall_key:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting:
            return

        try:
            async with httpx.AsyncClient() as client:
                # Step 1: List transcripts for this bot
                list_resp = await client.get(
                    f"{RECALL_BASE}/transcript/?bot_id={bot_id}",
                    headers={"Authorization": f"Token {recall_key}"},
                    timeout=30,
                )
                results = list_resp.json().get("results", [])

                if not results:
                    meeting.status = "failed"
                    await db.commit()
                    return

                # Step 2: Get S3 download URL
                download_url = results[0]["data"]["download_url"]

                # Step 3: Download transcript JSON from S3 (no auth needed)
                s3_resp = await client.get(download_url)
                segments = s3_resp.json()

            lines = []
            for seg in segments:
                speaker = seg.get("participant", {}).get("name", "Unknown")
                words = " ".join(w.get("text", "") for w in seg.get("words", []))
                if words.strip():
                    lines.append(f"{speaker}: {words}")

            transcript = "\n".join(lines)
            if meeting.transcript:
                meeting.transcript.raw_transcript = transcript
            else:
                db.add(MeetingTranscript(meeting_id=meeting.id, raw_transcript=transcript))

            meeting.bot_left_at = datetime.now(timezone.utc)
            await db.commit()

            # reload for _save_mom
            from sqlalchemy.orm import selectinload
            result2 = await db.execute(
                select(Meeting)
                .options(
                    selectinload(Meeting.transcript),
                    selectinload(Meeting.ai_output),
                    selectinload(Meeting.action_items),
                )
                .where(Meeting.id == meeting.id)
            )
            meeting = result2.scalar_one()

            mom = await generate_mom(transcript, meeting_title=meeting.title)
            await _save_mom(db, meeting, mom)
            meeting.status = "done"
            await db.commit()

        except Exception:
            meeting.status = "failed"
            meeting.bot_status = "failed"
            await db.commit()


# ── POST /bot/webhook ─────────────────────────────────────

@router.post("/webhook")
async def bot_webhook(request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    event = payload.get("event", "")
    bot_id = payload.get("data", {}).get("bot_id", "")

    if not bot_id:
        return {"ok": True}

    result = await db.execute(select(Meeting).where(Meeting.recall_bot_id == bot_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        return {"ok": True}

    if event == "bot.joining_call":
        meeting.bot_status = "joining"
        meeting.bot_joined_at = datetime.now(timezone.utc)
        await db.commit()
    elif event == "bot.in_call_recording":
        meeting.bot_status = "recording"
        await db.commit()
    elif event in ("bot.fatal", "bot.error"):
        meeting.bot_status = "failed"
        meeting.status = "failed"
        await db.commit()
    elif event == "bot.done":
        meeting.bot_status = "done"
        await db.commit()
        background_tasks.add_task(_process_bot_done, bot_id, meeting.id)

    return {"ok": True}
