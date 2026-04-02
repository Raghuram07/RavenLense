from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import meetings, projects, bot
from app.db.database import init_db

app = FastAPI(
    title="RavenLens API",
    description="RavenLens — AI-powered meeting intelligence. Upload .vtt transcripts or join live meetings via Recall.ai bot to get structured MOM per project.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://raven-lense.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(meetings.router,  prefix="/meetings",  tags=["Meetings"])
app.include_router(bot.router,       prefix="/bot",       tags=["Bot"])

@app.get("/health", tags=["Health"])
async def health():
    return {
        "app":     "RavenLens",
        "status":  "running",
        "version": "2.0.0",
        "docs":    "/docs",
    }
