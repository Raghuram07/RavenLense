from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid

class Meeting(Base):
    __tablename__ = "meetings"

    id             = Column(String,  primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id     = Column(String,  ForeignKey("projects.id"), nullable=False)
    title          = Column(String(300), nullable=False)
    platform       = Column(String(50),  nullable=True)   # teams / zoom / meet / webex
    meeting_date   = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Raw storage
    raw_vtt        = Column(Text, nullable=True)   # original .vtt file content
    raw_transcript = Column(Text, nullable=True)   # parsed plain text

    # AI-generated MOM
    attendees      = Column(JSON, nullable=True)   # ["Name1", "Name2"]
    decisions      = Column(JSON, nullable=True)   # ["decision1", ...]
    action_items   = Column(JSON, nullable=True)   # [{"owner":"Name","task":"...","due":"..."}]
    blockers       = Column(JSON, nullable=True)   # ["blocker1", ...]
    summary        = Column(Text, nullable=True)   # 3-sentence plain English summary
    full_mom       = Column(Text, nullable=True)   # full formatted MOM text
    status         = Column(String(30), default="pending")  # pending / processing / done / failed

    # Recall.ai live bot fields
    recall_bot_id  = Column(String(255), nullable=True, index=True)
    meeting_url    = Column(Text,        nullable=True)
    bot_status     = Column(String(50),  nullable=True)  # joining/recording/done/failed
    bot_joined_at  = Column(DateTime(timezone=True), nullable=True)
    bot_left_at    = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="meetings")
