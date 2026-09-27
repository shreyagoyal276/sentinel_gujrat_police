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
    { id: 'wall', label: 'Video Wall', icon: Video },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount },
    { id: 'tracking', label: 'Vehicle Tracking', icon: Navigation },
    { id: 'watchlist', label: 'Watchlist', icon: Shield },
    { id: 'registry', label: 'Camera Registry', icon: Database }
  ];

  return (
    <header className="glass-header sticky top-0 z-50 px-6 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Gujarat Police Brand Logo & Header */}
        <div className="flex items-center gap-3">
          <img 
            src="/gujarat-police-icon.png" 
            alt="Gujarat Police" 
            className="w-9 h-9 object-contain shrink-0" 
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-wide text-slate-100">
                Gujarat Police
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              CCTV Integration & Intelligence Platform
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#12151b] p-1 rounded-lg border border-[#262c36]">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-maroon-800 text-white border border-maroon-700/70 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1f27]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white text-maroon-900' : 'bg-red-600 text-white'
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
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px]">
            <span className="live-beacon"></span>
            <span className="text-slate-300 font-mono text-[11px]">System Online</span>
          </div>

          <div className="font-mono text-xs text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
            {timeStr}
          </div>

          {onTestTrigger && (
            <button
              onClick={onTestTrigger}
              title="Broadcast test watchlist alert"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/50 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-red-400" />
              <span>Test Alert</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
