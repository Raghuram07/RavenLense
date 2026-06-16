# 🦅 RavenLens

> **Every meeting. Summarised. Delivered.**

RavenLens is an AI-powered meeting intelligence platform built for government agencies and compliance-driven organizations. It ingests meeting transcripts, extracts structured outputs — summaries, Minutes of Meeting (MOM), action items, and decision logs — and provides a searchable knowledge base with role-scoped RAG-powered Q&A.

---

## 🧭 Table of Contents

- [What It Does](#what-it-does)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Database](#database)
- [Environment Variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [CI/CD](#cicd)
- [Roles & Permissions](#roles--permissions)
- [Key Features](#key-features)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## What It Does

RavenLens transforms raw meeting transcripts into structured, searchable institutional memory. Core capabilities:

- **AI Summaries & MOM** — Auto-generates structured Minutes of Meeting and executive summaries from transcripts using AWS Bedrock (Claude)
- **Action Item Extraction** — Identifies, assigns, and tracks action items per meeting with due dates and owners
- **Decision Logs** — Surfaces and persists key decisions made in each meeting for audit and accountability
- **RAG-Powered Chat** — Ask questions across all meetings using a semantic retrieval pipeline (pgvector + Titan Embeddings v2), scoped by role
- **Knowledge Base** — Upload and manage reference documents; Managers approve files before they enter the retrieval index
- **Meeting Bot** — Schedules a bot to join and transcribe meetings via Recall.ai (Outlook calendar integration)
- **Microsoft Teams Integration** — Pulls transcripts directly from Teams meetings via Microsoft Graph API
- **Audit-Ready Activity Logs** — Full traceability of who did what and when across the platform

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                         │
│           React + TypeScript + Vite (Vercel)            │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────┐
│                        Backend                          │
│            FastAPI + SQLAlchemy Async (AWS App Runner)  │
└───────┬────────────────────────┬────────────────────────┘
        │                        │
┌───────▼────────┐    ┌──────────▼──────────────────────┐
│  PostgreSQL RDS │    │          AWS Bedrock             │
│  + pgvector     │    │  Claude (generation)             │
│  (embeddings,   │    │  Titan Embeddings v2 (RAG)       │
│   RAG chunks)   │    └─────────────────────────────────┘
└────────────────┘
        │
┌───────▼────────────────────────────────────────────────┐
│              External Integrations                      │
│  Recall.ai (meeting bot)  │  Microsoft Graph API        │
│  AWS S3 (file storage)    │  Azure App Registration     │
└────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, TypeScript, Vite, Vercel |
| **Backend** | FastAPI, Python, SQLAlchemy (async), Alembic |
| **Database** | PostgreSQL (AWS RDS) + pgvector extension |
| **AI / LLM** | AWS Bedrock — Claude (generation), Titan Embeddings v2 (RAG) |
| **File Storage** | AWS S3 |
| **Container / Deploy** | Docker, AWS ECR, AWS App Runner |
| **CI/CD** | GitHub Actions |
| **Meeting Bot** | Recall.ai (calendar integration V2 via Outlook OAuth) |
| **Teams Transcripts** | Microsoft Graph API / MSAL, Azure App Registration |
| **Local Tunneling** | ngrok (Recall.ai webhook testing) |

---

## Project Structure

```
ravenlens/
├── backend/
│   ├── app/
│   │   ├── api/              # Route handlers (meetings, chat, kb, users, actions)
│   │   ├── core/             # Config, auth, dependencies
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic (AI, RAG, Recall, Graph API)
│   │   └── main.py           # FastAPI app entry point
│   ├── alembic/              # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # Shared UI components
│   │   ├── pages/            # Dashboard, Chat, Knowledge Base, Meetings, etc.
│   │   ├── hooks/            # Custom React hooks
│   │   ├── api/              # API client layer
│   │   └── main.tsx
│   ├── public/
│   └── vite.config.ts
├── .github/
│   └── workflows/
│       ├── backend.yml       # Build, push to ECR, deploy to App Runner
│       └── frontend.yml      # Deploy to Vercel
└── docker-compose.yml        # Local development
```

---

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **Docker** & Docker Compose
- **PostgreSQL** 15+ with `pgvector` extension
- **AWS Account** with access to: Bedrock, RDS, S3, ECR, App Runner
- **Recall.ai** account (for meeting bot)
- **Azure App Registration** (for Microsoft Teams / Graph API)
- **ngrok** (for local webhook testing)

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/ravenlens.git
cd ravenlens
```

---

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

---

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

---

### Database

The app requires PostgreSQL with the `pgvector` extension enabled.

**Option A — Docker (recommended for local dev):**

```bash
docker run -d \
  --name ravenlens-db \
  -e POSTGRES_USER=ravenlens \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ravenlens \
  -p 5432:5432 \
  pgvector/pgvector:pg15

# Enable the extension (run once)
psql -U ravenlens -d ravenlens -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Option B — Run everything with Docker Compose:**

```bash
docker-compose up --build
```

---

## Environment Variables

### Backend (`.env`)

```env
# Database
DATABASE_URL=postgresql+asyncpg://ravenlens:password@localhost:5432/ravenlens

# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=ravenlens-files

# AWS Bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0

# Recall.ai
RECALL_API_KEY=your_recall_api_key
RECALL_WEBHOOK_URL=https://<your-ngrok-or-domain>/webhooks/recall

# Microsoft Graph API / Teams
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret

# Auth
JWT_SECRET_KEY=your_jwt_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# App
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

### Frontend (`.env.local`)

```env
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=RavenLens
```

---

## Running with Docker

Build and run the full stack locally:

```bash
docker-compose up --build
```

Services:
- **Backend**: `http://localhost:8000`
- **Frontend**: `http://localhost:5173`
- **Database**: `localhost:5432`

---

## CI/CD

RavenLens uses GitHub Actions for automated deployments.

| Trigger | Pipeline | Target |
|---|---|---|
| Push to `main` (backend changes) | Build Docker image → Push to AWS ECR → Deploy to App Runner | AWS App Runner |
| Push to `main` (frontend changes) | Build → Deploy | Vercel |

Secrets required in GitHub repository settings:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_REGISTRY
APP_RUNNER_SERVICE_ARN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

---

## Roles & Permissions

| Role | Scope | Capabilities |
|---|---|---|
| **Admin** | Organization-wide | Full access: manage users, all meetings, all projects, all KB files, activity logs |
| **Manager** | Project-scoped | View project meetings, approve/reject KB file uploads, manage action items |
| **Employee** | Own meetings | View own meetings & summaries, upload files to pending queue, track own action items |

RAG retrieval is scoped per role — employees only retrieve from their own meeting data; managers retrieve across their projects; admins retrieve org-wide.

---

## Key Features

### Meeting Intelligence
- Ingest transcripts via Recall.ai bot or Microsoft Teams
- Auto-generate AI summaries, structured MOM, decisions, and action items
- Speaker-attributed content with timestamps

### Knowledge Base
- Upload reference documents (PDF, DOCX, etc.)
- Role-based approval workflow (Employee uploads → Manager approves → Indexed for RAG)
- Semantic search across documents

### RAG Chat
- Ask natural language questions across all meeting history and KB documents
- Answers grounded in your organization's actual data, scoped by role
- Session history maintained per user

### Audit & Compliance
- Immutable activity log for all key actions
- Decision timeline view per project or meeting
- Configurable MOM templates for departmental standards

---

## Roadmap

- [ ] Speaker-attributed Q&A in RAG responses
- [ ] Decision timeline visualization
- [ ] Retrieval evaluation dashboard
- [ ] SSO / SAML integration
- [ ] Configurable MOM templates per department
- [ ] Public civic-tech demo (city council / school board transcripts)
- [ ] Data residency configuration (multi-region)

---

## Contributing

This project is currently in active development. If you'd like to contribute or report an issue, please open a GitHub Issue or reach out directly.

---

<p align="center">
  Built with ☕ and a lot of meeting transcripts.
</p>
