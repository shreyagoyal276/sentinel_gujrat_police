import logging
import asyncio
import json
from typing import List
from fastapi import WebSocket
import redis.asyncio as aioredis
from services.common.config import settings

logger = logging.getLogger("sentinel.alerts.websocket")

class WebSocketAlertManager:
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.alert_channel = settings.REDIS_CHANNEL_ALERTS
        self.active_connections: List[WebSocket] = []
        self.is_running = False
        self.redis_client: aioredis.Redis | None = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast_alert(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def start_redis_listener(self):
        """Listens to Redis Pub/Sub and broadcasts alerts to WebSocket clients"""
        self.is_running = True
        while self.is_running:
            try:
                self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
                pubsub = self.redis_client.pubsub()
                await pubsub.subscribe(self.alert_channel)
                logger.info(f"Subscribed to Redis channel: {self.alert_channel}")

                while self.is_running:
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if msg and msg["type"] == "message":
                        try:
                            payload = json.loads(msg["data"])
                            logger.info(f"Broadcasting alert to {len(self.active_connections)} UI clients: {payload.get('plate_text')}")
                            await self.broadcast_alert(payload)
                        except Exception as p_err:
                            logger.error(f"Error parsing alert payload: {p_err}")
                    await asyncio.sleep(0.01)

            except Exception as e:
                logger.warning(f"Alert Redis listener reconnecting in 3s ({e})...")
                await asyncio.sleep(3.0)

    async def stop(self):
        self.is_running = False
        if self.redis_client:
            await self.redis_client.close()

ws_manager = WebSocketAlertManager()
