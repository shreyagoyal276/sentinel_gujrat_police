import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Search, Navigation, MapPin, Clock, Gauge, ArrowRight, CheckCircle2, Compass, Layers } from 'lucide-react';
import { api } from '../services/api';

// Free, high-performance tactical map tiles without API key restrictions
const TILE_LAYERS = {
  dark: {
    name: 'Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 16
  },
  street: {
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  },
  satellite: {
    name: 'Sat',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar',
    maxZoom: 19
  }
};

const GUJARAT_BOUNDS = [
  [20.0, 68.0],
  [24.7, 74.5]
];

export default function VehicleSearch() {
  const [queryPlate, setQueryPlate] = useState('GJ01AB1234');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTile, setActiveTile] = useState('dark');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentTileLayerRef = useRef(null);
  const currentLabelLayerRef = useRef(null);
  const routeLayerRef = useRef(L.layerGroup());
  const boundaryLayerRef = useRef(L.layerGroup());
  const maskLayerRef = useRef(L.layerGroup());

  useEffect(() => {
    // Initial map setup
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [23.0338, 72.5850],
        zoom: 12,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      currentTileLayerRef.current = L.tileLayer(TILE_LAYERS.dark.url, {
        attribution: TILE_LAYERS.dark.attribution,
        maxZoom: TILE_LAYERS.dark.maxZoom || 16
      }).addTo(map);

      if (TILE_LAYERS.dark.labelUrl) {
        currentLabelLayerRef.current = L.tileLayer(TILE_LAYERS.dark.labelUrl, {
          maxZoom: TILE_LAYERS.dark.maxZoom || 16
        }).addTo(map);
      }

      maskLayerRef.current.addTo(map);
      boundaryLayerRef.current.addTo(map);
      routeLayerRef.current.addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size to guarantee smooth render
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 500);

      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);

      // Load Gujarat boundaries & mask
      loadGujaratOverlays(map);
    }

    // Run initial search
    handleSearch('GJ01AB1234');
  }, []);

  // Basemap switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentTileLayerRef.current) return;

    map.removeLayer(currentTileLayerRef.current);
    if (currentLabelLayerRef.current) {
      map.removeLayer(currentLabelLayerRef.current);
      currentLabelLayerRef.current = null;
    }

    const tileConf = TILE_LAYERS[activeTile] || TILE_LAYERS.dark;
    currentTileLayerRef.current = L.tileLayer(tileConf.url, {
      attribution: tileConf.attribution,
      subdomains: 'abcd',
      maxZoom: tileConf.maxZoom || 19
    }).addTo(map);

    if (tileConf.labelUrl) {
      currentLabelLayerRef.current = L.tileLayer(tileConf.labelUrl, {
        maxZoom: tileConf.maxZoom || 16
      }).addTo(map);
    }
    // Leaflet tiles are placed in tilePane (z-index 200), keeping vectors and markers naturally on top
  }, [activeTile]);

  // Load Gujarat state boundary and inverted mask
  const loadGujaratOverlays = async (map) => {
    try {
      const [maskRes, boundaryRes] = await Promise.all([
        fetch('/gujarat-mask-fast.geojson').then(r => r.ok ? r.json() : null),
        fetch('/gujarat-boundary-fast.geojson').then(r => r.ok ? r.json() : null)
      ]);

      if (maskRes) {
        const maskGeoJson = L.geoJSON(maskRes, {
          style: {
            fillColor: '#0a0c10',
            fillOpacity: 0.72,
            stroke: false,
            interactive: false
          }
        });
        maskLayerRef.current.clearLayers();
        maskLayerRef.current.addLayer(maskGeoJson);
      }

      if (boundaryRes) {
        boundaryLayerRef.current.clearLayers();

        // Outer maroon aura
        const outerAura = L.geoJSON(boundaryRes, {
          style: {
            color: '#751e31',
            weight: 6,
            opacity: 0.45,
            fill: false,
            interactive: false
          }
        });

        // Crisp maroon border
        const crispBorder = L.geoJSON(boundaryRes, {
          style: {
            color: '#c73252',
            weight: 2,
            opacity: 0.95,
            fill: false,
            interactive: false
          }
        });

        boundaryLayerRef.current.addLayer(outerAura);
        boundaryLayerRef.current.addLayer(crispBorder);
      }
    } catch (err) {
      console.warn('Error loading Gujarat overlays for route map:', err);
    }
  };

  const handleSearch = async (plateToSearch) => {
    const target = plateToSearch || queryPlate;
    if (!target) return;

    setLoading(true);
    try {
      const data = await api.getVehicleRoute(target);
      setRouteData(data);
      renderRouteOnMap(data?.route_hops || []);
    } catch (e) {
      console.error('Error fetching route:', e);
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 100);
    }
  };

  const renderRouteOnMap = (hops) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    routeLayerRef.current.clearLayers();

    if (!hops || hops.length === 0) {
      map.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20] });
      return;
    }

    const latLngs = [];

    hops.forEach((hop, idx) => {
      const pos = [hop.latitude, hop.longitude];
      latLngs.push(pos);

      const isLastStop = idx === hops.length - 1;

      // Stop marker
      const markerHtml = `
        <div style="
          position: relative;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #751e31;
          color: #ffffff;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid ${isLastStop ? '#f43f5e' : '#ffffff'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.7), 0 0 ${isLastStop ? '12px #f43f5e80' : '4px rgba(0,0,0,0.5)'};
        ">
          ${hop.stop_number}
          ${isLastStop ? '<span style="position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid #f43f5e; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>' : ''}
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'route-stop-pin',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(pos, { icon: markerIcon });
      marker.bindPopup(`
        <div style="padding: 4px; font-family: 'Inter', sans-serif;">
          <div style="font-weight: 700; color: #f1f5f9; font-size: 12px; border-bottom: 1px solid #334155; padding-bottom: 3px;">
            Stop ${hop.stop_number}: ${hop.camera_name}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">
            Time: <span style="color: #f1f5f9; font-family: 'JetBrains Mono';">${hop.detected_at ? new Date(hop.detected_at).toLocaleTimeString('en-IN') : 'N/A'}</span>
          </div>
          <div style="font-size: 11px; color: #ec7f93; margin-top: 2px;">
            Transit Speed: <span style="font-weight: 600;">${hop.inter_camera_speed_kmh} km/h</span>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Confidence: ${(hop.confidence * 100).toFixed(0)}%
          </div>
        </div>
      `);
      routeLayerRef.current.addLayer(marker);
    });

    // Draw connecting polyline path
    if (latLngs.length > 1) {
      // Background glow line
      const glowLine = L.polyline(latLngs, {
        color: '#751e31',
        weight: 6,
        opacity: 0.5
      });
      routeLayerRef.current.addLayer(glowLine);

      // Foreground dashed trajectory line
      const polyline = L.polyline(latLngs, {
        color: '#f43f5e',
        weight: 3,
        opacity: 0.95,
        dashArray: '6, 6'
      });
      routeLayerRef.current.addLayer(polyline);

      map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 15 });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 13);
    }
  };

  const handleFitRoute = () => {
    if (!mapInstanceRef.current || !routeData?.route_hops?.length) return;
    const latLngs = routeData.route_hops.map(h => [h.latitude, h.longitude]);
    if (latLngs.length > 1) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], animate: true });
    } else if (latLngs.length === 1) {
      mapInstanceRef.current.setView(latLngs[0], 13, { animate: true });
    }
  };

  const handleFitGujarat = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20], animate: true });
    }
  };

  const samplePlates = ['GJ01AB1234', 'GJ05CD5678', 'GJ27EF9012', 'GJ03GH3456'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Search Controls */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-maroon-950 border border-maroon-800/60 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4 text-maroon-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Vehicle Route Reconstruction
              </h2>
              <p className="text-xs text-slate-400">
                Cross-camera journey tracking and transit velocity analysis across Gujarat
              </p>
            </div>
          </div>

          {/* Quick Target Plates */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Quick Select:</span>
            {samplePlates.map(p => (
              <button
                key={p}
                onClick={() => {
                  setQueryPlate(p);
                  handleSearch(p);
                }}
                className={`font-mono text-xs px-2.5 py-1 rounded-md border transition-all ${
                  queryPlate === p
                    ? 'bg-maroon-800 text-white border-maroon-700/80 font-bold'
                    : 'bg-[#0d0f14] border-[#262c36] text-slate-300 hover:border-slate-500'
                }`}
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
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={queryPlate}
              onChange={(e) => setQueryPlate(e.target.value.toUpperCase())}
              placeholder="Enter Registration Plate (e.g., GJ01AB1234)..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0d0f14] border border-[#2a2f3a] text-slate-100 placeholder-slate-500 font-mono text-xs tracking-wider focus:outline-none focus:border-maroon-700 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 border border-maroon-700/80 shadow-sm disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{loading ? 'Searching...' : 'Track Route'}</span>
          </button>
        </form>
      </div>

      {/* Main Content: Map + Route Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Route GIS Map Canvas */}
        <div className="lg:col-span-7 glass-panel p-3 flex flex-col h-[540px]">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs border-b border-slate-800 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-maroon-400" />
                Gujarat Route Trajectory
              </span>
              {routeData && (
                <span className="text-[11px] font-mono text-maroon-300 bg-maroon-950/80 px-2 py-0.5 rounded border border-maroon-800/60">
                  {routeData.total_sightings} Sightings · {routeData.total_distance_traveled_km || 0} km
                </span>
              )}
            </div>

            {/* Map Action Pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleFitRoute}
                title="Fit Route Bounds"
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1a1e27] hover:bg-maroon-900/60 text-slate-300 transition-colors"
              >
                Fit Route
              </button>
              <button
                onClick={handleFitGujarat}
                title="Fit Gujarat State"
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1a1e27] hover:bg-maroon-900/60 text-slate-300 transition-colors"
              >
                Fit Gujarat
              </button>
              <div className="border-l border-slate-700 pl-1 flex items-center gap-0.5">
                {Object.entries(TILE_LAYERS).map(([k, c]) => (
                  <button
                    key={k}
                    onClick={() => setActiveTile(k)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      activeTile === k ? 'bg-maroon-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={mapContainerRef} className="w-full flex-1 rounded-lg overflow-hidden bg-[#0a0c10]" />
        </div>

        {/* Right: Chronological Timeline Stops */}
        <div className="lg:col-span-5 glass-panel p-5 flex flex-col h-[540px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Sightings Timeline
            </h3>
            {routeData && (
              <div className="license-plate-tag">
                {routeData.plate_text}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
            {!routeData || routeData.route_hops.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p>No detection route recorded for this plate.</p>
                <p className="text-[11px] text-slate-500 mt-1">Select one of the sample targets above.</p>
              </div>
            ) : (
              routeData.route_hops.map((hop, idx) => (
                <div
                  key={hop.detection_id || idx}
                  className="p-3.5 rounded-lg bg-[#0e1117] border border-[#242934] hover:border-maroon-800/60 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-maroon-800 text-white font-mono font-bold text-xs flex items-center justify-center">
                        {hop.stop_number}
                      </span>
                      <span className="font-semibold text-xs text-slate-200">{hop.camera_name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {hop.detected_at ? new Date(hop.detected_at).toLocaleTimeString('en-IN') : 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                    <div className="bg-slate-950/50 p-1.5 rounded">
                      <span className="text-slate-500 block text-[10px]">Speed</span>
                      <span className="font-mono text-slate-200 font-medium">
                        {hop.inter_camera_speed_kmh ? `${hop.inter_camera_speed_kmh} km/h` : 'Initial Sighting'}
                      </span>
                    </div>
                    <div className="bg-slate-950/50 p-1.5 rounded">
                      <span className="text-slate-500 block text-[10px]">PTS Timestamp</span>
                      <span className="font-mono text-slate-200">{hop.pts_timestamp?.toFixed(0)} ms</span>
                    </div>
                    <div className="bg-slate-950/50 p-1.5 rounded">
                      <span className="text-slate-500 block text-[10px]">Distance</span>
                      <span className="font-mono text-slate-200">
                        {hop.distance_from_prev_km ? `${hop.distance_from_prev_km} km` : '0.0 km'}
                      </span>
                    </div>
                    <div className="bg-slate-950/50 p-1.5 rounded">
                      <span className="text-slate-500 block text-[10px]">Confidence</span>
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
