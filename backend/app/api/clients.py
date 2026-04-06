from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.models.client import Client, ClientContact

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────

class ContactCreate(BaseModel):
    name:  str
    email: Optional[str] = None
    role:  Optional[str] = None


class ContactResponse(BaseModel):
    id:         str
    client_id:  str
    name:       str
    email:      Optional[str]
    role:       Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    name:     str
    email:    Optional[str] = None
    phone:    Optional[str] = None
    contacts: Optional[List[ContactCreate]] = []


class ClientResponse(BaseModel):
    id:         str
    name:       str
    email:      Optional[str]
    phone:      Optional[str]
    created_at: datetime
    contacts:   List[ContactResponse] = []

    class Config:
        from_attributes = True


# ── Client endpoints ──────────────────────────────────────

@router.get("/", response_model=List[ClientResponse])
async def list_clients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Client)
        .options(selectinload(Client.contacts))
        .order_by(Client.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=ClientResponse, status_code=201)
async def create_client(body: ClientCreate, db: AsyncSession = Depends(get_db)):
    client = Client(name=body.name, email=body.email, phone=body.phone)
    db.add(client)
    await db.flush()  # get client.id before adding contacts

    for c in (body.contacts or []):
        db.add(ClientContact(
            client_id=client.id,
            name=c.name,
            email=c.email,
            role=c.role,
        ))

    await db.commit()
    await db.refresh(client)

    # reload with contacts
    result = await db.execute(
        select(Client).options(selectinload(Client.contacts)).where(Client.id == client.id)
    )
    return result.scalar_one()


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Client).options(selectinload(Client.contacts)).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, body: ClientCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Client).options(selectinload(Client.contacts)).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if body.name is not None:
        client.name = body.name
    if body.email is not None:
        client.email = body.email
    if body.phone is not None:
        client.phone = body.phone
    await db.commit()
    await db.refresh(client)
    result2 = await db.execute(
        select(Client).options(selectinload(Client.contacts)).where(Client.id == client_id)
    )
    return result2.scalar_one()


@router.delete("/{client_id}", status_code=204)
async def delete_client(client_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()


# ── Contact endpoints ─────────────────────────────────────

@router.post("/{client_id}/contacts", response_model=ContactResponse, status_code=201)
async def add_contact(client_id: str, body: ContactCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    contact = ClientContact(client_id=client_id, name=body.name, email=body.email, role=body.role)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.patch("/{client_id}/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(client_id: str, contact_id: str, body: ContactCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientContact)
        .where(ClientContact.id == contact_id, ClientContact.client_id == client_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if body.name is not None:
        contact.name = body.name
    if body.email is not None:
        contact.email = body.email
    if body.role is not None:
        contact.role = body.role
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{client_id}/contacts/{contact_id}", status_code=204)
async def delete_contact(client_id: str, contact_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientContact)
        .where(ClientContact.id == contact_id, ClientContact.client_id == client_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
