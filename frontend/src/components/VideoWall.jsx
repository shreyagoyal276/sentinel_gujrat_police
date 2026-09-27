import React, { useState, useEffect } from 'react';
import { Grid, Maximize2, Minimize2, Video, Activity, RefreshCw, Radio } from 'lucide-react';
import { api } from '../services/api';

export default function VideoWall() {
  const [cameras, setCameras] = useState([]);
  const [gridSize, setGridSize] = useState('2x2'); // '1x1', '2x2', '3x3'
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [ingestStatus, setIngestStatus] = useState({});
  const [maximizedCamId, setMaximizedCamId] = useState(null);

  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadIngestMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadCameras = async () => {
    try {
      const data = await api.getCameras();
      setCameras(data || []);
      if (data && data.length > 0) {
        setSelectedCameras(data.slice(0, 4).map(c => c.id));
      }
    } catch (e) {
      console.error('Error loading cameras for video wall:', e);
    }
  };

  const loadIngestMetrics = async () => {
    try {
      const status = await api.getIngestStatus();
      setIngestStatus(status?.workers || {});
    } catch (e) {
      // Ingest status optional poll
    }
  };

  const gridConfigs = {
    '1x1': { cols: 'grid-cols-1', maxTiles: 1 },
    '2x2': { cols: 'grid-cols-1 md:grid-cols-2', maxTiles: 4 },
    '3x3': { cols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', maxTiles: 6 }
  };

  const activeTiles = maximizedCamId
    ? [cameras.find(c => c.id === maximizedCamId)].filter(Boolean)
    : cameras.slice(0, gridConfigs[gridSize].maxTiles);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Video Wall Top Controller Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-maroon-950 border border-maroon-800/60 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-maroon-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
              Live Video Wall
            </h2>
            <p className="text-xs text-slate-400">
              Multi-camera real-time surveillance grid
            </p>
          </div>
        </div>

        {/* Grid Selector Controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">Layout:</span>
          <div className="flex items-center gap-1 bg-[#0d0f14] p-1 rounded-lg border border-[#262c36]">
            {['1x1', '2x2', '3x3'].map(size => (
              <button
                key={size}
                onClick={() => {
                  setMaximizedCamId(null);
                  setGridSize(size);
                }}
                className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                  gridSize === size && !maximizedCamId
                    ? 'bg-maroon-800 text-white font-semibold border border-maroon-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181c24]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {maximizedCamId && (
            <button
              onClick={() => setMaximizedCamId(null)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Fullscreen</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Tiles */}
      <div className={`grid ${maximizedCamId ? 'grid-cols-1' : gridConfigs[gridSize].cols} gap-6`}>
        {activeTiles.map((cam) => {
          const metrics = ingestStatus[cam.id] || {};
          const currentPts = metrics.current_pts_msec || 0;
          const ptsFps = metrics.fps_pts_derived || cam.declared_fps || 25.0;
          const sceneCuts = metrics.scene_cuts_detected || 0;

          return (
            <div
              key={cam.id}
              className="glass-panel overflow-hidden border border-slate-800 hover:border-slate-700 transition-all flex flex-col group shadow-md"
            >
              {/* Tile Header Bar */}
              <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="live-beacon"></span>
                  <span className="font-medium text-slate-200 truncate max-w-[220px]">{cam.name}</span>
                  <span className="font-mono text-[11px] text-slate-500">({cam.id})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 font-mono text-[10px] text-slate-300 border border-slate-700/80">
                    {cam.codec?.toUpperCase()}
                  </span>
                  <button
                    onClick={() => setMaximizedCamId(maximizedCamId === cam.id ? null : cam.id)}
                    title={maximizedCamId === cam.id ? "Minimize" : "Maximize view"}
                    className="p-1 rounded bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    {maximizedCamId === cam.id ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Live Video Canvas */}
              <div className="relative bg-slate-950 aspect-video overflow-hidden">
                <img
                  src={api.getMockStreamUrl(cam.id)}
                  alt={`Live Feed: ${cam.name}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop';
                  }}
                />

                {/* Telemetry Overlay */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>{ptsFps} FPS</span>
                  </div>
                  <div className="bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-700">
                    PTS: {currentPts > 0 ? `${currentPts.toFixed(0)} ms` : 'Syncing'}
                  </div>
                  {sceneCuts > 0 && (
                    <div className="bg-red-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-red-300 border border-red-500/40">
                      Discontinuities: {sceneCuts}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-700">
                  {cam.resolution} · {cam.camera_type}
                </div>
              </div>

              {/* Tile Footer Stats */}
              <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-blue-400" />
                  <span className="font-mono text-slate-300">TCP Stream</span>
                </div>
                <div>
                  Bitrate: <span className="font-mono text-slate-300">{cam.bitrate || 4096} kbps</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
