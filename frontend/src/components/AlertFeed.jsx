import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, ShieldAlert, CheckCircle, Car, Clock, MapPin, 
  Send, Volume2, VolumeX, Filter, Eye
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
        console.log('Connected to Sentinel Real-Time Alerts WebSocket');
      };

      socket.onmessage = (event) => {
        try {
          const newAlert = JSON.parse(event.data);
          // Play tactical audio chime
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
        // Reconnect after 3s
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
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Alert Center Header & Stats */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                Real-Time Watchlist & BOLO Alert Center
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                wsConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {wsConnected ? 'WEBSOCKET LIVE' : 'CONNECTING...'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated near-real-time correlation with stolen, wanted, and high-security vehicles
            </p>
          </div>
        </div>

        {/* Quick Stats Counter */}
        {stats && (
          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-500/30 text-center">
              <div className="text-[10px] text-red-400 font-semibold uppercase">Critical</div>
              <div className="text-base font-bold font-mono text-red-300">{stats.critical_count}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-center">
              <div className="text-[10px] text-amber-400 font-semibold uppercase">High</div>
              <div className="text-base font-bold font-mono text-amber-300">{stats.high_count}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-center">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Pending Triage</div>
              <div className="text-base font-bold font-mono text-cyan-400">{stats.new_count}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle siren chime"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>Audio {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Priority:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                filterPriority === p
                  ? 'bg-slate-200 text-slate-950'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Status:</span>
          {['ALL', 'NEW', 'ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                filterStatus === s
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Feed Cards */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-400 space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="font-semibold text-sm text-slate-200">No Active Alerts In Current Filter</div>
            <p className="text-xs text-slate-500">All live CCTV surveillance feeds are clear of watchlist targets.</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCritical = alert.priority === 'CRITICAL';
            const isNew = alert.status === 'NEW';
            const wItem = alert.watchlist_item || {};

            return (
              <div
                key={alert.id}
                className={`glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isNew && isCritical ? 'urgent-alert-card' : 'hover:border-slate-700'
                }`}
              >
                {/* Left: Plate Badge & Details */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="license-plate-tag">
                      {alert.plate_text}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      isCritical ? 'badge-critical' : 'badge-high'
                    }`}>
                      {alert.priority} • {alert.category}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{wItem.reason || 'Watchlist target flagged by ANPR'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-300 font-medium">{alert.camera?.name || alert.camera_id}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false })} IST</span>
                        <span className="font-mono text-cyan-400">({alert.pts_timestamp?.toFixed(0)}ms PTS)</span>
                      </span>
                      {wItem.fir_number && (
                        <span className="text-amber-300">FIR: {wItem.fir_number} ({wItem.police_station})</span>
                      )}
                    </div>

                    {wItem.vehicle_make_model && (
                      <div className="text-[11px] text-slate-400">
                        Target Vehicle: <span className="text-slate-200 font-medium">{wItem.vehicle_make_model}</span> • Color: <span className="text-slate-200">{wItem.color || 'N/A'}</span> • Registered to: <span className="text-slate-200">{wItem.owner_name || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Triage Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                  <span className={`px-2 py-1 rounded text-[11px] font-semibold uppercase ${
                    alert.status === 'NEW' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    alert.status === 'ACKNOWLEDGED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    alert.status === 'DISPATCHED' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {alert.status}
                  </span>

                  {alert.status === 'NEW' && (
                    <button
                      onClick={() => handleTriage(alert.id, 'ACKNOWLEDGED')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold"
                    >
                      Acknowledge
                    </button>
                  )}

                  {(alert.status === 'NEW' || alert.status === 'ACKNOWLEDGED') && (
                    <button
                      onClick={() => handleTriage(alert.id, 'DISPATCHED')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-cyan-500/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch PCR Interceptor</span>
                    </button>
                  )}

                  {alert.status === 'DISPATCHED' && (
                    <button
                      onClick={() => handleTriage(alert.id, 'RESOLVED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold"
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
