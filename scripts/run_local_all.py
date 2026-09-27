import sys
import os
import subprocess
import time
import signal

# Working directory
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

SERVICES = [
    {
        "name": "Sentinel Mock Sandbox Gateway",
        "cmd": [sys.executable, "-m", "uvicorn", "services.sentinel_mock.app.main:app", "--port", "8555", "--host", "0.0.0.0"]
    },
    {
        "name": "Camera Registry & GIS Service",
        "cmd": [sys.executable, "-m", "uvicorn", "services.registry_service.app.main:app", "--port", "8001", "--host", "0.0.0.0"]
    },
    {
        "name": "Ingestion & Stream Gateway Service",
        "cmd": [sys.executable, "-m", "uvicorn", "services.ingestion_service.app.main:app", "--port", "8002", "--host", "0.0.0.0"]
    },
    {
        "name": "AI Analytics & Tracking Service",
        "cmd": [sys.executable, "-m", "uvicorn", "services.analytics_service.app.main:app", "--port", "8003", "--host", "0.0.0.0"]
    },
    {
        "name": "Alert & Command Service",
        "cmd": [sys.executable, "-m", "uvicorn", "services.alert_service.app.main:app", "--port", "8004", "--host", "0.0.0.0"]
    }
]

def main():
    print("=" * 70)
    print("  GUJARAT POLICE INNOVATION HACKATHON 2026 — SENTINEL PLATFORM")
    print("  Starting all microservices locally...")
    print("=" * 70)

    # First, run seed script
    print("\n[+] Seeding baseline database and watchlist...")
    seed_proc = subprocess.run([sys.executable, os.path.join(ROOT_DIR, "scripts", "seed_watchlist.py")])
    if seed_proc.returncode != 0:
        print("[!] Seed script encountered a warning, continuing...")

    procs = []
    try:
        for s in SERVICES:
            print(f"[+] Starting {s['name']}...")
            env = os.environ.copy()
            env["PYTHONPATH"] = ROOT_DIR
            p = subprocess.Popen(s["cmd"], cwd=ROOT_DIR, env=env)
            procs.append((s["name"], p))
            time.sleep(1.0)

        print("\n" + "=" * 70)
        print("  ALL SERVICES ARE RUNNING!")
        print("  - Sentinel Sandbox Mock: http://localhost:8555/api/ingest")
        print("  - Registry & GIS:        http://localhost:8001/api/cameras")
        print("  - Ingestion Gateway:     http://localhost:8002/api/ingest/status")
        print("  - AI Analytics:          http://localhost:8003/api/analytics/stats")
        print("  - Alert & WebSocket:     http://localhost:8004/api/alerts (WS: /ws/alerts)")
        print("  Press Ctrl+C to terminate all services.")
        print("=" * 70)

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[!] Shutting down all Sentinel microservices...")
        for name, p in procs:
            print(f"[-] Terminating {name}...")
            p.terminate()
        for name, p in procs:
            p.wait()
        print("[+] All services stopped cleanly.")

if __name__ == "__main__":
    main()
