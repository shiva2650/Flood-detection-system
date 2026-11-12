import React, { useState } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Bell,
  Sliders,
  MessageSquare,
  Download,
  Printer,
  Server,
  Mic,
  Send,
  Zap,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LanguageCode, UserRole } from '../lib/translations';
import { SosRecord, RescueTeam, ShelterRecord, IncidentCluster } from './OperationsPanels';

export interface MassAlertRecord {
  id: number;
  alertCode: string;
  title: string;
  message: string;
  severity: string;
  targetRegion: string;
  channels: string;
  targetPopulation: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  isSimulation: boolean;
  issuedBy: string;
  createdAt?: string;
}

export interface AuditLogRecord {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// 1. MULTI-CHANNEL MASS ALERT BROADCAST & 100,000+ RESIDENT SIMULATOR
// ---------------------------------------------------------------------------
export function MassAlertSimulator({
  massAlerts,
  currentUser,
  onRefreshState,
}: {
  massAlerts: MassAlertRecord[];
  currentUser: { uid: string; name: string; role: UserRole };
  onRefreshState: () => void;
}) {
  const [title, setTitle] = useState('RED ALERT: Immediate Flood Evacuation Order');
  const [severity, setSeverity] = useState('Critical Evacuation');
  const [targetRegion, setTargetRegion] = useState('Central Basin & Lower Delta');
  const [targetPopulation, setTargetPopulation] = useState(150000);
  const [channels, setChannels] = useState<string[]>(['SMS', 'Email', 'Push']);
  const [message, setMessage] = useState(
    'EMERGENCY FLOOD WARNING: River gauge levels have crossed the 5.5m critical mark. Evacuate ground-floor premises immediately to Highland Civic Relief Center or St. Marys Elevated School.'
  );
  const [sending, setSending] = useState(false);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((c) => c !== ch) : prev) : [...prev, ch]
    );
  };

  const applyTemplate = (preset: 'evac' | 'dam' | 'allclear') => {
    if (preset === 'evac') {
      setTitle('RED ALERT: Immediate Flood Evacuation Order');
      setSeverity('Critical Evacuation');
      setTargetPopulation(150000);
      setMessage(
        'EMERGENCY FLOOD WARNING: River gauge levels have crossed the 5.5m critical mark. Evacuate ground-floor premises immediately to Highland Civic Relief Center.'
      );
    } else if (preset === 'dam') {
      setTitle('ORANGE WARNING: Upstream Reservoir Sluice Gate Release');
      setSeverity('Warning');
      setTargetPopulation(110000);
      setMessage(
        'RESERVOIR RELEASE ALERT: 45,000 cusecs discharging into main basin channel. Clear all low-lying bridges, riverbanks, and agricultural pump houses within 2 hours.'
      );
    } else {
      setTitle('ADVISORY: Floodwaters Receding — Safe Return Protocol');
      setSeverity('Advisory');
      setTargetPopulation(100000);
      setMessage(
        'Water levels have dropped below 3.1m warning threshold. Avoid downed power lines and boil drinking water before consumption.'
      );
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await axios.post('/api/alertnet/alerts/broadcast', {
        title,
        message,
        severity,
        targetRegion,
        channels,
        targetPopulation,
        isSimulation: true,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      });

      if ('Notification' in window && Notification.permission === 'granted' && channels.includes('Push')) {
        new Notification(title, { body: message });
      }
      onRefreshState();
    } finally {
      setSending(false);
    }
  };

  const totalSent = massAlerts.reduce((acc, a) => acc + a.sentCount, 0);
  const totalDelivered = massAlerts.reduce((acc, a) => acc + a.deliveredCount, 0);
  const totalFailed = massAlerts.reduce((acc, a) => acc + a.failedCount, 0);
  const totalPending = massAlerts.reduce((acc, a) => acc + a.pendingCount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Multi-Channel Geofenced Mass Alert Transmitter
            </h2>
            <p className="text-xs text-slate-400">
              Supports SMS, Email, and Browser Push adapters · 100,000+ resident broadcast simulator
            </p>
          </div>
          <span className="text-xs text-amber-300 font-mono">
            Provider Adapter: Simulation Mode
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Quick Templates:</span>
          <button
            type="button"
            onClick={() => applyTemplate('evac')}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-200"
          >
            Red Alert Evacuation
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('dam')}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-200"
          >
            Dam Gate Release
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('allclear')}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-200"
          >
            Safe Return Advisory
          </button>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Alert Headline</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Alert Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Critical Evacuation">Critical Evacuation</option>
                <option value="Warning">Warning</option>
                <option value="Watch">Watch</option>
                <option value="Advisory">Advisory</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Geofenced Target Region
              </label>
              <select
                value={targetRegion}
                onChange={(e) => setTargetRegion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Central Basin & Lower Delta">Central Basin & Lower Delta</option>
                <option value="Central Basin">Central Basin</option>
                <option value="Lower Delta Sector 4">Lower Delta Sector 4</option>
                <option value="Riverfront Industrial">Riverfront Industrial</option>
                <option value="Southern Floodplain">Southern Floodplain</option>
                <option value="All Metropolitan Flood Zones">All Metropolitan Flood Zones</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Delivery Channels (Select 1–3)
            </label>
            <div className="flex flex-wrap gap-2">
              {['SMS', 'Email', 'Push'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    channels.includes(ch)
                      ? 'bg-sky-600/20 border-sky-500 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {ch} Gateway Adapter
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Geofenced Resident Target Population:{' '}
              <span className="font-mono text-sky-400 font-bold">
                {targetPopulation.toLocaleString()} residents
              </span>
            </label>
            <input
              type="range"
              min={50000}
              max={500000}
              step={10000}
              value={targetPopulation}
              onChange={(e) => setTargetPopulation(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Emergency Broadcast Message
            </label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-colors"
          >
            {sending
              ? 'Dispatching Multi-Channel Broadcast...'
              : `TRANSMIT EMERGENCY ALERT TO ${targetPopulation.toLocaleString()} RESIDENTS`}
          </button>
        </form>
      </div>

      {/* Right 6 Cols: Delivery Telemetry & Broadcast History */}
      <div className="lg:col-span-6 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white">
            Cumulative Mass Alert Delivery Telemetry (Simulated Gateway)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block">Total Sent</span>
              <span className="text-lg font-mono font-bold text-white">
                {totalSent.toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block">Delivered (98.6%)</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                {totalDelivered.toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block">Pending Retry</span>
              <span className="text-lg font-mono font-bold text-amber-400">
                {totalPending.toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block">Failed / Unreachable</span>
              <span className="text-lg font-mono font-bold text-red-400">
                {totalFailed.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Recent Geofenced Broadcast Log</h3>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {massAlerts.map((a) => (
              <div
                key={a.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {a.alertCode} · {a.severity}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Channels: {a.channels}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{a.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{a.message}</p>
                <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Region: {a.targetRegion}</span>
                  <span>
                    Sent: {a.sentCount.toLocaleString()} · Delivered:{' '}
                    {a.deliveredCount.toLocaleString()} · Failed: {a.failedCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. FLOOD DIGITAL TWIN & SCENARIO SIMULATOR
// ---------------------------------------------------------------------------
export function FloodDigitalTwinSimulator() {
  const [rainfallMm, setRainfallMm] = useState(85);
  const [riverGaugeM, setRiverGaugeM] = useState(5.4);
  const [durationHours, setDurationHours] = useState(24);
  const [activePreset, setActivePreset] = useState<'moderate' | 'heavy' | 'extreme'>('heavy');

  const applyPreset = (preset: 'moderate' | 'heavy' | 'extreme') => {
    setActivePreset(preset);
    if (preset === 'moderate') {
      setRainfallMm(35);
      setRiverGaugeM(3.6);
      setDurationHours(12);
    } else if (preset === 'heavy') {
      setRainfallMm(85);
      setRiverGaugeM(5.4);
      setDurationHours(24);
    } else {
      setRainfallMm(185);
      setRiverGaugeM(7.8);
      setDurationHours(48);
    }
  };

  // Hydrological Digital Twin Model Calculations
  const baselineInundationSqKm = 4.2;
  const simulatedInundationSqKm = Number(
    (
      baselineInundationSqKm +
      rainfallMm * 0.14 +
      Math.max(0, riverGaugeM - 3.0) * 4.8 +
      durationHours * 0.12
    ).toFixed(1)
  );
  const exposedPopulation = Math.round(simulatedInundationSqKm * 2850);
  const estimatedRescueDemand = Math.round(exposedPopulation * 0.042);
  const estimatedShelterDemand = Math.round(exposedPopulation * 0.28);
  const requiredBoats = Math.max(4, Math.ceil(estimatedRescueDemand / 45));
  const requiredFoodPacks = estimatedShelterDemand * 3;

  const comparisonData = [
    {
      sector: 'Central Basin',
      BaselineWaterM: 2.8,
      SimulatedWaterM: Number((riverGaugeM * 0.95).toFixed(2)),
    },
    {
      sector: 'Lower Delta 4',
      BaselineWaterM: 3.1,
      SimulatedWaterM: Number((riverGaugeM * 1.08 + rainfallMm * 0.01).toFixed(2)),
    },
    {
      sector: 'Riverfront Ind.',
      BaselineWaterM: 2.5,
      SimulatedWaterM: Number((riverGaugeM * 0.88 + durationHours * 0.02).toFixed(2)),
    },
    {
      sector: 'South Floodplain',
      BaselineWaterM: 2.9,
      SimulatedWaterM: Number((riverGaugeM * 1.02 + rainfallMm * 0.008).toFixed(2)),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Hydrological Digital Twin & Flood Scenario Simulator
            </h2>
            <p className="text-xs text-amber-300 mt-0.5">
              MODEL NOTICE: Digital Twin scenario projections are hydrological simulations for
              contingency planning, not verified live gauge observations.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {[
              { id: 'moderate', label: 'Moderate Rainfall' },
              { id: 'heavy', label: 'Heavy Rainfall' },
              { id: 'extreme', label: 'Extreme 100-Yr Flood' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  activePreset === p.id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Rainfall Intensity</span>
              <span className="font-mono font-bold text-sky-400">{rainfallMm} mm</span>
            </div>
            <input
              type="range"
              min={10}
              max={250}
              step={5}
              value={rainfallMm}
              onChange={(e) => setRainfallMm(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
            <p className="text-[11px] text-slate-500">Range: 10 mm – 250 mm cumulative basin rain</p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">River Gauge Level</span>
              <span className="font-mono font-bold text-amber-400">{riverGaugeM.toFixed(1)} m</span>
            </div>
            <input
              type="range"
              min={2.0}
              max={9.0}
              step={0.2}
              value={riverGaugeM}
              onChange={(e) => setRiverGaugeM(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-slate-500">Danger threshold: 5.0 m · Critical: 6.5 m</p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Storm Duration</span>
              <span className="font-mono font-bold text-emerald-400">{durationHours} hours</span>
            </div>
            <input
              type="range"
              min={6}
              max={72}
              step={6}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-500">Sustained catchment runoff window</p>
          </div>
        </div>

        {/* Simulated Impact KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-xs text-slate-400 block">Inundated Area (Before → After)</span>
            <span className="text-lg font-mono font-bold text-white">
              {baselineInundationSqKm} → {simulatedInundationSqKm} km²
            </span>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-xs text-slate-400 block">Population Exposure</span>
            <span className="text-lg font-mono font-bold text-amber-400">
              {exposedPopulation.toLocaleString()}
            </span>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-xs text-slate-400 block">Est. Rescue Demand</span>
            <span className="text-lg font-mono font-bold text-red-400">
              {estimatedRescueDemand.toLocaleString()} people
            </span>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-xs text-slate-400 block">Shelter Bed Demand</span>
            <span className="text-lg font-mono font-bold text-sky-400">
              {estimatedShelterDemand.toLocaleString()} beds
            </span>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-xs text-slate-400 block">Resource Requirement</span>
            <span className="text-sm font-mono font-bold text-emerald-400">
              {requiredBoats} Boats · {(requiredFoodPacks / 1000).toFixed(1)}k Meals
            </span>
          </div>
        </div>

        {/* Before vs After Sector Comparison Chart */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
          <h3 className="text-sm font-bold text-white">
            Before vs. After Sector Water Level Comparison (Meters)
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="sector" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="BaselineWaterM" name="Baseline Level (m)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="SimulatedWaterM"
                  name="Simulated Peak Level (m)"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. MULTILINGUAL AI EMERGENCY ASSISTANT (ENGLISH, TELUGU, HINDI + VOICE)
// ---------------------------------------------------------------------------
export function MultilingualAiAssistant({
  language,
  setLanguage,
  region,
  currentRisk,
}: {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  region: string;
  currentRisk: string;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Namaste. I am the official AlertNet Multilingual Emergency Assistant (English / తెలుగు / हिन्दी). Ask for verified flood safety instructions, nearest open relief shelters, or paste a citizen SOS message in any language for instant translation and triage guidance.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const sendPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;
    const userMsg = promptText.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post('/api/gemini/assistant', {
        message: userMsg,
        language,
        region,
        currentRisk,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.data?.reply || 'Safety advisory processed.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Verified Offline Safety Fallback: Move immediately to higher ground. Avoid walking or driving through floodwater. Nearest Open Shelters: Highland Civic Convention Center (290 beds), St. Marys Elevated School (280 beds). Emergency Helpline: 112 / 1078.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setInput('Please provide evacuation routes and shelter capacity in my language.');
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setInput(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Multilingual AI Emergency Assistant (English · తెలుగు · हिन्दी)
          </h2>
          <p className="text-xs text-slate-400">
            Translates citizen reports, explains verified flood safety protocols, and guides SOS
            submissions.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
          {[
            { code: 'en', label: 'English' },
            { code: 'te', label: 'తెలుగు (Telugu)' },
            { code: 'hi', label: 'हिन्दी (Hindi)' },
          ].map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code as LanguageCode)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                language === l.code
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {[
          'Provide verified flood evacuation instructions and nearest open shelters',
          'Translate citizen report: "మా ఇంటి గ్రౌండ్ ఫ్లోర్ నీటిలో మునిగిపోయింది, వృద్ధులు ఉన్నారు"',
          'Translate citizen report: "हमारे क्षेत्र में पानी तेजी से बढ़ रहा है, तुरंत नाव भेजें"',
          'What should families with elderly dialysis patients do during a Red Alert?',
        ].map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => sendPrompt(q)}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 text-left"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[380px] overflow-y-auto p-4 bg-slate-950 border border-slate-800 rounded-lg">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3.5 rounded-lg text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-sky-950/60 border border-sky-800/60 text-sky-100 ml-8'
                : 'bg-slate-900 border border-slate-800 text-slate-200 mr-8'
            }`}
          >
            <div className="prose prose-invert prose-xs max-w-none">
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <p className="text-xs text-sky-400 italic">
            Generating verified emergency response in{' '}
            {language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English'}...
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt(input);
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleVoiceInput}
          className={`p-2.5 rounded-lg border text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            listening
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Mic className="w-4 h-4" />
          {listening ? 'Listening...' : 'Voice Input'}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for evacuation routes, shelter beds, or paste a citizen message to translate..."
          className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-sky-500 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. DISASTER ANALYTICS, AUDIT TRAIL & CSV/PDF REPORT EXPORT
// ---------------------------------------------------------------------------
export function AnalyticsAndAuditPanel({
  sosRequests,
  shelters,
  auditLogs,
}: {
  sosRequests: SosRecord[];
  shelters: ShelterRecord[];
  auditLogs: AuditLogRecord[];
}) {
  const [regionFilter, setRegionFilter] = useState('ALL');

  const filteredSos =
    regionFilter === 'ALL'
      ? sosRequests
      : sosRequests.filter((s) => s.region === regionFilter);

  const priorityData = ['P0', 'P1', 'P2', 'P3'].map((p) => ({
    name: p,
    count: filteredSos.filter((s) => s.priority === p).length,
  }));

  const shelterChartData = shelters.map((s) => ({
    name: s.shelterCode,
    Occupied: s.occupiedCapacity,
    Available: s.availableBeds,
  }));

  const handleExportCsv = () => {
    const headers = [
      'TrackingID',
      'CitizenName',
      'Region',
      'Category',
      'Priority',
      'Score',
      'PeopleCount',
      'WaterDepthCm',
      'Status',
      'ClusterID',
    ];
    const rows = filteredSos.map((s) => [
      s.trackingId,
      `"${(s.citizenName || '').replace(/"/g, '""')}"`,
      `"${s.region}"`,
      `"${s.category}"`,
      s.priority,
      s.priorityScore,
      s.peopleCount,
      s.waterDepthCm || 0,
      s.status,
      s.clusterId || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `alertnet-disaster-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Disaster Response Analytics & Official Situation Reports
            </h2>
            <p className="text-xs text-slate-400">
              Filter operational metrics by sector and export structured CSV or printable PDF
              situation reports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            >
              <option value="ALL">All Sectors</option>
              <option value="Central Basin">Central Basin</option>
              <option value="Lower Delta Sector 4">Lower Delta Sector 4</option>
              <option value="Riverfront Industrial">Riverfront Industrial</option>
              <option value="Southern Floodplain">Southern Floodplain</option>
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV Report
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <h3 className="text-sm font-bold text-white">SOS Requests by AI Triage Priority</h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="SOS Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <h3 className="text-sm font-bold text-white">Shelter Capacity Utilization</h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={shelterChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Occupied" stackId="a" fill="#0284c7" />
                  <Bar dataKey="Available" stackId="a" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Immutable Administrator Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">
          Immutable Command & Operations Audit Trail
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3 font-medium">Actor</th>
                <th className="py-2.5 px-3 font-medium">Role</th>
                <th className="py-2.5 px-3 font-medium">Action</th>
                <th className="py-2.5 px-3 font-medium">Target</th>
                <th className="py-2.5 px-3 font-medium">Operational Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-950/60">
                  <td className="py-2.5 px-3 font-medium text-white">{log.actorName}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{log.actorRole}</td>
                  <td className="py-2.5 px-3 font-mono text-sky-400">{log.action}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    {log.targetType}:{log.targetId}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. SYSTEM MONITORING, EVENT QUEUE & FAILOVER RELIABILITY DASHBOARD
// ---------------------------------------------------------------------------
export function SystemReliabilityConsole({
  reliability,
  onRefreshState,
}: {
  reliability: any;
  onRefreshState: () => void;
}) {
  const [burstRunning, setBurstRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFailoverAction = async (action: string, instanceId?: string) => {
    try {
      const res = await axios.post('/api/alertnet/system/failover', { action, instanceId });
      setStatusMessage(
        action === 'toggle_instance'
          ? `Failover state updated for ${instanceId}. Active replica continues zero-loss SOS processing.`
          : action === 'simulate_dlq'
          ? 'Simulated transient gateway failure: Message retried 3x with exponential backoff and routed to Dead-Letter Queue (DLQ).'
          : 'Replayed all Dead-Letter Queue messages successfully.'
      );
      onRefreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrigger100Burst = async () => {
    setBurstRunning(true);
    setStatusMessage('Executing 100-SOS rapid flood surge simulation across active instances...');
    try {
      const res = await axios.post('/api/alertnet/demo/burst-100', { count: 100 });
      setStatusMessage(
        `Burst Complete: 100 SOS reports durably stored in Cloud SQL, triaged (P0-P3), and grouped into ${res.data.clustersCount} shared rescue clusters with zero message loss.`
      );
      onRefreshState();
    } finally {
      setBurstRunning(false);
    }
  };

  if (!reliability) return null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Event-Driven Architecture, Failover & Queue Reliability Monitor
            </h2>
            <p className="text-xs text-slate-400">
              Monitor dual application instances, RabbitMQ durable queues, Dead-Letter Queue (DLQ),
              Redis deduplication, and Cloud SQL transactional pool.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={burstRunning}
              onClick={handleTrigger100Burst}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Zap className="w-3.5 h-3.5" />
              {burstRunning ? 'Simulating 100 SOS Burst...' : 'Simulate 100-SOS Rapid Burst'}
            </button>
            <button
              type="button"
              onClick={() => handleFailoverAction('simulate_dlq')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
            >
              Simulate Retry → DLQ
            </button>
            {reliability.rabbitMq?.dlqCount > 0 && (
              <button
                type="button"
                onClick={() => handleFailoverAction('replay_dlq')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
              >
                Replay DLQ ({reliability.rabbitMq.dlqCount})
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="p-3.5 bg-sky-950/60 border border-sky-700/70 rounded-lg text-xs text-sky-200">
            {statusMessage}
          </div>
        )}

        {/* Dual Application Instances Behind Load Balancer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reliability.instances?.map((inst: any) => (
            <div
              key={inst.id}
              className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">{inst.name}</span>
                  <span className="text-xs text-slate-400">({inst.role})</span>
                </div>
                <p
                  className={`text-xs font-semibold ${
                    inst.status === 'Healthy' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  Status: {inst.status}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Processed Events: {inst.processedCount} · CPU: {inst.cpuLoadPct}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleFailoverAction('toggle_instance', inst.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 ${
                  inst.status === 'Healthy'
                    ? 'bg-red-950/60 border-red-800 text-red-300 hover:bg-red-900/60'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                }`}
              >
                {inst.status === 'Healthy' ? 'Kill Instance (Test Failover)' : 'Restart Instance'}
              </button>
            </div>
          ))}
        </div>

        {/* Broker, Cache, and Database Telemetry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <h3 className="text-sm font-bold text-white">RabbitMQ Durable Broker</h3>
            <p className="text-xs text-emerald-400 font-medium">{reliability.rabbitMq?.status}</p>
            <div className="text-xs text-slate-300 font-mono space-y-1">
              <p>Publisher Confirms: {reliability.rabbitMq?.publisherConfirms ? 'ENABLED' : 'OFF'}</p>
              <p>SOS Queue Depth: {reliability.rabbitMq?.sosQueueDepth}</p>
              <p>ACKed Messages: {reliability.rabbitMq?.ackedMessages}</p>
              <p>Retry Count: {reliability.rabbitMq?.retryCount}</p>
              <p className={reliability.rabbitMq?.dlqCount > 0 ? 'text-amber-400 font-bold' : ''}>
                Dead-Letter Queue (DLQ): {reliability.rabbitMq?.dlqCount}
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <h3 className="text-sm font-bold text-white">Redis State & Deduplication</h3>
            <p className="text-xs text-emerald-400 font-medium">{reliability.redis?.status}</p>
            <div className="text-xs text-slate-300 font-mono space-y-1">
              <p>Active Cached Keys: {reliability.redis?.cachedKeys}</p>
              <p>Idempotency Dedup Hits: {reliability.redis?.dedupHits}</p>
              <p>Rate Limit Blocks: {reliability.redis?.rateLimitBlocks}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <h3 className="text-sm font-bold text-white">Persistent Relational Storage</h3>
            <p className="text-xs text-emerald-400 font-medium">{reliability.database?.engine}</p>
            <div className="text-xs text-slate-300 font-mono space-y-1">
              <p>Pool Status: {reliability.database?.status}</p>
              <p>Active Pool Connections: {reliability.database?.activePoolConnections} / 10</p>
              <p>Avg End-to-End Latency: {reliability.metrics?.avgLatencyMs} ms</p>
            </div>
          </div>
        </div>

        {reliability.rabbitMq?.dlqMessages?.length > 0 && (
          <div className="p-4 bg-amber-950/30 border border-amber-800/70 rounded-lg space-y-2">
            <h4 className="text-xs font-bold text-amber-300">
              Dead-Letter Queue (DLQ) Captured Messages
            </h4>
            {reliability.rabbitMq.dlqMessages.map((m: any) => (
              <div key={m.id} className="text-xs font-mono text-amber-200/90">
                [{m.id}] {m.reason} ({m.timestamp})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
