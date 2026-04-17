from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
import uuid


class MeetingTranscript(Base):
    __tablename__ = "meeting_transcripts"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id     = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"),
                            nullable=False, unique=True)
    raw_vtt        = Column(Text, nullable=True)
    raw_transcript = Column(Text, nullable=True)

    meeting = relationship("Meeting", back_populates="transcript")
