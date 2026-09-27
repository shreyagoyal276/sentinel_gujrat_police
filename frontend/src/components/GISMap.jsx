import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Eye, Shield, Activity, RefreshCw, AlertTriangle, Video } from 'lucide-react';
import { api } from '../services/api';

export default function GISMap({ onSelectCamera }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    markers: L.layerGroup(),
    coverageCircles: L.layerGroup(),
    gapHotspots: L.layerGroup()
  });

  const [cameras, setCameras] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [gapData, setGapData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [showCoverage, setShowCoverage] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [previewCam, setPreviewCam] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center over Ahmedabad / Gandhinagar surveillance cluster
      const map = L.map(mapContainerRef.current, {
        center: [23.0338, 72.5850],
        zoom: 12,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Dark tactical map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      layersRef.current.coverageCircles.addTo(map);
      layersRef.current.gapHotspots.addTo(map);
      layersRef.current.markers.addTo(map);

      mapInstanceRef.current = map;
    }

    loadGISData();

    return () => {
      // Keep instance or cleanup on unmount
    };
  }, []);

  const loadGISData = async () => {
    setLoading(true);
    try {
      const [cams, depts, gaps] = await Promise.all([
        api.getCameras(),
        api.getDepartments(),
        api.getGapAnalysis()
      ]);
      setCameras(cams || []);
      setDepartments(depts || []);
      setGapData(gaps || null);
    } catch (err) {
      console.error('Error loading GIS data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Render markers, coverage buffers, and blind spots whenever filters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !cameras.length) return;

    const { markers, coverageCircles, gapHotspots } = layersRef.current;
    markers.clearLayers();
    coverageCircles.clearLayers();
    gapHotspots.clearLayers();

    // Filter cameras
    const filtered = cameras.filter(cam => {
      if (selectedDept !== 'ALL' && cam.dept_id !== selectedDept) return false;
      if (selectedType !== 'ALL' && cam.camera_type !== selectedType) return false;
      return true;
    });

    // Plot Cameras
    filtered.forEach(cam => {
      const isOnline = cam.status === 'ONLINE';
      const color = cam.camera_type === 'ANPR' ? '#00e5ff' : (cam.camera_type === 'PTZ' ? '#fbbf24' : '#10b981');

      // Custom pulse marker
      const customIcon = L.divIcon({
        className: 'custom-cam-pin',
        html: `
          <div style="
            position: relative;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              position: absolute;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: ${color}22;
              border: 2px solid ${color};
              box-shadow: 0 0 10px ${color}88;
            "></div>
            <div style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${color};
            "></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

      // Click to preview popup
      marker.on('click', () => {
        setPreviewCam(cam);
        if (onSelectCamera) onSelectCamera(cam);
      });

      marker.bindTooltip(`
        <div style="font-family: var(--font-sans); padding: 4px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 12px;">${cam.name}</div>
          <div style="font-size: 11px; color: #94a3b8;">${cam.camera_type} • ${cam.codec?.toUpperCase()} • ${cam.status}</div>
        </div>
      `, { direction: 'top', offset: [0, -10], className: 'tactical-tooltip' });

      markers.addLayer(marker);

      // Coverage radius circle
      if (showCoverage) {
        const radius = cam.coverage_radius_meters || 150;
        const circle = L.circle([cam.latitude, cam.longitude], {
          radius: radius,
          color: color,
          weight: 1,
          opacity: 0.4,
          fillColor: color,
          fillOpacity: 0.08
        });
        coverageCircles.addLayer(circle);
      }
    });

    // Render Blind Spots / Gap Analysis
    if (showGaps && gapData?.hotspots_needing_coverage) {
      gapData.hotspots_needing_coverage.forEach(spot => {
        const gapMarker = L.circleMarker([spot.recommended_lat, spot.recommended_lng], {
          radius: 14,
          color: '#ef4444',
          weight: 2,
          dashArray: '4, 4',
          fillColor: '#ef4444',
          fillOpacity: 0.25
        });

        gapMarker.bindTooltip(`
          <div style="padding: 4px;">
            <div style="font-weight: 700; color: #f87171;">⚠️ COVERAGE GAP IDENTIFIED</div>
            <div style="font-size: 11px; color: #fecaca;">${spot.zone_name}</div>
            <div style="font-size: 10px; color: #cbd5e1;">Deficiency: ${spot.deficiency_level} • Needs ${spot.cameras_recommended} ANPR units</div>
          </div>
        `, { direction: 'top' });

        gapHotspots.addLayer(gapMarker);
      });
    }

    // Auto fit bounds
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map(c => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [cameras, gapData, selectedDept, selectedType, showCoverage, showGaps]);

  return (
    <div className="relative w-full h-[calc(100vh-68px)] flex overflow-hidden">
      {/* GIS Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Tactical Floating GIS Filter & Control Panel */}
      <div className="absolute top-4 left-4 z-10 w-84 glass-panel p-4 text-xs space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="font-bold text-sm text-slate-100 tracking-wide uppercase">GIS Layer Controls</h2>
          </div>
          <button
            onClick={loadGISData}
            title="Refresh GIS & Camera status"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Department Filter */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Jurisdiction / Department
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
          >
            <option value="ALL">All Departments ({cameras.length} Cameras)</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        {/* Camera Type Filter */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Camera Capability
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {['ALL', 'ANPR', 'PTZ'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`py-1 rounded text-center font-medium transition-all ${
                  selectedType === type
                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                    : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Map Layer Toggles */}
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-slate-300">150m Coverage Radius</span>
            <input
              type="checkbox"
              checked={showCoverage}
              onChange={(e) => setShowCoverage(e.target.checked)}
              className="accent-cyan-400 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Surveillance Gap Hotspots
            </span>
            <input
              type="checkbox"
              checked={showGaps}
              onChange={(e) => setShowGaps(e.target.checked)}
              className="accent-red-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Corridor Gap Analysis Metrics */}
        {gapData && (
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Monitored Corridors</span>
              <span className="font-mono font-bold text-slate-200">{gapData.total_corridors_monitored}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Surveillance Density Score</span>
              <span className="font-mono font-bold text-cyan-400">{gapData.overall_surveillance_coverage_pct}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Critical Blind Spots</span>
              <span className="font-mono font-bold text-red-400 px-1.5 py-0.2 rounded bg-red-950/60 border border-red-500/30">
                {gapData.uncovered_zones_count} Zones
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Click-to-Preview Live Stream Card */}
      {previewCam && (
        <div className="absolute bottom-6 right-6 z-10 w-96 glass-panel p-3 shadow-2xl border-cyan-500/40">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="live-beacon"></span>
              <span className="font-bold text-xs text-slate-100">{previewCam.name}</span>
            </div>
            <button
              onClick={() => setPreviewCam(null)}
              className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="relative mt-2 rounded-lg overflow-hidden bg-slate-950 aspect-video border border-slate-800">
            <img
              src={api.getMockStreamUrl(previewCam.id)}
              alt="Live Stream Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop';
              }}
            />
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-cyan-300 border border-cyan-500/40">
              TCP • PTS SYNC • {previewCam.codec?.toUpperCase()}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div>
              <span className="text-slate-500">ID:</span> <span className="font-mono text-slate-300">{previewCam.id}</span>
            </div>
            <div>
              <span className="text-slate-500">Type:</span> <span className="text-cyan-400 font-semibold">{previewCam.camera_type}</span>
            </div>
            <div>
              <span className="text-slate-500">Resolution:</span> <span className="text-slate-300 font-mono">{previewCam.resolution}</span>
            </div>
            <div>
              <span className="text-slate-500">Declared FPS:</span> <span className="text-slate-300 font-mono">{previewCam.declared_fps} fps</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
