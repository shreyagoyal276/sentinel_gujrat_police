import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from services.common.database import init_db
from services.alert_service.app.websocket_manager import ws_manager
from services.alert_service.app.api.alerts import router as alerts_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sentinel.alerts")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Sentinel Alert & Command Service...")
    await init_db()
    asyncio.create_task(ws_manager.start_redis_listener())
    yield
    logger.info("Shutting down Sentinel Alert Service...")
    await ws_manager.stop()

app = FastAPI(
    title="Gujarat Police Sentinel — Alert & Command Service",
    description="Real-time WebSocket alerts feed, triage workflow, and incident dispatching",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts_router, prefix="/api")

@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open, handle client heartbeats or acknowledgments
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

@app.get("/")
async def root():
    return {
        "service": "Gujarat Police Sentinel Alert Service",
        "websocket_endpoint": "/ws/alerts",
        "active_clients": len(ws_manager.active_connections),
        "status": "ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.alert_service.app.main:app", host="0.0.0.0", port=8004, reload=True)
