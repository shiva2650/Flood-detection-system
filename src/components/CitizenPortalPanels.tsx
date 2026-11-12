import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Compass,
  Flag,
  HeartHandshake,
  Hospital,
  Languages,
  MapPin,
  MessageSquare,
  Navigation,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  LanguageCode,
  LOCALITY_DIRECTORY,
  UI_TRANSLATIONS,
} from '../lib/translations';
import { OFFLINE_SAFETY_GUIDELINES } from '../lib/offlineDb';

export interface CitizenProfile {
  id?: number;
  uid: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  locality: string;
  language: LanguageCode;
  lat: number;
  lon: number;
  locationGranted: boolean;
}

export interface CommunityMessageRecord {
  id: number;
  citizenUid: string;
  authorName: string;
  locality: string;
  city: string;
  language: string;
  messageType: 'update' | 'help_request' | 'hazard_report' | 'direct_assist';
  content: string;
  lat?: number;
  lon?: number;
  isVerified: boolean;
  isFlagged: boolean;
  flagReason?: string | null;
  upvotes: number;
  createdAt: string;
}

export interface VolunteerRecord {
  id: number;
  uid: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  locality: string;
  skills: string;
  availability: string;
  assignedTask: string;
  safetyAcknowledged: boolean;
  status: string;
  createdAt: string;
}

export interface LocalizedAlertRecord {
  id: number;
  alertCode: string;
  locality: string;
  city: string;
  state: string;
  riskLevel: string;
  riskScore: number;
  titleEn: string;
  titleTe: string;
  titleHi: string;
  messageEn: string;
  messageTe: string;
  messageHi: string;
  recommendedAction: string;
  smsSentEn: number;
  smsSentTe: number;
  smsSentHi: number;
  pushSent: number;
  emailSent: number;
  deliveredCount: number;
  failedCount: number;
  retryCount: number;
  dedupHash: string;
  isSimulation: boolean;
  createdAt: string;
}

export interface HospitalRecord {
  id: number;
  code: string;
  name: string;
  locality: string;
  city: string;
  lat: number;
  lon: number;
  emergencyBeds: number;
  ambulanceCount: number;
  contact: string;
  status: string;
}

export const CitizenRegistrationPanel: React.FC<{
  language: LanguageCode;
  currentCitizen: CitizenProfile;
  registeredCitizens: CitizenProfile[];
  onSaveProfile: (profile: CitizenProfile) => Promise<void>;
  onSelectExistingCitizen: (citizen: CitizenProfile) => void;
}> = ({
  language,
  currentCitizen,
  registeredCitizens,
  onSaveProfile,
  onSelectExistingCitizen,
}) => {
  const t = UI_TRANSLATIONS[language].registration;
  const [formData, setFormData] = useState<CitizenProfile>(currentCitizen);
  const [gpsStatus, setGpsStatus] = useState<string>(
    currentCitizen.locationGranted
      ? `GPS Verified (${currentCitizen.lat.toFixed(4)}, ${currentCitizen.lon.toFixed(4)})`
      : 'Waiting for permission'
  );
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const handleLocalityChange = (localityName: string) => {
    const meta = LOCALITY_DIRECTORY.find((l) => l.name === localityName);
    setFormData((prev) => ({
      ...prev,
      locality: localityName,
      city: meta ? meta.city : prev.city,
      state: meta ? meta.state : prev.state,
      lat: meta ? meta.lat : prev.lat,
      lon: meta ? meta.lon : prev.lon,
    }));
  };

  const handleCaptureGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('Using Locality Reference Coordinates');
      return;
    }
    setGpsStatus('Acquiring GPS Fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        setFormData((prev) => ({ ...prev, lat, lon, locationGranted: true }));
        setGpsStatus(`Live GPS Granted (${lat}, ${lon})`);
      },
      () => {
        const meta =
          LOCALITY_DIRECTORY.find((l) => l.name === formData.locality) || LOCALITY_DIRECTORY[0];
        setFormData((prev) => ({
          ...prev,
          lat: meta.lat,
          lon: meta.lon,
          locationGranted: true,
        }));
        setGpsStatus(`Locality Geolocation Locked (${meta.lat.toFixed(4)}, ${meta.lon.toFixed(4)})`);
      },
      { timeout: 5000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      await onSaveProfile(formData);
      setBanner(t.savedSuccess);
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (preset: CitizenProfile) => {
    setFormData(preset);
    setGpsStatus(`Verified (${preset.lat.toFixed(4)}, ${preset.lon.toFixed(4)})`);
    onSelectExistingCitizen(preset);
    await onSaveProfile(preset);
    setBanner(t.savedSuccess);
  };

  const demoPresets: CitizenProfile[] = [
    {
      uid: 'citizen-te-101',
      name: 'రాజేష్ కుమార్ (Rajesh Kumar)',
      phone: '+91-9848011223',
      email: 'ravi.teja@alertnet.in',
      state: 'Telangana',
      city: 'Hyderabad',
      locality: 'Lower Delta Sector 4',
      language: 'te',
      lat: 17.3616,
      lon: 78.4747,
      locationGranted: true,
    },
    {
      uid: 'citizen-hi-102',
      name: 'प्रिया शर्मा (Priya Sharma)',
      phone: '+91-9701234567',
      email: 'priya.sharma@alertnet.in',
      state: 'Telangana',
      city: 'Hyderabad',
      locality: 'Central Basin',
      language: 'hi',
      lat: 17.385,
      lon: 78.4867,
      locationGranted: true,
    },
    {
      uid: 'citizen-en-103',
      name: 'Arjun Reddy',
      phone: '+91-9988776655',
      email: 'arjun.reddy@alertnet.in',
      state: 'Telangana',
      city: 'Hyderabad',
      locality: 'Riverfront Industrial',
      language: 'en',
      lat: 17.4065,
      lon: 78.4772,
      locationGranted: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              {t.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
          </div>
          <span className="px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            Active UID: {formData.uid}
          </span>
        </div>

        {/* 1-Click Hackathon Demo Citizen Presets */}
        <div className="mb-6 p-4 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            {t.presetScenariosTitle}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {demoPresets.map((preset) => (
              <button
                key={preset.uid}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  currentCitizen.uid === preset.uid
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{preset.name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-cyan-300 uppercase">
                    {preset.language === 'te'
                      ? 'తెలుగు (TE)'
                      : preset.language === 'hi'
                      ? 'हिंदी (HI)'
                      : 'English (EN)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {preset.locality}, {preset.city} • {preset.phone}
                </div>
              </button>
            ))}
          </div>
        </div>

        {banner && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{banner}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t.fullName}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.mobileNumber}
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.emailAddress}
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.preferredLanguage}
            </label>
            <select
              value={formData.language}
              onChange={(e) =>
                setFormData({ ...formData, language: e.target.value as LanguageCode })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="en">English (ఇంగ్లీష్ / अंग्रेज़ी)</option>
              <option value="te">తెలుగు – Telugu</option>
              <option value="hi">हिंदी – Hindi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t.state}</label>
            <input
              type="text"
              required
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t.city}</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t.locality}</label>
            <select
              value={formData.locality}
              onChange={(e) => handleLocalityChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {LOCALITY_DIRECTORY.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name} ({loc.city}, {loc.state}) — Current Risk: {loc.riskLevel} (
                  {loc.baseRiskScore}/100)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                {t.gpsPermissionTitle}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.gpsPermissionDesc}</p>
              <div className="text-[11px] font-mono text-emerald-400 mt-1">{gpsStatus}</div>
            </div>
            <button
              type="button"
              onClick={handleCaptureGps}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              {t.captureGpsBtn}
            </button>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving to Cloud SQL...' : t.registerBtn}
            </button>
          </div>
        </form>
      </div>

      {/* Registered Citizens Directory */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          Registered Citizen Directory ({registeredCitizens.length} Active Profiles in Cloud SQL)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Mobile</th>
                <th className="py-2 pr-3">Locality & City</th>
                <th className="py-2 pr-3">Alert Language</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {registeredCitizens.slice(0, 10).map((c) => (
                <tr key={c.uid} className="text-slate-200">
                  <td className="py-2.5 pr-3 font-semibold">{c.name}</td>
                  <td className="py-2.5 pr-3 font-mono text-slate-300">{c.phone || '+91-9848011223'}</td>
                  <td className="py-2.5 pr-3">
                    {c.locality || 'Central Basin'}, {c.city || 'Hyderabad'}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 font-mono text-[11px] text-cyan-300">
                      {(c.language || 'en').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => applyPreset(c)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-cyan-300 cursor-pointer"
                    >
                      Activate Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const PersonalizedCitizenDashboard: React.FC<{
  language: LanguageCode;
  citizen: CitizenProfile;
  shelters: Array<{
    id: number;
    shelterCode: string;
    name: string;
    region: string;
    availableBeds: number;
    totalCapacity: number;
    contact: string;
    status: string;
  }>;
  hospitals: HospitalRecord[];
  localizedAlerts: LocalizedAlertRecord[];
  onOpenSosModal: () => void;
  onOpenRegistration: () => void;
  onOpenCommunityChat: () => void;
}> = ({
  language,
  citizen,
  shelters,
  hospitals,
  localizedAlerts,
  onOpenSosModal,
  onOpenRegistration,
  onOpenCommunityChat,
}) => {
  const t = UI_TRANSLATIONS[language].dashboard;
  const localityMeta =
    LOCALITY_DIRECTORY.find((l) => l.name === citizen.locality) || LOCALITY_DIRECTORY[0];
  const safetyGuide = OFFLINE_SAFETY_GUIDELINES[language];

  const myAlerts = localizedAlerts.filter(
    (a) => a.locality === localityMeta.name || localizedAlerts.length > 0
  );

  const actionBannerText =
    localityMeta.officialAction === 'EVACUATE'
      ? t.evacuateNowBanner
      : localityMeta.officialAction === 'PREPARE'
      ? t.prepareEvacuationBanner
      : t.stayIndoorsBanner;

  const actionBannerStyle =
    localityMeta.officialAction === 'EVACUATE'
      ? 'bg-red-500/15 border-red-500/50 text-red-200'
      : localityMeta.officialAction === 'PREPARE'
      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
      : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';

  return (
    <div className="space-y-6">
      {/* Top Citizen Header & Prominent SOS CTA */}
      <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            {t.welcomePrefix} {localityMeta.name}, {localityMeta.city}
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            {citizen.name}{' '}
            <span className="text-xs font-mono text-slate-400 font-normal">
              ({citizen.phone})
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onOpenRegistration}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-medium cursor-pointer"
            >
              Change Locality / Language ({language.toUpperCase()})
            </button>
            <button
              type="button"
              onClick={onOpenCommunityChat}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-emerald-300 font-medium cursor-pointer"
            >
              Open {localityMeta.name} Community Chat
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSosModal}
          className="px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-red-950/60 border border-red-400/40 cursor-pointer"
        >
          <AlertTriangle className="w-5 h-5" />
          {UI_TRANSLATIONS[language].triggerEmergencySos}
        </button>
      </div>

      {/* Official Stay Indoors vs Evacuate Guidance Banner */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 ${actionBannerStyle}`}>
        <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm">{actionBannerText}</div>
          <div className="text-xs opacity-90 mt-1">
            <strong>Verified Evacuation Route:</strong> {localityMeta.evacuationRoute}
          </div>
        </div>
      </div>

      {/* Locality Flood Risk Score (0-100) + Weather & Rainfall */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
          <div className="text-xs text-slate-400 font-semibold uppercase">
            {t.localityRiskTitle}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-extrabold ${
                localityMeta.riskLevel === 'Critical'
                  ? 'text-red-400'
                  : localityMeta.riskLevel === 'High'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {localityMeta.riskLevel.toUpperCase()}
            </span>
            <span className="text-3xl font-mono font-bold text-white tabular-nums">
              {localityMeta.baseRiskScore}
              <span className="text-sm text-slate-400">/100</span>
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-800 mt-3 overflow-hidden">
            <div
              className={`h-full ${
                localityMeta.baseRiskScore >= 80
                  ? 'bg-red-500'
                  : localityMeta.baseRiskScore >= 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${localityMeta.baseRiskScore}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">{t.riskScoreLabel}</div>
        </div>

        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
          <div className="text-xs text-slate-400 font-semibold uppercase">
            {t.weatherRainfallLabel}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-400">Rainfall Intensity</div>
              <div className="text-xl font-mono font-bold text-cyan-300 tabular-nums">
                {localityMeta.rainfallMmHr} mm/hr
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Basin Gauge Level</div>
              <div className="text-xl font-mono font-bold text-amber-300 tabular-nums">
                {localityMeta.riverLevelM.toFixed(2)} m
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3">
            Coordinates: {localityMeta.lat.toFixed(4)}°N, {localityMeta.lon.toFixed(4)}°E
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
          <div className="text-xs text-slate-400 font-semibold uppercase">
            24x7 Emergency Helplines
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            {safetyGuide.helplines.map((h) => (
              <div key={h.number} className="flex items-center justify-between">
                <span className="text-slate-300">{h.label}</span>
                <span className="font-mono font-bold text-emerald-400">{h.number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nearby Flooded Zones vs Nearby Safer High-Ground Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900/90 border border-red-500/30 p-5">
          <h3 className="text-sm font-bold text-red-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            {t.nearbyFloodedTitle}
          </h3>
          <ul className="space-y-2 text-xs text-slate-200">
            {localityMeta.floodedZones.map((zone) => (
              <li
                key={zone}
                className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>{zone}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-slate-900/90 border border-emerald-500/30 p-5">
          <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-emerald-400" />
            {t.nearbySaferTitle}
          </h3>
          <ul className="space-y-2 text-xs text-slate-200">
            {localityMeta.saferZones.map((zone) => (
              <li
                key={zone}
                className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>{zone}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Latest Emergency Notifications in Selected Language + Preserved Official Original */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-amber-400" />
          {t.latestAlertsTitle}
        </h3>
        <div className="space-y-3">
          {myAlerts.slice(0, 3).map((alert) => {
            const localizedTitle =
              language === 'te'
                ? alert.titleTe
                : language === 'hi'
                ? alert.titleHi
                : alert.titleEn;
            const localizedBody =
              language === 'te'
                ? alert.messageTe
                : language === 'hi'
                ? alert.messageHi
                : alert.messageEn;

            return (
              <div
                key={alert.alertCode}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-amber-300">{localizedTitle}</span>
                  <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-[11px] font-mono text-red-300">
                    {alert.locality} • {alert.riskLevel} ({alert.riskScore}/100)
                  </span>
                </div>
                <p className="text-xs text-slate-100 leading-relaxed">{localizedBody}</p>
                {language !== 'en' && (
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span className="font-semibold text-cyan-400">{t.originalOfficialMsg}: </span>
                    {alert.messageEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Shelters & Verified Emergency Hospitals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            {t.verifiedSheltersTitle}
          </h3>
          <div className="space-y-2.5">
            {shelters.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-white">{s.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {s.region} • Contact: {s.contact}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                    {s.availableBeds} / {s.totalCapacity} Beds Free
                  </div>
                  <div className="text-[10px] text-slate-400">{s.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Hospital className="w-4 h-4 text-rose-400" />
            {t.verifiedHospitalsTitle}
          </h3>
          <div className="space-y-2.5">
            {hospitals.map((h) => (
              <div
                key={h.code}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-white">{h.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {h.locality}, {h.city} • <PhoneCall className="w-3 h-3 inline" /> {h.contact}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                    {h.emergencyBeds} ICU/Trauma Beds
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    {h.ambulanceCount} Ambulances Ready
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offline Cached Emergency Safety Instructions */}
      <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-cyan-400" />
            {safetyGuide.title}
          </h3>
          <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
            IndexedDB Offline Cache Ready
          </span>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-200 leading-relaxed">
          {safetyGuide.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export const LocalityCommunityChatPanel: React.FC<{
  language: LanguageCode;
  citizen: CitizenProfile;
  messages: CommunityMessageRecord[];
  userRole: string;
  onPostMessage: (payload: {
    locality: string;
    messageType: 'update' | 'help_request' | 'hazard_report' | 'direct_assist';
    content: string;
    language: LanguageCode;
  }) => Promise<void>;
  onModerateMessage: (
    messageId: number,
    action: 'verify' | 'flag' | 'unflag' | 'upvote'
  ) => Promise<void>;
}> = ({ language, citizen, messages, userRole, onPostMessage, onModerateMessage }) => {
  const t = UI_TRANSLATIONS[language].community;
  const [selectedLocality, setSelectedLocality] = useState<string>(
    citizen.locality || 'Lower Delta Sector 4'
  );
  const [messageType, setMessageType] = useState<
    'update' | 'help_request' | 'hazard_report' | 'direct_assist'
  >('update');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const filteredMessages = messages.filter(
    (m) => selectedLocality === 'All Localities' || m.locality === selectedLocality
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onPostMessage({
        locality: selectedLocality === 'All Localities' ? citizen.locality : selectedLocality,
        messageType,
        content: content.trim(),
        language,
      });
      setContent('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              {t.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t.selectLocality}:</span>
            <select
              value={selectedLocality}
              onChange={(e) => setSelectedLocality(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white"
            >
              <option value="All Localities">All Localities (City-Wide Feed)</option>
              {LOCALITY_DIRECTORY.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({l.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Post Form */}
        <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'update', label: t.typeUpdate },
                { id: 'help_request', label: t.typeHelpRequest },
                { id: 'hazard_report', label: t.typeHazardReport },
                { id: 'direct_assist', label: t.typeDirectAssist },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMessageType(item.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                  messageType === item.id
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.postPlaceholder}
              className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {t.postUpdateBtn}
            </button>
          </div>
        </form>

        {/* Messages Feed */}
        <div className="mt-5 space-y-3">
          {filteredMessages.map((m) => (
            <div
              key={m.id}
              className={`p-4 rounded-xl border ${
                m.isFlagged
                  ? 'bg-red-950/20 border-red-500/40'
                  : 'bg-slate-950/90 border-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">{m.authorName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300">
                    {m.locality}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 uppercase">
                    {m.language}
                  </span>
                  {m.isVerified && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {t.verifiedBadge}
                    </span>
                  )}
                  {m.isFlagged && (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[10px] font-semibold text-red-300">
                      {t.flaggedBadge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="text-xs text-slate-100 leading-relaxed">{m.content}</p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onModerateMessage(m.id, 'upvote')}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ThumbsUp className="w-3 h-3 text-cyan-400" />
                    Helpful ({m.upvotes})
                  </button>
                  <button
                    type="button"
                    onClick={() => onModerateMessage(m.id, m.isFlagged ? 'unflag' : 'flag')}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Flag className="w-3 h-3" />
                    {m.isFlagged ? 'Clear Flag' : t.flagMisinfoBtn}
                  </button>
                </div>

                {userRole === 'admin' && !m.isVerified && (
                  <button
                    type="button"
                    onClick={() => onModerateMessage(m.id, 'verify')}
                    className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300 cursor-pointer"
                  >
                    ✓ Verify Official Accuracy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const VolunteerCoordinationPanel: React.FC<{
  language: LanguageCode;
  citizen: CitizenProfile;
  volunteers: VolunteerRecord[];
  onRegisterVolunteer: (payload: {
    name: string;
    phone: string;
    email: string;
    locality: string;
    skills: string;
    availability: string;
    safetyAcknowledged: boolean;
  }) => Promise<void>;
}> = ({ language, citizen, volunteers, onRegisterVolunteer }) => {
  const t = UI_TRANSLATIONS[language].volunteer;
  const [name, setName] = useState(citizen.name);
  const [phone, setPhone] = useState(citizen.phone);
  const [email, setEmail] = useState(citizen.email);
  const [locality, setLocality] = useState(citizen.locality);
  const [skills, setSkills] = useState('First Aid, Telugu/Hindi Translation, Shelter Food Relief');
  const [availability, setAvailability] = useState('Immediate (Day & Night Shift)');
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safetyAcknowledged) return;
    setSubmitting(true);
    try {
      await onRegisterVolunteer({
        name,
        phone,
        email,
        locality,
        skills,
        availability,
        safetyAcknowledged,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-emerald-400" />
          {t.title}
        </h2>
        <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>

        {/* Mandatory Volunteer Safety Guardrail */}
        <div className="my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold">{t.safetyWarningTitle}</div>
            <p className="mt-1 opacity-90">{t.safetyWarningDesc}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Locality</label>
            <select
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            >
              {LOCALITY_DIRECTORY.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.availabilityLabel}
            </label>
            <input
              type="text"
              required
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.skillsLabel}
            </label>
            <input
              type="text"
              required
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="vol-safety"
              checked={safetyAcknowledged}
              onChange={(e) => setSafetyAcknowledged(e.target.checked)}
              className="rounded border-slate-700"
            />
            <label htmlFor="vol-safety" className="text-xs text-slate-200">
              {t.acknowledgeSafetyCheckbox}
            </label>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !safetyAcknowledged}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Registering...' : t.registerVolunteerBtn}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          Active Verified Relief Volunteers ({volunteers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {volunteers.map((v) => (
            <div key={v.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{v.name}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300">
                  {v.status} • {v.locality}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                <strong>Skills:</strong> {v.skills}
              </div>
              <div className="text-[11px] text-cyan-300 mt-1">
                <strong>Assigned Safe Task:</strong> {v.assignedTask}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AutomaticLocationAlertsAdminPanel: React.FC<{
  language: LanguageCode;
  localizedAlerts: LocalizedAlertRecord[];
  onTriggerAutoLocalityAlert: (payload: {
    locality: string;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    riskScore: number;
    forceDispatch?: boolean;
  }) => Promise<void>;
  onRetryFailedAlert: (alertId: number) => Promise<void>;
}> = ({ language, localizedAlerts, onTriggerAutoLocalityAlert, onRetryFailedAlert }) => {
  const t = UI_TRANSLATIONS[language].alertsEngine;
  const [selectedLocality, setSelectedLocality] = useState(LOCALITY_DIRECTORY[0].name);
  const [dispatching, setDispatching] = useState(false);

  const totalEn = localizedAlerts.reduce((acc, a) => acc + a.smsSentEn, 0);
  const totalTe = localizedAlerts.reduce((acc, a) => acc + a.smsSentTe, 0);
  const totalHi = localizedAlerts.reduce((acc, a) => acc + a.smsSentHi, 0);

  const handleDispatch = async () => {
    const meta =
      LOCALITY_DIRECTORY.find((l) => l.name === selectedLocality) || LOCALITY_DIRECTORY[0];
    setDispatching(true);
    try {
      await onTriggerAutoLocalityAlert({
        locality: meta.name,
        riskLevel: meta.riskLevel,
        riskScore: meta.baseRiskScore,
        forceDispatch: true,
      });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Languages className="w-5 h-5 text-cyan-400" />
            {t.title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedLocality}
            onChange={(e) => setSelectedLocality(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
          >
            {LOCALITY_DIRECTORY.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name} — {l.riskLevel} ({l.baseRiskScore}/100)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={dispatching}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
          >
            {dispatching ? 'Dispatching SMS/Push/Email...' : t.triggerAutoAlertBtn}
          </button>
        </div>
      </div>

      {/* Language-Wise Notification Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">{t.smsEnglishCount}</div>
          <div className="text-xl font-mono font-bold text-cyan-300 mt-1 tabular-nums">
            {totalEn.toLocaleString()}
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">{t.smsTeluguCount}</div>
          <div className="text-xl font-mono font-bold text-emerald-300 mt-1 tabular-nums">
            {totalTe.toLocaleString()}
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">{t.smsHindiCount}</div>
          <div className="text-xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
            {totalHi.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Dispatched Localized Alerts Log */}
      <div className="space-y-3">
        {localizedAlerts.map((a) => (
          <div key={a.alertCode} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[11px] font-mono font-bold text-red-300">
                  {a.riskLevel.toUpperCase()} ({a.riskScore}/100)
                </span>
                <span className="font-bold text-xs text-white">{a.locality}, {a.city}</span>
                <span className="text-[11px] font-mono text-slate-400">#{a.alertCode}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400">
                  Delivered: {a.deliveredCount.toLocaleString()}
                </span>
                {a.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onRetryFailedAlert(a.id)}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t.retryFailedBtn} ({a.failedCount})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="font-semibold text-cyan-300 mb-0.5">
                  English ({a.smsSentEn} SMS):
                </div>
                <div className="text-slate-300">{a.messageEn}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="font-semibold text-emerald-300 mb-0.5">
                  తెలుగు ({a.smsSentTe} SMS):
                </div>
                <div className="text-slate-200">{a.messageTe}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="font-semibold text-amber-300 mb-0.5">
                  हिंदी ({a.smsSentHi} SMS):
                </div>
                <div className="text-slate-200">{a.messageHi}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
