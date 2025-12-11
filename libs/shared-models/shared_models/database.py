import os
import logging
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import create_engine # For sync engine if needed for migrations later
from sqlalchemy.sql import text
from typing import Optional

# Import Base from models within the same package
# Ensure models are imported somewhere before init_db is called so Base is populated.
from .models import Base 

logger = logging.getLogger("shared_models.database")

# --- Database Configuration ---
DB_HOST = os.environ.get("DB_HOST")
DB_PORT = os.environ.get("DB_PORT")
DB_NAME = os.environ.get("DB_NAME")
DB_USER = os.environ.get("DB_USER")
DB_PASSWORD = os.environ.get("DB_PASSWORD")

# --- Lazy initialization ---
# Don't validate at import time - validate when engine is first accessed
_engine: Optional[object] = None
_async_session_local: Optional[object] = None
_sync_engine: Optional[object] = None

def _validate_db_config():
    """Validate database configuration. Called when engine is first accessed."""
    if not all([DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD]):
        missing_vars = [
            var_name
            for var_name, var_value in {
                "DB_HOST": DB_HOST,
                "DB_PORT": DB_PORT,
                "DB_NAME": DB_NAME,
                "DB_USER": DB_USER,
                "DB_PASSWORD": DB_PASSWORD,
            }.items()
            if not var_value
        ]
        raise ValueError(f"Missing required database environment variables: {', '.join(missing_vars)}")

def get_engine():
    """Get or create the async engine."""
    global _engine
    if _engine is None:
        _validate_db_config()
        DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        _engine = create_async_engine(
            DATABASE_URL, 
            echo=os.environ.get("LOG_LEVEL", "INFO").upper() == "DEBUG",
            pool_size=5,              # Modest pool size per service
            max_overflow=10,          # Allow temporary extra connections
            pool_timeout=30,          # Wait max 30s for a connection
            pool_recycle=1800,        # Recycle connections after 30 minutes
            pool_pre_ping=True,       # Verify connection health before use
        )
    return _engine

def get_async_session_local():
    """Get or create the async session factory."""
    global _async_session_local
    if _async_session_local is None:
        _async_session_local = sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_session_local

def get_sync_engine():
    """Get or create the sync engine for migrations."""
    global _sync_engine
    if _sync_engine is None:
        _validate_db_config()
        DATABASE_URL_SYNC = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        _sync_engine = create_engine(DATABASE_URL_SYNC)
    return _sync_engine

# Alias for internal use
_get_engine = get_engine

# Create a wrapper for async_session_local that initializes lazily
class AsyncSessionLocalWrapper:
    def __call__(self):
        return get_async_session_local()()
    
    def __getattr__(self, name):
        return getattr(get_async_session_local(), name)

async_session_local = AsyncSessionLocalWrapper()

# --- FastAPI Dependency --- 
async def get_db() -> AsyncSession:
    """FastAPI dependency to get an async database session."""
    session_factory = get_async_session_local()
    async with session_factory() as session:
        try:
            yield session
        finally:
            # Ensure session is closed, though context manager should handle it
            await session.close()

# --- Initialization Function --- 
async def init_db():
    """Creates database tables based on shared models' metadata."""
    logger.info(f"Initializing database tables at {DB_HOST}:{DB_PORT}/{DB_NAME}")
    try:
        async with _get_engine().begin() as conn:
            # This relies on all SQLAlchemy models being imported 
            # somewhere before this runs, so Base.metadata is populated.
            # Add checkfirst=True to prevent errors if tables already exist
            await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        logger.info("Database tables checked/created successfully.")
    except Exception as e:
        logger.error(f"Error initializing database tables: {e}", exc_info=True)
        raise 

# --- DANGEROUS: Recreate Function ---
async def recreate_db():
    """
    DANGEROUS: Drops all tables and recreates them based on shared models' metadata.
    THIS WILL RESULT IN COMPLETE DATA LOSS. USE WITH EXTREME CAUTION.
    """
    logger.warning(f"!!! DANGEROUS OPERATION: Dropping and recreating all tables in {DB_NAME} at {DB_HOST}:{DB_PORT} !!!")
    try:
        async with _get_engine().begin() as conn:
            # Instead of drop_all, use raw SQL to drop the schema with cascade
            logger.warning("Dropping public schema with CASCADE...")
            await conn.execute(text("DROP SCHEMA public CASCADE;"))
            logger.warning("Public schema dropped.")
            logger.info("Recreating public schema...")
            await conn.execute(text("CREATE SCHEMA public;"))
            # Optional: Grant permissions if needed (often handled by default roles)
            # await conn.execute(text("GRANT ALL ON SCHEMA public TO public;")) 
            # await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;")) 
            logger.info("Public schema recreated.")
            
            logger.info("Recreating all tables based on models...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("All tables recreated successfully.")
        logger.warning(f"!!! DANGEROUS OPERATION COMPLETE for {DB_NAME} at {DB_HOST}:{DB_PORT} !!!")
    except Exception as e:
        logger.error(f"Error recreating database tables: {e}", exc_info=True)
        raise 