import React, { useRef, useState } from 'react';
import type { TouchInputState } from '../game/types';

interface MobileControlsProps {
  inVehicle: boolean;
  canInteract: boolean;
  interactKind: 'vehicle' | 'npc' | 'kiosk' | 'bench' | null;
  isSitting: boolean;
  onTouchChange: (partial: Partial<TouchInputState>) => void;
  onJump: () => void;
  onInteract: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  inVehicle,
  canInteract,
  interactKind,
  isSitting,
  onTouchChange,
  onJump,
  onInteract,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [sprintActive, setSprintActive] = useState(false);

  const maxRadius = 36;

  const updateStick = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });

    const nx = dx / maxRadius;
    const ny = -dy / maxRadius;
    if (inVehicle) {
      onTouchChange({ steer: nx, moveX: nx, moveY: ny });
    } else {
      onTouchChange({ moveX: nx, moveY: ny });
    }
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onTouchChange({ moveX: 0, moveY: 0, steer: 0 });
  };

  const interactLabel =
    interactKind === 'npc'
      ? 'Talk'
      : interactKind === 'kiosk'
        ? 'Drink'
        : interactKind === 'bench'
          ? isSitting
            ? 'Stand'
            : 'Sit'
          : 'Enter';

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-3 pb-3 sm:px-6 sm:pb-4 pointer-events-none"
      data-testid="mobile-controls"
    >
      {/* Left Virtual Thumbstick */}
      <div
        ref={padRef}
        role="application"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          e.stopPropagation();
          pointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          resetStick();
        }}
        onPointerCancel={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          resetStick();
        }}
        className="relative w-[92px] h-[92px] sm:w-[110px] sm:h-[110px] rounded-full bg-[rgba(10,16,28,0.68)] border-2 border-white/25 flex items-center justify-center pointer-events-auto touch-none"
      >
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-400/90 border-2 border-white shadow-md"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right Action / Driving Cluster */}
      {inVehicle ? (
        <div className="flex items-end gap-2 sm:gap-3 pointer-events-auto">
          <div className="flex flex-col gap-1.5 items-center">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTouchChange({ hornPressed: true });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                onTouchChange({ hornPressed: false });
              }}
              onPointerCancel={() => onTouchChange({ hornPressed: false })}
              className="w-11 h-10 sm:w-12 sm:h-11 rounded-full bg-[rgba(12,18,32,0.82)] border border-white/25 text-[11px] font-bold text-amber-300 active:scale-95"
            >
              Horn
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInteract();
              }}
              className="w-12 h-10 sm:w-14 sm:h-11 rounded-xl bg-[rgba(12,18,32,0.88)] border border-rose-400/60 text-[11px] font-bold text-rose-200 active:scale-95"
            >
              Exit
            </button>
          </div>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onTouchChange({ brake: 1 });
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onTouchChange({ brake: 0 });
            }}
            onPointerCancel={() => onTouchChange({ brake: 0 })}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[rgba(225,29,72,0.84)] border-2 border-white/30 text-xs font-bold text-white active:scale-95"
          >
            Brake
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onTouchChange({ throttle: 1 });
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onTouchChange({ throttle: 0 });
            }}
            onPointerCancel={() => onTouchChange({ throttle: 0 })}
            className="w-14 h-18 sm:w-16 sm:h-20 rounded-2xl bg-[rgba(20,184,166,0.9)] border-2 border-white/40 text-xs sm:text-sm font-bold text-slate-950 active:scale-95"
          >
            Gas
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 pointer-events-auto">
          {canInteract && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInteract();
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#fb7185] border-2 border-white text-xs font-bold text-slate-950 shadow-lg active:scale-95"
            >
              {interactLabel}
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !sprintActive;
              setSprintActive(next);
              onTouchChange({ sprint: next });
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 text-[11px] sm:text-xs font-bold active:scale-95 ${
              sprintActive
                ? 'bg-amber-400 border-white text-slate-950'
                : 'bg-[rgba(12,18,32,0.8)] border-white/30 text-white'
            }`}
          >
            Sprint
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onJump();
            }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[rgba(20,184,166,0.9)] border-2 border-white/40 text-xs sm:text-sm font-bold text-slate-950 active:scale-95"
          >
            Jump
          </button>
        </div>
      )}
    </div>
  );
};
