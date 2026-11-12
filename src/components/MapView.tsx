import { MapContainer as LeafletMapContainer, TileLayer as LeafletTileLayer, Marker as LeafletMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const MapContainer = LeafletMapContainer as any;
const TileLayer = LeafletTileLayer as any;
const Marker = LeafletMarker as any;

interface MapPoint {
  lat: number;
  lon: number;
  city: string;
  riskLevel: string;
  windSpeed?: number;
  windDeg?: number;
}

interface MapViewProps {
  center: [number, number];
  points: MapPoint[];
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
}

export default function MapView({ center, points }: MapViewProps) {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'High': return 'bg-red-500 border-red-600';
      case 'Medium': return 'bg-amber-500 border-amber-600';
      default: return 'bg-emerald-500 border-emerald-600';
    }
  };

  const getRiskSize = (riskLevel: string) => {
    switch (riskLevel) {
      case 'High': return 40;
      case 'Medium': return 30;
      default: return 20;
    }
  };

  const createCustomIcon = (point: MapPoint) => {
    const size = getRiskSize(point.riskLevel);
    const colorClass = getRiskColor(point.riskLevel);
    
    // Create wind arrow HTML if wind data is available
    let windHtml = '';
    if (point.windSpeed !== undefined && point.windDeg !== undefined) {
      // Wind speed determines animation speed (faster wind = faster animation)
      const animDuration = Math.max(0.5, 3 - (point.windSpeed / 10));
      
      windHtml = `
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="transform: rotate(${point.windDeg}deg);">
          <div class="w-0.5 h-8 bg-blue-500/50 origin-bottom transform -translate-y-4">
            <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-blue-600 absolute -top-1 -left-[3px] animate-pulse" style="animation-duration: ${animDuration}s"></div>
          </div>
        </div>
      `;
    }

    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-full h-full">
          <div class="${colorClass} rounded-full opacity-60 absolute inset-0 animate-ping" style="animation-duration: 3s;"></div>
          <div class="${colorClass} rounded-full border-2 shadow-md relative z-10 flex items-center justify-center text-white text-xs font-bold" style="width: ${size}px; height: ${size}px;">
          </div>
          ${windHtml}
        </div>
      `,
      className: 'custom-marker',
      iconSize: [size + 20, size + 20], // Make room for wind arrow
      iconAnchor: [(size + 20) / 2, (size + 20) / 2],
      // @ts-ignore - custom property for clustering logic
      riskLevel: point.riskLevel
    });
  };

  const createClusterCustomIcon = (cluster: any) => {
    const markers = cluster.getAllChildMarkers();
    let high = 0;
    let medium = 0;
    
    markers.forEach((marker: any) => {
      const risk = marker.options.icon?.options?.riskLevel;
      if (risk === 'High') high++;
      else if (risk === 'Medium') medium++;
    });

    let bgColor = 'bg-emerald-500';
    let size = 30;
    
    if (high > 0) {
      bgColor = 'bg-red-500';
      size = 50;
    } else if (medium > 0) {
      bgColor = 'bg-amber-500';
      size = 40;
    }

    return L.divIcon({
      html: `<div class="${bgColor} text-white rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white" style="width: ${size}px; height: ${size}px;">${markers.length}</div>`,
      className: 'custom-marker-cluster',
      iconSize: L.point(size, size, true),
    });
  };

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-[400px] w-full rounded-xl shadow-inner border border-slate-200 z-0">
      <ChangeView center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={40}
        showCoverageOnHover={false}
        iconCreateFunction={createClusterCustomIcon}
      >
        {points.map((point, idx) => (
          <Marker 
            key={`${point.city}-${idx}`}
            position={[point.lat, point.lon]} 
            icon={createCustomIcon(point)}
          >
            <Popup>
              <div className="font-sans">
                <p className="font-bold">{point.city}</p>
                <p>Risk Level: <span className={`font-bold ${point.riskLevel === 'High' ? 'text-red-600' : point.riskLevel === 'Medium' ? 'text-orange-500' : 'text-green-600'}`}>{point.riskLevel}</span></p>
                {point.windSpeed !== undefined && (
                  <p className="text-xs text-slate-500 mt-1">Wind: {point.windSpeed} m/s at {point.windDeg}°</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
