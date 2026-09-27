# Sentinel — Gujarat Police CCTV Integration & Intelligence Platform

**Gujarat Police Innovation Hackathon 2026 — Sentinel Challenge**
Hybrid Model 1 (Centralised CCTV Registry & GIS Foundation) + Model 2 (Unified Viewing & Selective Analytics)

A unified, vendor-neutral platform for onboarding heterogeneous departmental CCTV systems, running real-time AI video analytics, and generating automated watchlist alerts — without requiring departments to replace existing infrastructure.

---

## Overview

Gujarat's 26 government departments operate independent CCTV systems across different vendors, VMS platforms, storage architectures, and retention policies. Sentinel integrates these into a single command-center platform by:

- Maintaining a **centralised camera registry** (Model 1) with GIS-based coverage mapping and gap analysis
- **Directly connecting** to live camera streams (Model 2) — RTSP / ONVIF / WHEP / HLS — with no intermediate video storage layer
- Running **real-time AI analytics** (ANPR, vehicle detection, multi-camera tracking) on live feeds
- **Cross-referencing** detections against a watchlist database in near real time and generating automated alerts
- Providing a single **command dashboard**: GIS map, live video wall, alert feed, vehicle route search, and camera registry

Departments retain full control of their existing VMS and storage infrastructure — Sentinel is a read-only, direct-connect analytics and visibility layer on top of it.

---

## Architecture

```
Departmental CCTV / VMS Systems (unchanged, independently operated)
        │  RTSP / ONVIF / WHEP / HLS
        ▼
Ingestion & Stream Gateway  ──► Redis Streams (frame + PTS + camera_id)
        │                              │
        ▼                              ▼
Camera Registry (PostgreSQL+PostGIS)   AI Analytics Service
        │                              │  YOLO detection + OCR (ANPR)
        ▼                              │  Multi-camera vehicle tracking
GIS Dashboard & Registry API           │  Watchlist correlation
        │                              ▼
        └──────────► Alert Service ──► WebSocket ──► Command Dashboard
                                                        (Map · Video Wall ·
                                                         Alerts · Vehicle Search)
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full component breakdown, data flow, security model, and the Model 2 → Model 4 scale-up plan toward ~80,000 cameras statewide.

---

## Key Features

- Centralised camera registry — bulk import, manual entry, and API-based onboarding
- Interactive GIS map with department, status, and coverage-radius layers, plus automated gap analysis
- Direct live-stream ingestion, protocol-correct by design:
  - RTSP forced over **TCP** (never UDP)
  - All timing derived from **stream PTS**, never wall-clock arrival time or reported FPS
  - Automatic **reconnect with exponential backoff** on stream drop
  - Tolerant of mixed **H.264 / H.265** codecs and mixed resolutions/bitrates
  - Non-fatal handling of decoder warnings at stream join
  - Per-camera state recovers cleanly across **scene-cut / stream-loop** discontinuities
- Real-time ANPR: license plate detection + OCR on live video
- Multi-camera vehicle tracking with timestamped, geo-located route reconstruction
- Continuous watchlist correlation (stolen/wanted vehicles) with automated, prioritised alerts
- Configurable live video wall (1×1 / 2×2 / 3×3)
- Vehicle search by plate number → full route plotted on the GIS map
- Role-based access control, department-wise permissions
- Modular adapter architecture — new vendors/departments onboard without redesign

---

## Tech Stack

| Layer | Technology |
|---|---|
| Registry & GIS | FastAPI, PostgreSQL + PostGIS, React + Leaflet |
| Ingestion Gateway | Python, OpenCV / GStreamer / FFmpeg, RTSP/TCP |
| Stream Queue | Redis Streams |
| AI Analytics | YOLOv8 (vehicle/plate detection), PaddleOCR / EasyOCR (ANPR), ByteTrack/DeepSORT (tracking) |
| Alerts | FastAPI, WebSocket |
| Frontend | React, Leaflet, WebRTC (WHEP) / HLS video player |
| Deployment | Docker Compose |

---

## Repository Structure

```
sentinel_gujrat_police/
├── services/
│   ├── registry-service/      # Camera registry & GIS API (FastAPI + PostGIS)
│   ├── ingestion-service/      # RTSP/TCP stream workers, PTS handling, reconnect logic
│   ├── analytics-service/      # ANPR, detection, tracking, watchlist correlation
│   └── alert-service/          # Real-time alert generation & WebSocket broadcast
├── frontend/                   # React dashboard (GIS map, video wall, alerts, search)
├── scripts/
│   ├── seed_watchlist.py       # Loads representative watchlist demo data
│   └── demo_pipeline.py        # Pulls /api/ingest, connects N cameras, runs detection + matching
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md
└── README.md
```

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Access credentials / base URL for a Sentinel sandbox camera gateway (`/api/ingest`)

### Setup

```bash
git clone https://github.com/shreyagoyal276/sentinel_gujrat_police.git
cd sentinel_gujrat_police
cp .env.example .env
```

Edit `.env` and set the sandbox gateway host:

```env
SENTINEL_GATEWAY_HOST=<sandbox-host>
SENTINEL_GATEWAY_PORT=8554
POSTGRES_PASSWORD=<set-a-password>
```

Launch all services:

```bash
docker compose up --build
```

Services will be available at:
- Dashboard: `http://localhost:3000`
- Registry API: `http://localhost:8000`
- Analytics API: `http://localhost:8001`

### Seed demo data

```bash
python scripts/seed_watchlist.py
```

### Run the ingestion + detection demo

```bash
python scripts/demo_pipeline.py --cameras 5
```

Pulls the live camera catalogue from `/api/ingest`, connects to the specified number of cameras over RTSP/TCP, runs vehicle/plate detection, and logs any watchlist matches to the console and dashboard.

---

## Streaming Protocol Compliance

The ingestion service is built strictly against the sandbox's streaming contract:

- ✅ RTSP transport forced to TCP on every client
- ✅ No timing logic depends on reported FPS or frame arrival time — all derived from PTS
- ✅ Inter-frame gaps tolerated without disconnect handling
- ✅ Reconnect with exponential backoff (2s → 30s cap), tested against forced stream restarts
- ✅ Decoder warnings at join logged, never treated as fatal
- ✅ Camera list and per-camera properties always read from `/api/ingest` — no hardcoded URLs/IDs
- ✅ Mixed H.264/H.265 and mixed resolutions handled per-camera
- ✅ Per-camera tracking/background state resets cleanly on detected scene-cut discontinuities
- ✅ No raw video persisted; live-only processing
- ✅ Only actively-processed cameras are opened; gateway is never published to

---

## Scalability

Designed to scale from the ~50-camera pilot toward Gujarat's statewide target of ~80,000 cameras via:
- Horizontal scaling of ingestion workers and Redis/Kafka-based decoupling
- Edge-inference nodes for bandwidth-constrained regions
- Tiered hot/warm/cold storage strategy for metadata and detection records (no raw video storage required)
- GPU pool sizing guidance and adapter-based onboarding for new departments/vendors
- Future integration points for VAHAN, SARTHI, eGujCop, AFIS, and NAFIS as additional watchlist sources

Full detail in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## License

This project was built for the Gujarat Police Innovation Hackathon 2026 evaluation and demonstration purposes.
