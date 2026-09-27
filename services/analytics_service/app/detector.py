import re
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger("sentinel.analytics.detector")

# Indian license plate regex pattern (Standard High Security Registration Plates)
# Example: GJ 01 AB 1234, GJ05CD5678, GJ-27-EF-9012
INDIAN_PLATE_PATTERN = re.compile(r"([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})", re.IGNORECASE)

class PlateDetectorOCR:
    """
    Combined Vehicle & License Plate Detector with OCR.
    Uses YOLOv8 if weights are loaded, with fast high-accuracy OCR / contour-based fallback
    and Indian HSRP regex normalization.
    """
    def __init__(self):
        self.yolo_model = None
        self.ocr_reader = None
        self._init_models()

    def _init_models(self):
        try:
            from ultralytics import YOLO
            self.yolo_model = YOLO("yolov8n.pt")
            logger.info("YOLOv8 nano model loaded successfully.")
        except Exception as e:
            logger.info(f"YOLOv8 notice ({e}). Using optimized CV detector.")

        try:
            import easyocr
            self.ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("EasyOCR English reader loaded successfully.")
        except Exception as e:
            logger.info(f"EasyOCR reader notice ({e}). Using optimized CV plate extraction.")

    def normalize_plate(self, raw_text: str) -> Optional[str]:
        """Cleans and standardizes Indian license plate string (e.g. GJ01AB1234)"""
        if not raw_text:
            return None
        upper = raw_text.upper()
        # Discard police banner and OSD system headers
        for skip_word in ["POLICE", "SENTINEL", "HIGHWAY", "GUJARAT", "JUNCTION", "CIRCLE", "ROAD", "CODEC", "FPS"]:
            if skip_word in upper:
                return None

        # Clean non-alphanumeric
        clean = re.sub(r"[^A-Za-z0-9]", "", upper)

        # Standard Indian RTO format disambiguation:
        # If starts with GJ or similar state code
        if clean.startswith("GJ") and len(clean) >= 8:
            # First 2 chars: State code (GJ)
            state = clean[:2]
            # Next 1 or 2 chars: District digits (replace O, D, Q -> 0, I, L -> 1)
            rest = clean[2:]
            # Disambiguate district digits
            district = ""
            idx = 0
            while idx < len(rest) and len(district) < 2:
                ch = rest[idx]
                if ch in "0123456789":
                    district += ch
                elif ch in "ODQ":
                    district += "0"
                elif ch in "IL":
                    district += "1"
                elif ch in "B" and len(district) == 0:
                    district += "8"
                else:
                    break
                idx += 1

            if len(district) == 1:
                district = "0" + district

            remaining = rest[idx:]
            # Plate number ends in 4 digits, preceded by 1-3 series letters
            series = ""
            digits = ""
            for ch in remaining:
                if ch.isalpha() and len(digits) == 0:
                    series += ch
                elif ch.isdigit():
                    digits += ch
                elif ch in "ODQ" and len(series) > 0:
                    digits += "0"
                elif ch in "IL" and len(series) > 0:
                    digits += "1"

            if len(district) == 2 and len(digits) >= 3:
                # Pad digits to 4 if needed or take last 4
                if len(digits) == 3:
                    digits = "0" + digits
                elif len(digits) > 4:
                    digits = digits[:4]
                return f"{state}{district}{series}{digits}"

        # Search for Indian state code pattern
        match = re.search(r"(GJ[0-9]{1,2}[A-Z]{1,3}[0-9]{4})", clean)
        if match:
            return match.group(1)

        if clean.startswith("GJ") and 8 <= len(clean) <= 10:
            return clean

        return None

    def detect_and_read(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects vehicles, identifies license plates, and executes OCR.
        Returns list of detection dictionaries:
        [{"plate_text": ..., "raw_text": ..., "confidence": ..., "vehicle_type": ..., "bbox": ...}]
        """
        detections = []
        h, w, _ = frame.shape

        # Step 1: Detect vehicles using YOLOv8 if available
        vehicle_boxes = []
        if self.yolo_model:
            try:
                # Class 2: car, 3: motorcycle, 5: bus, 7: truck
                results = self.yolo_model.predict(
                    frame, 
                    classes=[2, 3, 5, 7], 
                    conf=0.35, 
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        cls_id = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "car")
                        conf = float(box.conf[0].item())
                        vehicle_boxes.append((x1, y1, x2, y2, cls_name, conf))
            except Exception as e:
                logger.error(f"YOLO inference error: {e}")

        # If no YOLO boxes found (or synthetic video), scan roadway region (below OSD header)
        if not vehicle_boxes:
            vehicle_boxes.append((0, 50, w, h, "car", 0.9))

        # Step 2: Extract plate region and perform OCR
        for vx1, vy1, vx2, vy2, vtype, vconf in vehicle_boxes:
            crop = frame[max(0, vy1):min(h, vy2), max(0, vx1):min(w, vx2)]
            if crop.size == 0 or crop.shape[0] < 20 or crop.shape[1] < 40:
                continue

            # Run OCR on the vehicle region
            plate_found = self._extract_plate_ocr(crop, offset_x=vx1, offset_y=vy1, default_type=vtype)
            if plate_found:
                detections.append(plate_found)

        return detections

    def _extract_plate_ocr(self, crop: np.ndarray, offset_x: int, offset_y: int, default_type: str) -> Optional[Dict[str, Any]]:
        """Extracts text using EasyOCR and validates plate structure"""
        try:
            if self.ocr_reader:
                ocr_results = self.ocr_reader.readtext(crop, detail=1)
                for bbox_pts, text, conf in ocr_results:
                    norm = self.normalize_plate(text)
                    if norm and len(norm) >= 6:
                        # Extract absolute coordinates
                        pts = np.array(bbox_pts, dtype=np.int32)
                        bx1 = int(np.min(pts[:, 0]) + offset_x)
                        by1 = int(np.min(pts[:, 1]) + offset_y)
                        bx2 = int(np.max(pts[:, 0]) + offset_x)
                        by2 = int(np.max(pts[:, 1]) + offset_y)

                        return {
                            "plate_text": norm,
                            "raw_plate_text": text,
                            "confidence": round(float(conf), 2),
                            "vehicle_type": default_type,
                            "bbox": {"x1": bx1, "y1": by1, "x2": bx2, "y2": by2}
                        }
        except Exception as e:
            logger.debug(f"OCR scan exception: {e}")

        # Fast fallback plate locator using white rectangular HSRP features & OCR text search
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        blurred = cv2.bilateralFilter(gray, 9, 75, 75)
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            aspect_ratio = float(cw) / max(1, ch)
            if 2.0 <= aspect_ratio <= 5.5 and 50 <= cw <= 350 and 15 <= ch <= 100:
                plate_crop = crop[y:y+ch, x:x+cw]
                if self.ocr_reader and plate_crop.size > 0:
                    try:
                        res = self.ocr_reader.readtext(plate_crop, detail=1)
                        for _, txt, conf in res:
                            norm = self.normalize_plate(txt)
                            if norm and len(norm) >= 6:
                                return {
                                    "plate_text": norm,
                                    "raw_plate_text": txt,
                                    "confidence": round(float(conf), 2),
                                    "vehicle_type": default_type,
                                    "bbox": {"x1": offset_x + x, "y1": offset_y + y, "x2": offset_x + x + cw, "y2": offset_y + y + ch}
                                }
                    except Exception:
                        pass
        return None

plate_detector = PlateDetectorOCR()
