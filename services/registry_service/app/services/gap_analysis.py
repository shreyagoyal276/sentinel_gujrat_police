import math
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from services.common.models import Camera

# Strategic Gujarat Police surveillance corridors to monitor for gaps
CRITICAL_CORRIDORS = [
    {
        "name": "Ahmedabad SG Highway Corridor",
        "start": {"lat": 23.0012, "lng": 72.5020},
        "end": {"lat": 23.1150, "lng": 72.5380},
        "target_density_cameras_per_km": 3.0,
        "length_km": 13.5
    },
    {
        "name": "Gandhinagar Koba Circle to CH-0 Corridor",
        "start": {"lat": 23.1600, "lng": 72.6100},
        "end": {"lat": 23.2300, "lng": 72.6500},
        "target_density_cameras_per_km": 2.5,
        "length_km": 9.2
    },
    {
        "name": "Surat Ring Road Majura-Udhna Corridor",
        "start": {"lat": 21.1700, "lng": 72.8100},
        "end": {"lat": 21.2100, "lng": 72.8600},
        "target_density_cameras_per_km": 3.0,
        "length_km": 8.0
    },
    {
        "name": "Rajkot 150ft Ring Road",
        "start": {"lat": 22.2700, "lng": 70.7600},
        "end": {"lat": 22.3100, "lng": 70.7900},
        "target_density_cameras_per_km": 2.0,
        "length_km": 6.5
    }
]

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def compute_gap_analysis(db: AsyncSession) -> Dict[str, Any]:
    result = await db.execute(select(Camera))
    cameras = list(result.scalars().all())
    
    corridor_analysis = []
    hotspots_needing_coverage = []
    
    for corridor in CRITICAL_CORRIDORS:
        c_lat1, c_lon1 = corridor["start"]["lat"], corridor["start"]["lng"]
        c_lat2, c_lon2 = corridor["end"]["lat"], corridor["end"]["lng"]
        c_mid_lat = (c_lat1 + c_lat2) / 2
        c_mid_lon = (c_lon1 + c_lon2) / 2
        
        # Count cameras along corridor (within 1.5 km of mid point / axis)
        covered_count = 0
        for cam in cameras:
            d = haversine_distance_km(cam.latitude, cam.longitude, c_mid_lat, c_mid_lon)
            if d <= (corridor["length_km"] / 2 + 1.0):
                covered_count += 1
                
        actual_density = covered_count / max(1.0, corridor["length_km"])
        target_density = corridor["target_density_cameras_per_km"]
        coverage_pct = min(100.0, round((actual_density / target_density) * 100, 1))
        
        is_gap = coverage_pct < 60.0
        
        status_label = "SATISFACTORY" if coverage_pct >= 75 else ("MODERATE_GAP" if coverage_pct >= 40 else "CRITICAL_BLIND_SPOT")
        
        analysis_item = {
            "corridor_name": corridor["name"],
            "length_km": corridor["length_km"],
            "active_cameras": covered_count,
            "target_cameras_needed": int(math.ceil(corridor["length_km"] * target_density)),
            "coverage_percentage": coverage_pct,
            "status": status_label,
            "midpoint": {"lat": c_mid_lat, "lng": c_mid_lon}
        }
        corridor_analysis.append(analysis_item)
        
        if is_gap:
            # Blind spot needing new CCTV deployment
            hotspots_needing_coverage.append({
                "corridor": corridor["name"],
                "zone_name": f"{corridor['name']} - Sector Blind Spot",
                "recommended_lat": round(c_mid_lat + 0.005, 4),
                "recommended_lng": round(c_mid_lon + 0.005, 4),
                "deficiency_level": "HIGH" if coverage_pct < 40 else "MEDIUM",
                "cameras_recommended": max(1, int(corridor["length_km"] * target_density) - covered_count),
                "priority_rationale": "High-speed transit escape route without consecutive ANPR cameras"
            })
            
    total_coverage_pct = round(
        sum(c["coverage_percentage"] for c in corridor_analysis) / max(1, len(corridor_analysis)), 1
    )

    return {
        "total_cameras_registered": len(cameras),
        "total_corridors_monitored": len(CRITICAL_CORRIDORS),
        "overall_surveillance_coverage_pct": total_coverage_pct,
        "corridor_analysis": corridor_analysis,
        "uncovered_zones_count": len(hotspots_needing_coverage),
        "hotspots_needing_coverage": hotspots_needing_coverage
    }
