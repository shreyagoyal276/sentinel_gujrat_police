import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import GISMap from './components/GISMap';
import VideoWall from './components/VideoWall';
import AlertFeed from './components/AlertFeed';
import VehicleSearch from './components/VehicleSearch';
import WatchlistManager from './components/WatchlistManager';
import CameraRegistry from './components/CameraRegistry';
import { api } from './services/api';
import { ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [alertCount, setAlertCount] = useState(0);
  const [incomingToast, setIncomingToast] = useState(null);

  useEffect(() => {
    // Listen to WebSocket for banner notifications across all tabs
    try {
      const wsUrl = api.getAlertsWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const alert = JSON.parse(e.data);
          setIncomingToast(alert);
          setAlertCount(prev => prev + 1);
          setTimeout(() => setIncomingToast(null), 7000);
        } catch (err) {
          //
        }
      };
      return () => ws.close();
    } catch (e) {
      //
    }
  }, []);

  const handleTestAlertTrigger = async () => {
    try {
      const res = await api.testTriggerAlert("GJ01AB1234", "CRITICAL");
      setIncomingToast(res.payload);
      setAlertCount(prev => prev + 1);
      setTimeout(() => setIncomingToast(null), 7000);
    } catch (e) {
      console.error('Test trigger failed:', e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Tactical Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alertCount}
        onTestTrigger={handleTestAlertTrigger}
      />

      {/* Floating Real-Time Incident Toast */}
      {incomingToast && (
        <div className="fixed top-18 right-6 z-50 max-w-md glass-panel p-4 shadow-2xl border-red-500 animate-bounce">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-red-400 uppercase tracking-wide">
                  🚨 REAL-TIME WATCHLIST MATCH
                </span>
                <button
                  onClick={() => setIncomingToast(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="license-plate-tag text-xs">
                {incomingToast.plate_text}
              </div>
              <div className="text-xs font-semibold text-slate-200">
                {incomingToast.reason || 'Flagged Target'}
              </div>
              <div className="text-[11px] text-slate-400">
                Camera: <span className="text-cyan-300 font-medium">{incomingToast.camera_name || incomingToast.camera_id}</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-end gap-2">
            <button
              onClick={() => {
                setActiveTab('alerts');
                setIncomingToast(null);
              }}
              className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              View In Alert Center
            </button>
          </div>
        </div>
      )}

      {/* Active Tab View */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'map' && <GISMap onSelectCamera={(cam) => {}} />}
        {activeTab === 'wall' && <VideoWall />}
        {activeTab === 'alerts' && <AlertFeed onAlertCountChange={setAlertCount} />}
        {activeTab === 'tracking' && <VehicleSearch />}
        {activeTab === 'watchlist' && <WatchlistManager />}
        {activeTab === 'registry' && <CameraRegistry />}
      </main>
    </div>
  );
}
