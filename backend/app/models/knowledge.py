from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Index
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class KnowledgeFolder(Base):
    __tablename__ = "knowledge_folders"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    name       = Column(String(200), nullable=False)
    emoji      = Column(String(10), nullable=True, default="📁")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    files = relationship("KnowledgeFile", back_populates="folder",
                         cascade="all, delete-orphan",
                         order_by="KnowledgeFile.created_at.desc()")


class KnowledgeFile(Base):
    __tablename__ = "knowledge_files"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    folder_id        = Column(String, ForeignKey("knowledge_folders.id"), nullable=True)
    project_id       = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    name             = Column(String(300), nullable=False)
    mime_type        = Column(String(100), nullable=True)
    size_bytes       = Column(Integer, nullable=True)
    content          = Column(Text, nullable=True)        # extracted plain-text
    status           = Column(String(30), nullable=False, default="pending")  # pending / approved / rejected
    uploaded_by_name = Column(String(200), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by_name = Column(String(200), nullable=True)
    reviewed_at      = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    folder = relationship("KnowledgeFolder", back_populates="files")
