import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, ShieldAlert, CheckCircle, Car, Clock, MapPin, 
  Send, Volume2, VolumeX, Filter, Eye, CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

export default function AlertFeed({ onAlertCountChange, onViewOnMap }) {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    loadAlerts();
    loadStats();
    setupWebSocket();

    return () => {
      // Cleanup WS if needed
    };
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data || []);
      if (onAlertCountChange) {
        const newCount = (data || []).filter(a => a.status === 'NEW').length;
        onAlertCountChange(newCount);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    }
  };

  const loadStats = async () => {
    try {
      const s = await api.getAlertsStats();
      setStats(s);
    } catch (e) {
      // Optional
    }
  };

  const setupWebSocket = () => {
    try {
      const wsUrl = api.getAlertsWebSocketUrl();
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const newAlert = JSON.parse(event.data);
          if (soundEnabled && newAlert.priority === 'CRITICAL') {
            playAlertSound();
          }

          setAlerts(prev => {
            const exists = prev.some(a => a.id === newAlert.alert_id || a.id === newAlert.id);
            if (exists) return prev;
            const updated = [{
              id: newAlert.alert_id || newAlert.id || `live-${Date.now()}`,
              plate_text: newAlert.plate_text,
              camera_id: newAlert.camera_id,
              priority: newAlert.priority || 'HIGH',
              category: newAlert.category || 'STOLEN',
              timestamp: newAlert.timestamp || new Date().toISOString(),
              pts_timestamp: newAlert.pts_timestamp || 0,
              status: newAlert.status || 'NEW',
              watchlist_item: {
                reason: newAlert.reason,
                owner_name: newAlert.owner_name,
                vehicle_make_model: newAlert.vehicle_make_model,
                color: newAlert.color,
                fir_number: newAlert.fir_number,
                police_station: newAlert.police_station
              },
              camera: {
                name: newAlert.camera_name || newAlert.camera_id,
                latitude: newAlert.latitude,
                longitude: newAlert.longitude
              }
            }, ...prev];

            if (onAlertCountChange) {
              const newCount = updated.filter(a => a.status === 'NEW').length;
              onAlertCountChange(newCount);
            }
            return updated;
          });
          loadStats();
        } catch (err) {
          console.error('Error parsing live WS alert:', err);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        setTimeout(setupWebSocket, 3000);
      };

      socket.onerror = (e) => {
        console.warn('Alerts WebSocket error:', e);
      };
    } catch (e) {
      console.error('Failed to open WS:', e);
    }
  };

  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio autoplay restrictions
    }
  };

  const handleTriage = async (alertId, newStatus) => {
    try {
      await api.triageAlert(alertId, newStatus, 'Duty Officer Netram SCCC', 'Triaged via Command Dashboard');
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: newStatus } : a));
      loadStats();
    } catch (e) {
      console.error('Triage error:', e);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterPriority !== 'ALL' && a.priority !== filterPriority) return false;
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Alert Center Header & Stats */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Watchlist Alert Feed
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                wsConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {wsConnected ? 'LIVE FEED ACTIVE' : 'CONNECTING'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated near-real-time correlation against flagged vehicles
            </p>
          </div>
        </div>

        {/* Quick Stats Counter */}
        {stats && (
          <div className="flex items-center gap-3 text-xs">
            <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-center min-w-[90px]">
              <div className="text-[10px] text-red-400 font-medium uppercase tracking-wider">Critical</div>
              <div className="text-lg font-bold font-mono text-red-300">{stats.critical_count}</div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-center min-w-[90px]">
              <div className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">High</div>
              <div className="text-lg font-bold font-mono text-amber-300">{stats.high_count}</div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-center min-w-[90px]">
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pending</div>
              <div className="text-lg font-bold font-mono text-maroon-400">{stats.new_count}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-[#181c24] border-[#2c3340] text-slate-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-maroon-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-medium">{soundEnabled ? 'Chime On' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Priority Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Priority:</span>
          <div className="flex items-center gap-1 bg-[#0d0f14] p-1 rounded-lg border border-[#262c36]">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filterPriority === p
                    ? 'bg-maroon-800 text-white font-semibold border border-maroon-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181c24]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Status:</span>
          <div className="flex items-center gap-1 bg-[#0d0f14] p-1 rounded-lg border border-[#262c36]">
            {['ALL', 'NEW', 'ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filterStatus === st
                    ? 'bg-maroon-800 text-white font-semibold border border-maroon-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181c24]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert Feed Cards */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-400 space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="font-medium text-sm text-slate-200">No Active Alerts In Filter</div>
            <p className="text-xs text-slate-500">Live surveillance streams are clear of targets matching criteria.</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCritical = alert.priority === 'CRITICAL';
            const isNew = alert.status === 'NEW';
            const wItem = alert.watchlist_item || {};

            return (
              <div
                key={alert.id}
                className={`glass-panel p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-all ${
                  isNew && isCritical ? 'border border-red-500/50 bg-red-950/20' : 'hover:border-slate-700'
                }`}
              >
                {/* Left: Plate Badge & Details */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="license-plate-tag">
                      {alert.plate_text}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      isCritical ? 'bg-red-950/60 border border-red-600/50 text-red-300' : 'bg-amber-950/60 border border-amber-600/50 text-amber-300'
                    }`}>
                      {alert.priority}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm">{wItem.reason || 'Watchlist target flagged by ANPR'}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                        {alert.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-maroon-400" />
                        <span className="text-slate-300 font-medium">{alert.camera?.name || alert.camera_id}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false })} IST</span>
                        <span className="font-mono text-slate-400">({alert.pts_timestamp?.toFixed(0)}ms PTS)</span>
                      </span>
                      {wItem.fir_number && (
                        <span className="text-amber-300 font-mono">FIR: {wItem.fir_number} ({wItem.police_station})</span>
                      )}
                    </div>

                    {wItem.vehicle_make_model && (
                      <div className="text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-md border border-slate-800 flex flex-wrap gap-x-4">
                        <span>Vehicle: <strong className="text-slate-200 font-medium">{wItem.vehicle_make_model}</strong></span>
                        <span>Color: <strong className="text-slate-200 font-medium">{wItem.color || 'N/A'}</strong></span>
                        <span>Owner: <strong className="text-slate-200 font-medium">{wItem.owner_name || 'N/A'}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Triage Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800 shrink-0">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider ${
                    alert.status === 'NEW' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    alert.status === 'ACKNOWLEDGED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    alert.status === 'DISPATCHED' ? 'bg-maroon-950 text-maroon-300 border border-maroon-700/60' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {alert.status}
                  </span>

                  {alert.status === 'NEW' && (
                    <button
                      onClick={() => handleTriage(alert.id, 'ACKNOWLEDGED')}
                      className="px-3.5 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}

                  {(alert.status === 'NEW' || alert.status === 'ACKNOWLEDGED') && (
                    <button
                      onClick={() => handleTriage(alert.id, 'DISPATCHED')}
                      className="px-3.5 py-1.5 rounded-md bg-maroon-800 hover:bg-maroon-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-maroon-700/80 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Patrol</span>
                    </button>
                  )}

                  {alert.status === 'DISPATCHED' && (
                    <button
                      onClick={() => handleTriage(alert.id, 'RESOLVED')}
                      className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
