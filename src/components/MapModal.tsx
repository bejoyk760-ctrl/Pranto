import React, { useEffect, useRef } from 'react';
import {
  BEACH_START_X,
  CANAL_HALF_W,
  CANAL_Z,
  ROAD_X,
  ROAD_Z,
} from '../game/math';
import type { HudSnapshot } from '../game/types';

interface MapModalProps {
  hud: HudSnapshot;
  onSetWaypoint: (x: number | null, z: number | null) => void;
  onClose: () => void;
}

const MAP_WORLD_MIN = -140;
const MAP_WORLD_MAX = 140;
const MAP_WORLD_SPAN = MAP_WORLD_MAX - MAP_WORLD_MIN;

export const MapModal: React.FC<MapModalProps> = ({
  hud,
  onSetWaypoint,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const toPx = (wx: number, wz: number) => ({
      px: ((wx - MAP_WORLD_MIN) / MAP_WORLD_SPAN) * w,
      py: ((wz - MAP_WORLD_MIN) / MAP_WORLD_SPAN) * h,
    });
    const scale = w / MAP_WORLD_SPAN;

    ctx.clearRect(0, 0, w, h);

    // Ocean
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, w, h);

    // Landmass
    ctx.fillStyle = '#1e293b';
    const landEnd = toPx(BEACH_START_X, 140);
    ctx.fillRect(0, 0, landEnd.px, h);

    // Beach
    ctx.fillStyle = '#d4b475';
    ctx.fillRect(landEnd.px, 0, 29 * scale, h);

    // Ocean Pier
    const pierStart = toPx(BEACH_START_X, -5.5);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(pierStart.px, pierStart.py, 75 * scale, 11 * scale);

    // South Lagoon Canal
    const canalTop = toPx(-140, CANAL_Z - CANAL_HALF_W);
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(0, canalTop.py, landEnd.px + 10 * scale, CANAL_HALF_W * 2 * scale);

    // Palm Park
    const parkTop = toPx(-38, -86);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(parkTop.px, parkTop.py, 28 * scale, 28 * scale);

    // Roads
    ctx.fillStyle = '#475569';
    for (const rx of ROAD_X) {
      const p = toPx(rx - 6, -140);
      ctx.fillRect(p.px, 0, 12 * scale, h);
    }
    for (const rz of ROAD_Z) {
      const p = toPx(-140, rz - 6);
      ctx.fillRect(0, p.py, landEnd.px, 12 * scale);
    }

    // Landmark labels
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.fillStyle = '#a7f3d0';
    const lobbyPt = toPx(24, -24);
    ctx.fillText('Hotel Lobby', lobbyPt.px - 26, lobbyPt.py);
    const cafePt = toPx(24, 24);
    ctx.fillText('Surf Cafe', cafePt.px - 20, cafePt.py);
    const pierPt = toPx(106, -10);
    ctx.fillText('Ocean Pier', pierPt.px - 20, pierPt.py);
    const parkLbl = toPx(-24, -72);
    ctx.fillStyle = '#bbf7d0';
    ctx.fillText('Palm Park', parkLbl.px - 22, parkLbl.py);

    // Vehicles & Stars
    for (const ent of hud.nearbyVehicles) {
      const pt = toPx(ent.x, ent.z);
      if (ent.kind === 'star') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = ent.kind === 'bus' ? '#f59e0b' : '#e2e8f0';
        ctx.fillRect(pt.px - 2, pt.py - 2, 4, 4);
      }
    }

    // Active Mission Checkpoint
    if (hud.waypointX !== null && hud.waypointZ !== null) {
      const cp = toPx(hud.waypointX, hud.waypointZ);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cp.px, cp.py, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(cp.px, cp.py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Custom Waypoint
    if (hud.customWaypoint) {
      const cw = toPx(hud.customWaypoint.x, hud.customWaypoint.z);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cw.px, cw.py, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cw.px - 6, cw.py);
      ctx.lineTo(cw.px + 6, cw.py);
      ctx.moveTo(cw.px, cw.py - 6);
      ctx.lineTo(cw.px, cw.py + 6);
      ctx.stroke();
    }

    // Player Marker
    const pl = toPx(hud.playerX, hud.playerZ);
    ctx.save();
    ctx.translate(pl.px, pl.py);
    ctx.fillStyle = '#2dd4bf';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [hud]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const wx = Math.round(MAP_WORLD_MIN + nx * MAP_WORLD_SPAN);
    const wz = Math.round(MAP_WORLD_MIN + ny * MAP_WORLD_SPAN);
    onSetWaypoint(wx, wz);
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-3 bg-[rgba(6,10,19,0.82)]"
      role="dialog"
      aria-modal="true"
      aria-label="Solana Bay City Map"
    >
      <div className="w-full max-w-[540px] max-h-[94%] overflow-y-auto rounded-xl bg-[#0e1526] border border-white/15 p-3.5 sm:p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-white">
              Solana Bay City Map
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300">
              Click anywhere on the map to place a cyan navigation waypoint.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
          >
            Close [Tab]
          </button>
        </div>

        <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px] aspect-square rounded-lg overflow-hidden border border-white/20">
          <canvas
            ref={canvasRef}
            width={380}
            height={380}
            onClick={handleMapClick}
            className="w-full h-full block cursor-crosshair"
            data-testid="full-city-map"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-400" /> You
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" /> Objective
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400" /> Waypoint
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" /> Star
            </span>
          </div>

          {hud.customWaypoint && (
            <button
              type="button"
              onClick={() => onSetWaypoint(null, null)}
              className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-semibold hover:bg-cyan-500/30 cursor-pointer"
            >
              Clear Waypoint
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
