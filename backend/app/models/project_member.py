from sqlalchemy import Column, String, DateTime, ForeignKey
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class ProjectMember(Base):
    """
    A person involved in a project's meetings.

    member_type = "internal"  → a team employee (optionally linked via employee_id)
    member_type = "client"    → an external client contact (organization field used)
    """
    __tablename__ = "project_members"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id      = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String(200), nullable=False)
    email           = Column(String(200), nullable=True)
    role_in_project = Column(String(100), nullable=True)   # BA / Tester / Developer / PM / QA …
    member_type     = Column(String(20),  nullable=False, default="internal")  # internal / client
    organization    = Column(String(200), nullable=True)   # for client members
    employee_id     = Column(String, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
