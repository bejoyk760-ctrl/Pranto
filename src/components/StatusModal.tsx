import React from 'react';
import type {
  DisplayAspectMode,
  GameMode,
  GraphicsQuality,
  HudSnapshot,
  TimeMode,
  WeatherMode,
} from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';

interface StatusModalProps {
  mode: Extract<GameMode, 'paused' | 'gameover'>;
  hud: HudSnapshot;
  quality: GraphicsQuality;
  timeMode: TimeMode;
  weatherMode: WeatherMode;
  displayAspect: DisplayAspectMode;
  hasSave: boolean;
  onResume: () => void;
  onRestart: () => void;
  onSave: () => void;
  onLoad: () => void;
  onTitle: () => void;
  onQualityChange: (q: GraphicsQuality) => void;
  onTimeModeChange: (t: TimeMode) => void;
  onWeatherChange: (w: WeatherMode) => void;
  onDisplayAspectChange: (m: DisplayAspectMode) => void;
  onToggleFullscreen: () => void;
}

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'eco', label: 'Android Eco' },
];

const TIME_OPTIONS: { id: TimeMode; label: string }[] = [
  { id: 'dynamic', label: 'Live Cycle' },
  { id: 'day', label: 'Day' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night' },
];

export const StatusModal: React.FC<StatusModalProps> = ({
  mode,
  hud,
  quality,
  timeMode,
  weatherMode,
  displayAspect,
  hasSave,
  onResume,
  onRestart,
  onSave,
  onLoad,
  onTitle,
  onQualityChange,
  onTimeModeChange,
  onWeatherChange,
  onDisplayAspectChange,
  onToggleFullscreen,
}) => {
  const isVictory = mode === 'gameover';

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[rgba(6,10,19,0.78)]"
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'Campaign Complete' : 'Game Paused'}
    >
      <div className="w-full max-w-md max-h-[92%] overflow-y-auto rounded-xl bg-[#0e1526] border border-white/15 p-4 sm:p-6 shadow-2xl flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {isVictory ? 'Solana Bay Cleared' : 'Game Paused'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            {isVictory
              ? 'You completed all coastal missions across Solana Bay.'
              : 'Configure display, weather, graphics, or save your progress.'}
          </p>
        </div>

        {/* Summary Stat Tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Cash</div>
            <div className="font-mono-tabular text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
              ${hud.cash}
            </div>
          </div>
          <div className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Missions</div>
            <div className="font-mono-tabular text-base sm:text-lg font-bold text-white mt-0.5">
              {hud.missionsCompleted}/{hud.totalMissions}
            </div>
          </div>
          <div className="rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Stars</div>
            <div className="font-mono-tabular text-base sm:text-lg font-bold text-amber-300 mt-0.5">
              {hud.starsCollected}/{hud.totalStars}
            </div>
          </div>
        </div>

        {!isVictory && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-300">Graphics Profile</span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#080d1a] border border-white/10">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onQualityChange(opt.id)}
                    className={`py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                      quality === opt.id
                        ? 'bg-teal-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-300">Time of Day</span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#080d1a] border border-white/10">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onTimeModeChange(opt.id)}
                    className={`py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                      timeMode === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-300">Weather</span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#080d1a] border border-white/10">
                  <button
                    type="button"
                    onClick={() => onWeatherChange('clear')}
                    className={`py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      weatherMode === 'clear'
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => onWeatherChange('rain')}
                    className={`py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      weatherMode === 'rain'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Rain
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-300">Display Mode</span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#080d1a] border border-white/10">
                  <button
                    type="button"
                    onClick={() => onDisplayAspectChange('16:9')}
                    className={`py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      displayAspect === '16:9'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    16:9
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisplayAspectChange('fill')}
                    className={`py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      displayAspect === 'fill'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Fill
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col gap-2 pt-1">
          {!isVictory ? (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="w-full py-2.5 rounded-lg bg-[#fb7185] hover:bg-[#fda4af] text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              Play Again
            </button>
          )}

          {!isVictory && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onSave}
                className="py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold cursor-pointer"
              >
                Save Game
              </button>
              <button
                type="button"
                disabled={!hasSave}
                onClick={onLoad}
                className={`py-2 rounded-lg text-xs font-semibold border ${
                  hasSave
                    ? 'bg-sky-500/20 border-sky-400/40 hover:bg-sky-500/30 text-sky-200 cursor-pointer'
                    : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                Load Saved
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
              >
                Fullscreen
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!isVictory && (
              <button
                type="button"
                onClick={onRestart}
                className="py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Restart
              </button>
            )}
            <button
              type="button"
              onClick={onTitle}
              className={`py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold cursor-pointer ${
                isVictory ? 'col-span-2' : ''
              }`}
            >
              Title Screen
            </button>
          </div>
          {!isVictory && (
            <div className="flex justify-center pt-0.5">
              <PWAInstallButton compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
