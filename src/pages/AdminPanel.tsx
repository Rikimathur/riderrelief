import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Claim, SensorLog, WeatherEvent, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Shield, 
  Map as MapIcon, 
  CloudRain, 
  DollarSign, 
  Search, 
  MoreVertical, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Video,
  Navigation,
  Activity,
  LogOut,
  Clock
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<UserProfile | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ zone: '', type: 'storm' as const, severity: 'High' });

  useEffect(() => {
    if (!user) return;

    const unsubWorkers = onSnapshot(collection(db, 'users'), (snap) => {
      setWorkers(snap.docs.map(d => d.data() as UserProfile).filter(u => u.role === 'worker'));
    });

    const unsubClaims = onSnapshot(collection(db, 'claims'), (snap) => {
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as Claim)));
    });

    const unsubWeather = onSnapshot(collection(db, 'weatherEvents'), (snap) => {
      setWeatherEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeatherEvent)));
    });

    return () => {
      unsubWorkers();
      unsubClaims();
      unsubWeather();
    };
  }, [user]);

  const handleAddWeatherEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'weatherEvents'), {
      ...newEvent,
      timestamp: new Date().toISOString()
    });
    setIsAddingEvent(false);
    
    // Trigger automatic claims for workers in that zone
    const activeWorkers = workers.filter(w => w.status === 'active' && w.zone === newEvent.zone);
    for (const worker of activeWorkers) {
      await addDoc(collection(db, 'claims'), {
        workerUid: worker.uid,
        status: 'pending',
        amount: 25.00,
        timestamp: new Date().toISOString(),
        verificationScore: 0.85 + Math.random() * 0.1,
        layers: {
          behavioral: 0.9,
          sensorFusion: 0.88,
          weatherCorrelation: 0.95,
          crowdValidation: 0.92
        }
      });
    }
  };

  const updateClaimStatus = async (id: string, status: Claim['status']) => {
    await updateDoc(doc(db, 'claims', id), { status });
  };

  const deleteWeatherEvent = async (id: string) => {
    await deleteDoc(doc(db, 'weatherEvents', id));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Navigation */}
      <nav className="border-bottom border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold tracking-tight text-emerald-500">RiderRelief Admin</h1>
            <div className="hidden md:flex items-center gap-6">
              <button className="text-sm font-medium text-neutral-200 border-b-2 border-emerald-500 h-16 flex items-center">Overview</button>
              <button className="text-sm font-medium text-neutral-500 hover:text-neutral-200 transition-colors">Workers</button>
              <button className="text-sm font-medium text-neutral-500 hover:text-neutral-200 transition-colors">Claims</button>
              <button className="text-sm font-medium text-neutral-500 hover:text-neutral-200 transition-colors">Weather</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <input 
                type="text" 
                placeholder="Search workers or claims..."
                className="bg-neutral-950 border border-neutral-800 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 w-64"
              />
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
            >
              <LogOut className="w-5 h-5 text-neutral-500" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Worker List & Map View */}
        <div className="xl:col-span-8 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Workers', value: workers.filter(w => w.status === 'active').length, icon: Users, color: 'text-blue-500' },
              { label: 'Pending Claims', value: claims.filter(c => c.status === 'pending').length, icon: Clock, color: 'text-orange-500' },
              { label: 'Total Payouts', value: `$${claims.filter(c => c.status === 'approved').reduce((acc, c) => acc + c.amount, 0)}`, icon: DollarSign, color: 'text-emerald-500' },
              { label: 'Active Alerts', value: weatherEvents.length, icon: CloudRain, color: 'text-red-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Live</span>
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-neutral-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Main Map/Worker View */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-neutral-500" />
                Real-time Fleet Monitoring
              </h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-neutral-800 rounded-md text-xs font-medium hover:bg-neutral-700 transition-colors">Map View</button>
                <button className="px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-md text-xs font-medium text-neutral-500">List View</button>
              </div>
            </div>
            
            <div className="flex-1 relative bg-neutral-950">
              <MapContainer 
                center={[40.7128, -74.0060]} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <TileLayer
                  url={`https://apis.mappls.com/advancedmaps/v1/jthtbczxqczsmvutiqzowmwzxtclsdbivzqv/full_2d_map/{z}/{x}/{y}.png`}
                  attribution='&copy; <a href="https://www.mappls.com">Mappls</a>'
                />
                {workers.map(worker => worker.lastLocation && (
                  <Marker 
                    key={worker.uid} 
                    position={[worker.lastLocation.lat, worker.lastLocation.lng]}
                    eventHandlers={{
                      click: () => setSelectedWorker(worker),
                    }}
                  >
                    <Popup>
                      <div className="text-neutral-900">
                        <p className="font-bold">{worker.name || worker.email}</p>
                        <p className="text-xs">Status: {worker.status}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {selectedWorker?.lastLocation && (
                  <MapUpdater center={[selectedWorker.lastLocation.lat, selectedWorker.lastLocation.lng]} />
                )}
              </MapContainer>
              
              <div className="absolute top-4 right-4 z-10 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto w-64 md:w-auto pointer-events-none">
                {workers.map(worker => (
                  <motion.div 
                    key={worker.uid}
                    layoutId={worker.uid}
                    onClick={() => setSelectedWorker(worker)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all pointer-events-auto ${
                      selectedWorker?.uid === worker.uid 
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-900/10' 
                        : 'bg-neutral-900/80 backdrop-blur-md border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center overflow-hidden">
                          {worker.name ? worker.name[0] : <Users className="w-5 h-5 text-neutral-600" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">{worker.name || worker.email}</h3>
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{worker.zone || 'Unassigned'}</p>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${worker.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'}`} />
                    </div>
                    
                    {worker.lastLocation && (
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-3 h-3 text-blue-500" />
                          {worker.lastLocation.lat.toFixed(4)}, {worker.lastLocation.lng.toFixed(4)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-3 h-3 text-emerald-500" />
                          Active
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details & Actions */}
        <div className="xl:col-span-4 space-y-6">
          {/* Weather Control */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Weather Triggers</h2>
              <button 
                onClick={() => setIsAddingEvent(true)}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors"
              >
                New Alert
              </button>
            </div>

            <AnimatePresence>
              {isAddingEvent && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddWeatherEvent}
                  className="mb-6 space-y-3 overflow-hidden"
                >
                  <input 
                    type="text" 
                    placeholder="Zone (e.g. Downtown)"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500/50"
                    value={newEvent.zone}
                    onChange={e => setNewEvent({...newEvent, zone: e.target.value})}
                    required
                  />
                  <select 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500/50"
                    value={newEvent.type}
                    onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
                  >
                    <option value="storm">Storm</option>
                    <option value="flood">Flood</option>
                    <option value="extreme_heat">Extreme Heat</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg">Activate</button>
                    <button type="button" onClick={() => setIsAddingEvent(false)} className="flex-1 bg-neutral-800 text-neutral-400 text-xs font-bold py-2 rounded-lg">Cancel</button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {weatherEvents.map(event => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-orange-500/20">
                  <div className="flex items-center gap-3">
                    <CloudRain className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-xs font-bold text-neutral-200 capitalize">{event.type}</div>
                      <div className="text-[10px] text-neutral-500">{event.zone}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteWeatherEvent(event.id)} className="text-neutral-600 hover:text-red-500 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Worker Details / Verification */}
          {selectedWorker ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Worker Inspection</h2>
                <button onClick={() => setSelectedWorker(null)} className="text-neutral-600 hover:text-neutral-400">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center text-2xl font-bold">
                  {selectedWorker.name ? selectedWorker.name[0] : '?'}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedWorker.name || selectedWorker.email}</h3>
                  <p className="text-xs text-neutral-500">{selectedWorker.uid.slice(0, 8)}...</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <button className="flex items-center justify-center gap-2 py-3 bg-neutral-950 border border-neutral-800 rounded-xl hover:border-emerald-500/30 transition-all group">
                  <Video className="w-4 h-4 text-neutral-500 group-hover:text-emerald-500" />
                  <span className="text-xs font-bold">Live Feed</span>
                </button>
                <button className="flex items-center justify-center gap-2 py-3 bg-neutral-950 border border-neutral-800 rounded-xl hover:border-blue-500/30 transition-all group">
                  <Navigation className="w-4 h-4 text-neutral-500 group-hover:text-blue-500" />
                  <span className="text-xs font-bold">Track Path</span>
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Verification Layers</h4>
                {[
                  { label: 'Behavioral Reality', score: 94, status: 'pass' },
                  { label: 'Sensor Fusion', score: 88, status: 'pass' },
                  { label: 'Weather Correlation', score: 100, status: 'pass' },
                  { label: 'Crowd Validation', score: 92, status: 'pass' },
                ].map((layer, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium">
                      <span className="text-neutral-400">{layer.label}</span>
                      <span className="text-emerald-500">{layer.score}%</span>
                    </div>
                    <div className="h-1 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${layer.score}%` }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
              <Users className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
              <p className="text-neutral-600 text-sm">Select a worker to view live telemetry and verification scores.</p>
            </div>
          )}

          {/* Pending Claims Queue */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-6">Claims Queue</h2>
            <div className="space-y-4">
              {claims.filter(c => c.status === 'pending').map(claim => (
                <div key={claim.id} className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold">$25.00</div>
                      <div className="text-[10px] text-neutral-500">Worker: {claim.workerUid.slice(0, 8)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Flagged (0.82)</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => updateClaimStatus(claim.id, 'approved')}
                      className="flex-1 bg-emerald-600/10 border border-emerald-600/30 text-emerald-500 text-[10px] font-bold py-1.5 rounded-lg hover:bg-emerald-600/20 transition-colors"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => updateClaimStatus(claim.id, 'rejected')}
                      className="flex-1 bg-red-600/10 border border-red-600/30 text-red-500 text-[10px] font-bold py-1.5 rounded-lg hover:bg-red-600/20 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {claims.filter(c => c.status === 'pending').length === 0 && (
                <p className="text-center text-neutral-600 text-xs italic">Queue is empty.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
