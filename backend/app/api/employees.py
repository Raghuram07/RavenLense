from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.models.employee import Employee

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    first_name:   str
    last_name:    str
    email:        str
    department:   Optional[str] = None
    organization: Optional[str] = None
    role:         Optional[str] = "employee"
    status:       Optional[str] = "active"


class EmployeeUpdate(BaseModel):
    first_name:   Optional[str] = None
    last_name:    Optional[str] = None
    email:        Optional[str] = None
    department:   Optional[str] = None
    organization: Optional[str] = None
    role:         Optional[str] = None
    status:       Optional[str] = None


class EmployeeResponse(BaseModel):
    id:           str
    first_name:   str
    last_name:    str
    email:        str
    department:   Optional[str]
    organization: Optional[str]
    role:         str
    status:       str
    created_at:   datetime

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────

@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).order_by(Employee.created_at.desc()))
    return result.scalars().all()


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.post("/", response_model=EmployeeResponse, status_code=201)
async def create_employee(body: EmployeeCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Employee).where(Employee.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An employee with this email already exists")

    emp = Employee(**body.model_dump())
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(employee_id: str, body: EmployeeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = body.model_dump(exclude_none=True)
    if "email" in updates and updates["email"] != emp.email:
        clash = await db.execute(select(Employee).where(Employee.email == updates["email"]))
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use by another employee")

    for field, value in updates.items():
        setattr(emp, field, value)

    await db.commit()
    await db.refresh(emp)
    return emp


@router.patch("/{employee_id}/status", response_model=EmployeeResponse)
async def toggle_employee_status(employee_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp.status = "inactive" if emp.status == "active" else "active"
    await db.commit()
    await db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.delete(emp)
    await db.commit()
