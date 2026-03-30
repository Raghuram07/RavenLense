# 🦅 RavenLens

> **Every meeting. Summarised. Delivered.**
> AI-powered meeting intelligence — upload a `.vtt` transcript, get structured MOM per person, saved per project.

---

## What RavenLens Does

```
You upload a .vtt file (Teams / Zoom / Meet / Webex)
              ↓
RavenLens parses it — speaker names, timestamps, dialogue
              ↓
Claude AI generates structured MOM:
  • Attendees
  • Key Decisions
  • Action Items (per person)
  • Blockers
  • 3-sentence Summary
              ↓
Everything saved to DB, linked to your project
              ↓
Query MOM by team member at any time
```

---

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

Docs at: http://localhost:8000/docs

---

## Postman — 3 Calls to Get MOM

### 1. Create Project
```
POST /projects/
{ "name": "IDOL-CMS", "client": "Dept of Labor" }
```
Save the `id`.

### 2. Upload VTT
```
POST /meetings/upload   (form-data)
  project_id  → [id from step 1]
  title       → Sprint 14 Review
  platform    → teams
  meeting_date→ 2025-03-07
  vtt_file    → [select sample_meeting.vtt]
```

### 3. Get MOM per Person
```
GET /meetings/{meeting_id}/mom
```

---

## Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/projects/` | Create project |
| GET | `/projects/` | List all projects |
| GET | `/projects/{id}` | Project details |
| POST | `/meetings/upload` | Upload VTT → generate MOM |
| GET | `/meetings/project/{id}` | Meetings for a project |
| GET | `/meetings/{id}` | Full MOM |
| GET | `/meetings/{id}/mom` | MOM by team member |
| DELETE | `/meetings/{id}` | Delete meeting |

---

## Structure

```
ravenlens/
├── app/
│   ├── main.py                  # FastAPI entry point
│   ├── api/
│   │   ├── projects.py          # Project endpoints
│   │   └── meetings.py          # Meeting upload + MOM endpoints
│   ├── models/
│   │   ├── project.py           # Project DB model
│   │   └── meeting.py           # Meeting DB model
│   ├── services/
│   │   ├── vtt_parser.py        # Parse .vtt files
│   │   └── ai_summariser.py     # Claude API integration
│   └── db/database.py           # SQLite / PostgreSQL
├── sample_meeting.vtt
├── requirements.txt
└── .env.example
```

---

## Roadmap

```
v1 NOW   → Manual .vtt upload via Postman, Claude MOM, DB per project
v2 NEXT  → Auto-fetch from Teams Graph API, post MOM to Teams channel
v3 LATER → Recall.ai (all platforms), PDF export, web dashboard
```

*RavenLens — Sharp eyes on every conversation.*
