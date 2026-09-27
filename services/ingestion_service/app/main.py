import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.ingestion_service.app.manager import manager
from services.ingestion_service.app.relay import router as relay_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sentinel.ingestion")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Sentinel Ingestion & Stream Gateway Service...")
    await manager.initialize()
    # Auto-start discovered cameras
    await manager.start_all()
    yield
    logger.info("Shutting down Sentinel Ingestion Service...")
    await manager.stop_all()

app = FastAPI(
    title="Gujarat Police Sentinel — Ingestion & Stream Gateway Service",
    description="RTSP/TCP ingestion gateway with strict PTS timing, adaptive decoders, scene cut loop recovery, and zero raw video persistence",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(relay_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "service": "Sentinel Ingestion & Stream Gateway",
        "transport": "FORCED_TCP_ONLY",
        "storage": "ZERO_RAW_PERSISTENCE",
        "status": "active"
    }

@app.get("/api/ingest/status")
async def get_ingestion_status():
    """Returns streaming health, PTS metrics, scene-cut recovery counts, and transport stats"""
    return manager.get_status()

@app.post("/api/ingest/refresh")
async def refresh_catalogue():
    cams = await manager.refresh_catalogue()
    return {"status": "refreshed", "discovered_count": len(cams)}

@app.post("/api/ingest/cameras/{camera_id}/start")
async def start_camera_stream(camera_id: str):
    success = await manager.start_camera(camera_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start camera stream")
    return {"status": "started", "camera_id": camera_id}

@app.post("/api/ingest/cameras/{camera_id}/stop")
async def stop_camera_stream(camera_id: str):
    await manager.stop_camera(camera_id)
    return {"status": "stopped", "camera_id": camera_id}

@app.post("/api/ingest/start-all")
async def start_all_streams():
    await manager.start_all()
    return {"status": "all_started", "active_workers": len(manager.workers)}

@app.post("/api/ingest/stop-all")
async def stop_all_streams():
    await manager.stop_all()
    return {"status": "all_stopped"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.ingestion_service.app.main:app", host="0.0.0.0", port=8002, reload=True)
