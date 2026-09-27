import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, Video, Globe, Activity, Plus, ShieldCheck, X } from 'lucide-react';
import { api } from '../services/api';

export default function CameraRegistry() {
  const [cameras, setCameras] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Camera Form
  const [newCamId, setNewCamId] = useState('');
  const [newCamName, setNewCamName] = useState('');
  const [newDeptId, setNewDeptId] = useState('');
  const [newLat, setNewLat] = useState('23.0338');
  const [newLng, setNewLng] = useState('72.5850');
  const [newType, setNewType] = useState('ANPR');
  const [newRtsp, setNewRtsp] = useState('rtsp://localhost:8554/stream/');
  const [newCodec, setNewCodec] = useState('h264');

  useEffect(() => {
    loadRegistry();
  }, []);

  const loadRegistry = async () => {
    try {
      const [cams, depts] = await Promise.all([
        api.getCameras(),
        api.getDepartments()
      ]);
      setCameras(cams || []);
      setDepartments(depts || []);
      if (depts && depts.length > 0 && !newDeptId) {
        setNewDeptId(depts[0].id);
      }
    } catch (e) {
      console.error('Registry load error:', e);
    }
  };

  const handleSyncFromSentinel = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.syncSentinelCameras();
      setSyncResult(res);
      loadRegistry();
    } catch (e) {
      alert('Sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    try {
      await api.createCamera({
        id: newCamId,
        name: newCamName,
        dept_id: newDeptId,
        latitude: parseFloat(newLat),
        longitude: parseFloat(newLng),
        camera_type: newType,
        rtsp_stream_url: newRtsp,
        codec: newCodec,
        resolution: '1920x1080',
        declared_fps: 25.0,
        coverage_radius_meters: 150,
        status: 'ONLINE'
      });
      setShowAddModal(false);
      setNewCamId('');
      setNewCamName('');
      loadRegistry();
    } catch (e) {
      alert('Error registering camera: ' + e.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Registry Top Header */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Camera Registry
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                {cameras.length} Active Feeds
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Departmental stream catalogue and GIS surveillance metadata
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-2 border border-slate-700"
          >
            <Plus className="w-4 h-4" />
            <span>Register Camera</span>
          </button>
          <button
            onClick={handleSyncFromSentinel}
            disabled={syncing}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Gateway'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncResult && (
        <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-blue-300">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Synced {syncResult.total_discovered} cameras ({syncResult.created} created, {syncResult.updated} updated) from gateway catalogue.
            </span>
          </div>
          <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cameras Table */}
      <div className="glass-panel overflow-hidden border border-slate-800 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Camera ID & Name</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Coordinates</th>
                <th className="px-5 py-3.5">Capability</th>
                <th className="px-5 py-3.5">Stream Specs</th>
                <th className="px-5 py-3.5">RTSP URL</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cameras.map(cam => (
                <tr key={cam.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="live-beacon"></span>
                      <div>
                        <div className="font-semibold text-slate-200 text-xs">{cam.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{cam.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-medium text-slate-300">
                      {cam.department?.name || 'Central SCCC'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                    {cam.latitude?.toFixed(4)}, {cam.longitude?.toFixed(4)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                      cam.camera_type === 'ANPR' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {cam.camera_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="text-slate-300 font-mono text-[11px]">{cam.resolution}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{cam.codec?.toUpperCase()} · {cam.declared_fps} fps</div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap max-w-xs">
                    <div className="font-mono text-[11px] text-slate-400 truncate bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                      {cam.rtsp_stream_url}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wider font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ONLINE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Camera Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel p-6 shadow-2xl border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wide">
                  Register Camera
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs p-1 rounded hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Camera ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. cam_junction_01"
                    value={newCamId}
                    onChange={(e) => setNewCamId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Camera Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vastrapur Circle East"
                    value={newCamName}
                    onChange={(e) => setNewCamName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Department</label>
                  <select
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Capability</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ANPR">ANPR (Plate Reader)</option>
                    <option value="PTZ">PTZ Surveillance</option>
                    <option value="FIXED_BULLET">Fixed Surveillance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">RTSP Stream URL</label>
                <input
                  type="text"
                  required
                  placeholder="rtsp://host:port/stream/id"
                  value={newRtsp}
                  onChange={(e) => setNewRtsp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
