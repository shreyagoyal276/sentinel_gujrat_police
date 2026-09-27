import logging
import asyncio
from typing import Dict, List, Optional
import httpx
from services.common.config import settings
from services.ingestion_service.app.stream_worker import CameraStreamWorker
from services.ingestion_service.app.redis_publisher import RedisFramePublisher

logger = logging.getLogger("sentinel.ingestion.manager")

class IngestionManager:
    """
    Coordinates dynamic camera discovery from Sentinel /api/ingest,
    manages worker lifecycles, and publishes frames to Redis Streams.
    """
    def __init__(self, gateway_url: str = None):
        self.gateway_url = gateway_url or settings.SENTINEL_GATEWAY_URL
        self.publisher = RedisFramePublisher()
        self.workers: Dict[str, CameraStreamWorker] = {}
        self.discovered_cameras: Dict[str, dict] = {}

    async def initialize(self):
        await self.publisher.connect()
        await self.refresh_catalogue()

    async def refresh_catalogue(self) -> List[dict]:
        """
        MANDATORY REQUIREMENT:
        Always discover cameras from GET http://<host>/api/ingest — never hardcode URLs or IDs.
        """
        endpoint = f"{self.gateway_url.rstrip('/')}/api/ingest"
        logger.info(f"Querying Sentinel catalogue endpoint: {endpoint}")
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(endpoint)
                resp.raise_for_status()
                catalogue = resp.json()
                
            self.discovered_cameras = {c["id"]: c for c in catalogue}
            logger.info(f"Discovered {len(self.discovered_cameras)} cameras from Sentinel gateway.")
            return list(self.discovered_cameras.values())
        except Exception as e:
            logger.error(f"Failed to query catalogue from {endpoint}: {e}")
            return []

    async def start_camera(self, camera_id: str) -> bool:
        """
        MANDATORY REQUIREMENT:
        Only open cameras actively being processed — never publish/push to gateway.
        """
        if camera_id in self.workers and self.workers[camera_id].is_running:
            logger.info(f"[{camera_id}] Already active.")
            return True

        if camera_id not in self.discovered_cameras:
            await self.refresh_catalogue()

        cam_info = self.discovered_cameras.get(camera_id)
        if not cam_info:
            logger.error(f"Cannot start camera {camera_id}: not found in catalogue.")
            return False

        worker = CameraStreamWorker(
            camera_id=camera_id,
            camera_info=cam_info,
            frame_callback=self._handle_frame
        )
        self.workers[camera_id] = worker
        await worker.start()
        return True

    async def stop_camera(self, camera_id: str):
        if camera_id in self.workers:
            await self.workers[camera_id].stop()
            del self.workers[camera_id]
            logger.info(f"[{camera_id}] Camera stream stopped and worker removed.")

    async def start_all(self):
        """Start workers for all discovered cameras"""
        if not self.discovered_cameras:
            await self.refresh_catalogue()
        for c_id in self.discovered_cameras:
            await self.start_camera(c_id)

    async def stop_all(self):
        for c_id, worker in list(self.workers.items()):
            await worker.stop()
        self.workers.clear()
        await self.publisher.close()

    async def _handle_frame(
        self,
        camera_id: str,
        frame,
        pts_msec: float,
        pts_delta_ms: float,
        is_scene_cut: bool,
        codec: str
    ):
        """Dispatches frame to Redis Stream"""
        await self.publisher.publish_frame(
            camera_id=camera_id,
            frame=frame,
            pts_msec=pts_msec,
            pts_delta_ms=pts_delta_ms,
            is_scene_cut=is_scene_cut,
            codec=codec
        )

    def get_status(self) -> dict:
        """Returns metrics for all managed camera streams"""
        return {
            "gateway_url": self.gateway_url,
            "total_discovered": len(self.discovered_cameras),
            "active_workers": len(self.workers),
            "workers": {
                c_id: worker.metrics for c_id, worker in self.workers.items()
            }
        }

    def get_worker(self, camera_id: str) -> Optional[CameraStreamWorker]:
        return self.workers.get(camera_id)

manager = IngestionManager()
