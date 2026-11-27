import React, { useEffect, useRef } from 'react';
import {
  BEACH_START_X,
  CANAL_HALF_W,
  CANAL_Z,
  ROAD_X,
  ROAD_Z,
} from '../game/math';
import type { MinimapEntity } from '../game/types';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  camYaw: number;
  waypointX: number | null;
  waypointZ: number | null;
  customWaypoint: { x: number; z: number } | null;
  entities: MinimapEntity[];
  onOpenMap?: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  camYaw,
  waypointX,
  waypointZ,
  customWaypoint,
  entities,
  onOpenMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    const scale = 0.72;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, size, size);

    ctx.translate(half, half);
    ctx.rotate(camYaw);
    ctx.translate(-playerX * scale, -playerZ * scale);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-145 * scale, -145 * scale, (BEACH_START_X + 145) * scale, 290 * scale);

    ctx.fillStyle = '#d4b475';
    ctx.fillRect(BEACH_START_X * scale, -145 * scale, 30 * scale, 290 * scale);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(BEACH_START_X * scale, -5.5 * scale, 75 * scale, 11 * scale);

    ctx.fillStyle = '#0891b2';
    ctx.fillRect(-145 * scale, (CANAL_Z - CANAL_HALF_W) * scale, 210 * scale, CANAL_HALF_W * 2 * scale);

    ctx.fillStyle = '#475569';
    for (const rx of ROAD_X) {
      ctx.fillRect((rx - 6) * scale, -140 * scale, 12 * scale, 280 * scale);
    }
    for (const rz of ROAD_Z) {
      ctx.fillRect(-140 * scale, (rz - 6) * scale, (BEACH_START_X + 140) * scale, 12 * scale);
    }

    for (const ent of entities) {
      if (ent.kind === 'star') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(ent.x * scale, ent.z * scale, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = ent.kind === 'bus' ? '#f59e0b' : '#cbd5e1';
        ctx.fillRect(ent.x * scale - 2.2, ent.z * scale - 2.2, 4.4, 4.4);
      }
    }

    ctx.restore();

    const drawRadarPin = (wx: number, wz: number, fill: string) => {
      const dx = (wx - playerX) * scale;
      const dz = (wz - playerZ) * scale;
      const cos = Math.cos(camYaw);
      const sin = Math.sin(camYaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      const maxR = half - 10;
      const d = Math.hypot(rx, rz);
      const px = d > maxR ? half + (rx / d) * maxR : half + rx;
      const py = d > maxR ? half + (rz / d) * maxR : half + rz;

      ctx.fillStyle = fill;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    if (waypointX !== null && waypointZ !== null) {
      drawRadarPin(waypointX, waypointZ, '#fb7185');
    }
    if (customWaypoint) {
      drawRadarPin(customWaypoint.x, customWaypoint.z, '#22d3ee');
    }

    ctx.save();
    ctx.translate(half, half);
    ctx.fillStyle = '#2dd4bf';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [playerX, playerZ, camYaw, waypointX, waypointZ, customWaypoint, entities]);

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.currentTarget.blur();
        onOpenMap?.();
      }}
      title="Open City Map [Tab]"
      aria-label="Open City Map"
      className="pointer-events-auto relative w-[54px] h-[54px] @md:w-[80px] @md:h-[80px] @3xl:w-[116px] @3xl:h-[116px] rounded-full bg-[rgba(9,13,22,0.85)] shadow-lg overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-teal-400/70 transition-shadow"
    >
      <canvas ref={canvasRef} width={124} height={124} className="w-full h-full block" />
    </button>
  );
};
