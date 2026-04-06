from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from app.db.database import get_db
from app.models.project import Project
from app.models.meeting import Meeting
from app.models.project_member import ProjectMember
from datetime import datetime

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────

class ProjectMemberCreate(BaseModel):
    name:            str
    email:           Optional[str] = None
    role_in_project: Optional[str] = None
    member_type:     str = "internal"   # internal / client
    organization:    Optional[str] = None
    employee_id:     Optional[str] = None


class ProjectMemberResponse(BaseModel):
    id:              str
    project_id:      str
    name:            str
    email:           Optional[str]
    role_in_project: Optional[str]
    member_type:     str
    organization:    Optional[str]
    employee_id:     Optional[str]
    created_at:      datetime

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    client:      Optional[str] = None
    members:     Optional[List[ProjectMemberCreate]] = []


class ProjectUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    client:      Optional[str] = None


class ProjectResponse(BaseModel):
    id:            str
    name:          str
    description:   Optional[str]
    client:        Optional[str]
    created_at:    datetime
    meeting_count: int = 0
    members:       List[ProjectMemberResponse] = []

    class Config:
        from_attributes = True

# ── Endpoints ─────────────────────────────────────────────

async def _with_counts(db: AsyncSession, projects: list) -> list:
    output = []
    for p in projects:
        count_result = await db.execute(select(Meeting).where(Meeting.project_id == p.id))
        count = len(count_result.scalars().all())
        member_result = await db.execute(
            select(ProjectMember).where(ProjectMember.project_id == p.id)
        )
        members = member_result.scalars().all()
        output.append({**p.__dict__, "meeting_count": count, "members": members})
    return output


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=body.name, description=body.description, client=body.client)
    db.add(project)
    await db.flush()  # get project.id

    for m in (body.members or []):
        db.add(ProjectMember(
            project_id=project.id,
            name=m.name,
            email=m.email,
            role_in_project=m.role_in_project,
            member_type=m.member_type,
            organization=m.organization,
            employee_id=m.employee_id,
        ))

    await db.commit()
    await db.refresh(project)
    result = await _with_counts(db, [project])
    return result[0]


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result   = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return await _with_counts(db, projects)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    rows = await _with_counts(db, [project])
    return rows[0]


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    rows = await _with_counts(db, [project])
    return rows[0]


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Project).where(Project.id == project_id))
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
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.created_at.asc())
    )
    return result.scalars().all()


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=201)
async def add_member(project_id: str, body: ProjectMemberCreate, db: AsyncSession = Depends(get_db)):
    pr = await db.execute(select(Project).where(Project.id == project_id))
    if not pr.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    member = ProjectMember(
        project_id=project_id,
        name=body.name,
        email=body.email,
        role_in_project=body.role_in_project,
        member_type=body.member_type,
        organization=body.organization,
        employee_id=body.employee_id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


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
