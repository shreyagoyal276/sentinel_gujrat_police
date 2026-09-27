import urllib.request
import json

services = [
    (8555, "Sentinel Mock Gateway"),
    (8001, "Camera Registry & GIS"),
    (8002, "Ingestion & Stream Gateway"),
    (8003, "AI Analytics & Tracking"),
    (8004, "Alert & Command Service"),
]

print("=" * 65)
print("  GUJARAT POLICE SENTINEL — SERVICE HEALTH CHECK")
print("=" * 65)

all_ok = True
for port, name in services:
    try:
        url = "http://localhost:{}/".format(port)
        with urllib.request.urlopen(url, timeout=3) as r:
            data = json.loads(r.read().decode())
            status = data.get("status", "OK")
            print("[OK]   {} (port {}): {}".format(name, port, status))
    except Exception as e:
        print("[FAIL] {} (port {}): {}".format(name, port, e))
        all_ok = False

print("-" * 65)
# Check catalogue endpoint
try:
    url = "http://localhost:8555/api/ingest"
    with urllib.request.urlopen(url, timeout=3) as r:
        cams = json.loads(r.read().decode())
        print("[OK]   Sentinel catalogue /api/ingest: {} cameras discovered".format(len(cams)))
        for cam in cams:
            print("       -> {} | {} | status={}".format(cam["id"], cam.get("codec","?"), cam.get("status","?")))
except Exception as e:
    print("[FAIL] /api/ingest: {}".format(e))
    all_ok = False

print("-" * 65)
# Check ingestion status
try:
    url = "http://localhost:8002/api/ingest/status"
    with urllib.request.urlopen(url, timeout=3) as r:
        data = json.loads(r.read().decode())
        print("[OK]   Ingestion status: {}/{} workers active".format(
            data.get("active_workers", 0), data.get("total_discovered", 0)))
except Exception as e:
    print("[FAIL] Ingestion status: {}".format(e))

print("=" * 65)
print("  Platform URL: http://localhost:5173")
print("=" * 65)
