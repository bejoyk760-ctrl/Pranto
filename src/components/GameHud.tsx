import React from 'react';
import type { HudSnapshot, TouchInputState } from '../game/types';
import { Minimap } from './Minimap';
import { MobileControls } from './MobileControls';
import { DialogueBox } from './DialogueBox';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  showTouchControls: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onCycleTime: () => void;
  onCycleWeather: () => void;
  onOpenMap: () => void;
  onToggleFullscreen: () => void;
  onToggleTouchControls: () => void;
  onPause: () => void;
  onTouchChange: (partial: Partial<TouchInputState>) => void;
  onJump: () => void;
  onInteract: () => void;
  onDismissDialogue: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  showTouchControls,
  isFullscreen,
  onToggleMute,
  onCycleTime,
  onCycleWeather,
  onOpenMap,
  onToggleFullscreen,
  onToggleTouchControls,
  onPause,
  onTouchChange,
  onJump,
  onInteract,
  onDismissDialogue,
}) => {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-1.5 @md:p-3 @3xl:p-4">
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-1.5 @md:gap-2">
        {/* Top-Left: Clickable Real-time Minimap + Active Mission Objective */}
        <div className="flex items-start gap-1.5 @md:gap-2.5 min-w-0">
          <Minimap
            playerX={hud.playerX}
            playerZ={hud.playerZ}
            camYaw={hud.playerYaw}
            waypointX={hud.waypointX}
            waypointZ={hud.waypointZ}
            customWaypoint={hud.customWaypoint}
            entities={hud.nearbyVehicles}
            onOpenMap={onOpenMap}
          />
          <div className="bg-[rgba(9,13,22,0.84)] border border-white/15 rounded-lg px-2 py-1 @md:px-2.5 @md:py-1.5 @3xl:px-3 @3xl:py-2 max-w-[126px] @md:max-w-[190px] @3xl:max-w-[250px]">
            <div className="flex items-center gap-1 text-[8px] @md:text-[10px] @3xl:text-[11px] font-semibold uppercase tracking-wider text-teal-300">
              <span className="truncate">{hud.activeMissionTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums shrink-0">
                {hud.checkpointIndex + 1}/{Math.max(1, hud.checkpointTotal)}
              </span>
            </div>
            <p className="hidden @md:block text-[11px] @3xl:text-sm font-medium text-white leading-snug mt-0.5 line-clamp-2">
              {hud.activeObjectiveLabel}
            </p>
            <div className="text-[9px] @md:text-[10px] @3xl:text-[11px] text-amber-300 font-mono-tabular mt-0.5">
              {hud.checkpointDist}m away
            </div>
          </div>
        </div>

        {/* Top-Right: Economy, Stars & Square SVG Utility Controls */}
        <div className="flex flex-col items-end gap-1 @md:gap-1.5 shrink-0">
          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open city map"
              title="City Map [Tab]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenMap();
              }}
              className="w-7 h-7 @md:w-8 @md:h-8 @3xl:w-9 @3xl:h-9 rounded-lg bg-[rgba(9,13,22,0.82)] border border-white/15 hover:border-white/40 flex items-center justify-center text-cyan-300 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 @3xl:w-4 @3xl:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute [M]' : 'Mute [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-7 h-7 @md:w-8 @md:h-8 @3xl:w-9 @3xl:h-9 rounded-lg bg-[rgba(9,13,22,0.82)] border border-white/15 hover:border-white/40 flex items-center justify-center text-white cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 @3xl:w-4 @3xl:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" stroke="#fb7185" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" stroke="#2dd4bf" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={`Cycle weather (current: ${hud.weatherMode})`}
              title="Cycle Clear / Rain / Fog [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleWeather();
              }}
              className={`hidden @md:flex w-8 h-8 @3xl:w-9 @3xl:h-9 rounded-lg border items-center justify-center cursor-pointer ${
                hud.weatherMode === 'rain'
                  ? 'bg-cyan-500/25 border-cyan-300 text-cyan-200'
                  : hud.weatherMode === 'fog'
                    ? 'bg-slate-400/25 border-slate-200 text-slate-100'
                    : 'bg-[rgba(9,13,22,0.82)] border-white/15 hover:border-white/40 text-sky-300'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                {hud.weatherMode === 'fog' ? (
                  <>
                    <path d="M5 10h14a3 3 0 0 0 0-6h-1a4 4 0 0 0-7.6-1.2" strokeLinecap="round" />
                    <path d="M3 14h18M5 18h14M7 21h10" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                    {hud.weatherMode === 'rain' && (
                      <path d="M9 19l-1 3M13 19l-1 3M17 19l-1 3" strokeLinecap="round" />
                    )}
                  </>
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Cycle time of day"
              title="Cycle Day/Sunset/Night [T]"
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleTime();
              }}
              className="hidden @md:flex w-8 h-8 @3xl:w-9 @3xl:h-9 rounded-lg bg-[rgba(9,13,22,0.82)] border border-white/15 hover:border-white/40 items-center justify-center text-amber-300 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle touch controls"
              title="Toggle mobile touch pad"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouchControls();
              }}
              className={`w-7 h-7 @md:w-8 @md:h-8 @3xl:w-9 @3xl:h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
                showTouchControls
                  ? 'bg-teal-400 text-slate-950 border-white'
                  : 'bg-[rgba(9,13,22,0.82)] text-white border-white/15 hover:border-white/40'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 @3xl:w-4 @3xl:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title="Fullscreen"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleFullscreen();
              }}
              className="hidden @3xl:flex w-9 h-9 rounded-lg bg-[rgba(9,13,22,0.82)] border border-white/15 hover:border-white/40 items-center justify-center text-white cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                ) : (
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game"
              title="Pause [Esc / P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-7 h-7 @md:w-8 @md:h-8 @3xl:w-9 @3xl:h-9 rounded-lg bg-[rgba(9,13,22,0.82)] border border-white/15 hover:border-white/40 flex items-center justify-center text-white cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 @3xl:w-4 @3xl:h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          </div>

          <div className="bg-[rgba(9,13,22,0.82)] border border-white/15 rounded-lg px-2 py-0.5 @md:px-2.5 @md:py-1 flex items-center gap-1.5 @md:gap-2 text-[10px] @md:text-xs">
            <span className="font-mono-tabular font-bold text-emerald-400" data-testid="hud-cash">
              ${hud.cash}
            </span>
            <span className="text-white/30" aria-hidden="true">/</span>
            <span className="font-mono-tabular font-semibold text-amber-300">
              {hud.starsCollected}/{hud.totalStars} Stars
            </span>
            <span className="hidden @3xl:inline text-white/30" aria-hidden="true">/</span>
            <span className="hidden @3xl:inline text-slate-200 font-medium">
              {hud.timeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Status Strip + Transient Banner + NPC Dialogue */}
      <div
        className={`flex flex-col items-center gap-1.5 @3xl:gap-2 ${
          showTouchControls ? 'mb-20 @md:mb-2' : 'mb-0.5'
        }`}
      >
        {hud.bannerText && !hud.activeDialogue && (
          <div className="bg-[rgba(9,13,22,0.9)] border border-amber-400/50 rounded-lg px-3 py-1 text-[10px] @md:text-xs @3xl:text-sm font-display font-bold text-amber-200 shadow-xl whitespace-nowrap max-w-[85%] truncate">
            {hud.bannerText}
          </div>
        )}

        {hud.activeDialogue && (
          <DialogueBox dialogue={hud.activeDialogue} onDismiss={onDismissDialogue} />
        )}

        {hud.interactPrompt && !hud.activeDialogue && !showTouchControls && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onInteract();
            }}
            className="pointer-events-auto px-3 py-1 @3xl:px-4 @3xl:py-1.5 rounded-lg bg-[rgba(9,13,22,0.88)] border border-rose-400/60 text-[11px] @3xl:text-sm font-semibold text-white hover:bg-rose-500/20 cursor-pointer"
          >
            {hud.interactPrompt}
          </button>
        )}

        {hud.inVehicle ? (
          <div className="bg-[rgba(9,13,22,0.84)] border border-white/15 rounded-lg px-3 py-0.5 @3xl:px-3.5 @3xl:py-1 flex items-center gap-2">
            <span className="font-mono-tabular text-base @3xl:text-2xl font-bold text-teal-300">
              {hud.speedKmh}
            </span>
            <span className="text-[10px] @3xl:text-[11px] uppercase tracking-wider text-slate-300">km/h</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span className="text-[11px] @3xl:text-xs font-medium text-white truncate max-w-[130px]">
              {hud.vehicleName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-[rgba(9,13,22,0.74)] border border-white/10 rounded-md px-2.5 py-0.5 @3xl:px-3 @3xl:py-1">
            <span className="text-[9px] @3xl:text-[10px] uppercase tracking-wider text-slate-300">Stamina</span>
            <div className="w-16 @3xl:w-24 h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 transition-transform duration-100 origin-left"
                style={{ transform: `scaleX(${Math.max(0, hud.stamina) / 100})` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      {showTouchControls && (
        <MobileControls
          inVehicle={hud.inVehicle}
          canInteract={Boolean(hud.interactPrompt)}
          interactKind={hud.interactKind}
          isSitting={hud.isSitting}
          onTouchChange={onTouchChange}
          onJump={onJump}
          onInteract={onInteract}
        />
      )}
    </div>
  );
};
