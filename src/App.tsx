/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SolanaBayEngine } from './game/engine';
import { CAMPAIGN_MISSIONS, GOLDEN_STARS } from './game/missions';
import type {
  DisplayAspectMode,
  GameMode,
  GraphicsQuality,
  HudSnapshot,
  TimeMode,
  TouchInputState,
} from './game/types';
import { TitleOverlay } from './components/TitleOverlay';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { MapModal } from './components/MapModal';
import { OfflineIndicator } from './components/OfflineIndicator';

const INITIAL_HUD: HudSnapshot = {
  mode: 'title',
  cash: 0,
  missionsCompleted: 0,
  totalMissions: CAMPAIGN_MISSIONS.length,
  starsCollected: 0,
  totalStars: GOLDEN_STARS.length,
  distanceTraveled: 0,
  activeMissionTitle: CAMPAIGN_MISSIONS[0].title,
  activeObjectiveLabel: CAMPAIGN_MISSIONS[0].checkpoints[0].label,
  checkpointIndex: 0,
  checkpointTotal: CAMPAIGN_MISSIONS[0].checkpoints.length,
  checkpointDist: 38,
  inVehicle: false,
  vehicleName: '',
  vehicleType: null,
  speedKmh: 0,
  stamina: 100,
  animState: 'idle',
  interactPrompt: null,
  interactKind: null,
  timeOfDayNormalized: 0.22,
  timeLabel: 'Daylight',
  weatherMode: 'clear',
  playerX: 40,
  playerZ: 14,
  playerYaw: 0,
  waypointX: CAMPAIGN_MISSIONS[0].checkpoints[0].x,
  waypointZ: CAMPAIGN_MISSIONS[0].checkpoints[0].z,
  customWaypoint: null,
  bannerText: null,
  fpsEstimate: 60,
  nearbyVehicles: [],
  activeDialogue: null,
  isSitting: false,
};

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SolanaBayEngine | null>(null);

  const [mode, setMode] = useState<GameMode>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [quality, setQuality] = useState<GraphicsQuality>('auto');
  const [timeMode, setTimeMode] = useState<TimeMode>('dynamic');
  const [displayAspect, setDisplayAspect] = useState<DisplayAspectMode>('16:9');
  const [muted, setMuted] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchOverrideRef = useRef(false);
  const [showTouchControls, setShowTouchControls] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      Math.min(window.innerWidth, window.innerHeight) < 520
    );
  });

  useEffect(() => {
    const onResize = () => {
      if (touchOverrideRef.current) return;
      const mobileViewport =
        window.matchMedia?.('(pointer: coarse)').matches ||
        Math.min(window.innerWidth, window.innerHeight) < 520;
      setShowTouchControls(mobileViewport);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new SolanaBayEngine(
      container,
      (snapshot) => setHud(snapshot),
      (nextMode) => {
        setMode(nextMode);
        setHasSave(engine.hasSavedGame());
        if (nextMode !== 'playing') {
          setMapOpen(false);
        }
      },
    );
    engineRef.current = engine;
    setHasSave(engine.hasSavedGame());

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewGame();
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.handleResize();
  }, [displayAspect]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'Tab' && mode === 'playing') {
        e.preventDefault();
        setMapOpen((prev) => !prev);
      } else if (e.code === 'Escape' && mapOpen) {
        setMapOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleMute, mode, mapOpen]);

  const handleQualityChange = useCallback((q: GraphicsQuality) => {
    setQuality(q);
    engineRef.current?.setQuality(q);
  }, []);

  const handleTimeModeChange = useCallback((t: TimeMode) => {
    setTimeMode(t);
    engineRef.current?.setTimeMode(t);
  }, []);

  const handleCycleTime = useCallback(() => {
    const next = engineRef.current?.cycleTimeMode();
    if (next) setTimeMode(next);
  }, []);

  const handleWeatherChange = useCallback((w: HudSnapshot['weatherMode']) => {
    engineRef.current?.setWeatherMode(w);
  }, []);

  const handleCycleWeather = useCallback(() => {
    engineRef.current?.cycleWeatherMode();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        const target = stageRef.current ?? document.documentElement;
        target.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {
      // Ignore fullscreen denial in embedded iframe environments
    }
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewGame();
  }, []);

  const handleContinue = useCallback(() => {
    engineRef.current?.loadSavedGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setMode('playing');
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restartGame();
  }, []);

  const handleSave = useCallback(() => {
    const ok = engineRef.current?.saveGame(false);
    if (ok) setHasSave(true);
  }, []);

  const handleLoad = useCallback(() => {
    engineRef.current?.loadSavedGame();
  }, []);

  const handleTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handlePause = useCallback(() => {
    setMapOpen(false);
    engineRef.current?.setMode('paused');
  }, []);

  const handleTouchChange = useCallback((partial: Partial<TouchInputState>) => {
    engineRef.current?.setTouchInput(partial);
  }, []);

  const handleJump = useCallback(() => {
    engineRef.current?.triggerTouchJump();
  }, []);

  const handleInteract = useCallback(() => {
    engineRef.current?.triggerTouchInteract();
  }, []);

  const handleSetWaypoint = useCallback((x: number | null, z: number | null) => {
    engineRef.current?.setCustomWaypoint(x, z);
  }, []);

  const handleDismissDialogue = useCallback(() => {
    engineRef.current?.dismissDialogue();
  }, []);

  const stageStyle =
    displayAspect === '16:9'
      ? {
          width: 'min(100vw, calc(100dvh * 16 / 9))',
          height: 'min(100dvh, calc(100vw * 9 / 16))',
        }
      : {
          width: '100vw',
          height: '100dvh',
        };

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#050811] flex items-center justify-center">
      {/* Responsive 16:9 Cinema Stage (or Fill Screen) */}
      <div
        ref={stageRef}
        style={stageStyle}
        className={`@container relative overflow-hidden bg-[#090d16] ${
          displayAspect === '16:9' ? 'shadow-2xl ring-1 ring-white/10' : ''
        }`}
        data-testid="cinema-stage"
      >
        {/* Isolated WebGL Canvas Mount */}
        <div
          ref={mountRef}
          className="absolute inset-0 w-full h-full"
          data-testid="game-canvas-mount"
        />

        {mode === 'title' && (
          <TitleOverlay
            quality={quality}
            displayAspect={displayAspect}
            hasSave={hasSave}
            onQualityChange={handleQualityChange}
            onDisplayAspectChange={setDisplayAspect}
            onStart={handleStart}
            onContinue={handleContinue}
          />
        )}

        {mode === 'playing' && (
          <GameHud
            hud={hud}
            muted={muted}
            showTouchControls={showTouchControls}
            isFullscreen={isFullscreen}
            onToggleMute={handleToggleMute}
            onCycleTime={handleCycleTime}
            onCycleWeather={handleCycleWeather}
            onOpenMap={() => setMapOpen(true)}
            onToggleFullscreen={handleToggleFullscreen}
            onToggleTouchControls={() => {
              touchOverrideRef.current = true;
              setShowTouchControls((v) => !v);
            }}
            onPause={handlePause}
            onTouchChange={handleTouchChange}
            onJump={handleJump}
            onInteract={handleInteract}
            onDismissDialogue={handleDismissDialogue}
          />
        )}

        {mode === 'playing' && mapOpen && (
          <MapModal
            hud={hud}
            onSetWaypoint={handleSetWaypoint}
            onClose={() => setMapOpen(false)}
          />
        )}

        {(mode === 'paused' || mode === 'gameover') && (
          <StatusModal
            mode={mode}
            hud={hud}
            quality={quality}
            timeMode={timeMode}
            weatherMode={hud.weatherMode}
            displayAspect={displayAspect}
            hasSave={hasSave}
            onResume={handleResume}
            onRestart={handleRestart}
            onSave={handleSave}
            onLoad={handleLoad}
            onTitle={handleTitle}
            onQualityChange={handleQualityChange}
            onTimeModeChange={handleTimeModeChange}
            onWeatherChange={handleWeatherChange}
            onDisplayAspectChange={setDisplayAspect}
            onToggleFullscreen={handleToggleFullscreen}
          />
        )}
        <OfflineIndicator />
      </div>
    </main>
  );
}
