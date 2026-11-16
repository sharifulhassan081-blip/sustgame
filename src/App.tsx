import React, { useEffect, useRef, useState } from 'react';
import {
  BRTC_ROUTES,
  LOWER_DECK_CAPACITY,
  STUDENT_FARE_TK,
  UPPER_DECK_CAPACITY,
} from './data/sylhetWorldData';
import {
  FarePopupEvent,
  GameHUDState,
  SylhetBusGameEngine,
  WeatherMode,
} from './engine/SylhetBusGameEngine';
import { SylhetFullMapModal, SylhetMiniMap } from './components/SylhetMapOverlay';
import {
  Award,
  Bus,
  Camera,
  CloudRain,
  Coins,
  Compass,
  DoorOpen,
  HelpCircle,
  Lightbulb,
  MapPin,
  Navigation,
  RotateCcw,
  ShieldCheck,
  Sun,
  Sunset,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';

const INITIAL_HUD: GameHUDState = {
  speedKmh: 0,
  gear: 'N',
  doorOpen: false,
  canBoardNow: false,
  boardingInProgress: false,
  waitingAtCurrentStop: 14,
  lowerDeckCount: 0,
  upperDeckCount: 0,
  totalPassengers: 0,
  totalFareTk: 0,
  totalStudentsServed: 0,
  safetyScore: 100,
  routeId: BRTC_ROUTES[0].id,
  routeCode: BRTC_ROUTES[0].code,
  routeName: BRTC_ROUTES[0].name,
  routeBnName: BRTC_ROUTES[0].bnName,
  currentStopIndex: 0,
  totalStops: BRTC_ROUTES[0].stopIds.length,
  nextStopName: 'SUST Campus (Gol Chattar)',
  nextStopBnName: 'শাবিপ্রবি গোল চত্বর স্টপেজ',
  nextStopArea: 'SUST Campus',
  nextStopDistanceM: 35,
  routeCompleted: false,
  busX: -1280,
  busZ: -340,
  busHeading: 0,
  lat: 24.9165,
  lng: 91.8319,
  currentStreetName: 'SUST 1-Kilometer Road (Kilo Rd)',
  cameraMode: 'chase',
  weatherMode: 'day',
  headlightsOn: false,
  muted: false,
  conductorMessage: 'এই ভার্সিটি গেট, মদিনা মার্কেট, আম্বরখানা, জিন্দাবাজার! স্টুডেন্ট ভাড়া ৫ টাকা!',
  nearbyLandmark: null,
  latestFarePopup: null,
};

export const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SylhetBusGameEngine | null>(null);
  const lastPopupIdRef = useRef<number>(0);

  const [inMenu, setInMenu] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState(BRTC_ROUTES[0].id);
  const [hud, setHud] = useState<GameHUDState>(INITIAL_HUD);
  const [farePopups, setFarePopups] = useState<FarePopupEvent[]>([]);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [controlsHelpOpen, setControlsHelpOpen] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new SylhetBusGameEngine(mountRef.current, (nextHud) => {
      setHud(nextHud);
      if (
        nextHud.latestFarePopup &&
        nextHud.latestFarePopup.id !== lastPopupIdRef.current
      ) {
        lastPopupIdRef.current = nextHud.latestFarePopup.id;
        const pop = nextHud.latestFarePopup;
        setFarePopups((prev) => [...prev.slice(-5), pop]);
      }
    });
    engineRef.current = engine;

    const onKeyMap = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        setFullMapOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyMap);

    return () => {
      window.removeEventListener('keydown', onKeyMap);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = (routeId: string) => {
    setSelectedRouteId(routeId);
    setInMenu(false);
    if (engineRef.current) {
      engineRef.current.loadRoute(routeId);
      engineRef.current.setMenuPreview(false);
    }
  };

  const activeRoute =
    BRTC_ROUTES.find((r) => r.id === hud.routeId) ?? BRTC_ROUTES[0];

  const setTouchSteer = (val: number) => {
    if (engineRef.current) engineRef.current.touchControls.steer = val;
  };
  const setTouchThrottle = (val: number) => {
    if (engineRef.current) engineRef.current.touchControls.throttle = val;
  };
  const setTouchBrake = (val: boolean) => {
    if (engineRef.current) engineRef.current.touchControls.brake = val;
  };

  const cycleWeather = () => {
    if (!engineRef.current) return;
    const order: WeatherMode[] = ['day', 'sunset', 'rain'];
    const next = order[(order.indexOf(hud.weatherMode) + 1) % order.length];
    engineRef.current.setWeather(next);
  };

  const cameraLabel: Record<GameHUDState['cameraMode'], string> = {
    chase: '3rd Person Bus',
    cockpit: 'Driver Cabin',
    upper_deck: '2nd Deck View',
    aerial: 'Sylhet Aerial',
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 3D Sylhet Streets WebGL Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Floating +৳5 Tk Fare Boarding Popups */}
      {!inMenu && (
        <div className="pointer-events-none fixed top-28 right-6 sm:right-72 z-30 flex flex-col items-end gap-1">
          {farePopups.map((p) => (
            <div
              key={p.id}
              className="animate-fare-pop flex items-center gap-1.5 rounded-full bg-emerald-500/95 px-3.5 py-1 text-xs sm:text-sm font-black text-slate-950 shadow-lg border border-yellow-300"
            >
              <Coins className="w-4 h-4 text-yellow-900" />
              +৳{p.amount} Tk • Student #{p.studentNumber}
            </div>
          ))}
        </div>
      )}

      {/* ==================== START / SYLHET ROUTE SELECTOR SCREEN ==================== */}
      {inMenu && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-slate-950/80 via-slate-950/65 to-slate-950/90 backdrop-blur-[3px] p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-5xl rounded-3xl border border-emerald-500/40 bg-slate-900/90 shadow-2xl backdrop-blur-xl p-5 sm:p-8 my-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-600/20 border border-red-500/40 px-3 py-1 text-xs font-extrabold text-red-300 mb-2">
                  <Bus className="w-4 h-4 text-red-400" />
                  BANGLADESH ROAD TRANSPORT CORPORATION • SYLHET DOUBLE-DECKER
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                  SUST – Sylhet BRTC Bus Simulator
                </h1>
                <p className="text-xs sm:text-sm text-emerald-300 font-semibold mt-1">
                  শাবিপ্রবি ⇄ আখালিয়া (মাউন্ট অ্যাডোরা) ⇄ মদিনা মার্কেট ⇄ পাঠানটুলা (স্বপ্ন) ⇄ আম্বরখানা ⇄ জিন্দাবাজার ⇄ বন্দর বাজার ⇄ টিলাগড়
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                <div className="rounded-2xl bg-emerald-950/80 border border-emerald-500/40 px-4 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                    Student Fare
                  </div>
                  <div className="text-xl font-black text-yellow-300">৳{STUDENT_FARE_TK} Tk</div>
                </div>
                <div className="rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">
                    Bus Type
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">Red-Green 2-Decker</div>
                </div>
              </div>
            </div>

            {/* Recognizable Landmarks Strip */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
              <span className="font-bold text-amber-300 mr-1">Street-View Landmarks Included:</span>
              {[
                '🏥 Mount Adora Hospital (Akhalia)',
                '🛒 Shwapno Super Shop (Pathantula, Zindabazar & Shibganj)',
                '🎓 SUST Kilo Rd & Main Gate',
                '🏪 Madina Market & Walton',
                '🕌 Dorshon Dewri & Shahi Eidgah',
                '🏛️ Chouhatta Shaheed Minar',
                '🏬 Al-Hamra & Blue Water (Zindabazar)',
                '🌉 Keane Bridge & Ali Amjad\'s Clock (Bondor)',
                '🏫 MC College (Tilagor)',
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Choose Route Grid */}
            <div className="mt-5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
                Select Your Sylhet BRTC Route ({BRTC_ROUTES.length} Multi-Stop Routes):
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BRTC_ROUTES.map((rt) => {
                  const isSelected = selectedRouteId === rt.id;
                  return (
                    <div
                      key={rt.id}
                      onClick={() => setSelectedRouteId(rt.id)}
                      className={`rounded-2xl border p-4 transition cursor-pointer ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-950/50'
                          : 'border-slate-800 bg-slate-950/65 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="rounded-lg px-2.5 py-0.5 text-xs font-black text-white"
                          style={{ backgroundColor: rt.color }}
                        >
                          {rt.code}
                        </span>
                        <span className="text-xs font-bold text-emerald-300">
                          {rt.stopIds.length} Stops • Fare ৳5 Tk
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-2">{rt.name}</h3>
                      <p className="text-xs text-amber-200/90 font-medium mt-0.5">{rt.bnName}</p>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        {rt.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls Quick Bar & Launch Button */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  <span className="font-bold text-white">Drive:</span>{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">W A S D</kbd> or{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">Arrow Keys</kbd> (or Touch Pedals)
                </div>
                <div>
                  <span className="font-bold text-white">Board Students (৳5):</span> Stop at green bay & press{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono">O</kbd> Door •{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono">H</kbd> BRTC Horn •{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-mono">C</kbd> Camera •{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-rose-300 font-mono">M</kbd> Sylhet Map
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleStartGame(selectedRouteId)}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-emerald-600 hover:from-red-500 hover:to-emerald-500 px-7 py-4 text-base font-black text-white shadow-xl shadow-red-950/50 border border-yellow-300/40 transition transform hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                🚍 START DRIVING BRTC BUS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ACTIVE GAMEPLAY HUD ==================== */}
      {!inMenu && (
        <>
          {/* TOP HUD ROW */}
          <div className="pointer-events-none fixed top-2.5 left-2.5 right-2.5 z-20 flex items-start justify-between gap-2">
            {/* Top-Left: Route, Street, Next Stop & Helper/Conductor Callout */}
            <div className="pointer-events-auto flex flex-col gap-2 max-w-xs sm:max-w-md">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/85 backdrop-blur-md p-3 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                    <Bus className="w-3.5 h-3.5" /> {hud.routeCode} • 2-DECKER
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-300 truncate">
                    📍 {hud.currentStreetName}
                  </span>
                </div>

                {/* Next Stop Progress */}
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Next Stop ({Math.min(hud.currentStopIndex + 1, hud.totalStops)}/{hud.totalStops})
                    </div>
                    <div className="text-sm font-black text-white truncate">
                      {hud.nextStopName}
                    </div>
                    <div className="text-xs text-amber-300 font-medium truncate">
                      {hud.nextStopBnName}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1.5 text-right">
                    <div className="text-sm font-black text-emerald-300">
                      {hud.nextStopDistanceM}m
                    </div>
                    <div className="text-[10px] text-slate-300">
                      {hud.waitingAtCurrentStop} waiting
                    </div>
                  </div>
                </div>

                {/* Conductor Speech Bar */}
                <div className="mt-2 rounded-xl bg-slate-900/95 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-200 flex items-center gap-2">
                  <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300">
                    হেল্পার
                  </span>
                  <span className="line-clamp-2 leading-snug">{hud.conductorMessage}</span>
                </div>
              </div>
            </div>

            {/* Top-Center: Recognizable Sylhet Street-View Landmark Callout & Stop Prompt */}
            <div className="hidden lg:flex flex-col items-center gap-2 max-w-md">
              {hud.nearbyLandmark && (
                <div
                  className="rounded-2xl border-2 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 shadow-2xl text-center transition-all"
                  style={{ borderColor: hud.nearbyLandmark.accentColor }}
                >
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                    <MapPin className="w-3.5 h-3.5" /> SYLHET STREET VIEW LANDMARK
                  </div>
                  <div className="text-base font-black text-white mt-0.5">
                    {hud.nearbyLandmark.name}
                  </div>
                  <div className="text-xs font-bold text-amber-300">
                    {hud.nearbyLandmark.bnName}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {hud.nearbyLandmark.subtitle}
                  </div>
                </div>
              )}

              {hud.canBoardNow && !hud.doorOpen && (
                <div className="animate-bounce rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 shadow-xl border-2 border-yellow-300">
                  🚏 BUS STOP REACHED! Press [O] or Tap OPEN DOOR to Board Students (৳5 Tk)
                </div>
              )}

              {hud.boardingInProgress && (
                <div className="rounded-2xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow-xl border-2 border-white">
                  🎒 Students Boarding Double-Decker... (+৳5 Tk each • {hud.waitingAtCurrentStop} left)
                </div>
              )}
            </div>

            {/* Top-Right: 5 Tk Fare Wallet + Double-Decker Seat Occupancy + Live Sylhet GPS Minimap */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/85 backdrop-blur-md p-2.5 sm:p-3 shadow-xl w-48 sm:w-60">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Total Fare (৳5/Student)
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-yellow-300 flex items-center gap-1">
                      ৳ {hud.totalFareTk} <span className="text-xs font-bold text-emerald-300">Tk</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> {hud.safetyScore}%
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {hud.totalStudentsServed} tickets
                    </div>
                  </div>
                </div>

                {/* Double-Decker Occupancy Bars */}
                <div className="mt-2 space-y-1 text-[10px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1 font-semibold">
                      <Users className="w-3 h-3 text-sky-400" /> Upper Deck
                    </span>
                    <span className="font-mono font-bold">
                      {hud.upperDeckCount}/{UPPER_DECK_CAPACITY}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-all"
                      style={{
                        width: `${Math.min(100, (hud.upperDeckCount / UPPER_DECK_CAPACITY) * 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-slate-300 pt-0.5">
                    <span className="flex items-center gap-1 font-semibold">
                      <Users className="w-3 h-3 text-emerald-400" /> Lower Deck
                    </span>
                    <span className="font-mono font-bold">
                      {hud.lowerDeckCount}/{LOWER_DECK_CAPACITY}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{
                        width: `${Math.min(100, (hud.lowerDeckCount / LOWER_DECK_CAPACITY) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Live Sylhet Google-Maps-Style GPS Minimap */}
              <SylhetMiniMap
                busX={hud.busX}
                busZ={hud.busZ}
                busHeading={hud.busHeading}
                activeRoute={activeRoute}
                currentStopIndex={hud.currentStopIndex}
                lat={hud.lat}
                lng={hud.lng}
                onExpand={() => setFullMapOpen(true)}
              />
            </div>
          </div>

          {/* Mobile/Compact Landmark & Boarding Toast */}
          <div className="lg:hidden pointer-events-none fixed top-44 left-3 right-3 z-20 flex flex-col items-center gap-1.5">
            {hud.nearbyLandmark && (
              <div className="rounded-xl bg-slate-950/85 border border-emerald-400/50 px-3 py-1 text-center">
                <div className="text-xs font-black text-white">{hud.nearbyLandmark.name}</div>
                <div className="text-[10px] text-amber-300">{hud.nearbyLandmark.bnName}</div>
              </div>
            )}
            {hud.canBoardNow && !hud.doorOpen && (
              <div className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-black text-slate-950 shadow-lg">
                🚏 Tap OPEN DOOR to Board Students (+৳5 Tk)
              </div>
            )}
          </div>

          {/* BOTTOM CONTROLS & BUS DASHBOARD */}
          <div className="pointer-events-none fixed bottom-2.5 left-2.5 right-2.5 z-20 flex flex-col gap-2">
            {/* Utility Quick Strip */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => engineRef.current?.cycleCamera()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-200 shadow cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                {cameraLabel[hud.cameraMode]} [C]
              </button>

              <button
                type="button"
                onClick={cycleWeather}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-200 shadow cursor-pointer"
              >
                {hud.weatherMode === 'day' && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
                {hud.weatherMode === 'sunset' && <Sunset className="w-3.5 h-3.5 text-orange-400" />}
                {hud.weatherMode === 'rain' && <CloudRain className="w-3.5 h-3.5 text-sky-400" />}
                {hud.weatherMode === 'day'
                  ? 'Sunny Sylhet'
                  : hud.weatherMode === 'sunset'
                    ? 'Surma Sunset'
                    : 'Sylhet Rain'}
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.toggleHeadlights()}
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold shadow cursor-pointer ${
                  hud.headlightsOn
                    ? 'bg-yellow-400/20 border-yellow-400 text-yellow-200'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" /> Lights [L]
              </button>

              <button
                type="button"
                onClick={() => setFullMapOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 px-2.5 py-1.5 text-xs font-bold text-emerald-300 shadow cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" /> Routes & Map [M]
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.resetBusToNearestRoad()}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 shadow cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset [R]
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.toggleMute()}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 shadow cursor-pointer"
              >
                {hud.muted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setControlsHelpOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 shadow cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>

            {/* Main Driving Deck: Steering | Speedometer + Door + Horn | Gas & Brake */}
            <div className="pointer-events-auto flex items-end justify-between gap-2">
              {/* Left Steering Buttons (Touch & Mouse) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => setTouchSteer(-1)}
                  onPointerUp={() => setTouchSteer(0)}
                  onPointerLeave={() => setTouchSteer(0)}
                  onPointerCancel={() => setTouchSteer(0)}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 active:bg-emerald-600 border-2 border-slate-700 text-xl font-black text-white shadow-xl flex items-center justify-center cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onPointerDown={() => setTouchSteer(1)}
                  onPointerUp={() => setTouchSteer(0)}
                  onPointerLeave={() => setTouchSteer(0)}
                  onPointerCancel={() => setTouchSteer(0)}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 active:bg-emerald-600 border-2 border-slate-700 text-xl font-black text-white shadow-xl flex items-center justify-center cursor-pointer"
                >
                  ▶
                </button>
              </div>

              {/* Center Instrument Cluster + Door & Horn */}
              <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-slate-700/90 bg-slate-950/90 backdrop-blur-md px-3 sm:px-5 py-2 shadow-2xl">
                {/*BRTC Air Horn */}
                <button
                  type="button"
                  onClick={() => engineRef.current?.honkHorn()}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-3 py-2.5 text-xs font-black text-slate-950 shadow-lg cursor-pointer"
                >
                  📢 HORN [H]
                </button>

                {/* Digital Speedometer */}
                <div className="text-center px-2 sm:px-4 border-x border-slate-800">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                      {Math.abs(hud.speedKmh)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">KM/H</span>
                  </div>
                  <div className="text-[10px] font-extrabold tracking-widest text-emerald-400">
                    GEAR {hud.gear}
                  </div>
                </div>

                {/* Pneumatic Passenger Door Toggle */}
                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleDoor()}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-black shadow-lg transition cursor-pointer ${
                    hud.doorOpen
                      ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-300'
                      : hud.canBoardNow
                        ? 'animate-pulse bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-2 border-yellow-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                  }`}
                >
                  <DoorOpen className="w-4 h-4" />
                  {hud.doorOpen ? 'CLOSE DOOR [O]' : 'OPEN DOOR [O]'}
                </button>
              </div>

              {/* Right Pedals: Brake/Reverse & Gas */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => {
                    setTouchThrottle(-1);
                    setTouchBrake(false);
                  }}
                  onPointerUp={() => setTouchThrottle(0)}
                  onPointerLeave={() => setTouchThrottle(0)}
                  onPointerCancel={() => setTouchThrottle(0)}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-950/90 active:bg-rose-600 border-2 border-rose-500/60 text-[11px] font-black text-rose-200 shadow-xl flex flex-col items-center justify-center cursor-pointer"
                >
                  <span>▼</span>
                  <span>BRAKE</span>
                </button>
                <button
                  type="button"
                  onPointerDown={() => setTouchThrottle(1)}
                  onPointerUp={() => setTouchThrottle(0)}
                  onPointerLeave={() => setTouchThrottle(0)}
                  onPointerCancel={() => setTouchThrottle(0)}
                  className="w-14 h-16 sm:w-16 sm:h-20 rounded-2xl bg-emerald-700/90 active:bg-emerald-500 border-2 border-emerald-400 text-xs font-black text-white shadow-xl flex flex-col items-center justify-center cursor-pointer"
                >
                  <span>▲</span>
                  <span>GAS</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== CONTROLS HELP MODAL ==================== */}
      {controlsHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-emerald-400" /> BRTC Driver Controls
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <p><strong>W / ↑ :</strong> Accelerate BRTC Double-Decker</p>
              <p><strong>S / ↓ :</strong> Brake / Reverse</p>
              <p><strong>A / D or ← / → :</strong> Steer Left / Right (Bangladesh drives on the LEFT!)</p>
              <p><strong>Space :</strong> Handbrake</p>
              <p><strong>O or E :</strong> Open / Close Left Boarding Door at Bus Stops (+৳5 Tk per student!)</p>
              <p><strong>H :</strong> BRTC Hydraulic Horn (Rickshaws & CNGs pull aside!)</p>
              <p><strong>C :</strong> Switch Camera (3rd-Person, Driver Cabin, 2nd Deck, Aerial)</p>
              <p><strong>M :</strong> Open Full Sylhet Route & Landmark Map</p>
              <p><strong>R :</strong> Reset Bus cleanly onto nearest road</p>
            </div>
            <button
              type="button"
              onClick={() => setControlsHelpOpen(false)}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-black text-white cursor-pointer"
            >
              Back to Driving
            </button>
          </div>
        </div>
      )}

      {/* ==================== ROUTE COMPLETED CELEBRATION MODAL ==================== */}
      {hud.routeCompleted && !inMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-emerald-400 bg-slate-900 p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
              <Award className="w-9 h-9 text-yellow-300" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
                SYLHET BRTC TRIP COMPLETED!
              </div>
              <h2 className="text-2xl font-black text-white mt-1">{hud.routeName}</h2>
              <p className="text-xs text-amber-300 mt-1">{hud.routeBnName}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Fare</div>
                <div className="text-xl font-black text-yellow-300 mt-0.5">৳{hud.totalFareTk}</div>
              </div>
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Students</div>
                <div className="text-xl font-black text-emerald-400 mt-0.5">
                  {hud.totalStudentsServed}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Safety</div>
                <div className="text-xl font-black text-sky-400 mt-0.5">{hud.safetyScore}%</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  const idx = BRTC_ROUTES.findIndex((r) => r.id === hud.routeId);
                  const nextRoute = BRTC_ROUTES[(idx + 1) % BRTC_ROUTES.length];
                  handleStartGame(nextRoute.id);
                }}
                className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-black text-white shadow-lg cursor-pointer"
              >
                🚍 Drive Next Sylhet Route
              </button>
              <button
                type="button"
                onClick={() => setInMenu(true)}
                className="rounded-2xl bg-slate-800 hover:bg-slate-700 px-5 py-3.5 text-sm font-bold text-slate-200 cursor-pointer"
              >
                All Routes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FULL SYLHET ROUTE & LANDMARK MAP ==================== */}
      <SylhetFullMapModal
        isOpen={fullMapOpen}
        onClose={() => setFullMapOpen(false)}
        busX={hud.busX}
        busZ={hud.busZ}
        busHeading={hud.busHeading}
        activeRoute={activeRoute}
        currentStopIndex={hud.currentStopIndex}
        onSelectRoute={(routeId) => {
          setInMenu(false);
          engineRef.current?.loadRoute(routeId);
          engineRef.current?.setMenuPreview(false);
        }}
        onTeleportToStop={(stopIdx) => {
          engineRef.current?.teleportToStop(stopIdx);
        }}
      />
    </div>
  );
};

export default App;
