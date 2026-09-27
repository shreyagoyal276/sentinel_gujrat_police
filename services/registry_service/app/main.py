import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from services.common.database import init_db, AsyncSessionLocal
from services.common.models import Department
from services.registry_service.app.api.cameras import router as cameras_router
from services.registry_service.app.api.departments import router as departments_router
from services.registry_service.app.api.gis import router as gis_router
from services.registry_service.app.services.sentinel_sync import sync_cameras_from_sentinel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sentinel.registry")

DEFAULT_DEPARTMENTS = [
    {
        "id": "dept_ahm_traffic",
        "name": "Ahmedabad City Police - Traffic Branch",
        "code": "GJ-AHM-TRF",
        "contact_person": "JCP Traffic Ahmedabad",
        "contact_phone": "+91-79-25630100"
    },
    {
        "id": "dept_ahm_crime",
        "name": "Ahmedabad Crime Branch - Detection of Crime Branch (DCB)",
        "code": "GJ-AHM-CRIME",
        "contact_person": "DCP Crime Ahmedabad",
        "contact_phone": "+91-79-25630200"
    },
    {
        "id": "dept_gnr_hq",
        "name": "Gujarat Police State Command & Control Center (Netram)",
        "code": "GJ-GNR-HQ",
        "contact_person": "DIG Police Telecom & Netram",
        "contact_phone": "+91-79-23250000"
    },
    {
        "id": "dept_sur_traffic",
        "name": "Surat City Police - Traffic Branch",
        "code": "GJ-SUR-TRF",
        "contact_person": "DCP Traffic Surat",
        "contact_phone": "+91-261-2400100"
    },
    {
        "id": "dept_vad_traffic",
        "name": "Vadodara City Police - Traffic Branch",
        "code": "GJ-VAD-TRF",
        "contact_person": "ACP Traffic Vadodara",
        "contact_phone": "+91-265-2415100"
    },
    {
        "id": "dept_raj_traffic",
        "name": "Rajkot City Police - Traffic & ANPR Control",
        "code": "GJ-RAJ-TRF",
        "contact_person": "DCP Rajkot Police",
        "contact_phone": "+91-281-2457100"
    }
]

async def seed_departments():
    async with AsyncSessionLocal() as session:
        for dept_data in DEFAULT_DEPARTMENTS:
            res = await session.execute(select(Department).where(Department.code == dept_data["code"]))
            if not res.scalar_one_or_none():
                dept = Department(**dept_data)
                session.add(dept)
        await session.commit()
    logger.info("Default Gujarat Police departments verified/seeded.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sentinel Camera Registry & GIS Service...")
    await init_db()
    await seed_departments()
    yield
    logger.info("Shutting down Sentinel Camera Registry Service...")

app = FastAPI(
    title="Gujarat Police Sentinel — Camera Registry & GIS Service",
    description="Model-1 CCTV Registry & PostGIS Layer with dynamic Sentinel catalogue ingestion and gap analysis",
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

app.include_router(cameras_router, prefix="/api")
app.include_router(departments_router, prefix="/api")
app.include_router(gis_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "service": "Gujarat Police Sentinel — Camera Registry & GIS Service",
        "status": "healthy",
        "model": "Model-1 CCTV Registry Layer"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.registry_service.app.main:app", host="0.0.0.0", port=8001, reload=True)
