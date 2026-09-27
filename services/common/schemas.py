from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class DepartmentBase(BaseModel):
    name: str
    code: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    jurisdiction_polygon: Optional[Dict[str, Any]] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: str

    class Config:
        from_attributes = True

class CameraBase(BaseModel):
    name: str
    latitude: float
    longitude: float
    dept_id: Optional[str] = None
    camera_type: str = "ANPR"
    status: str = "ONLINE"
    connectivity: str = "EXCELLENT"
    codec: str = "h264"
    resolution: str = "1920x1080"
    bitrate: int = 4096
    declared_fps: float = 25.0
    rtsp_url: str
    whep_url: Optional[str] = None
    hls_url: Optional[str] = None
    coverage_radius_meters: float = 150.0
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)

class CameraCreate(CameraBase):
    id: str

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    dept_id: Optional[str] = None
    camera_type: Optional[str] = None
    status: Optional[str] = None
    connectivity: Optional[str] = None
    coverage_radius_meters: Optional[float] = None
    metadata_json: Optional[Dict[str, Any]] = None

class CameraOut(CameraBase):
    id: str
    last_seen: Optional[datetime] = None
    department: Optional[DepartmentOut] = None

    class Config:
        from_attributes = True

class WatchlistBase(BaseModel):
    plate_text: str
    reason: str
    category: str = "STOLEN"
    priority: str = "HIGH"
    owner_name: Optional[str] = None
    vehicle_make_model: Optional[str] = None
    color: Optional[str] = None
    fir_number: Optional[str] = None
    police_station: Optional[str] = None
    is_active: bool = True

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistOut(WatchlistBase):
    id: str
    added_at: datetime

    class Config:
        from_attributes = True

class DetectionOut(BaseModel):
    id: str
    camera_id: str
    plate_text: str
    raw_plate_text: Optional[str] = None
    confidence: float
    vehicle_type: str
    pts_timestamp: float
    detected_at: datetime
    bbox: Dict[str, Any]
    speed_estimate_kmh: Optional[float] = None
    camera: Optional[CameraOut] = None

    class Config:
        from_attributes = True

class AlertOut(BaseModel):
    id: str
    detection_id: str
    watchlist_id: str
    camera_id: str
    plate_text: str
    timestamp: datetime
    pts_timestamp: float
    priority: str
    category: str
    status: str
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    notes: Optional[str] = None
    camera: Optional[CameraOut] = None
    watchlist_item: Optional[WatchlistOut] = None

    class Config:
        from_attributes = True

class AlertTriageRequest(BaseModel):
    status: str # ACKNOWLEDGED, DISPATCHED, RESOLVED, FALSE_POSITIVE
    acknowledged_by: str
    notes: Optional[str] = None

class GapAnalysisResponse(BaseModel):
    total_cameras: int
    uncovered_zones_count: int
    coverage_percentage_estimated: float
    hotspots_needing_coverage: List[Dict[str, Any]]
    cameras: List[CameraOut]

class SentinelCatalogueCamera(BaseModel):
    id: str
    name: Optional[str] = None
    location: Dict[str, float] # {"lat": 23.03, "lng": 72.58}
    codec: str = "h264"
    status: str = "live"
    stream_properties: Dict[str, Any] = Field(default_factory=dict)
    rtsp_url: str
    whep_url: Optional[str] = None
    hls_url: Optional[str] = None
