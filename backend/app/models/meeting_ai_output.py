from sqlalchemy import Column, String, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
import uuid


class MeetingAIOutput(Base):
    __tablename__ = "meeting_ai_outputs"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"),
                        nullable=False, unique=True)
    attendees  = Column(JSON, nullable=True)   # ["Name1", "Name2"]
    decisions  = Column(JSON, nullable=True)   # ["decision1", ...]
    blockers   = Column(JSON, nullable=True)   # ["blocker1", ...]
    summary    = Column(Text, nullable=True)
    full_mom   = Column(Text, nullable=True)

    meeting = relationship("Meeting", back_populates="ai_output")
