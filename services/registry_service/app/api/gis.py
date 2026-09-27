from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from services.common.database import get_db
from services.common.models import Camera
from services.registry_service.app.services.gap_analysis import compute_gap_analysis

router = APIRouter(prefix="/gis", tags=["GIS & Gap Analysis"])

@router.get("/gap-analysis")
async def get_gap_analysis(db: AsyncSession = Depends(get_db)):
    """
    Returns surveillance coverage gap analysis for Gujarat corridors
    """
    return await compute_gap_analysis(db)

@router.get("/geojson")
async def get_cameras_geojson(db: AsyncSession = Depends(get_db)):
    """
    Returns standard GeoJSON FeatureCollection of all cameras with coverage radii and status
    """
    result = await db.execute(select(Camera))
    cameras = result.scalars().all()
    
    features = []
    for cam in cameras:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [cam.longitude, cam.latitude]
            },
            "properties": {
                "id": cam.id,
                "name": cam.name,
                "camera_type": cam.camera_type,
                "status": cam.status,
                "connectivity": cam.connectivity,
                "codec": cam.codec,
                "resolution": cam.resolution,
                "declared_fps": cam.declared_fps,
                "coverage_radius_meters": cam.coverage_radius_meters,
                "rtsp_url": cam.rtsp_url,
                "whep_url": cam.whep_url,
                "hls_url": cam.hls_url,
                "dept_id": cam.dept_id
            }
        })
        
    return {
        "type": "FeatureCollection",
        "features": features
    }
