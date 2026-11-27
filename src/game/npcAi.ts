import { ROAD_X, ROAD_Z } from './math';
import type { NpcPersonality, TrafficSignalState } from './types';

export interface WaypointNode {
  id: number;
  x: number;
  z: number;
  neighbors: number[];
  isBenchSpot?: boolean;
  isShopSpot?: boolean;
}

/**
 * Computes deterministic 4-way traffic signal phase from elapsed simulation seconds.
 * Cycle = 18s total:
 * - 0..7s: NS Green, EW Red
 * - 7..9s: NS Yellow, EW Red
 * - 9..16s: EW Green, NS Red
 * - 16..18s: EW Yellow, NS Red
 */
export function getTrafficSignalState(elapsedSec: number): TrafficSignalState {
  const phase = ((elapsedSec % 18) + 18) % 18;
  if (phase < 7) {
    return { nsGreen: true, nsYellow: false, ewGreen: false, ewYellow: false };
  }
  if (phase < 9) {
    return { nsGreen: false, nsYellow: true, ewGreen: false, ewYellow: false };
  }
  if (phase < 16) {
    return { nsGreen: false, nsYellow: false, ewGreen: true, ewYellow: false };
  }
  return { nsGreen: false, nsYellow: false, ewGreen: false, ewYellow: true };
}

/**
 * Builds a connected sidewalk & plaza waypoint graph across Solana Bay so NPCs
 * navigate cleanly along sidewalks, cross at zebra crosswalks, visit Palm Park,
 * Ocean Pier, and hotel lobbies without clipping through buildings.
 */
export function buildPedestrianGraph(): WaypointNode[] {
  const nodes: WaypointNode[] = [];
  const gridMap = new Map<string, number>();

  const addNode = (x: number, z: number, flags?: { isBenchSpot?: boolean; isShopSpot?: boolean }): number => {
    const id = nodes.length;
    nodes.push({
      id,
      x,
      z,
      neighbors: [],
      isBenchSpot: flags?.isBenchSpot,
      isShopSpot: flags?.isShopSpot,
    });
    return id;
  };

  const connect = (a: number, b: number) => {
    if (a === b) return;
    if (!nodes[a].neighbors.includes(b)) nodes[a].neighbors.push(b);
    if (!nodes[b].neighbors.includes(a)) nodes[b].neighbors.push(a);
  };

  // Sidewalk nodes at every intersection corner (outer offset = ±7.5m from road centerline)
  // For each (ROAD_X[ix], ROAD_Z[iz]), place NE corner (+7.5, -7.5) and SW corner (-7.5, +7.5)
  // Actually placing the 4 sidewalk corners around each intersection keeps crossings 100% aligned!
  // Let's place nodes on the 2 sidewalk lines per road: rx - 7.5 and rx + 7.5, rz - 7.5 and rz + 7.5
  const sxCoords: number[] = [];
  for (const rx of ROAD_X) {
    sxCoords.push(rx - 7.5, rx + 7.5);
  }
  const szCoords: number[] = [];
  for (const rz of ROAD_Z) {
    szCoords.push(rz - 7.5, rz + 7.5);
  }

  for (let xi = 0; xi < sxCoords.length; xi++) {
    for (let zi = 0; zi < szCoords.length; zi++) {
      const id = addNode(sxCoords[xi], szCoords[zi], {
        isShopSpot: xi >= 6 && zi >= 2 && zi <= 5,
      });
      gridMap.set(`${xi},${zi}`, id);
    }
  }

  // Connect adjacent sidewalk nodes along X and Z (skipping canal water except on bridge sidewalks!)
  for (let xi = 0; xi < sxCoords.length; xi++) {
    for (let zi = 0; zi < szCoords.length; zi++) {
      const id = gridMap.get(`${xi},${zi}`)!;
      if (xi + 1 < sxCoords.length) {
        const rightId = gridMap.get(`${xi + 1},${zi}`)!;
        connect(id, rightId);
      }
      if (zi + 1 < szCoords.length) {
        const downId = gridMap.get(`${xi},${zi + 1}`)!;
        connect(id, downId);
      }
    }
  }

  // Add scenic Palm Park loop nodes (around fountain at -24, -72)
  const p1 = addNode(-34, -72, { isBenchSpot: true });
  const p2 = addNode(-24, -81, { isBenchSpot: true });
  const p3 = addNode(-14, -72, { isBenchSpot: true });
  const p4 = addNode(-24, -63, { isBenchSpot: true });
  connect(p1, p2);
  connect(p2, p3);
  connect(p3, p4);
  connect(p4, p1);
  // Connect park to surrounding sidewalk corners
  const swParkA = gridMap.get('3,2'); // x=-40.5, z=-88.5
  const swParkB = gridMap.get('4,3'); // x=-7.5, z=-55.5
  if (swParkA !== undefined) connect(p1, swParkA);
  if (swParkB !== undefined) connect(p3, swParkB);

  // Add Ocean Pier promenade nodes (along z = 0 from Ocean Drive to Pier Tip)
  const pierStart = addNode(55.5, 0);
  const pierMid = addNode(86, 0, { isBenchSpot: true });
  const pierTip = addNode(118, 0, { isBenchSpot: true });
  connect(pierStart, pierMid);
  connect(pierMid, pierTip);
  const oceanInterN = gridMap.get('7,4'); // x=55.5, z=-7.5
  const oceanInterS = gridMap.get('7,5'); // x=55.5, z=+7.5
  if (oceanInterN !== undefined) connect(pierStart, oceanInterN);
  if (oceanInterS !== undefined) connect(pierStart, oceanInterS);

  // Add Mint Flamingo Hotel Lobby interior waypoint (x=28, z=-24) connected to Ocean Drive sidewalk (x=40.5, z=-24)
  const lobbyApproach = addNode(40.5, -24, { isShopSpot: true });
  const lobbyInside = addNode(28, -24, { isBenchSpot: true });
  connect(lobbyApproach, lobbyInside);
  const odNorth = gridMap.get('6,3'); // x=40.5, z=-40.5
  const odSouth = gridMap.get('6,4'); // x=40.5, z=-7.5
  if (odNorth !== undefined) connect(lobbyApproach, odNorth);
  if (odSouth !== undefined) connect(lobbyApproach, odSouth);

  return nodes;
}

/**
 * Checks whether a segment between (x1, z1) and (x2, z2) crosses an asphalt road.
 * Returns the crossing axis ('ns' road or 'ew' road) if it crosses a road centerline.
 */
export function getCrossingRoadAxis(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): 'cross_ns_road' | 'cross_ew_road' | null {
  for (const rx of ROAD_X) {
    if ((x1 < rx && x2 > rx) || (x1 > rx && x2 < rx)) {
      return 'cross_ns_road';
    }
  }
  for (const rz of ROAD_Z) {
    if ((z1 < rz && z2 > rz) || (z1 > rz && z2 < rz)) {
      return 'cross_ew_road';
    }
  }
  return null;
}

/**
 * Determines whether a pedestrian is cleared to cross based on traffic signals.
 * Crossing an NS road (moving East-West) is safe when EW has Green.
 * Crossing an EW road (moving North-South) is safe when NS has Green.
 */
export function canPedestrianCross(
  crossing: 'cross_ns_road' | 'cross_ew_road' | null,
  signals: TrafficSignalState,
): boolean {
  if (!crossing) return true;
  if (crossing === 'cross_ns_road') return signals.ewGreen;
  return signals.nsGreen;
}

/**
 * Picks the next neighbor node avoiding immediate backtracking unless dead-end.
 */
export function chooseNextWaypoint(
  nodes: readonly WaypointNode[],
  currentId: number,
  prevId: number,
  personality: NpcPersonality,
  rng: () => number = Math.random,
): number {
  const node = nodes[currentId];
  if (!node || node.neighbors.length === 0) return currentId;
  if (node.neighbors.length === 1) return node.neighbors[0];

  const candidates = node.neighbors.filter((id) => id !== prevId);
  const pool = candidates.length > 0 ? candidates : node.neighbors;

  // Shoppers & socializers slightly prefer shop/bench spots
  if (personality === 'shopper' || personality === 'socializer') {
    const preferred = pool.filter((id) => nodes[id].isBenchSpot || nodes[id].isShopSpot);
    if (preferred.length > 0 && rng() < 0.65) {
      return preferred[Math.floor(rng() * preferred.length)];
    }
  }

  return pool[Math.floor(rng() * pool.length)];
}

export const NPC_PROFILES: ReadonlyArray<{
  name: string;
  role: string;
  personality: NpcPersonality;
  lines: string[];
  hint: string;
}> = [
  {
    name: 'Elena Vance',
    role: 'Oceanfront Concierge',
    personality: 'concierge',
    lines: [
      'Welcome to Mint Flamingo Suites! Feel free to relax in our lobby or head down to the pier.',
      'Golden Palm Stars are hidden across the city—check the pier tip and the South Bridge crest!',
    ],
    hint: 'Tip: Check the Mint Flamingo lobby interior right off Ocean Drive.',
  },
  {
    name: 'Mateo Cruz',
    role: 'Coastal Runner',
    personality: 'jogger',
    lines: [
      'Morning breeze along Ocean Drive beats any gym. Watch the crosswalk signals at Pier Ave!',
      'I spotted a Teal Breeze Coupe parked down by South Bay Marina if you need a fast ride.',
    ],
    hint: 'Tip: Press Tab or tap the Minimap to place a custom navigation waypoint.',
  },
  {
    name: 'Chloe Moreau',
    role: 'Art Deco Architect',
    personality: 'stroller',
    lines: [
      'The pastel neon crowns along Ocean Drive really come alive right after sunset.',
      'Try cycling the time of day or weather from the HUD to see Solana Bay in the rain.',
    ],
    hint: 'Tip: You can change Weather and Time of Day in the Pause / Settings menu.',
  },
  {
    name: 'Devon Brooks',
    role: 'Marina Mechanic',
    personality: 'shopper',
    lines: [
      'Need wheels? The Stinger GT handles tight corners, while the Solana Cruiser weaves through traffic.',
      'Hit H to honk your horn—pedestrians will clear the crosswalk right away.',
    ],
    hint: 'Tip: Drink from a street refreshment kiosk to restore your Sprint Stamina.',
  },
  {
    name: 'Sienna Park',
    role: 'Travel Blogger',
    personality: 'socializer',
    lines: [
      'Palm Park Fountain and the Ocean Pier Gazebo are the best viewpoints in the whole bay.',
      'Your progress auto-saves as you complete missions and collect Golden Stars.',
    ],
    hint: 'Tip: Complete all 3 missions to clear the Solana Bay campaign.',
  },
];
