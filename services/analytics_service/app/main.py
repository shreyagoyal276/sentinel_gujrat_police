import logging
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from services.common.database import get_db, init_db
from services.common.models import Detection, Watchlist, Camera
from services.common.schemas import DetectionOut, WatchlistCreate, WatchlistOut
from services.analytics_service.app.route_builder import reconstruct_vehicle_route
from services.analytics_service.app.watchlist_matcher import watchlist_matcher
from services.analytics_service.app.stream_consumer import stream_consumer
from services.analytics_service.app.detector import plate_detector

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sentinel.analytics")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Sentinel AI Analytics Service...")
    await init_db()
    await watchlist_matcher.connect()
    await stream_consumer.start()
    yield
    logger.info("Shutting down Sentinel AI Analytics Service...")
    await stream_consumer.stop()

app = FastAPI(
    title="Gujarat Police Sentinel — AI Analytics & Tracking Service",
    description="ANPR, Vehicle Tracking, PTS-derived Velocity, and Multi-Camera Journey Reconstruction",
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

@app.get("/")
async def root():
    return {
        "service": "Gujarat Police Sentinel AI Analytics",
        "models": "YOLOv8 + OCR",
        "status": "active"
    }

@app.get("/api/analytics/detections", response_model=List[DetectionOut])
async def list_detections(
    camera_id: Optional[str] = None,
    plate_text: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Detection)
        .options(selectinload(Detection.camera))
        .order_by(desc(Detection.detected_at))
        .limit(limit)
    )
    if camera_id:
        stmt = stmt.where(Detection.camera_id == camera_id)
    if plate_text:
        clean = plate_text.replace(" ", "").upper()
        stmt = stmt.where(Detection.plate_text.ilike(f"%{clean}%"))

    res = await db.execute(stmt)
    return res.scalars().all()

@app.get("/api/analytics/routes/{plate_text}")
async def get_vehicle_route(plate_text: str, db: AsyncSession = Depends(get_db)):
    """
    Multi-camera vehicle tracking:
    Given a queried plate number, returns every detection across all cameras ordered by timestamp,
    to reconstruct a timestamped, location-wise route with transit speeds and map polyline coordinates.
    """
    return await reconstruct_vehicle_route(plate_text, db)

@app.get("/api/analytics/watchlist", response_model=List[WatchlistOut])
async def list_watchlist(
    category: Optional[str] = None,
    priority: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Watchlist).order_by(desc(Watchlist.added_at))
    if active_only:
        stmt = stmt.where(Watchlist.is_active == True)
    if category:
        stmt = stmt.where(Watchlist.category == category.upper())
    if priority:
        stmt = stmt.where(Watchlist.priority == priority.upper())
    res = await db.execute(stmt)
    return res.scalars().all()

@app.post("/api/analytics/watchlist", response_model=WatchlistOut, status_code=201)
async def add_watchlist_plate(payload: WatchlistCreate, db: AsyncSession = Depends(get_db)):
    clean_plate = payload.plate_text.replace(" ", "").replace("-", "").upper()
    existing = await db.execute(select(Watchlist).where(Watchlist.plate_text == clean_plate))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Plate already exists in watchlist")

    item_data = payload.model_dump()
    item_data["plate_text"] = clean_plate
    item = Watchlist(**item_data)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@app.delete("/api/analytics/watchlist/{watchlist_id}")
async def remove_watchlist_plate(watchlist_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    item.is_active = False
    await db.commit()
    return {"status": "deactivated", "id": watchlist_id}

@app.get("/api/analytics/stats")
async def get_analytics_stats(db: AsyncSession = Depends(get_db)):
    total_detections = await db.execute(select(Detection.id))
    total_det_count = len(total_detections.scalars().all())

    active_watchlist = await db.execute(select(Watchlist.id).where(Watchlist.is_active == True))
    watchlist_count = len(active_watchlist.scalars().all())

    return {
        "total_detections_recorded": total_det_count,
        "active_watchlist_targets": watchlist_count,
        "inference_engine": "YOLOv8 + EasyOCR",
        "pts_sampling_interval_ms": 400.0,
        "status": "operational"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.analytics_service.app.main:app", host="0.0.0.0", port=8003, reload=True)
