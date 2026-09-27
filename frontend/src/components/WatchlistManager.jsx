import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Search, Car, AlertTriangle, FileText, CheckCircle2, X } from 'lucide-react';
import { api } from '../services/api';

export default function WatchlistManager() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newPlate, setNewPlate] = useState('');
  const [newPriority, setNewPriority] = useState('CRITICAL');
  const [newCategory, setNewCategory] = useState('STOLEN');
  const [newReason, setNewReason] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newMakeModel, setNewMakeModel] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newFir, setNewFir] = useState('');
  const [newStation, setNewStation] = useState('');

  useEffect(() => {
    loadWatchlist();
  }, [filterCategory]);

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const cat = filterCategory === 'ALL' ? null : filterCategory;
      const data = await api.getWatchlist(cat);
      setWatchlist(data || []);
    } catch (e) {
      console.error('Error fetching watchlist:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Are you sure you want to deactivate this watchlist target?')) return;
    try {
      await api.deactivateWatchlistPlate(id);
      loadWatchlist();
    } catch (e) {
      console.error('Deactivate failed:', e);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newPlate || !newReason) return;

    try {
      await api.addWatchlistPlate({
        plate_text: newPlate,
        priority: newPriority,
        category: newCategory,
        reason: newReason,
        owner_name: newOwner,
        vehicle_make_model: newMakeModel,
        color: newColor,
        fir_number: newFir,
        police_station: newStation,
        is_active: true
      });

      setShowAddModal(false);
      setNewPlate('');
      setNewReason('');
      setNewOwner('');
      setNewMakeModel('');
      setNewColor('');
      setNewFir('');
      setNewStation('');
      loadWatchlist();
    } catch (err) {
      alert('Failed to add target: ' + (err.message || 'Plate may already exist'));
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Targets' },
    { id: 'STOLEN', label: 'Stolen Vehicles' },
    { id: 'WANTED_SUSPECT', label: 'Wanted Suspects' },
    { id: 'HIT_AND_RUN', label: 'Hit & Run' },
    { id: 'HIGH_SECURITY_ALERT', label: 'High Security' }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-maroon-950 border border-maroon-800/60 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-maroon-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
              Watchlist Registry
            </h2>
            <p className="text-xs text-slate-400">
              Active targets monitored across live CCTV ANPR detections
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 border border-maroon-700/80 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target Vehicle</span>
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCategory(c.id)}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-all ${
              filterCategory === c.id
                ? 'bg-maroon-800 text-white font-semibold border border-maroon-700/80 shadow-sm'
                : 'bg-[#0d0f14] border border-[#262c36] text-slate-400 hover:text-slate-200 hover:bg-[#181c24]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Targets Table */}
      <div className="glass-panel overflow-hidden border border-slate-800 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Registration Plate</th>
                <th className="px-5 py-3.5">Priority / Category</th>
                <th className="px-5 py-3.5">Case Rationale</th>
                <th className="px-5 py-3.5">FIR & Station</th>
                <th className="px-5 py-3.5">Vehicle Details</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {watchlist.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-500 text-xs">
                    No watchlist records found for the selected category.
                  </td>
                </tr>
              ) : (
                watchlist.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="license-plate-tag">
                        {item.plate_text}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          item.priority === 'CRITICAL' ? 'bg-red-950/60 border border-red-600/50 text-red-300' : 'bg-amber-950/60 border border-amber-600/50 text-amber-300'
                        }`}>
                          {item.priority}
                        </span>
                        <div className="text-[11px] text-slate-400">{item.category}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="text-slate-200 font-medium line-clamp-2">{item.reason}</div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-400">
                      {item.fir_number ? (
                        <div>
                          <div className="text-amber-300 font-mono font-medium">{item.fir_number}</div>
                          <div className="text-[11px] text-slate-500">{item.police_station}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600">None</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-300">
                      <div>{item.vehicle_make_model || 'Unspecified'}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.owner_name ? `Owner: ${item.owner_name}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeactivate(item.id)}
                        title="Deactivate target"
                        className="p-1.5 rounded bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel p-6 shadow-2xl border-[#3a4150] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-maroon-400" />
                <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wide">
                  Add Target Vehicle
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs p-1 rounded hover:bg-[#1a1f28] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Plate Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ01AB1234"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                    className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 font-mono tracking-wider focus:outline-none focus:border-maroon-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                >
                  <option value="STOLEN">STOLEN VEHICLE</option>
                  <option value="WANTED_SUSPECT">WANTED SUSPECT</option>
                  <option value="HIT_AND_RUN">HIT & RUN INCIDENT</option>
                  <option value="E_CHALLAN_DEFAULT">E-CHALLAN DEFAULTER</option>
                  <option value="HIGH_SECURITY_ALERT">HIGH SECURITY ALERT</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">Case Rationale / Reason *</label>
                <textarea
                  required
                  rows="2"
                  placeholder="Describe reason for flagging this vehicle..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">FIR Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 142/2026"
                    value={newFir}
                    onChange={(e) => setNewFir(e.target.value)}
                    className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Police Station</label>
                  <input
                    type="text"
                    placeholder="e.g. Vastrapur PS"
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Make / Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Hyundai Creta White"
                    value={newMakeModel}
                    onChange={(e) => setNewMakeModel(e.target.value)}
                    className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Registered Owner</label>
                  <input
                    type="text"
                    placeholder="Owner Name"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full bg-[#0d0f14] border border-[#2a2f3a] rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-maroon-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-md bg-[#1c2028] hover:bg-[#252b36] text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-maroon-800 hover:bg-maroon-700 text-white font-semibold border border-maroon-700/80 transition-colors"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
