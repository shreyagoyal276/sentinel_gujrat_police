import asyncio
import time
import cv2
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from services.sentinel_mock.app.synthetic_feeds import MOCK_CAMERAS, SyntheticStreamGenerator

app = FastAPI(
    title="Sentinel Sandbox Gateway Simulator",
    description="Mock Sentinel Gateway providing /api/ingest, RTSP/WHEP/HLS endpoints, PTS timing and loop cuts for hackathon evaluation."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

generators: dict[str, SyntheticStreamGenerator] = {}

def get_generator(camera_id: str) -> SyntheticStreamGenerator:
    if camera_id not in generators:
        cam_info = next((c for c in MOCK_CAMERAS if c["id"] == camera_id), None)
        if not cam_info:
            raise HTTPException(status_code=404, detail="Camera not found")
        res = cam_info["stream_properties"]["resolution"]
        fps = cam_info["stream_properties"]["declared_fps"]
        generators[camera_id] = SyntheticStreamGenerator(
            camera_id=camera_id,
            width=res[0],
            height=res[1],
            fps=fps
        )
    return generators[camera_id]

@app.get("/")
async def root():
    return {
        "service": "Sentinel Sandbox Gateway Simulator",
        "catalogue_endpoint": "/api/ingest",
        "camera_count": len(MOCK_CAMERAS),
        "status": "operational"
    }

@app.get("/api/ingest")
async def get_catalogue(request: Request):
    """
    Catalogue endpoint: GET http://<host>/api/ingest returns all cameras:
    id, location, codec, live status, stream properties, and rtsp/whep/hls URLs.
    Pass/Fail requirement: Ingestion and Registry services MUST discover cameras from this endpoint!
    """
    base_host = request.headers.get("host", "localhost:8555")
    host_only = base_host.split(":")[0]
    
    catalogue = []
    for cam in MOCK_CAMERAS:
        c_id = cam["id"]
        catalogue.append({
            "id": c_id,
            "name": cam["name"],
            "location": cam["location"],
            "codec": cam["codec"], # Mixed h264 and h265
            "status": cam["status"],
            "stream_properties": cam["stream_properties"],
            # Strict RTSP URL (port 8554, forces TCP)
            "rtsp_url": f"rtsp://{host_only}:8554/stream/{c_id}",
            "whep_url": f"http://{base_host}/whep/{c_id}",
            "hls_url": f"http://{base_host}/hls/{c_id}/index.m3u8",
            "mjpeg_url": f"http://{base_host}/stream/{c_id}/mjpeg"
        })
    return catalogue

async def generate_mjpeg_stream(camera_id: str):
    gen = get_generator(camera_id)
    frame_interval = 1.0 / gen.fps
    while True:
        frame, pts_msec, is_cut = gen.get_next_frame()
        # Encode as JPEG
        ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ret:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"X-PTS-Msec: " + str(pts_msec).encode() + b"\r\n\r\n" +
                buffer.tobytes() + b"\r\n"
            )
        await asyncio.sleep(frame_interval)

@app.get("/stream/{camera_id}/mjpeg")
async def stream_mjpeg(camera_id: str):
    """
    Live stream relay endpoint for web browsers and OpenCV test clients.
    """
    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/stream/{camera_id}/frame")
async def get_single_frame(camera_id: str):
    """
    Returns single current frame with PTS header
    """
    gen = get_generator(camera_id)
    frame, pts_msec, is_cut = gen.get_next_frame()
    ret, buffer = cv2.imencode(".jpg", frame)
    return StreamingResponse(
        iter([buffer.tobytes()]),
        media_type="image/jpeg",
        headers={"X-PTS-Msec": str(pts_msec), "X-Scene-Cut": str(is_cut)}
    )

@app.get("/whep/{camera_id}")
async def whep_endpoint(camera_id: str):
    return JSONResponse({
        "camera_id": camera_id,
        "protocol": "WHEP (WebRTC-HTTP Egress Protocol)",
        "status": "ready",
        "fallback_stream": f"/stream/{camera_id}/mjpeg"
    })

@app.get("/hls/{camera_id}/index.m3u8")
async def hls_endpoint(camera_id: str):
    return JSONResponse({
        "camera_id": camera_id,
        "protocol": "HLS Live Playlist",
        "status": "ready",
        "fallback_stream": f"/stream/{camera_id}/mjpeg"
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.sentinel_mock.app.main:app", host="0.0.0.0", port=8555, reload=True)
