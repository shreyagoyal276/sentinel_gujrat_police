import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from services.common.models import Camera, Department
from services.common.config import settings

logger = logging.getLogger("sentinel.registry.sync")

async def sync_cameras_from_sentinel(db: AsyncSession, gateway_url: str = None) -> dict:
    """
    Pass/Fail requirement: Always discover cameras from GET http://<host>/api/ingest
    Never hardcode stream URLs or IDs.
    """
    url = gateway_url or settings.SENTINEL_GATEWAY_URL
    ingest_endpoint = f"{url.rstrip('/')}/api/ingest"
    
    logger.info(f"Connecting to Sentinel catalogue endpoint: {ingest_endpoint}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(ingest_endpoint)
            resp.raise_for_status()
            catalogue = resp.json()
        except Exception as e:
            logger.error(f"Failed to fetch catalogue from {ingest_endpoint}: {e}")
            raise RuntimeError(f"Sentinel catalogue discovery failed: {e}")

    synced_count = 0
    created_count = 0
    updated_count = 0

    for item in catalogue:
        cam_id = item.get("id")
        if not cam_id:
            continue
            
        location = item.get("location", {})
        lat = float(location.get("lat", 23.0))
        lng = float(location.get("lng", 72.5))
        
        stream_props = item.get("stream_properties", {})
        res = stream_props.get("resolution", [1920, 1080])
        res_str = f"{res[0]}x{res[1]}" if isinstance(res, (list, tuple)) else str(res)
        bitrate = int(stream_props.get("bitrate", 4096))
        fps = float(stream_props.get("declared_fps", 25.0))
        
        # Check if camera exists in DB
        result = await db.execute(select(Camera).where(Camera.id == cam_id))
        cam = result.scalar_one_or_none()

        if cam:
            # Update dynamic streaming properties discovered from gateway
            cam.rtsp_url = item.get("rtsp_url", cam.rtsp_url)
            cam.whep_url = item.get("whep_url", cam.whep_url)
            cam.hls_url = item.get("hls_url", cam.hls_url)
            cam.codec = item.get("codec", cam.codec)
            cam.status = item.get("status", "ONLINE").upper()
            cam.resolution = res_str
            cam.bitrate = bitrate
            cam.declared_fps = fps
            cam.metadata_json = {**cam.metadata_json, "gateway_properties": stream_props}
            updated_count += 1
        else:
            # Create new camera discovered from gateway
            cam = Camera(
                id=cam_id,
                name=item.get("name", f"Sentinel CCTV {cam_id}"),
                latitude=lat,
                longitude=lng,
                camera_type="ANPR",
                status=item.get("status", "ONLINE").upper(),
                connectivity="EXCELLENT",
                codec=item.get("codec", "h264"),
                resolution=res_str,
                bitrate=bitrate,
                declared_fps=fps,
                rtsp_url=item.get("rtsp_url"),
                whep_url=item.get("whep_url"),
                hls_url=item.get("hls_url"),
                metadata_json={"gateway_properties": stream_props}
            )
            db.add(cam)
            created_count += 1
        synced_count += 1

    await db.commit()
    logger.info(f"Sync complete: {synced_count} total ({created_count} new, {updated_count} updated)")
    return {
        "status": "success",
        "catalogue_endpoint": ingest_endpoint,
        "total_discovered": len(catalogue),
        "created": created_count,
        "updated": updated_count
    }
