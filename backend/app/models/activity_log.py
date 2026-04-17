from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Index
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id  = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    entity_type = Column(String(50), nullable=True)   # meeting / file / member / etc.
    entity_id   = Column(String, nullable=True)
    action_type = Column(String(50), nullable=True)   # created / approved / rejected / uploaded
    extra       = Column(JSON, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_activity_log_project", "project_id"),
    )
