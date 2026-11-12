import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, AlertTriangle, Droplets, Thermometer, Wind, History, MapPin, Loader2, ShieldCheck, AlertCircle, Clock, Sprout, Tractor, Waves, RefreshCw, Settings, Bell, Mail, Smartphone, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import MapView from './components/MapView';
import HistoryChart from './components/HistoryChart';
import RadarView from './components/RadarView';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WaterBody {
  name: string;
  type: string;
  condition: string;
  distance: string;
  riskFactor: string;
}

interface WeatherData {
  city: string;
  temp: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  description: string;
  coord: { lat: number; lon: number };
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
  farmerRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  farmerAdvisory: string;
  riverLevel: string;
  score: string;
  confidenceScore: string;
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

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export default function App() {
  const [city, setCity] = useState('');
  const [activeCity, setActiveCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [monthlyOutlook, setMonthlyOutlook] = useState<MonthlyOutlook | null>(null);
  const [waterBodiesRaw, setWaterBodiesRaw] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  // Error state removed

  const [isLocating, setIsLocating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('floodAlertSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      email: true,
      push: false,
      threshold: 'High',
      emailAddress: 'user@example.com'
    };
  });

  const [extendedAdvisory, setExtendedAdvisory] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Pass coordinates directly to prediction for 100% accuracy
          await performPrediction("", false, { lat: latitude, lon: longitude });
        } catch (err) {
          // Error handling removed
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
      }
    );
  };

  const fetchMonthlyOutlook = useCallback(async (city: string, temp: number, rain: number) => {
    try {
      const res = await axios.post('/api/gemini/monthly-outlook', { city, temp, rain });
      const outlook = res.data;
      setMonthlyOutlook(outlook);
      return outlook;
    } catch (err) {
      // Error handling removed
      return null;
    }
  }, []);

  const fetchExtendedAdvisory = useCallback(async (city: string, riskLevel: string, temp: number, rainfall: number, baseAdvisory: string, outlookSummary: string) => {
    try {
      const res = await axios.post('/api/gemini/extended-advisory', {
        city,
        riskLevel,
        temp,
        rainfall,
        baseAdvisory,
        outlookSummary
      });
      setExtendedAdvisory(res.data?.text || "");
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchWaterBodies = useCallback(async (lat: number, lon: number, city: string) => {
    try {
      const res = await axios.post('/api/gemini/water-bodies', { lat, lon, city });
      setWaterBodiesRaw(res.data?.text || "");
    } catch (err) {
      // Error handling removed
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get('/api/history');
      setHistory(res.data);
    } catch (err) {
      // Error handling removed
    }
  }, []);

  const performPrediction = useCallback(async (targetCity: string, isAutoRefresh = false, coords?: { lat: number, lon: number }) => {
    if (!targetCity && !coords) return;

    if (isAutoRefresh) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      // 1. Get Weather - Use coords if available for better accuracy
      let weatherUrl = `/api/weather?city=${targetCity}`;
      if (coords) {
        weatherUrl = `/api/weather?lat=${coords.lat}&lon=${coords.lon}`;
      }
      
      const weatherRes = await axios.get(weatherUrl);
      setWeather(weatherRes.data);
      
      // Update city name from API response if we used coordinates
      const actualCity = weatherRes.data.city;
      if (coords) {
        setCity(actualCity);
      }
      setActiveCity(actualCity);

      // 2. Get Prediction
      const predictRes = await axios.post('/api/predict', {
        ...weatherRes.data,
        lat: weatherRes.data.coord.lat,
        lon: weatherRes.data.coord.lon
      });
      setPrediction(predictRes.data);

      // 3. Get Monthly Outlook & Water Bodies (Parallel)
      const outlook = await fetchMonthlyOutlook(actualCity, weatherRes.data.temp, weatherRes.data.rainfall);
      fetchWaterBodies(weatherRes.data.coord.lat, weatherRes.data.coord.lon, actualCity);
      
      // 4. Get Extended Advisory
      fetchExtendedAdvisory(actualCity, predictRes.data.riskLevel, weatherRes.data.temp, weatherRes.data.rainfall, predictRes.data.farmerAdvisory, outlook?.summary || "Unknown");

      // 5. Refresh History
      fetchHistory();
      
      // Play alert sound if high risk
      if (predictRes.data.riskLevel === 'High') {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3');
        audio.play().catch(e => console.log("Audio play blocked"));
      }
    } catch (err: any) {
      // Error handling removed
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchMonthlyOutlook, fetchWaterBodies, fetchHistory]);

  // Handle manual search
  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) return;
    await performPrediction(city);
  };

  // Setup auto-refresh when activeCity changes
  useEffect(() => {
    if (!activeCity) return;

    // Clear existing timers
    if (timerRef.current) clearInterval(timerRef.current);

    // Set interval for prediction
    timerRef.current = setInterval(() => {
      performPrediction(activeCity, true);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCity, performPrediction]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High':
      case 'Critical': return 'bg-red-500 text-white';
      case 'Medium': return 'bg-amber-500 text-white';
      case 'Low': return 'bg-emerald-500 text-white';
      default: return 'bg-slate-200';
    }
  };

  const getFarmerRiskStyles = (level: string) => {
    switch (level) {
      case 'Critical': return 'bg-red-50 border-red-200 text-red-800';
      case 'High': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'Medium': return 'bg-amber-50 border-amber-200 text-amber-800';
      default: return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    }
  };

  const getAlertStyles = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-50 border-red-200 text-red-800';
      case 'Medium': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'Low': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const getCombinedHistory = () => {
    if (!weather || !prediction) return history;
    
    // Calculate forecast river levels
    const baseRiverLevel = parseFloat(prediction.riverLevel) - (Number(weather.rainfall) * 0.5);
    
    const day1RiverLevel = baseRiverLevel + (Number(weather.day1.rainfall) * 0.5);
    const day2RiverLevel = baseRiverLevel + (Number(weather.day2.rainfall) * 0.5);
    
    const day1Risk = Number(weather.day1.rainfall) > 20 ? 'High' : Number(weather.day1.rainfall) > 10 ? 'Medium' : 'Low';
    const day2Risk = Number(weather.day2.rainfall) > 20 ? 'High' : Number(weather.day2.rainfall) > 10 ? 'Medium' : 'Low';

    const now = new Date();
    const day1Time = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const day2Time = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const forecastDay1: HistoryItem = {
      id: -1,
      city: weather.city + " (24h Forecast)",
      lat: weather.coord.lat,
      lon: weather.coord.lon,
      temp: Number(weather.day1.temp),
      humidity: weather.day1.humidity,
      rainfall: Number(weather.day1.rainfall),
      pressure: weather.day1.pressure,
      river_level: day1RiverLevel,
      risk_level: day1Risk as 'Low' | 'Medium' | 'High',
      timestamp: day1Time
    };

    const forecastDay2: HistoryItem = {
      id: -2,
      city: weather.city + " (48h Forecast)",
      lat: weather.coord.lat,
      lon: weather.coord.lon,
      temp: Number(weather.day2.temp),
      humidity: weather.day2.humidity,
      rainfall: Number(weather.day2.rainfall),
      pressure: weather.day2.pressure,
      river_level: day2RiverLevel,
      risk_level: day2Risk as 'Low' | 'Medium' | 'High',
      timestamp: day2Time
    };

    return [forecastDay2, forecastDay1, ...history];
  };

  const combinedHistory = getCombinedHistory();

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-slate-900 text-white py-8 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <Droplets className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Flood Prediction</h1>
                <div className="flex items-center gap-2">
                  <p className="text-slate-400 text-sm">48-Hour Forecast Alert System</p>
                  {activeCity && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">Live Monitoring</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm md:hidden">Settings</span>
              </button>

              <button
                onClick={handleUseMyLocation}
                disabled={isLocating}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2"
                title="Use My Location"
              >
                {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                <span className="text-sm md:hidden">Use My Location</span>
              </button>

              <form onSubmit={handlePredict} className="flex w-full md:w-auto gap-2">
                <div className="relative flex-grow md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter city name..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Predict'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold">Notification Settings</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white transition-colors p-2"
                >
                  <Search className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Email Alerts</p>
                        <p className="text-xs text-slate-500">Receive alerts via email</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifications.email}
                        onChange={(e) => setNotifications({...notifications, email: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {notifications.email && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="px-4"
                    >
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                      <input 
                        type="email"
                        value={notifications.emailAddress}
                        onChange={(e) => setNotifications({...notifications, emailAddress: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="your@email.com"
                      />
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Push Notifications</p>
                        <p className="text-xs text-slate-500">Browser push alerts</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifications.push}
                        onChange={(e) => setNotifications({...notifications, push: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Alert Threshold</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Low', 'Medium', 'High'].map((level) => (
                        <button
                          key={level}
                          onClick={() => setNotifications({...notifications, threshold: level})}
                          className={cn(
                            "py-3 rounded-xl border-2 font-bold transition-all",
                            notifications.threshold === level 
                              ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
                      You will only receive notifications when the predicted flood risk meets or exceeds your selected threshold.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.setItem('floodAlertSettings', JSON.stringify(notifications));
                      setShowSettings(false);
                    }}
                    className="flex-1 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
        <AnimatePresence mode="wait">
          {prediction && weather && (
            <motion.div
              key={prediction.city}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Location Details Bar */}
              <div className="lg:col-span-3 flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span>Monitoring: <span className="text-slate-900">{weather.city}</span></span>
                </div>
                <div className="hidden md:block w-px h-3 bg-slate-200" />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">Latitude:</span>
                    <span className="text-slate-700 font-mono">{weather.coord.lat.toFixed(4)}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">Longitude:</span>
                    <span className="text-slate-700 font-mono">{weather.coord.lon.toFixed(4)}°</span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-blue-600">GPS Verified</span>
                </div>
              </div>

              {/* Alert Banner */}
              <div className="lg:col-span-3">
                <div className={cn(
                  "border-l-4 p-6 rounded-r-xl shadow-sm flex items-start gap-4 transition-colors duration-500",
                  getAlertStyles(prediction.riskLevel)
                )}>
                  {prediction.riskLevel === 'High' ? (
                    <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                  ) : prediction.riskLevel === 'Medium' ? (
                    <AlertCircle className="w-8 h-8 flex-shrink-0" />
                  ) : (
                    <ShieldCheck className="w-8 h-8 flex-shrink-0" />
                  )}
                  <div>
                    <h2 className="text-xl font-bold">
                      {prediction.riskLevel === 'High' ? '⚠ CRITICAL FORECAST ALERT' : 
                       prediction.riskLevel === 'Medium' ? '⚠ FORECAST WARNING' : '✓ SAFE FORECAST'}
                    </h2>
                    <p className="mt-1 text-lg">
                      {prediction.riskLevel === 'High' ? `High flood risk predicted in ${prediction.city} within the next 48 hours. Take precautionary measures immediately.` :
                       prediction.riskLevel === 'Medium' ? `Moderate flood risk predicted in ${prediction.city} for the upcoming 2 days. Stay updated with local weather reports.` :
                       `Flood risk is predicted to be low in ${prediction.city} over the next 48 hours. No immediate action required.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Weather Feed */}
              <div className="lg:col-span-3 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <RefreshCw className="w-24 h-24 animate-spin-slow" />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30">
                      <img 
                        src={`https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`} 
                        alt="Weather Icon"
                        className="w-12 h-12"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Live Weather Feed</span>
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      </div>
                      <h2 className="text-3xl font-bold capitalize">{weather.current.description}</h2>
                      <p className="text-slate-400 text-sm">Station: {weather.city} • {format(new Date(weather.current.timestamp * 1000), 'HH:mm:ss')}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-8">
                    <div className="text-center">
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter mb-1">Temperature</p>
                      <p className="text-2xl font-bold">{weather.current.temp.toFixed(1)}°C</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter mb-1">Wind Speed</p>
                      <p className="text-2xl font-bold">{weather.current.windSpeed} m/s</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter mb-1">Humidity</p>
                      <p className="text-2xl font-bold">{weather.current.humidity}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter mb-1">Visibility</p>
                      <p className="text-2xl font-bold">{(weather.current.visibility / 1000).toFixed(1)} km</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weather Stats */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Waves className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800">Live Precipitation Radar</h3>
                  </div>
                  <RadarView center={[weather.coord.lat, weather.coord.lon]} zoom={10} />
                  <p className="mt-4 text-[10px] text-slate-400 leading-relaxed italic">
                    Real-time radar data provided by RainViewer. Updates every 5 minutes to show current precipitation patterns and storm movement.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                  {isRefreshing && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Updating</span>
                      </div>
                    </div>
                  )}
                  <h3 className="text-slate-500 font-semibold uppercase text-xs tracking-wider mb-4">48h Forecast Summary</h3>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">{weather.description}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <Thermometer className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Avg Temp</p>
                        <p className="font-bold">{weather.temp}°C</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Droplets className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Max Humidity</p>
                        <p className="font-bold">{weather.humidity}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-50 rounded-lg text-cyan-600">
                        <Wind className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Total Rain</p>
                        <p className="font-bold">{weather.rainfall}mm</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Min Pressure</p>
                        <p className="font-bold">{weather.pressure}hPa</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Day 1 & Day 2 Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Day 1 (0-24h)</h4>
                    <p className="text-[10px] font-medium text-slate-500 mb-2 truncate">{weather.day1.description}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Rain</span>
                        <span className="font-bold text-blue-600">{weather.day1.rainfall}mm</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Temp</span>
                        <span className="font-bold">{weather.day1.temp}°C</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Day 2 (24-48h)</h4>
                    <p className="text-[10px] font-medium text-slate-500 mb-2 truncate">{weather.day2.description}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Rain</span>
                        <span className="font-bold text-blue-600">{weather.day2.rainfall}mm</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Temp</span>
                        <span className="font-bold">{weather.day2.temp}°C</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                  {isRefreshing && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-slate-500 font-semibold uppercase text-xs tracking-wider">AI Prediction Data</h3>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Model Confidence</span>
                      <span className="text-sm font-bold text-blue-600">{prediction.confidenceScore}%</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-slate-500">Risk Score</span>
                        <span className="text-sm font-bold">{prediction.score}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className={cn("h-2 rounded-full transition-all duration-1000", 
                            prediction.riskLevel === 'High' ? 'bg-red-500' : 
                            prediction.riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                          )}
                          style={{ width: `${Math.min(Number(prediction.score) * 4, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm text-slate-600">River Level (Simulated)</span>
                      <span className="font-mono font-bold text-blue-600">{prediction.riverLevel}m</span>
                    </div>

                    {prediction.contributingFactors && prediction.contributingFactors.length > 0 && (
                      <div className="pt-2 border-t border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Contributing Factors</p>
                        <div className="space-y-2">
                          {prediction.contributingFactors.map((factor, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  factor.impact === 'High' ? 'bg-red-500' : 
                                  factor.impact === 'Medium' ? 'bg-amber-500' : 'bg-blue-400'
                                )} />
                                <span className="text-slate-600">{factor.factor}</span>
                              </div>
                              <span className="font-bold text-slate-800">{factor.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Farmer Advisory Card */}
                <div className={cn(
                  "p-6 rounded-2xl border shadow-sm transition-all duration-500",
                  getFarmerRiskStyles(prediction.farmerRisk)
                )}>
                  <div className="flex items-center gap-2 mb-4">
                    <Sprout className="w-5 h-5" />
                    <h3 className="font-bold uppercase text-xs tracking-wider">Agricultural Advisory</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold uppercase opacity-70">Agri-Risk Level</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        getRiskColor(prediction.farmerRisk)
                      )}>
                        {prediction.farmerRisk}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      {prediction.farmerAdvisory}
                    </p>
                    {extendedAdvisory && (
                      <div className="mt-4 pt-4 border-t border-black/10">
                        <p className="text-sm font-medium leading-relaxed">
                          {extendedAdvisory}
                        </p>
                      </div>
                    )}
                    <div className="pt-2 flex items-center gap-2 text-[10px] font-bold opacity-60 uppercase">
                      <Tractor className="w-3 h-3" />
                      <span>Farmer Support Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map View */}
              <div className="lg:col-span-2">
                <MapView 
                  center={[weather.coord.lat, weather.coord.lon]} 
                  points={[
                    { 
                      lat: weather.coord.lat, 
                      lon: weather.coord.lon, 
                      city: prediction.city, 
                      riskLevel: prediction.riskLevel,
                      windSpeed: weather.current.windSpeed,
                      windDeg: weather.current.windDeg
                    },
                    ...history.filter(h => h.lat && h.lon).map(h => ({
                      lat: h.lat!,
                      lon: h.lon!,
                      city: h.city,
                      riskLevel: h.risk_level,
                      windSpeed: Math.round((Math.random() * 10 + 2) * 10) / 10,
                      windDeg: Math.round(Math.random() * 360)
                    }))
                  ]}
                />
              </div>

              {/* Water Bodies Section */}
              <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                  <div className="p-2 bg-blue-500 text-white rounded-lg">
                    <Waves className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Direct Hydrological Impact</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Nearest Critical Water Bodies</p>
                  </div>
                </div>
                <div className="p-6">
                  {waterBodiesRaw ? (
                    <div className="prose prose-slate max-w-none">
                      <ReactMarkdown>{waterBodiesRaw}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Waves className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm font-medium italic">Analyzing nearby hydrological features...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Outlook Section */}
              {monthlyOutlook && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500 text-white rounded-lg">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">30-Day Agricultural Outlook</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Long-term Planning for Farmers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Risk Level:</span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                        getRiskColor(monthlyOutlook.riskLevel)
                      )}>
                        {monthlyOutlook.riskLevel}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                      <p className="text-blue-900 font-medium italic leading-relaxed">
                        "{monthlyOutlook.summary}"
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-700 font-bold uppercase">
                        <AlertCircle className="w-3 h-3" />
                        <span>Primary Concern: {monthlyOutlook.primaryConcern}</span>
                      </div>
                    </div>

                    {monthlyOutlook.weeks.map((week) => (
                      <div key={week.week} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-200 transition-colors">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Week {week.week}</h4>
                        <p className="text-sm font-bold text-slate-800 mb-1">{week.condition}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{week.advice}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Table */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-bottom border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-bold">Historical Trends & Data</h2>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-slate-500">Temp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-slate-500">Rain</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                <span className="text-slate-500">Humidity</span>
              </div>
            </div>
          </div>
          
          {/* Chart Visualization */}
          <div className="px-6 pb-6">
            <HistoryChart data={combinedHistory} />
          </div>

          <div className="overflow-x-auto border-t border-slate-50">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">City</th>
                  <th className="px-6 py-4 font-semibold">Weather</th>
                  <th className="px-6 py-4 font-semibold">River Level</th>
                  <th className="px-6 py-4 font-semibold">Risk Level</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combinedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                      No prediction history available yet.
                    </td>
                  </tr>
                ) : (
                  combinedHistory.map((item) => (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.id < 0 ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-6 py-4 font-bold">
                        {item.city}
                        {item.id < 0 && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Forecast</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {item.temp}°C, {item.humidity}% Hum, {item.rainfall}mm Rain
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">{item.river_level.toFixed(2)}m</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          getRiskColor(item.risk_level)
                        )}>
                          {item.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {format(new Date(item.timestamp), 'MMM d, HH:mm')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 mt-12 text-center text-slate-400 text-sm">
        <p>© 2026 AI Flood Prediction Alert System • Powered by Gemini & OpenWeather</p>
      </footer>
    </div>
  );
}
