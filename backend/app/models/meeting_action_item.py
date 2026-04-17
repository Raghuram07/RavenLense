from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class MeetingActionItem(Base):
    __tablename__ = "meeting_action_items"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    owner      = Column(String(200), nullable=True)
    task       = Column(Text, nullable=False)
    due_date   = Column(String(50), nullable=True)   # flexible string to match AI output format
    status     = Column(String(20), nullable=False, default="open")  # open / in_progress / done
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    meeting = relationship("Meeting", back_populates="action_items")

    __table_args__ = (
        Index("idx_action_items_meeting", "meeting_id"),
    )
