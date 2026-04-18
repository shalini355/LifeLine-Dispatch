import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Region = 'North' | 'South' | 'East' | 'West' | 'Central' | 'Northeast';
type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string;
  region: Region;
  lat: number;
  lng: number;
  capacity: number;
  currentLoad: number;
};
type Ambulance = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'free' | 'busy' | 'returning';
  target?: { lat: number; lng: number };
  route?: Array<{ lat: number; lng: number }>;
  incidentId?: string;
};
type Incident = {
  id: string;
  lat: number;
  lng: number;
  status: 'unassigned' | 'assigned' | 'resolved';
};

const createCustomIcon = (
  bgColor: string,
  shape: 'circle' | 'square' = 'circle',
  isPulsing = false,
  iconText = ''
) =>
  L.divIcon({
    html: `<div class="w-full h-full border-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.2)] flex items-center justify-center text-[10px] text-white font-black ${shape === 'circle' ? 'rounded-full' : 'rounded-sm'} ${isPulsing ? 'animate-pulse' : ''}" style="background-color: ${bgColor};">
    ${iconText}
  </div>`,
    className: 'custom-leaflet-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });

const hospitalIcon = createCustomIcon('var(--color-clean-success)', 'square', false, 'H');
const hospitalFullIcon = createCustomIcon('var(--color-clean-primary)', 'square', false, 'H');
const ambulanceFreeIcon = createCustomIcon('var(--color-clean-success)', 'circle', false, 'A');
const ambulanceBusyIcon = createCustomIcon('var(--color-clean-secondary)', 'circle', false, 'A');
const incidentIcon = createCustomIcon('var(--color-clean-primary)', 'circle', true, '!');

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

interface MapProps {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapComponent({ hospitals, ambulances, incidents, onMapClick }: MapProps) {
  const center: LatLngTuple = [22.9734, 78.6569];

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapEvents onMapClick={onMapClick} />

        {hospitals.map((hospital) => (
          <Marker
            key={hospital.id}
            position={[hospital.lat, hospital.lng]}
            icon={hospital.currentLoad >= hospital.capacity ? hospitalFullIcon : hospitalIcon}
          >
            <Popup>
              <strong>{hospital.name}</strong><br />
              {hospital.city}, {hospital.state}<br />
              Region: {hospital.region}<br />
              Capacity: {hospital.currentLoad} / {hospital.capacity}
            </Popup>
          </Marker>
        ))}

        {ambulances.map((ambulance) => (
          <Marker
            key={ambulance.id}
            position={[ambulance.lat, ambulance.lng]}
            icon={ambulance.status === 'free' ? ambulanceFreeIcon : ambulanceBusyIcon}
          >
            <Popup>
              <strong>{ambulance.name}</strong><br />
              Status: {ambulance.status}
            </Popup>
          </Marker>
        ))}

        {ambulances.filter((ambulance) => ambulance.target).map((ambulance) => {
          const positions: LatLngTuple[] = [[ambulance.lat, ambulance.lng]];

          if (ambulance.route && ambulance.route.length > 0) {
            positions.push(...ambulance.route.map((point): LatLngTuple => [point.lat, point.lng]));
          } else if (ambulance.target) {
            positions.push([ambulance.target.lat, ambulance.target.lng]);
          }

          return (
            <Polyline
              key={`route-${ambulance.id}`}
              positions={positions}
              pathOptions={{
                color: ambulance.incidentId ? '#D90429' : '#3A86FF',
                dashArray: ambulance.route ? undefined : '8, 8',
                weight: 4,
                opacity: 0.8
              }}
            />
          );
        })}

        {incidents.filter((incident) => incident.status !== 'resolved').map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.lat, incident.lng]}
            icon={incidentIcon}
          >
            <Popup>
              Emergency<br />
              Status: {incident.status}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
