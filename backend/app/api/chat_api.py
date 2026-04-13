"""
Chat API — session-based RAG chat powered by Amazon Bedrock Knowledge Bases.

Endpoints:
    POST   /chat/sessions                  — create a new chat session
    GET    /chat/sessions                  — list sessions (optionally by project)
    GET    /chat/sessions/{id}             — get session + full message history
    POST   /chat/sessions/{id}/messages    — send a message, get Bedrock RAG answer
    DELETE /chat/sessions/{id}             — delete session and all messages
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.chat import ChatSession, ChatMessage
from app.services.bedrock_service import retrieve_and_generate

logger = logging.getLogger("ravenlens.chat")
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    project_id: Optional[str] = None
    title:      Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id:         str
    role:       str
    content:    str
    citations:  Optional[List[dict]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id:         str
    project_id: Optional[str]
    title:      str
    created_at: datetime
    updated_at: datetime
    messages:   Optional[List[MessageResponse]] = None

    class Config:
        from_attributes = True


class SessionListItem(BaseModel):
    id:            str
    project_id:    Optional[str]
    title:         str
    message_count: int
    created_at:    datetime
    updated_at:    datetime


# ── Helpers ──────────────────────────────────────────────

def _auto_title(first_message: str) -> str:
    """Generate a session title from the first user message."""
    title = first_message.strip().replace("\n", " ")
    if len(title) > 60:
        title = title[:57] + "..."
    return title


# ── Endpoints ────────────────────────────────────────────

@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    body: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat session, optionally tied to a project."""
    session = ChatSession(
        project_id=body.project_id,
        title=body.title or "New Chat",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse(
        id=session.id,
        project_id=session.project_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[],
    )


@router.get("/sessions", response_model=List[SessionListItem])
async def list_sessions(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List chat sessions, newest first. Optionally filter by project."""
    count_subq = (
        select(
            ChatMessage.session_id,
            func.count(ChatMessage.id).label("message_count"),
        )
        .group_by(ChatMessage.session_id)
        .subquery()
    )

    query = (
        select(
            ChatSession,
            func.coalesce(count_subq.c.message_count, 0).label("message_count"),
        )
        .outerjoin(count_subq, ChatSession.id == count_subq.c.session_id)
        .order_by(ChatSession.updated_at.desc())
    )

    if project_id:
        query = query.where(ChatSession.project_id == project_id)

    result = await db.execute(query)
    rows = result.all()

    return [
        SessionListItem(
            id=row.ChatSession.id,
            project_id=row.ChatSession.project_id,
            title=row.ChatSession.title,
            message_count=row.message_count,
            created_at=row.ChatSession.created_at,
            updated_at=row.ChatSession.updated_at,
        )
        for row in rows
    ]


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a chat session with its full message history."""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return SessionResponse(
        id=session.id,
        project_id=session.project_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            MessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                citations=m.citations,
                created_at=m.created_at,
            )
            for m in session.messages
        ],
    )


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse)
async def send_message(
    session_id: str,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message in a chat session.
    Calls Bedrock RetrieveAndGenerate for RAG-based answer.
    Both user message and assistant response are persisted.
    """
    # 1. Load session
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # 2. Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    # 3. Auto-title from first message
    is_first_message = len(session.messages) == 0
    if is_first_message and session.title == "New Chat":
        session.title = _auto_title(body.content)

    # 4. Call Bedrock RAG
    try:
        rag_result = retrieve_and_generate(
            question=body.content,
            session_id=session.bedrock_session_id,
            project_id=session.project_id,
        )
        answer = rag_result["answer"]
        citations = rag_result.get("citations")
        new_bedrock_session_id = rag_result.get("session_id")

        # Update Bedrock session ID (may change on expiry)
        if new_bedrock_session_id:
            session.bedrock_session_id = new_bedrock_session_id

    except Exception:
        logger.exception("Bedrock RAG query failed for session %s", session_id)
        answer = (
            "I'm sorry, I couldn't process your question right now. "
            "Please make sure the Bedrock Knowledge Base is configured and try again."
        )
        citations = None

    # 5. Save assistant response
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer,
        citations=citations,
    )
    db.add(assistant_msg)

    # 6. Touch updated_at
    session.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(assistant_msg)

    return MessageResponse(
        id=assistant_msg.id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        citations=assistant_msg.citations,
        created_at=assistant_msg.created_at,
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat session and all its messages."""
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(session)
    await db.commit()
