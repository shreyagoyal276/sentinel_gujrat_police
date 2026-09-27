import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from services.common.database import init_db, AsyncSessionLocal
from services.common.models import Watchlist, Detection, Camera, Department, Alert

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sentinel.seed")

# Representative Gujarat Police Watchlist Dataset (BOLO / Wanted Vehicles)
GUJARAT_WATCHLIST_DATA = [
    {
        "plate_text": "GJ01AB1234",
        "reason": "Vehicle reported stolen in FIR 142/2026 at Vastrapur PS. White Hyundai Creta.",
        "category": "STOLEN",
        "priority": "CRITICAL",
        "owner_name": "Rameshchandra Patel",
        "vehicle_make_model": "Hyundai Creta SX (O)",
        "color": "Polar White",
        "fir_number": "142/2026",
        "police_station": "Vastrapur Police Station, Ahmedabad",
        "is_active": True
    },
    {
        "plate_text": "GJ05CD5678",
        "reason": "Fatal hit-and-run incident at Majura Gate, Surat. Escaped towards Ring Road.",
        "category": "HIT_AND_RUN",
        "priority": "CRITICAL",
        "owner_name": "Unknown / Under Investigation",
        "vehicle_make_model": "Toyota Fortuner Legender",
        "color": "Attitude Black",
        "fir_number": "89/2026",
        "police_station": "Khatodara Police Station, Surat",
        "is_active": True
    },
    {
        "plate_text": "GJ27EF9012",
        "reason": "Suspected interstate gold smuggling syndicate vehicle flagged by Gujarat DCB.",
        "category": "WANTED_SUSPECT",
        "priority": "HIGH",
        "owner_name": "Imran Sheikh",
        "vehicle_make_model": "Mahindra Scorpio Classic",
        "color": "Galaxy Grey",
        "fir_number": "310/2025",
        "police_station": "Detection of Crime Branch (DCB), Ahmedabad",
        "is_active": True
    },
    {
        "plate_text": "GJ03GH3456",
        "reason": "Over 18 unpaid red-light violations and speeding e-challans totaling Rs 38,500.",
        "category": "E_CHALLAN_DEFAULT",
        "priority": "MEDIUM",
        "owner_name": "Bhavin Trivedi",
        "vehicle_make_model": "Maruti Suzuki Swift Dzire",
        "color": "Magma Grey",
        "fir_number": "ECH-2026-9921",
        "police_station": "Rajkot City Traffic Branch",
        "is_active": True
    },
    {
        "plate_text": "GJ06JK7890",
        "reason": "Lookout circular issued for commercial tax fraud suspect vehicle.",
        "category": "HIGH_SECURITY_ALERT",
        "priority": "HIGH",
        "owner_name": "Kirit Shah",
        "vehicle_make_model": "Kia Seltos",
        "color": "Imperial Blue",
        "fir_number": "CID-GJ-04/2026",
        "police_station": "Vadodara Central Police Station",
        "is_active": True
    },
    {
        "plate_text": "GJ02MN4567",
        "reason": "High-risk vehicle wanted in connection with Mehsana highway fuel heist.",
        "category": "WANTED_SUSPECT",
        "priority": "CRITICAL",
        "owner_name": "Pravin Rawal",
        "vehicle_make_model": "Tata Harrier Dark Edition",
        "color": "Oberon Black",
        "fir_number": "204/2026",
        "police_station": "Mehsana Taluka Police Station",
        "is_active": True
    }
]

async def seed_cameras_if_empty(session):
    res = await session.execute(select(Camera))
    cams = res.scalars().all()
    if not cams:
        logger.info("Seeding base surveillance cameras...")
        default_cams = [
            Camera(
                id="cam_ahmedabad_sg_01",
                name="Ahmedabad SG Highway - ISKCON Cross Road",
                latitude=23.0287,
                longitude=72.5068,
                camera_type="ANPR",
                status="ONLINE",
                connectivity="EXCELLENT",
                codec="h264",
                resolution="1280x720",
                bitrate=3500,
                declared_fps=25.0,
                rtsp_url="rtsp://localhost:8554/stream/cam_ahmedabad_sg_01",
                whep_url="http://localhost:8555/whep/cam_ahmedabad_sg_01",
                hls_url="http://localhost:8555/hls/cam_ahmedabad_sg_01/index.m3u8",
                coverage_radius_meters=150.0
            ),
            Camera(
                id="cam_ahmedabad_vastrapur_02",
                name="Ahmedabad Vastrapur Lake Junction",
                latitude=23.0373,
                longitude=72.5293,
                camera_type="PTZ",
                status="ONLINE",
                connectivity="EXCELLENT",
                codec="h264",
                resolution="1280x720",
                bitrate=4000,
                declared_fps=30.0,
                rtsp_url="rtsp://localhost:8554/stream/cam_ahmedabad_vastrapur_02",
                whep_url="http://localhost:8555/whep/cam_ahmedabad_vastrapur_02",
                hls_url="http://localhost:8555/hls/cam_ahmedabad_vastrapur_02/index.m3u8",
                coverage_radius_meters=180.0
            ),
            Camera(
                id="cam_gandhinagar_ch0_03",
                name="Gandhinagar CH-0 Highway Entry",
                latitude=23.2156,
                longitude=72.6369,
                camera_type="ANPR",
                status="ONLINE",
                connectivity="EXCELLENT",
                codec="h265",
                resolution="1920x1080",
                bitrate=5000,
                declared_fps=25.0,
                rtsp_url="rtsp://localhost:8554/stream/cam_gandhinagar_ch0_03",
                whep_url="http://localhost:8555/whep/cam_gandhinagar_ch0_03",
                hls_url="http://localhost:8555/hls/cam_gandhinagar_ch0_03/index.m3u8",
                coverage_radius_meters=200.0
            ),
            Camera(
                id="cam_surat_ring_road_04",
                name="Surat Ring Road - Majura Gate",
                latitude=21.1822,
                longitude=72.8205,
                camera_type="ANPR",
                status="ONLINE",
                connectivity="EXCELLENT",
                codec="h265",
                resolution="1280x720",
                bitrate=3000,
                declared_fps=25.0,
                rtsp_url="rtsp://localhost:8554/stream/cam_surat_ring_road_04",
                whep_url="http://localhost:8555/whep/cam_surat_ring_road_04",
                hls_url="http://localhost:8555/hls/cam_surat_ring_road_04/index.m3u8",
                coverage_radius_meters=150.0
            ),
            Camera(
                id="cam_vadodara_sayaji_05",
                name="Vadodara Sayaji Baug Circle",
                latitude=22.3107,
                longitude=73.1812,
                camera_type="FIXED",
                status="ONLINE",
                connectivity="EXCELLENT",
                codec="h264",
                resolution="1280x720",
                bitrate=2800,
                declared_fps=20.0,
                rtsp_url="rtsp://localhost:8554/stream/cam_vadodara_sayaji_05",
                whep_url="http://localhost:8555/whep/cam_vadodara_sayaji_05",
                hls_url="http://localhost:8555/hls/cam_vadodara_sayaji_05/index.m3u8",
                coverage_radius_meters=120.0
            ),
            Camera(
                id="cam_rajkot_kalawad_06",
                name="Rajkot Kalawad Road KKV Hall",
                latitude=22.2858,
                longitude=70.7719,
                camera_type="ANPR",
                status="ONLINE",
                connectivity="EXCELLENT",
                codec="h264",
                resolution="1280x720",
                bitrate=3200,
                declared_fps=25.0,
                rtsp_url="rtsp://localhost:8554/stream/cam_rajkot_kalawad_06",
                whep_url="http://localhost:8555/whep/cam_rajkot_kalawad_06",
                hls_url="http://localhost:8555/hls/cam_rajkot_kalawad_06/index.m3u8",
                coverage_radius_meters=160.0
            )
        ]
        session.add_all(default_cams)
        await session.commit()
        logger.info(f"Seeded {len(default_cams)} baseline cameras.")

async def seed_sample_journey(session):
    """Seeds multi-camera journey detections for GJ01AB1234 to verify route reconstruction"""
    res = await session.execute(select(Detection).where(Detection.plate_text == "GJ01AB1234"))
    if res.scalars().first():
        return

    logger.info("Seeding realistic multi-camera trajectory for plate GJ01AB1234...")
    base_time = datetime.now(timezone.utc) - timedelta(minutes=45)
    
    trajectory = [
        ("cam_ahmedabad_vastrapur_02", 0, 1200.0, 48.5),
        ("cam_ahmedabad_sg_01", 12, 18500.0, 56.2),
        ("cam_gandhinagar_ch0_03", 38, 42100.0, 68.0)
    ]

    for cam_id, min_offset, pts, speed in trajectory:
        det = Detection(
            camera_id=cam_id,
            plate_text="GJ01AB1234",
            raw_plate_text="GJ 01 AB 1234",
            confidence=0.96,
            vehicle_type="car",
            pts_timestamp=pts,
            detected_at=base_time + timedelta(minutes=min_offset),
            bbox={"x1": 320, "y1": 410, "x2": 580, "y2": 590},
            speed_estimate_kmh=speed
        )
        session.add(det)
    await session.commit()
    logger.info("Sample journey seeded across 3 consecutive surveillance points.")

async def main():
    logger.info("--- Starting Gujarat Police Sentinel Watchlist & Database Seed ---")
    await init_db()

    async with AsyncSessionLocal() as session:
        await seed_cameras_if_empty(session)
        
        # Seed Watchlist items
        seeded_count = 0
        for item in GUJARAT_WATCHLIST_DATA:
            res = await session.execute(
                select(Watchlist).where(Watchlist.plate_text == item["plate_text"])
            )
            existing = res.scalar_one_or_none()
            if not existing:
                w = Watchlist(**item)
                session.add(w)
                seeded_count += 1

        await session.commit()
        logger.info(f"Watchlist seeded: {seeded_count} new entries registered.")

        # Seed sample journey
        await seed_sample_journey(session)

    logger.info("--- Seed complete! System is primed for hackathon live evaluation. ---")

if __name__ == "__main__":
    asyncio.run(main())
