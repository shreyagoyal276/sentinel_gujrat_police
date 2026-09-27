import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("sentinel.analytics.tracker")

class VehicleTrack:
    def __init__(self, track_id: int, plate_text: str, bbox: dict, pts_msec: float):
        self.track_id = track_id
        self.plate_text = plate_text
        self.bbox = bbox
        self.first_pts_msec = pts_msec
        self.last_pts_msec = pts_msec
        self.sightings = 1
        self.center_history = [(self._calc_center(bbox), pts_msec)]
        self.estimated_speed_kmh = 0.0

    def _calc_center(self, bbox: dict) -> tuple[float, float]:
        cx = (bbox.get("x1", 0) + bbox.get("x2", 0)) / 2.0
        cy = (bbox.get("y1", 0) + bbox.get("y2", 0)) / 2.0
        return (cx, cy)

    def update(self, bbox: dict, current_pts_msec: float, pts_delta_ms: float):
        """
        MANDATORY REQUIREMENT:
        Calculate velocity strictly using PTS delta, NEVER wall-clock arrival time.
        Handles fast initial GOP bursts without impossible velocity spikes.
        """
        self.bbox = bbox
        self.sightings += 1
        new_center = self._calc_center(bbox)
        
        # Calculate pixel displacement
        prev_center, prev_pts = self.center_history[-1]
        dx = new_center[0] - prev_center[0]
        dy = new_center[1] - prev_center[1]
        dist_pixels = (dx**2 + dy**2)**0.5

        # Strictly use PTS delta (seconds)
        dt_seconds = pts_delta_ms / 1000.0
        if dt_seconds > 0.005: # Avoid divide by near-zero
            # Approximate road calibration (approx 0.05 meters per pixel in perspective ROI)
            meters_moved = dist_pixels * 0.05
            speed_mps = meters_moved / dt_seconds
            speed_kmh = speed_mps * 3.6
            # Smoothing (moving average)
            if self.estimated_speed_kmh == 0.0:
                self.estimated_speed_kmh = speed_kmh
            else:
                self.estimated_speed_kmh = 0.7 * self.estimated_speed_kmh + 0.3 * speed_kmh

        self.last_pts_msec = current_pts_msec
        self.center_history.append((new_center, current_pts_msec))
        if len(self.center_history) > 30:
            self.center_history.pop(0)

class CameraTrackerState:
    """
    Tracks vehicles within a single camera feed.
    Recovers cleanly from hard scene cuts and loop reboots.
    """
    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self.active_tracks: Dict[str, VehicleTrack] = {} # Keyed by plate_text or track_id
        self.next_track_id = 1
        self.last_pts_msec = -1.0

    def reset_state(self, reason: str = "Scene Cut / Loop Reboot"):
        """
        MANDATORY REQUIREMENT:
        Reset per-camera track state on a detected large PTS discontinuity / scene-cut.
        """
        count = len(self.active_tracks)
        self.active_tracks.clear()
        self.next_track_id = 1
        self.last_pts_msec = -1.0
        logger.info(f"[{self.camera_id}] State reset executed ({reason}). Cleared {count} active tracks.")

    def update_tracks(
        self,
        detections: list,
        pts_msec: float,
        pts_delta_ms: float,
        is_scene_cut: bool
    ) -> list:
        # Check if scene cut occurred
        if is_scene_cut:
            self.reset_state(reason="Hard Scene Cut Detected")

        updated_detections = []
        for det in detections:
            plate = det.get("plate_text")
            bbox = det.get("bbox", {})
            if not plate:
                continue

            if plate in self.active_tracks:
                track = self.active_tracks[plate]
                track.update(bbox, pts_msec, pts_delta_ms)
            else:
                track = VehicleTrack(self.next_track_id, plate, bbox, pts_msec)
                self.active_tracks[plate] = track
                self.next_track_id += 1

            det["speed_estimate_kmh"] = round(track.estimated_speed_kmh, 1)
            det["dwell_time_pts_sec"] = round((track.last_pts_msec - track.first_pts_msec) / 1000.0, 1)
            updated_detections.append(det)

        # Expire stale tracks not seen for > 10,000 ms of PTS
        stale_plates = [
            p for p, t in self.active_tracks.items()
            if (pts_msec - t.last_pts_msec) > 10000.0
        ]
        for p in stale_plates:
            del self.active_tracks[p]

        self.last_pts_msec = pts_msec
        return updated_detections

class MultiCameraTrackerManager:
    def __init__(self):
        self.camera_trackers: Dict[str, CameraTrackerState] = {}

    def get_tracker(self, camera_id: str) -> CameraTrackerState:
        if camera_id not in self.camera_trackers:
            self.camera_trackers[camera_id] = CameraTrackerState(camera_id)
        return self.camera_trackers[camera_id]

    def reset_camera(self, camera_id: str):
        if camera_id in self.camera_trackers:
            self.camera_trackers[camera_id].reset_state()

tracker_manager = MultiCameraTrackerManager()
