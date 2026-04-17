from sqlalchemy import Column, String, DateTime
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class Employee(Base):
    __tablename__ = "employees"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    first_name   = Column(String(100), nullable=False)
    last_name    = Column(String(100), nullable=False)
    email        = Column(String(200), nullable=False, unique=True)
    department   = Column(String(100), nullable=True)
    organization = Column(String(200), nullable=True)
    role         = Column(String(50), nullable=False, default="employee")  # admin / manager / employee
    status       = Column(String(20), nullable=False, default="active")    # active / inactive
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime(timezone=True),
                          default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))
