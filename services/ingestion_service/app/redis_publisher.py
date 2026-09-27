import logging
import json
import base64
import cv2
import numpy as np
import redis.asyncio as aioredis
from services.common.config import settings

logger = logging.getLogger("sentinel.ingestion.redis")

class RedisFramePublisher:
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.client: aioredis.Redis | None = None
        self.stream_name = settings.REDIS_STREAM_FRAMES
        self.connected = False

    async def connect(self):
        try:
            self.client = aioredis.from_url(self.redis_url, decode_responses=False)
            await self.client.ping()
            self.connected = True
            logger.info(f"Connected to Redis at {self.redis_url}")
        except Exception as e:
            logger.warning(f"Redis connection failed ({e}). Running in in-memory mode.")
            self.connected = False

    async def publish_frame(
        self,
        camera_id: str,
        frame: np.ndarray,
        pts_msec: float,
        pts_delta_ms: float,
        is_scene_cut: bool,
        codec: str = "h264"
    ):
        """
        Publishes decoded frame + PTS + camera_id onto Redis Streams.
        Raw video is NEVER persisted to disk — streamed directly into memory.
        """
        if not self.connected or not self.client:
            return

        try:
            # Compress to JPEG for in-memory Redis stream transfer
            ret, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ret:
                return

            h, w, _ = frame.shape
            payload = {
                b"camera_id": camera_id.encode(),
                b"pts_msec": str(pts_msec).encode(),
                b"pts_delta_ms": str(pts_delta_ms).encode(),
                b"is_scene_cut": b"1" if is_scene_cut else b"0",
                b"codec": codec.encode(),
                b"width": str(w).encode(),
                b"height": str(h).encode(),
                b"frame_bytes": buf.tobytes()
            }

            # Redis XADD with stream capping (MAXLEN ~500) to strictly prevent memory leaks
            await self.client.xadd(
                self.stream_name,
                payload,
                maxlen=500,
                approximate=True
            )
        except Exception as e:
            logger.error(f"Error publishing frame to Redis Stream: {e}")

    async def close(self):
        if self.client:
            await self.client.close()
