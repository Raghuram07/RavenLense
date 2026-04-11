from sqlalchemy import Column, String, DateTime, Text, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id                 = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id         = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    title              = Column(String(300), nullable=False, default="New Chat")
    bedrock_session_id = Column(String(200), nullable=True)
    created_at         = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at         = Column(DateTime(timezone=True),
                                default=lambda: datetime.now(timezone.utc),
                                onupdate=lambda: datetime.now(timezone.utc))

    messages = relationship("ChatMessage", back_populates="session",
                            cascade="all, delete-orphan",
                            order_by="ChatMessage.created_at.asc()")

    __table_args__ = (
        Index("idx_chat_sessions_project", "project_id"),
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role       = Column(String(20), nullable=False)   # "user" | "assistant"
    content    = Column(Text, nullable=False)
    citations  = Column(JSON, nullable=True)           # source references from Bedrock
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        Index("idx_chat_messages_session", "session_id"),
    )
