import time
import math
import random
import cv2
import numpy as np

# Gujarat representative locations & camera metadata
MOCK_CAMERAS = [
    {
        "id": "cam_ahmedabad_sg_01",
        "name": "Ahmedabad SG Highway - ISKCON Cross Road",
        "location": {"lat": 23.0287, "lng": 72.5068},
        "codec": "h264",
        "status": "live",
        "stream_properties": {"resolution": [1280, 720], "bitrate": 3500, "declared_fps": 25.0},
        "dept_code": "GJ-AHM-TRF",
        "camera_type": "ANPR"
    },
    {
        "id": "cam_ahmedabad_vastrapur_02",
        "name": "Ahmedabad Vastrapur Lake Junction",
        "location": {"lat": 23.0373, "lng": 72.5293},
        "codec": "h264",
        "status": "live",
        "stream_properties": {"resolution": [1280, 720], "bitrate": 4000, "declared_fps": 30.0},
        "dept_code": "GJ-AHM-CRIME",
        "camera_type": "PTZ"
    },
    {
        "id": "cam_gandhinagar_ch0_03",
        "name": "Gandhinagar CH-0 Highway Entry",
        "location": {"lat": 23.2156, "lng": 72.6369},
        "codec": "h265",
        "status": "live",
        "stream_properties": {"resolution": [1920, 1080], "bitrate": 5000, "declared_fps": 25.0},
        "dept_code": "GJ-GNR-HQ",
        "camera_type": "ANPR"
    },
    {
        "id": "cam_surat_ring_road_04",
        "name": "Surat Ring Road - Majura Gate",
        "location": {"lat": 21.1822, "lng": 72.8205},
        "codec": "h265",
        "status": "live",
        "stream_properties": {"resolution": [1280, 720], "bitrate": 3000, "declared_fps": 25.0},
        "dept_code": "GJ-SUR-TRF",
        "camera_type": "ANPR"
    },
    {
        "id": "cam_vadodara_sayaji_05",
        "name": "Vadodara Sayaji Baug Circle",
        "location": {"lat": 22.3107, "lng": 73.1812},
        "codec": "h264",
        "status": "live",
        "stream_properties": {"resolution": [1280, 720], "bitrate": 2800, "declared_fps": 20.0},
        "dept_code": "GJ-VAD-TRF",
        "camera_type": "FIXED"
    },
    {
        "id": "cam_rajkot_kalawad_06",
        "name": "Rajkot Kalawad Road KKV Hall",
        "location": {"lat": 22.2858, "lng": 70.7719},
        "codec": "h264",
        "status": "live",
        "stream_properties": {"resolution": [1280, 720], "bitrate": 3200, "declared_fps": 25.0},
        "dept_code": "GJ-RAJ-TRF",
        "camera_type": "ANPR"
    }
]

# Simulated moving vehicles with known plates (some match the watchlist!)
VEHICLE_PROFILES = [
    {
        "plate": "GJ01AB1234", # Watchlist: Stolen Creta
        "color": (230, 230, 240), # White
        "type": "car",
        "lane": 0,
        "speed": 1.2
    },
    {
        "plate": "GJ05CD5678", # Watchlist: Hit & Run Fortuner
        "color": (40, 40, 40), # Black
        "type": "car",
        "lane": 1,
        "speed": 1.5
    },
    {
        "plate": "GJ27EF9012", # Watchlist: Wanted Gold Smuggling Scorpio
        "color": (150, 160, 170), # Silver
        "type": "truck",
        "lane": 2,
        "speed": 1.1
    },
    {
        "plate": "GJ01XY9999", # Normal vehicle
        "color": (60, 80, 180), # Red
        "type": "car",
        "lane": 0,
        "speed": 1.3
    },
    {
        "plate": "GJ03GH3456", # Watchlist: E-Challan Defaulter
        "color": (160, 120, 50), # Blue
        "type": "car",
        "lane": 1,
        "speed": 1.0
    }
]

class SyntheticStreamGenerator:
    """
    Generates synthetic CCTV video frames matching Sentinel sandbox specifications:
    - Accurate PTS calculation
    - Loop cut simulation at loop point (PTS hard resets to simulate camera reboot/scene cut)
    - Realistic road view with moving cars and Indian high security registration plates
    """
    def __init__(self, camera_id: str, width: int = 1280, height: int = 720, fps: float = 25.0):
        self.camera_id = camera_id
        self.width = width
        self.height = height
        self.fps = fps
        self.frame_duration_ms = 1000.0 / fps
        self.frame_idx = 0
        self.loop_frame_count = 600 # Loops every 600 frames (~24s) to test hard scene cuts
        self.cam_info = next((c for c in MOCK_CAMERAS if c["id"] == camera_id), MOCK_CAMERAS[0])

    def get_next_frame(self) -> tuple[np.ndarray, float, bool]:
        """
        Returns (frame, pts_msec, is_scene_cut)
        """
        is_scene_cut = False
        if self.frame_idx >= self.loop_frame_count:
            self.frame_idx = 0
            is_scene_cut = True # Simulate hard loop cut / camera reboot

        pts_msec = self.frame_idx * self.frame_duration_ms
        self.frame_idx += 1

        # Render asphalt roadway
        frame = np.full((self.height, self.width, 3), (45, 48, 52), dtype=np.uint8)

        # Draw road margins and lanes
        road_left = int(self.width * 0.15)
        road_right = int(self.width * 0.85)
        cv2.rectangle(frame, (road_left, 0), (road_right, self.height), (60, 64, 68), -1)

        # Lane dividers
        lane_width = (road_right - road_left) // 3
        dash_offset = int((pts_msec * 0.3) % 80)
        for lane_idx in range(1, 3):
            lx = road_left + lane_idx * lane_width
            for y in range(-dash_offset, self.height, 80):
                cv2.line(frame, (lx, y), (lx, y + 40), (220, 220, 220), 4)

        # Kerbs / pavement
        cv2.rectangle(frame, (road_left - 25, 0), (road_left, self.height), (200, 180, 50), -1)
        cv2.rectangle(frame, (road_right, 0), (road_right + 25, self.height), (200, 180, 50), -1)

        # Render simulated vehicles moving along the lanes
        cycle_time = pts_msec / 1000.0
        for i, veh in enumerate(VEHICLE_PROFILES):
            lane_center = road_left + int((veh["lane"] + 0.5) * lane_width)
            # Vehicle vertical position moves down or up
            y_speed = 180 * veh["speed"]
            veh_y = int((pts_msec * 0.12 * veh["speed"] + i * 250) % (self.height + 400)) - 200

            if -150 <= veh_y <= self.height + 150:
                car_w = int(lane_width * 0.65)
                car_h = int(car_w * 1.7)
                cx1 = lane_center - car_w // 2
                cy1 = veh_y - car_h // 2
                cx2 = cx1 + car_w
                cy2 = cy1 + car_h

                # Vehicle body shadow
                cv2.rectangle(frame, (cx1 - 6, cy1 + 6), (cx2 + 6, cy2 + 10), (25, 25, 25), -1)
                # Vehicle body
                cv2.rectangle(frame, (cx1, cy1), (cx2, cy2), veh["color"], -1)
                # Windshield / roof details
                cv2.rectangle(frame, (cx1 + 10, cy1 + car_h // 4), (cx2 - 10, cy1 + car_h // 2), (20, 25, 30), -1)
                cv2.rectangle(frame, (cx1 + 10, cy2 - car_h // 3), (cx2 - 10, cy2 - car_h // 5), (20, 25, 30), -1)

                # Tail lights / headlights
                cv2.rectangle(frame, (cx1 + 8, cy2 - 10), (cx1 + 25, cy2 - 2), (0, 0, 220), -1)
                cv2.rectangle(frame, (cx2 - 25, cy2 - 10), (cx2 - 8, cy2 - 2), (0, 0, 220), -1)

                # License plate (Indian HSRP: White plate, blue strip on left, black bold text)
                pw = int(car_w * 0.62)
                ph = 32
                px1 = cx1 + (car_w - pw) // 2
                py1 = cy2 - ph - 6
                px2 = px1 + pw
                py2 = py1 + ph

                cv2.rectangle(frame, (px1, py1), (px2, py2), (255, 255, 255), -1)
                cv2.rectangle(frame, (px1, py1), (px2, py2), (0, 0, 0), 2)
                # Blue IND strip
                cv2.rectangle(frame, (px1, py1), (px1 + 14, py2), (180, 80, 0), -1)

                # License plate text
                cv2.putText(
                    frame,
                    veh["plate"],
                    (px1 + 18, py1 + 22),
                    cv2.FONT_HERSHEY_DUPLEX,
                    0.65,
                    (0, 0, 0),
                    2,
                    cv2.LINE_AA
                )

        # Gujarat Police CCTV OSD (On-Screen Display) Header
        cv2.rectangle(frame, (0, 0), (self.width, 45), (15, 18, 22), -1)
        cv2.line(frame, (0, 45), (self.width, 45), (0, 160, 255), 2)

        osd_text = f"GUJARAT POLICE SENTINEL | {self.cam_info['name']} ({self.camera_id})"
        pts_text = f"PTS: {pts_msec:.1f}ms | CODEC: {self.cam_info['codec'].upper()} | TCP"
        
        cv2.putText(frame, osd_text, (20, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 220, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, pts_text, (self.width - 450, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (50, 255, 120), 2, cv2.LINE_AA)

        if is_scene_cut:
            # Render visual indicator of hard loop cut
            cv2.putText(frame, "[SCENE CUT / LOOP REBOOT DETECTED]", (self.width // 2 - 250, self.height // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3, cv2.LINE_AA)

        return frame, pts_msec, is_scene_cut
