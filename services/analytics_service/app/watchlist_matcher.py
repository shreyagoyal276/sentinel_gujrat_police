import logging
import json
import time
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis
from services.common.models import Watchlist, Alert, Detection, Camera
from services.common.config import settings

logger = logging.getLogger("sentinel.analytics.watchlist")

def levenshtein_dist(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_dist(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

class WatchlistMatcher:
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.redis_client: aioredis.Redis | None = None
        self.alert_channel = settings.REDIS_CHANNEL_ALERTS
        # Cooldown cache: (camera_id, plate_text) -> last_alert_time
        self.recent_alerts_cooldown: Dict[tuple[str, str], float] = {}
        self.cooldown_seconds = 30.0 # Don't fire duplicate alert for same camera/plate within 30s

    async def connect(self):
        try:
            self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("WatchlistMatcher connected to Redis.")
        except Exception as e:
            logger.warning(f"WatchlistMatcher Redis connection failed ({e}). Alerts will only write to DB.")

    async def check_and_alert(
        self,
        db: AsyncSession,
        camera_id: str,
        detection_id: str,
        plate_text: str,
        pts_timestamp: float,
        camera_info: Optional[dict] = None
    ) -> Optional[Alert]:
        """
        Continuously matches new detection against watchlist in near real time.
        On match, emits alert event (camera, plate, location, timestamp, reason, priority).
        """
        clean_plate = plate_text.replace(" ", "").replace("-", "").upper()
        
        # Check cooldown to prevent alert flooding
        cooldown_key = (camera_id, clean_plate)
        now = time.time()
        if cooldown_key in self.recent_alerts_cooldown:
            if (now - self.recent_alerts_cooldown[cooldown_key]) < self.cooldown_seconds:
                return None # Cooldown active

        # Query all active watchlist items
        res = await db.execute(
            select(Watchlist).where(Watchlist.is_active == True)
        )
        watchlist_items = res.scalars().all()
        matched_item = None

        # 1. Exact match
        for item in watchlist_items:
            if item.plate_text == clean_plate:
                matched_item = item
                break

        # 2. Fuzzy match (Levenshtein distance <= 3 or 70%+ similarity for OCR noise tolerance)
        if not matched_item:
            for item in watchlist_items:
                # Require state code match (e.g. GJ)
                if item.plate_text[:2] == clean_plate[:2]:
                    dist = levenshtein_dist(item.plate_text, clean_plate)
                    if dist <= 3:
                        matched_item = item
                        break

        if not matched_item:
            return None

        watchlist_item = matched_item

        # Watchlist match found! Create Alert
        self.recent_alerts_cooldown[cooldown_key] = now
        
        alert = Alert(
            detection_id=detection_id,
            watchlist_id=watchlist_item.id,
            camera_id=camera_id,
            plate_text=clean_plate,
            pts_timestamp=pts_timestamp,
            priority=watchlist_item.priority,
            category=watchlist_item.category,
            status="NEW"
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)

        logger.warning(
            f"🚨 [WATCHLIST HIT] Plate: {clean_plate} at {camera_id} | Reason: {watchlist_item.reason} | Priority: {watchlist_item.priority}"
        )

        # Publish alert payload onto Redis Pub/Sub for live WebSocket broadcasting
        if self.redis_client:
            alert_payload = {
                "alert_id": alert.id,
                "camera_id": camera_id,
                "camera_name": camera_info.get("name", camera_id) if camera_info else camera_id,
                "latitude": camera_info.get("latitude") if camera_info else None,
                "longitude": camera_info.get("longitude") if camera_info else None,
                "plate_text": clean_plate,
                "pts_timestamp": pts_timestamp,
                "timestamp": alert.timestamp.isoformat() if alert.timestamp else None,
                "priority": alert.priority,
                "category": alert.category,
                "reason": watchlist_item.reason,
                "owner_name": watchlist_item.owner_name,
                "vehicle_make_model": watchlist_item.vehicle_make_model,
                "color": watchlist_item.color,
                "fir_number": watchlist_item.fir_number,
                "police_station": watchlist_item.police_station,
                "status": alert.status
            }
            try:
                await self.redis_client.publish(self.alert_channel, json.dumps(alert_payload))
            except Exception as e:
                logger.error(f"Failed to publish alert to Redis: {e}")

        return alert

watchlist_matcher = WatchlistMatcher()
