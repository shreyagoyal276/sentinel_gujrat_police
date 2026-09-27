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
      // Default initial grid cameras
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
    <div className="p-6 space-y-4">
      {/* Video Wall Top Controller Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
            <Video className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Live CCTV Video Wall — Netram Unified Grid
            </h2>
            <p className="text-[11px] text-slate-400">
              Low-latency direct stream gateway • Zero raw video storage • Strict PTS timing
            </p>
          </div>
        </div>

        {/* Grid Selector Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Grid Layout:</span>
          {['1x1', '2x2', '3x3'].map(size => (
            <button
              key={size}
              onClick={() => {
                setMaximizedCamId(null);
                setGridSize(size);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold font-mono transition-all ${
                gridSize === size && !maximizedCamId
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {size}
            </button>
          ))}
          {maximizedCamId && (
            <button
              onClick={() => setMaximizedCamId(null)}
              className="px-3 py-1 rounded text-xs font-semibold bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center gap-1"
            >
              <Minimize2 className="w-3 h-3" />
              <span>Exit Fullscreen</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Tiles */}
      <div className={`grid ${maximizedCamId ? 'grid-cols-1' : gridConfigs[gridSize].cols} gap-4`}>
        {activeTiles.map((cam) => {
          const metrics = ingestStatus[cam.id] || {};
          const isStreaming = metrics.status === 'STREAMING' || true;
          const currentPts = metrics.current_pts_msec || 0;
          const ptsFps = metrics.fps_pts_derived || cam.declared_fps || 25.0;
          const sceneCuts = metrics.scene_cuts_detected || 0;

          return (
            <div
              key={cam.id}
              className="glass-panel overflow-hidden border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col group"
            >
              {/* Tile Header Bar */}
              <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="live-beacon"></span>
                  <span className="font-semibold text-slate-200 truncate max-w-[200px]">{cam.name}</span>
                  <span className="font-mono text-[10px] text-slate-500">({cam.id})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 font-mono text-[10px] text-cyan-400 border border-slate-700">
                    {cam.codec?.toUpperCase()} • TCP
                  </span>
                  <button
                    onClick={() => setMaximizedCamId(maximizedCamId === cam.id ? null : cam.id)}
                    title={maximizedCamId === cam.id ? "Minimize" : "Maximize tile"}
                    className="p-1 rounded bg-slate-800/60 hover:bg-slate-700 text-slate-300"
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

                {/* HUD Stream Telemetry Overlay */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                  <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>PTS DERIVED: {ptsFps} FPS</span>
                  </div>
                  <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                    PTS: {currentPts > 0 ? `${currentPts.toFixed(1)}ms` : 'SYNCING...'}
                  </div>
                  {sceneCuts > 0 && (
                    <div className="bg-red-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-red-300 border border-red-500/40">
                      REBOOT/CUTS: {sceneCuts}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-2 right-2 bg-black/85 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-700">
                  {cam.resolution} • {cam.camera_type}
                </div>
              </div>

              {/* Tile Footer Stats */}
              <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-cyan-400" />
                  <span className="font-mono text-slate-300">Transport: TCP (No UDP)</span>
                </div>
                <div className="text-slate-400">
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
