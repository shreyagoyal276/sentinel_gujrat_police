import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from services.ingestion_service.app.manager import manager

router = APIRouter(prefix="/relay", tags=["Video Relay"])

async def stream_live_feed(camera_id: str):
    worker = manager.get_worker(camera_id)
    if not worker or not worker.is_running:
        # Start worker on-demand if not already running
        started = await manager.start_camera(camera_id)
        if not started:
            raise HTTPException(status_code=404, detail="Camera not found in catalogue")
        worker = manager.get_worker(camera_id)

    while worker and worker.is_running:
        if worker.latest_jpeg_bytes:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"X-PTS-Msec: " + str(worker.latest_pts_msec).encode() + b"\r\n\r\n" +
                worker.latest_jpeg_bytes + b"\r\n"
            )
        await asyncio.sleep(0.04) # ~25 FPS delivery to UI

@router.get("/{camera_id}/live")
async def live_video_feed(camera_id: str):
    """
    Live video relay for web frontend video wall tiles.
    Consumes live frames in memory without persisting video footage.
    """
    return StreamingResponse(
        stream_live_feed(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/{camera_id}/snapshot")
async def snapshot_feed(camera_id: str):
    worker = manager.get_worker(camera_id)
    if not worker or not worker.latest_jpeg_bytes:
        raise HTTPException(status_code=503, detail="Camera feed not currently available")
    return StreamingResponse(
        iter([worker.latest_jpeg_bytes]),
        media_type="image/jpeg",
        headers={"X-PTS-Msec": str(worker.latest_pts_msec)}
    )
