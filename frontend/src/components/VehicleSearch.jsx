import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Search, Navigation, Clock, MapPin, Gauge, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function VehicleSearch({ defaultPlate = 'GJ01AB1234' }) {
  const [queryPlate, setQueryPlate] = useState(defaultPlate);
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentDetections, setRecentDetections] = useState([]);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(L.layerGroup());

  useEffect(() => {
    // Initialize route map
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [23.0338, 72.5850],
        zoom: 11,
        zoomControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      routeLayerRef.current.addTo(map);
      mapInstanceRef.current = map;
    }

    handleSearch(defaultPlate);
    loadRecentDetections();
  }, []);

  const loadRecentDetections = async () => {
    try {
      const dets = await api.getDetections({ limit: 10 });
      setRecentDetections(dets || []);
    } catch (e) {
      //
    }
  };

  const handleSearch = async (plateToSearch) => {
    const target = plateToSearch || queryPlate;
    if (!target) return;
    setLoading(true);
    try {
      const data = await api.getVehicleRoute(target);
      setRouteData(data);
      renderRouteOnMap(data);
    } catch (e) {
      console.error('Error fetching route:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderRouteOnMap = (data) => {
    const map = mapInstanceRef.current;
    if (!map || !data || !data.route_hops || data.route_hops.length === 0) return;

    routeLayerRef.current.clearLayers();

    const latLngs = [];

    // Plot waypoint markers
    data.route_hops.forEach((hop) => {
      const pos = [hop.latitude, hop.longitude];
      latLngs.push(pos);

      const markerIcon = L.divIcon({
        className: 'route-stop-icon',
        html: `
          <div style="
            background: #0284c7;
            color: #ffffff;
            font-weight: 800;
            font-size: 11px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #38bdf8;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
          ">
            ${hop.stop_number}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker(pos, { icon: markerIcon });
      marker.bindPopup(`
        <div style="padding: 4px; font-family: sans-serif;">
          <div style="font-weight: bold; color: #38bdf8; font-size: 13px;">Stop ${hop.stop_number}: ${hop.camera_name}</div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">Time: ${hop.detected_at ? new Date(hop.detected_at).toLocaleTimeString('en-IN') : 'N/A'}</div>
          <div style="font-size: 11px; color: #38bdf8;">Transit Speed: ${hop.inter_camera_speed_kmh} km/h</div>
          <div style="font-size: 10px; color: #94a3b8;">PTS Timestamp: ${hop.pts_timestamp}ms</div>
        </div>
      `);
      routeLayerRef.current.addLayer(marker);
    });

    // Draw connecting polyline path
    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: '#00e5ff',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 6'
      });
      routeLayerRef.current.addLayer(polyline);
      map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 14 });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 13);
    }
  };

  const samplePlates = ['GJ01AB1234', 'GJ05CD5678', 'GJ27EF9012', 'GJ03GH3456'];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Search Controls */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                Multi-Camera Vehicle Trajectory & Route Reconstruction
              </h2>
              <p className="text-xs text-slate-400">
                Cross-camera journey correlation • Dwell time analysis • Transit velocity estimation
              </p>
            </div>
          </div>

          {/* Quick Target Plates */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Test Targets:</span>
            {samplePlates.map(p => (
              <button
                key={p}
                onClick={() => {
                  setQueryPlate(p);
                  handleSearch(p);
                }}
                className="font-mono text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 hover:border-cyan-400 font-bold transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={queryPlate}
              onChange={(e) => setQueryPlate(e.target.value.toUpperCase())}
              placeholder="Enter Registration Plate (e.g. GJ01AB1234, GJ05CD5678)..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-100 placeholder-slate-500 font-mono text-sm tracking-wider focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            <Navigation className="w-4 h-4" />
            <span>Reconstruct Route</span>
          </button>
        </form>
      </div>

      {/* Main Content: Map + Route Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Interactive Route GIS Map Canvas */}
        <div className="lg:col-span-7 glass-panel p-2 flex flex-col h-[520px]">
          <div className="flex items-center justify-between px-2 py-1 text-xs border-b border-slate-800/80 mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Surveillance Trajectory Map
            </span>
            {routeData && (
              <span className="text-[11px] font-mono text-cyan-400">
                {routeData.total_sightings} SIGHTINGS • {routeData.total_distance_traveled_km || 0} KM
              </span>
            )}
          </div>
          <div ref={mapContainerRef} className="w-full flex-1 rounded-lg overflow-hidden" />
        </div>

        {/* Right: Chronological Timeline Stops */}
        <div className="lg:col-span-5 glass-panel p-4 flex flex-col h-[520px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Chronological Sightings Timeline
            </h3>
            {routeData && (
              <div className="license-plate-tag text-xs">
                {routeData.plate_text}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
            {!routeData || routeData.route_hops.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p>No detection route recorded for this plate.</p>
                <p className="text-[11px] text-slate-500 mt-1">Try one of the test targets above.</p>
              </div>
            ) : (
              routeData.route_hops.map((hop, idx) => (
                <div
                  key={hop.detection_id || idx}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                        {hop.stop_number}
                      </span>
                      <span className="font-bold text-xs text-slate-100">{hop.camera_name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {hop.detected_at ? new Date(hop.detected_at).toLocaleTimeString('en-IN') : 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <div>
                      <span className="text-slate-500">Transit Speed:</span>{' '}
                      <span className="font-mono font-semibold text-cyan-400">
                        {hop.inter_camera_speed_kmh ? `${hop.inter_camera_speed_kmh} km/h` : 'First Point'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">PTS Time:</span>{' '}
                      <span className="font-mono text-slate-300">{hop.pts_timestamp?.toFixed(0)} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Dist. from Prev:</span>{' '}
                      <span className="font-mono text-slate-300">
                        {hop.distance_from_prev_km ? `${hop.distance_from_prev_km} km` : '0.0 km'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Confidence:</span>{' '}
                      <span className="font-mono text-emerald-400">{(hop.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
