import React, { useEffect, useState } from 'react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-3 left-3 z-50 rounded-lg bg-amber-500/95 border border-amber-200/40 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg pointer-events-none"
      role="status"
    >
      Offline Mode — Cached game assets active
    </div>
  );
};
