import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  AlertTriangle,
  Droplets,
  Thermometer,
  Wind,
  History,
  MapPin,
  Loader2,
  ShieldCheck,
  Sprout,
  Tractor,
  Waves,
  RefreshCw,
  Settings,
  Mail,
  Smartphone,
  Save,
  Users,
  Navigation,
  Home,
  Bell,
  Sliders,
  MessageSquare,
  BarChart3,
  Server,
  LogIn,
  Zap,
} from 'lucide-react';
import axios from 'axios';
import { signInWithPopup } from 'firebase/auth';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import MapView from './components/MapView';
import HistoryChart from './components/HistoryChart';
import RadarView from './components/RadarView';
import { auth, googleAuthProvider } from './lib/firebase';
import { LanguageCode, UI_TRANSLATIONS, UserRole } from './lib/translations';
import {
  CitizenSosPortal,
  TriageAndRescueConsole,
  SmartShelterConsole,
  SosRecord,
  IncidentCluster,
  RescueTeam,
  ShelterRecord,
} from './components/OperationsPanels';
import {
  MassAlertSimulator,
  FloodDigitalTwinSimulator,
  MultilingualAiAssistant,
  AnalyticsAndAuditPanel,
  SystemReliabilityConsole,
  MassAlertRecord,
  AuditLogRecord,
} from './components/AdvancedPanels';
import {
  AutomaticLocationAlertsAdminPanel,
  CitizenProfile,
  CitizenRegistrationPanel,
  CommunityMessageRecord,
  HospitalRecord,
  LocalityCommunityChatPanel,
  LocalizedAlertRecord,
  PersonalizedCitizenDashboard,
  VolunteerCoordinationPanel,
  VolunteerRecord,
} from './components/CitizenPortalPanels';
import { PWAInstallButton } from './components/PWAInstallButton';
import { cacheEmergencyDataToIdb } from './lib/offlineDb';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WeatherData {
  city: string;
  temp: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  description: string;
  coord: { lat: number; lon: number };
  isSimulatedWeather?: boolean;
  current: {
    temp: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDeg: number;
    description: string;
    icon: string;
    visibility: number;
    timestamp: number;
  };
  day1: { temp: string; humidity: number; pressure: number; rainfall: string; description: string };
  day2: { temp: string; humidity: number; pressure: number; rainfall: string; description: string };
}

interface PredictionResult {
  city: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskCategory?: 'Low' | 'Moderate' | 'High' | 'Critical';
  farmerRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  farmerAdvisory: string;
  riverLevel: string;
  score: string;
  confidenceScore: string;
  forecastHorizon?: string;
  contributingFactors: Array<{ factor: string; impact: 'High' | 'Medium' | 'Low'; value: string }>;
}

interface MonthlyOutlook {
  summary: string;
  weeks: Array<{ week: number; condition: string; advice: string }>;
  riskLevel: string;
  primaryConcern: string;
}

interface HistoryItem {
  id: number;
  city: string;
  lat: number;
  lon: number;
  temp: number;
  humidity: number;
  rainfall: number;
  pressure: number;
  river_level: number;
  risk_level: 'Low' | 'Medium' | 'High';
  timestamp: string;
}

type ActiveSection =
  | 'command'
  | 'citizenDashboard'
  | 'citizenRegistration'
  | 'communityChat'
  | 'volunteerHub'
  | 'monitoring'
  | 'sos'
  | 'rescue'
  | 'shelters'
  | 'alerts'
  | 'simulator'
  | 'analytics';

const DEMO_USERS: Record<UserRole, { uid: string; name: string; email: string; role: UserRole; region: string }> = {
  admin: {
    uid: 'demo-admin-uid',
    name: 'Cmdr. Rajeshwari Rao (NDMA)',
    email: 'commander@alertnet.gov.in',
    role: 'admin',
    region: 'Central Basin',
  },
  citizen: {
    uid: 'citizen-te-101',
    name: 'రాజేష్ కుమార్ (Rajesh Kumar)',
    email: 'ravi.teja@alertnet.in',
    role: 'citizen',
    region: 'Lower Delta Sector 4',
  },
  rescue: {
    uid: 'demo-rescue-uid',
    name: 'Capt. Vikram Singh (NDRF Alpha-1)',
    email: 'ndrf.alpha@alertnet.gov.in',
    role: 'rescue',
    region: 'Central Basin',
  },
  shelter: {
    uid: 'demo-shelter-uid',
    name: 'Meera Nair (Highland Relief Camp)',
    email: 'shelter.highland@alertnet.gov.in',
    role: 'shelter',
    region: 'Highland East',
  },
};

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('command');
  const [role, setRole] = useState<UserRole>('admin');
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('alertnet_preferred_language');
    return saved === 'te' || saved === 'hi' || saved === 'en' ? saved : 'en';
  });

  const setLanguage = (nextLang: LanguageCode) => {
    setLanguageState(nextLang);
    localStorage.setItem('alertnet_preferred_language', nextLang);
  };

  const [currentUser, setCurrentUser] = useState(DEMO_USERS.admin);
  const [wsConnected, setWsConnected] = useState(false);

  const [activeCitizen, setActiveCitizen] = useState<CitizenProfile>(() => {
    try {
      const saved = localStorage.getItem('alertnet_active_citizen');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
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
    };
  });

  // Operational State from Cloud SQL + WebSockets
  const [sosRequests, setSosRequests] = useState<SosRecord[]>([]);
  const [incidentClusters, setIncidentClusters] = useState<IncidentCluster[]>([]);
  const [rescueTeams, setRescueTeams] = useState<RescueTeam[]>([]);
  const [shelters, setShelters] = useState<ShelterRecord[]>([]);
  const [massAlerts, setMassAlerts] = useState<MassAlertRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [reliability, setReliability] = useState<any>(null);
  const [registeredCitizens, setRegisteredCitizens] = useState<CitizenProfile[]>([]);
  const [communityMessages, setCommunityMessages] = useState<CommunityMessageRecord[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([]);
  const [localizedAlerts, setLocalizedAlerts] = useState<LocalizedAlertRecord[]>([]);
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);

  // Weather & Flood Prediction State (Preserved)
  const [city, setCity] = useState('Hyderabad');
  const [activeCity, setActiveCity] = useState('Hyderabad');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [monthlyOutlook, setMonthlyOutlook] = useState<MonthlyOutlook | null>(null);
  const [waterBodiesRaw, setWaterBodiesRaw] = useState<string>('');
  const [extendedAdvisory, setExtendedAdvisory] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('floodAlertSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      email: true,
      push: true,
      threshold: 'High',
      emailAddress: 'commander@alertnet.gov.in',
    };
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const t = UI_TRANSLATIONS[language];

  const fetchAlertNetState = useCallback(async () => {
    try {
      const res = await axios.get('/api/alertnet/state');
      if (res.data) {
        setSosRequests(res.data.sosRequests || []);
        setIncidentClusters(res.data.incidentClusters || []);
        setRescueTeams(res.data.rescueTeams || []);
        setShelters(res.data.shelters || []);
        setMassAlerts(res.data.massAlerts || []);
        setAuditLogs(res.data.auditLogs || []);
        setReliability(res.data.reliability || null);
        setRegisteredCitizens(res.data.registeredCitizens || []);
        setCommunityMessages(res.data.communityMessages || []);
        setVolunteers(res.data.volunteers || []);
        setLocalizedAlerts(res.data.localizedAlerts || []);
        setHospitals(res.data.hospitals || []);

        // Cache shelters & hospitals in IndexedDB for Offline Emergency Mode
        cacheEmergencyDataToIdb('shelters', res.data.shelters || []);
        cacheEmergencyDataToIdb('hospitals', res.data.hospitals || []);
      }
    } catch (err) {
      console.error('Failed to load AlertNet state:', err);
    }
  }, []);

  // Connect to Real-Time WebSocket Server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 4000);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'system:connected' || msg.type === 'system:reliability') {
            if (msg.payload?.reliability) setReliability(msg.payload.reliability);
            else if (msg.payload) setReliability(msg.payload);
          } else if (
            msg.type === 'sos:created' ||
            msg.type === 'sos:updated' ||
            msg.type === 'state:sync' ||
            msg.type === 'alert:broadcast' ||
            msg.type === 'shelter:updated'
          ) {
            fetchAlertNetState();
          }
        } catch {}
      };
    };

    connectWs();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [fetchAlertNetState]);

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setCurrentUser(DEMO_USERS[nextRole]);
    if (nextRole === 'citizen') setActiveSection('citizenDashboard');
    else if (nextRole === 'rescue') setActiveSection('rescue');
    else if (nextRole === 'shelter') setActiveSection('shelters');
    else setActiveSection('command');
  };

  const handleSaveCitizenProfile = async (profile: CitizenProfile) => {
    const res = await axios.post('/api/alertnet/citizens/register', profile);
    const savedCitizen: CitizenProfile = {
      ...profile,
      ...(res.data?.citizen || {}),
      language: profile.language,
    };
    setActiveCitizen(savedCitizen);
    localStorage.setItem('alertnet_active_citizen', JSON.stringify(savedCitizen));
    setLanguage(profile.language);
    setCurrentUser({
      uid: savedCitizen.uid,
      name: savedCitizen.name,
      email: savedCitizen.email,
      role: 'citizen',
      region: savedCitizen.locality,
    });
    await fetchAlertNetState();
  };

  const handlePostCommunityMessage = async (payload: {
    locality: string;
    messageType: 'update' | 'help_request' | 'hazard_report' | 'direct_assist';
    content: string;
    language: LanguageCode;
  }) => {
    await axios.post('/api/alertnet/community', {
      citizenUid: activeCitizen.uid,
      authorName: activeCitizen.name,
      locality: payload.locality,
      city: activeCitizen.city,
      language: payload.language,
      messageType: payload.messageType,
      content: payload.content,
      lat: activeCitizen.lat,
      lon: activeCitizen.lon,
    });
    await fetchAlertNetState();
  };

  const handleModerateCommunityMessage = async (
    messageId: number,
    action: 'verify' | 'flag' | 'unflag' | 'upvote'
  ) => {
    await axios.post(`/api/alertnet/community/${messageId}/moderate`, {
      action,
      actorName: currentUser.name,
      actorRole: role,
    });
    await fetchAlertNetState();
  };

  const handleRegisterVolunteer = async (payload: {
    name: string;
    phone: string;
    email: string;
    locality: string;
    skills: string;
    availability: string;
    safetyAcknowledged: boolean;
  }) => {
    await axios.post('/api/alertnet/volunteers', {
      uid: `vol-${Date.now().toString().slice(-4)}`,
      state: activeCitizen.state,
      city: activeCitizen.city,
      ...payload,
    });
    setDemoNotice(
      `Registered volunteer ${payload.name} for safe relief support in ${payload.locality}.`
    );
    await fetchAlertNetState();
  };

  const handleTriggerAutoLocalityAlert = async (payload: {
    locality: string;
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    riskScore: number;
    forceDispatch?: boolean;
  }) => {
    const res = await axios.post('/api/alertnet/alerts/auto-locality', {
      ...payload,
      city: 'Hyderabad',
      state: 'Telangana',
      actorName: currentUser.name,
    });
    const alertObj = res.data?.alert;
    setDemoNotice(
      `Automatic Multilingual Alert dispatched for ${payload.locality}: English (${alertObj?.smsSentEn} SMS), తెలుగు (${alertObj?.smsSentTe} SMS), हिंदी (${alertObj?.smsSentHi} SMS).`
    );
    await fetchAlertNetState();
  };

  const handleRetryLocalizedAlert = async (alertId: number) => {
    await axios.post(`/api/alertnet/alerts/${alertId}/retry`, {
      actorName: currentUser.name,
    });
    setDemoNotice('Retried and delivered failed multilingual SMS messages.');
    await fetchAlertNetState();
  };

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user) {
        await axios.post('/api/alertnet/auth/sync', {
          uid: cred.user.uid,
          email: cred.user.email,
          name: cred.user.displayName,
          role,
        });
        setCurrentUser({
          uid: cred.user.uid,
          name: cred.user.displayName || cred.user.email || 'Authenticated Responder',
          email: cred.user.email || '',
          role,
          region: 'Central Basin',
        });
      }
    } catch (err) {
      console.error('Google Sign-In cancelled or unavailable in preview frame:', err);
    }
  };

  const fetchMonthlyOutlook = useCallback(async (targetCity: string, temp: number, rain: number) => {
    try {
      const res = await axios.post('/api/gemini/monthly-outlook', { city: targetCity, temp, rain });
      setMonthlyOutlook(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const fetchExtendedAdvisory = useCallback(
    async (
      targetCity: string,
      riskLevel: string,
      temp: number,
      rainfall: number,
      baseAdvisory: string,
      outlookSummary: string
    ) => {
      try {
        const res = await axios.post('/api/gemini/extended-advisory', {
          city: targetCity,
          riskLevel,
          temp,
          rainfall,
          baseAdvisory,
          outlookSummary,
        });
        setExtendedAdvisory(res.data?.text || '');
      } catch {}
    },
    []
  );

  const fetchWaterBodies = useCallback(async (lat: number, lon: number, targetCity: string) => {
    try {
      const res = await axios.post('/api/gemini/water-bodies', { lat, lon, city: targetCity });
      setWaterBodiesRaw(res.data?.text || '');
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get('/api/history');
      setHistory(res.data || []);
    } catch {}
  }, []);

  const performPrediction = useCallback(
    async (targetCity: string, isAutoRefresh = false, coords?: { lat: number; lon: number }) => {
      if (!targetCity && !coords) return;
      if (isAutoRefresh) setIsRefreshing(true);
      else setLoading(true);

      try {
        let weatherUrl = `/api/weather?city=${encodeURIComponent(targetCity)}`;
        if (coords) {
          weatherUrl = `/api/weather?lat=${coords.lat}&lon=${coords.lon}`;
        }

        const weatherRes = await axios.get(weatherUrl);
        setWeather(weatherRes.data);
        const actualCity = weatherRes.data.city;
        if (coords) setCity(actualCity);
        setActiveCity(actualCity);

        const predictRes = await axios.post('/api/predict', {
          ...weatherRes.data,
          lat: weatherRes.data.coord.lat,
          lon: weatherRes.data.coord.lon,
        });
        setPrediction(predictRes.data);

        const outlook = await fetchMonthlyOutlook(
          actualCity,
          weatherRes.data.temp,
          weatherRes.data.rainfall
        );
        fetchWaterBodies(weatherRes.data.coord.lat, weatherRes.data.coord.lon, actualCity);
        fetchExtendedAdvisory(
          actualCity,
          predictRes.data.riskLevel,
          weatherRes.data.temp,
          weatherRes.data.rainfall,
          predictRes.data.farmerAdvisory,
          outlook?.summary || 'Elevated basin moisture'
        );
        fetchHistory();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchMonthlyOutlook, fetchWaterBodies, fetchExtendedAdvisory, fetchHistory]
  );

  useEffect(() => {
    fetchAlertNetState();
    fetchHistory();
    performPrediction('Hyderabad');
  }, [fetchAlertNetState, fetchHistory, performPrediction]);

  useEffect(() => {
    if (activeCity) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        performPrediction(activeCity, true);
      }, REFRESH_INTERVAL_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCity, performPrediction]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await performPrediction('', false, {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        } finally {
          setIsLocating(false);
        }
      },
      () => setIsLocating(false)
    );
  };

  // Demo Action: Trigger Sample P0 Emergency SOS
  const handleTriggerSampleEmergency = async () => {
    setDemoNotice('Submitting live P0 sample emergency SOS...');
    try {
      const res = await axios.post('/api/alertnet/sos', {
        idempotencyKey: `sample-sos-${Date.now()}`,
        citizenUid: currentUser.uid,
        citizenName: 'Dr. Karthikeya Rao (Community Clinic)',
        phone: '+91-98480-77112',
        lat: 17.3882 + (Math.random() - 0.5) * 0.005,
        lon: 78.4855 + (Math.random() - 0.5) * 0.005,
        region: 'Central Basin',
        category: 'Medical Emergency',
        peopleCount: 8,
        severity: 'Critical',
        waterDepthCm: 150,
        medicalNeeds: '2 patients on portable oxygen + pediatric care',
        vulnerableGroups: 'Elderly, Infants',
        description:
          'Clinic ground floor flooded to 1.5m; 8 patients & staff awaiting zodiac boat extraction on 2nd floor.',
        mediaNote: 'Simulated Demo Emergency Trigger',
        isSimulated: true,
      });
      setDemoNotice(
        `Created ${res.data.sos.trackingId} (${res.data.sos.priority}) in Cluster ${res.data.sos.clusterId} via ${res.data.processedByInstance}.`
      );
      fetchAlertNetState();
    } catch {
      setDemoNotice('Failed to trigger sample SOS.');
    }
  };

  // Demo Action: Trigger 100-SOS Rapid Burst
  const handleTrigger100SosBurst = async () => {
    setDemoNotice('Generating 100 rapid SOS reports, AI triage & spatial clustering...');
    try {
      const res = await axios.post('/api/alertnet/demo/burst-100', { count: 100 });
      setDemoNotice(
        `100 SOS burst complete: All 100 individual records durably stored and clustered into ${res.data.clustersCount} shared rescue incidents.`
      );
      fetchAlertNetState();
    } catch {
      setDemoNotice('Failed to run 100-SOS burst.');
    }
  };

  // Combine Historical + 24h & 48h Forecasted River Levels (Preserved)
  const getCombinedHistory = (): HistoryItem[] => {
    if (!weather || !prediction) return history;
    const baseLevel = parseFloat(prediction.riverLevel);
    const day1Rain = parseFloat(weather.day1.rainfall);
    const day2Rain = parseFloat(weather.day2.rainfall);

    const forecast24hLevel = Number((baseLevel + day1Rain * 0.08).toFixed(2));
    const forecast48hLevel = Number((forecast24hLevel + day2Rain * 0.08).toFixed(2));

    const now = new Date();
    const f24: HistoryItem = {
      id: -1,
      city: `${prediction.city} (24h Forecast)`,
      lat: weather.coord.lat,
      lon: weather.coord.lon,
      temp: parseFloat(weather.day1.temp),
      humidity: weather.day1.humidity,
      rainfall: day1Rain,
      pressure: weather.day1.pressure,
      river_level: forecast24hLevel,
      risk_level: forecast24hLevel > 4.2 ? 'High' : forecast24hLevel > 3.2 ? 'Medium' : 'Low',
      timestamp: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    };
    const f48: HistoryItem = {
      id: -2,
      city: `${prediction.city} (48h Forecast)`,
      lat: weather.coord.lat,
      lon: weather.coord.lon,
      temp: parseFloat(weather.day2.temp),
      humidity: weather.day2.humidity,
      rainfall: day2Rain,
      pressure: weather.day2.pressure,
      river_level: forecast48hLevel,
      risk_level: forecast48hLevel > 4.2 ? 'High' : forecast48hLevel > 3.2 ? 'Medium' : 'Low',
      timestamp: new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
    };

    return [f48, f24, ...history];
  };

  const combinedHistory = getCombinedHistory();

  // Command KPI Aggregations
  const activeSos = sosRequests.filter((s) => s.status !== 'Completed' && s.status !== 'Cancelled');
  const criticalP0Sos = activeSos.filter((s) => s.priority === 'P0');
  const totalPeopleAffected = sosRequests.reduce((acc, s) => acc + s.peopleCount, 0);
  const totalPeopleRescued = sosRequests
    .filter((s) => s.status === 'Completed' || s.status === 'Rescuing')
    .reduce((acc, s) => acc + s.peopleCount, 0);
  const availableUnitsCount = rescueTeams.filter((r) => r.status === 'Available').length;
  const totalAvailableBeds = shelters.reduce((acc, s) => acc + s.availableBeds, 0);
  const totalShelterCap = shelters.reduce((acc, s) => acc + s.totalCapacity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#command"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('command');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          {t.appTitle}
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveSection('command')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'command' ? 'text-sky-400 underline underline-offset-8' : ''
            }`}
          >
            {t.commandCenter}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('citizenDashboard')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'citizenDashboard' ? 'text-sky-400 underline underline-offset-8' : ''
            }`}
          >
            {t.citizenDashboard}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('communityChat')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'communityChat' ? 'text-sky-400 underline underline-offset-8' : ''
            }`}
          >
            {t.communityChat}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('rescue')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'rescue' ? 'text-sky-400 underline underline-offset-8' : ''
            }`}
          >
            {t.rescueOps}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('simulator')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'simulator' ? 'text-sky-400 underline underline-offset-8' : ''
            }`}
          >
            {t.aiAssistant}
          </button>
        </nav>

        {/* Zone 3: Primary action + PWA Install */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton label={t.installApp} />
          <button
            type="button"
            onClick={() => setActiveSection('sos')}
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.triggerEmergencySos}
          </button>
        </div>
      </header>

      {/* WORKSPACE ROLE SWITCHER, DEMO CONTROLS & 3-LANGUAGE BAR */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">Active Role Workspace:</span>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {(['admin', 'citizen', 'rescue', 'shelter'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleSwitch(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  role === r
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.roleLabels[r]}
              </button>
            ))}
          </div>
          <span className="text-slate-400 hidden xl:inline">
            · Active Profile: <strong className="text-slate-200">{role === 'citizen' ? activeCitizen.name : currentUser.name}</strong> ({activeCitizen.locality})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Complete 3-Language Selector (English, తెలుగు, हिंदी) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-cyan-500/40 rounded-lg">
            {(['en', 'te', 'hi'] as LanguageCode[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                  language === lang
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {lang === 'en' ? 'English' : lang === 'te' ? 'తెలుగు (Telugu)' : 'हिंदी (Hindi)'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleTriggerSampleEmergency}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 rounded-lg font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Trigger Sample P0 SOS
          </button>
          <button
            type="button"
            onClick={handleTrigger100SosBurst}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-red-300 rounded-lg font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            Simulate 100-SOS Burst
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            Google Sign-In
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg cursor-pointer"
            title="Notification Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {demoNotice && (
        <div className="bg-sky-950/80 border-b border-sky-800 px-6 py-2 flex items-center justify-between text-xs text-sky-200">
          <span>{demoNotice}</span>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="text-sky-400 hover:text-white font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN WORKSPACE LAYOUT: SIDEBAR + VIEWPORT */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar Navigation (250px on desktop, horizontal scroll on mobile) */}
        <aside className="w-full lg:w-64 bg-slate-900/60 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex lg:flex-col gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'command', label: t.commandCenter, icon: BarChart3 },
            { id: 'citizenDashboard', label: t.citizenDashboard, icon: MapPin },
            { id: 'citizenRegistration', label: t.citizenRegistration, icon: Users },
            { id: 'sos', label: `${t.citizenSos} (${activeSos.length})`, icon: AlertTriangle },
            { id: 'communityChat', label: `${t.communityChat} (${communityMessages.length})`, icon: MessageSquare },
            { id: 'volunteerHub', label: `${t.volunteerHub} (${volunteers.length})`, icon: ShieldCheck },
            { id: 'monitoring', label: t.floodMonitoring, icon: Waves },
            { id: 'rescue', label: `${t.rescueOps} (${incidentClusters.length})`, icon: Navigation },
            { id: 'shelters', label: t.shelters, icon: Home },
            { id: 'alerts', label: t.massAlerts, icon: Bell },
            { id: 'simulator', label: `${t.aiAssistant} & Twin`, icon: Sliders },
            { id: 'analytics', label: `${t.analytics} & Health`, icon: Server },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as ActiveSection)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="hidden lg:block mt-auto pt-6 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-300">Live Telemetry Status</p>
            <p className="font-mono">
              WebSocket: {wsConnected ? 'CONNECTED (Live)' : 'RECONNECTING'}
            </p>
            <p className="font-mono">
              Registered Citizens: {registeredCitizens.length}
            </p>
            <p className="font-mono">
              PWA & IndexedDB: READY
            </p>
            <p className="font-mono">Database: Cloud SQL PG</p>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto space-y-6">
          {/* =============================================================== */}
          {/* VIEW 1: ADMIN COMMAND DASHBOARD                                 */}
          {/* =============================================================== */}
          {activeSection === 'command' && (
            <div className="space-y-6">
              {/* Top Command Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    AlertNet National Flood Command & Emergency Operations Center
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Real-time AI flood risk telemetry · Explainable P0–P3 SOS triage · Spatial
                    incident clustering · Zero-loss Cloud SQL storage
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSection('alerts')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0"
                  >
                    Broadcast Regional Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('rescue')}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0"
                  >
                    Open Triage & Dispatch ({activeSos.length})
                  </button>
                </div>
              </div>

              {/* 8 Real-Time Operational KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Flood Risk Score</span>
                  <span className="text-xl font-mono font-bold text-red-400">
                    {prediction ? `${prediction.score}/100` : '84/100'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {prediction?.riskCategory || prediction?.riskLevel || 'High'} ({activeCity})
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Active SOS Requests</span>
                  <span className="text-xl font-mono font-bold text-white">{activeSos.length}</span>
                  <span className="text-[11px] text-red-400 block mt-0.5 font-mono">
                    {criticalP0Sos.length} Critical P0
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Incident Clusters</span>
                  <span className="text-xl font-mono font-bold text-sky-400">
                    {incidentClusters.length}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    2.5km Spatial Grouping
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">People Affected</span>
                  <span className="text-xl font-mono font-bold text-amber-400">
                    {totalPeopleAffected}
                  </span>
                  <span className="text-[11px] text-emerald-400 block mt-0.5 font-mono">
                    {totalPeopleRescued} Rescued / Extracting
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Rescue Fleet Ready</span>
                  <span className="text-xl font-mono font-bold text-emerald-400">
                    {availableUnitsCount} / {rescueTeams.length}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    NDRF / SDRF / Air
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Available Shelter Beds</span>
                  <span className="text-xl font-mono font-bold text-sky-400">
                    {totalAvailableBeds}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                    of {totalShelterCap} total beds
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Basin River Level</span>
                  <span className="text-xl font-mono font-bold text-cyan-400">
                    {prediction ? `${prediction.riverLevel}m` : '5.42m'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                    Rain: {weather ? `${weather.rainfall}mm` : '38.5mm'}
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">System Latency</span>
                  <span className="text-xl font-mono font-bold text-emerald-400">
                    {reliability?.metrics?.avgLatencyMs || 38}ms
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                    98.6% Alert Delivery
                  </span>
                </div>
              </div>

              {/* Interactive GIS Operational Map + Priority Triage Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Interactive GIS Flood Risk, Citizen SOS, Rescue Units & Safe Corridors
                      </h2>
                      <p className="text-xs text-slate-400">
                        Live multi-layer operational map with animated wind vectors, SOS clusters,
                        and provisional safe routes.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Center: {activeCity} (
                      {weather ? `${weather.coord.lat.toFixed(3)}, ${weather.coord.lon.toFixed(3)}` : '17.385, 78.487'})
                    </span>
                  </div>

                  <MapView
                    center={weather ? [weather.coord.lat, weather.coord.lon] : [17.385, 78.4867]}
                    points={[
                      ...(weather && prediction
                        ? [
                            {
                              lat: weather.coord.lat,
                              lon: weather.coord.lon,
                              city: prediction.city,
                              riskLevel: prediction.riskLevel,
                              windSpeed: weather.current.windSpeed,
                              windDeg: weather.current.windDeg,
                            },
                          ]
                        : []),
                      ...history
                        .filter((h) => h.lat && h.lon)
                        .map((h) => ({
                          lat: h.lat,
                          lon: h.lon,
                          city: h.city,
                          riskLevel: h.risk_level,
                          windSpeed: 6.4,
                          windDeg: 210,
                        })),
                    ]}
                    sosMarkers={sosRequests.map((s) => ({
                      id: s.id,
                      trackingId: s.trackingId,
                      citizenName: s.citizenName,
                      lat: s.lat,
                      lon: s.lon,
                      category: s.category,
                      priority: s.priority,
                      peopleCount: s.peopleCount,
                      waterDepthCm: s.waterDepthCm || 0,
                      status: s.status,
                      clusterId: s.clusterId || undefined,
                    }))}
                    teamMarkers={rescueTeams.map((r) => ({
                      id: r.id,
                      teamCode: r.teamCode,
                      name: r.name,
                      specialization: r.specialization,
                      lat: r.lat,
                      lon: r.lon,
                      status: r.status,
                      equipment: r.equipment,
                    }))}
                    shelterMarkers={shelters.map((sh) => ({
                      id: sh.id,
                      shelterCode: sh.shelterCode,
                      name: sh.name,
                      lat: sh.lat,
                      lon: sh.lon,
                      totalCapacity: sh.totalCapacity,
                      occupiedCapacity: sh.occupiedCapacity,
                      availableBeds: sh.availableBeds,
                      status: sh.status,
                    }))}
                    showRoutes={true}
                    heightClass="h-[460px]"
                  />
                </div>

                {/* Right 4 Cols: Critical SOS Queue & Regional Risk Summary */}
                <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h2 className="text-base font-bold text-white">
                        Incoming Priority SOS Queue
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveSection('rescue')}
                        className="text-xs text-sky-400 hover:underline"
                      >
                        Manage All →
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {activeSos.slice(0, 8).map((s) => (
                        <div
                          key={s.id}
                          className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                                s.priority === 'P0'
                                  ? 'bg-red-950 text-red-300 border border-red-700'
                                  : s.priority === 'P1'
                                  ? 'bg-orange-950 text-orange-300 border border-orange-700'
                                  : 'bg-amber-950 text-amber-300 border border-amber-700'
                              }`}
                            >
                              {s.priority} · {s.trackingId}
                            </span>
                            <span className="text-xs font-mono text-sky-400">{s.status}</span>
                          </div>
                          <p className="text-xs font-semibold text-white">
                            {s.citizenName} · {s.region} ({s.peopleCount} people)
                          </p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {s.priorityReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Regional Flood Risk Summary */}
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <h3 className="text-xs font-bold text-slate-300">
                      Sector-Wise Flood Risk Status
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block text-[11px]">Central Basin</span>
                        <span className="font-mono font-bold text-red-400">CRITICAL (88/100)</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block text-[11px]">Lower Delta 4</span>
                        <span className="font-mono font-bold text-red-400">CRITICAL (91/100)</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block text-[11px]">Riverfront Ind.</span>
                        <span className="font-mono font-bold text-amber-400">HIGH (68/100)</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block text-[11px]">Highland East</span>
                        <span className="font-mono font-bold text-emerald-400">LOW (22/100)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Automatic Location-Based Multilingual Alert Engine & Language Statistics */}
              <AutomaticLocationAlertsAdminPanel
                language={language}
                localizedAlerts={localizedAlerts}
                onTriggerAutoLocalityAlert={handleTriggerAutoLocalityAlert}
                onRetryFailedAlert={handleRetryLocalizedAlert}
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 1B: PERSONALIZED CITIZEN DASHBOARD                         */}
          {/* =============================================================== */}
          {activeSection === 'citizenDashboard' && (
            <PersonalizedCitizenDashboard
              language={language}
              citizen={activeCitizen}
              shelters={shelters}
              hospitals={hospitals}
              localizedAlerts={localizedAlerts}
              onOpenSosModal={() => setActiveSection('sos')}
              onOpenRegistration={() => setActiveSection('citizenRegistration')}
              onOpenCommunityChat={() => setActiveSection('communityChat')}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 1C: CITIZEN REGISTRATION, LOGIN & PROFILE                  */}
          {/* =============================================================== */}
          {activeSection === 'citizenRegistration' && (
            <CitizenRegistrationPanel
              language={language}
              currentCitizen={activeCitizen}
              registeredCitizens={registeredCitizens}
              onSaveProfile={handleSaveCitizenProfile}
              onSelectExistingCitizen={(c) => {
                setActiveCitizen(c);
                localStorage.setItem('alertnet_active_citizen', JSON.stringify(c));
                if (c.language) setLanguage(c.language as LanguageCode);
              }}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 1D: LOCALITY-BASED COMMUNITY CHAT                          */}
          {/* =============================================================== */}
          {activeSection === 'communityChat' && (
            <LocalityCommunityChatPanel
              language={language}
              citizen={activeCitizen}
              messages={communityMessages}
              userRole={role}
              onPostMessage={handlePostCommunityMessage}
              onModerateMessage={handleModerateCommunityMessage}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 1E: VOLUNTEER COORDINATION HUB                             */}
          {/* =============================================================== */}
          {activeSection === 'volunteerHub' && (
            <VolunteerCoordinationPanel
              language={language}
              citizen={activeCitizen}
              volunteers={volunteers}
              onRegisterVolunteer={handleRegisterVolunteer}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 2: LIVE FLOOD MONITORING, RADAR, OUTLOOK & RIVER FORECAST  */}
          {/* =============================================================== */}
          {activeSection === 'monitoring' && (
            <div className="space-y-6">
              {/* City & GPS Search Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    AI Flood Prediction, Hydrological Telemetry & Live Precipitation Radar
                  </h2>
                  <p className="text-xs text-slate-400">
                    Analyze 48-hour rainfall forecasts, river levels, agricultural risk, and
                    upstream water bodies for any city or GPS coordinate.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    performPrediction(city);
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter city (e.g., Hyderabad, Mumbai, Chennai)..."
                    className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white w-64 focus:border-sky-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Analyze Flood Risk
                  </button>
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={isLocating}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {isLocating ? 'Locating...' : 'Use My GPS'}
                  </button>
                </form>
              </div>

              {weather?.isSimulatedWeather && (
                <div className="p-3.5 bg-amber-950/50 border border-amber-700/70 rounded-xl text-xs text-amber-200">
                  <strong>SIMULATION MODE NOTICE:</strong> OpenWeatherMap API key is not configured
                  in environment variables; displaying clearly labeled hydrological simulation
                  telemetry for {weather.city}.
                </div>
              )}

              {weather && prediction && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left 4 Cols: Risk Score, Factors & Agricultural Advisory */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {prediction.city} · {prediction.forecastHorizon || '48h Horizon'}
                        </span>
                        <span className="text-xs font-mono text-sky-400">
                          Confidence: {prediction.confidenceScore}%
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl font-mono font-bold text-white">
                            {prediction.score}/100
                          </span>
                          <span className="block text-xs text-slate-400 mt-0.5">
                            Composite Flood Risk Score
                          </span>
                        </div>
                        <span
                          className={`px-3 py-1 rounded text-xs font-bold ${
                            prediction.riskLevel === 'High'
                              ? 'bg-red-950 text-red-300 border border-red-700'
                              : prediction.riskLevel === 'Medium'
                              ? 'bg-amber-950 text-amber-300 border border-amber-700'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          }`}
                        >
                          {prediction.riskCategory || prediction.riskLevel} Risk
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-slate-400 block text-[11px]">48h Rainfall</span>
                          <span className="font-mono font-bold text-white text-sm">
                            {weather.rainfall} mm
                          </span>
                        </div>
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-slate-400 block text-[11px]">Est. River Gauge</span>
                          <span className="font-mono font-bold text-cyan-400 text-sm">
                            {prediction.riverLevel} m
                          </span>
                        </div>
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-slate-400 block text-[11px]">Temperature</span>
                          <span className="font-mono font-bold text-white text-sm">
                            {weather.temp}°C
                          </span>
                        </div>
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-slate-400 block text-[11px]">Wind Vector</span>
                          <span className="font-mono font-bold text-white text-sm">
                            {weather.current.windSpeed} m/s ({weather.current.windDeg}°)
                          </span>
                        </div>
                      </div>

                      {prediction.contributingFactors.length > 0 && (
                        <div className="pt-3 border-t border-slate-800 space-y-2">
                          <p className="text-xs font-semibold text-slate-300">
                            Primary Hydrological Risk Drivers
                          </p>
                          {prediction.contributingFactors.map((f, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">{f.factor}</span>
                              <span className="font-mono font-semibold text-white">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expanded Farmer & Agricultural Advisory */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sprout className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-sm font-bold text-white">Agricultural Advisory</h3>
                        </div>
                        <span className="text-xs font-mono text-amber-300">
                          Agri-Risk: {prediction.farmerRisk}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {prediction.farmerAdvisory}
                      </p>
                      {extendedAdvisory && (
                        <div className="pt-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                          {extendedAdvisory}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right 8 Cols: Live Precipitation Radar & 48h River Forecast Chart */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white">
                          Live Precipitation Radar ({weather.city})
                        </h3>
                        <span className="text-xs text-slate-400">RainViewer Real-Time Tile Feed</span>
                      </div>
                      <RadarView center={[weather.coord.lat, weather.coord.lon]} zoom={10} />
                    </div>
                  </div>

                  {/* Historical & 48h Forecasted River Level Chart & Table */}
                  <div className="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Historical & Next 48-Hour Forecasted River Levels
                        </h3>
                        <p className="text-xs text-slate-400">
                          Includes 24h and 48h projected river levels alongside historical records.
                        </p>
                      </div>
                    </div>

                    <HistoryChart data={combinedHistory} />

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2.5 px-3">Location / Horizon</th>
                            <th className="py-2.5 px-3">Temp</th>
                            <th className="py-2.5 px-3">Rainfall</th>
                            <th className="py-2.5 px-3">River Level</th>
                            <th className="py-2.5 px-3">Risk Level</th>
                            <th className="py-2.5 px-3">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {combinedHistory.map((item) => {
                            const isForecast = item.id < 0;
                            return (
                              <tr
                                key={`${item.id}-${item.timestamp}`}
                                className={isForecast ? 'bg-sky-950/30' : 'hover:bg-slate-950/60'}
                              >
                                <td className="py-2.5 px-3 font-medium text-white">
                                  {item.city}{' '}
                                  {isForecast && (
                                    <span className="text-[11px] text-sky-400 font-mono">
                                      · Forecast
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-300">
                                  {item.temp}°C
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-300">
                                  {item.rainfall} mm
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                                  {Number(item.river_level).toFixed(2)} m
                                </td>
                                <td className="py-2.5 px-3 font-semibold">
                                  <span
                                    className={
                                      item.risk_level === 'High'
                                        ? 'text-red-400'
                                        : item.risk_level === 'Medium'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }
                                  >
                                    {item.risk_level}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-400">
                                  {format(new Date(item.timestamp), 'MMM d, HH:mm')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Critical Water Bodies & 30-Day Outlook */}
                  <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                    <h3 className="text-base font-bold text-white">
                      Nearest Critical Water Bodies (Google Maps Grounded)
                    </h3>
                    {waterBodiesRaw ? (
                      <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                        <ReactMarkdown>{waterBodiesRaw}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Analyzing upstream reservoirs, rivers, and canals...
                      </p>
                    )}
                  </div>

                  <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                    <h3 className="text-base font-bold text-white">
                      30-Day Agricultural & Basin Outlook
                    </h3>
                    {monthlyOutlook ? (
                      <div className="space-y-3 text-xs">
                        <p className="text-slate-300 leading-relaxed">{monthlyOutlook.summary}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {monthlyOutlook.weeks?.map((w) => (
                            <div
                              key={w.week}
                              className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1"
                            >
                              <span className="font-mono font-bold text-sky-400">
                                Week {w.week}: {w.condition}
                              </span>
                              <p className="text-slate-400">{w.advice}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Generating 30-day meteorological outlook...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 3: CITIZEN SOS PORTAL                                      */}
          {/* =============================================================== */}
          {activeSection === 'sos' && (
            <CitizenSosPortal
              sosRequests={sosRequests}
              rescueTeams={rescueTeams}
              shelters={shelters}
              currentUser={currentUser}
              onRefreshState={fetchAlertNetState}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 4: AI SOS TRIAGE, CLUSTERING & RESCUE TEAM MANAGEMENT      */}
          {/* =============================================================== */}
          {activeSection === 'rescue' && (
            <TriageAndRescueConsole
              sosRequests={sosRequests}
              clusters={incidentClusters}
              rescueTeams={rescueTeams}
              currentUser={currentUser}
              onRefreshState={fetchAlertNetState}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 5: SMART SHELTER MANAGEMENT                                */}
          {/* =============================================================== */}
          {activeSection === 'shelters' && (
            <SmartShelterConsole
              shelters={shelters}
              currentUser={currentUser}
              onRefreshState={fetchAlertNetState}
            />
          )}

          {/* =============================================================== */}
          {/* VIEW 6: AUTOMATIC LOCATION ALERTS & MULTI-CHANNEL BROADCAST     */}
          {/* =============================================================== */}
          {activeSection === 'alerts' && (
            <div className="space-y-6">
              <AutomaticLocationAlertsAdminPanel
                language={language}
                localizedAlerts={localizedAlerts}
                onTriggerAutoLocalityAlert={handleTriggerAutoLocalityAlert}
                onRetryFailedAlert={handleRetryLocalizedAlert}
              />
              <MassAlertSimulator
                massAlerts={massAlerts}
                currentUser={currentUser}
                onRefreshState={fetchAlertNetState}
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 7: FLOOD DIGITAL TWIN & MULTILINGUAL AI ASSISTANT          */}
          {/* =============================================================== */}
          {activeSection === 'simulator' && (
            <div className="space-y-6">
              <FloodDigitalTwinSimulator />
              <MultilingualAiAssistant
                language={language}
                setLanguage={setLanguage}
                region={currentUser.region}
                currentRisk={prediction?.riskCategory || prediction?.riskLevel || 'High'}
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 8: ANALYTICS, AUDIT LOGS & SYSTEM RELIABILITY CONSOLE      */}
          {/* =============================================================== */}
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <SystemReliabilityConsole
                reliability={reliability}
                onRefreshState={fetchAlertNetState}
              />
              <AnalyticsAndAuditPanel
                sosRequests={sosRequests}
                shelters={shelters}
                auditLogs={auditLogs}
              />
            </div>
          )}
        </main>
      </div>

      {/* NOTIFICATION PREFERENCES MODAL (PRESERVED & DARK-THEMED) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-base font-bold text-white">Alert Notification Preferences</h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
            <div className="p-6 space-y-5 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <p className="font-bold text-white">Email Alerts</p>
                  <p className="text-slate-400">Receive flood threshold alerts via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) =>
                    setNotifications({ ...notifications, email: e.target.checked })
                  }
                  className="accent-sky-500 w-4 h-4"
                />
              </div>

              {notifications.email && (
                <div>
                  <label className="block text-slate-400 mb-1">Recipient Email Address</label>
                  <input
                    type="email"
                    value={notifications.emailAddress}
                    onChange={(e) =>
                      setNotifications({ ...notifications, emailAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <p className="font-bold text-white">Browser Push Notifications</p>
                  <p className="text-slate-400">Instant desktop & mobile push alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.push}
                  onChange={(e) =>
                    setNotifications({ ...notifications, push: e.target.checked })
                  }
                  className="accent-sky-500 w-4 h-4"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-2">Alert Risk Threshold</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Low', 'Medium', 'High'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setNotifications({ ...notifications, threshold: level })}
                      className={cn(
                        'py-2 rounded-lg border font-bold transition-colors',
                        notifications.threshold === level
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('floodAlertSettings', JSON.stringify(notifications));
                    setShowSettings(false);
                  }}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
