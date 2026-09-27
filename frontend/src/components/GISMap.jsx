import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Eye, Shield, Activity, RefreshCw, AlertTriangle, Video, X, Check, MapPin, ZoomIn, Globe, Compass } from 'lucide-react';
import { api } from '../services/api';

// Free, high-performance tactical map tiles without API key restrictions
const TILE_LAYERS = {
  dark: {
    name: 'Tactical Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  },
  street: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  }
};

const GUJARAT_BOUNDS = [
  [20.0, 68.0],
  [24.7, 74.5]
];

export default function GISMap({ onSelectCamera }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentTileLayerRef = useRef(null);
  const currentLabelLayerRef = useRef(null);

  const layersRef = useRef({
    mask: L.layerGroup(),
    stateBorder: L.layerGroup(),
    districts: L.layerGroup(),
    markers: L.layerGroup(),
    coverageCircles: L.layerGroup(),
    gapHotspots: L.layerGroup()
  });

  const [activeTile, setActiveTile] = useState('dark');
  const [cameras, setCameras] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [gapData, setGapData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Layer Toggles
  const [showMask, setShowMask] = useState(true);
  const [showDistricts, setShowDistricts] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showGaps, setShowGaps] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [previewCam, setPreviewCam] = useState(null);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [22.6708, 71.5724], // Center of Gujarat
        zoom: 7.5,
        minZoom: 6,
        maxZoom: 19,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Base tile layer
      currentTileLayerRef.current = L.tileLayer(TILE_LAYERS.dark.url, {
        attribution: TILE_LAYERS.dark.attribution,
        maxZoom: TILE_LAYERS.dark.maxZoom || 16
      }).addTo(map);

      if (TILE_LAYERS.dark.labelUrl) {
        currentLabelLayerRef.current = L.tileLayer(TILE_LAYERS.dark.labelUrl, {
          maxZoom: TILE_LAYERS.dark.maxZoom || 16
        }).addTo(map);
      }

      // Add feature layers in specific visual order
      layersRef.current.mask.addTo(map);
      layersRef.current.stateBorder.addTo(map);
      layersRef.current.districts.addTo(map);
      layersRef.current.coverageCircles.addTo(map);
      layersRef.current.gapHotspots.addTo(map);
      layersRef.current.markers.addTo(map);

      mapInstanceRef.current = map;

      // Fit Gujarat on initial load
      map.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20] });

      // Invalidate size to guarantee no visual tearing
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 500);

      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);

      // Load Gujarat GeoJSON Boundaries & Mask
      loadGujaratBoundaries(map);
    }

    loadGISData();

    return () => {
      // Window resize listener cleanup if unmounted
    };
  }, []);

  // Switch Base Tile Layer
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

    // Leaflet tiles are placed in tilePane (z-index 200), keeping vectors (overlayPane z-index 400) and markers (markerPane z-index 600) naturally on top
  }, [activeTile]);

  // Load Gujarat State GeoJSON: Inverted Mask, State Boundary, and Districts
  const loadGujaratBoundaries = async (map) => {
    try {
      const [maskRes, boundaryRes, districtsRes] = await Promise.all([
        fetch('/gujarat-mask-fast.geojson').then(r => r.ok ? r.json() : null),
        fetch('/gujarat-boundary-fast.geojson').then(r => r.ok ? r.json() : null),
        fetch('/gujarat-districts-fast.geojson').then(r => r.ok ? r.json() : null)
      ]);

      // 1. Inverted Mask Layer (Dims outside Gujarat)
      if (maskRes) {
        const maskGeoJson = L.geoJSON(maskRes, {
          style: {
            fillColor: '#0a0c10',
            fillOpacity: 0.72,
            stroke: false,
            interactive: false
          }
        });
        layersRef.current.mask.clearLayers();
        layersRef.current.mask.addLayer(maskGeoJson);
      }

      // 2. Gujarat State Outer Border (Outer Glow + Crisp Crimson Maroon Border)
      if (boundaryRes) {
        layersRef.current.stateBorder.clearLayers();

        // Subtle spotlight fill inside Gujarat
        const spotlightFill = L.geoJSON(boundaryRes, {
          style: {
            fillColor: '#8c1f36',
            fillOpacity: 0.04,
            stroke: false,
            interactive: false
          }
        });

        // Broad outer aura / glow
        const outerAura = L.geoJSON(boundaryRes, {
          style: {
            color: '#751e31',
            weight: 7,
            opacity: 0.45,
            fill: false,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false
          }
        });

        // Crisp vibrant maroon boundary line
        const crispBorder = L.geoJSON(boundaryRes, {
          style: {
            color: '#c73252',
            weight: 2.2,
            opacity: 0.95,
            fill: false,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false
          }
        });

        layersRef.current.stateBorder.addLayer(spotlightFill);
        layersRef.current.stateBorder.addLayer(outerAura);
        layersRef.current.stateBorder.addLayer(crispBorder);
      }

      // 3. Gujarat Districts Outline
      if (districtsRes) {
        layersRef.current.districts.clearLayers();

        const districtsLayer = L.geoJSON(districtsRes, {
          style: () => ({
            color: 'rgba(255, 255, 255, 0.12)',
            weight: 0.9,
            dashArray: '3, 4',
            fillColor: 'transparent',
            fillOpacity: 0
          }),
          onEachFeature: (feature, layer) => {
            const districtName = feature.properties?.district || feature.properties?.NAME_2 || 'Gujarat District';

            layer.on({
              mouseover: (e) => {
                const target = e.target;
                target.setStyle({
                  color: '#c73252',
                  weight: 2,
                  dashArray: '',
                  fillColor: '#751e31',
                  fillOpacity: 0.08
                });
                setHoveredDistrict(districtName);
              },
              mouseout: (e) => {
                districtsLayer.resetStyle(e.target);
                setHoveredDistrict(null);
              },
              click: () => {
                if (map) {
                  map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 12 });
                }
              }
            });

            layer.bindTooltip(`
              <div style="font-family: 'Inter', sans-serif; padding: 2px 4px; font-weight: 600; font-size: 11px; color: #f1f5f9;">
                ${districtName}
              </div>
            `, { sticky: true, className: 'district-tooltip' });
          }
        });

        layersRef.current.districts.addLayer(districtsLayer);
      }
    } catch (err) {
      console.warn('Gujarat boundary GeoJSON load error:', err);
    }
  };

  // Visibility toggle handler for mask
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (showMask) {
      if (!map.hasLayer(layersRef.current.mask)) map.addLayer(layersRef.current.mask);
    } else {
      if (map.hasLayer(layersRef.current.mask)) map.removeLayer(layersRef.current.mask);
    }
  }, [showMask]);

  // Visibility toggle handler for districts
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (showDistricts) {
      if (!map.hasLayer(layersRef.current.districts)) map.addLayer(layersRef.current.districts);
    } else {
      if (map.hasLayer(layersRef.current.districts)) map.removeLayer(layersRef.current.districts);
    }
  }, [showDistricts]);

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
      const color = cam.camera_type === 'ANPR' ? '#c73252' : (cam.camera_type === 'PTZ' ? '#d97706' : '#10b981');

      // Custom marker icon
      const customIcon = L.divIcon({
        className: 'custom-cam-pin',
        html: `
          <div style="
            position: relative;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              position: absolute;
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: ${color}25;
              border: 1.5px solid ${color};
            "></div>
            <div style="
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: ${color};
            "></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

      // Click to preview popup
      marker.on('click', () => {
        setPreviewCam(cam);
        if (onSelectCamera) onSelectCamera(cam);
      });

      marker.bindTooltip(`
        <div style="font-family: 'Inter', sans-serif; padding: 4px;">
          <div style="font-weight: 600; color: #f1f5f9; font-size: 12px;">${cam.name}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${cam.camera_type} · ${cam.codec?.toUpperCase()} · ${cam.status}</div>
        </div>
      `, { direction: 'top', offset: [0, -10] });

      markers.addLayer(marker);

      // Coverage radius circle
      if (showCoverage) {
        const radius = cam.coverage_radius_meters || 150;
        const circle = L.circle([cam.latitude, cam.longitude], {
          radius: radius,
          color: color,
          weight: 1,
          opacity: 0.35,
          fillColor: color,
          fillOpacity: 0.06
        });
        coverageCircles.addLayer(circle);
      }
    });

    // Render Blind Spots / Gap Analysis
    if (showGaps && gapData?.hotspots_needing_coverage) {
      gapData.hotspots_needing_coverage.forEach(spot => {
        const gapMarker = L.circleMarker([spot.recommended_lat, spot.recommended_lng], {
          radius: 12,
          color: '#ef4444',
          weight: 1.5,
          dashArray: '4, 4',
          fillColor: '#ef4444',
          fillOpacity: 0.2
        });

        gapMarker.bindTooltip(`
          <div style="font-family: 'Inter', sans-serif; padding: 4px;">
            <div style="font-weight: 600; color: #f87171; font-size: 11px;">Coverage Gap</div>
            <div style="font-size: 12px; color: #f1f5f9; font-weight: 500; margin-top: 2px;">${spot.zone_name}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Deficiency: ${spot.deficiency_level} · Needs ${spot.cameras_recommended} units</div>
          </div>
        `, { direction: 'top' });

        gapHotspots.addLayer(gapMarker);
      });
    }
  }, [cameras, gapData, selectedDept, selectedType, showCoverage, showGaps]);

  // Quick Zoom handlers
  const handleZoomGujarat = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20], animate: true });
    }
  };

  const handleZoomAhmedabad = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([23.0338, 72.5850], 12.5, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-57px)] flex overflow-hidden">
      {/* GIS Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#0a0c10]" />

      {/* Floating State Banner / Quick Controls */}
      <div className="absolute top-5 right-14 z-10 flex items-center gap-2">
        <div className="glass-panel px-3 py-1.5 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[11px] font-mono font-semibold text-slate-200 uppercase tracking-wide">
            Gujarat State Grid
          </span>
          {hoveredDistrict && (
            <span className="text-[11px] font-medium text-maroon-400 border-l border-slate-700 pl-2">
              {hoveredDistrict}
            </span>
          )}
        </div>

        {/* Quick View Anchors */}
        <div className="glass-panel p-1 flex items-center gap-1 shadow-lg">
          <button
            onClick={handleZoomGujarat}
            title="Fit Entire Gujarat State"
            className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-maroon-900/60 transition-colors flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-maroon-400" />
            Fit Gujarat
          </button>
          <button
            onClick={handleZoomAhmedabad}
            title="Focus Ahmedabad / Gandhinagar Surveillance Cluster"
            className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-maroon-900/60 transition-colors flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-maroon-400" />
            Ahmedabad Hub
          </button>
        </div>

        {/* Basemap Switcher */}
        <div className="glass-panel p-1 flex items-center gap-1 shadow-lg">
          {Object.entries(TILE_LAYERS).map(([key, conf]) => (
            <button
              key={key}
              onClick={() => setActiveTile(key)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                activeTile === key
                  ? 'bg-maroon-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1e27]'
              }`}
            >
              {conf.name}
            </button>
          ))}
        </div>
      </div>

      {/* Floating GIS Filter & Control Panel */}
      <div className="absolute top-5 left-5 z-10 w-80 glass-panel p-4 text-xs space-y-4 max-h-[calc(100vh-90px)] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-maroon-400" />
            <h2 className="font-semibold text-xs text-slate-100 uppercase tracking-wider">Gujarat Surveillance Map</h2>
          </div>
          <button
            onClick={loadGISData}
            title="Refresh GIS data"
            className="p-1 rounded bg-[#1c2028] hover:bg-[#252b36] text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon-400' : ''}`} />
          </button>
        </div>

        {/* Department Filter */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400 block">
            Department / Jurisdiction
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-1.5 text-slate-200 focus:outline-none focus:border-maroon-700 text-xs"
          >
            <option value="ALL">All Jurisdictions ({cameras.length} Cameras)</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        {/* Camera Type Filter */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400 block">
            Camera Type
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {['ALL', 'ANPR', 'PTZ'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`py-1.5 rounded-md text-center font-medium transition-all ${
                  selectedType === type
                    ? 'bg-maroon-800 text-white font-semibold border border-maroon-700/80 shadow-sm'
                    : 'bg-[#0d0f14] border border-[#2a2f3a] text-slate-400 hover:text-slate-200 hover:bg-[#181c24]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Map Layer Toggles */}
        <div className="space-y-2.5 border-t border-slate-800 pt-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Display Layers
          </div>

          <label className="flex items-center justify-between cursor-pointer text-slate-300 text-xs select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-maroon-400"></span>
              Gujarat Focus (Fade Other States)
            </span>
            <input
              type="checkbox"
              checked={showMask}
              onChange={(e) => setShowMask(e.target.checked)}
              className="accent-maroon-700 cursor-pointer rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer text-slate-300 text-xs select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              District Boundaries (34 Districts)
            </span>
            <input
              type="checkbox"
              checked={showDistricts}
              onChange={(e) => setShowDistricts(e.target.checked)}
              className="accent-maroon-700 cursor-pointer rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer text-slate-300 text-xs select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Coverage Radius (150m)
            </span>
            <input
              type="checkbox"
              checked={showCoverage}
              onChange={(e) => setShowCoverage(e.target.checked)}
              className="accent-maroon-700 cursor-pointer rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer text-slate-300 text-xs select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              Blind Spots / Coverage Gaps
            </span>
            <input
              type="checkbox"
              checked={showGaps}
              onChange={(e) => setShowGaps(e.target.checked)}
              className="accent-red-600 cursor-pointer rounded"
            />
          </label>
        </div>

        {/* Corridor Gap Analysis Metrics */}
        {gapData && (
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Surveillance Analytics
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Monitored Corridors</span>
              <span className="font-mono font-medium text-slate-200">{gapData.total_corridors_monitored}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Coverage Score</span>
              <span className="font-mono font-medium text-emerald-400">{gapData.overall_surveillance_coverage_pct}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Blind Spots</span>
              <span className="font-mono font-medium text-red-400">
                {gapData.uncovered_zones_count} Zones
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Click-to-Preview Live Stream Card */}
      {previewCam && (
        <div className="absolute bottom-6 right-6 z-10 w-96 glass-panel p-4 shadow-2xl border-slate-700/80">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="live-beacon"></span>
              <span className="font-semibold text-xs text-slate-100 truncate max-w-[240px]">{previewCam.name}</span>
            </div>
            <button
              onClick={() => setPreviewCam(null)}
              className="text-slate-400 hover:text-slate-200 text-xs p-1 rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative mt-3 rounded-lg overflow-hidden bg-slate-950 aspect-video border border-slate-800">
            <img
              src={api.getMockStreamUrl(previewCam.id)}
              alt="Live Stream Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop';
              }}
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 font-mono text-[10px] text-slate-300 border border-slate-700">
              TCP · {previewCam.codec?.toUpperCase()}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Camera ID</span>
              <span className="font-mono text-slate-200">{previewCam.id}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Type</span>
              <span className="text-slate-200 font-medium">{previewCam.camera_type}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Resolution</span>
              <span className="text-slate-200 font-mono">{previewCam.resolution}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Declared FPS</span>
              <span className="text-slate-200 font-mono">{previewCam.declared_fps} fps</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
