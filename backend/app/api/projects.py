from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from app.db.database import get_db
from app.models.project import Project
from app.models.meeting import Meeting
from app.models.project_member import ProjectMember
from app.models.employee import Employee
from app.models.client import ClientContact
from datetime import datetime

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────

class ProjectMemberCreate(BaseModel):
    role_in_project:   Optional[str] = None
    member_type:       str = "internal"   # internal / client
    organization:      Optional[str] = None
    employee_id:       Optional[str] = None
    client_contact_id: Optional[str] = None


class ProjectMemberResponse(BaseModel):
    id:                str
    project_id:        str
    role_in_project:   Optional[str]
    member_type:       str
    organization:      Optional[str]
    employee_id:       Optional[str]
    client_contact_id: Optional[str]
    display_name:      Optional[str] = None
    display_email:     Optional[str] = None
    created_at:        datetime

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    client_id:   Optional[str] = None
    members:     Optional[List[ProjectMemberCreate]] = []


class ProjectUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    client_id:   Optional[str] = None


class ProjectResponse(BaseModel):
    id:            str
    name:          str
    description:   Optional[str]
    client_id:     Optional[str]
    client_name:   Optional[str] = None
    created_at:    datetime
    meeting_count: int = 0
    members:       List[ProjectMemberResponse] = []

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────

def _member_display(member: ProjectMember) -> dict:
    """Resolve display_name / display_email from linked entity."""
    name = email = None
    if member.employee:
        name  = f"{member.employee.first_name} {member.employee.last_name}"
        email = member.employee.email
    elif member.client_contact:
        name  = member.client_contact.name
        email = member.client_contact.email
    return {
        **member.__dict__,
        "display_name":  name,
        "display_email": email,
    }


async def _with_counts(db: AsyncSession, projects: list) -> list:
    output = []
    for p in projects:
        count_result = await db.execute(select(Meeting).where(Meeting.project_id == p.id))
        count = len(count_result.scalars().all())

        member_result = await db.execute(
            select(ProjectMember)
            .options(
                selectinload(ProjectMember.employee),
                selectinload(ProjectMember.client_contact),
            )
            .where(ProjectMember.project_id == p.id)
        )
        members = [_member_display(m) for m in member_result.scalars().all()]

        client_name = p.client.name if p.client else None

        output.append({
            **p.__dict__,
            "client_name":   client_name,
            "meeting_count": count,
            "members":       members,
        })
    return output


# ── Endpoints ─────────────────────────────────────────────

@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=body.name, description=body.description, client_id=body.client_id)
    db.add(project)
    await db.flush()

    for m in (body.members or []):
        db.add(ProjectMember(
            project_id=project.id,
            role_in_project=m.role_in_project,
            member_type=m.member_type,
            organization=m.organization,
            employee_id=m.employee_id,
            client_contact_id=m.client_contact_id,
        ))

    await db.commit()

    result = await db.execute(
        select(Project).options(selectinload(Project.client)).where(Project.id == project.id)
    )
    project = result.scalar_one()
    rows = await _with_counts(db, [project])
    return rows[0]


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.client))
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return await _with_counts(db, projects)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.client)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    rows = await _with_counts(db, [project])
    return rows[0]


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.client)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    await db.commit()

    result = await db.execute(
        select(Project).options(selectinload(Project.client)).where(Project.id == project_id)
    )
    project = result.scalar_one()
    rows = await _with_counts(db, [project])
    return rows[0]


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


# ── Member sub-endpoints ──────────────────────────────────

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def list_members(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectMember)
        .options(
            selectinload(ProjectMember.employee),
            selectinload(ProjectMember.client_contact),
        )
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.created_at.asc())
    )
    return [_member_display(m) for m in result.scalars().all()]


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=201)
async def add_member(project_id: str, body: ProjectMemberCreate, db: AsyncSession = Depends(get_db)):
    pr = await db.execute(select(Project).where(Project.id == project_id))
    if not pr.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    if body.member_type == "internal" and not body.employee_id:
        raise HTTPException(status_code=400, detail="employee_id required for internal members")
    if body.member_type == "client" and not body.client_contact_id:
        raise HTTPException(status_code=400, detail="client_contact_id required for client members")

    member = ProjectMember(
        project_id=project_id,
        role_in_project=body.role_in_project,
        member_type=body.member_type,
        organization=body.organization,
        employee_id=body.employee_id,
        client_contact_id=body.client_contact_id,
    )
    db.add(member)
    await db.commit()

    result = await db.execute(
        select(ProjectMember)
        .options(
            selectinload(ProjectMember.employee),
            selectinload(ProjectMember.client_contact),
        )
        .where(ProjectMember.id == member.id)
    )
    return _member_display(result.scalar_one())


@router.delete("/{project_id}/members/{member_id}", status_code=204)
async def remove_member(project_id: str, member_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.id == member_id, ProjectMember.project_id == project_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()
