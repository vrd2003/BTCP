import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import airports from './data/airports.json';
import 'leaflet/dist/leaflet.css';

const airportIcon = L.divIcon({
  className: 'flight-map-airport-icon',
  html: '<span></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

export default function FlightRouteMap({ origin, destination }) {
  const departure = airports[origin];
  const arrival = airports[destination];
  const missingAirports = [!departure ? origin : null, !arrival ? destination : null].filter(Boolean).join(' and ');
  const positions = useMemo(() => departure && arrival ? [
    [departure.latitude, departure.longitude],
    [arrival.latitude, arrival.longitude]
  ] : [], [departure, arrival]);
  const routePath = useMemo(() => positions.length ? createGreatCirclePath(positions[0], positions[1]) : [], [positions]);

  if (!/^[A-Z]{3}$/.test(origin || '') || !/^[A-Z]{3}$/.test(destination || '')) {
    return <MapMessage>Enter valid three-letter IATA airport codes to view the route.</MapMessage>;
  }
  if (!departure || !arrival) {
    return <MapMessage>Airport coordinates are unavailable for {missingAirports}. Try a scheduled airport with a three-letter IATA code.</MapMessage>;
  }

  return (
    <div className="flight-route-map">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={12}
        scrollWheelZoom={false}
        zoomControl
        worldCopyJump
        role="region"
        aria-label={`Map route from ${origin} to ${destination}`}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RouteViewport positions={positions} />
        <Polyline positions={routePath} pathOptions={{ color: '#22D3EE', opacity: 0.9, weight: 3 }} />
        <Marker position={positions[0]} icon={airportIcon} title={`${origin} airport`}>
          <Tooltip permanent direction="top" offset={[0, -8]}>{origin}</Tooltip>
        </Marker>
        <Marker position={positions[1]} icon={airportIcon} title={`${destination} airport`}>
          <Tooltip permanent direction="top" offset={[0, -8]}>{destination}</Tooltip>
        </Marker>
      </MapContainer>
      <div className="flight-map-label">{origin} <span>→</span> {destination}</div>
      <div className="flight-map-disclaimer">ROUTE ONLY · LIVE AIRCRAFT POSITION UNAVAILABLE</div>
    </div>
  );
}

function RouteViewport({ positions }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(positions, { padding: [48, 48], maxZoom: 5 });
  }, [map, positions]);

  return null;
}

export function createGreatCirclePath(start, end, segments = 48) {
  const toVector = ([latitude, longitude]) => {
    const lat = latitude * Math.PI / 180;
    const lng = longitude * Math.PI / 180;
    return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
  };
  const from = toVector(start);
  const to = toVector(end);
  const dot = from.reduce((sum, value, index) => sum + value * to[index], 0);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinAngle = Math.sin(angle);

  if (Math.abs(sinAngle) < 1e-6) return [start, end];

  return Array.from({ length: segments + 1 }, (_, index) => {
    if (index === 0) return start;
    if (index === segments) return end;
    const progress = index / segments;
    const fromWeight = Math.sin((1 - progress) * angle) / sinAngle;
    const toWeight = Math.sin(progress * angle) / sinAngle;
    const vector = from.map((value, axis) => value * fromWeight + to[axis] * toWeight);
    const latitude = Math.atan2(vector[2], Math.hypot(vector[0], vector[1])) * 180 / Math.PI;
    const longitude = Math.atan2(vector[1], vector[0]) * 180 / Math.PI;
    return [latitude, longitude];
  });
}

function MapMessage({ children }) {
  return <div className="flight-map-state" role="status">{children}</div>;
}
