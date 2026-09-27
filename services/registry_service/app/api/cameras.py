from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload
from services.common.database import get_db
from services.common.models import Camera, Department, CameraHealthLog
from services.common.schemas import CameraCreate, CameraUpdate, CameraOut, SentinelCatalogueCamera
from services.registry_service.app.services.sentinel_sync import sync_cameras_from_sentinel

router = APIRouter(prefix="/cameras", tags=["Cameras Registry"])

@router.get("", response_model=List[CameraOut])
async def list_cameras(
    dept_id: Optional[str] = None,
    status: Optional[str] = None,
    camera_type: Optional[str] = None,
    query: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Camera).options(selectinload(Camera.department))
    
    if dept_id:
        stmt = stmt.where(Camera.dept_id == dept_id)
    if status:
        stmt = stmt.where(Camera.status == status.upper())
    if camera_type:
        stmt = stmt.where(Camera.camera_type == camera_type.upper())
    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            or_(
                Camera.name.ilike(search_pattern),
                Camera.id.ilike(search_pattern),
                Camera.codec.ilike(search_pattern)
            )
        )
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{camera_id}", response_model=CameraOut)
async def get_camera_detail(camera_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Camera).options(selectinload(Camera.department)).where(Camera.id == camera_id)
    result = await db.execute(stmt)
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam

@router.post("", response_model=CameraOut, status_code=201)
async def register_camera(payload: CameraCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Camera).where(Camera.id == payload.id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Camera ID already registered")
        
    cam = Camera(**payload.model_dump())
    db.add(cam)
    await db.commit()
    await db.refresh(cam)
    return cam

@router.put("/{camera_id}", response_model=CameraOut)
async def update_camera(
    camera_id: str, 
    payload: CameraUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cam, key, value)

    await db.commit()
    await db.refresh(cam)
    return cam

@router.post("/sync/sentinel")
async def trigger_sentinel_sync(
    gateway_url: Optional[str] = Query(None, description="Optional override for Sentinel Gateway URL"),
    db: AsyncSession = Depends(get_db)
):
    """
    Discovers all cameras dynamically from GET http://<host>/api/ingest
    """
    try:
        res = await sync_cameras_from_sentinel(db, gateway_url)
        return res
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/{camera_id}/health")
async def get_camera_health(camera_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    logs_result = await db.execute(
        select(CameraHealthLog)
        .where(CameraHealthLog.camera_id == camera_id)
        .order_by(desc(CameraHealthLog.timestamp))
        .limit(10)
    )
    logs = logs_result.scalars().all()

    return {
        "camera_id": cam.id,
        "status": cam.status,
        "connectivity": cam.connectivity,
        "codec": cam.codec,
        "resolution": cam.resolution,
        "declared_fps": cam.declared_fps,
        "last_seen": cam.last_seen,
        "recent_health_logs": [
            {
                "timestamp": log.timestamp,
                "status": log.status,
                "latency_ms": log.latency_ms,
                "actual_pts_fps": log.actual_pts_fps,
                "error_message": log.error_message
            } for log in logs
        ]
    }
