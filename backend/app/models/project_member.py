from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class ProjectMember(Base):
    """
    Maps a person to a project.

    member_type = "internal"  → linked via employee_id (Employee)
    member_type = "client"    → linked via client_contact_id (ClientContact)

    Only one of employee_id / client_contact_id should be non-null.
    """
    __tablename__ = "project_members"

    id                = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id        = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role_in_project   = Column(String(100), nullable=True)
    member_type       = Column(String(20), nullable=False, default="internal")  # internal / client
    organization      = Column(String(200), nullable=True)
    employee_id       = Column(String, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    client_contact_id = Column(String, ForeignKey("client_contacts.id", ondelete="SET NULL"), nullable=True)
    created_at        = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    employee       = relationship("Employee", foreign_keys=[employee_id])
    client_contact = relationship("ClientContact", foreign_keys=[client_contact_id])

    __table_args__ = (
        Index("idx_project_members_project",  "project_id"),
        Index("idx_project_members_employee", "employee_id"),
        Index("idx_project_members_contact",  "client_contact_id"),
    )
