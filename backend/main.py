from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import meetings, projects, bot, employees, knowledge, dashboard, performance, chat_api, clients
from app.db.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown (if needed in future)

app = FastAPI(
    title="RavenLens API",
    description="RavenLens — AI-powered meeting intelligence. Upload .vtt transcripts or join live meetings via Recall.ai bot to get structured MOM per project.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://raven-lense.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router,
    prefix="/projects",
    tags=["Projects"])
app.include_router(meetings.router,
    prefix="/meetings",
    tags=["Meetings"])
app.include_router(bot.router,
    prefix="/bot",
    tags=["Bot"])
app.include_router(employees.router,
    prefix="/employees",
    tags=["Employees"])
app.include_router(knowledge.router,
    prefix="/knowledge",
    tags=["Knowledge"])
app.include_router(dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"])
app.include_router(performance.router,
    prefix="/performance",
    tags=["Performance"])
app.include_router(chat_api.router,
    prefix="/chat",
    tags=["Chat"])
app.include_router(clients.router,
    prefix="/clients",
    tags=["Clients"])

@app.get("/health", tags=["Health"])
async def health():
    return {
        "app":     "RavenLens",
        "status":  "running",
        "version": "2.0.0",
        "docs":    "/docs",
    }