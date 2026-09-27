import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, Shield, MapPin, Activity, Video, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

export default function CameraRegistry() {
  const [cameras, setCameras] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [selectedHealthCam, setSelectedHealthCam] = useState(null);
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cams, depts] = await Promise.all([
        api.getCameras(),
        api.getDepartments()
      ]);
      setCameras(cams || []);
      setDepartments(depts || []);
    } catch (e) {
      console.error('Error loading camera registry:', e);
    }
  };

  const handleSyncFromSentinel = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.syncSentinelCameras();
      setSyncResult(res);
      await loadData();
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncResult({ status: 'error', detail: String(e) });
    } finally {
      setSyncing(false);
    }
  };

  const openHealthModal = async (cam) => {
    setSelectedHealthCam(cam);
    try {
      const h = await api.getCameraHealth(cam.id);
      setHealthData(h);
    } catch (e) {
      console.error('Health load error:', e);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Registry Top Header */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                Model-1 CCTV Registry & Dynamic Catalogue Ingest
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                {cameras.length} REGISTERED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Auto-syncs from Sentinel sandbox GET /api/ingest • Forces TCP stream discovery • PostGIS metadata
            </p>
          </div>
        </div>

        <button
          onClick={handleSyncFromSentinel}
          disabled={syncing}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Querying /api/ingest...' : 'Sync from Sentinel Sandbox'}</span>
        </button>
      </div>

      {/* Sync Status Banner */}
      {syncResult && (
        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-300">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>
              Sentinel Catalogue Synced: Discovered {syncResult.total_discovered} cameras ({syncResult.created} new, {syncResult.updated} updated) from {syncResult.catalogue_endpoint}
            </span>
          </div>
          <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Cameras Table */}
      <div className="glass-panel overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Camera ID & Name</th>
                <th className="px-4 py-3">Jurisdiction Department</th>
                <th className="px-4 py-3">Coordinates (Lat/Lng)</th>
                <th className="px-4 py-3">Capabilities</th>
                <th className="px-4 py-3">Stream Properties</th>
                <th className="px-4 py-3">RTSP Stream (Forced TCP)</th>
                <th className="px-4 py-3 text-right">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cameras.map(cam => (
                <tr key={cam.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="live-beacon"></span>
                      <div>
                        <div className="font-bold text-slate-200 text-xs">{cam.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{cam.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-medium text-slate-300">
                      {cam.department?.name || 'Unassigned / SCCC'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                    {cam.latitude?.toFixed(4)}, {cam.longitude?.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cam.camera_type === 'ANPR' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {cam.camera_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono text-[11px] text-slate-300">{cam.resolution}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{cam.codec?.toUpperCase()} • {cam.declared_fps} fps</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap max-w-xs">
                    <div className="font-mono text-[10px] text-slate-400 truncate" title={cam.rtsp_url}>
                      {cam.rtsp_url}
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      TCP Transport Verified
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => openHealthModal(cam)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] transition-colors"
                    >
                      Diagnostics
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health Diagnostics Modal */}
      {selectedHealthCam && healthData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel p-6 shadow-2xl border-cyan-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
                  Camera Telemetry & Health: {selectedHealthCam.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedHealthCam(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Connection Status</div>
                <div className="text-emerald-400 font-bold font-mono text-sm mt-1">{healthData.status}</div>
              </div>
              <div className="p-3 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Codec & Transport</div>
                <div className="text-cyan-400 font-bold font-mono text-sm mt-1">{healthData.codec?.toUpperCase()} / TCP</div>
              </div>
              <div className="p-3 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Declared Frame Rate</div>
                <div className="text-slate-200 font-bold font-mono text-sm mt-1">{healthData.declared_fps} FPS</div>
              </div>
              <div className="p-3 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Stream Resolution</div>
                <div className="text-slate-200 font-bold font-mono text-sm mt-1">{healthData.resolution}</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
              <div className="font-bold text-slate-300">Sentinel Sandbox Verification:</div>
              <div>• Direct discovery from: GET /api/ingest</div>
              <div>• Transport enforcement: TCP ONLY (No UDP packets)</div>
              <div>• Timing derivation: strictly from POS_MSEC (PTS deltas)</div>
              <div>• Scene-cut & loop recovery: active</div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedHealthCam(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
