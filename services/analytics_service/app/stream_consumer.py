import asyncio
import logging
import time
import cv2
import numpy as np
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from services.common.config import settings
from services.common.database import AsyncSessionLocal
from services.common.models import Detection, Camera
from services.analytics_service.app.detector import plate_detector
from services.analytics_service.app.tracker import tracker_manager
from services.analytics_service.app.watchlist_matcher import watchlist_matcher

logger = logging.getLogger("sentinel.analytics.consumer")

class StreamConsumerService:
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.stream_name = settings.REDIS_STREAM_FRAMES
        self.group_name = "analytics_group"
        self.consumer_name = "worker_1"
        self.is_running = False
        self.redis_client: aioredis.Redis | None = None
        
        # Sane inference throttling per camera by PTS interval
        self.last_inferred_pts: dict[str, float] = {}
        self.camera_cache: dict[str, dict] = {}

    async def start(self):
        self.is_running = True
        try:
            self.redis_client = aioredis.from_url(self.redis_url, decode_responses=False)
            await self.redis_client.ping()
            # Create consumer group if not exists
            try:
                await self.redis_client.xgroup_create(
                    self.stream_name, self.group_name, id="$", mkstream=True
                )
            except Exception:
                pass # Already exists
            logger.info("StreamConsumer connected to Redis Stream.")
        except Exception as e:
            logger.warning(f"StreamConsumer Redis connection failed: {e}. Running standalone.")

        asyncio.create_task(self._consume_loop())

    async def stop(self):
        self.is_running = False
        if self.redis_client:
            await self.redis_client.close()

    async def _get_camera_info(self, camera_id: str, db: AsyncSession) -> dict:
        if camera_id in self.camera_cache:
            return self.camera_cache[camera_id]
        res = await db.execute(select(Camera).where(Camera.id == camera_id))
        cam = res.scalar_one_or_none()
        if cam:
            data = {"id": cam.id, "name": cam.name, "latitude": cam.latitude, "longitude": cam.longitude}
            self.camera_cache[camera_id] = data
            return data
        return {"id": camera_id, "name": camera_id, "latitude": 23.0, "longitude": 72.5}

    async def _consume_loop(self):
        while self.is_running:
            if not self.redis_client:
                await asyncio.sleep(1.0)
                continue

            try:
                # Read from Redis stream
                entries = await self.redis_client.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams={self.stream_name: ">"},
                    count=5,
                    block=1000
                )

                if not entries:
                    await asyncio.sleep(0.05)
                    continue

                for stream_key, messages in entries:
                    for msg_id, payload in messages:
                        try:
                            camera_id = payload[b"camera_id"].decode()
                            pts_msec = float(payload[b"pts_msec"].decode())
                            pts_delta_ms = float(payload.get(b"pts_delta_ms", b"40.0").decode())
                            is_scene_cut = payload.get(b"is_scene_cut", b"0") == b"1"
                            frame_bytes = payload[b"frame_bytes"]

                            # Process frame
                            await self.process_frame(
                                camera_id=camera_id,
                                frame_bytes=frame_bytes,
                                pts_msec=pts_msec,
                                pts_delta_ms=pts_delta_ms,
                                is_scene_cut=is_scene_cut
                            )

                            # Acknowledge message
                            await self.redis_client.xack(self.stream_name, self.group_name, msg_id)
                        except Exception as m_err:
                            logger.error(f"Error processing stream message: {m_err}")

            except Exception as e:
                logger.error(f"Error in Redis consume loop: {e}")
                await asyncio.sleep(1.0)

    async def process_frame(
        self,
        camera_id: str,
        frame_bytes: bytes,
        pts_msec: float,
        pts_delta_ms: float,
        is_scene_cut: bool
    ):
        """
        Processes single frame:
        1. Checks PTS interval throttle (do not sample every frame, sample by PTS delta)
        2. Handles scene cuts (resets per-camera track state)
        3. Runs detection + OCR
        4. Matches against watchlist
        5. Persists detection and alert records
        """
        # MANDATORY REQUIREMENT:
        # "throttled to a sane inference FPS per camera (do not assume the declared stream FPS — sample by PTS interval)"
        last_pts = self.last_inferred_pts.get(camera_id, -99999.0)
        pts_diff = pts_msec - last_pts

        if not is_scene_cut and pts_diff < settings.ANALYTICS_SAMPLE_INTERVAL_PTS_MS:
            # Skip heavy inference to maintain high pipeline throughput
            return

        self.last_inferred_pts[camera_id] = pts_msec

        # Decode JPEG bytes to numpy image
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            return

        # Step 1: Detect vehicles and plates
        raw_detections = plate_detector.detect_and_read(frame)
        if not raw_detections:
            return

        # Step 2: In-frame tracking with PTS delta and scene cut handling
        tracker = tracker_manager.get_tracker(camera_id)
        tracked_detections = tracker.update_tracks(
            detections=raw_detections,
            pts_msec=pts_msec,
            pts_delta_ms=pts_delta_ms,
            is_scene_cut=is_scene_cut
        )

        # Step 3: Persist detections and match against watchlist
        async with AsyncSessionLocal() as db:
            cam_info = await self._get_camera_info(camera_id, db)
            
            for det in tracked_detections:
                plate = det["plate_text"]
                detection_record = Detection(
                    camera_id=camera_id,
                    plate_text=plate,
                    raw_plate_text=det.get("raw_plate_text", plate),
                    confidence=det.get("confidence", 0.8),
                    vehicle_type=det.get("vehicle_type", "car"),
                    pts_timestamp=pts_msec,
                    bbox=det.get("bbox", {}),
                    speed_estimate_kmh=det.get("speed_estimate_kmh")
                )
                db.add(detection_record)
                await db.commit()
                await db.refresh(detection_record)

                # Check watchlist correlation in near real time
                await watchlist_matcher.check_and_alert(
                    db=db,
                    camera_id=camera_id,
                    detection_id=detection_record.id,
                    plate_text=plate,
                    pts_timestamp=pts_msec,
                    camera_info=cam_info
                )

stream_consumer = StreamConsumerService()
