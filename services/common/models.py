import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey, BigInteger
)
from sqlalchemy.orm import relationship
from services.common.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Department(Base):
    __tablename__ = "departments"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False)
    code = Column(String(32), unique=True, nullable=False)
    contact_person = Column(String(128), nullable=True)
    contact_phone = Column(String(32), nullable=True)
    jurisdiction_polygon = Column(JSON, nullable=True) # GeoJSON polygon boundary

    cameras = relationship("Camera", back_populates="department")

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String(64), primary_key=True) # ID from /api/ingest
    dept_id = Column(String(64), ForeignKey("departments.id"), nullable=True)
    name = Column(String(128), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    camera_type = Column(String(32), default="ANPR") # ANPR, PTZ, FIXED, BULLET
    status = Column(String(32), default="ONLINE") # ONLINE, OFFLINE, DEGRADED
    connectivity = Column(String(32), default="EXCELLENT") # EXCELLENT, FAIR, POOR, INTERMITTENT
    codec = Column(String(16), default="h264") # h264, h265
    resolution = Column(String(32), default="1920x1080")
    bitrate = Column(Integer, default=4096)
    declared_fps = Column(Float, default=25.0)
    rtsp_url = Column(String(256), nullable=False)
    whep_url = Column(String(256), nullable=True)
    hls_url = Column(String(256), nullable=True)
    last_seen = Column(DateTime(timezone=True), default=utc_now)
    coverage_radius_meters = Column(Float, default=150.0)
    metadata_json = Column(JSON, default=dict)

    department = relationship("Department", back_populates="cameras")
    detections = relationship("Detection", back_populates="camera")
    alerts = relationship("Alert", back_populates="camera")
    health_logs = relationship("CameraHealthLog", back_populates="camera")

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    plate_text = Column(String(32), index=True, nullable=False) # Normalized (e.g. GJ01AB1234)
    reason = Column(Text, nullable=False)
    category = Column(String(64), default="STOLEN") # STOLEN, WANTED_SUSPECT, HIT_AND_RUN, E_CHALLAN_DEFAULT, HIGH_SECURITY_ALERT
    priority = Column(String(32), default="HIGH") # CRITICAL, HIGH, MEDIUM, LOW
    owner_name = Column(String(128), nullable=True)
    vehicle_make_model = Column(String(128), nullable=True)
    color = Column(String(32), nullable=True)
    fir_number = Column(String(64), nullable=True)
    police_station = Column(String(128), nullable=True)
    added_at = Column(DateTime(timezone=True), default=utc_now)
    is_active = Column(Boolean, default=True)

    alerts = relationship("Alert", back_populates="watchlist_item")

class Detection(Base):
    __tablename__ = "detections"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    camera_id = Column(String(64), ForeignKey("cameras.id"), index=True, nullable=False)
    plate_text = Column(String(32), index=True, nullable=False)
    raw_plate_text = Column(String(32), nullable=True)
    confidence = Column(Float, default=0.0)
    vehicle_type = Column(String(32), default="car") # car, truck, bus, motorcycle, auto_rickshaw
    pts_timestamp = Column(Float, nullable=False) # Derived strictly from stream PTS (ms)
    detected_at = Column(DateTime(timezone=True), default=utc_now)
    bbox = Column(JSON, default=dict) # {"x1": ..., "y1": ..., "x2": ..., "y2": ...}
    speed_estimate_kmh = Column(Float, nullable=True) # Speed estimated via PTS delta between detections

    camera = relationship("Camera", back_populates="detections")
    alerts = relationship("Alert", back_populates="detection")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    detection_id = Column(String(64), ForeignKey("detections.id"), nullable=False)
    watchlist_id = Column(String(64), ForeignKey("watchlist.id"), nullable=False)
    camera_id = Column(String(64), ForeignKey("cameras.id"), nullable=False)
    plate_text = Column(String(32), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    pts_timestamp = Column(Float, nullable=False)
    priority = Column(String(32), default="HIGH") # CRITICAL, HIGH, MEDIUM
    category = Column(String(64), default="STOLEN")
    status = Column(String(32), default="NEW") # NEW, ACKNOWLEDGED, DISPATCHED, RESOLVED, FALSE_POSITIVE
    acknowledged_by = Column(String(64), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    detection = relationship("Detection", back_populates="alerts")
    watchlist_item = relationship("Watchlist", back_populates="alerts")
    camera = relationship("Camera", back_populates="alerts")

class CameraHealthLog(Base):
    __tablename__ = "camera_health_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    camera_id = Column(String(64), ForeignKey("cameras.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    status = Column(String(32), nullable=False)
    latency_ms = Column(Float, default=0.0)
    actual_pts_fps = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)

    camera = relationship("Camera", back_populates="health_logs")
