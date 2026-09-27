import os
from pydantic import BaseModel

class Settings(BaseModel):
    # Sentinel Sandbox Ingest Gateway URL
    SENTINEL_GATEWAY_URL: str = os.getenv("SENTINEL_GATEWAY_URL", "http://localhost:8555")
    
    # Database URL: default uses SQLite for zero-config native dev; PostgreSQL in Docker
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite+aiosqlite:///./sentinel.db"
    )
    POSTGRES_DOCKER_URL: str = "postgresql+asyncpg://sentinel:sentinel_secret@postgres:5432/sentinel_db"
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_STREAM_FRAMES: str = "stream:camera_frames"
    REDIS_CHANNEL_ALERTS: str = "channel:sentinel_alerts"
    
    # Ingestion tuning
    DEFAULT_RTSP_TRANSPORT: str = "tcp"
    RECONNECT_INITIAL_DELAY_SEC: float = 2.0
    RECONNECT_MAX_DELAY_SEC: float = 30.0
    RECONNECT_BACKOFF_FACTOR: float = 2.0
    
    # Scene cut / PTS discontinuity threshold (in milliseconds)
    # If PTS backward jump > 1000ms or forward jump > 15000ms, trigger scene cut reset
    SCENE_CUT_PTS_DROP_MS: float = 1000.0
    SCENE_CUT_PTS_JUMP_MS: float = 15000.0
    
    # Analytics inference throttling (sample 1 frame per N milliseconds of PTS)
    ANALYTICS_SAMPLE_INTERVAL_PTS_MS: float = 400.0
    
    # Services host & ports
    REGISTRY_PORT: int = int(os.getenv("REGISTRY_PORT", "8001"))
    INGESTION_PORT: int = int(os.getenv("INGESTION_PORT", "8002"))
    ANALYTICS_PORT: int = int(os.getenv("ANALYTICS_PORT", "8003"))
    ALERT_PORT: int = int(os.getenv("ALERT_PORT", "8004"))
    MOCK_PORT: int = int(os.getenv("MOCK_PORT", "8555"))

settings = Settings()
