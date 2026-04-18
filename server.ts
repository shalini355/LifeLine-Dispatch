import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

type Point = { lat: number; lng: number };
type Region = 'North' | 'South' | 'East' | 'West' | 'Central' | 'Northeast';
type Hospital = Point & {
  id: string;
  name: string;
  city: string;
  state: string;
  region: Region;
  capacity: number;
  currentLoad: number;
};
type Ambulance = Point & {
  id: string;
  name: string;
  status: 'free' | 'busy' | 'returning';
  baseHospitalId: string;
  incidentId?: string;
  hospitalId?: string;
  target?: Point;
  eta?: number;
  route?: Point[];
};
type Incident = Point & {
  id: string;
  status: 'unassigned' | 'assigned' | 'resolved';
  severity: string;
  assignedAmbulance?: string;
  etaMin?: number;
  inferredState?: string;
  inferredRegion?: Region;
};
type NotificationMessage = { id: string; type: 'success' | 'info'; message: string; timestamp: number };
type Severity = 'low' | 'medium' | 'high' | 'critical';

let notifications: NotificationMessage[] = [];

const hospitalSeeds: Array<Omit<Hospital, 'currentLoad'>> = [
  { id: 'h1', name: 'AIIMS New Delhi', city: 'New Delhi', state: 'Delhi', region: 'North', lat: 28.5672, lng: 77.21, capacity: 14 },
  { id: 'h2', name: 'Safdarjung Hospital', city: 'New Delhi', state: 'Delhi', region: 'North', lat: 28.5674, lng: 77.2056, capacity: 12 },
  { id: 'h3', name: 'PGIMER', city: 'Chandigarh', state: 'Chandigarh', region: 'North', lat: 30.7649, lng: 76.7754, capacity: 11 },
  { id: 'h4', name: 'Government Medical College', city: 'Amritsar', state: 'Punjab', region: 'North', lat: 31.634, lng: 74.8723, capacity: 8 },
  { id: 'h5', name: 'SMS Hospital', city: 'Jaipur', state: 'Rajasthan', region: 'North', lat: 26.902, lng: 75.8195, capacity: 10 },
  { id: 'h6', name: 'King George Medical University', city: 'Lucknow', state: 'Uttar Pradesh', region: 'North', lat: 26.8695, lng: 80.9164, capacity: 12 },
  { id: 'h7', name: 'Sanjay Gandhi Postgraduate Institute', city: 'Lucknow', state: 'Uttar Pradesh', region: 'North', lat: 26.7453, lng: 80.9364, capacity: 9 },
  { id: 'h8', name: 'AIIMS Rishikesh', city: 'Rishikesh', state: 'Uttarakhand', region: 'North', lat: 30.0869, lng: 78.2676, capacity: 8 },
  { id: 'h9', name: 'SKIMS', city: 'Srinagar', state: 'Jammu and Kashmir', region: 'North', lat: 34.1367, lng: 74.8003, capacity: 7 },
  { id: 'h10', name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai', state: 'Maharashtra', region: 'West', lat: 19.1312, lng: 72.8256, capacity: 12 },
  { id: 'h11', name: 'Lilavati Hospital', city: 'Mumbai', state: 'Maharashtra', region: 'West', lat: 19.0509, lng: 72.8296, capacity: 10 },
  { id: 'h12', name: 'Ruby Hall Clinic', city: 'Pune', state: 'Maharashtra', region: 'West', lat: 18.5362, lng: 73.8777, capacity: 8 },
  { id: 'h13', name: 'Civil Hospital Ahmedabad', city: 'Ahmedabad', state: 'Gujarat', region: 'West', lat: 23.0525, lng: 72.6031, capacity: 12 },
  { id: 'h14', name: 'UN Mehta Institute of Cardiology', city: 'Ahmedabad', state: 'Gujarat', region: 'West', lat: 23.0584, lng: 72.6038, capacity: 8 },
  { id: 'h15', name: 'Goa Medical College', city: 'Panaji', state: 'Goa', region: 'West', lat: 15.4909, lng: 73.8278, capacity: 7 },
  { id: 'h16', name: 'Apollo Hospitals Greams Road', city: 'Chennai', state: 'Tamil Nadu', region: 'South', lat: 13.0632, lng: 80.2518, capacity: 11 },
  { id: 'h17', name: 'Christian Medical College', city: 'Vellore', state: 'Tamil Nadu', region: 'South', lat: 12.9254, lng: 79.1356, capacity: 11 },
  { id: 'h18', name: 'Narayana Health City', city: 'Bengaluru', state: 'Karnataka', region: 'South', lat: 12.8004, lng: 77.7046, capacity: 13 },
  { id: 'h19', name: 'Manipal Hospital Old Airport Road', city: 'Bengaluru', state: 'Karnataka', region: 'South', lat: 12.9581, lng: 77.6484, capacity: 9 },
  { id: 'h20', name: 'Yashoda Hospitals Secunderabad', city: 'Hyderabad', state: 'Telangana', region: 'South', lat: 17.4417, lng: 78.4983, capacity: 10 },
  { id: 'h21', name: 'KIMS Hospitals', city: 'Hyderabad', state: 'Telangana', region: 'South', lat: 17.4248, lng: 78.5034, capacity: 9 },
  { id: 'h22', name: 'Government Medical College', city: 'Thiruvananthapuram', state: 'Kerala', region: 'South', lat: 8.5212, lng: 76.9287, capacity: 8 },
  { id: 'h23', name: 'Aster Medcity', city: 'Kochi', state: 'Kerala', region: 'South', lat: 10.0453, lng: 76.3012, capacity: 8 },
  { id: 'h24', name: 'Andhra Hospitals', city: 'Vijayawada', state: 'Andhra Pradesh', region: 'South', lat: 16.5062, lng: 80.648, capacity: 7 },
  { id: 'h25', name: 'Fortis Hospital Anandapur', city: 'Kolkata', state: 'West Bengal', region: 'East', lat: 22.5019, lng: 88.4009, capacity: 10 },
  { id: 'h26', name: 'SSKM Hospital', city: 'Kolkata', state: 'West Bengal', region: 'East', lat: 22.5383, lng: 88.3426, capacity: 8 },
  { id: 'h27', name: 'SCB Medical College Hospital', city: 'Cuttack', state: 'Odisha', region: 'East', lat: 20.4625, lng: 85.883, capacity: 8 },
  { id: 'h28', name: 'RIMS Ranchi', city: 'Ranchi', state: 'Jharkhand', region: 'East', lat: 23.3706, lng: 85.3252, capacity: 7 },
  { id: 'h29', name: 'IGIMS', city: 'Patna', state: 'Bihar', region: 'East', lat: 25.6081, lng: 85.0863, capacity: 9 },
  { id: 'h30', name: 'Hi-Tech Medical College', city: 'Bhubaneswar', state: 'Odisha', region: 'East', lat: 20.2961, lng: 85.8245, capacity: 7 },
  { id: 'h31', name: 'AIIMS Bhopal', city: 'Bhopal', state: 'Madhya Pradesh', region: 'Central', lat: 23.2075, lng: 77.4567, capacity: 10 },
  { id: 'h32', name: 'MY Hospital', city: 'Indore', state: 'Madhya Pradesh', region: 'Central', lat: 22.7177, lng: 75.8742, capacity: 8 },
  { id: 'h33', name: 'Dr. Ram Manohar Lohia Institute', city: 'Raipur', state: 'Chhattisgarh', region: 'Central', lat: 21.2514, lng: 81.6296, capacity: 7 },
  { id: 'h34', name: 'Hamdard Institute of Medical Sciences', city: 'New Delhi', state: 'Delhi', region: 'North', lat: 28.5157, lng: 77.2501, capacity: 7 },
  { id: 'h35', name: 'Gauhati Medical College Hospital', city: 'Guwahati', state: 'Assam', region: 'Northeast', lat: 26.154, lng: 91.7707, capacity: 9 },
  { id: 'h36', name: 'NEIGRIHMS', city: 'Shillong', state: 'Meghalaya', region: 'Northeast', lat: 25.5726, lng: 91.8968, capacity: 7 },
  { id: 'h37', name: 'Agartala Government Medical College', city: 'Agartala', state: 'Tripura', region: 'Northeast', lat: 23.8315, lng: 91.2868, capacity: 6 },
  { id: 'h38', name: 'JNIMS', city: 'Imphal', state: 'Manipur', region: 'Northeast', lat: 24.817, lng: 93.9368, capacity: 6 },
];

function createHospitals(): Hospital[] {
  return hospitalSeeds.map((hospital) => ({
    ...hospital,
    currentLoad: Math.floor(Math.random() * Math.max(1, hospital.capacity - 2)),
  }));
}

function createAmbulances(seedHospitals: Hospital[]): Ambulance[] {
  return seedHospitals.flatMap((hospital, hospitalIndex) => {
    const ambulancesPerHospital = hospital.capacity >= 11 ? 3 : 2;
    return Array.from({ length: ambulancesPerHospital }).map((_, ambulanceIndex) => ({
      id: `a${hospitalIndex + 1}-${ambulanceIndex + 1}`,
      name: `IND-${hospital.city.slice(0, 3).toUpperCase()}-${100 + hospitalIndex * 3 + ambulanceIndex}`,
      lat: hospital.lat + (Math.random() - 0.5) * 0.22,
      lng: hospital.lng + (Math.random() - 0.5) * 0.22,
      status: 'free' as const,
      baseHospitalId: hospital.id,
    }));
  });
}

let hospitals: Hospital[] = createHospitals();
let ambulances: Ambulance[] = createAmbulances(hospitals);
let incidents: Incident[] = [];

const VALID_SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const severityValue: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function getDist(p1: Point, p2: Point) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getAmbulanceBaseHospital(ambulance: Ambulance) {
  return hospitals.find((hospital) => hospital.id === ambulance.baseHospitalId);
}

function inferIncidentServiceArea(point: Point) {
  const nearestHospital = [...hospitals].sort((a, b) => getDist(a, point) - getDist(b, point))[0];
  return nearestHospital
    ? { state: nearestHospital.state, region: nearestHospital.region }
    : { state: undefined, region: undefined };
}

function rankHospitalsForIncident(incident: Point, candidates: Hospital[], serviceArea: { state?: string; region?: Region }) {
  return [...candidates].sort((a, b) => {
    const aStateScore = a.state === serviceArea.state ? 0 : a.region === serviceArea.region ? 1 : 2;
    const bStateScore = b.state === serviceArea.state ? 0 : b.region === serviceArea.region ? 1 : 2;
    if (aStateScore !== bStateScore) return aStateScore - bStateScore;
    return getDist(a, incident) - getDist(b, incident);
  });
}

function rankAmbulancesForIncident(incident: Point, candidates: Ambulance[], serviceArea: { state?: string; region?: Region }) {
  return [...candidates].sort((a, b) => {
    const aBase = getAmbulanceBaseHospital(a);
    const bBase = getAmbulanceBaseHospital(b);
    const aAreaScore = aBase?.state === serviceArea.state ? 0 : aBase?.region === serviceArea.region ? 1 : 2;
    const bAreaScore = bBase?.state === serviceArea.state ? 0 : bBase?.region === serviceArea.region ? 1 : 2;
    if (aAreaScore !== bAreaScore) return aAreaScore - bAreaScore;
    return getDist(a, incident) - getDist(b, incident);
  });
}

async function fetchOSRMRoute(start: Point, end: Point): Promise<Point[]> {
  const fallbackRoute = [end];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return fallbackRoute;
    }

    const data = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
    }
  } catch {
    // Fall back to a direct line when the routing service is unavailable.
  } finally {
    clearTimeout(timeout);
  }

  return fallbackRoute;
}

function isValidPoint(point: Partial<Point>): point is Point {
  return (
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function handleArrival(ambulance: Ambulance) {
  if (ambulance.incidentId) {
    const incident = incidents.find((candidate) => candidate.id === ambulance.incidentId);
    if (incident) incident.status = 'resolved';

    ambulance.incidentId = undefined;
    const hospital = hospitals.find((candidate) => candidate.id === ambulance.hospitalId);

    if (hospital) {
      ambulance.target = { lat: hospital.lat, lng: hospital.lng };
      ambulance.route = [ambulance.target];
      fetchOSRMRoute(ambulance, ambulance.target).then((route) => {
        if (ambulance.status === 'busy' && ambulance.hospitalId === hospital.id) {
          ambulance.route = route;
        }
      });
    } else {
      ambulance.status = 'free';
      ambulance.target = undefined;
      ambulance.route = undefined;
    }
  } else if (ambulance.hospitalId) {
    const hospital = hospitals.find((candidate) => candidate.id === ambulance.hospitalId);
    if (hospital && hospital.currentLoad < hospital.capacity) hospital.currentLoad++;

    notifications.push({
      id: `notif-${Date.now()}-${hospital?.id}-${ambulance.id}-${Math.random().toString(36).substring(7)}`,
      type: 'success',
      message: `Ambulance ${ambulance.name} arrived at ${hospital?.name}, ${hospital?.city}`,
      timestamp: Date.now(),
    });

    ambulance.status = 'free';
    ambulance.hospitalId = undefined;
    ambulance.target = undefined;
    ambulance.route = undefined;
    ambulance.eta = undefined;
  }
}

const SPEED_KM_PER_TICK = 0.25;

setInterval(() => {
  ambulances.forEach((ambulance) => {
    if (ambulance.status === 'busy' && ambulance.route && ambulance.route.length > 0) {
      if (ambulance.target) {
        const dist = getDist(ambulance, ambulance.target);
        ambulance.eta = Math.max(1, Math.ceil((dist * 1.4) / SPEED_KM_PER_TICK));
      }

      let distRemaining = SPEED_KM_PER_TICK;
      while (distRemaining > 0 && ambulance.route && ambulance.route.length > 0) {
        const waypoint = ambulance.route[0];
        const distToWaypoint = getDist(ambulance, waypoint);

        if (distToWaypoint <= distRemaining) {
          ambulance.lat = waypoint.lat;
          ambulance.lng = waypoint.lng;
          distRemaining -= distToWaypoint;
          ambulance.route.shift();

          if (ambulance.route.length === 0) {
            handleArrival(ambulance);
            distRemaining = 0;
          }
        } else {
          const ratio = distRemaining / distToWaypoint;
          ambulance.lat += (waypoint.lat - ambulance.lat) * ratio;
          ambulance.lng += (waypoint.lng - ambulance.lng) * ratio;
          distRemaining = 0;
        }
      }
    }
  });

  const unassignedIncidents = incidents
    .filter((incident) => incident.status === 'unassigned')
    .sort((a, b) => (severityValue[b.severity] || 0) - (severityValue[a.severity] || 0));

  unassignedIncidents.forEach((incident) => {
    const serviceArea = inferIncidentServiceArea(incident);
    incident.inferredState = serviceArea.state;
    incident.inferredRegion = serviceArea.region;

    const candidates = ambulances.filter((ambulance) => {
      if (ambulance.status === 'free') return true;
      if (ambulance.status === 'busy' && ambulance.incidentId) {
        const currentIncident = incidents.find((candidate) => candidate.id === ambulance.incidentId);
        if (currentIncident && (severityValue[currentIncident.severity] || 0) < (severityValue[incident.severity] || 0)) {
          return true;
        }
      }
      return false;
    });

    if (candidates.length === 0) return;

    const rankedAmbulances = rankAmbulancesForIncident(incident, candidates, serviceArea);
    const selectedAmbulance = rankedAmbulances[0];

    const availableHospitals = hospitals.filter((hospital) => hospital.currentLoad < hospital.capacity);
    if (availableHospitals.length === 0) return;

    const rankedHospitals = rankHospitalsForIncident(incident, availableHospitals, serviceArea);
    const bestHospital = rankedHospitals[0];

    if (selectedAmbulance.status === 'busy' && selectedAmbulance.incidentId) {
      const oldIncident = incidents.find((candidate) => candidate.id === selectedAmbulance.incidentId);
      if (oldIncident) {
        oldIncident.status = 'unassigned';
        oldIncident.assignedAmbulance = undefined;
        oldIncident.etaMin = undefined;
        notifications.push({
          id: `notif-reassign-${Date.now()}-${oldIncident.id}-${Math.random().toString(36).substring(7)}`,
          type: 'info',
          message: `Alert: ${selectedAmbulance.name} diverted to ${incident.severity.toUpperCase()} priority incident.`,
          timestamp: Date.now(),
        });
      }
    }

    selectedAmbulance.status = 'busy';
    selectedAmbulance.incidentId = incident.id;
    selectedAmbulance.hospitalId = bestHospital.id;
    selectedAmbulance.target = { lat: incident.lat, lng: incident.lng };
    selectedAmbulance.route = [selectedAmbulance.target];

    incident.status = 'assigned';
    incident.assignedAmbulance = selectedAmbulance.name;
    incident.etaMin = Math.max(1, Math.ceil((getDist(selectedAmbulance, incident) * 1.4) / SPEED_KM_PER_TICK));

    fetchOSRMRoute(selectedAmbulance, selectedAmbulance.target).then((route) => {
      if (selectedAmbulance.status === 'busy' && selectedAmbulance.incidentId === incident.id) {
        selectedAmbulance.route = route;
      }
    });
  });

  incidents
    .filter((incident) => incident.status === 'assigned')
    .forEach((incident) => {
      const assignedAmbulance = ambulances.find((ambulance) => ambulance.incidentId === incident.id);
      if (assignedAmbulance) {
        incident.etaMin = Math.max(1, Math.ceil((getDist(assignedAmbulance, incident) * 1.4) / SPEED_KM_PER_TICK));
      }
    });

  hospitals.forEach((hospital) => {
    if (hospital.currentLoad > 0 && Math.random() < 0.01) {
      hospital.currentLoad--;
    }
  });

  if (notifications.length > 10) {
    notifications.shift();
  }
}, 1000);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get("/api/state", (_req, res) => {
    res.json({ hospitals, ambulances, incidents, notifications });
  });

  app.post("/api/incident", (req, res) => {
    const { lat, lng, severity } = req.body;
    if (!isValidPoint({ lat, lng })) {
      res.status(400).json({ error: 'Invalid incident coordinates.' });
      return;
    }

    const normalizedSeverity: Severity = VALID_SEVERITIES.includes(severity) ? severity : 'high';
    const serviceArea = inferIncidentServiceArea({ lat, lng });
    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      lat,
      lng,
      status: 'unassigned',
      severity: normalizedSeverity,
      inferredState: serviceArea.state,
      inferredRegion: serviceArea.region,
    };

    incidents.push(newIncident);
    res.json(newIncident);
  });

  app.post("/api/reset", (_req, res) => {
    incidents = [];
    notifications = [];
    hospitals = createHospitals();
    ambulances = createAmbulances(hospitals);
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
