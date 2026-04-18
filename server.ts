import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// Types
type Point = { lat: number; lng: number };
type Hospital = Point & { id: string; name: string; capacity: number; currentLoad: number };
type Ambulance = Point & { id: string; name: string; status: 'free' | 'busy' | 'returning'; incidentId?: string; hospitalId?: string; target?: Point; eta?: number; route?: Point[] };
type Incident = Point & { id: string; status: 'unassigned' | 'assigned' | 'resolved'; severity: string; assignedAmbulance?: string; etaMin?: number };
type NotificationMessage = { id: string; type: 'success' | 'info'; message: string; timestamp: number };

// Initial State (Delhi area)
const CENTER: Point = { lat: 28.6139, lng: 77.2090 };

let notifications: NotificationMessage[] = [];

let hospitals: Hospital[] = [
  { id: 'h1', name: 'AIIMS New Delhi', lat: 28.5659, lng: 77.2088, capacity: 5, currentLoad: 2 },
  { id: 'h2', name: 'Safdarjung Hospital', lat: 28.5682, lng: 77.2057, capacity: 3, currentLoad: 3 }, // Full
  { id: 'h3', name: 'Sir Ganga Ram Hospital', lat: 28.6385, lng: 77.1895, capacity: 10, currentLoad: 5 },
  { id: 'h4', name: 'Max Super Speciality (Saket)', lat: 28.5273, lng: 77.2120, capacity: 2, currentLoad: 0 },
];

let ambulances: Ambulance[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `a${i + 1}`,
  name: `DL-1C-A-${1000 + i}`,
  lat: CENTER.lat + (Math.random() - 0.5) * 0.1,
  lng: CENTER.lng + (Math.random() - 0.5) * 0.1,
  status: 'free'
}));

let incidents: Incident[] = [];

// Helper distance in km
function getDist(p1: Point, p2: Point) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fetch Real-world Routing
async function fetchOSRMRoute(start: Point, end: Point): Promise<Point[]> {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
    }
  } catch (e) {
    console.error("OSRM fetch error");
  }
  return [end]; // fallback
}

function handleArrival(a: Ambulance) {
  if (a.incidentId) {
    const inc = incidents.find(i => i.id === a.incidentId);
    if (inc) inc.status = 'resolved';
    a.incidentId = undefined;
    const hosp = hospitals.find(h => h.id === a.hospitalId);
    if (hosp) {
      a.target = { lat: hosp.lat, lng: hosp.lng };
      a.route = [a.target];
      fetchOSRMRoute(a, a.target).then(route => {
        if (a.status === 'busy' && a.hospitalId === hosp.id) {
           a.route = route;
        }
      });
    } else {
      a.status = 'free';
      a.target = undefined;
      a.route = undefined;
    }
  } else if (a.hospitalId) {
    const hosp = hospitals.find(h => h.id === a.hospitalId);
    if (hosp && hosp.currentLoad < hosp.capacity) hosp.currentLoad++;
    notifications.push({
      id: `notif-${Date.now()}-${hosp?.id}-${a.id}-${Math.random().toString(36).substring(7)}`,
      type: 'success',
      message: `Ambulance ${a.name} arrived at ${hosp?.name}`,
      timestamp: Date.now()
    });
    a.status = 'free';
    a.hospitalId = undefined;
    a.target = undefined;
    a.route = undefined;
  }
}

// Background simulation loop
const SPEED_KM_PER_TICK = 0.25; // Adjusted for 1000ms loop

setInterval(() => {
  ambulances.forEach(a => {
    if (a.status === 'busy' && a.route && a.route.length > 0) {
      if (a.target) {
         const dist = getDist(a, a.target);
         a.eta = Math.max(1, Math.ceil((dist * 1.4) / SPEED_KM_PER_TICK));
      }

      let distRemaining = SPEED_KM_PER_TICK;
      while (distRemaining > 0 && a.route && a.route.length > 0) {
        let wp = a.route[0];
        let distToWp = getDist(a, wp);
        
        if (distToWp <= distRemaining) {
          a.lat = wp.lat;
          a.lng = wp.lng;
          distRemaining -= distToWp;
          a.route.shift();
          
          if (a.route.length === 0) {
            handleArrival(a);
            distRemaining = 0;
          }
        } else {
          const ratio = distRemaining / distToWp;
          a.lat += (wp.lat - a.lat) * ratio;
          a.lng += (wp.lng - a.lng) * ratio;
          distRemaining = 0;
        }
      }
    }
  });

  // Assign incidents prioritizing severity overrides
  const severityValue: Record<string, number> = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
  const unassignedIncidents = incidents.filter(i => i.status === 'unassigned')
        .sort((a, b) => (severityValue[b.severity] || 0) - (severityValue[a.severity] || 0));

  unassignedIncidents.forEach(inc => {
    // Find free ambulances AND busy ambulances driving to a lower priority incident
    const candidates = ambulances.filter(a => {
      if (a.status === 'free') return true;
      if (a.status === 'busy' && a.incidentId) {
        const currentInc = incidents.find(i => i.id === a.incidentId);
        if (currentInc && (severityValue[currentInc.severity] || 0) < (severityValue[inc.severity] || 0)) {
          return true; // Eligible for diversion
        }
      }
      return false;
    });

    if (candidates.length > 0) {
      // Find nearest
      candidates.sort((a, b) => getDist(a, inc) - getDist(b, inc));
      const nearest = candidates[0];
      
      // Find hospital with capacity
      const availableHospitals = hospitals.filter(h => h.currentLoad < h.capacity);
      if (availableHospitals.length > 0) {
        availableHospitals.sort((a, b) => getDist(a, inc) - getDist(b, inc));
        const bestHospital = availableHospitals[0];

        // If redefining a busy ambulance, release its old incident
        if (nearest.status === 'busy' && nearest.incidentId) {
           const oldInc = incidents.find(i => i.id === nearest.incidentId);
           if (oldInc) {
              oldInc.status = 'unassigned';
              oldInc.assignedAmbulance = undefined;
              oldInc.etaMin = undefined;
              notifications.push({
                id: `notif-reassign-${Date.now()}-${oldInc.id}-${Math.random().toString(36).substring(7)}`,
                type: 'info',
                message: `Alert: ${nearest.name} diverted to ${inc.severity.toUpperCase()} priority incident.`,
                timestamp: Date.now()
              });
           }
        }

        nearest.status = 'busy';
        nearest.incidentId = inc.id;
        nearest.hospitalId = bestHospital.id;
        nearest.target = { lat: inc.lat, lng: inc.lng };
        nearest.route = [nearest.target];
        
        inc.status = 'assigned';
        inc.assignedAmbulance = nearest.name;
        inc.etaMin = Math.max(1, Math.ceil((getDist(nearest, inc) * 1.4) / SPEED_KM_PER_TICK));

        fetchOSRMRoute(nearest, nearest.target).then(route => {
           if (nearest.status === 'busy' && nearest.incidentId === inc.id) {
               nearest.route = route;
           }
        });
      }
    }
  });
  
  // Update ETA continually
  incidents.filter(i => i.status === 'assigned').forEach(inc => {
     const assigned = ambulances.find(a => a.incidentId === inc.id);
     if (assigned) {
         inc.etaMin = Math.max(1, Math.ceil((getDist(assigned, inc) * 1.4) / SPEED_KM_PER_TICK));
     }
  });

  // Randomly relieve hospital load to keep demo alive
  hospitals.forEach(h => {
    if (h.currentLoad > 0 && Math.random() < 0.01) {
      h.currentLoad--;
    }
  });

  // Keep notifications array manageable
  if (notifications.length > 10) {
      notifications.shift();
  }

}, 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/state", (req, res) => {
    res.json({ hospitals, ambulances, incidents, notifications });
  });

  app.post("/api/incident", (req, res) => {
    const { lat, lng, severity } = req.body;
    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      lat,
      lng,
      status: 'unassigned',
      severity: severity || 'high'
    };
    incidents.push(newIncident);
    res.json(newIncident);
  });
  
  app.post("/api/reset", (req, res) => {
    incidents = [];
    hospitals.forEach(h => h.currentLoad = Math.floor(Math.random() * 3));
    ambulances.forEach((a, i) => {
      a.status = 'free';
      a.incidentId = undefined;
      a.hospitalId = undefined;
      a.target = undefined;
      a.route = undefined;
      a.lat = CENTER.lat + (Math.random() - 0.5) * 0.1;
      a.lng = CENTER.lng + (Math.random() - 0.5) * 0.1;
    });
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
