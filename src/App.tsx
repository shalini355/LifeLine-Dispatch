import { useEffect, useState, useRef } from 'react';
import { MapPin, Navigation, RotateCcw, Crosshair, CheckCircle, Clock, X } from 'lucide-react';
import MapComponent from './components/MapComponent';

type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string;
  region: 'North' | 'South' | 'East' | 'West' | 'Central' | 'Northeast';
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
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedAmbulance?: string;
  etaMin?: number;
};
type NotificationMessage = { id: string; message: string };
type AppState = {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  notifications: NotificationMessage[];
};
type Severity = 'low' | 'medium' | 'high';
type PendingIncident = { lat: number; lng: number; source: 'map' | 'location' } | null;

export default function App() {
  const [state, setState] = useState<AppState>({
    hospitals: [], ambulances: [], incidents: [], notifications: []
  });

  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  const [visibleNotifs, setVisibleNotifs] = useState<NotificationMessage[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [pendingIncident, setPendingIncident] = useState<PendingIncident>(null);
  const seenNotifs = useRef(new Set<string>());

  const dismissNotif = (id: string) => {
    setVisibleNotifs(prev => prev.filter(p => p.id !== id));
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data: AppState = await res.json();
        setState(data);
      }
    } catch {
      // Suppress "Failed to fetch" console errors during server restarts
    }
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!isMounted) return;
      await fetchData();
      if (isMounted) {
        timeoutId = setTimeout(poll, 1000);
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (state.notifications && state.notifications.length > 0) {
      const newNotifs = state.notifications.filter(n => !seenNotifs.current.has(n.id));
      if (newNotifs.length > 0) {
        newNotifs.forEach(n => seenNotifs.current.add(n.id));
        setVisibleNotifs(prev => [...prev, ...newNotifs]);

        newNotifs.forEach(n => {
          setTimeout(() => {
            setVisibleNotifs(prev => prev.filter(p => p.id !== n.id));
          }, 5000);
        });
      }
    }
  }, [state.notifications]);

  const submitIncident = async (lat: number, lng: number, severity: Severity) => {
    try {
      await fetch('/api/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, severity })
      });
      fetchData();
    } catch {}
  };

  const handleMapClick = (lat: number, lng: number) => {
    setPendingIncident({ lat, lng, source: 'map' });
  };

  const handleSeveritySelect = async (severity: Severity) => {
    if (!pendingIncident) return;
    await submitIncident(pendingIncident.lat, pendingIncident.lng, severity);
    setPendingIncident(null);
  };

  const handleUseLocation = () => {
    setIsLoadingLoc(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setIsLoadingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoadingLoc(false);
        setPendingIncident({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'location'
        });
      },
      () => {
        setIsLoadingLoc(false);
        alert('Unable to retrieve your location');
      }
    );
  };

  const resetState = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      fetchData();
      setVisibleNotifs([]);
      seenNotifs.current.clear();
    } catch {}
  };

  const freeAmbulances = state.ambulances.filter((a) => a.status === 'free').length;
  const busyAmbulances = state.ambulances.filter((a) => a.status !== 'free').length;
  const activeIncidents = state.incidents.filter((i) => i.status !== 'resolved').length;

  return (
    <div className="flex min-h-screen w-full flex-col bg-clean-bg text-clean-ink font-clean-sans overflow-x-hidden xl:h-screen xl:overflow-hidden">
      {pendingIncident && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-clean-border bg-clean-surface p-6 shadow-2xl">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-clean-ink-muted">
              Incident Level
            </div>
            <h2 className="mb-2 text-xl font-extrabold text-clean-ink">
              Select emergency severity
            </h2>
            <p className="mb-5 text-sm text-clean-ink-muted">
              {pendingIncident.source === 'location'
                ? 'We found your location. Choose the incident level before dispatching help.'
                : 'Location selected on the map. Choose the incident level before dispatching help.'}
            </p>
            <div className="grid gap-3">
              <button
                onClick={() => handleSeveritySelect('high')}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left transition-colors hover:bg-red-100"
              >
                <div className="text-sm font-extrabold uppercase text-red-700">High</div>
                <div className="text-xs text-red-900/80">Life-threatening or urgent emergency.</div>
              </button>
              <button
                onClick={() => handleSeveritySelect('medium')}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100"
              >
                <div className="text-sm font-extrabold uppercase text-amber-700">Medium</div>
                <div className="text-xs text-amber-900/80">Serious condition that needs fast response.</div>
              </button>
              <button
                onClick={() => handleSeveritySelect('low')}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100"
              >
                <div className="text-sm font-extrabold uppercase text-emerald-700">Low</div>
                <div className="text-xs text-emerald-900/80">Stable case that still requires assistance.</div>
              </button>
            </div>
            <button
              onClick={() => setPendingIncident(null)}
              className="mt-4 w-full rounded-xl border border-clean-border px-4 py-3 text-sm font-bold text-clean-ink transition-colors hover:bg-clean-bg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 left-4 z-[2000] flex flex-col gap-2 pointer-events-none sm:left-auto sm:top-6 sm:right-6">
        {visibleNotifs.map(n => (
          <div key={n.id} className="bg-clean-success text-white px-4 py-3 rounded shadow-lg flex items-center justify-between gap-4 animate-in slide-in-from-right-8 fade-in fade-out duration-300 pointer-events-auto sm:max-w-md">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium text-sm">{n.message}</span>
            </div>
            <button
              onClick={() => dismissNotif(n.id)}
              className="hover:bg-black/20 p-1 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <header className="bg-clean-surface border-b border-clean-border z-50 shrink-0">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="font-extrabold text-[18px] tracking-tight flex items-center gap-2 sm:text-[20px]">
          LIFELINE<span className="text-clean-primary">DISPATCH</span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <button
            onClick={handleUseLocation}
            disabled={isLoadingLoc}
            className="flex w-full items-center justify-center gap-2 bg-clean-surface border border-clean-border px-3 py-2 rounded text-sm font-bold text-clean-ink hover:bg-clean-bg transition-colors sm:w-auto"
          >
            <Crosshair className={`w-4 h-4 ${isLoadingLoc ? 'animate-spin text-clean-secondary' : 'text-clean-primary'}`} />
            {isLoadingLoc ? 'LOCATING...' : 'REPORT MY LOCATION'}
          </button>

          <div className="hidden h-6 w-px bg-clean-border mx-2 lg:block"></div>

          <div className="grid grid-cols-1 gap-2 text-[12px] font-medium text-clean-ink sm:grid-cols-3 sm:gap-x-4 sm:text-[13px] lg:flex lg:gap-6 lg:items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-0 bg-clean-success"></div>
              Network: PAN-INDIA
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-0 bg-clean-success"></div>
              Latency: 42ms
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-0 bg-clean-success"></div>
              Dispatcher: Admin_01

              <button
                onClick={resetState}
                className="ml-2 p-1 rounded-sm text-clean-ink-muted hover:text-clean-ink hover:bg-clean-bg transition-colors sm:ml-4"
                title="Reset Demo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:min-h-0 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(260px,280px)]">
        <section className="relative order-1 map-container-bg flex min-h-[320px] flex-col sm:min-h-[420px] lg:min-h-[520px] xl:order-2 xl:min-h-0">
          <div className="flex-1 relative z-0 min-h-[320px] xl:min-h-0">
            <MapComponent
              hospitals={state.hospitals}
              ambulances={state.ambulances}
              incidents={state.incidents}
              onMapClick={handleMapClick}
            />
          </div>

          {showInstructions && (
            <div className="absolute bottom-4 left-4 right-4 bg-clean-ink text-white p-3 px-4 rounded font-clean-mono text-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.2)] z-[1000] pointer-events-auto sm:left-6 sm:right-auto sm:max-w-sm sm:px-5 sm:text-[13px]">
              <div className="flex justify-between items-start mb-1">
                <span className="text-clean-success font-bold font-clean-sans text-xs uppercase tracking-wider">Instructions</span>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="text-white/60 hover:text-white transition-colors p-1 -mt-1 -mr-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed opacity-90">
                &gt; REPORT OR CLICK A LOCATION
                <br/>&gt; CHOOSE LOW, MEDIUM, OR HIGH
                <br/>&gt; DISPATCH NETWORK COVERS INDIA
                <br/>&gt; SYSTEM ASSIGNS NEAREST AMBULANCE
                <br/>&gt; AVOIDS FULL HOSPITALS
                <br/>&gt; UPDATES IN REAL-TIME
              </div>
            </div>
          )}
        </section>

        <aside className="order-2 bg-clean-surface border-t border-clean-border flex flex-col overflow-hidden xl:order-1 xl:border-t-0 xl:border-r">
          <div className="p-4 border-b border-clean-border text-[12px] uppercase tracking-wider font-bold text-clean-ink-muted flex justify-between items-center shrink-0">
            Active Emergencies
            <span>{activeIncidents.toString().padStart(2, '0')} Live</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {state.incidents.filter((i) => i.status !== 'resolved').length === 0 ? (
              <div className="p-4 text-[13px] text-clean-ink-muted italic">
                No active emergencies.
              </div>
            ) : (
              state.incidents.filter((i) => i.status !== 'resolved').map((i) => (
                <div
                  key={i.id}
                  className={`p-4 border-b border-clean-border cursor-pointer transition-colors ${
                    i.status === 'assigned' ? 'bg-[#FFF0F1] border-l-4 border-l-clean-primary' : 'hover:bg-clean-bg border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="font-bold text-[14px] mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className={`w-3.5 h-3.5 ${i.status === 'assigned' ? 'text-clean-primary' : 'text-clean-ink-muted'}`} />
                      Incident #{i.id.slice(-4)}
                    </div>
                    {i.severity && (
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black ${
                        i.severity === 'critical' ? 'bg-[#D90429] text-white' :
                        i.severity === 'high' ? 'bg-orange-500 text-white' :
                        i.severity === 'medium' ? 'bg-yellow-400 text-black' :
                        'bg-clean-success text-white'
                      }`}>{i.severity}</span>
                    )}
                  </div>
                  <div className="text-[12px] text-clean-ink-muted flex justify-between">
                    <span>Emergency Location</span>
                    <span className="uppercase font-bold text-[10px] bg-clean-bg px-1.5 py-0.5 rounded border border-clean-border">{i.status}</span>
                  </div>
                  {i.status === 'assigned' && (
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="text-[11px] text-clean-primary font-bold uppercase flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> {i.assignedAmbulance} Assigned
                        </div>
                        {i.etaMin !== undefined && (
                          <div className="flex items-center gap-1 text-clean-ink">
                            <Clock className="w-3 h-3" /> {i.etaMin} MIN ETA
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-4 flex gap-4 bg-clean-surface border-t border-clean-border shrink-0">
            <div className="flex-1 p-3 border border-clean-border rounded-lg">
              <div className="text-[11px] text-clean-ink-muted uppercase mb-1">Avg Allocation</div>
              <div className="text-[18px] font-extrabold flex items-baseline gap-1">
                2.8s <span className="text-[12px] font-medium text-clean-success ml-1 pl-1">-0.2s</span>
              </div>
            </div>
          </div>
        </aside>

        <aside className="order-3 bg-clean-surface border-t border-clean-border flex flex-col overflow-hidden xl:border-t-0 xl:border-l">
          <div className="p-4 border-b border-clean-border text-[12px] uppercase tracking-wider font-bold text-clean-ink-muted flex justify-between items-center shrink-0">
            Hospital Capacity
            <span>Real-time</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {state.hospitals.map((h) => (
              <div key={h.id} className="p-4 border-b border-clean-border hover:bg-clean-bg transition-colors cursor-pointer">
                <div className="font-bold text-[14px] mb-1">{h.name}</div>
                <div className="mb-2 text-[11px] uppercase tracking-wide text-clean-ink-muted">
                  {h.city}, {h.state} | {h.region}
                </div>
                <div className="text-[12px] text-clean-ink-muted flex justify-between mb-2">
                  <span>Beds: {h.capacity - h.currentLoad} Available</span>
                  <span style={{color: h.currentLoad >= h.capacity ? 'var(--color-clean-primary)' : 'var(--color-clean-success)'}}>
                    {h.currentLoad >= h.capacity ? 'Critical Load' : 'Load OK'}
                  </span>
                </div>
                <div className="w-full h-1 bg-clean-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (h.currentLoad / h.capacity) * 100)}%`,
                      backgroundColor: h.currentLoad >= h.capacity ? 'var(--color-clean-primary)' : 'var(--color-clean-success)'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-clean-border text-[12px] uppercase tracking-wider font-bold text-clean-ink-muted shrink-0">
            Fleet Summary
          </div>
          <div className="p-4 flex flex-col gap-3 shrink-0 text-[13px]">
            <div className="flex justify-between items-center">
              <span>Available</span>
              <span className="font-bold text-clean-success">{freeAmbulances}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>En Route</span>
              <span className="font-bold text-clean-secondary">{busyAmbulances}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Maintenance</span>
              <span className="font-bold">0</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
