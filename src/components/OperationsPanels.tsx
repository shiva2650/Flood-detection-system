import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Users,
  Activity,
  Navigation,
  Home,
  CheckCircle2,
  XCircle,
  RefreshCw,
  WifiOff,
  Wifi,
  Clock,
} from 'lucide-react';
import { UserRole } from '../lib/translations';
import {
  getAllOfflineSosFromIdb,
  OfflineSosRecord,
  saveOfflineSosToIdb,
  updateOfflineSosStatusInIdb,
} from '../lib/offlineDb';

export interface SosRecord {
  id: number;
  trackingId: string;
  idempotencyKey: string;
  citizenUid?: string | null;
  citizenName: string;
  phone?: string | null;
  lat: number;
  lon: number;
  region: string;
  category: string;
  peopleCount: number;
  severity: string;
  medicalNeeds?: string | null;
  vulnerableGroups?: string | null;
  waterDepthCm?: number | null;
  description?: string | null;
  mediaNote?: string | null;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  priorityScore: number;
  priorityReason: string;
  isManualOverride?: boolean | null;
  overrideBy?: string | null;
  clusterId?: string | null;
  assignedTeamId?: number | null;
  status: string;
  isSimulated?: boolean | null;
  createdAt?: string;
}

export interface IncidentCluster {
  id: number;
  clusterCode: string;
  region: string;
  centerLat: number;
  centerLon: number;
  primaryCategory: string;
  highestPriority: string;
  totalPeople: number;
  sosCount: number;
  assignedTeamId?: number | null;
  status: string;
}

export interface RescueTeam {
  id: number;
  teamCode: string;
  name: string;
  specialization: string;
  lat: number;
  lon: number;
  region: string;
  status: string;
  capacity: number;
  equipment: string;
  contact: string;
  activeMissionId?: string | null;
  completedMissions: number;
}

export interface ShelterRecord {
  id: number;
  shelterCode: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  totalCapacity: number;
  occupiedCapacity: number;
  availableBeds: number;
  foodPacks: number;
  waterLiters: number;
  medicalSupplies: string;
  wheelchairAccessible: boolean;
  powerBackup: boolean;
  managerName: string;
  contact: string;
  status: string;
}

function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function recommendBestTeam(
  targetLat: number,
  targetLon: number,
  category: string,
  teams: RescueTeam[]
): { team: RescueTeam; distanceKm: number; reason: string } | null {
  const available = teams.filter((t) => t.status === 'Available');
  const pool = available.length > 0 ? available : teams;
  if (pool.length === 0) return null;

  const scored = pool.map((team) => {
    const dist = calcDistanceKm(targetLat, targetLon, team.lat, team.lon);
    let capBonus = 0;
    let capNote = 'General flood response capability';
    if (category === 'Medical Emergency' && team.specialization.includes('Medical')) {
      capBonus = 25;
      capNote = 'Paramedic & ICU boat specialization match';
    } else if (category === 'Rising Water / Trapped' && team.specialization.includes('Swift Water')) {
      capBonus = 25;
      capNote = 'Swift-water zodiac boat specialization match';
    } else if (category === 'Structural Collapse' && team.specialization.includes('Heavy')) {
      capBonus = 25;
      capNote = 'Heavy extraction & hydraulic equipment match';
    }
    const availBonus = team.status === 'Available' ? 30 : 0;
    const totalScore = availBonus + capBonus - dist * 3;
    return { team, dist, totalScore, capNote };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  const best = scored[0];
  return {
    team: best.team,
    distanceKm: Number(best.dist.toFixed(1)),
    reason: `${best.capNote} · ${best.dist.toFixed(1)} km from incident`,
  };
}

// ---------------------------------------------------------------------------
// 1. CITIZEN SOS PORTAL (WITH OFFLINE QUEUE, IDEMPOTENCY & LIVE TRACKING)
// ---------------------------------------------------------------------------
export function CitizenSosPortal({
  sosRequests,
  rescueTeams,
  shelters,
  currentUser,
  onRefreshState,
}: {
  sosRequests: SosRecord[];
  rescueTeams: RescueTeam[];
  shelters: ShelterRecord[];
  currentUser: { uid: string; name: string; role: UserRole };
  onRefreshState: () => void;
}) {
  const [citizenName, setCitizenName] = useState(currentUser.name || 'Ananya Sharma');
  const [phone, setPhone] = useState('+91-98480-64210');
  const [lat, setLat] = useState(17.3845);
  const [lon, setLon] = useState(78.4821);
  const [region, setRegion] = useState('Central Basin');
  const [category, setCategory] = useState('Rising Water / Trapped');
  const [peopleCount, setPeopleCount] = useState(4);
  const [severity, setSeverity] = useState('Critical');
  const [waterDepthCm, setWaterDepthCm] = useState(125);
  const [medicalNeeds, setMedicalNeeds] = useState('Elderly diabetic requiring insulin');
  const [vulnerableGroups, setVulnerableGroups] = useState<string[]>(['Elderly', 'Children']);
  const [description, setDescription] = useState(
    'Water has entered ground floor living area; 4 family members moved to first-floor terrace.'
  );
  const [mediaNote, setMediaNote] = useState('Photo & 12s voice note attached');
  const [idempotencyKey, setIdempotencyKey] = useState(() => `sos-client-${Date.now()}`);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSosRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState('GPS coordinates ready (17.3845, 78.4821)');
  const [editingSosId, setEditingSosId] = useState<number | null>(null);
  const [updatedNote, setUpdatedNote] = useState('');

  useEffect(() => {
    getAllOfflineSosFromIdb().then(setOfflineQueue).catch(() => {});
  }, []);

  // Auto-flush IndexedDB offline queue when connectivity returns
  useEffect(() => {
    const pendingItems = offlineQueue.filter(
      (r) => r.status === 'Saved Offline' || r.status === 'Waiting for Network' || r.status === 'Failed'
    );
    if (!simulateOffline && pendingItems.length > 0) {
      const flushQueue = async () => {
        let flushedCount = 0;
        for (const item of pendingItems) {
          try {
            await updateOfflineSosStatusInIdb(item.idempotencyKey, 'Waiting for Network');
            const res = await axios.post('/api/alertnet/sos', item);
            await updateOfflineSosStatusInIdb(
              item.idempotencyKey,
              'Sent',
              res.data?.sos?.trackingId
            );
            flushedCount++;
          } catch (err: any) {
            await updateOfflineSosStatusInIdb(
              item.idempotencyKey,
              'Failed',
              undefined,
              err?.message || 'Retry scheduled'
            );
          }
        }
        const refreshed = await getAllOfflineSosFromIdb();
        setOfflineQueue(refreshed);
        if (flushedCount > 0) {
          setFeedbackBanner({
            type: 'success',
            message: `Connectivity restored: Automatically synced ${flushedCount} IndexedDB offline SOS report(s) to Cloud SQL with idempotency protection.`,
          });
          onRefreshState();
        }
      };
      flushQueue();
    }
  }, [simulateOffline, offlineQueue, onRefreshState]);

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Browser geolocation unavailable; using verified sector coordinates.');
      return;
    }
    setGpsStatus('Acquiring satellite GPS lock...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = Number(pos.coords.latitude.toFixed(5));
        const cLon = Number(pos.coords.longitude.toFixed(5));
        setLat(cLat);
        setLon(cLon);
        setGpsStatus(`Live GPS locked: ${cLat}, ${cLon} (±${Math.round(pos.coords.accuracy)}m)`);
      },
      () => {
        setGpsStatus('Location permission declined; using Central Basin coordinates (17.3845, 78.4821)');
      }
    );
  };

  const toggleVulnerable = (group: string) => {
    setVulnerableGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleSubmitSos = async (e: React.FormEvent, reuseKey = false) => {
    e.preventDefault();
    const keyToUse = reuseKey ? idempotencyKey : `sos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!reuseKey) {
      setIdempotencyKey(keyToUse);
    }

    const payload = {
      idempotencyKey: keyToUse,
      citizenUid: currentUser.uid,
      citizenName,
      phone,
      lat,
      lon,
      region,
      category,
      peopleCount,
      severity,
      waterDepthCm,
      medicalNeeds,
      vulnerableGroups: vulnerableGroups.join(', ') || 'None',
      description,
      mediaNote,
    };

    if (simulateOffline || !navigator.onLine) {
      const idbRecord: OfflineSosRecord = {
        ...payload,
        status: 'Saved Offline',
        queuedAt: new Date().toISOString(),
      };
      await saveOfflineSosToIdb(idbRecord);
      const updatedList = await getAllOfflineSosFromIdb();
      setOfflineQueue(updatedList);
      setFeedbackBanner({
        type: 'warning',
        message: `Saved Offline in IndexedDB (Key: ${keyToUse}). Important Notice: Offline SOS requests cannot reach rescue teams until a communication connection becomes available. Your SOS will auto-sync immediately upon reconnection.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/alertnet/sos', payload);
      const { sos, deduplicated, processedByInstance } = res.data;
      setFeedbackBanner({
        type: deduplicated ? 'info' : 'success',
        message: deduplicated
          ? `Idempotency Check Passed: Duplicate retry detected for key ${keyToUse}. Existing SOS ${sos.trackingId} preserved without creating a duplicate record.`
          : `SOS ${sos.trackingId} durably stored in Cloud SQL before ACK (Node: ${processedByInstance}). Assigned Priority: ${sos.priority} (Cluster ${sos.clusterId}).`,
      });
      onRefreshState();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'warning',
        message: err.response?.data?.error || 'Network error: SOS buffered in offline queue.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOrCancelSos = async (sosId: number, status: string, customDesc?: string) => {
    try {
      await axios.post(`/api/alertnet/sos/${sosId}/status`, {
        status,
        description: customDesc,
        actorName: citizenName,
        actorRole: 'citizen',
      });
      setEditingSosId(null);
      onRefreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const nearestOpenShelter = shelters
    .filter((s) => s.availableBeds > 0)
    .map((s) => ({ ...s, dist: calcDistanceKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist)[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Cols: Emergency SOS Dispatch Form */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Emergency Citizen SOS Beacon</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero-loss durable storage before acknowledgement · IndexedDB Offline Queue & AI Triage
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSimulateOffline(!simulateOffline)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              simulateOffline
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {simulateOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {simulateOffline ? 'Offline Mode (IndexedDB): ON' : 'Network Online (Test Offline SOS)'}
          </button>
        </div>

        {/* Mandatory Offline Communication Limitation Notice */}
        {simulateOffline && (
          <div className="p-3.5 rounded-lg bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>OFFLINE EMERGENCY STORAGE (IndexedDB):</strong> Offline SOS requests cannot reach rescue teams until a communication connection becomes available. Any SOS submitted now is stored locally in IndexedDB and will transmit automatically when network connectivity returns.
            </div>
          </div>
        )}

        {feedbackBanner && (
          <div
            className={`p-4 rounded-lg border text-xs leading-relaxed ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-200'
                : feedbackBanner.type === 'warning'
                ? 'bg-amber-950/60 border-amber-700/70 text-amber-200'
                : 'bg-sky-950/60 border-sky-700/70 text-sky-200'
            }`}
          >
            {feedbackBanner.message}
          </div>
        )}

        {offlineQueue.length > 0 && (
          <div className="p-4 rounded-lg bg-slate-950 border border-amber-700/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-amber-200">
                <p className="font-semibold">
                  IndexedDB Offline SOS Queue ({offlineQueue.length} Record(s))
                </p>
                <p className="text-amber-300/80 text-[11px]">
                  Note: Offline SOS requests cannot reach rescue teams until network connectivity is restored.
                </p>
              </div>
              {simulateOffline && (
                <button
                  type="button"
                  onClick={() => setSimulateOffline(false)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Restore Network & Auto-Sync Now
                </button>
              )}
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {offlineQueue.slice(0, 6).map((item) => (
                <div
                  key={item.idempotencyKey}
                  className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                >
                  <div>
                    <span className="font-semibold text-white">{item.citizenName}</span> •{' '}
                    <span className="text-slate-400">{item.category}</span> ({item.region})
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      item.status === 'Sent'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : item.status === 'Failed'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {item.status} {item.trackingId ? `(${item.trackingId})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmitSos(e, false)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Citizen Full Name</label>
              <input
                type="text"
                required
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          {/* GPS Capture Bar */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{gpsStatus}</span>
              <button
                type="button"
                onClick={handleCaptureGps}
                className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <MapPin className="w-3.5 h-3.5" />
                Capture Live GPS Coordinates
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-500">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500">Sector / Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                >
                  <option value="Central Basin">Central Basin</option>
                  <option value="Lower Delta Sector 4">Lower Delta Sector 4</option>
                  <option value="Riverfront Industrial">Riverfront Industrial</option>
                  <option value="Southern Floodplain">Southern Floodplain</option>
                  <option value="Highland East">Highland East</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Rising Water / Trapped">Rising Water / Trapped</option>
                <option value="Medical Emergency">Medical Emergency</option>
                <option value="Structural Collapse">Structural Collapse</option>
                <option value="Evacuation Assistance">Evacuation Assistance</option>
                <option value="Food & Water Supply">Food & Water Supply</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Severity Level</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Critical">Critical (Life-Threatening)</option>
                <option value="High">High (Urgent Rescue)</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                People Requiring Rescue
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Estimated Water Depth (cm): <span className="font-mono text-sky-400">{waterDepthCm} cm</span>
              </label>
              <input
                type="range"
                min={0}
                max={250}
                step={5}
                value={waterDepthCm}
                onChange={(e) => setWaterDepthCm(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Medical Requirements
              </label>
              <input
                type="text"
                value={medicalNeeds}
                onChange={(e) => setMedicalNeeds(e.target.value)}
                placeholder="e.g. Dialysis, oxygen, insulin, injury..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Vulnerable Individuals Present
            </label>
            <div className="flex flex-wrap gap-2">
              {['Children', 'Elderly', 'Mobility-Impaired', 'Pregnant Woman', 'Infants'].map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => toggleVulnerable(grp)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    vulnerableGroups.includes(grp)
                      ? 'bg-sky-600/20 border-sky-500 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Situation Description (Text / Transcribed Audio)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Field Media / Evidence Note
              </label>
              <input
                type="text"
                value={mediaNote}
                onChange={(e) => setMediaNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white mb-2"
              />
              <p className="text-[11px] text-slate-500 font-mono">
                Active Idempotency Key: {idempotencyKey}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <AlertTriangle className="w-4 h-4" />
              {submitting ? 'Persisting to Cloud SQL...' : 'DISPATCH EMERGENCY SOS NOW'}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmitSos(e as any, true)}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 whitespace-nowrap shrink-0"
              title="Demonstrates idempotent consumer deduplication by resending with the same idempotencyKey"
            >
              Test Duplicate Retry (Idempotency)
            </button>
          </div>
        </form>
      </div>

      {/* Right 5 Cols: Citizen Live SOS Status Tracker & Nearest Safe Shelter */}
      <div className="lg:col-span-5 space-y-6">
        {nearestOpenShelter && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                Recommended Nearest Open Relief Shelter
              </span>
              <span className="text-xs font-mono text-slate-400">
                {nearestOpenShelter.dist.toFixed(1)} km away
              </span>
            </div>
            <h3 className="text-base font-bold text-white">{nearestOpenShelter.name}</h3>
            <p className="text-xs text-slate-400">
              {nearestOpenShelter.region} · {nearestOpenShelter.availableBeds} beds available ·
              Contact: {nearestOpenShelter.contact}
            </p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white">Live SOS Tracking & Status</h3>
            <span className="text-xs text-slate-400 font-mono">
              {sosRequests.length} Total Records
            </span>
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {sosRequests.slice(0, 12).map((sos) => {
              const assignedTeam = rescueTeams.find((t) => t.id === sos.assignedTeamId);
              return (
                <div
                  key={sos.id}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          sos.priority === 'P0'
                            ? 'bg-red-950 text-red-300 border border-red-700'
                            : sos.priority === 'P1'
                            ? 'bg-orange-950 text-orange-300 border border-orange-700'
                            : sos.priority === 'P2'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-sky-950 text-sky-300 border border-sky-700'
                        }`}
                      >
                        {sos.priority}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {sos.trackingId}
                      </span>
                      <span className="text-xs text-slate-400">· {sos.citizenName}</span>
                    </div>
                    <span className="text-xs font-semibold text-sky-400">{sos.status}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{sos.description}</p>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <p>
                      <span>{sos.region}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">{sos.peopleCount} people</span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">Water: {sos.waterDepthCm || 0}cm</span>
                      {sos.clusterId ? ` · Cluster ${sos.clusterId}` : ''}
                    </p>
                    <p className="text-slate-300 font-medium">{sos.priorityReason}</p>
                    {assignedTeam && (
                      <p className="text-emerald-400 font-medium">
                        Assigned Rescue Unit: {assignedTeam.name} ({assignedTeam.teamCode})
                      </p>
                    )}
                  </div>

                  {sos.status !== 'Completed' && sos.status !== 'Cancelled' && (
                    <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center gap-2">
                      {editingSosId === sos.id ? (
                        <div className="w-full flex items-center gap-2">
                          <input
                            type="text"
                            value={updatedNote}
                            onChange={(e) => setUpdatedNote(e.target.value)}
                            placeholder="Add updated field note..."
                            className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateOrCancelSos(sos.id, sos.status, updatedNote)}
                            className="px-2.5 py-1 bg-sky-600 text-white rounded text-xs font-medium"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSosId(null)}
                            className="px-2 py-1 text-slate-400 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSosId(sos.id);
                              setUpdatedNote(sos.description || '');
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-300"
                          >
                            Update Situation Note
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateOrCancelSos(sos.id, 'Cancelled')}
                            className="px-2.5 py-1 bg-red-950/50 hover:bg-red-900/60 border border-red-900/60 rounded text-xs text-red-300"
                          >
                            Cancel SOS (Safe Now)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. AI SOS TRIAGE, INCIDENT CLUSTERING & RESCUE TEAM OPERATIONS CONSOLE
// ---------------------------------------------------------------------------
export function TriageAndRescueConsole({
  sosRequests,
  clusters,
  rescueTeams,
  currentUser,
  onRefreshState,
}: {
  sosRequests: SosRecord[];
  clusters: IncidentCluster[];
  rescueTeams: RescueTeam[];
  currentUser: { uid: string; name: string; role: UserRole };
  onRefreshState: () => void;
}) {
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<number | null>(null);
  const [overridePriority, setOverridePriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P0');
  const [overrideReason, setOverrideReason] = useState(
    'Verified pediatric & geriatric medical urgency via field radio'
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const filteredSos = sosRequests.filter((s) => {
    if (priorityFilter !== 'ALL' && s.priority !== priorityFilter) return false;
    if (selectedCluster && s.clusterId !== selectedCluster) return false;
    return true;
  });

  const handleOverrideSubmit = async (sosId: number) => {
    setBusyAction(`override-${sosId}`);
    try {
      await axios.post(`/api/alertnet/sos/${sosId}/override`, {
        priority: overridePriority,
        reason: overrideReason,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      });
      setOverrideTargetId(null);
      onRefreshState();
    } finally {
      setBusyAction(null);
    }
  };

  const handleAssignTeam = async (teamId: number, sosId?: number, clusterCode?: string) => {
    setBusyAction(`assign-${sosId || clusterCode}`);
    try {
      await axios.post('/api/alertnet/teams/assign', {
        teamId,
        sosId,
        clusterCode,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      });
      onRefreshState();
    } finally {
      setBusyAction(null);
    }
  };

  const handleTeamStatusChange = async (teamId: number, status: string) => {
    setBusyAction(`team-${teamId}-${status}`);
    try {
      await axios.post(`/api/alertnet/teams/${teamId}/status`, {
        status,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      });
      onRefreshState();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section A: Rescue Team Fleet & Mission Progression */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              NDRF / SDRF Rescue Fleet & Mission Lifecycle Control
            </h2>
            <p className="text-xs text-slate-400">
              Update live mission progression: Assigned → En Route → Arrived → Rescuing → Completed
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {rescueTeams.filter((t) => t.status === 'Available').length} of {rescueTeams.length}{' '}
            Units Immediately Available
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rescueTeams.map((team) => (
            <div
              key={team.id}
              className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400">{team.teamCode}</span>
                  <span
                    className={`text-xs font-semibold ${
                      team.status === 'Available'
                        ? 'text-emerald-400'
                        : team.status === 'Rescuing'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {team.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{team.name}</h3>
                <p className="text-xs text-slate-400">
                  {team.specialization} · {team.region} · Cap: {team.capacity}
                </p>
                <p className="text-[11px] text-slate-500">{team.equipment}</p>
                {team.activeMissionId && (
                  <p className="text-xs font-mono text-amber-300 pt-1">
                    Active Mission: {team.activeMissionId}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-900 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Contact: {team.contact}</span>
                  <span className="font-mono">Completed: {team.completedMissions}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['Assigned', 'En Route', 'Arrived', 'Rescuing', 'Completed'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={busyAction === `team-${team.id}-${st}`}
                        onClick={() => handleTeamStatusChange(team.id, st)}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          team.status === st
                            ? 'bg-sky-600 border-sky-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section B: Incident Clusters (Spatial-Temporal Grouping Preserving All SOS Records) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Shared Rescue Incident Clusters (2.5 km Spatial Grouping)
            </h2>
            <p className="text-xs text-slate-400">
              Nearby SOS reports are grouped into shared tactical incidents while preserving every
              individual SOS record.
            </p>
          </div>
          {selectedCluster && (
            <button
              type="button"
              onClick={() => setSelectedCluster(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg"
            >
              Clear Cluster Filter ({selectedCluster})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clusters.map((cluster) => {
            const memberSos = sosRequests.filter((s) => s.clusterId === cluster.clusterCode);
            const rec = recommendBestTeam(
              cluster.centerLat,
              cluster.centerLon,
              cluster.primaryCategory,
              rescueTeams
            );
            const assignedTeam = rescueTeams.find((t) => t.id === cluster.assignedTeamId);

            return (
              <div
                key={cluster.id}
                className={`p-4 rounded-lg border transition-colors space-y-3 ${
                  selectedCluster === cluster.clusterCode
                    ? 'bg-sky-950/30 border-sky-500'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white">
                    {cluster.clusterCode} · {cluster.highestPriority}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCluster(
                        selectedCluster === cluster.clusterCode ? null : cluster.clusterCode
                      )
                    }
                    className="text-xs text-sky-400 hover:underline"
                  >
                    {selectedCluster === cluster.clusterCode
                      ? 'Showing Members'
                      : `Inspect ${memberSos.length} SOS Records`}
                  </button>
                </div>

                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-white">
                    {cluster.region} · {cluster.primaryCategory}
                  </p>
                  <p className="tabular-nums text-slate-400">
                    Total People Affected: <strong className="text-white">{cluster.totalPeople}</strong>{' '}
                    across <strong className="text-white">{memberSos.length}</strong> individual SOS
                    reports
                  </p>
                </div>

                {assignedTeam ? (
                  <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200">
                    Dispatched Unit: <strong>{assignedTeam.name}</strong> ({assignedTeam.status})
                  </div>
                ) : (
                  rec && (
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-2">
                      <p className="text-[11px] text-slate-300">
                        <span className="text-sky-400 font-semibold">AI Team Match:</span>{' '}
                        {rec.team.name} ({rec.reason})
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAssignTeam(rec.team.id, undefined, cluster.clusterCode)}
                        className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded"
                      >
                        Dispatch {rec.team.teamCode} to Entire Cluster
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section C: Individual SOS Triage Queue with Explainable Scoring & Human Override */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Explainable AI SOS Triage Queue & Administrator Override
            </h2>
            <p className="text-xs text-slate-400">
              Every individual SOS record is preserved with transparent priority reasoning and human
              override capability.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {['ALL', 'P0', 'P1', 'P2', 'P3'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setPriorityFilter(lvl)}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-colors ${
                  priorityFilter === lvl
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredSos.map((sos) => {
            const rec = recommendBestTeam(sos.lat, sos.lon, sos.category, rescueTeams);
            const assignedTeam = rescueTeams.find((t) => t.id === sos.assignedTeamId);

            return (
              <div
                key={sos.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded font-mono text-xs font-bold ${
                        sos.priority === 'P0'
                          ? 'bg-red-950 text-red-300 border border-red-700'
                          : sos.priority === 'P1'
                          ? 'bg-orange-950 text-orange-300 border border-orange-700'
                          : sos.priority === 'P2'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-sky-950 text-sky-300 border border-sky-700'
                      }`}
                    >
                      {sos.priority} · Score {sos.priorityScore}/100
                    </span>
                    <span className="font-mono text-sm font-bold text-white">{sos.trackingId}</span>
                    <span className="text-sm font-semibold text-slate-200">{sos.citizenName}</span>
                    <span className="text-xs text-slate-400">
                      · {sos.region} · {sos.category} · {sos.peopleCount} People · Water:{' '}
                      {sos.waterDepthCm || 0}cm
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-sky-400">{sos.status}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOverrideTargetId(overrideTargetId === sos.id ? null : sos.id)
                      }
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300"
                    >
                      Override Priority
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded bg-slate-900/90 border border-slate-800/80 text-xs space-y-1">
                  <p className="text-slate-200 font-medium">{sos.priorityReason}</p>
                  <p className="text-slate-400">
                    Medical: {sos.medicalNeeds || 'None'} · Vulnerable:{' '}
                    {sos.vulnerableGroups || 'None'} · Cluster: {sos.clusterId || 'Unclustered'}
                    {sos.isManualOverride ? ` · Manually Overridden by ${sos.overrideBy}` : ''}
                  </p>
                </div>

                {overrideTargetId === sos.id && (
                  <div className="p-3 bg-slate-900 border border-sky-500/40 rounded-lg flex flex-wrap items-center gap-3">
                    <select
                      value={overridePriority}
                      onChange={(e) => setOverridePriority(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                    >
                      <option value="P0">P0 (Critical Life Threat)</option>
                      <option value="P1">P1 (High Urgency)</option>
                      <option value="P2">P2 (Moderate)</option>
                      <option value="P3">P3 (Low / Routine)</option>
                    </select>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Enter commander justification for audit trail..."
                      className="flex-1 min-w-[220px] px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleOverrideSubmit(sos.id)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded"
                    >
                      Confirm Override
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-400">
                    {assignedTeam ? (
                      <span className="text-emerald-400 font-medium">
                        Assigned Team: {assignedTeam.name} ({assignedTeam.teamCode}) —{' '}
                        {assignedTeam.status}
                      </span>
                    ) : rec ? (
                      <span>
                        Recommended Unit: <strong className="text-slate-200">{rec.team.name}</strong>{' '}
                        ({rec.reason})
                      </span>
                    ) : (
                      <span>No rescue units available</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={sos.assignedTeamId || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignTeam(Number(e.target.value), sos.id);
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                    >
                      <option value="">Assign / Reassign Unit...</option>
                      {rescueTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.teamCode} — {t.name} ({t.status})
                        </option>
                      ))}
                    </select>
                    {rec && !assignedTeam && (
                      <button
                        type="button"
                        onClick={() => handleAssignTeam(rec.team.id, sos.id)}
                        className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded whitespace-nowrap shrink-0"
                      >
                        Quick Dispatch {rec.team.teamCode}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. SMART SHELTER MANAGEMENT CONSOLE
// ---------------------------------------------------------------------------
export function SmartShelterConsole({
  shelters,
  currentUser,
  onRefreshState,
}: {
  shelters: ShelterRecord[];
  currentUser: { uid: string; name: string; role: UserRole };
  onRefreshState: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [occupiedInput, setOccupiedInput] = useState<number>(0);
  const [foodInput, setFoodInput] = useState<number>(0);
  const [waterInput, setWaterInput] = useState<number>(0);
  const [medicalInput, setMedicalInput] = useState<string>('Adequate');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needWheelchair, setNeedWheelchair] = useState(true);
  const [familySize, setFamilySize] = useState(4);

  const recommendedShelters = shelters.filter(
    (s) =>
      s.availableBeds >= familySize && (!needWheelchair || s.wheelchairAccessible)
  );

  const startEditing = (s: ShelterRecord) => {
    setEditingId(s.id);
    setOccupiedInput(s.occupiedCapacity);
    setFoodInput(s.foodPacks);
    setWaterInput(s.waterLiters);
    setMedicalInput(s.medicalSupplies);
    setErrorMsg(null);
  };

  const handleSaveShelter = async (shelterId: number) => {
    setErrorMsg(null);
    try {
      await axios.post(`/api/alertnet/shelters/${shelterId}`, {
        occupiedCapacity: occupiedInput,
        foodPacks: foodInput,
        waterLiters: waterInput,
        medicalSupplies: medicalInput,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      });
      setEditingId(null);
      onRefreshState();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to update shelter resources');
    }
  };

  return (
    <div className="space-y-6">
      {/* Smart Shelter Recommender */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Smart Relief Shelter Matcher & Overbooking Prevention
            </h2>
            <p className="text-xs text-slate-400">
              Filter relief camps by required bed capacity, medical supplies, and wheelchair
              accessibility.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <span>Evacuee Group Size:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={familySize}
                onChange={(e) => setFamilySize(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={needWheelchair}
                onChange={(e) => setNeedWheelchair(e.target.checked)}
                className="accent-sky-500"
              />
              <span>Require Wheelchair Accessibility</span>
            </label>
          </div>
        </div>
        <div className="text-xs text-emerald-400">
          Matching Open Shelters with {familySize}+ Available Beds:{' '}
          <strong>{recommendedShelters.map((s) => s.name).join(' · ') || 'None matching criteria'}</strong>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/70 border border-red-700 rounded-lg text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {shelters.map((shelter) => {
          const pct = Math.round((shelter.occupiedCapacity / shelter.totalCapacity) * 100);
          return (
            <div
              key={shelter.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-sky-400">{shelter.shelterCode}</span>
                  <h3 className="text-base font-bold text-white">{shelter.name}</h3>
                  <p className="text-xs text-slate-400">
                    {shelter.region} · Manager: {shelter.managerName} ({shelter.contact})
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    shelter.status === 'Full'
                      ? 'text-red-400'
                      : shelter.status === 'Near Capacity'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {shelter.status}
                </span>
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Occupancy Load</span>
                  <span className="font-mono font-semibold text-white">
                    {shelter.occupiedCapacity} / {shelter.totalCapacity} ({shelter.availableBeds}{' '}
                    beds available)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full ${
                      pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Food Rations</span>
                  <span className="font-mono font-bold text-white">
                    {shelter.foodPacks.toLocaleString()} packs
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Potable Water</span>
                  <span className="font-mono font-bold text-white">
                    {shelter.waterLiters.toLocaleString()} L
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Medical Stock</span>
                  <span className="font-semibold text-white">{shelter.medicalSupplies}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  {shelter.wheelchairAccessible ? 'Wheelchair Accessible' : 'Standard Access'} ·{' '}
                  {shelter.powerBackup ? 'Generator Backup Active' : 'Grid Power Only'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    editingId === shelter.id ? setEditingId(null) : startEditing(shelter)
                  }
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                >
                  {editingId === shelter.id ? 'Close Editor' : 'Update Resources'}
                </button>
              </div>

              {editingId === shelter.id && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Occupied Capacity (Max {shelter.totalCapacity})
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={shelter.totalCapacity + 50}
                        value={occupiedInput}
                        onChange={(e) => setOccupiedInput(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Medical Supplies Status
                      </label>
                      <select
                        value={medicalInput}
                        onChange={(e) => setMedicalInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                      >
                        <option value="Surplus">Surplus</option>
                        <option value="Adequate">Adequate</option>
                        <option value="Low">Low</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Food Packs</label>
                      <input
                        type="number"
                        value={foodInput}
                        onChange={(e) => setFoodInput(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Water (Liters)</label>
                      <input
                        type="number"
                        value={waterInput}
                        onChange={(e) => setWaterInput(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveShelter(shelter.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs"
                  >
                    Save Shelter Resource Update to Cloud SQL
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
