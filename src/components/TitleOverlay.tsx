import React from 'react';
import type { DisplayAspectMode, GraphicsQuality } from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleOverlayProps {
  quality: GraphicsQuality;
  displayAspect: DisplayAspectMode;
  hasSave: boolean;
  onQualityChange: (q: GraphicsQuality) => void;
  onDisplayAspectChange: (m: DisplayAspectMode) => void;
  onStart: () => void;
  onContinue: () => void;
}

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'eco', label: 'Android Eco' },
];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  quality,
  displayAspect,
  hasSave,
  onQualityChange,
  onDisplayAspectChange,
  onStart,
  onContinue,
}) => {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 pointer-events-none overflow-y-auto"
      style={{
        background:
          'linear-gradient(105deg, rgba(8, 13, 24, 0.86) 0%, rgba(8, 13, 24, 0.48) 46%, rgba(8, 13, 24, 0.08) 100%)',
      }}
    >
      <div />

      <div className="max-w-md pointer-events-auto my-auto">
        <svg
          viewBox="0 0 420 148"
          className="w-full max-w-[260px] sm:max-w-[360px] h-auto mb-3 sm:mb-4"
          role="img"
          aria-label="Solana Bay"
        >
          <path
            d="M28 86 A48 48 0 0 1 124 86"
            fill="none"
            stroke="#fb923c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M42 86 A34 34 0 0 1 110 86"
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M76 86 Q78 58 72 38"
            fill="none"
            stroke="#fef3c7"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M72 38 Q54 32 44 42 M72 38 Q60 22 48 24 M72 38 Q88 24 98 34 M72 38 Q90 38 98 48"
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <line x1="20" y1="92" x2="398" y2="92" stroke="#f43f5e" strokeWidth="2.5" />
          <text
            x="20"
            y="132"
            fill="#ffffff"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="44"
            letterSpacing="3"
          >
            SOLANA BAY
          </text>
          <text
            x="138"
            y="72"
            fill="#fde68a"
            fontFamily="Outfit, sans-serif"
            fontWeight="700"
            fontSize="14"
            letterSpacing="4"
          >
            COASTAL OPEN WORLD
          </text>
        </svg>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="px-5 py-2.5 sm:px-7 sm:py-3 rounded-md font-display font-bold text-sm sm:text-base tracking-wide text-slate-950 bg-[#fb7185] hover:bg-[#fda4af] active:scale-[0.98] transition-transform cursor-pointer shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap"
            >
              Start Exploration
            </button>

            {hasSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onContinue();
                }}
                className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-md font-display font-bold text-sm sm:text-base tracking-wide text-slate-950 bg-teal-400 hover:bg-teal-300 active:scale-[0.98] transition-transform cursor-pointer shadow-lg whitespace-nowrap"
              >
                Continue Saved
              </button>
            )}

            <PWAInstallButton />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-300">Graphics Profile</span>
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-md bg-[rgba(12,18,32,0.78)] border border-white/15 w-fit">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onQualityChange(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                      quality === opt.id
                        ? 'bg-teal-400 text-slate-950'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-300">Display Aspect</span>
              <div className="inline-flex gap-1 p-1 rounded-md bg-[rgba(12,18,32,0.78)] border border-white/15 w-fit">
                <button
                  type="button"
                  onClick={() => onDisplayAspectChange('16:9')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                    displayAspect === '16:9'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  16:9 Cinema
                </button>
                <button
                  type="button"
                  onClick={() => onDisplayAspectChange('fill')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                    displayAspect === 'fill'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  Fill Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] sm:text-xs text-slate-200/90 hud-text-shadow pt-2">
        WASD Move · Space Jump · Shift Sprint · E Interact / Enter · Tab Map · R Rain · Esc Pause
      </div>
    </div>
  );
};
