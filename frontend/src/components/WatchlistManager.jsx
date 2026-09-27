import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Filter, AlertTriangle, CheckCircle, Car } from 'lucide-react';
import { api } from '../services/api';

export default function WatchlistManager() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for adding new watchlist plate
  const [newPlate, setNewPlate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newCategory, setNewCategory] = useState('STOLEN');
  const [newPriority, setNewPriority] = useState('CRITICAL');
  const [newMakeModel, setNewMakeModel] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newFir, setNewFir] = useState('');
  const [newStation, setNewStation] = useState('');

  useEffect(() => {
    loadWatchlist();
  }, [filterCategory]);

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const params = filterCategory !== 'ALL' ? { category: filterCategory } : {};
      const data = await api.getWatchlist(params);
      setWatchlist(data || []);
    } catch (e) {
      console.error('Error loading watchlist:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newPlate || !newReason) return;

    try {
      await api.addWatchlistPlate({
        plate_text: newPlate.toUpperCase().trim(),
        reason: newReason,
        category: newCategory,
        priority: newPriority,
        vehicle_make_model: newMakeModel,
        owner_name: newOwner,
        fir_number: newFir,
        police_station: newStation,
        is_active: true
      });
      setShowAddModal(false);
      // Reset form
      setNewPlate('');
      setNewReason('');
      setNewMakeModel('');
      setNewOwner('');
      setNewFir('');
      setNewStation('');
      loadWatchlist();
    } catch (err) {
      console.error('Error adding watchlist plate:', err);
      alert('Plate already exists or error adding to watchlist');
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this watchlist target?')) return;
    try {
      await api.deleteWatchlistPlate(id);
      loadWatchlist();
    } catch (e) {
      console.error('Error deactivating:', e);
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'STOLEN', label: 'Stolen Vehicles' },
    { id: 'WANTED_SUSPECT', label: 'Wanted Suspects' },
    { id: 'HIT_AND_RUN', label: 'Hit & Run' },
    { id: 'E_CHALLAN_DEFAULT', label: 'E-Challan Defaulters' },
    { id: 'HIGH_SECURITY_ALERT', label: 'Security Alerts' }
  ];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
              Gujarat Police Watchlist & BOLO Registry
            </h2>
            <p className="text-xs text-slate-400">
              Active targets correlated in real-time against live CCTV ANPR detections
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Target Vehicle</span>
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCategory(c.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterCategory === c.id
                ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Targets Table / Grid */}
      <div className="glass-panel overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Registration Plate</th>
                <th className="px-4 py-3">Priority / Category</th>
                <th className="px-4 py-3">Case Rationale</th>
                <th className="px-4 py-3">FIR & Police Station</th>
                <th className="px-4 py-3">Vehicle Details</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {watchlist.map(item => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="license-plate-tag text-xs">
                      {item.plate_text}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        item.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'
                      }`}>
                        {item.priority}
                      </span>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                        {item.category.replace('_', ' ')}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-slate-200 font-medium line-clamp-2">{item.reason}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                    <div className="font-medium text-amber-300">{item.fir_number || 'Under Inquiry'}</div>
                    <div className="text-[11px] text-slate-500">{item.police_station || 'Gujarat Police'}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                    <div>{item.vehicle_make_model || 'Unspecified'}</div>
                    <div className="text-[11px] text-slate-500">Owner: {item.owner_name || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleDeactivate(item.id)}
                      title="Deactivate target"
                      className="p-1.5 rounded bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel p-6 shadow-2xl border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
                  Add Vehicle to Watchlist (BOLO)
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Plate Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ01AB9999"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono tracking-wider focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="STOLEN">STOLEN VEHICLE</option>
                  <option value="WANTED_SUSPECT">WANTED SUSPECT</option>
                  <option value="HIT_AND_RUN">HIT & RUN INCIDENT</option>
                  <option value="E_CHALLAN_DEFAULT">E-CHALLAN DEFAULTER</option>
                  <option value="HIGH_SECURITY_ALERT">HIGH SECURITY ALERT</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Case Rationale / Reason *</label>
                <textarea
                  required
                  rows="2"
                  placeholder="Describe reason for flagging this vehicle..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">FIR Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 142/2026"
                    value={newFir}
                    onChange={(e) => setNewFir(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Police Station</label>
                  <input
                    type="text"
                    placeholder="e.g. Vastrapur PS"
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Vehicle Make / Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Hyundai Creta White"
                    value={newMakeModel}
                    onChange={(e) => setNewMakeModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Registered Owner</label>
                  <input
                    type="text"
                    placeholder="Owner Name"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Register to Watchlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
