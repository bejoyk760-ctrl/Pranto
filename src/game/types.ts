export type GameMode = 'title' | 'playing' | 'paused' | 'gameover';

export type GraphicsQuality = 'auto' | 'high' | 'balanced' | 'eco';

export type TimeMode = 'dynamic' | 'day' | 'sunset' | 'night';

export type WeatherMode = 'clear' | 'rain' | 'fog';

export type DisplayAspectMode = '16:9' | 'fill';

export type VehicleType = 'coupe' | 'bus' | 'moto';

export type NpcPersonality = 'stroller' | 'jogger' | 'socializer' | 'shopper' | 'concierge';

export type NpcActivity = 'walk' | 'wait_crosswalk' | 'idle_look' | 'sit' | 'talk' | 'hurry';

export type CharacterAnimState = 'idle' | 'walk' | 'run' | 'jump' | 'interact' | 'seated';

export interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  isSolid: boolean;
}

export interface CheckpointDef {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
  requireVehicle?: boolean;
}

export interface MissionDef {
  id: string;
  title: string;
  subtitle: string;
  reward: number;
  checkpoints: CheckpointDef[];
}

export interface MinimapEntity {
  x: number;
  z: number;
  yaw: number;
  kind: 'coupe' | 'bus' | 'moto' | 'star' | 'npc';
}

export interface TrafficSignalState {
  nsGreen: boolean;
  nsYellow: boolean;
  ewGreen: boolean;
  ewYellow: boolean;
}

export interface NpcDialogueState {
  npcName: string;
  role: string;
  line: string;
  hint?: string;
}

export interface SaveGameData {
  version: number;
  savedAt: number;
  cash: number;
  missionIdx: number;
  checkpointIdx: number;
  missionsCompleted: number;
  collectedStarIds: string[];
  distanceTraveled: number;
  playerX: number;
  playerZ: number;
  playerFacing: number;
  timeMode: TimeMode;
  weatherMode: WeatherMode;
  quality: GraphicsQuality;
  customWaypoint: { x: number; z: number } | null;
}

export interface HudSnapshot {
  mode: GameMode;
  cash: number;
  missionsCompleted: number;
  totalMissions: number;
  starsCollected: number;
  totalStars: number;
  distanceTraveled: number;
  activeMissionTitle: string;
  activeObjectiveLabel: string;
  checkpointIndex: number;
  checkpointTotal: number;
  checkpointDist: number;
  inVehicle: boolean;
  vehicleName: string;
  vehicleType: VehicleType | null;
  speedKmh: number;
  stamina: number;
  animState: CharacterAnimState;
  interactPrompt: string | null;
  interactKind: 'vehicle' | 'npc' | 'kiosk' | 'bench' | null;
  timeOfDayNormalized: number;
  timeLabel: string;
  weatherMode: WeatherMode;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  waypointX: number | null;
  waypointZ: number | null;
  customWaypoint: { x: number; z: number } | null;
  bannerText: string | null;
  fpsEstimate: number;
  nearbyVehicles: MinimapEntity[];
  activeDialogue: NpcDialogueState | null;
  isSitting: boolean;
}

export interface TouchInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  jumpJustPressed: boolean;
  interactJustPressed: boolean;
  hornPressed: boolean;
  throttle: number;
  brake: number;
  steer: number;
}
