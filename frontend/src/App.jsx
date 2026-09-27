import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import GISMap from './components/GISMap';
import VideoWall from './components/VideoWall';
import AlertFeed from './components/AlertFeed';
import VehicleSearch from './components/VehicleSearch';
import WatchlistManager from './components/WatchlistManager';
import CameraRegistry from './components/CameraRegistry';
import { api } from './services/api';
import { ShieldAlert, X } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-[#0b0c0e] text-slate-100 font-sans selection:bg-maroon-800 selection:text-white">
      {/* Tactical Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alertCount}
        onTestTrigger={handleTestAlertTrigger}
      />

      {/* Floating Real-Time Incident Toast */}
      {incomingToast && (
        <div className="fixed top-16 right-6 z-50 max-w-md glass-panel p-4 shadow-xl border border-red-800/60 bg-[#13161c]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-red-400 uppercase tracking-wider">
                  Watchlist Match Detected
                </span>
                <button
                  onClick={() => setIncomingToast(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="license-plate-tag text-xs">
                {incomingToast.plate_text}
              </div>
              <div className="text-xs text-slate-200 font-medium">
                {incomingToast.reason || 'Flagged Target'}
              </div>
              <div className="text-[11px] text-slate-400">
                Camera: <span className="text-slate-300 font-medium">{incomingToast.camera_name || incomingToast.camera_id}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#262c36] flex justify-end">
            <button
              onClick={() => {
                setActiveTab('alerts');
                setIncomingToast(null);
              }}
              className="text-xs px-3 py-1.5 rounded-md bg-maroon-800 hover:bg-maroon-700 text-white font-medium transition-colors"
            >
              View In Alerts
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
