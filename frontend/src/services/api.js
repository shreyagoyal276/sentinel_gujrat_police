const REGISTRY_BASE = "http://localhost:8001/api";
const INGESTION_BASE = "http://localhost:8002/api";
const ANALYTICS_BASE = "http://localhost:8003/api";
const ALERT_BASE = "http://localhost:8004/api";
const MOCK_BASE = "http://localhost:8555";

export const api = {
  // Registry & GIS
  getCameras: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${REGISTRY_BASE}/cameras?${qs}`);
    return res.json();
  },
  getCameraDetail: async (id) => {
    const res = await fetch(`${REGISTRY_BASE}/cameras/${id}`);
    return res.json();
  },
  getCameraHealth: async (id) => {
    const res = await fetch(`${REGISTRY_BASE}/cameras/${id}/health`);
    return res.json();
  },
  getDepartments: async () => {
    const res = await fetch(`${REGISTRY_BASE}/departments`);
    return res.json();
  },
  getGapAnalysis: async () => {
    const res = await fetch(`${REGISTRY_BASE}/gis/gap-analysis`);
    return res.json();
  },
  getGeoJSON: async () => {
    const res = await fetch(`${REGISTRY_BASE}/gis/geojson`);
    return res.json();
  },
  syncSentinelCameras: async (gatewayUrl = null) => {
    const url = gatewayUrl ? `${REGISTRY_BASE}/cameras/sync/sentinel?gateway_url=${encodeURIComponent(gatewayUrl)}` : `${REGISTRY_BASE}/cameras/sync/sentinel`;
    const res = await fetch(url, { method: "POST" });
    return res.json();
  },

  // Ingestion & Gateway
  getIngestStatus: async () => {
    const res = await fetch(`${INGESTION_BASE}/ingest/status`);
    return res.json();
  },
  startCameraStream: async (id) => {
    const res = await fetch(`${INGESTION_BASE}/ingest/cameras/${id}/start`, { method: "POST" });
    return res.json();
  },
  stopCameraStream: async (id) => {
    const res = await fetch(`${INGESTION_BASE}/ingest/cameras/${id}/stop`, { method: "POST" });
    return res.json();
  },
  getLiveRelayUrl: (id) => `${INGESTION_BASE}/relay/${id}/live`,
  getMockStreamUrl: (id) => `${MOCK_BASE}/stream/${id}/mjpeg`,

  // Analytics & Route Tracking
  getVehicleRoute: async (plateText) => {
    const res = await fetch(`${ANALYTICS_BASE}/analytics/routes/${encodeURIComponent(plateText)}`);
    return res.json();
  },
  getDetections: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${ANALYTICS_BASE}/analytics/detections?${qs}`);
    return res.json();
  },
  getAnalyticsStats: async () => {
    const res = await fetch(`${ANALYTICS_BASE}/analytics/stats`);
    return res.json();
  },

  // Watchlist
  getWatchlist: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${ANALYTICS_BASE}/analytics/watchlist?${qs}`);
    return res.json();
  },
  addWatchlistPlate: async (payload) => {
    const res = await fetch(`${ANALYTICS_BASE}/analytics/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  deleteWatchlistPlate: async (id) => {
    const res = await fetch(`${ANALYTICS_BASE}/analytics/watchlist/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Alerts
  getAlerts: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${ALERT_BASE}/alerts?${qs}`);
    return res.json();
  },
  getAlertsStats: async () => {
    const res = await fetch(`${ALERT_BASE}/alerts/summary/stats`);
    return res.json();
  },
  triageAlert: async (alertId, status, acknowledgedBy, notes = "") => {
    const res = await fetch(`${ALERT_BASE}/alerts/${alertId}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, acknowledged_by: acknowledgedBy, notes })
    });
    return res.json();
  },
  testTriggerAlert: async (plateText = "GJ01AB1234", priority = "CRITICAL") => {
    const res = await fetch(`${ALERT_BASE}/alerts/test-trigger?plate_text=${plateText}&priority=${priority}`, {
      method: "POST"
    });
    return res.json();
  },

  // WebSocket URL
  getAlertsWebSocketUrl: () => "ws://localhost:8004/ws/alerts"
};
