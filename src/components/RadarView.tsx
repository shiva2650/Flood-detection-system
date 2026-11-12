import React, { useEffect, useState } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer as LeafletTileLayer, Marker as LeafletMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapContainer = LeafletMapContainer as any;
const TileLayer = LeafletTileLayer as any;
const Marker = LeafletMarker as any;

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RadarViewProps {
  center: [number, number];
  zoom?: number;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function RadarView({ center, zoom = 6 }: RadarViewProps) {
  const [radarPath, setRadarPath] = useState<string | null>(null);

  useEffect(() => {
    const fetchRadarPath = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
          // Get the most recent past radar data
          const latest = data.radar.past[data.radar.past.length - 1];
          setRadarPath(latest.path);
        }
      } catch (error) {
        // Error handling removed
      }
    };

    fetchRadarPath();
    const interval = setInterval(fetchRadarPath, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <ChangeView center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} />
        {radarPath && (
          <TileLayer
            attribution='&copy; <a href="https://www.rainviewer.com/api.html">RainViewer</a>'
            url={`https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.6}
            zIndex={100}
          />
        )}
      </MapContainer>
      
      {/* Radar Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-lg text-[10px] font-bold uppercase tracking-wider">
        <p className="mb-2 text-slate-500">Precipitation Intensity</p>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[#7cfc00] rounded-sm" />
          <div className="w-3 h-3 bg-[#00ff00] rounded-sm" />
          <div className="w-3 h-3 bg-[#008000] rounded-sm" />
          <div className="w-3 h-3 bg-[#ffff00] rounded-sm" />
          <div className="w-3 h-3 bg-[#ffa500] rounded-sm" />
          <div className="w-3 h-3 bg-[#ff0000] rounded-sm" />
          <div className="w-3 h-3 bg-[#8b0000] rounded-sm" />
          <span className="ml-2 text-slate-400">Light &rarr; Heavy</span>
        </div>
      </div>

      {/* Live Indicator */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        Live Radar Feed
      </div>
    </div>
  );
}
