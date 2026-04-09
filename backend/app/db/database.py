from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./ravenlens.db")

# Convert standard PostgreSQL URL to async format
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def init_db():
    # Import all models so SQLAlchemy registers their tables before create_all
    from app.models import project, meeting, employee, knowledge, client, project_member, chat  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("RavenLens database initialised")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
