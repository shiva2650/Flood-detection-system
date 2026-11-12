import {
  MapContainer as LeafletMapContainer,
  TileLayer as LeafletTileLayer,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  Circle as LeafletCircle,
  Popup,
  useMap,
} from 'react-leaflet';
import { useEffect, useState } from 'react';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const MapContainer = LeafletMapContainer as any;
const TileLayer = LeafletTileLayer as any;
const Marker = LeafletMarker as any;
const Polyline = LeafletPolyline as any;
const Circle = LeafletCircle as any;

export interface MapPoint {
  lat: number;
  lon: number;
  city: string;
  riskLevel: string;
  windSpeed?: number;
  windDeg?: number;
}

export interface GisSosMarker {
  id: number;
  trackingId: string;
  citizenName: string;
  lat: number;
  lon: number;
  category: string;
  priority: string;
  peopleCount: number;
  waterDepthCm?: number;
  status: string;
  clusterId?: string;
}

export interface GisTeamMarker {
  id: number;
  teamCode: string;
  name: string;
  specialization: string;
  lat: number;
  lon: number;
  status: string;
  equipment: string;
}

export interface GisShelterMarker {
  id: number;
  shelterCode: string;
  name: string;
  lat: number;
  lon: number;
  totalCapacity: number;
  occupiedCapacity: number;
  availableBeds: number;
  status: string;
}

interface MapViewProps {
  center: [number, number];
  points: MapPoint[];
  sosMarkers?: GisSosMarker[];
  teamMarkers?: GisTeamMarker[];
  shelterMarkers?: GisShelterMarker[];
  showRoutes?: boolean;
  heightClass?: string;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
}

export default function MapView({
  center,
  points,
  sosMarkers = [],
  teamMarkers = [],
  shelterMarkers = [],
  showRoutes = true,
  heightClass = 'h-[440px]',
}: MapViewProps) {
  const [layerFilter, setLayerFilter] = useState<'all' | 'risk' | 'sos' | 'rescue' | 'shelters'>('all');

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical':
      case 'High':
        return 'bg-red-500 border-red-600';
      case 'Moderate':
      case 'Medium':
        return 'bg-amber-500 border-amber-600';
      default:
        return 'bg-emerald-500 border-emerald-600';
    }
  };

  const getRiskSize = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical':
      case 'High':
        return 38;
      case 'Moderate':
      case 'Medium':
        return 30;
      default:
        return 22;
    }
  };

  const createCustomIcon = (point: MapPoint) => {
    const size = getRiskSize(point.riskLevel);
    const colorClass = getRiskColor(point.riskLevel);

    let windHtml = '';
    if (point.windSpeed !== undefined && point.windDeg !== undefined) {
      const animDuration = Math.max(0.5, 3 - point.windSpeed / 10);
      windHtml = `
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="transform: rotate(${point.windDeg}deg);">
          <div class="w-0.5 h-8 bg-sky-400/70 origin-bottom transform -translate-y-4">
            <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-sky-400 absolute -top-1 -left-[3px] animate-pulse" style="animation-duration: ${animDuration}s"></div>
          </div>
        </div>
      `;
    }

    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-full h-full">
          <div class="${colorClass} rounded-full border-2 shadow-md relative z-10 flex items-center justify-center text-white text-[10px] font-bold" style="width: ${size}px; height: ${size}px;">
          </div>
          ${windHtml}
        </div>
      `,
      className: 'custom-marker',
      iconSize: [size + 20, size + 20],
      iconAnchor: [(size + 20) / 2, (size + 20) / 2],
      // @ts-ignore
      riskLevel: point.riskLevel,
    });
  };

  const createSosIcon = (priority: string) => {
    const bg =
      priority === 'P0'
        ? 'bg-red-600 border-red-200'
        : priority === 'P1'
        ? 'bg-orange-500 border-orange-200'
        : priority === 'P2'
        ? 'bg-amber-500 border-amber-200'
        : 'bg-sky-600 border-sky-200';
    return L.divIcon({
      html: `<div class="${bg} text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border-2 shadow-lg whitespace-nowrap">${priority} SOS</div>`,
      className: 'sos-gis-marker',
      iconSize: [48, 22],
      iconAnchor: [24, 11],
    });
  };

  const createTeamIcon = (code: string) =>
    L.divIcon({
      html: `<div class="bg-indigo-600 border-2 border-indigo-200 text-white text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">${code}</div>`,
      className: 'team-gis-marker',
      iconSize: [56, 22],
      iconAnchor: [28, 11],
    });

  const createShelterIcon = (code: string) =>
    L.divIcon({
      html: `<div class="bg-emerald-600 border-2 border-emerald-200 text-white text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">${code}</div>`,
      className: 'shelter-gis-marker',
      iconSize: [52, 22],
      iconAnchor: [26, 11],
    });

  const createClusterCustomIcon = (cluster: any) => {
    const markers = cluster.getAllChildMarkers();
    let high = 0;
    let medium = 0;

    markers.forEach((marker: any) => {
      const risk = marker.options.icon?.options?.riskLevel;
      if (risk === 'High' || risk === 'Critical') high++;
      else if (risk === 'Medium' || risk === 'Moderate') medium++;
    });

    let bgColor = 'bg-emerald-600';
    let size = 32;

    if (high > 0) {
      bgColor = 'bg-red-600';
      size = 44;
    } else if (medium > 0) {
      bgColor = 'bg-amber-500';
      size = 38;
    }

    return L.divIcon({
      html: `<div class="${bgColor} text-white rounded-full flex items-center justify-center font-mono text-xs font-bold shadow-lg border-2 border-white" style="width: ${size}px; height: ${size}px;">${markers.length}</div>`,
      className: 'custom-marker-cluster',
      iconSize: L.point(size, size, true),
    });
  };

  // Safe Evacuation Corridor vs Blocked Flooded Roadway (relative to map center)
  const blockedRoadCoords: [number, number][] = [
    [center[0] - 0.008, center[1] - 0.012],
    [center[0] - 0.002, center[1] - 0.003],
    [center[0] + 0.002, center[1] + 0.005],
  ];

  const safeRouteCoords: [number, number][] = [
    [center[0] - 0.009, center[1] - 0.008],
    [center[0] + 0.012, center[1] - 0.015],
    [center[0] + 0.028, center[1] + 0.012],
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {[
            { id: 'all', label: 'All GIS Layers' },
            { id: 'risk', label: 'Flood & Wind' },
            { id: 'sos', label: `Citizen SOS (${sosMarkers.length})` },
            { id: 'rescue', label: `Rescue & Safe Routes (${teamMarkers.length})` },
            { id: 'shelters', label: `Shelters (${shelterMarkers.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLayerFilter(tab.id as any)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                layerFilter === tab.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Solid Green: Provisional Safe Corridor</span>
          <span aria-hidden="true">·</span>
          <span>Dashed Red: Submerged / Blocked Road</span>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className={`${heightClass} w-full rounded-xl border border-slate-800 z-0`}
      >
        <ChangeView center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Flood Inundation Zone Overlay */}
        {(layerFilter === 'all' || layerFilter === 'risk') && (
          <Circle
            center={center}
            radius={1400}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.14,
              weight: 1,
            }}
          />
        )}

        {/* Safe Route vs Blocked Road Polylines */}
        {showRoutes && (layerFilter === 'all' || layerFilter === 'rescue') && (
          <>
            <Polyline
              positions={blockedRoadCoords}
              pathOptions={{ color: '#dc2626', weight: 4, dashArray: '8, 8' }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-red-600">BLOCKED ROAD: Low-Level Causeway</p>
                  <p>Submerged under 1.4m floodwater. Impassable for standard vehicles.</p>
                </div>
              </Popup>
            </Polyline>
            <Polyline
              positions={safeRouteCoords}
              pathOptions={{ color: '#16a34a', weight: 4 }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-emerald-700">
                    PROVISIONAL SAFE EVACUATION CORRIDOR (NH-65 High Ridge)
                  </p>
                  <p>Distance: 6.4 km · Elevated grade avoiding submerged basin roads.</p>
                </div>
              </Popup>
            </Polyline>
          </>
        )}

        {/* Weather & Flood Risk Markers with Wind Vectors */}
        {(layerFilter === 'all' || layerFilter === 'risk') && (
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
                  <div className="font-sans text-xs space-y-1">
                    <p className="font-bold text-slate-900">{point.city}</p>
                    <p>
                      Risk Level: <span className="font-semibold">{point.riskLevel}</span>
                    </p>
                    {point.windSpeed !== undefined && (
                      <p className="text-slate-600 tabular-nums">
                        Wind: {point.windSpeed} m/s at {point.windDeg}°
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}

        {/* Citizen SOS Markers */}
        {(layerFilter === 'all' || layerFilter === 'sos') &&
          sosMarkers.map((sos) => (
            <Marker
              key={`sos-${sos.id}`}
              position={[sos.lat, sos.lon]}
              icon={createSosIcon(sos.priority)}
            >
              <Popup>
                <div className="font-sans text-xs space-y-1">
                  <p className="font-bold text-slate-900">
                    {sos.trackingId} · {sos.priority} ({sos.category})
                  </p>
                  <p>Citizen: {sos.citizenName}</p>
                  <p className="tabular-nums">
                    People Trapped: {sos.peopleCount} · Water Depth: {sos.waterDepthCm || 0} cm
                  </p>
                  <p>
                    Status: <span className="font-semibold">{sos.status}</span>
                    {sos.clusterId ? ` · Cluster ${sos.clusterId}` : ''}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Rescue Team Live Markers */}
        {(layerFilter === 'all' || layerFilter === 'rescue') &&
          teamMarkers.map((team) => (
            <Marker
              key={`team-${team.id}`}
              position={[team.lat, team.lon]}
              icon={createTeamIcon(team.teamCode)}
            >
              <Popup>
                <div className="font-sans text-xs space-y-1">
                  <p className="font-bold text-slate-900">
                    {team.name} ({team.teamCode})
                  </p>
                  <p>Specialization: {team.specialization}</p>
                  <p>Status: {team.status}</p>
                  <p className="text-slate-600">{team.equipment}</p>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Smart Shelter Markers */}
        {(layerFilter === 'all' || layerFilter === 'shelters') &&
          shelterMarkers.map((sh) => (
            <Marker
              key={`shelter-${sh.id}`}
              position={[sh.lat, sh.lon]}
              icon={createShelterIcon(sh.shelterCode)}
            >
              <Popup>
                <div className="font-sans text-xs space-y-1">
                  <p className="font-bold text-slate-900">
                    {sh.name} ({sh.shelterCode})
                  </p>
                  <p className="tabular-nums">
                    Occupancy: {sh.occupiedCapacity}/{sh.totalCapacity} ({sh.availableBeds} beds available)
                  </p>
                  <p>Status: {sh.status}</p>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
