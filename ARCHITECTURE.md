# Sentinel — Architecture Document

**Gujarat Police Innovation Hackathon 2026 — Sentinel Challenge**
Hybrid Architecture: Model 1 (Centralised CCTV Registry & GIS Foundation) + Model 2 (Unified Viewing & Selective Analytics)

---

## 1. Architecture Principles

- **Open, modular, vendor-neutral** — no component assumes a specific camera vendor, VMS platform, or proprietary protocol. Integration happens through documented APIs, ONVIF/RTSP standards, and adapter/connector modules.
- **No vendor lock-in** — cameras, VMS, analytics engines, storage, and AI modules can each be replaced or upgraded independently.
- **Non-disruptive to existing infrastructure** — departmental VMS and storage systems continue operating exactly as they do today. Sentinel connects to live streams; it does not replace, migrate, or take control of departmental systems.
- **Live-first, storage-minimal** — the platform processes live video and persists only derived metadata (detections, tracks, alerts), not raw footage, in line with the direct-connect Model 2 approach.
- **Design-for-scale from day one** — the pilot (~50 cameras) uses the same component boundaries and interfaces required at statewide scale (~80,000 cameras); scaling is horizontal, not a redesign.

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Departmental CCTV / VMS Systems                  │
│   (Home Dept, Food & Civil Supplies, RTO, Municipal, etc. — unchanged)│
└───────────────────────────┬───────────────────────────────────────────┘
                             │ RTSP / ONVIF / vendor SDK / WHEP / HLS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Ingestion & Stream Gateway Service                │
│  • Per-camera worker (connect, decode, extract PTS)                  │
│  • Forces RTSP/TCP transport                                         │
│  • Reconnect with exponential backoff (2s → 30s cap)                 │
│  • Tolerates mixed H.264/H.265, mixed resolution/bitrate             │
│  • Non-fatal handling of decoder warnings, scene-cut recovery        │
│  • Publishes frame + PTS + camera_id to queue; no raw video storage  │
│  • Relays low-latency preview via WebRTC (WHEP) / HLS to frontend    │
└──────────┬───────────────────────────────────────┬────────────────────┘
           │                                        │
           ▼                                        ▼
┌───────────────────────────┐      ┌──────────────────────────────────┐
│   Redis Streams (queue)    │      │     Camera Registry Service       │
│  frame refs · PTS · cam_id │      │  PostgreSQL + PostGIS             │
└──────────┬──────────────────┘      │  • Camera metadata (location,    │
           │                          │    dept, type, status, streams)  │
           ▼                          │  • Bulk / manual / API onboarding│
┌───────────────────────────┐        │  • Gap-analysis engine           │
│   AI Analytics Service     │        │  • REST API + GIS map data       │
│  • YOLOv8 vehicle/plate    │        └──────────────┬─────────────────┘
│    detection                │                        │
│  • OCR (ANPR)               │                        │
│  • Multi-camera tracking    │                        │
│  • Watchlist correlation    │                        │
└──────────┬──────────────────┘                        │
           │ detection + match events                  │
           ▼                                            │
┌───────────────────────────┐                          │
│      Alert Service         │                          │
│  • Prioritises matches      │                          │
│  • Broadcasts via WebSocket │                          │
└──────────┬──────────────────┘                          │
           │                                              │
           ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Command Dashboard (React)                        │
│   GIS Map · Live Video Wall · Alert Feed · Vehicle Route Search ·     │
│   Camera Registry — single unified interface                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Camera Registry Service (Model 1 foundation)
- Stores camera metadata: id, department, GPS location, camera type (fixed/PTZ), ownership, connectivity status, stream URLs, health status.
- Onboarding via bulk CSV/API import, manual entry, or auto-discovery from a department's `/api/ingest`-style catalogue endpoint.
- Serves the GIS dashboard: department/status/coverage layers, gap-analysis (uncovered zones, ageing infrastructure), search and filter.
- Acts as the single source of truth for "which cameras exist and where" that all other services (ingestion, analytics, dashboard) read from — camera lists and stream URLs are never hardcoded downstream.

### 2.2 Ingestion & Stream Gateway Service (Model 2 direct-connect layer)
- One worker per actively-monitored camera; workers are started/stopped based on what the platform is currently processing (no persistent connections to idle cameras).
- Protocol handling is the pass/fail-critical component:
  - RTSP transport is always forced to TCP.
  - Frame timing is derived exclusively from presentation timestamps (PTS) — never from reported stream FPS or wall-clock frame-arrival time, since both are unreliable across heterogeneous camera sources.
  - On connect/reconnect, buffered GOP replay can deliver the first 1–2 seconds faster than real time; downstream tracking logic uses PTS deltas so this never produces false velocity spikes.
  - Reconnects use exponential backoff (starting ~2s, capped ~30s) rather than tight-loop retries.
  - Decoder warnings at stream join (expected before the first keyframe/IDR) are logged, not treated as fatal.
  - Scene-cut / stream-loop discontinuities are detected via large PTS jumps; per-camera tracking and background-model state resets cleanly rather than assuming continuous footage.
  - Per-camera decode parameters (codec, resolution, bitrate) are read from the registry rather than assumed uniform.
- Publishes decoded frames (or frame references) plus PTS and camera_id onto Redis Streams for the analytics service — raw video is never persisted.
- Relays a live preview feed to the dashboard via WebRTC (WHEP) for low-latency viewing, or HLS where WebRTC isn't viable on the client network.

### 2.3 AI Analytics Service
- Consumes frames from the queue at a sampling rate driven by measured PTS intervals per camera (not the camera's declared FPS).
- Vehicle and license-plate detection (YOLOv8), plate OCR (PaddleOCR/EasyOCR).
- Multi-object tracking (ByteTrack/DeepSORT) for in-frame continuity; cross-camera route assembly by chaining plate detections across cameras ordered by PTS-derived timestamp.
- Watchlist correlation: every plate detection is checked in near real time against the watchlist table; a match is emitted as an event to the Alert Service.

### 2.4 Alert Service
- Consumes match events, applies priority rules (e.g., wanted-person vehicle > general BOLO), and pushes alerts to the dashboard over WebSocket for immediate display.
- Maintains alert status (new / acknowledged / triaged) for command-center workflow.

### 2.5 Command Dashboard
- GIS Command Map (registry + live coverage), Live Video Wall (configurable 1×1/2×2/3×3), Alert Center (real-time feed + triage), Vehicle Route Tracking (plate search → timestamped route on map), Watchlist/BOLO management, Camera Registry browser.

---

## 3. Data Flow Summary

1. Camera metadata is onboarded into the Registry Service (bulk/manual/API) and surfaced on the GIS map.
2. The Ingestion Service reads active cameras from the Registry, opens RTSP/TCP connections, and streams decoded frames + PTS into Redis Streams — with no raw video written to disk.
3. The Analytics Service consumes frames, runs detection/OCR/tracking, and writes detection records (camera_id, plate, PTS timestamp, geo-location from the Registry, bbox) to PostgreSQL.
4. Each detection is checked against the Watchlist table; matches generate an Alert event.
5. The Alert Service pushes alerts to the dashboard via WebSocket in real time.
6. An investigator can search a plate number; the system queries all matching detections across cameras, orders them by PTS-derived timestamp, and renders the route on the GIS map.

---

## 4. Data Model

```
cameras
  id, department, location (PostGIS geometry), camera_type, ownership,
  connectivity_status, stream_urls (jsonb: rtsp/whep/hls), codec,
  resolution, last_health_check

detections
  id, camera_id (fk), plate_text, confidence, pts_timestamp,
  detected_at, bbox (jsonb)

watchlist
  id, plate_text, category (stolen/wanted/missing-linked/blacklisted),
  reason, priority, added_at

alerts
  id, detection_id (fk), watchlist_id (fk), camera_id, timestamp,
  priority, status (new/acknowledged/resolved)
```

---

## 5. Security Architecture

- **Authentication & Authorization**: department-wise role-based access control (RBAC); registry and dashboard access scoped by department and role (e.g., district operator vs. state command).
- **Secure feed exchange**: all stream and API connections over TLS where the source system supports it; credentials for departmental VMS/API access stored in a secrets manager, never in application code.
- **Network segmentation**: ingestion service isolated in its own network segment with outbound-only access to camera sources; analytics and dashboard segments do not have direct camera network access.
- **Audit trails**: all registry changes, watchlist edits, and alert triage actions are logged with user, timestamp, and action for accountability.
- **No raw video exfiltration surface**: since raw video is never persisted centrally, the attack surface for bulk footage exposure is eliminated — only derived metadata (detections, alerts) is stored.
- **Least-privilege service accounts** between microservices, with the message queue and database not directly reachable from the public-facing dashboard.

---

## 6. Deployment Architecture (Pilot)

- Docker Compose orchestrates all services for the ~50-camera pilot/demo: registry-service, ingestion-service, analytics-service, alert-service, frontend, PostgreSQL+PostGIS, Redis.
- Single-command startup (`docker compose up`) for evaluation and on-site PoC.
- Environment-driven configuration (`.env`) for gateway host, database credentials, and service ports — no hardcoded endpoints.

---

## 7. Scalability Strategy — Path to ~80,000 Cameras (Model 2 → Model 4 Roadmap)

The pilot architecture is intentionally built so scaling is additive, not a redesign:

| Concern | Pilot (~50 cameras) | Statewide (~80,000 cameras) |
|---|---|---|
| Ingestion | Single ingestion-service container, one worker per camera | Horizontally scaled ingestion pods, regionally distributed; edge-compute nodes near camera clusters in low-bandwidth districts to pre-process/transcode before backhaul |
| Queue | Single-node Redis Streams | Kafka cluster (partitioned by region/department) for durability and horizontal consumer scaling |
| Analytics | Single analytics-service container | GPU-pooled inference cluster (Kubernetes + GPU node pools), autoscaled by queue depth; model batching sized per-camera resolution/codec |
| Storage | PostgreSQL+PostGIS single instance | Tiered hot/warm/cold: hot (recent detections/alerts) in PostgreSQL/TimescaleDB, warm in object storage (S3-compatible/Ceph), cold archival per department retention policy |
| Federation | Direct-connect only (Model 2) | Optional middleware/federation layer (Model 3 elements) introduced for departments needing cross-VMS event correlation without direct integration, while direct-connect remains for departments that support it |
| Central oversight | N/A | Elements of Model 4 (central command layer) added on top without displacing departmental VMS ownership — central layer aggregates metadata/alerts, not raw video |
| Watchlist sources | Representative demo dataset | Integrated with VAHAN, SARTHI, eGujCop (CCTNS), AFIS, NAFIS via secure API integration for automated, authoritative watchlist correlation |
| Orchestration | Docker Compose | Kubernetes with regional clusters, health checks, load balancing, centralized logging/monitoring |
| Network | Local/sandbox connectivity | High-bandwidth state backbone with regional edge support; bandwidth-optimization (adaptive bitrate, edge pre-filtering) for low-connectivity districts |
| Resilience | Manual restart | Multi-region disaster recovery, automated failover, redundant queue/storage replication |

This roadmap lets departments onboard incrementally — a new department's cameras enter through the same registry onboarding and adapter pattern used in the pilot, with no changes required to already-onboarded departments.

---

## 8. Cost-Benefit Summary

- **Avoids duplicate infrastructure spend**: no requirement to replace departmental VMS/storage, unlike a full Model 4 rebuild.
- **Storage cost minimized**: since raw video is not centrally persisted, central storage costs scale with metadata volume (small) rather than video volume (large).
- **Incremental capital outlay**: GPU/compute scales with the number of cameras actively analyzed, allowing phased rollout and budget allocation department-by-department rather than a single large upfront investment.
- **Operational benefit**: reduced manual footage review time, faster vehicle tracing, and proactive (alert-driven) rather than reactive monitoring — improving policing outcomes without a state-owned video storage mandate.
