import React, { useState, useEffect } from 'react';
import { 
  Shield, Video, MapPin, Bell, Navigation, Database, Radio, RefreshCw, Zap
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, alertCount = 0, onTestTrigger }) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-IN', { hour12: false }) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'map', label: 'GIS Command Map', icon: MapPin },
    { id: 'wall', label: 'Live Video Wall', icon: Video },
    { id: 'alerts', label: 'Alert Center', icon: Bell, badge: alertCount },
    { id: 'tracking', label: 'Vehicle Route Tracking', icon: Navigation },
    { id: 'watchlist', label: 'Watchlist / BOLO', icon: Shield },
    { id: 'registry', label: 'Camera Registry', icon: Database }
  ];

  return (
    <header className="glass-header sticky top-0 z-50 px-6 py-3 border-b border-slate-800">
      <div className="flex items-center justify-between">
        {/* Gujarat Police Brand Logo & Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40">
            <Shield className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-wider text-slate-100 uppercase">
                Gujarat Police <span className="text-cyan-400">SENTINEL</span>
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                MODEL 1 & 2 HYBRID
              </span>
            </div>
            <p className="text-xs text-slate-400">
              CCTV Integration & Intelligence Platform • સુરક્ષા અને સર્વેલન્સ
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-slate-950 text-cyan-300' : 'bg-red-500 text-white animate-pulse'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Live System Diagnostics & Time */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">
            <span className="live-beacon"></span>
            <span className="text-slate-300 font-mono font-medium">TCP STREAMING</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 font-mono font-medium">PTS TIMING</span>
          </div>

          <div className="text-right font-mono text-xs text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            {timeStr}
          </div>

          {onTestTrigger && (
            <button
              onClick={onTestTrigger}
              title="Broadcast test watchlist alert"
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/80 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-red-400 fill-red-400" />
              <span>Simulate Alert</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
