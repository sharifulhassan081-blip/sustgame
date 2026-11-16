import React from 'react';
import {
  BRTC_ROUTES,
  BusRoute,
  SYLHET_BUS_STOPS,
  SYLHET_LANDMARKS,
  SYLHET_NODES,
  SYLHET_SEGMENTS,
} from '../data/sylhetWorldData';
import { Compass, MapPin, Navigation, Route, X } from 'lucide-react';

interface MiniMapProps {
  busX: number;
  busZ: number;
  busHeading: number;
  activeRoute: BusRoute;
  currentStopIndex: number;
  lat: number;
  lng: number;
  onExpand: () => void;
}

// World bounds: X in [-1420, 940], Z in [-500, 830]
const MAP_MIN_X = -1420;
const MAP_MAX_X = 940;
const MAP_MIN_Z = -500;
const MAP_MAX_Z = 830;
const MAP_W = MAP_MAX_X - MAP_MIN_X;
const MAP_H = MAP_MAX_Z - MAP_MIN_Z;

function toSvgX(x: number): number {
  return ((x - MAP_MIN_X) / MAP_W) * 1000;
}
function toSvgY(z: number): number {
  return ((z - MAP_MIN_Z) / MAP_H) * 560;
}

export const SylhetMiniMap: React.FC<MiniMapProps> = ({
  busX,
  busZ,
  busHeading,
  activeRoute,
  currentStopIndex,
  lat,
  lng,
  onExpand,
}) => {
  const bx = toSvgX(busX);
  const by = toSvgY(busZ);
  // Convert Three.js heading (0 = +Z/down, PI/2 = +X/right) to SVG rotation (0 = up)
  const arrowDeg = 180 - (busHeading * 180) / Math.PI;

  const targetStopId = activeRoute.stopIds[currentStopIndex];
  const targetStop = SYLHET_BUS_STOPS.find((s) => s.id === targetStopId);
  let targetPos = { x: bx, y: by };
  if (targetStop) {
    const seg = SYLHET_SEGMENTS.find((sg) => sg.id === targetStop.segmentId);
    if (seg) {
      const n1 = SYLHET_NODES[seg.from];
      const n2 = SYLHET_NODES[seg.to];
      targetPos = {
        x: toSvgX(n1.x + (n2.x - n1.x) * targetStop.t),
        y: toSvgY(n1.z + (n2.z - n1.z) * targetStop.t),
      };
    }
  }

  // Zoomed viewBox centered around the bus for crystal-clear street navigation
  const viewW = 360;
  const viewH = 220;
  const vx = Math.max(0, Math.min(1000 - viewW, bx - viewW / 2));
  const vy = Math.max(0, Math.min(560 - viewH, by - viewH / 2));

  return (
    <button
      type="button"
      onClick={onExpand}
      title="Open Full Sylhet Google-Style Route Map (M)"
      className="group relative w-48 sm:w-60 h-32 sm:h-38 rounded-2xl overflow-hidden border-2 border-emerald-400/50 bg-slate-900/90 shadow-2xl backdrop-blur-md transition hover:border-emerald-300 hover:scale-[1.02] text-left cursor-pointer"
    >
      <svg viewBox={`${vx} ${vy} ${viewW} ${viewH}`} className="w-full h-full">
        {/* Map Terrain Background */}
        <rect x="0" y="0" width="1000" height="560" fill="#0f172a" />

        {/* Northern Tea Gardens Shading */}
        <ellipse cx={toSvgX(-240)} cy={toSvgY(-130)} rx="110" ry="45" fill="#14532d" opacity="0.55" />
        <ellipse cx={toSvgX(820)} cy={toSvgY(360)} rx="85" ry="50" fill="#14532d" opacity="0.55" />

        {/* Surma River Ribbon along Southern Sylhet (Bondor Bazar) */}
        <path
          d={`M 0 ${toSvgY(735)} Q 520 ${toSvgY(710)} 1000 ${toSvgY(745)} L 1000 560 L 0 560 Z`}
          fill="#0284c7"
          opacity="0.6"
        />

        {/* All Sylhet Roads */}
        {SYLHET_SEGMENTS.map((seg) => {
          const n1 = SYLHET_NODES[seg.from];
          const n2 = SYLHET_NODES[seg.to];
          const mid = seg.via?.[0];
          const d = mid
            ? `M ${toSvgX(n1.x)} ${toSvgY(n1.z)} Q ${toSvgX(mid.x)} ${toSvgY(mid.z)} ${toSvgX(n2.x)} ${toSvgY(n2.z)}`
            : `M ${toSvgX(n1.x)} ${toSvgY(n1.z)} L ${toSvgX(n2.x)} ${toSvgY(n2.z)}`;
          return (
            <path
              key={seg.id}
              d={d}
              stroke="#475569"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
            />
          );
        })}

        {/* Highlighted Active BRTC Route Line (Google Maps Navigation Blue/Green!) */}
        {activeRoute.nodePath.slice(0, -1).map((nodeId, idx) => {
          const nextId = activeRoute.nodePath[idx + 1];
          const n1 = SYLHET_NODES[nodeId];
          const n2 = SYLHET_NODES[nextId];
          return (
            <line
              key={`${nodeId}_${nextId}_${idx}`}
              x1={toSvgX(n1.x)}
              y1={toSvgY(n1.z)}
              x2={toSvgX(n2.x)}
              y2={toSvgY(n2.z)}
              stroke="#22c55e"
              strokeWidth="6"
              strokeLinecap="round"
            />
          );
        })}

        {/* Major Sylhet Nodes & Labels */}
        {Object.values(SYLHET_NODES).map((node) => (
          <g key={node.id}>
            <circle cx={toSvgX(node.x)} cy={toSvgY(node.z)} r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
            <text
              x={toSvgX(node.x)}
              y={toSvgY(node.z) - 10}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="11"
              fontWeight="700"
            >
              {node.name.split(' (')[0]}
            </text>
          </g>
        ))}

        {/* Key Landmark Pins (Mount Adora & Shwapno) */}
        {SYLHET_LANDMARKS.filter(
          (l) => l.category === 'hospital' || l.category === 'supershop'
        ).map((lm) => (
          <circle
            key={lm.id}
            cx={toSvgX(lm.x)}
            cy={toSvgY(lm.z)}
            r="5"
            fill={lm.category === 'hospital' ? '#38bdf8' : '#fb7185'}
          />
        ))}

        {/* Target Next Stop Pulsing Marker */}
        <circle cx={targetPos.x} cy={targetPos.y} r="12" fill="#22c55e" opacity="0.35" />
        <circle cx={targetPos.x} cy={targetPos.y} r="6.5" fill="#4ade80" stroke="#ffffff" strokeWidth="2" />

        {/* Live BRTC Double-Decker Bus GPS Arrow */}
        <g transform={`translate(${bx}, ${by}) rotate(${arrowDeg})`}>
          <circle r="13" fill="#ef4444" opacity="0.32" />
          <polygon points="0,-11 8,9 0,5 -8,9" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
        </g>
      </svg>

      {/* GPS Header Overlay */}
      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
          <Navigation className="w-3 h-3" /> SYLHET GPS
        </span>
        <span className="rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 group-hover:bg-emerald-600 group-hover:text-white transition">
          [M] Full Map
        </span>
      </div>

      {/* Real Sylhet Lat/Lng Footer */}
      <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-slate-950/75 px-1.5 py-0.5 rounded pointer-events-none">
        <span>{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</span>
        <span className="text-amber-300 font-sans font-semibold">Tap to Explore</span>
      </div>
    </button>
  );
};

interface FullMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  busX: number;
  busZ: number;
  busHeading: number;
  activeRoute: BusRoute;
  currentStopIndex: number;
  onSelectRoute: (routeId: string) => void;
  onTeleportToStop: (stopIndex: number) => void;
}

export const SylhetFullMapModal: React.FC<FullMapModalProps> = ({
  isOpen,
  onClose,
  busX,
  busZ,
  busHeading,
  activeRoute,
  currentStopIndex,
  onSelectRoute,
  onTeleportToStop,
}) => {
  if (!isOpen) return null;

  const bx = toSvgX(busX);
  const by = toSvgY(busZ);
  const arrowDeg = 180 - (busHeading * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6">
      <div className="relative flex flex-col lg:flex-row w-full max-w-6xl max-h-[92vh] rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Left/Main Interactive Sylhet Street Map */}
        <div className="flex-1 flex flex-col min-h-[320px] bg-slate-950 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                Sylhet City BRTC Route & Landmark Map
              </h2>
              <p className="text-xs text-slate-400">
                Modeled after Google Maps Sylhet: SUST → Akhalia (Mount Adora) → Madina Market → Pathantula (Shwapno) → Ambarkhana → Zindabazar → Bondor Bazar & Tilagor
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 p-2 text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex-1 rounded-2xl border border-slate-800 overflow-hidden bg-[#0b1220]">
            <svg viewBox="0 0 1000 560" className="w-full h-full">
              {/* Grid lines */}
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((gx) => (
                <line key={gx} x1={gx} y1={0} x2={gx} y2={560} stroke="#1e293b" strokeWidth="1" />
              ))}
              {[100, 200, 300, 400, 500].map((gy) => (
                <line key={gy} x1={0} y1={gy} x2={1000} y2={gy} stroke="#1e293b" strokeWidth="1" />
              ))}

              {/* Tea Gardens & Eco Park Green Zones */}
              <ellipse cx={toSvgX(-245)} cy={toSvgY(-105)} rx="95" ry="42" fill="#14532d" opacity="0.45" />
              <text x={toSvgX(-245)} y={toSvgY(-115)} textAnchor="middle" fill="#86efac" fontSize="10" fontWeight="700">
                Lakkatura / Tarapur Tea Gardens
              </text>

              <ellipse cx={toSvgX(830)} cy={toSvgY(360)} rx="85" ry="48" fill="#14532d" opacity="0.45" />

              {/* Surma River */}
              <path
                d={`M 0 ${toSvgY(725)} Q 520 ${toSvgY(705)} 1000 ${toSvgY(740)} L 1000 560 L 0 560 Z`}
                fill="#0369a1"
                opacity="0.65"
              />
              <text x="580" y="542" fill="#bae6fd" fontSize="13" fontWeight="800" letterSpacing="3">
                SURMA RIVER (সুরমা নদী) • KEANE BRIDGE
              </text>

              {/* All Connected Roads */}
              {SYLHET_SEGMENTS.map((seg) => {
                const n1 = SYLHET_NODES[seg.from];
                const n2 = SYLHET_NODES[seg.to];
                const mid = seg.via?.[0];
                const d = mid
                  ? `M ${toSvgX(n1.x)} ${toSvgY(n1.z)} Q ${toSvgX(mid.x)} ${toSvgY(mid.z)} ${toSvgX(n2.x)} ${toSvgY(n2.z)}`
                  : `M ${toSvgX(n1.x)} ${toSvgY(n1.z)} L ${toSvgX(n2.x)} ${toSvgY(n2.z)}`;
                return (
                  <path
                    key={seg.id}
                    d={d}
                    stroke="#334155"
                    strokeWidth="12"
                    strokeLinecap="round"
                    fill="none"
                  />
                );
              })}

              {/* Highlighted Active BRTC Route */}
              {activeRoute.nodePath.slice(0, -1).map((nodeId, idx) => {
                const nextId = activeRoute.nodePath[idx + 1];
                const n1 = SYLHET_NODES[nodeId];
                const n2 = SYLHET_NODES[nextId];
                return (
                  <line
                    key={`full_${nodeId}_${nextId}_${idx}`}
                    x1={toSvgX(n1.x)}
                    y1={toSvgY(n1.z)}
                    x2={toSvgX(n2.x)}
                    y2={toSvgY(n2.z)}
                    stroke={activeRoute.color}
                    strokeWidth="6.5"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Landmark Pins (Mount Adora, Shwapno, Shaheed Minar, Al-Hamra, MC College, etc.) */}
              {SYLHET_LANDMARKS.map((lm) => (
                <g key={lm.id}>
                  <circle
                    cx={toSvgX(lm.x)}
                    cy={toSvgY(lm.z)}
                    r="5.5"
                    fill={lm.accentColor}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                </g>
              ))}

              {/* Road Nodes with Labels */}
              {Object.values(SYLHET_NODES).map((node) => (
                <g key={node.id}>
                  <circle
                    cx={toSvgX(node.x)}
                    cy={toSvgY(node.z)}
                    r="7"
                    fill="#f8fafc"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={toSvgX(node.x) - 62}
                    y={toSvgY(node.z) - 25}
                    width="124"
                    height="15"
                    rx="4"
                    fill="#0f172a"
                    opacity="0.82"
                  />
                  <text
                    x={toSvgX(node.x)}
                    y={toSvgY(node.z) - 14}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="10.5"
                    fontWeight="700"
                  >
                    {node.name.split(' (')[0]}
                  </text>
                </g>
              ))}

              {/* Live BRTC Bus Marker */}
              <g transform={`translate(${bx}, ${by}) rotate(${arrowDeg})`}>
                <circle r="15" fill="#ef4444" opacity="0.35" />
                <polygon points="0,-12 9,10 0,6 -9,10" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
              </g>
            </svg>

            {/* Legend */}
            <div className="absolute bottom-2.5 left-3 flex flex-wrap gap-2 text-[11px] bg-slate-950/85 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Shwapno Super Shops (3)
              </span>
              <span className="flex items-center gap-1 text-sky-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Mount Adora Hospital
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> SUST / Shahi Eidgah / MC College
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Switch Route & Fast-Jump to Any Stop */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/95 p-4 sm:p-5 overflow-y-auto max-h-[42vh] lg:max-h-none space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2.5">
              <Route className="w-4 h-4" /> Switch BRTC Sylhet Route
            </h3>
            <div className="space-y-2">
              {BRTC_ROUTES.map((rt) => {
                const selected = rt.id === activeRoute.id;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => {
                      onSelectRoute(rt.id);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-red-600 text-white">
                        {rt.code}
                      </span>
                      <span className="text-[11px] text-amber-300 font-bold">Fare: ৳5 Tk</span>
                    </div>
                    <div className="text-xs font-bold text-white mt-1.5">{rt.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{rt.bnName}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5 mb-2">
              <MapPin className="w-4 h-4" /> Jump Bus to Stop on Active Route
            </h3>
            <p className="text-[11px] text-slate-400 mb-2.5">
              Click any stop below to jump straight there and inspect its Sylhet Street-View landmarks:
            </p>
            <div className="space-y-1.5">
              {activeRoute.stopIds.map((stopId, idx) => {
                const st = SYLHET_BUS_STOPS.find((s) => s.id === stopId);
                if (!st) return null;
                const isCur = idx === currentStopIndex;
                return (
                  <button
                    key={stopId}
                    type="button"
                    onClick={() => {
                      onTeleportToStop(idx);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs border transition cursor-pointer ${
                      isCur
                        ? 'border-emerald-500 bg-emerald-500/20 text-white font-bold'
                        : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div>
                        {idx + 1}. {st.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{st.landmarkHint}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-semibold">
                      Go
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
