import math
import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, asc
from sqlalchemy.orm import selectinload
from services.common.models import Detection, Camera

logger = logging.getLogger("sentinel.analytics.route")

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def reconstruct_vehicle_route(plate_text: str, db: AsyncSession) -> Dict[str, Any]:
    """
    Given a queried plate number, returns every detection across all cameras
    ordered chronologically, reconstructing a timestamped, location-wise route.
    """
    clean_plate = plate_text.replace(" ", "").replace("-", "").upper()
    
    stmt = (
        select(Detection)
        .options(selectinload(Detection.camera))
        .where(Detection.plate_text == clean_plate)
        .order_by(asc(Detection.detected_at))
    )
    res = await db.execute(stmt)
    detections = res.scalars().all()

    if not detections:
        return {
            "plate_text": clean_plate,
            "total_sightings": 0,
            "route_hops": [],
            "path_coordinates": [],
            "summary": "No sightings recorded for this vehicle plate."
        }

    route_hops = []
    path_coords = []
    total_distance_km = 0.0

    prev_det = None
    for idx, det in enumerate(detections):
        cam = det.camera
        if not cam:
            continue

        hop_info = {
            "stop_number": idx + 1,
            "detection_id": det.id,
            "camera_id": cam.id,
            "camera_name": cam.name,
            "camera_type": cam.camera_type,
            "latitude": cam.latitude,
            "longitude": cam.longitude,
            "detected_at": det.detected_at.isoformat() if det.detected_at else None,
            "pts_timestamp": det.pts_timestamp,
            "confidence": det.confidence,
            "vehicle_type": det.vehicle_type,
            "speed_estimate_kmh": det.speed_estimate_kmh,
            "distance_from_prev_km": 0.0,
            "time_elapsed_sec": 0.0,
            "inter_camera_speed_kmh": 0.0
        }

        path_coords.append([cam.latitude, cam.longitude])

        if prev_det and prev_det.camera:
            prev_cam = prev_det.camera
            dist = haversine_distance_km(
                prev_cam.latitude, prev_cam.longitude,
                cam.latitude, cam.longitude
            )
            # Time delta between sightings
            time_delta_sec = 0.0
            if det.detected_at and prev_det.detected_at:
                time_delta_sec = max(1.0, (det.detected_at - prev_det.detected_at).total_seconds())
            
            hop_speed = (dist / (time_delta_sec / 3600.0)) if time_delta_sec > 0 else 0.0
            
            hop_info["distance_from_prev_km"] = round(dist, 2)
            hop_info["time_elapsed_sec"] = round(time_delta_sec, 1)
            hop_info["inter_camera_speed_kmh"] = round(hop_speed, 1)
            total_distance_km += dist

        route_hops.append(hop_info)
        prev_det = det

    first_seen = route_hops[0]["detected_at"]
    last_seen = route_hops[-1]["detected_at"]

    return {
        "plate_text": clean_plate,
        "total_sightings": len(route_hops),
        "total_distance_traveled_km": round(total_distance_km, 2),
        "first_seen": first_seen,
        "last_seen": last_seen,
        "route_hops": route_hops,
        "path_coordinates": path_coords,
        "summary": f"Vehicle tracked across {len(route_hops)} surveillance junctions over {round(total_distance_km, 2)} km."
    }
