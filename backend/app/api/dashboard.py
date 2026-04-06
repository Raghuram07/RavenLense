from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.meeting import Meeting
from app.models.project import Project

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    """High-level counts for the dashboard metrics cards."""
    proj_result = await db.execute(select(Project))
    projects = proj_result.scalars().all()

    meet_result = await db.execute(select(Meeting))
    meetings = meet_result.scalars().all()

    total_meetings   = len(meetings)
    done_meetings    = sum(1 for m in meetings if m.status == "done")
    total_actions    = sum(len(m.action_items or []) for m in meetings if m.action_items)
    pending_meetings = sum(1 for m in meetings if m.status in ("pending", "processing"))
    mom_pct          = round(done_meetings / total_meetings * 100) if total_meetings else 0

    return {
        "total_meetings":    total_meetings,
        "done_meetings":     done_meetings,
        "pending_meetings":  pending_meetings,
        "total_action_items": total_actions,
        "mom_completion_pct": mom_pct,
        "active_projects":   len(projects),
    }


@router.get("/open-actions")
async def open_actions(db: AsyncSession = Depends(get_db)):
    """
    Return all action items extracted from completed meeting MOMs.
    Ordered by most recently created meeting first.
    """
    result = await db.execute(
        select(Meeting)
        .where(Meeting.status == "done")
        .order_by(Meeting.created_at.desc())
    )
    meetings = result.scalars().all()

    items = []
    for m in meetings:
        for item in (m.action_items or []):
            items.append({
                "meeting_id":    m.id,
                "meeting_title": m.title,
                "project_id":    m.project_id,
                "owner":         item.get("owner", ""),
                "task":          item.get("task", ""),
                "due":           item.get("due"),
                "status":        "open",
            })

    return {"action_items": items, "total": len(items)}


@router.get("/recent-meetings")
async def recent_meetings(db: AsyncSession = Depends(get_db)):
    """Return the 5 most recently created meetings for dashboard display."""
    result = await db.execute(
        select(Meeting).order_by(Meeting.created_at.desc()).limit(5)
    )
    meetings = result.scalars().all()

    output = []
    for m in meetings:
        output.append({
            "id":             m.id,
            "title":          m.title,
            "status":         m.status,
            "platform":       m.platform,
            "meeting_date":   m.meeting_date.isoformat() if m.meeting_date else None,
            "created_at":     m.created_at.isoformat() if m.created_at else None,
            "attendee_count": len(m.attendees or []),
            "action_count":   len(m.action_items or []),
            "project_id":     m.project_id,
        })
    return {"meetings": output}
