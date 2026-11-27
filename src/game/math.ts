import type { BoxCollider, WeatherMode } from './types';

export const ROAD_X = [-96, -48, 0, 48] as const;
export const ROAD_Z = [-96, -48, 0, 48, 96] as const;

export const ROAD_HALF_W = 6;
export const SIDEWALK_OUTER = 9;

export const CANAL_Z = 72;
export const CANAL_HALF_W = 9;
export const BRIDGE_HALF_SPAN = 16;
export const BRIDGE_HEIGHT = 2.6;

export const BEACH_START_X = 57;
export const SHORE_X = 86;
export const PIER_END_X = 132;
export const PIER_HALF_W = 5.5;
export const PIER_HEIGHT = 1.5;

export const CITY_BOUNDS = {
  minX: -136,
  maxX: 132,
  minZ: -136,
  maxZ: 136,
};

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Computes camera-relative forward and right unit vectors on the XZ plane.
 * Convention:
 * - camYaw = 0 places camera at +Z looking toward -Z (North).
 * - Forward = (-sin(camYaw), -cos(camYaw))
 * - Right = (cos(camYaw), -sin(camYaw)) = forward x (0, 1, 0)
 */
export function getCameraBasisXZ(camYaw: number): {
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
} {
  const sinY = Math.sin(camYaw);
  const cosY = Math.cos(camYaw);
  return {
    forwardX: -sinY,
    forwardZ: -cosY,
    rightX: cosY,
    rightZ: -sinY,
  };
}

/**
 * Converts 2D player movement inputs (inputX: -1 left..+1 right, inputY: -1 back..+1 forward)
 * into a normalized world-space XZ movement vector and target facing angle (rotation.y).
 */
export function computeCameraRelativeMove(
  inputX: number,
  inputY: number,
  camYaw: number,
): { dirX: number; dirZ: number; magnitude: number; facingYaw: number } {
  const len = Math.hypot(inputX, inputY);
  if (len < 0.001) {
    return { dirX: 0, dirZ: 0, magnitude: 0, facingYaw: 0 };
  }
  const nx = len > 1 ? inputX / len : inputX;
  const ny = len > 1 ? inputY / len : inputY;
  const mag = Math.min(1, len);

  const { forwardX, forwardZ, rightX, rightZ } = getCameraBasisXZ(camYaw);
  const wx = forwardX * ny + rightX * nx;
  const wz = forwardZ * ny + rightZ * nx;
  const wLen = Math.hypot(wx, wz) || 1;
  const dirX = wx / wLen;
  const dirZ = wz / wLen;

  // In Three.js, local +Z rotated by theta around Y points to (sin(theta), 0, cos(theta)).
  const facingYaw = Math.atan2(dirX, dirZ);
  return { dirX, dirZ, magnitude: mag, facingYaw };
}

/**
 * Shortest-arc angular interpolation around Y axis.
 */
export function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * alpha;
}

/**
 * Integrates vehicle heading & position with realistic steering.
 * Positive steerInput (+1) = turn RIGHT (D / Right Arrow).
 * Negative steerInput (-1) = turn LEFT (A / Left Arrow).
 * In Three.js right-handed +Y up, vehicle facing +Z at heading=0:
 * Turning RIGHT decreases heading; turning LEFT increases heading (when moving forward).
 */
export function stepVehicleKinematics(
  state: { x: number; z: number; heading: number; speed: number },
  inputs: {
    throttle: number;
    brake: number;
    steer: number; // -1 left, +1 right
    maxSpeed: number;
    accel: number;
    turnRate: number;
  },
  dt: number,
): { x: number; z: number; heading: number; speed: number } {
  let { x, z, heading, speed } = state;
  const { throttle, brake, steer, maxSpeed, accel, turnRate } = inputs;

  if (throttle > 0.01) {
    if (speed < 0) {
      speed += accel * 2.2 * throttle * dt;
    } else {
      speed += accel * throttle * dt;
    }
  } else if (brake > 0.01) {
    if (speed > 0.5) {
      speed -= accel * 2.5 * brake * dt;
    } else {
      speed -= accel * 0.7 * brake * dt;
    }
  } else {
    // Natural rolling drag
    const drag = Math.exp(-2.2 * dt);
    speed *= drag;
    if (Math.abs(speed) < 0.08) speed = 0;
  }

  const maxReverse = -maxSpeed * 0.35;
  speed = Math.max(maxReverse, Math.min(maxSpeed, speed));

  const absSpeed = Math.abs(speed);
  if (absSpeed > 0.25 && Math.abs(steer) > 0.01) {
    const speedFactor = Math.min(1, absSpeed / 6);
    const reverseSign = speed >= 0 ? 1 : -1;
    // Subtract steer because +steer (right) maps to negative Y rotation around +Y
    heading -= steer * turnRate * speedFactor * reverseSign * dt;
  }

  x += Math.sin(heading) * speed * dt;
  z += Math.cos(heading) * speed * dt;

  return { x, z, heading, speed };
}

export function isOnBridgeRoad(x: number): boolean {
  for (let i = 0; i < ROAD_X.length; i++) {
    if (Math.abs(x - ROAD_X[i]) <= SIDEWALK_OUTER + 0.5) return true;
  }
  return false;
}

export function isOnRoadAsphalt(x: number, z: number): boolean {
  for (let i = 0; i < ROAD_X.length; i++) {
    if (Math.abs(x - ROAD_X[i]) <= ROAD_HALF_W) return true;
  }
  for (let i = 0; i < ROAD_Z.length; i++) {
    if (Math.abs(z - ROAD_Z[i]) <= ROAD_HALF_W && x <= BEACH_START_X) return true;
  }
  return false;
}

export function isOnSidewalk(x: number, z: number): boolean {
  if (x > BEACH_START_X) return false;
  if (isOnRoadAsphalt(x, z)) return false;
  for (let i = 0; i < ROAD_X.length; i++) {
    if (Math.abs(x - ROAD_X[i]) <= SIDEWALK_OUTER) return true;
  }
  for (let i = 0; i < ROAD_Z.length; i++) {
    if (Math.abs(z - ROAD_Z[i]) <= SIDEWALK_OUTER) return true;
  }
  return false;
}

/**
 * Exact deterministic ground elevation at any world (x, z).
 * Handles road asphalt (0), sidewalks (0.16), arched canal bridges (up to 2.6),
 * canal water bed (-0.9), beach slope, ocean pier with ramp (1.5), and shallow water.
 */
export function groundHeightAt(x: number, z: number): number {
  // 1. Ocean Pier (east of beach edge along z = 0)
  if (x >= BEACH_START_X && x <= PIER_END_X && Math.abs(z) <= PIER_HALF_W) {
    if (x < BEACH_START_X + 8) {
      const t = (x - BEACH_START_X) / 8;
      return 0.16 + t * (PIER_HEIGHT - 0.16);
    }
    return PIER_HEIGHT;
  }

  // 2. Arched Bridges over the South Lagoon Canal (z = 72)
  const dzCanal = Math.abs(z - CANAL_Z);
  if (dzCanal < BRIDGE_HALF_SPAN && isOnBridgeRoad(x)) {
    const arch = 0.5 * (1 + Math.cos((Math.PI * (z - CANAL_Z)) / BRIDGE_HALF_SPAN));
    const curbOffset = isOnRoadAsphalt(x, z) ? 0 : 0.16;
    return BRIDGE_HEIGHT * arch + curbOffset;
  }

  // 3. Canal water channel (west of coastline)
  if (dzCanal < CANAL_HALF_W && x <= BEACH_START_X) {
    const bankT = Math.max(0, 1 - dzCanal / CANAL_HALF_W);
    return -0.85 * Math.min(1, bankT * 2.2);
  }

  // 4. Sandy Beach & Ocean slope east of BEACH_START_X
  if (x > BEACH_START_X) {
    if (x <= SHORE_X) {
      const t = (x - BEACH_START_X) / (SHORE_X - BEACH_START_X);
      return 0.16 * (1 - t) - 0.15 * t;
    }
    const oceanT = Math.min(1, (x - SHORE_X) / 28);
    return -0.15 - oceanT * 1.45;
  }

  // 5. Road vs Sidewalk vs City Block ground
  if (isOnRoadAsphalt(x, z)) return 0;
  if (isOnSidewalk(x, z)) return 0.16;
  return 0.12;
}

/**
 * Returns the interior ceiling height if (x, z) is inside a walkable building interior
 * (Mint Flamingo Hotel Lobby or Sunset Surf Cafe), or null outdoors.
 */
export function getInteriorCeilingHeight(x: number, z: number): number | null {
  // Mint Flamingo Hotel Lobby: cx=24, cz=-24, w=16 (x: 16..32), d=18 (z: -33..-15), lobbyH=4.4
  if (x >= 15.8 && x <= 32.2 && z >= -33.2 && z <= -14.8) {
    return 4.35;
  }
  // Sunset Surf Cafe: cx=24, cz=24, w=16 (x: 16..32), d=18 (z: 15..33), cafeH=4.2
  if (x >= 15.8 && x <= 32.2 && z >= 14.8 && z <= 33.2) {
    return 4.15;
  }
  return null;
}

/**
 * Resolves circle-vs-AABB collisions in XZ plane and clamps to world bounds.
 */
export function resolveCircleColliders(
  x: number,
  z: number,
  radius: number,
  colliders: readonly BoxCollider[],
): { x: number; z: number; collided: boolean } {
  let rx = Math.max(CITY_BOUNDS.minX + radius, Math.min(CITY_BOUNDS.maxX - radius, x));
  let rz = Math.max(CITY_BOUNDS.minZ + radius, Math.min(CITY_BOUNDS.maxZ - radius, z));
  let collided = rx !== x || rz !== z;

  // Prevent walking/driving into deep ocean unless on pier
  const onPier = rx >= BEACH_START_X - 1 && rx <= PIER_END_X && Math.abs(rz) <= PIER_HALF_W - 0.3;
  if (!onPier && rx > SHORE_X + 3) {
    rx = SHORE_X + 3;
    collided = true;
  }

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!c.isSolid) continue;

    const closestX = Math.max(c.minX, Math.min(rx, c.maxX));
    const closestZ = Math.max(c.minZ, Math.min(rz, c.maxZ));
    const dx = rx - closestX;
    const dz = rz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        rx += (dx / dist) * push;
        rz += (dz / dist) * push;
      } else {
        // Center is inside AABB: push out along nearest edge
        const left = Math.abs(rx - c.minX);
        const right = Math.abs(c.maxX - rx);
        const top = Math.abs(rz - c.minZ);
        const bottom = Math.abs(c.maxZ - rz);
        const minEdge = Math.min(left, right, top, bottom);
        if (minEdge === left) rx = c.minX - radius;
        else if (minEdge === right) rx = c.maxX + radius;
        else if (minEdge === top) rz = c.minZ - radius;
        else rz = c.maxZ + radius;
      }
    }
  }

  return { x: rx, z: rz, collided };
}

/**
 * Computes day/night cycle lighting parameters from normalized time (0..1).
 * 0.00 = dawn, 0.25 = bright tropical midday, 0.52 = golden sunset, 0.78 = neon night.
 */
export function getDayNightParams(tNorm: number): {
  sunElevation: number;
  sunAzimuth: number;
  sunIntensity: number;
  hemiIntensity: number;
  nightFactor: number;
  sunsetFactor: number;
  label: string;
} {
  const t = ((tNorm % 1) + 1) % 1;
  const sunAngle = t * Math.PI * 2; // 0=horizon east, PI/2=zenith, PI=horizon west
  const sunElevation = Math.sin(sunAngle); // +1 noon, 0 dawn/dusk, -1 midnight
  const sunAzimuth = Math.cos(sunAngle);

  const nightFactor = Math.max(0, Math.min(1, (-sunElevation + 0.12) * 2.2));
  const sunsetFactor = Math.max(0, 1 - Math.abs(sunElevation - 0.08) * 3.8) * (1 - nightFactor * 0.7);
  const dayFactor = Math.max(0, sunElevation);

  const sunIntensity = 0.25 + dayFactor * 1.9 + sunsetFactor * 0.65;
  const hemiIntensity = 0.35 + dayFactor * 0.55 + sunsetFactor * 0.15;

  let label = 'Daylight';
  if (nightFactor > 0.55) label = 'Midnight';
  else if (t >= 0.44 && t <= 0.62) label = 'Sunset';
  else if (t < 0.12 || t > 0.92) label = 'Sunrise';

  return {
    sunElevation,
    sunAzimuth,
    sunIntensity,
    hemiIntensity,
    nightFactor,
    sunsetFactor,
    label,
  };
}

export interface WeatherParams {
  rainIntensity: number;
  fogIntensity: number;
  fogDensityAdd: number;
  sunAttenuation: number;
  hemiAttenuation: number;
  roadRoughness: number;
  glowBoost: number;
}

/**
 * Computes deterministic atmospheric and screen-space particle intensities
 * for clear, rain, and fog weather modes, attenuating particles indoors.
 */
export function getWeatherParams(weather: WeatherMode, isIndoor: boolean): WeatherParams {
  const indoorScale = isIndoor ? 0.16 : 1.0;
  if (weather === 'rain') {
    return {
      rainIntensity: 1.0 * indoorScale,
      fogIntensity: 0.24 * indoorScale,
      fogDensityAdd: 0.0034,
      sunAttenuation: 0.52,
      hemiAttenuation: 0.85,
      roadRoughness: 0.22,
      glowBoost: 0.28,
    };
  }
  if (weather === 'fog') {
    return {
      rainIntensity: 0,
      fogIntensity: 1.0 * indoorScale,
      fogDensityAdd: 0.0128,
      sunAttenuation: 0.44,
      hemiAttenuation: 0.92,
      roadRoughness: 0.56,
      glowBoost: 0.45,
    };
  }
  return {
    rainIntensity: 0,
    fogIntensity: 0,
    fogDensityAdd: 0,
    sunAttenuation: 1.0,
    hemiAttenuation: 1.0,
    roadRoughness: 0.82,
    glowBoost: 0,
  };
}

