import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon not showing correctly in some setups
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const createCustomIcon = (bgColor: string, shape: 'circle' | 'square' = 'circle', isPulsing: boolean = false, iconText: string = '') => L.divIcon({
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
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface MapProps {
  hospitals: any[];
  ambulances: any[];
  incidents: any[];
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapComponent({ hospitals, ambulances, incidents, onMapClick }: MapProps) {
  const center = { lat: 28.6139, lng: 77.2090 };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapEvents onMapClick={onMapClick} />
        
        {hospitals.map((h: any) => (
          <Marker 
            key={h.id} 
            position={[h.lat, h.lng]} 
            icon={h.currentLoad >= h.capacity ? hospitalFullIcon : hospitalIcon}
          >
            <Popup>
              <strong>{h.name}</strong><br />
              Capacity: {h.currentLoad} / {h.capacity}
            </Popup>
          </Marker>
        ))}

        {ambulances.map((a: any) => (
          <Marker 
            key={a.id} 
            position={[a.lat, a.lng]} 
            icon={a.status === 'free' ? ambulanceFreeIcon : ambulanceBusyIcon}
          >
            <Popup>
              <strong>{a.name}</strong><br />
              Status: {a.status}
            </Popup>
          </Marker>
        ))}

        {/* Draw tracking lines for busy ambulances */}
        {ambulances.filter((a: any) => a.target).map((a: any) => {
          const positions = [[a.lat, a.lng]];
          if (a.route && a.route.length > 0) {
            positions.push(...a.route.map((p: any) => [p.lat, p.lng]));
          } else {
            positions.push([a.target.lat, a.target.lng]);
          }
          return (
            <Polyline
              key={`route-${a.id}`}
              positions={positions as [number, number][]}
              pathOptions={{
                color: a.incidentId ? '#D90429' : '#3A86FF', // Red when heading to incident, Blue when heading to hospital
                dashArray: a.route ? undefined : '8, 8', // solid if road route available
                weight: 4,
                opacity: 0.8
              }}
            />
          );
        })}

        {incidents.filter(i => i.status !== 'resolved').map((i: any) => (
          <Marker 
            key={i.id} 
            position={[i.lat, i.lng]} 
            icon={incidentIcon}
          >
            <Popup>
              Emergency<br />
              Status: {i.status}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
    </div>
  );
}
