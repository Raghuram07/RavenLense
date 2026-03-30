from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from app.db.database import get_db
from app.models.project import Project
from app.models.meeting import Meeting
from datetime import datetime

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    client:      Optional[str] = None

class ProjectResponse(BaseModel):
    id:            str
    name:          str
    description:   Optional[str]
    client:        Optional[str]
    created_at:    datetime
    meeting_count: int = 0

    class Config:
        from_attributes = True

# ── Endpoints ─────────────────────────────────────────────

@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Create a new project. Every meeting will be linked to a project."""
    project = Project(
        name=body.name,
        description=body.description,
        client=body.client
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {**project.__dict__, "meeting_count": 0}


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all projects with their meeting counts."""
    result   = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()

    output = []
    for p in projects:
        count_result = await db.execute(
            select(Meeting).where(Meeting.project_id == p.id)
        )
        count = len(count_result.scalars().all())
        output.append({**p.__dict__, "meeting_count": count})
    return output


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    count_result = await db.execute(
        select(Meeting).where(Meeting.project_id == project_id)
    )
    count = len(count_result.scalars().all())
    return {**project.__dict__, "meeting_count": count}


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
