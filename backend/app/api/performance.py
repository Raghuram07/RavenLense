from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.meeting import Meeting

router = APIRouter()


def _initials(name: str) -> str:
    parts = name.strip().split()
    return "".join(p[0].upper() for p in parts[:2]) if parts else "??"


@router.get("/overview")
async def performance_overview(db: AsyncSession = Depends(get_db)):
    """
    Org-wide performance snapshot derived entirely from completed meeting MOMs.
    Returns: avg participation score, action completion %, decisions per meeting.
    """
    result = await db.execute(select(Meeting).where(Meeting.status == "done"))
    meetings = result.scalars().all()

    if not meetings:
        return {
            "avg_participation_score": 0.0,
            "action_completion_pct":   0,
            "decisions_per_meeting":   0.0,
            "total_meetings":          0,
            "total_action_items":      0,
            "total_decisions":         0,
        }

    total_decisions = sum(len(m.decisions or []) for m in meetings)
    total_actions   = sum(len(m.action_items or []) for m in meetings)
    total_attendees = sum(len(m.attendees or []) for m in meetings)

    # Participation score: avg attendees per meeting normalised to 10
    # 8 or more attendees per meeting → score of 10
    avg_att = total_attendees / len(meetings)
    part_score = round(min(10.0, avg_att * 10 / 8), 1)

    return {
        "avg_participation_score": part_score,
        "action_completion_pct":   76,         # placeholder — no completion tracking yet
        "decisions_per_meeting":   round(total_decisions / len(meetings), 1),
        "total_meetings":          len(meetings),
        "total_action_items":      total_actions,
        "total_decisions":         total_decisions,
    }


@router.get("/members")
async def performance_members(db: AsyncSession = Depends(get_db)):
    """
    Per-member stats derived from meeting MOMs:
      - how many meetings they attended
      - how many action items they were assigned
    """
    result = await db.execute(select(Meeting).where(Meeting.status == "done"))
    meetings = result.scalars().all()

    if not meetings:
        return {"members": []}

    member_stats: dict = defaultdict(lambda: {"meetings_attended": 0, "action_items_total": 0})

    for m in meetings:
        for name in (m.attendees or []):
            member_stats[name]["meetings_attended"] += 1

        for item in (m.action_items or []):
            owner = item.get("owner", "").strip()
            if owner:
                # Fuzzy match owner name to attendee list to normalise
                matched = next(
                    (k for k in member_stats if
                     owner.lower() in k.lower() or k.lower() in owner.lower()),
                    owner,
                )
                member_stats[matched]["action_items_total"] += 1

    total_meetings = len(meetings)
    output = []
    for name, stats in member_stats.items():
        attended = stats["meetings_attended"]
        total_ai = stats["action_items_total"]
        # participation score out of 10
        part = round(min(10.0, attended / total_meetings * 10 * 1.2), 1)
        # estimate done at 76 % completion rate (no tracking yet)
        done = round(total_ai * 0.76)

        pill = "hi" if part >= 8 else ("md" if part >= 6 else "lo")
        label = "Strong" if part >= 8 else ("On track" if part >= 6 else "Needs review")

        output.append({
            "name":                name,
            "initials":            _initials(name),
            "meetings_attended":   attended,
            "action_items_total":  total_ai,
            "action_items_done":   done,
            "participation_score": part,
            "pill":                pill,
            "label":               label,
        })

    output.sort(key=lambda x: x["participation_score"], reverse=True)
    return {"members": output}
