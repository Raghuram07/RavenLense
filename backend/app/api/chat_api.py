import os
from typing import Optional, List

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.meeting import Meeting

router = APIRouter()

MODEL = "claude-sonnet-4-20250514"


# ── Schemas ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    question:    str
    project_id:  Optional[str]       = None
    meeting_ids: Optional[List[str]] = None


class ChatResponse(BaseModel):
    answer:       str
    meetings_used: List[str]


# ── Helpers ───────────────────────────────────────────────

def _build_context(meetings: list) -> str:
    """Serialise a list of Meeting ORM objects into a plain-text context block."""
    parts = []
    for m in meetings:
        lines = [f"## Meeting: {m.title}"]
        if m.meeting_date:
            lines.append(f"Date: {m.meeting_date.strftime('%b %d, %Y')}")
        if m.attendees:
            lines.append(f"Attendees: {', '.join(m.attendees)}")
        if m.summary:
            lines.append(f"Summary: {m.summary}")
        if m.decisions:
            lines.append("Decisions:\n" + "\n".join(f"  - {d}" for d in m.decisions))
        if m.action_items:
            ai_lines = "\n".join(
                f"  - {item.get('owner','?')}: {item.get('task','')} "
                f"(due: {item.get('due','TBD')})"
                for item in m.action_items
            )
            lines.append(f"Action items:\n{ai_lines}")
        if m.blockers:
            lines.append("Blockers:\n" + "\n".join(f"  - {b}" for b in m.blockers))
        parts.append("\n".join(lines))
    return "\n\n---\n\n".join(parts)


# ── Endpoint ──────────────────────────────────────────────

@router.post("/ask", response_model=ChatResponse)
async def ask(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Answer a question using meeting MOM context.
    Optionally scoped to a project or specific meeting IDs.
    Uses up to the 5 most recent completed meetings if no scope given.
    """
    query = select(Meeting).where(Meeting.status == "done")

    if body.meeting_ids:
        query = query.where(Meeting.id.in_(body.meeting_ids))
    elif body.project_id:
        query = query.where(Meeting.project_id == body.project_id)

    query = query.order_by(Meeting.created_at.desc()).limit(5)
    result = await db.execute(query)
    meetings = result.scalars().all()

    if not meetings:
        return ChatResponse(
            answer="No completed meeting data found. Upload a transcript or process a live meeting first.",
            meetings_used=[],
        )

    context = _build_context(meetings)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    prompt = (
        "You are RavenLens, an AI meeting intelligence assistant. "
        "Answer the user's question based solely on the meeting data provided below. "
        "Be concise and specific. If the answer is not in the data, say so clearly.\n\n"
        f"<meeting_context>\n{context}\n</meeting_context>\n\n"
        f"Question: {body.question}"
    )

    message = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    answer = message.content[0].text if message.content else "No response generated."
    return ChatResponse(answer=answer, meetings_used=[m.id for m in meetings])
