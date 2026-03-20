import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Claim, SensorLog, WeatherEvent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Activity, 
  CloudRain, 
  DollarSign, 
  LogOut, 
  Navigation, 
  Wifi, 
  ShieldCheck,
  AlertTriangle,
  Clock,
  Phone,
  Video
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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

export default function WorkerPortal() {
  const { user, profile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([]);
  const [isTracking, setIsTracking] = useState(profile?.status === 'active');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sensorData, setSensorData] = useState({
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    network: 'good' as const
  });
  const trackingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'claims'), where('workerUid', '==', user.uid));
    const unsubClaims = onSnapshot(q, (snap) => {
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as Claim)));
    });

    const unsubWeather = onSnapshot(collection(db, 'weatherEvents'), (snap) => {
      setWeatherEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeatherEvent)));
    });

    return () => {
      unsubClaims();
      unsubWeather();
    };
  }, [user]);

  const toggleTracking = async () => {
    if (!user) return;
    const newStatus = !isTracking ? 'active' : 'inactive';
    setIsTracking(!isTracking);
    
    await updateDoc(doc(db, 'users', user.uid), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    if (newStatus === 'active') {
      startTracking();
    } else {
      stopTracking();
    }
  };

  const startTracking = () => {
    if (trackingInterval.current) return;
    
    trackingInterval.current = setInterval(async () => {
      if (!user) return;

      // Simulate sensor data
      const newLocation = {
        lat: 40.7128 + (Math.random() - 0.5) * 0.01,
        lng: -74.0060 + (Math.random() - 0.5) * 0.01
      };
      
      const newSensors = {
        accel: { x: Math.random() * 2, y: Math.random() * 2, z: 9.8 + Math.random() },
        gyro: { x: Math.random(), y: Math.random(), z: Math.random() },
        network: Math.random() > 0.2 ? 'good' : 'fair' as const
      };

      setLocation(newLocation);
      setSensorData(newSensors);

      // Log to Firestore
      await addDoc(collection(db, 'sensorLogs'), {
        workerUid: user.uid,
        timestamp: serverTimestamp(),
        location: newLocation,
        accelerometer: newSensors.accel,
        gyroscope: newSensors.gyro,
        networkQuality: newSensors.network
      });

      // Update user last location
      await updateDoc(doc(db, 'users', user.uid), {
        lastLocation: { ...newLocation, timestamp: Date.now() }
      });
    }, 5000);
  };

  const stopTracking = () => {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
  };

  useEffect(() => {
    if (profile?.status === 'active') {
      startTracking();
    }
    return () => stopTracking();
  }, [profile?.status]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" />
              Worker Dashboard
            </h1>
            <p className="text-neutral-500 text-sm">Welcome back, {profile?.name || user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTracking}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg ${
                isTracking 
                  ? 'bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/20'
              }`}
            >
              <Navigation className={`w-4 h-4 ${isTracking ? 'animate-pulse' : ''}`} />
              {isTracking ? 'Stop Tracking' : 'Go Active'}
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-full hover:bg-neutral-800 transition-colors"
            >
              <LogOut className="w-5 h-5 text-neutral-500" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Status & Sensors */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Current Status</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`} />
                  <span className="text-lg font-medium">{isTracking ? 'Active & Protected' : 'Inactive'}</span>
                </div>
                {isTracking && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20">
                    Zone: {profile?.zone || 'Downtown'}
                  </span>
                )}
              </div>
            </div>

            {/* Map View */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden h-64">
              <MapContainer 
                center={[40.7128, -74.0060]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url={`https://apis.mappls.com/advancedmaps/v1/jthtbczxqczsmvutiqzowmwzxtclsdbivzqv/full_2d_map/{z}/{x}/{y}.png`}
                  attribution='&copy; Mappls'
                />
                {location && (
                  <>
                    <Marker position={[location.lat, location.lng]} />
                    <MapUpdater center={[location.lat, location.lng]} />
                  </>
                )}
              </MapContainer>
            </div>

            {/* Sensor Feed */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Live Sensor Feed</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">Location</span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400">
                    {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting...'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Movement</span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400">
                    {sensorData.accel.x.toFixed(2)}g
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-4 h-4 text-orange-400" />
                    <span className="text-sm">Network</span>
                  </div>
                  <span className={`text-xs font-semibold uppercase ${
                    sensorData.network === 'good' ? 'text-emerald-500' : 'text-orange-500'
                  }`}>
                    {sensorData.network}
                  </span>
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Support & Emergency</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800 hover:border-emerald-500/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-neutral-500 group-hover:text-emerald-500" />
                    <span className="text-sm">Dispatch Support</span>
                  </div>
                  <span className="text-xs text-neutral-600">24/7</span>
                </button>
                <button className="w-full flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800 hover:border-red-500/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">Emergency SOS</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Middle & Right Column: Claims & Weather */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Weather Alerts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <CloudRain className="w-32 h-32" />
              </div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Active Weather Zones</h2>
              <div className="space-y-4">
                {weatherEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-600 text-sm italic">No active weather events in your area.</p>
                  </div>
                ) : (
                  weatherEvents.map(event => (
                    <motion.div 
                      key={event.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-center justify-between p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-orange-100 capitalize">{event.type} Alert</h3>
                          <p className="text-xs text-orange-500/70">{event.zone} • {event.severity} Severity</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-orange-400 block">Payout Triggered</span>
                        <span className="text-lg font-bold text-orange-100">$25.00</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Claims */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Recent Payouts</h2>
                <DollarSign className="w-4 h-4 text-neutral-600" />
              </div>
              <div className="space-y-3">
                {claims.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 text-neutral-800 mx-auto mb-3" />
                    <p className="text-neutral-600 text-sm">No claims processed yet.</p>
                  </div>
                ) : (
                  claims.map(claim => (
                    <div key={claim.id} className="flex items-center justify-between p-4 bg-neutral-950 rounded-xl border border-neutral-800">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          claim.status === 'approved' ? 'bg-emerald-500/10' : 
                          claim.status === 'flagged' ? 'bg-orange-500/10' : 'bg-neutral-800'
                        }`}>
                          {claim.status === 'approved' ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <Clock className="w-5 h-5 text-neutral-500" />}
                        </div>
                        <div>
                          <h3 className="font-medium text-neutral-200">Weather Payout</h3>
                          <p className="text-xs text-neutral-500">{new Date(claim.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-neutral-100">${claim.amount.toFixed(2)}</span>
                        <span className={`text-[10px] block font-bold uppercase tracking-widest ${
                          claim.status === 'approved' ? 'text-emerald-500' : 
                          claim.status === 'flagged' ? 'text-orange-500' : 'text-neutral-500'
                        }`}>
                          {claim.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
