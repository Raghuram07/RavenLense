from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class Project(Base):
    __tablename__ = "projects"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name        = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    client_id   = Column(String, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))

    meetings = relationship("Meeting", back_populates="project", cascade="all, delete-orphan")
    client   = relationship("Client", foreign_keys=[client_id])
