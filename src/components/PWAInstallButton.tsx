import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            void install();
          }}
          className={`flex items-center justify-center gap-1.5 rounded-md border border-cyan-300/60 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 font-display font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 sm:py-3 text-xs sm:text-sm'
          }`}
          data-testid="pwa-install-btn"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
            <path d="M12 4v11m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Install App
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setShowGuide(true);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-md border border-white/20 bg-[rgba(12,18,32,0.82)] hover:bg-white/10 text-slate-200 font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm'
          }`}
          data-testid="pwa-guide-btn"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-teal-300" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round" />
          </svg>
          {isIOS ? 'Install on iOS' : 'Android App'}
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,19,0.82)] p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Install Solana Bay on Mobile"
        >
          <div className="w-full max-w-sm rounded-xl bg-[#0e1526] border border-white/15 p-5 shadow-2xl">
            <h3 className="font-display text-lg font-extrabold text-white">
              {isIOS ? 'Install on iPhone / iPad' : 'Install on Android'}
            </h3>
            {isIOS ? (
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                1. Tap the <strong className="text-white">Share</strong> icon in Safari.<br />
                2. Tap <strong className="text-white">Add to Home Screen</strong> to launch Solana Bay fullscreen.
              </p>
            ) : (
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                1. Open this game in <strong className="text-white">Android Chrome</strong>.<br />
                2. Tap the <strong className="text-white">⋮ Menu</strong> and select{' '}
                <strong className="text-teal-300">Install app</strong> or{' '}
                <strong className="text-teal-300">Add to Home screen</strong> for offline fullscreen play.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-2 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
