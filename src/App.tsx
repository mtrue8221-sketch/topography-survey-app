/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Map as MapIcon, 
  Plus, 
  List, 
  Settings, 
  Navigation, 
  Ruler, 
  Layers, 
  Download, 
  Trash2, 
  ChevronLeft,
  Compass,
  Activity,
  Info,
  Save,
  X,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { db, SurveyPoint } from './db';
import { calculateDistance, calculateArea, calculateSlope, exportToGeoJSON, exportToCSV } from './utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type View = 'dashboard' | 'map' | 'collect' | 'list' | 'topo' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<SurveyPoint[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);

  // Load points from DB
  const loadPoints = useCallback(async () => {
    const allPoints = await db.points.toArray();
    setPoints(allPoints);
  }, []);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  // Watch location
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCurrentLocation(pos.coords),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // Watch heading if available
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.webkitCompassHeading) {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha) {
        setHeading(360 - e.alpha);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission();
    }

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const handleSavePoint = async (name: string, desc: string) => {
    if (!currentLocation) return;
    
    const newPoint: SurveyPoint = {
      name,
      description: desc,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      elevation: currentLocation.altitude || 0,
      timestamp: Date.now(),
      accuracy: currentLocation.accuracy
    };

    await db.points.add(newPoint);
    await loadPoints();
    setView('dashboard');
  };

  const handleDeletePoint = async (id: number) => {
    await db.points.delete(id);
    await loadPoints();
  };

  const downloadData = (format: 'csv' | 'geojson') => {
    const content = format === 'csv' ? exportToCSV(points) : exportToGeoJSON(points);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_data_${Date.now()}.${format === 'csv' ? 'csv' : 'json'}`;
    a.click();
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 overflow-hidden shadow-2xl border-x border-slate-200">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {view !== 'dashboard' && (
            <button onClick={() => setView('dashboard')} className="p-1 hover:bg-slate-800 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight">GeoSurvey Pro</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Status</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${currentLocation ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs font-mono">{currentLocation ? 'GPS OK' : 'NO GPS'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 grid grid-cols-2 gap-4"
            >
              <DashboardCard 
                icon={<Plus className="text-emerald-600" />} 
                title="Collect Point" 
                desc="Capture current location"
                onClick={() => setView('collect')}
              />
              <DashboardCard 
                icon={<MapIcon className="text-blue-600" />} 
                title="View Map" 
                desc="Interactive survey map"
                onClick={() => setView('map')}
              />
              <DashboardCard 
                icon={<Activity className="text-amber-600" />} 
                title="Topo Tools" 
                desc="Analysis & calculations"
                onClick={() => setView('topo')}
              />
              <DashboardCard 
                icon={<List className="text-indigo-600" />} 
                title="Data List" 
                desc="Manage saved points"
                onClick={() => setView('list')}
              />
              
              <div className="col-span-2 mt-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Current Position</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="LAT" value={currentLocation?.latitude.toFixed(6) || '--'} />
                  <Stat label="LNG" value={currentLocation?.longitude.toFixed(6) || '--'} />
                  <Stat label="ELEV" value={`${currentLocation?.altitude?.toFixed(1) || '0.0'} m`} />
                  <Stat label="ACC" value={`${currentLocation?.accuracy?.toFixed(1) || '0.0'} m`} />
                </div>
              </div>

              <div className="col-span-2 p-4 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-xl">
                    <Compass className="text-emerald-400" style={{ transform: `rotate(${heading || 0}deg)` }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Bearing</p>
                    <p className="text-lg font-mono font-bold">{Math.round(heading || 0)}°</p>
                  </div>
                </div>
                <button 
                  onClick={() => downloadData('geojson')}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-colors text-sm font-bold"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </motion.div>
          )}

          {view === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full"
            >
              <MapView points={points} currentLocation={currentLocation} />
            </motion.div>
          )}

          {view === 'collect' && (
            <motion.div 
              key="collect"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6"
            >
              <CollectForm onSave={handleSavePoint} onCancel={() => setView('dashboard')} />
            </motion.div>
          )}

          {view === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-3"
            >
              <h2 className="text-lg font-bold px-2">Survey Points ({points.length})</h2>
              {points.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MapPin size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No points collected yet.</p>
                </div>
              ) : (
                points.map(p => (
                  <PointCard key={p.id} point={p} onDelete={() => p.id && handleDeletePoint(p.id)} />
                ))
              )}
            </motion.div>
          )}

          {view === 'topo' && (
            <motion.div 
              key="topo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
              <h2 className="text-lg font-bold">Topographic Tools</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Ruler className="text-blue-600" size={20} />
                    <h3 className="font-bold">Distance & Slope</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">Select two points from the list to analyze.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {points.slice(0, 6).map(p => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          if (selectedPoints.find(sp => sp.id === p.id)) {
                            setSelectedPoints(selectedPoints.filter(sp => sp.id !== p.id));
                          } else if (selectedPoints.length < 2) {
                            setSelectedPoints([...selectedPoints, p]);
                          }
                        }}
                        className={`p-2 text-xs rounded-lg border transition-all ${
                          selectedPoints.find(sp => sp.id === p.id) 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>

                  {selectedPoints.length === 2 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                      <Stat label="DISTANCE" value={`${calculateDistance(selectedPoints[0], selectedPoints[1]).toFixed(2)} m`} />
                      <Stat label="SLOPE" value={`${calculateSlope(selectedPoints[0], selectedPoints[1]).toFixed(2)}%`} />
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">Elevation Profile</p>
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                              { name: 'P1', elev: selectedPoints[0].elevation },
                              { name: 'Mid', elev: (selectedPoints[0].elevation + selectedPoints[1].elevation) / 2 },
                              { name: 'P2', elev: selectedPoints[1].elevation },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" hide />
                              <YAxis hide domain={['auto', 'auto']} />
                              <Tooltip />
                              <Line type="monotone" dataKey="elev" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: '#2563eb' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="text-emerald-600" size={20} />
                    <h3 className="font-bold">Area Calculation</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-2">Total area of all collected points as a polygon:</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-slate-900">
                      {calculateArea(points).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400 font-bold">m²</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    ({(calculateArea(points) / 10000).toFixed(4)} hectares)
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 p-2 flex justify-around items-center shrink-0">
        <NavButton active={view === 'dashboard'} icon={<Navigation size={20} />} label="Home" onClick={() => setView('dashboard')} />
        <NavButton active={view === 'map'} icon={<MapIcon size={20} />} label="Map" onClick={() => setView('map')} />
        <div className="relative -top-6">
          <button 
            onClick={() => setView('collect')}
            className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200 flex items-center justify-center hover:bg-emerald-500 transition-all active:scale-95"
          >
            <Plus size={32} />
          </button>
        </div>
        <NavButton active={view === 'topo'} icon={<Activity size={20} />} label="Topo" onClick={() => setView('topo')} />
        <NavButton active={view === 'list'} icon={<List size={20} />} label="Data" onClick={() => setView('list')} />
      </nav>
    </div>
  );
}

function DashboardCard({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-left group active:scale-95"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 leading-tight mt-1">{desc}</p>
    </button>
  );
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-mono font-bold text-slate-700">{value}</p>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function CollectForm({ onSave, onCancel }: { onSave: (name: string, desc: string) => void, onCancel: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Collect Point</h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Point Name</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Boundary Corner 1"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Description</label>
          <textarea 
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Notes about this location..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all h-24 resize-none"
          />
        </div>
      </div>

      <button 
        onClick={() => onSave(name || `Point ${Date.now()}`, desc)}
        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        <Save size={20} />
        Save Point
      </button>
    </div>
  );
}

function PointCard({ point, onDelete }: { point: SurveyPoint, onDelete: () => void }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
          <MapPin size={20} />
        </div>
        <div>
          <h4 className="font-bold text-slate-900">{point.name}</h4>
          <p className="text-[10px] text-slate-400 font-mono">
            {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)} • {point.elevation.toFixed(1)}m
          </p>
        </div>
      </div>
      <button 
        onClick={onDelete}
        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

function MapView({ points, currentLocation }: { points: SurveyPoint[], currentLocation: GeolocationCoordinates | null }) {
  const center: [number, number] = currentLocation 
    ? [currentLocation.latitude, currentLocation.longitude] 
    : points.length > 0 
      ? [points[0].latitude, points[0].longitude] 
      : [0, 0];

  return (
    <div className="h-full w-full relative">
      <MapContainer center={center} zoom={15} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {currentLocation && (
          <Marker position={[currentLocation.latitude, currentLocation.longitude]}>
            <Popup>Your Location</Popup>
          </Marker>
        )}

        {points.map(p => (
          <Marker key={p.id} position={[p.latitude, p.longitude]}>
            <Popup>
              <div className="p-1">
                <h3 className="font-bold border-b mb-1">{p.name}</h3>
                <p className="text-xs text-slate-500">{p.description}</p>
                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  Elev: {p.elevation.toFixed(1)}m<br/>
                  Acc: {p.accuracy?.toFixed(1)}m
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {points.length > 2 && (
          <Polygon 
            positions={points.map(p => [p.latitude, p.longitude] as [number, number])} 
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }}
          />
        )}
        
        <MapAutoCenter center={center} />
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur p-2 rounded-xl border border-slate-200 shadow-lg text-[10px] font-bold uppercase tracking-widest">
        {points.length} Points Collected
      </div>
    </div>
  );
}

function MapAutoCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}
