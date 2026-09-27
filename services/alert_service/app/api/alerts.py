from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from services.common.database import get_db
from services.common.models import Alert, Detection, Watchlist, Camera
from services.common.schemas import AlertOut, AlertTriageRequest
from services.alert_service.app.websocket_manager import ws_manager

router = APIRouter(prefix="/alerts", tags=["Alerts Management"])

@router.get("", response_model=List[AlertOut])
async def list_alerts(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    camera_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Alert)
        .options(
            selectinload(Alert.camera),
            selectinload(Alert.watchlist_item)
        )
        .order_by(desc(Alert.timestamp))
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Alert.status == status.upper())
    if priority:
        stmt = stmt.where(Alert.priority == priority.upper())
    if category:
        stmt = stmt.where(Alert.category == category.upper())
    if camera_id:
        stmt = stmt.where(Alert.camera_id == camera_id)

    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{alert_id}", response_model=AlertOut)
async def get_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Alert)
        .options(
            selectinload(Alert.camera),
            selectinload(Alert.watchlist_item)
        )
        .where(Alert.id == alert_id)
    )
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.post("/{alert_id}/triage", response_model=AlertOut)
async def triage_alert(
    alert_id: str,
    payload: AlertTriageRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Acknowledge, dispatch interceptor unit, or resolve alert
    """
    stmt = (
        select(Alert)
        .options(
            selectinload(Alert.camera),
            selectinload(Alert.watchlist_item)
        )
        .where(Alert.id == alert_id)
    )
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = payload.status.upper()
    alert.acknowledged_by = payload.acknowledged_by
    alert.acknowledged_at = datetime.now(timezone.utc)
    if payload.notes:
        alert.notes = payload.notes

    await db.commit()
    await db.refresh(alert)

    # Broadcast triage update to WebSockets
    await ws_manager.broadcast_alert({
        "event_type": "ALERT_TRIAGED",
        "alert_id": alert.id,
        "status": alert.status,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": alert.acknowledged_at.isoformat()
    })

    return alert

@router.get("/summary/stats")
async def get_alerts_stats(db: AsyncSession = Depends(get_db)):
    # Group by priority
    p_res = await db.execute(
        select(Alert.priority, func.count(Alert.id)).group_by(Alert.priority)
    )
    priority_counts = dict(p_res.all())

    # Group by status
    s_res = await db.execute(
        select(Alert.status, func.count(Alert.id)).group_by(Alert.status)
    )
    status_counts = dict(s_res.all())

    total_alerts = sum(priority_counts.values())

    return {
        "total_alerts": total_alerts,
        "critical_count": priority_counts.get("CRITICAL", 0),
        "high_count": priority_counts.get("HIGH", 0),
        "medium_count": priority_counts.get("MEDIUM", 0),
        "new_count": status_counts.get("NEW", 0),
        "acknowledged_count": status_counts.get("ACKNOWLEDGED", 0),
        "dispatched_count": status_counts.get("DISPATCHED", 0),
        "resolved_count": status_counts.get("RESOLVED", 0)
    }

@router.post("/test-trigger")
async def test_trigger_alert(
    plate_text: str = "GJ01AB1234",
    camera_id: str = "cam_ahmedabad_sg_01",
    reason: str = "Stolen Hyundai Creta (FIR 142/2026)",
    priority: str = "CRITICAL"
):
    """
    Test endpoint for hackathon demo to test WebSocket push to UI
    """
    mock_payload = {
        "alert_id": f"test-{datetime.now().strftime('%H%M%S')}",
        "camera_id": camera_id,
        "camera_name": "Ahmedabad SG Highway - ISKCON Cross Road",
        "latitude": 23.0287,
        "longitude": 72.5068,
        "plate_text": plate_text,
        "pts_timestamp": 12450.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": priority,
        "category": "STOLEN",
        "reason": reason,
        "owner_name": "Ramesh Patel",
        "vehicle_make_model": "Hyundai Creta White",
        "color": "White",
        "fir_number": "142/2026",
        "police_station": "Vastrapur PS, Ahmedabad",
        "status": "NEW"
    }
    await ws_manager.broadcast_alert(mock_payload)
    return {"status": "broadcast_sent", "payload": mock_payload}
