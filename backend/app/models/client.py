from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime, timezone
import uuid


class Client(Base):
    __tablename__ = "clients"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String(200), nullable=False)   # organisation / company name
    email      = Column(String(200), nullable=True)
    phone      = Column(String(50),  nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    contacts = relationship("ClientContact", back_populates="client",
                            cascade="all, delete-orphan",
                            order_by="ClientContact.created_at.asc()")


class ClientContact(Base):
    __tablename__ = "client_contacts"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id  = Column(String, ForeignKey("clients.id"), nullable=False)
    name       = Column(String(200), nullable=False)
    email      = Column(String(200), nullable=True)
    role       = Column(String(100), nullable=True)   # e.g. BA, Tester, PM
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    client = relationship("Client", back_populates="contacts")
