import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ROAD_X,
  ROAD_Z,
  ROAD_HALF_W,
  SIDEWALK_OUTER,
  CANAL_Z,
  CANAL_HALF_W,
  BRIDGE_HALF_SPAN,
  BRIDGE_HEIGHT,
  BEACH_START_X,
  SHORE_X,
  PIER_END_X,
  PIER_HALF_W,
  PIER_HEIGHT,
} from './math';
import type { BoxCollider } from './types';
import type { ProceduralTextureSet } from './textures';

export interface BenchSpot {
  id: string;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
}

export interface KioskSpot {
  id: string;
  label: string;
  x: number;
  z: number;
}

export interface TrafficSignalLights {
  x: number;
  z: number;
  nsRed: THREE.MeshStandardMaterial;
  nsYellow: THREE.MeshStandardMaterial;
  nsGreen: THREE.MeshStandardMaterial;
  ewRed: THREE.MeshStandardMaterial;
  ewYellow: THREE.MeshStandardMaterial;
  ewGreen: THREE.MeshStandardMaterial;
}

export interface CityWorld {
  group: THREE.Group;
  colliders: BoxCollider[];
  raycastWalls: THREE.Object3D[];
  neonMats: THREE.MeshStandardMaterial[];
  windowMats: THREE.MeshStandardMaterial[];
  lampMats: THREE.MeshStandardMaterial[];
  roadMats: THREE.MeshStandardMaterial[];
  trafficSignals: TrafficSignalLights[];
  benches: BenchSpot[];
  kiosks: KioskSpot[];
  conciergeSpot: { x: number; z: number; yaw: number };
  oceanMesh: THREE.Mesh;
  canalWaterMesh: THREE.Mesh;
  surfFoamMesh: THREE.Mesh;
  cloudsGroup: THREE.Group;
}

export function buildCityWorld(textures: ProceduralTextureSet): CityWorld {
  const group = new THREE.Group();
  const colliders: BoxCollider[] = [];
  const raycastWalls: THREE.Object3D[] = [];
  const neonMats: THREE.MeshStandardMaterial[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const roadMats: THREE.MeshStandardMaterial[] = [];
  const trafficSignals: TrafficSignalLights[] = [];
  const benches: BenchSpot[] = [];
  const kiosks: KioskSpot[] = [];

  const registerBuilding = (
    id: string,
    mesh: THREE.Object3D,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    height: number,
  ) => {
    colliders.push({ id, minX, maxX, minZ, maxZ, height, isSolid: true });
    raycastWalls.push(mesh);
  };

  // 1. Ocean Water Horizon
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0891b2,
    roughness: 0.16,
    metalness: 0.35,
  });
  const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100, 24, 24), oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(220, -0.55, 0);
  oceanMesh.receiveShadow = true;
  group.add(oceanMesh);

  const surfMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.65,
  });
  const surfFoamMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 300), surfMat);
  surfFoamMesh.rotation.x = -Math.PI / 2;
  surfFoamMesh.position.set(SHORE_X + 1.5, -0.1, 0);
  group.add(surfFoamMesh);

  // 2. Sandy Beach East of Ocean Drive
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.sand,
    roughness: 0.92,
    metalness: 0.0,
  });
  const beachGeo = new THREE.PlaneGeometry(46, 300, 8, 1);
  beachGeo.rotateX(-Math.PI / 2);
  const bPos = beachGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const localX = bPos.getX(i);
    const worldX = 80 + localX;
    let y = 0.16;
    if (worldX <= SHORE_X) {
      const t = (worldX - BEACH_START_X) / (SHORE_X - BEACH_START_X);
      y = 0.16 * (1 - t) - 0.15 * t;
    } else {
      const t = Math.min(1, (worldX - SHORE_X) / 28);
      y = -0.15 - t * 1.1;
    }
    bPos.setY(i, y);
  }
  beachGeo.computeVertexNormals();
  const beachMesh = new THREE.Mesh(beachGeo, sandMat);
  beachMesh.position.set(80, 0, 0);
  beachMesh.receiveShadow = true;
  group.add(beachMesh);

  // 3. City Landmass Base (top at y = -0.02 so roads and sidewalks sit cleanly on top)
  const blockGroundMat = new THREE.MeshStandardMaterial({
    color: 0xc2b9a7,
    roughness: 0.9,
    metalness: 0.0,
  });
  const northLand = new THREE.Mesh(new THREE.BoxGeometry(204, 1.4, 207), blockGroundMat);
  northLand.position.set(-44, -0.72, -40.5);
  northLand.receiveShadow = true;
  const southLand = new THREE.Mesh(new THREE.BoxGeometry(204, 1.4, 65), blockGroundMat);
  southLand.position.set(-44, -0.72, 113.5);
  southLand.receiveShadow = true;
  group.add(northLand, southLand);

  // Canal bed & turquoise water along z = 72
  const canalBed = new THREE.Mesh(
    new THREE.PlaneGeometry(206, CANAL_HALF_W * 2),
    new THREE.MeshStandardMaterial({ color: 0x164e63, roughness: 0.9 }),
  );
  canalBed.rotation.x = -Math.PI / 2;
  canalBed.position.set(-44, -0.88, CANAL_Z);
  group.add(canalBed);

  const canalWaterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(206, CANAL_HALF_W * 2),
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    }),
  );
  canalWaterMesh.rotation.x = -Math.PI / 2;
  canalWaterMesh.position.set(-44, -0.32, CANAL_Z);
  group.add(canalWaterMesh);

  const seawallMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8 });
  for (const bankZ of [CANAL_Z - CANAL_HALF_W, CANAL_Z + CANAL_HALF_W]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(204, 1.2, 0.8), seawallMat);
    wall.position.set(-44, -0.25, bankZ);
    wall.receiveShadow = true;
    group.add(wall);
  }

  // 4. Raised City Block Pads & Sidewalks (y = 0.16, strictly OUTSIDE 12m road corridors)
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.sidewalk,
    roughness: 0.85,
  });

  const blockXBounds: [number, number][] = [
    [-142, ROAD_X[0] - ROAD_HALF_W],
    [ROAD_X[0] + ROAD_HALF_W, ROAD_X[1] - ROAD_HALF_W],
    [ROAD_X[1] + ROAD_HALF_W, ROAD_X[2] - ROAD_HALF_W],
    [ROAD_X[2] + ROAD_HALF_W, ROAD_X[3] - ROAD_HALF_W],
    [ROAD_X[3] + ROAD_HALF_W, BEACH_START_X],
  ];
  const blockZBounds: [number, number][] = [
    [-142, ROAD_Z[0] - ROAD_HALF_W],
    [ROAD_Z[0] + ROAD_HALF_W, ROAD_Z[1] - ROAD_HALF_W],
    [ROAD_Z[1] + ROAD_HALF_W, ROAD_Z[2] - ROAD_HALF_W],
    [ROAD_Z[2] + ROAD_HALF_W, ROAD_Z[3] - ROAD_HALF_W],
    [ROAD_Z[3] + ROAD_HALF_W, CANAL_Z - CANAL_HALF_W],
    [CANAL_Z + CANAL_HALF_W, ROAD_Z[4] - ROAD_HALF_W],
    [ROAD_Z[4] + ROAD_HALF_W, 142],
  ];

  for (const [x0, x1] of blockXBounds) {
    const bw = x1 - x0;
    const cx = (x0 + x1) * 0.5;
    for (const [z0, z1] of blockZBounds) {
      const bd = z1 - z0;
      if (bw < 1 || bd < 1) continue;
      const cz = (z0 + z1) * 0.5;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.16, bd), sidewalkMat);
      pad.position.set(cx, 0.08, cz);
      pad.receiveShadow = true;
      group.add(pad);
    }
  }

  // 5. Road Asphalt (y = 0.008) & Intersections (y = 0.022)
  const roadNSMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.roadNS,
    roughness: 0.82,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadEWMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.roadEW,
    roughness: 0.82,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const interMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.intersection,
    roughness: 0.8,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  roadMats.push(roadNSMat, roadEWMat, interMat);

  for (const rx of ROAD_X) {
    const rN = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_W * 2, 196), roadNSMat);
    rN.rotation.x = -Math.PI / 2;
    rN.position.set(rx, 0.008, -42);
    rN.receiveShadow = true;
    const rS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_W * 2, 52), roadNSMat);
    rS.rotation.x = -Math.PI / 2;
    rS.position.set(rx, 0.008, 114);
    rS.receiveShadow = true;
    group.add(rN, rS);
  }

  for (const rz of ROAD_Z) {
    const rEW = new THREE.Mesh(new THREE.PlaneGeometry(194, ROAD_HALF_W * 2), roadEWMat);
    rEW.rotation.x = -Math.PI / 2;
    rEW.position.set(-39, 0.012, rz);
    rEW.receiveShadow = true;
    group.add(rEW);
  }

  for (const rx of ROAD_X) {
    for (const rz of ROAD_Z) {
      const inter = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_W * 2, ROAD_HALF_W * 2), interMat);
      inter.rotation.x = -Math.PI / 2;
      inter.position.set(rx, 0.022, rz);
      inter.receiveShadow = true;
      group.add(inter);
    }
  }

  // 6. Arched Coastal Bridges over South Lagoon Canal
  const bridgeRoadMat = new THREE.MeshStandardMaterial({
    color: 0x374151,
    roughness: 0.82,
  });
  roadMats.push(bridgeRoadMat);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
    metalness: 0.2,
  });

  for (const rx of ROAD_X) {
    const segs = 16;
    const deckGeo = new THREE.BoxGeometry(SIDEWALK_OUTER * 2, 0.45, BRIDGE_HALF_SPAN * 2, 1, 1, segs);
    const dPos = deckGeo.attributes.position;
    for (let i = 0; i < dPos.count; i++) {
      const lz = dPos.getZ(i);
      const arch = 0.5 * (1 + Math.cos((Math.PI * lz) / BRIDGE_HALF_SPAN));
      dPos.setY(i, dPos.getY(i) + BRIDGE_HEIGHT * arch - 0.22);
    }
    deckGeo.computeVertexNormals();
    const bridgeDeck = new THREE.Mesh(deckGeo, seawallMat);
    bridgeDeck.position.set(rx, 0.16, CANAL_Z);
    bridgeDeck.castShadow = true;
    bridgeDeck.receiveShadow = true;
    group.add(bridgeDeck);

    const roadArchGeo = new THREE.PlaneGeometry(ROAD_HALF_W * 2, BRIDGE_HALF_SPAN * 2, 1, segs);
    roadArchGeo.rotateX(-Math.PI / 2);
    const raPos = roadArchGeo.attributes.position;
    for (let i = 0; i < raPos.count; i++) {
      const lz = raPos.getZ(i);
      const arch = 0.5 * (1 + Math.cos((Math.PI * lz) / BRIDGE_HALF_SPAN));
      raPos.setY(i, BRIDGE_HEIGHT * arch + 0.03);
    }
    roadArchGeo.computeVertexNormals();
    const roadArch = new THREE.Mesh(roadArchGeo, bridgeRoadMat);
    roadArch.position.set(rx, 0, CANAL_Z);
    roadArch.receiveShadow = true;
    group.add(roadArch);

    for (const side of [-1, 1]) {
      const railGeo = new THREE.BoxGeometry(0.45, 0.9, BRIDGE_HALF_SPAN * 2, 1, 1, segs);
      const rPos = railGeo.attributes.position;
      for (let i = 0; i < rPos.count; i++) {
        const lz = rPos.getZ(i);
        const arch = 0.5 * (1 + Math.cos((Math.PI * lz) / BRIDGE_HALF_SPAN));
        rPos.setY(i, rPos.getY(i) + BRIDGE_HEIGHT * arch + 0.55);
      }
      railGeo.computeVertexNormals();
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(rx + side * (SIDEWALK_OUTER - 0.35), 0, CANAL_Z);
      rail.castShadow = true;
      group.add(rail);
      registerBuilding(
        `bridge-rail-${rx}-${side}`,
        rail,
        rx + side * (SIDEWALK_OUTER - 0.35) - 0.4,
        rx + side * (SIDEWALK_OUTER - 0.35) + 0.4,
        CANAL_Z - BRIDGE_HALF_SPAN + 2,
        CANAL_Z + BRIDGE_HALF_SPAN - 2,
        3.5,
      );
    }
  }

  // 7. Ocean Pier
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.wood,
    roughness: 0.78,
  });
  const pierRampGeo = new THREE.BoxGeometry(8, 0.35, PIER_HALF_W * 2);
  const rampSlope = Math.atan2(PIER_HEIGHT - 0.16, 8);
  const pierRamp = new THREE.Mesh(pierRampGeo, woodMat);
  pierRamp.position.set(BEACH_START_X + 4, (0.16 + PIER_HEIGHT) * 0.5 - 0.16, 0);
  pierRamp.rotation.z = rampSlope;
  pierRamp.receiveShadow = true;
  group.add(pierRamp);

  const pierLen = PIER_END_X - (BEACH_START_X + 8);
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(pierLen, 0.35, PIER_HALF_W * 2), woodMat);
  pierDeck.position.set(BEACH_START_X + 8 + pierLen / 2, PIER_HEIGHT - 0.175, 0);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  group.add(pierDeck);

  const pilingGeo = new THREE.CylinderGeometry(0.28, 0.3, 4.2, 8);
  const pilingMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.9 });
  for (let px = BEACH_START_X + 12; px <= PIER_END_X - 2; px += 10) {
    for (const pz of [-PIER_HALF_W + 0.4, PIER_HALF_W - 0.4]) {
      const piling = new THREE.Mesh(pilingGeo, pilingMat);
      piling.position.set(px, -0.4, pz);
      group.add(piling);
    }
  }

  const gazeboGroup = new THREE.Group();
  gazeboGroup.position.set(124, PIER_HEIGHT, 0);
  const gazeboMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.45 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 8), gazeboMat);
    post.position.set(Math.cos(a) * 3.8, 1.8, Math.sin(a) * 3.8);
    post.castShadow = true;
    gazeboGroup.add(post);
  }
  const gazeboRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.2, 6), roofMat);
  gazeboRoof.position.y = 4.6;
  gazeboRoof.castShadow = true;
  gazeboGroup.add(gazeboRoof);
  const gazeboNeon = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x14b8a6,
    emissiveIntensity: 0.7,
  });
  neonMats.push(gazeboNeon);
  const gazeboRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.08, 8, 24), gazeboNeon);
  gazeboRing.rotation.x = Math.PI / 2;
  gazeboRing.position.y = 3.55;
  gazeboGroup.add(gazeboRing);
  group.add(gazeboGroup);

  // 8. Palm Park & Fountain Plaza
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.grass,
    roughness: 0.92,
  });
  const parkLawn = new THREE.Mesh(new THREE.BoxGeometry(28, 0.14, 28), grassMat);
  parkLawn.position.set(-24, 0.08, -72);
  parkLawn.receiveShadow = true;
  group.add(parkLawn);

  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(-24, 0.15, -72);
  const basinRing = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.7, 20), marbleMat);
  basinRing.position.y = 0.35;
  basinRing.castShadow = true;
  basinRing.receiveShadow = true;
  const basinWater = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 3.8, 0.55, 20),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.15, metalness: 0.25 }),
  );
  basinWater.position.y = 0.38;
  const centerTier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 2.2, 12), marbleMat);
  centerTier.position.y = 1.2;
  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.6, 0.5, 16), marbleMat);
  topBowl.position.y = 2.2;
  fountainGroup.add(basinRing, basinWater, centerTier, topBowl);
  group.add(fountainGroup);
  registerBuilding('park-fountain', basinRing, -28.4, -19.6, -76.4, -67.6, 2.6);

  // 9A. Walkable Interior Building: Mint Flamingo Hotel Lobby (cx=24, cz=-24)
  // Open 4.6m double doorway on +X wall facing Ocean Drive!
  {
    const cx = 24;
    const cz = -24;
    const w = 16;
    const d = 18;
    const h = 17;
    const lobbyH = 4.4;
    const wallThick = 0.65;

    const bGroup = new THREE.Group();
    bGroup.position.set(cx, 0.12, cz);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x99f6e4,
      map: textures.facadeAlbedo,
      emissive: 0xffffff,
      emissiveMap: textures.facadeEmissive,
      emissiveIntensity: 0.15,
      roughness: 0.72,
    });
    windowMats.push(wallMat);

    const interiorWallMat = new THREE.MeshStandardMaterial({ color: 0xccfbf1, roughness: 0.72 });
    const trimM = new THREE.MeshStandardMaterial({ color: 0xf0fdfa, roughness: 0.45 });
    const neonM = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    neonMats.push(neonM);

    // Interior terrazzo lobby floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.lobbyTile,
      roughness: 0.35,
      metalness: 0.08,
    });
    const lobbyFloor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.12, d - 0.2), floorMat);
    lobbyFloor.position.y = 0.06;
    lobbyFloor.receiveShadow = true;
    bGroup.add(lobbyFloor);

    // Warm interior ceiling & Art Deco chandelier glow strip
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), interiorWallMat);
    ceiling.position.y = lobbyH;
    bGroup.add(ceiling);
    raycastWalls.push(ceiling);

    const lobbyGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.9,
    });
    neonMats.push(lobbyGlowMat);
    const chandelier = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 6.2), lobbyGlowMat);
    chandelier.position.set(0.8, lobbyH - 0.25, 0);
    bGroup.add(chandelier);

    // Back wall (-X), North wall (-Z), South wall (+Z)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyH, d), interiorWallMat);
    backWall.position.set(-w / 2 + wallThick / 2, lobbyH / 2, 0);
    backWall.castShadow = true;
    bGroup.add(backWall);
    registerBuilding('hotel-mint-back', backWall, cx - w / 2, cx - w / 2 + wallThick, cz - d / 2, cz + d / 2, lobbyH);

    const northWall = new THREE.Mesh(new THREE.BoxGeometry(w, lobbyH, wallThick), interiorWallMat);
    northWall.position.set(0, lobbyH / 2, -d / 2 + wallThick / 2);
    northWall.castShadow = true;
    bGroup.add(northWall);
    registerBuilding('hotel-mint-north', northWall, cx - w / 2, cx + w / 2, cz - d / 2, cz - d / 2 + wallThick, lobbyH);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(w, lobbyH, wallThick), interiorWallMat);
    southWall.position.set(0, lobbyH / 2, d / 2 - wallThick / 2);
    southWall.castShadow = true;
    bGroup.add(southWall);
    registerBuilding('hotel-mint-south', southWall, cx - w / 2, cx + w / 2, cz + d / 2 - wallThick, cz + d / 2, lobbyH);

    // Front wall (+X) split around central 4.8m doorway (open from z = -2.4..+2.4)
    const frontSegLen = (d - 4.8) / 2; // 6.6m
    const frontNorth = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyH, frontSegLen), interiorWallMat);
    frontNorth.position.set(w / 2 - wallThick / 2, lobbyH / 2, -d / 2 + frontSegLen / 2);
    frontNorth.castShadow = true;
    const frontSouth = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyH, frontSegLen), interiorWallMat);
    frontSouth.position.set(w / 2 - wallThick / 2, lobbyH / 2, d / 2 - frontSegLen / 2);
    frontSouth.castShadow = true;
    bGroup.add(frontNorth, frontSouth);
    registerBuilding(
      'hotel-mint-front-n',
      frontNorth,
      cx + w / 2 - wallThick,
      cx + w / 2,
      cz - d / 2,
      cz - 2.4,
      lobbyH,
    );
    registerBuilding(
      'hotel-mint-front-s',
      frontSouth,
      cx + w / 2 - wallThick,
      cx + w / 2,
      cz + 2.4,
      cz + d / 2,
      lobbyH,
    );

    // Reception desk inside lobby (west side) + 2 lounge sofas
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45 });
    const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.05, 5.2), deskMat);
    desk.position.set(-4.2, 0.62, 0);
    const deskCounter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 5.4), deskTopMat);
    deskCounter.position.set(-4.2, 1.18, 0);
    bGroup.add(desk, deskCounter);
    registerBuilding('hotel-mint-desk', desk, cx - 5.0, cx - 3.4, cz - 2.7, cz + 2.7, 1.4);

    // Lounge sofas inside lobby
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.8 });
    for (const sz of [-6.0, 6.0]) {
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.65, 1.3), sofaMat);
      sofa.position.set(0, 0.42, sz);
      bGroup.add(sofa);
      benches.push({
        id: `lobby-sofa-${sz}`,
        x: cx,
        y: 0.18,
        z: cz + sz,
        facingYaw: sz < 0 ? 0 : Math.PI,
      });
    }

    // Potted indoor palm planters flanking doorway & desk
    const potMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
    for (const [px, pz] of [
      [5.4, -3.5],
      [5.4, 3.5],
      [-2.8, -3.6],
      [-2.8, 3.6],
    ]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.65, 8), potMat);
      pot.position.set(px, 0.42, pz);
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), leafMat);
      foliage.position.set(px, 1.02, pz);
      bGroup.add(pot, foliage);
    }

    // Upper tower stories above lobby ceiling (y = 4.4..17)
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(w, h - lobbyH, d), wallMat);
    upperBody.position.y = lobbyH + (h - lobbyH) / 2;
    upperBody.castShadow = true;
    upperBody.receiveShadow = true;
    bGroup.add(upperBody);
    raycastWalls.push(upperBody);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 2.4, d * 0.68), trimM);
    crown.position.y = h + 1.2;
    crown.castShadow = true;
    bGroup.add(crown);

    const neonBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), neonM);
    neonBand.position.y = h - 0.8;
    bGroup.add(neonBand);

    // Grand entrance awning over doorway
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 6.6), trimM);
    awning.position.set(w / 2 + 1.6, lobbyH - 0.15, 0);
    awning.castShadow = true;
    bGroup.add(awning);

    const awningNeon = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 6.7), neonM);
    awningNeon.position.set(w / 2 + 1.6, lobbyH - 0.3, 0);
    bGroup.add(awningNeon);

    group.add(bGroup);
  }

  // 9B. Walkable Open-Front Sunset Surf Cafe (cx=24, cz=24)
  {
    const cx = 24;
    const cz = 24;
    const w = 16;
    const d = 18;
    const h = 14;
    const cafeH = 4.2;
    const wallThick = 0.65;

    const bGroup = new THREE.Group();
    bGroup.position.set(cx, 0.12, cz);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      map: textures.facadeAlbedo,
      emissive: 0xffffff,
      emissiveMap: textures.facadeEmissive,
      emissiveIntensity: 0.15,
      roughness: 0.72,
    });
    windowMats.push(wallMat);

    const cafeWallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
    const trimM = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.45 });
    const neonM = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.65,
    });
    neonMats.push(neonM);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.lobbyTile,
      roughness: 0.4,
    });
    const cafeFloor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.12, d - 0.2), floorMat);
    cafeFloor.position.y = 0.06;
    cafeFloor.receiveShadow = true;
    bGroup.add(cafeFloor);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), cafeWallMat);
    ceiling.position.y = cafeH;
    bGroup.add(ceiling);
    raycastWalls.push(ceiling);

    // Back, North, South solid walls + open +X cafe promenade
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, cafeH, d), cafeWallMat);
    backWall.position.set(-w / 2 + wallThick / 2, cafeH / 2, 0);
    bGroup.add(backWall);
    registerBuilding('cafe-back', backWall, cx - w / 2, cx - w / 2 + wallThick, cz - d / 2, cz + d / 2, cafeH);

    const northWall = new THREE.Mesh(new THREE.BoxGeometry(w, cafeH, wallThick), cafeWallMat);
    northWall.position.set(0, cafeH / 2, -d / 2 + wallThick / 2);
    bGroup.add(northWall);
    registerBuilding('cafe-north', northWall, cx - w / 2, cx + w / 2, cz - d / 2, cz - d / 2 + wallThick, cafeH);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(w, cafeH, wallThick), cafeWallMat);
    southWall.position.set(0, cafeH / 2, d / 2 - wallThick / 2);
    bGroup.add(southWall);
    registerBuilding('cafe-south', southWall, cx - w / 2, cx + w / 2, cz + d / 2 - wallThick, cz + d / 2, cafeH);

    // Cafe espresso bar inside
    const barMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.05, 6.0),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.55 }),
    );
    barMesh.position.set(-3.8, 0.62, 0);
    bGroup.add(barMesh);
    registerBuilding('cafe-bar', barMesh, cx - 4.5, cx - 3.1, cz - 3.0, cz + 3.0, 1.4);

    // Indoor cafe tables + outdoor patio bistro tables & umbrellas
    const tableTopMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const tableBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.35 });
    const patioUmbMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.72 });
    for (const [tx, tz, hasUmbrella] of [
      [2.2, -4.4, false],
      [2.2, 4.4, false],
      [10.2, -4.6, true],
      [10.2, 4.6, true],
    ] as [number, number, boolean][]) {
      const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 12), tableTopMat);
      tTop.position.set(tx, 0.82, tz);
      const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 0.72, 8), tableBaseMat);
      tLeg.position.set(tx, 0.44, tz);
      bGroup.add(tTop, tLeg);
      for (const czOff of [-0.95, 0.95]) {
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), trimM);
        chair.position.set(tx, 0.32, tz + czOff);
        bGroup.add(chair);
      }
      if (hasUmbrella) {
        const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), tableBaseMat);
        uPole.position.set(tx, 1.9, tz);
        const uCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.55, 8), patioUmbMat);
        uCanopy.position.set(tx, 3.0, tz);
        bGroup.add(uPole, uCanopy);
      }
    }

    // Upper tower stories above cafe
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(w, h - cafeH, d), wallMat);
    upperBody.position.y = cafeH + (h - cafeH) / 2;
    upperBody.castShadow = true;
    upperBody.receiveShadow = true;
    bGroup.add(upperBody);
    raycastWalls.push(upperBody);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 2.4, d * 0.68), trimM);
    crown.position.y = h + 1.2;
    bGroup.add(crown);

    const neonBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), neonM);
    neonBand.position.y = h - 0.8;
    bGroup.add(neonBand);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 9.2), neonM);
    awning.position.set(w / 2 + 1.5, cafeH - 0.2, 0);
    bGroup.add(awning);

    group.add(bGroup);
  }

  // 9C. Helper for Art Deco Hotels (with stepped balconies), Skyscrapers, and Villas
  const createArtDecoHotel = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    wallColor: number,
    trimColor: number,
    neonColor: number,
  ) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(cx, 0.12, cz);

    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      map: textures.facadeAlbedo,
      emissive: 0xffffff,
      emissiveMap: textures.facadeEmissive,
      emissiveIntensity: 0.15,
      roughness: 0.72,
    });
    windowMats.push(wallMat);

    const trimM = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.45 });
    const neonM = new THREE.MeshStandardMaterial({
      color: neonColor,
      emissive: neonColor,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    neonMats.push(neonM);

    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mainBody.position.y = h / 2;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    bGroup.add(mainBody);

    // Decorative Art Deco balcony tiers
    for (let by = 4.6; by < h - 2; by += 3.6) {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.22, d + 0.7), trimM);
      ledge.position.y = by;
      bGroup.add(ledge);
    }

    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 2.4, d * 0.68), trimM);
    crown.position.y = h + 1.2;
    crown.castShadow = true;
    bGroup.add(crown);

    const neonBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), neonM);
    neonBand.position.y = h - 0.8;
    bGroup.add(neonBand);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, w * 0.45), trimM);
    awning.position.set(w / 2 + 1.4, 3.2, 0);
    awning.castShadow = true;
    bGroup.add(awning);

    const doorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.5, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xfef3c7, emissiveIntensity: 0.35, roughness: 0.15 }),
    );
    doorGlass.position.set(w / 2 + 0.04, 1.35, 0);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 2.7), trimM);
    doorFrame.position.set(w / 2 + 0.01, 1.4, 0);
    bGroup.add(doorFrame, doorGlass);

    group.add(bGroup);
    registerBuilding(id, mainBody, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h + 2.4);
  };

  const createSkyscraper = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    tint: number,
  ) => {
    const sGroup = new THREE.Group();
    sGroup.position.set(cx, 0.12, cz);

    const glassWallMat = new THREE.MeshStandardMaterial({
      color: tint,
      map: textures.facadeAlbedo,
      emissive: 0xffffff,
      emissiveMap: textures.facadeEmissive,
      emissiveIntensity: 0.2,
      roughness: 0.28,
      metalness: 0.45,
    });
    windowMats.push(glassWallMat);

    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.68, d), glassWallMat);
    base.position.y = (h * 0.68) / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    sGroup.add(base);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, h * 0.32, d * 0.76), glassWallMat);
    upper.position.y = h * 0.68 + (h * 0.32) / 2;
    upper.castShadow = true;
    sGroup.add(upper);

    const spireMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.25 });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 6.5, 8), spireMat);
    spire.position.y = h + 3.25;
    sGroup.add(spire);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.9,
    });
    neonMats.push(beaconMat);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), beaconMat);
    beacon.position.y = h + 6.6;
    sGroup.add(beacon);

    group.add(sGroup);
    registerBuilding(id, base, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h);
  };

  const createCoastalVilla = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    d: number,
    wallColor: number,
    roofColor: number,
  ) => {
    const vGroup = new THREE.Group();
    vGroup.position.set(cx, 0.12, cz);

    const wMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.82 });
    const rMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0xfef08a,
      emissiveIntensity: 0.1,
      roughness: 0.2,
    });
    windowMats.push(winMat);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 4.4, d), wMat);
    body.position.y = 2.2;
    body.castShadow = true;
    body.receiveShadow = true;
    vGroup.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.76, 2.8, 4), rMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.8;
    roof.castShadow = true;
    vGroup.add(roof);

    const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 1.4, d + 0.12), winMat);
    frontWindow.position.y = 2.4;
    vGroup.add(frontWindow);

    const villaDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 2.3, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 }),
    );
    villaDoor.position.set(0, 1.25, d / 2 + 0.04);
    const porchStep = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.22, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 }),
    );
    porchStep.position.set(0, 0.12, d / 2 + 0.45);
    vGroup.add(villaDoor, porchStep);

    group.add(vGroup);
    registerBuilding(id, body, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 6.5);
  };

  createArtDecoHotel('hotel-coral', 24, -72, 16, 20, 15, 0xfda4af, 0xfff1f2, 0xf43f5e);
  createArtDecoHotel('marina-lounge', 24, 114, 18, 16, 11, 0xbae6fd, 0xf8fafc, 0x06b6d4);

  createSkyscraper('tower-north', -24, -24, 16, 16, 44, 0x93c5fd);
  createSkyscraper('tower-south', -24, 24, 17, 16, 36, 0xa5f3fc);
  createSkyscraper('tower-west-1', -72, -24, 15, 16, 28, 0xcbd5e1);
  createSkyscraper('tower-west-2', -72, 24, 16, 15, 32, 0xddd6fe);

  createCoastalVilla('villa-1', -72, -72, 12, 11, 0xfef3c7, 0xe11d48);
  createCoastalVilla('villa-2', -118, -72, 13, 12, 0xe0f2fe, 0x0284c7);
  createCoastalVilla('villa-3', -118, -24, 14, 12, 0xfce7f3, 0xdb2777);
  createCoastalVilla('villa-4', -118, 24, 13, 12, 0xdcfce7, 0x0d9488);
  createCoastalVilla('villa-5', -24, 116, 14, 12, 0xffedd5, 0xea580c);
  createCoastalVilla('villa-6', -72, 116, 14, 12, 0xf3e8ff, 0x7c3aed);
  createCoastalVilla('villa-7', -118, 116, 13, 12, 0xfef9c3, 0x0891b2);

  // 10. 4-Way Traffic Light Gantries at Major Intersections
  const signalIntersections: [number, number][] = [
    [48, 0],
    [0, 0],
    [48, -48],
    [0, -48],
  ];
  const gantryPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

  for (const [ix, iz] of signalIntersections) {
    const nsRed = new THREE.MeshStandardMaterial({ color: 0x450a0a, emissive: 0xef4444, emissiveIntensity: 0.1 });
    const nsYellow = new THREE.MeshStandardMaterial({ color: 0x451a03, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
    const nsGreen = new THREE.MeshStandardMaterial({ color: 0x052e16, emissive: 0x22c55e, emissiveIntensity: 1.0 });

    const ewRed = new THREE.MeshStandardMaterial({ color: 0x450a0a, emissive: 0xef4444, emissiveIntensity: 1.0 });
    const ewYellow = new THREE.MeshStandardMaterial({ color: 0x451a03, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
    const ewGreen = new THREE.MeshStandardMaterial({ color: 0x052e16, emissive: 0x22c55e, emissiveIntensity: 0.1 });

    // Place two corner poles per intersection (NE & SW corners outside sidewalk curb)
    const buildSignalCorner = (px: number, pz: number, armDirX: number, armDirZ: number) => {
      const sg = new THREE.Group();
      sg.position.set(px, 0.16, pz);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.4, 8), gantryPoleMat);
      post.position.y = 2.7;
      sg.add(post);

      const armNS = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.14), gantryPoleMat);
      armNS.position.set(armDirX * 2.1, 5.2, 0);
      sg.add(armNS);

      const boxNS = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.05, 0.34), housingMat);
      boxNS.position.set(armDirX * 3.5, 4.75, 0);
      sg.add(boxNS);

      const bulbGeo = new THREE.SphereGeometry(0.11, 8, 8);
      const makeBulbs = (
        rMat: THREE.MeshStandardMaterial,
        yMat: THREE.MeshStandardMaterial,
        gMat: THREE.MeshStandardMaterial,
        bx: number,
        bz: number,
        faceZ: boolean,
      ) => {
        const offset = faceZ ? 0.16 : 0;
        const offsetX = faceZ ? 0 : 0.16;
        for (const sign of [-1, 1]) {
          const bR = new THREE.Mesh(bulbGeo, rMat);
          bR.position.set(bx + sign * offsetX, 5.05, bz + sign * offset);
          const bY = new THREE.Mesh(bulbGeo, yMat);
          bY.position.set(bx + sign * offsetX, 4.75, bz + sign * offset);
          const bG = new THREE.Mesh(bulbGeo, gMat);
          bG.position.set(bx + sign * offsetX, 4.45, bz + sign * offset);
          sg.add(bR, bY, bG);
        }
      };

      makeBulbs(nsRed, nsYellow, nsGreen, armDirX * 3.5, 0, true);

      const armEW = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.2), gantryPoleMat);
      armEW.position.set(0, 5.2, armDirZ * 2.1);
      sg.add(armEW);

      const boxEW = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 0.45), housingMat);
      boxEW.position.set(0, 4.75, armDirZ * 3.5);
      sg.add(boxEW);

      makeBulbs(ewRed, ewYellow, ewGreen, 0, armDirZ * 3.5, false);
      group.add(sg);
    };

    buildSignalCorner(ix - 7.8, iz + 7.8, 1, -1);
    trafficSignals.push({ x: ix, z: iz, nsRed, nsYellow, nsGreen, ewRed, ewYellow, ewGreen });
  }

  // 11. Interactive Park & Pier Benches + Refreshment Kiosks + Street Signs
  const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
  const benchIronMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.4 });
  const benchSpecs: Array<{ id: string; x: number; z: number; yaw: number }> = [
    { id: 'park-bench-w', x: -33, z: -72, yaw: Math.PI / 2 },
    { id: 'park-bench-e', x: -15, z: -72, yaw: -Math.PI / 2 },
    { id: 'park-bench-n', x: -24, z: -80, yaw: 0 },
    { id: 'pier-bench-1', x: 88, z: 4.2, yaw: Math.PI },
    { id: 'pier-bench-2', x: 112, z: -4.2, yaw: 0 },
  ];
  for (const bs of benchSpecs) {
    const y = bs.id.startsWith('pier') ? PIER_HEIGHT : 0.15;
    const bg = new THREE.Group();
    bg.position.set(bs.x, y, bs.z);
    bg.rotation.y = bs.yaw;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.62), benchWoodMat);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.1), benchWoodMat);
    back.position.set(0, 0.72, -0.26);
    for (const lx of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.56), benchIronMat);
      leg.position.set(lx, 0.225, 0);
      bg.add(leg);
    }
    bg.add(seat, back);
    group.add(bg);
    benches.push({ id: bs.id, x: bs.x, y, z: bs.z, facingYaw: bs.yaw });
  }

  // Refreshment Kiosks (restore player stamina)
  const kioskSpecs: Array<{ id: string; label: string; x: number; z: number }> = [
    { id: 'kiosk-ocean', label: 'Solana Coconut Stand', x: 55.2, z: -12 },
    { id: 'kiosk-park', label: 'Palm Park Juice Bar', x: -34, z: -61 },
    { id: 'kiosk-plaza', label: 'Downtown Espresso Cart', x: -10.5, z: 12 },
    { id: 'kiosk-marina', label: 'South Marina Smoothies', x: 38.5, z: 102 },
  ];
  const kioskBaseMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
  const kioskRoofMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.5 });
  for (const ks of kioskSpecs) {
    const kg = new THREE.Group();
    kg.position.set(ks.x, 0.16, ks.z);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 1.5), kioskBaseMat);
    counter.position.y = 0.575;
    counter.castShadow = true;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.8, 4), kioskRoofMat);
    canopy.rotation.y = Math.PI / 4;
    canopy.position.y = 2.65;
    canopy.castShadow = true;
    for (const [px, pz] of [
      [-0.85, -0.6],
      [0.85, -0.6],
      [-0.85, 0.6],
      [0.85, 0.6],
    ]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), gantryPoleMat);
      p.position.set(px, 1.7, pz);
      kg.add(p);
    }
    kg.add(counter, canopy);
    group.add(kg);
    registerBuilding(ks.id, counter, ks.x - 1.05, ks.x + 1.05, ks.z - 0.8, ks.z + 0.8, 2.8);
    kiosks.push(ks);
  }

  // Coastal Street Name Signs at Major Intersections
  const makeStreetSignTex = (label: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const streetSigns: Array<{ x: number; z: number; nsName: string; ewName: string }> = [
    { x: 55.4, z: 7.4, nsName: 'OCEAN DR', ewName: 'PIER AVE' },
    { x: 55.4, z: -40.2, nsName: 'OCEAN DR', ewName: 'FLAMINGO WAY' },
    { x: -7.4, z: -7.4, nsName: 'CENTRAL BLVD', ewName: 'PIER AVE' },
    { x: -7.4, z: -55.4, nsName: 'CENTRAL BLVD', ewName: 'PALM PARK RD' },
    { x: 40.2, z: 88.6, nsName: 'OCEAN DR', ewName: 'MARINA BLVD' },
  ];
  for (const ss of streetSigns) {
    const sg = new THREE.Group();
    sg.position.set(ss.x, 0.16, ss.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.8, 6), gantryPoleMat);
    pole.position.y = 1.9;
    const plateNS = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.34, 0.08),
      new THREE.MeshStandardMaterial({ map: makeStreetSignTex(ss.nsName), roughness: 0.4 }),
    );
    plateNS.position.y = 3.65;
    const plateEW = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.34, 1.45),
      new THREE.MeshStandardMaterial({ map: makeStreetSignTex(ss.ewName), roughness: 0.4 }),
    );
    plateEW.position.y = 3.3;
    sg.add(pole, plateNS, plateEW);
    group.add(sg);
  }

  // Coastal Bus Stop Shelters
  const shelterGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    roughness: 0.15,
  });
  for (const [bx, bz] of [
    [40.4, 32],
    [-8.2, -32],
  ]) {
    const sh = new THREE.Group();
    sh.position.set(bx, 0.16, bz);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 4.2), kioskRoofMat);
    roof.position.y = 2.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 4.0), shelterGlassMat);
    back.position.set(-0.7, 1.25, 0);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 3.2), benchWoodMat);
    seat.position.set(-0.35, 0.5, 0);
    sh.add(roof, back, seat);
    group.add(sh);
  }

  // Beach Lifeguard Tower & Umbrellas on sand
  const lgTower = new THREE.Group();
  lgTower.position.set(70, 0.05, -18);
  const lgBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.4, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }),
  );
  lgBase.position.y = 2.6;
  lgBase.castShadow = true;
  const lgRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.5, 1.3, 4),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }),
  );
  lgRoof.rotation.y = Math.PI / 4;
  lgRoof.position.y = 4.45;
  for (const [lx, lz] of [
    [-1.1, -1.1],
    [1.1, -1.1],
    [-1.1, 1.1],
    [1.1, 1.1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6), pilingMat);
    leg.position.set(lx, 1.1, lz);
    lgTower.add(leg);
  }
  lgTower.add(lgBase, lgRoof);
  group.add(lgTower);
  registerBuilding('lifeguard-tower', lgBase, 68.4, 71.6, -19.6, -16.4, 5.0);

  const umbColors = [0xf43f5e, 0x06b6d4, 0xfbbf24, 0x10b981];
  for (let i = 0; i < 8; i++) {
    const uz = -76 + i * 22;
    if (Math.abs(uz) < 12 || Math.abs(uz - CANAL_Z) < 12) continue;
    const ux = 69 + (i % 2) * 5;
    const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), railMat);
    uPole.position.set(ux, 1.2, uz);
    const uTop = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: umbColors[i % umbColors.length], roughness: 0.75 }),
    );
    uTop.position.set(ux, 2.4, uz);
    uTop.castShadow = true;
    group.add(uPole, uTop);
  }

  // 12. Instanced Palm Trees
  const palmPositions: [number, number][] = [];
  for (let z = -124; z <= 124; z += 22) {
    if (Math.abs(z - CANAL_Z) < 18) continue;
    if (ROAD_Z.some((rz) => Math.abs(z - rz) < 11)) continue;
    palmPositions.push([55.5, z]);
    // Skip right in front of hotel lobby entrance (z=-24) and surf cafe (z=24)
    if (Math.abs(z + 24) > 8 && Math.abs(z - 24) > 8) {
      palmPositions.push([40.5, z]);
    }
    palmPositions.push([-8.5, z], [8.5, z]);
  }
  for (let x = -120; x <= 36; x += 24) {
    if (ROAD_X.some((rx) => Math.abs(x - rx) < 11)) continue;
    palmPositions.push([x, -8.5], [x, 8.5]);
  }
  palmPositions.push([-32, -80], [-16, -80], [-32, -64], [-16, -64]);

  const palmCount = palmPositions.length;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 6.4, 7);
  trunkGeo.translate(0, 3.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6240, roughness: 0.92 });
  const palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
  palmTrunks.castShadow = true;

  const frondGeos: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 7; f++) {
    const angle = (f / 7) * Math.PI * 2;
    const inner = new THREE.ConeGeometry(0.42, 1.8, 4);
    inner.rotateZ(-Math.PI * 0.38);
    inner.translate(0.75, 6.55, 0);
    inner.rotateY(angle);
    frondGeos.push(inner);

    const tip = new THREE.ConeGeometry(0.32, 1.9, 4);
    tip.rotateZ(-Math.PI * 0.62);
    tip.translate(1.95, 6.18, 0);
    tip.rotateY(angle);
    frondGeos.push(tip);
  }
  const tuft = new THREE.SphereGeometry(0.55, 6, 5);
  tuft.translate(0, 6.55, 0);
  frondGeos.push(tuft);
  const crownGeo = mergeGeometries(frondGeos, false) ?? new THREE.ConeGeometry(2.2, 1.1, 7);
  frondGeos.forEach((g) => g.dispose());

  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const palmCrowns = new THREE.InstancedMesh(crownGeo, crownMat, palmCount);
  palmCrowns.castShadow = true;

  const dummy = new THREE.Object3D();
  const frondColor = new THREE.Color();
  const palmGreens = [0x16a34a, 0x22c55e, 0x15803d, 0x4ade80];
  palmPositions.forEach(([px, pz], idx) => {
    const scale = 0.88 + ((idx * 17) % 10) * 0.028;
    dummy.position.set(px, 0.12, pz);
    dummy.rotation.set(((idx % 3) - 1) * 0.04, (idx * 1.1) % (Math.PI * 2), ((idx % 5) - 2) * 0.03);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(idx, dummy.matrix);
    palmCrowns.setMatrixAt(idx, dummy.matrix);

    frondColor.setHex(palmGreens[idx % palmGreens.length]);
    palmCrowns.setColorAt(idx, frondColor);
  });
  palmTrunks.instanceMatrix.needsUpdate = true;
  palmCrowns.instanceMatrix.needsUpdate = true;
  if (palmCrowns.instanceColor) palmCrowns.instanceColor.needsUpdate = true;
  palmTrunks.computeBoundingSphere();
  palmCrowns.computeBoundingSphere();
  group.add(palmTrunks, palmCrowns);

  // 13. Instanced Art Deco Streetlamps
  const lampPositions: [number, number][] = [];
  for (let z = -112; z <= 112; z += 32) {
    if (Math.abs(z - CANAL_Z) < 16) continue;
    if (ROAD_Z.some((rz) => Math.abs(z - rz) < 10)) continue;
    if (Math.abs(z - 14) > 12) {
      lampPositions.push([41.2, z]);
    }
    lampPositions.push([-7.5, z], [-55.5, z]);
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 5.4, 6);
  poleGeo.translate(0, 2.7, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 });
  const lampPoles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);

  const globeGeo = new THREE.SphereGeometry(0.28, 8, 8);
  globeGeo.translate(0, 5.5, 0);
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 0.25,
    roughness: 0.2,
  });
  lampMats.push(globeMat);
  const lampGlobes = new THREE.InstancedMesh(globeGeo, globeMat, lampPositions.length);

  lampPositions.forEach(([lx, lz], idx) => {
    dummy.position.set(lx, 0.16, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(idx, dummy.matrix);
    lampGlobes.setMatrixAt(idx, dummy.matrix);
  });
  lampPoles.instanceMatrix.needsUpdate = true;
  lampGlobes.instanceMatrix.needsUpdate = true;
  lampPoles.computeBoundingSphere();
  lampGlobes.computeBoundingSphere();
  group.add(lampPoles, lampGlobes);

  // 14. Tropical Cumulus Clouds
  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  });
  for (let c = 0; c < 14; c++) {
    const cluster = new THREE.Group();
    const angle = (c / 14) * Math.PI * 2;
    const dist = 120 + (c % 3) * 75;
    cluster.position.set(Math.cos(angle) * dist, 74 + (c % 4) * 7, Math.sin(angle) * dist);
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(6 + (p % 2) * 3.5, 1),
        cloudMat,
      );
      puff.position.set((p - 1.5) * 6.5, (p % 2) * 1.8, ((p * 3) % 3 - 1) * 3.2);
      puff.scale.set(1.4, 0.72, 1.1);
      cluster.add(puff);
    }
    cloudsGroup.add(cluster);
  }
  group.add(cloudsGroup);

  return {
    group,
    colliders,
    raycastWalls,
    neonMats,
    windowMats,
    lampMats,
    roadMats,
    trafficSignals,
    benches,
    kiosks,
    conciergeSpot: { x: 22.8, z: -24, yaw: Math.PI / 2 },
    oceanMesh,
    canalWaterMesh,
    surfFoamMesh,
    cloudsGroup,
  };
}
