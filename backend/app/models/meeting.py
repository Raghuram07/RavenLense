from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class Meeting(Base):
    __tablename__ = "meetings"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id    = Column(String, ForeignKey("projects.id"), nullable=False)
    title         = Column(String(300), nullable=False)
    platform      = Column(String(50), nullable=True)   # teams / zoom / meet / webex
    meeting_date  = Column(DateTime(timezone=True), nullable=True)
    meeting_url   = Column(Text, nullable=True)
    status        = Column(String(30), default="pending")  # pending / processing / done / failed
    recall_bot_id = Column(String(255), nullable=True, index=True)
    bot_status    = Column(String(50), nullable=True)   # joining / recording / done / failed
    bot_joined_at = Column(DateTime(timezone=True), nullable=True)
    bot_left_at   = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    project      = relationship("Project", back_populates="meetings")
    transcript   = relationship("MeetingTranscript", back_populates="meeting",
                                uselist=False, cascade="all, delete-orphan")
    ai_output    = relationship("MeetingAIOutput", back_populates="meeting",
                                uselist=False, cascade="all, delete-orphan")
    action_items = relationship("MeetingActionItem", back_populates="meeting",
                                cascade="all, delete-orphan",
                                order_by="MeetingActionItem.created_at.asc()")

    __table_args__ = (
        Index("idx_meetings_project", "project_id"),
    )
