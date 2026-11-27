import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BEACH_START_X,
  computeCameraRelativeMove,
  getDayNightParams,
  getInteriorCeilingHeight,
  groundHeightAt,
  isOnRoadAsphalt,
  lerpAngle,
  resolveCircleColliders,
  SHORE_X,
  stepVehicleKinematics,
} from './math';
import {
  buildPedestrianGraph,
  canPedestrianCross,
  chooseNextWaypoint,
  getCrossingRoadAxis,
  getTrafficSignalState,
  NPC_PROFILES,
  type WaypointNode,
} from './npcAi';
import { CAMPAIGN_MISSIONS, GOLDEN_STARS } from './missions';
import { SoundEngine } from './audio';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import { createHumanRig, createVehicleRig, type HumanRig, type VehicleRig } from './models';
import { buildCityWorld, type CityWorld } from './cityBuilder';
import type {
  CharacterAnimState,
  GameMode,
  GraphicsQuality,
  HudSnapshot,
  MinimapEntity,
  NpcActivity,
  NpcDialogueState,
  NpcPersonality,
  SaveGameData,
  TimeMode,
  TouchInputState,
  VehicleType,
  WeatherMode,
} from './types';

const SAVE_STORAGE_KEY = 'solana_bay_save_v1';

interface VehicleActor {
  id: string;
  type: VehicleType;
  name: string;
  rig: VehicleRig;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  radius: number;
  isTraffic: boolean;
  trafficAxis: 'ns' | 'ew';
  trafficDir: 1 | -1;
  trafficLaneCoord: number;
  wheelSpin: number;
  steerVisual: number;
}

interface PedestrianActor {
  id: string;
  rig: HumanRig;
  name: string;
  role: string;
  lines: string[];
  hint: string;
  personality: NpcPersonality;
  activity: NpcActivity;
  x: number;
  y: number;
  z: number;
  yaw: number;
  baseSpeed: number;
  walkPhase: number;
  currentNodeId: number;
  targetNodeId: number;
  prevNodeId: number;
  activityTimer: number;
  hurryTimer: number;
  stuckTimer: number;
  lastCheckX: number;
  lastCheckZ: number;
  isStationaryConcierge: boolean;
  occupiedBenchId: string | null;
  socialCooldown: number;
}

interface StarActor {
  id: string;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

interface VehicleTransition {
  active: boolean;
  entering: boolean;
  vehicle: VehicleActor;
  progress: number;
  duration: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
}

// Pre-allocated scratch math objects (Zero-GC render loop)
const _camDesired = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _bgColor = new THREE.Color();
const _daySky = new THREE.Color(0x5ec6f2);
const _rainSky = new THREE.Color(0x4b647d);
const _sunsetSky = new THREE.Color(0xf9735b);
const _nightSky = new THREE.Color(0x0d1226);
const _sunColorDay = new THREE.Color(0xfff7e6);
const _sunColorSunset = new THREE.Color(0xff9a5c);
const _sunColorNight = new THREE.Color(0x6366f1);
const _hemiSkyDay = new THREE.Color(0x87ceeb);
const _hemiSkyNight = new THREE.Color(0x1e293b);
const _hemiGroundDay = new THREE.Color(0x9a8866);
const _hemiGroundNight = new THREE.Color(0x0f172a);
const _oceanDay = new THREE.Color(0x0891b2);
const _oceanSunset = new THREE.Color(0x1e5c78);
const _oceanNight = new THREE.Color(0x07263d);
const _dummyObj = new THREE.Object3D();

const PARTICLE_POOL_SIZE = 72;
const RAIN_COUNT = 180;

export class SolanaBayEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onModeChange: (mode: GameMode) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fog!: THREE.FogExp2;
  private textures!: ProceduralTextureSet;
  private city!: CityWorld;
  private pedGraph: WaypointNode[] = [];
  private sound = new SoundEngine();

  private isSoftwareGl = false;
  private quality: GraphicsQuality = 'auto';
  private timeMode: TimeMode = 'dynamic';
  private weatherMode: WeatherMode = 'clear';
  private timeNormalized = 0.22;

  private mode: GameMode = 'title';
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private elapsedSec = 0;
  private hudThrottleTimer = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private fpsEstimate = 60;

  // Player state
  private playerRig!: HumanRig;
  private playerX = 40;
  private playerY = 0.16;
  private playerZ = 14;
  private playerVy = 0;
  private playerFacing = Math.PI * 0.88;
  private playerGrounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private walkPhase = 0;
  private stamina = 100;
  private landingSquash = 0;
  private animState: CharacterAnimState = 'idle';
  private interactAnimTimer = 0;
  private isSitting = false;
  private sittingYaw = 0;
  private currentVehicle: VehicleActor | null = null;
  private vehicleTransition: VehicleTransition | null = null;
  private distanceTraveled = 0;
  private activeDialogue: NpcDialogueState | null = null;
  private talkingNpc: PedestrianActor | null = null;

  // Camera state
  private camYaw = Math.PI * 0.12;
  private camPitch = 0.32;
  private camCurrentPos = new THREE.Vector3(46, 5, 22);
  private camCurrentLook = new THREE.Vector3(40, 2, 14);
  private camShakeTrauma = 0;
  private titleOrbitAngle = 0;
  private raycaster = new THREE.Raycaster();

  // Entities
  private vehicles: VehicleActor[] = [];
  private pedestrians: PedestrianActor[] = [];
  private stars: StarActor[] = [];
  private checkpointGroup!: THREE.Group;
  private checkpointRing!: THREE.Mesh;
  private checkpointBeam!: THREE.Mesh;
  private customWaypointGroup!: THREE.Group;
  private customWaypoint: { x: number; z: number } | null = null;

  // Rain & Particle pools
  private particlesMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private rainMesh!: THREE.InstancedMesh;
  private rainDrops: Array<{ x: number; y: number; z: number; speed: number }> = [];

  // Campaign / progression
  private cash = 0;
  private missionIdx = 0;
  private checkpointIdx = 0;
  private missionsCompleted = 0;
  private starsCollected = 0;
  private bannerText: string | null = null;
  private bannerTimer = 0;

  // Inputs
  private keysHeld = new Set<string>();
  private jumpJustPressed = false;
  private interactJustPressed = false;
  private hornJustPressed = false;
  private touchInput: TouchInputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    jumpJustPressed: false,
    interactJustPressed: false,
    hornPressed: false,
    throttle: 0,
    brake: 0,
    steer: 0,
  };
  private draggingCamera = false;
  private dragPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private resizeObserver: ResizeObserver | null = null;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onModeChange: (mode: GameMode) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onModeChange = onModeChange;
    this.init();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private init(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(width, height);
    this.applyQualitySettings();

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.tabIndex = 0;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    _bgColor.copy(_daySky);
    this.scene.background = _bgColor;
    this.fog = new THREE.FogExp2(_daySky.getHex(), 0.0028);
    this.scene.fog = this.fog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.25, 650);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x9a8866, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7e6, 2.0);
    this.sunLight.position.set(60, 95, 45);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 220;
    const d = 58;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.city = buildCityWorld(this.textures);
    this.scene.add(this.city.group);

    this.pedGraph = buildPedestrianGraph();

    this.playerRig = createHumanRig(0, true, this.textures.contactShadow);
    this.scene.add(this.playerRig.root);

    this.initCheckpointBeacon();
    this.initCustomWaypointBeacon();
    this.initParticles();
    this.initRain();
    this.spawnWorldActors();

    this.resetWorldState(false);
    this.updateLighting(0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.attachEvents();
    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private initCheckpointBeacon(): void {
    this.checkpointGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(2.6, 3.3, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.checkpointRing = new THREE.Mesh(ringGeo, ringMat);
    this.checkpointRing.position.y = 0.18;

    const beamGeo = new THREE.CylinderGeometry(1.1, 2.2, 26, 20, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfb7185,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.checkpointBeam = new THREE.Mesh(beamGeo, beamMat);
    this.checkpointBeam.position.y = 13;

    this.checkpointGroup.add(this.checkpointRing, this.checkpointBeam);
    this.scene.add(this.checkpointGroup);
  }

  private initCustomWaypointBeacon(): void {
    this.customWaypointGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(1.8, 2.4, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    ring.position.y = 0.2;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 1.35, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 17;
    this.customWaypointGroup.add(ring, beam);
    this.customWaypointGroup.visible = false;
    this.scene.add(this.customWaypointGroup);
  }

  private initParticles(): void {
    const geo = new THREE.OctahedronGeometry(0.18, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particlesMesh = new THREE.InstancedMesh(geo, mat, PARTICLE_POOL_SIZE);
    this.particlesMesh.frustumCulled = false;
    this.particlesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
      });
      _dummyObj.position.set(0, -50, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      this.particlesMesh.setMatrixAt(i, _dummyObj.matrix);
      this.particlesMesh.setColorAt(i, this.particles[i].color);
    }
    this.scene.add(this.particlesMesh);
  }

  private initRain(): void {
    const geo = new THREE.CylinderGeometry(0.014, 0.014, 0.85, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbbe6ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(geo, mat, RAIN_COUNT);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainDrops.push({
        x: (Math.random() - 0.5) * 44,
        y: Math.random() * 22,
        z: (Math.random() - 0.5) * 44,
        speed: 19 + Math.random() * 7,
      });
    }
    this.scene.add(this.rainMesh);
  }

  private emitParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 4.5,
  ): void {
    for (let i = 0; i < count; i++) {
      const idx = this.particleCursor;
      const slot = this.particles[idx];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const spd = (0.4 + Math.random() * 0.7) * speed;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.6;
      slot.y = y + 0.2;
      slot.z = z + (Math.random() - 0.5) * 0.6;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = up * spd;
      slot.vz = Math.sin(angle) * spd;
      slot.life = 0;
      slot.maxLife = 0.45 + Math.random() * 0.35;
      slot.size = 0.7 + Math.random() * 0.8;
      slot.color.setHex(colorHex);
      this.particlesMesh.setColorAt(idx, slot.color);
    }
    if (this.particlesMesh.instanceColor) {
      this.particlesMesh.instanceColor.needsUpdate = true;
    }
  }

  private disposeObjectTree(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  }

  private clearSpawnedActors(): void {
    for (const v of this.vehicles) {
      this.scene.remove(v.rig.root);
      this.disposeObjectTree(v.rig.root);
    }
    for (const p of this.pedestrians) {
      this.scene.remove(p.rig.root);
      this.disposeObjectTree(p.rig.root);
    }
    for (const s of this.stars) {
      this.scene.remove(s.mesh);
      this.disposeObjectTree(s.mesh);
    }
    this.vehicles = [];
    this.pedestrians = [];
    this.stars = [];
  }

  private spawnWorldActors(): void {
    this.clearSpawnedActors();

    // 1. Parked Player-Ready Vehicles
    const parkedSpecs: Array<{
      id: string;
      type: VehicleType;
      name: string;
      color: number;
      x: number;
      z: number;
      heading: number;
    }> = [
      { id: 'parked-coupe-1', type: 'coupe', name: 'Stinger GT Convertible', color: 0xf43f5e, x: 43.0, z: 11.4, heading: Math.PI },
      { id: 'parked-moto-1', type: 'moto', name: 'Solana Cruiser Bike', color: 0x06b6d4, x: 43.6, z: 22, heading: Math.PI },
      { id: 'parked-bus-1', type: 'bus', name: 'Metro Bay Transit', color: 0xf59e0b, x: -3.5, z: -18, heading: 0 },
      { id: 'parked-coupe-2', type: 'coupe', name: 'Teal Breeze Convertible', color: 0x14b8a6, x: 44.5, z: 106, heading: Math.PI },
      { id: 'parked-moto-2', type: 'moto', name: 'Sunset Street Bike', color: 0xa855f7, x: -44.5, z: -64, heading: 0 },
    ];

    for (const spec of parkedSpecs) {
      this.vehicles.push(
        this.createVehicleActor(spec.id, spec.type, spec.name, spec.color, spec.x, spec.z, spec.heading, false, 'ns', 1, spec.x),
      );
    }

    // 2. AI Road Traffic
    const trafficSpecs: Array<{
      type: VehicleType;
      color: number;
      axis: 'ns' | 'ew';
      roadCoord: number;
      dir: 1 | -1;
      posAlong: number;
    }> = [
      { type: 'coupe', color: 0x38bdf8, axis: 'ns', roadCoord: 48, dir: -1, posAlong: -40 },
      { type: 'coupe', color: 0xfbbf24, axis: 'ns', roadCoord: 48, dir: 1, posAlong: -70 },
      { type: 'bus', color: 0x10b981, axis: 'ns', roadCoord: 0, dir: 1, posAlong: -80 },
      { type: 'moto', color: 0xfb7185, axis: 'ns', roadCoord: 0, dir: -1, posAlong: 40 },
      { type: 'coupe', color: 0xe2e8f0, axis: 'ew', roadCoord: 0, dir: 1, posAlong: -65 },
      { type: 'coupe', color: 0x8b5cf6, axis: 'ew', roadCoord: -48, dir: -1, posAlong: 20 },
      { type: 'bus', color: 0x0ea5e9, axis: 'ew', roadCoord: 48, dir: 1, posAlong: -90 },
      { type: 'moto', color: 0xf97316, axis: 'ns', roadCoord: -48, dir: 1, posAlong: 25 },
    ];

    trafficSpecs.forEach((t, idx) => {
      const laneOffset = 3.0;
      let x = 0;
      let z = 0;
      let heading = 0;
      let laneCoord = 0;
      if (t.axis === 'ns') {
        laneCoord = t.roadCoord + (t.dir === 1 ? -laneOffset : laneOffset);
        x = laneCoord;
        z = t.posAlong;
        heading = t.dir === 1 ? 0 : Math.PI;
      } else {
        laneCoord = t.roadCoord + (t.dir === 1 ? laneOffset : -laneOffset);
        x = t.posAlong;
        z = laneCoord;
        heading = t.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      const name = t.type === 'coupe' ? 'City Coupe' : t.type === 'bus' ? 'Metro Bus' : 'Street Bike';
      this.vehicles.push(
        this.createVehicleActor(`traffic-${idx}`, t.type, name, t.color, x, z, heading, true, t.axis, t.dir, laneCoord),
      );
    });

    // 3. Smart Pedestrians across waypoint graph + Mint Flamingo Hotel Concierge
    const conciergeProfile = NPC_PROFILES[0];
    const cRig = createHumanRig(1, false, this.textures.contactShadow);
    const cSpot = this.city.conciergeSpot;
    const cy = groundHeightAt(cSpot.x, cSpot.z);
    cRig.root.position.set(cSpot.x, cy, cSpot.z);
    cRig.root.rotation.y = cSpot.yaw;
    this.scene.add(cRig.root);
    this.pedestrians.push({
      id: 'npc-concierge',
      rig: cRig,
      name: conciergeProfile.name,
      role: conciergeProfile.role,
      lines: conciergeProfile.lines,
      hint: conciergeProfile.hint,
      personality: 'concierge',
      activity: 'idle_look',
      x: cSpot.x,
      y: cy,
      z: cSpot.z,
      yaw: cSpot.yaw,
      baseSpeed: 0,
      walkPhase: 0,
      currentNodeId: 0,
      targetNodeId: 0,
      prevNodeId: 0,
      activityTimer: 4,
      hurryTimer: 0,
      stuckTimer: 0,
      lastCheckX: cSpot.x,
      lastCheckZ: cSpot.z,
      isStationaryConcierge: true,
      occupiedBenchId: null,
      socialCooldown: 0,
    });

    const pedCount = 22;
    const personalities: NpcPersonality[] = ['stroller', 'jogger', 'socializer', 'shopper'];
    for (let i = 0; i < pedCount; i++) {
      const profile = NPC_PROFILES[1 + (i % (NPC_PROFILES.length - 1))];
      const personality = personalities[i % personalities.length];
      const rig = createHumanRig(i + 2, false, this.textures.contactShadow);
      const startNodeId = (i * 5 + 3) % this.pedGraph.length;
      const startNode = this.pedGraph[startNodeId];
      const targetNodeId = chooseNextWaypoint(this.pedGraph, startNodeId, -1, personality);
      const targetNode = this.pedGraph[targetNodeId];

      const x = startNode.x;
      const z = startNode.z;
      const y = groundHeightAt(x, z);
      const yaw = Math.atan2(targetNode.x - x, targetNode.z - z);

      rig.root.position.set(x, y, z);
      rig.root.rotation.y = yaw;
      this.scene.add(rig.root);

      const baseSpeed =
        personality === 'jogger'
          ? 3.1
          : personality === 'shopper'
            ? 1.55
            : personality === 'socializer'
              ? 1.45
              : 1.75;

      this.pedestrians.push({
        id: `npc-${i}`,
        rig,
        name: profile.name,
        role: profile.role,
        lines: profile.lines,
        hint: profile.hint,
        personality,
        activity: 'walk',
        x,
        y,
        z,
        yaw,
        baseSpeed,
        walkPhase: Math.random() * Math.PI * 2,
        currentNodeId: startNodeId,
        targetNodeId,
        prevNodeId: startNodeId,
        activityTimer: 0,
        hurryTimer: 0,
        stuckTimer: 0,
        lastCheckX: x,
        lastCheckZ: z,
        isStationaryConcierge: false,
        occupiedBenchId: null,
        socialCooldown: Math.random() * 6,
      });
    }

    // 4. Golden Star Collectibles
    const starGeo = new THREE.OctahedronGeometry(0.68, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
      metalness: 0.6,
      roughness: 0.2,
    });
    const ringGeo = new THREE.TorusGeometry(0.95, 0.06, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.7 });

    for (const def of GOLDEN_STARS) {
      const sGroup = new THREE.Group();
      const y = groundHeightAt(def.x, def.z);
      sGroup.position.set(def.x, y + 1.15, def.z);
      const gem = new THREE.Mesh(starGeo, starMat);
      const halo = new THREE.Mesh(ringGeo, ringMat);
      sGroup.add(gem, halo);
      this.scene.add(sGroup);
      this.stars.push({
        id: def.id,
        mesh: sGroup,
        x: def.x,
        y,
        z: def.z,
        collected: false,
      });
    }
  }

  private createVehicleActor(
    id: string,
    type: VehicleType,
    name: string,
    color: number,
    x: number,
    z: number,
    heading: number,
    isTraffic: boolean,
    trafficAxis: 'ns' | 'ew',
    trafficDir: 1 | -1,
    trafficLaneCoord: number,
  ): VehicleActor {
    const rig = createVehicleRig(type, color, this.textures.contactShadow);
    const y = groundHeightAt(x, z);
    rig.root.position.set(x, y, z);
    rig.root.rotation.y = heading;
    this.scene.add(rig.root);

    const maxSpeed = type === 'coupe' ? 28 : type === 'moto' ? 31 : 19;
    const accel = type === 'coupe' ? 16 : type === 'moto' ? 19 : 9.5;
    const turnRate = type === 'coupe' ? 2.4 : type === 'moto' ? 2.9 : 1.55;
    const radius = type === 'bus' ? 2.6 : type === 'coupe' ? 1.7 : 1.05;

    return {
      id,
      type,
      name,
      rig,
      x,
      y,
      z,
      heading,
      speed: isTraffic ? 10 : 0,
      maxSpeed,
      accel,
      turnRate,
      radius,
      isTraffic,
      trafficAxis,
      trafficDir,
      trafficLaneCoord,
      wheelSpin: 0,
      steerVisual: 0,
    };
  }

  public setMode(newMode: GameMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    document.body.dataset.state = newMode;
    if (newMode !== 'playing') {
      this.keysHeld.clear();
      this.sound.updateEngine(false, 0, false);
      this.sound.updateAmbient(false, 999, false);
    } else {
      this.camCurrentPos.set(
        this.playerX + Math.sin(this.camYaw) * 6.5,
        this.playerY + 3.4,
        this.playerZ + Math.cos(this.camYaw) * 6.5,
      );
      this.camCurrentLook.set(this.playerX, this.playerY + 1.35, this.playerZ);
    }
    this.updateCheckpointBeaconVisual();
    this.onModeChange(newMode);
    this.pushHudSnapshot();
  }

  public startNewGame(): void {
    this.resetWorldState(true);
    this.setMode('playing');
    this.showBanner(`Mission 1: ${CAMPAIGN_MISSIONS[0].title}`, 3.2);
  }

  public restartGame(): void {
    this.resetWorldState(true);
    this.setMode('playing');
    this.showBanner(`Restarted — ${CAMPAIGN_MISSIONS[0].title}`, 2.6);
  }

  public returnToTitle(): void {
    this.activeDialogue = null;
    this.talkingNpc = null;
    this.resetWorldState(false);
    this.setMode('title');
  }

  public hasSavedGame(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  public saveGame(silent = false): boolean {
    try {
      const collectedStarIds = this.stars.filter((s) => s.collected).map((s) => s.id);
      const data: SaveGameData = {
        version: 1,
        savedAt: Date.now(),
        cash: this.cash,
        missionIdx: this.missionIdx,
        checkpointIdx: this.checkpointIdx,
        missionsCompleted: this.missionsCompleted,
        collectedStarIds,
        distanceTraveled: Math.round(this.distanceTraveled),
        playerX: this.playerX,
        playerZ: this.playerZ,
        playerFacing: this.playerFacing,
        timeMode: this.timeMode,
        weatherMode: this.weatherMode,
        quality: this.quality,
        customWaypoint: this.customWaypoint,
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
      if (!silent) {
        this.showBanner('Progress Saved', 2.0);
        this.pushHudSnapshot();
      }
      return true;
    } catch {
      return false;
    }
  }

  public loadSavedGame(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as SaveGameData;
      if (!data || typeof data.playerX !== 'number') return false;

      this.resetWorldState(true);
      this.cash = data.cash ?? 0;
      this.missionIdx = Math.max(0, Math.min(CAMPAIGN_MISSIONS.length - 1, data.missionIdx ?? 0));
      this.checkpointIdx = Math.max(0, data.checkpointIdx ?? 0);
      this.missionsCompleted = data.missionsCompleted ?? 0;
      this.distanceTraveled = data.distanceTraveled ?? 0;

      const collectedSet = new Set(data.collectedStarIds ?? []);
      this.starsCollected = 0;
      for (const s of this.stars) {
        if (collectedSet.has(s.id)) {
          s.collected = true;
          s.mesh.visible = false;
          this.starsCollected++;
        }
      }

      const resolved = resolveCircleColliders(data.playerX, data.playerZ, 0.55, this.city.colliders);
      this.playerX = resolved.x;
      this.playerZ = resolved.z;
      this.playerY = groundHeightAt(this.playerX, this.playerZ);
      this.playerFacing = data.playerFacing ?? Math.PI;
      this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.root.rotation.y = this.playerFacing;

      if (data.timeMode) this.setTimeMode(data.timeMode);
      if (data.weatherMode) this.setWeatherMode(data.weatherMode);
      if (data.quality) this.setQuality(data.quality);
      if (data.customWaypoint) this.setCustomWaypoint(data.customWaypoint.x, data.customWaypoint.z);

      this.updateCheckpointBeaconVisual();
      this.setMode('playing');
      this.showBanner('Saved Game Loaded', 2.4);
      return true;
    } catch {
      return false;
    }
  }

  private resetWorldState(clearProgress: boolean): void {
    if (this.currentVehicle) {
      if (this.playerRig.root.parent !== this.scene) {
        this.scene.add(this.playerRig.root);
      }
      this.currentVehicle = null;
      this.playerRig.root.visible = true;
    }
    this.vehicleTransition = null;
    this.isSitting = false;
    this.activeDialogue = null;
    this.talkingNpc = null;

    this.playerX = 40;
    this.playerZ = 14;
    this.playerY = groundHeightAt(this.playerX, this.playerZ);
    this.playerVy = 0;
    this.playerGrounded = true;
    this.playerFacing = Math.PI * 0.88;
    this.camYaw = Math.PI * 0.12;
    this.camPitch = 0.32;
    this.stamina = 100;
    this.walkPhase = 0;
    this.landingSquash = 0;
    this.animState = 'idle';

    if (clearProgress) {
      this.cash = 0;
      this.missionIdx = 0;
      this.checkpointIdx = 0;
      this.missionsCompleted = 0;
      this.starsCollected = 0;
      this.distanceTraveled = 0;
      this.setCustomWaypoint(null, null);
      this.spawnWorldActors();
    }

    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.root.rotation.y = this.playerFacing;
    this.updateCheckpointBeaconVisual();
  }

  public setQuality(q: GraphicsQuality): void {
    this.quality = q;
    this.applyQualitySettings();
  }

  private applyQualitySettings(): void {
    if (!this.renderer) return;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const isLikelyMobile = window.innerWidth < 820 || 'ontouchstart' in window;
    let resolved = this.quality;
    if (resolved === 'auto') {
      resolved = isLikelyMobile ? 'balanced' : 'high';
    }

    if (resolved === 'eco') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      if (this.sunLight) this.sunLight.castShadow = false;
    } else if (resolved === 'balanced') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.shadowMap.enabled = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(1024, 1024);
      }
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2));
      this.renderer.shadowMap.enabled = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
      }
    }
  }

  public setTimeMode(mode: TimeMode): void {
    this.timeMode = mode;
    if (mode === 'day') this.timeNormalized = 0.24;
    else if (mode === 'sunset') this.timeNormalized = 0.51;
    else if (mode === 'night') this.timeNormalized = 0.78;
    this.updateLighting(0);
    this.pushHudSnapshot();
  }

  public cycleTimeMode(): TimeMode {
    const order: TimeMode[] = ['dynamic', 'sunset', 'night', 'day'];
    const next = order[(order.indexOf(this.timeMode) + 1) % order.length];
    this.setTimeMode(next);
    this.showBanner(`Time: ${next === 'dynamic' ? 'Live Cycle' : next[0].toUpperCase() + next.slice(1)}`, 1.8);
    return next;
  }

  public setWeatherMode(mode: WeatherMode): void {
    this.weatherMode = mode;
    if (this.rainMesh) {
      this.rainMesh.visible = mode === 'rain';
    }
    const roadRoughness = mode === 'rain' ? 0.22 : 0.82;
    for (const rm of this.city.roadMats) {
      rm.roughness = roadRoughness;
    }
    this.updateLighting(0);
    this.pushHudSnapshot();
  }

  public cycleWeatherMode(): WeatherMode {
    const next: WeatherMode = this.weatherMode === 'clear' ? 'rain' : 'clear';
    this.setWeatherMode(next);
    this.showBanner(`Weather: ${next === 'rain' ? 'Tropical Rain' : 'Clear Skies'}`, 1.8);
    return next;
  }

  public setCustomWaypoint(x: number | null, z: number | null): void {
    if (x === null || z === null) {
      this.customWaypoint = null;
      if (this.customWaypointGroup) this.customWaypointGroup.visible = false;
    } else {
      this.customWaypoint = { x, z };
      if (this.customWaypointGroup) {
        this.customWaypointGroup.visible = true;
        this.customWaypointGroup.position.set(x, groundHeightAt(x, z), z);
      }
    }
    this.pushHudSnapshot();
  }

  public dismissDialogue(): void {
    this.activeDialogue = null;
    if (this.talkingNpc) {
      this.talkingNpc.activity = 'walk';
      this.talkingNpc = null;
    }
    this.pushHudSnapshot();
  }

  public setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
  }

  public isMuted(): boolean {
    return this.sound.isMuted();
  }

  public setTouchInput(partial: Partial<TouchInputState>): void {
    Object.assign(this.touchInput, partial);
  }

  public triggerTouchJump(): void {
    this.touchInput.jumpJustPressed = true;
  }

  public triggerTouchInteract(): void {
    this.touchInput.interactJustPressed = true;
  }

  public showBanner(text: string, duration = 2.6): void {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  private attachEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.handleResize);
  }

  public handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.applyQualitySettings();
  };

  private handleWindowBlur = (): void => {
    this.keysHeld.clear();
    this.draggingCamera = false;
    this.dragPointerId = null;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.keysHeld.clear();
      this.draggingCamera = false;
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      if (this.mode === 'playing') e.preventDefault();
    }

    if (this.mode === 'title') {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        this.startNewGame();
      }
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (this.activeDialogue) {
        this.dismissDialogue();
        return;
      }
      if (this.mode === 'playing') {
        this.setMode('paused');
        return;
      } else if (this.mode === 'paused') {
        this.setMode('playing');
        return;
      }
    }

    if (this.mode !== 'playing') return;

    this.sound.unlock();
    if (!this.keysHeld.has(code)) {
      if (code === 'Space') this.jumpJustPressed = true;
      if (code === 'KeyE' || code === 'KeyF') this.interactJustPressed = true;
      if (code === 'KeyH') this.hornJustPressed = true;
      if (code === 'KeyT') this.cycleTimeMode();
      if (code === 'KeyR') this.cycleWeatherMode();
    }
    this.keysHeld.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.mode !== 'playing') return;
    if (e.button !== 0 && e.button !== 2 && e.pointerType === 'mouse') return;
    this.draggingCamera = true;
    this.dragPointerId = e.pointerId;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.sound.unlock();
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.draggingCamera || e.pointerId !== this.dragPointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const sens = e.pointerType === 'touch' ? 0.0055 : 0.0042;
    this.camYaw -= dx * sens;
    this.camPitch = Math.max(0.14, Math.min(1.05, this.camPitch + dy * sens * 0.75));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragPointerId) {
      this.draggingCamera = false;
      this.dragPointerId = null;
    }
  };

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const nowMs = performance.now();
    const rawDt = Math.max(0.001, (nowMs - this.lastTimeMs) / 1000);
    this.lastTimeMs = nowMs;
    const dt = Math.min(rawDt, 0.05);

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fpsEstimate = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (this.mode === 'title') {
      this.elapsedSec += dt;
      this.updateLighting(dt);
      this.updateTrafficSignals();
      this.updateAmbientWorld(dt);
      this.updateTitleCamera(dt);
      this.renderer.render(this.scene, this.camera);
    } else if (this.mode === 'playing') {
      this.elapsedSec += dt;
      this.updateLighting(dt);
      this.updateTrafficSignals();
      this.updateAmbientWorld(dt);
      this.updatePlayerAndVehicle(dt);
      this.updateTraffic(dt);
      this.updatePedestrians(dt);
      this.updateObjectivesAndStars(dt);
      this.updateParticles(dt);
      this.updateRain(dt);
      this.updateGameplayCamera(dt);
      this.sound.updateAmbient(
        true,
        Math.abs(SHORE_X - this.playerX),
        this.weatherMode === 'rain',
      );
      this.renderer.render(this.scene, this.camera);

      this.hudThrottleTimer += dt;
      if (this.hudThrottleTimer >= 0.1) {
        this.hudThrottleTimer = 0;
        this.pushHudSnapshot();
      }
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.jumpJustPressed = false;
    this.interactJustPressed = false;
    this.hornJustPressed = false;
    this.touchInput.jumpJustPressed = false;
    this.touchInput.interactJustPressed = false;

    this.scheduleNextTick();
  }

  private updateLighting(dt: number): void {
    if (this.timeMode === 'dynamic') {
      this.timeNormalized = (this.timeNormalized + dt * 0.0083) % 1;
    }
    const p = getDayNightParams(this.timeNormalized);
    const isRain = this.weatherMode === 'rain';

    if (p.nightFactor > 0.01) {
      _bgColor.copy(_sunsetSky).lerp(_nightSky, p.nightFactor);
    } else {
      _bgColor.copy(_daySky).lerp(_sunsetSky, p.sunsetFactor);
    }
    if (isRain) {
      _bgColor.lerp(_rainSky, 0.58 * (1 - p.nightFactor * 0.6));
    }
    this.scene.background = _bgColor;
    this.fog.color.copy(_bgColor);
    this.fog.density = 0.0024 + p.nightFactor * 0.0014 + (isRain ? 0.0032 : 0);

    const sunDist = 85;
    const sunElevY = Math.max(0.18, p.sunElevation) * sunDist;
    const targetX = this.currentVehicle ? this.currentVehicle.x : this.playerX;
    const targetZ = this.currentVehicle ? this.currentVehicle.z : this.playerZ;
    this.sunLight.position.set(
      targetX + p.sunAzimuth * sunDist * 0.85,
      sunElevY,
      targetZ + 32,
    );
    this.sunLight.target.position.set(targetX, 0, targetZ);
    this.sunLight.intensity = p.sunIntensity * (isRain ? 0.52 : 1.0);
    this.sunLight.color
      .copy(_sunColorDay)
      .lerp(_sunColorSunset, p.sunsetFactor)
      .lerp(_sunColorNight, p.nightFactor * 0.8);

    this.hemiLight.intensity = p.hemiIntensity * (isRain ? 0.85 : 1.0);
    this.hemiLight.color.copy(_hemiSkyDay).lerp(_hemiSkyNight, p.nightFactor);
    this.hemiLight.groundColor.copy(_hemiGroundDay).lerp(_hemiGroundNight, p.nightFactor);

    const glow = Math.min(1, p.nightFactor + p.sunsetFactor * 0.45 + (isRain ? 0.25 : 0));
    for (const m of this.city.neonMats) m.emissiveIntensity = 0.35 + glow * 1.15;
    for (const m of this.city.windowMats) m.emissiveIntensity = 0.08 + p.nightFactor * 0.95;
    for (const m of this.city.lampMats) m.emissiveIntensity = 0.15 + glow * 1.4;
    for (const v of this.vehicles) {
      for (const hm of v.rig.headlightMats) hm.emissiveIntensity = 0.25 + glow * 1.4;
    }

    const oceanMat = this.city.oceanMesh.material as THREE.MeshStandardMaterial;
    oceanMat.color
      .copy(_oceanDay)
      .lerp(_oceanSunset, p.sunsetFactor)
      .lerp(_oceanNight, p.nightFactor);
  }

  private updateTrafficSignals(): void {
    const sig = getTrafficSignalState(this.elapsedSec);
    for (const tl of this.city.trafficSignals) {
      tl.nsGreen.emissiveIntensity = sig.nsGreen ? 1.4 : 0.08;
      tl.nsYellow.emissiveIntensity = sig.nsYellow ? 1.4 : 0.08;
      tl.nsRed.emissiveIntensity = !sig.nsGreen && !sig.nsYellow ? 1.4 : 0.08;

      tl.ewGreen.emissiveIntensity = sig.ewGreen ? 1.4 : 0.08;
      tl.ewYellow.emissiveIntensity = sig.ewYellow ? 1.4 : 0.08;
      tl.ewRed.emissiveIntensity = !sig.ewGreen && !sig.ewYellow ? 1.4 : 0.08;
    }
  }

  private updateAmbientWorld(dt: number): void {
    const surfOffset = Math.sin(this.elapsedSec * 1.8) * 1.4;
    this.city.surfFoamMesh.position.x = 87.5 + surfOffset;
    this.city.cloudsGroup.rotation.y += dt * 0.008;

    if (this.checkpointGroup.visible) {
      this.checkpointRing.rotation.z += dt * 1.6;
      const pulse = 1 + Math.sin(this.elapsedSec * 4) * 0.08;
      this.checkpointRing.scale.set(pulse, pulse, 1);
    }

    if (this.customWaypointGroup.visible) {
      this.customWaypointGroup.rotation.y += dt * 1.8;
    }

    for (const s of this.stars) {
      if (!s.collected) {
        s.mesh.rotation.y += dt * 2.2;
        s.mesh.position.y = s.y + 1.15 + Math.sin(this.elapsedSec * 3 + s.x) * 0.18;
      }
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }
  }

  private updateRain(dt: number): void {
    if (this.weatherMode !== 'rain') return;
    const cx = this.currentVehicle ? this.currentVehicle.x : this.playerX;
    const cz = this.currentVehicle ? this.currentVehicle.z : this.playerZ;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const d = this.rainDrops[i];
      d.y -= d.speed * dt;
      if (d.y < 0) {
        d.y = 18 + Math.random() * 6;
        d.x = (Math.random() - 0.5) * 44;
        d.z = (Math.random() - 0.5) * 44;
      }
      _dummyObj.position.set(cx + d.x, d.y, cz + d.z);
      _dummyObj.rotation.set(0, 0, 0.08);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      this.rainMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
  }

  private updateTitleCamera(dt: number): void {
    this.titleOrbitAngle += dt * 0.14;
    const cx = 32 + Math.cos(this.titleOrbitAngle) * 58;
    const cz = -6 + Math.sin(this.titleOrbitAngle) * 58;
    this.camera.position.set(cx, 24 + Math.sin(this.titleOrbitAngle * 1.5) * 4, cz);
    this.camera.lookAt(14, 6, -4);
  }

  private findNearestInteractable(): {
    kind: 'vehicle' | 'npc' | 'kiosk' | 'bench' | null;
    prompt: string | null;
    vehicle?: VehicleActor;
    npc?: PedestrianActor;
    kiosk?: { id: string; label: string; x: number; z: number };
    bench?: { id: string; x: number; y: number; z: number; facingYaw: number };
  } {
    if (this.currentVehicle) {
      return { kind: 'vehicle', prompt: `Exit ${this.currentVehicle.name} [E]`, vehicle: this.currentVehicle };
    }
    if (this.isSitting) {
      return { kind: 'bench', prompt: 'Stand Up [E]' };
    }

    const v = this.findNearestVehicle(5.2);
    if (v) {
      return { kind: 'vehicle', prompt: `Enter ${v.name} [E]`, vehicle: v };
    }

    let bestNpc: PedestrianActor | null = null;
    let bestNpcD = 3.5;
    for (const p of this.pedestrians) {
      const d = Math.hypot(p.x - this.playerX, p.z - this.playerZ);
      if (d < bestNpcD) {
        bestNpcD = d;
        bestNpc = p;
      }
    }
    if (bestNpc) {
      return { kind: 'npc', prompt: `Talk to ${bestNpc.name} [E]`, npc: bestNpc };
    }

    for (const k of this.city.kiosks) {
      if (Math.hypot(k.x - this.playerX, k.z - this.playerZ) < 3.4) {
        return { kind: 'kiosk', prompt: `Drink at ${k.label} [E]`, kiosk: k };
      }
    }

    for (const b of this.city.benches) {
      if (Math.hypot(b.x - this.playerX, b.z - this.playerZ) < 2.6) {
        return { kind: 'bench', prompt: 'Sit on Bench [E]', bench: b };
      }
    }

    return { kind: null, prompt: null };
  }

  private updatePlayerAndVehicle(dt: number): void {
    const interactPressed = this.interactJustPressed || this.touchInput.interactJustPressed;

    if (this.interactAnimTimer > 0) {
      this.interactAnimTimer = Math.max(0, this.interactAnimTimer - dt);
    }

    // Handle active enter/exit vehicle transition animation
    if (this.vehicleTransition && this.vehicleTransition.active) {
      const vt = this.vehicleTransition;
      vt.progress = Math.min(1, vt.progress + dt / vt.duration);
      const t = 1 - Math.pow(1 - vt.progress, 3);
      const x = THREE.MathUtils.lerp(vt.fromX, vt.toX, t);
      const y = THREE.MathUtils.lerp(vt.fromY, vt.toY, t) + Math.sin(t * Math.PI) * 0.45;
      const z = THREE.MathUtils.lerp(vt.fromZ, vt.toZ, t);
      this.playerRig.root.position.set(x, y, z);
      this.animateHumanPose(this.playerRig, 'jump', 0, dt, 0);
      if (vt.progress >= 1) {
        vt.active = false;
        if (vt.entering) {
          this.finishEnterVehicle(vt.vehicle);
        } else {
          this.finishExitVehicle(vt.vehicle, vt.toX, vt.toZ);
        }
        this.vehicleTransition = null;
      }
      return;
    }

    if (interactPressed) {
      if (this.activeDialogue) {
        this.dismissDialogue();
        return;
      }
      const target = this.findNearestInteractable();
      if (target.kind === 'vehicle' && target.vehicle) {
        if (this.currentVehicle) {
          this.beginExitVehicle();
        } else {
          this.beginEnterVehicle(target.vehicle);
        }
        return;
      }
      if (target.kind === 'npc' && target.npc) {
        this.interactWithNpc(target.npc);
        return;
      }
      if (target.kind === 'kiosk' && target.kiosk) {
        this.stamina = 100;
        this.interactAnimTimer = 0.45;
        this.sound.playRefreshment();
        this.emitParticles(this.playerX, this.playerY + 1.2, this.playerZ, 10, 0x2dd4bf, 3.2);
        this.showBanner(`${target.kiosk.label}: Stamina Restored!`, 2.0);
        this.pushHudSnapshot();
        return;
      }
      if (target.kind === 'bench') {
        if (this.isSitting) {
          this.isSitting = false;
          this.animState = 'idle';
          this.showBanner('Stood up', 1.2);
        } else if (target.bench) {
          this.isSitting = true;
          this.playerX = target.bench.x;
          this.playerZ = target.bench.z;
          this.playerY = target.bench.y + 0.08;
          this.sittingYaw = target.bench.facingYaw;
          this.playerFacing = target.bench.facingYaw;
          this.animState = 'seated';
          this.sound.playDoorToggle(true);
          this.showBanner('Resting on bench — Move or press E to stand', 2.0);
        }
        this.pushHudSnapshot();
        return;
      }
    }

    if (this.currentVehicle) {
      this.updateDrivenVehicle(this.currentVehicle, dt);
      return;
    }

    // Read movement input
    let inX = 0;
    let inY = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) inY += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) inY -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) inX += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) inX -= 1;

    inX = Math.max(-1, Math.min(1, inX + this.touchInput.moveX));
    inY = Math.max(-1, Math.min(1, inY + this.touchInput.moveY));

    const move = computeCameraRelativeMove(inX, inY, this.camYaw);
    const isMoving = move.magnitude > 0.05;

    // Stand up from bench if player tries to move or jump
    if (this.isSitting) {
      if (isMoving || this.jumpJustPressed || this.touchInput.jumpJustPressed) {
        this.isSitting = false;
      } else {
        this.stamina = Math.min(100, this.stamina + 28 * dt);
        this.animState = 'seated';
        this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
        this.playerRig.root.rotation.y = this.sittingYaw;
        this.animateHumanPose(this.playerRig, 'seated', 0, dt, 0);
        this.sound.updateEngine(false, 0, false);
        return;
      }
    }

    if (isMoving && this.activeDialogue) {
      this.dismissDialogue();
    }

    const wantSprint =
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight') ||
      this.touchInput.sprint;

    const isSprinting = isMoving && wantSprint && this.stamina > 4;

    if (isSprinting) {
      this.stamina = Math.max(0, this.stamina - 24 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 18 * dt);
    }

    const baseSpeed = isSprinting ? 10.6 : 5.8;
    const targetSpeed = baseSpeed * move.magnitude;
    const prevX = this.playerX;
    const prevZ = this.playerZ;

    if (isMoving) {
      const nextX = this.playerX + move.dirX * targetSpeed * dt;
      const nextZ = this.playerZ + move.dirZ * targetSpeed * dt;
      const resolved = resolveCircleColliders(nextX, nextZ, 0.55, this.city.colliders);
      this.playerX = resolved.x;
      this.playerZ = resolved.z;
      this.playerFacing = lerpAngle(this.playerFacing, move.facingYaw, 1 - Math.exp(-14 * dt));
    }

    const stepDist = Math.hypot(this.playerX - prevX, this.playerZ - prevZ);
    this.distanceTraveled += stepDist;

    if (this.jumpJustPressed || this.touchInput.jumpJustPressed) {
      this.jumpBufferTimer = 0.13;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    if (this.playerGrounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVy = 8.4;
      this.playerGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.landingSquash = -0.22;
      this.sound.playJump();
      this.emitParticles(this.playerX, this.playerY, this.playerZ, 5, 0xfef08a, 2.5);
    }

    const floorY = groundHeightAt(this.playerX, this.playerZ);
    if (!this.playerGrounded || this.playerY > floorY + 0.02) {
      this.playerVy -= 21 * dt;
      this.playerY += this.playerVy * dt;
      if (this.playerY <= floorY) {
        if (this.playerVy < -3.5) {
          this.landingSquash = 0.24;
          this.sound.playLand();
          this.emitParticles(this.playerX, floorY, this.playerZ, 6, 0xe2e8f0, 2.6);
        }
        this.playerY = floorY;
        this.playerVy = 0;
        this.playerGrounded = true;
      }
    } else {
      this.playerY = THREE.MathUtils.damp(this.playerY, floorY, 18, dt);
      this.playerGrounded = true;
    }

    // Determine exact character animation state
    if (!this.playerGrounded) {
      this.animState = 'jump';
    } else if (this.interactAnimTimer > 0) {
      this.animState = 'interact';
    } else if (stepDist > 0.004) {
      this.animState = isSprinting ? 'run' : 'walk';
      this.walkPhase += stepDist * (isSprinting ? 2.15 : 2.65);
    } else {
      this.animState = 'idle';
    }

    this.animateHumanPose(this.playerRig, this.animState, this.walkPhase, dt, 0);
    if (isMoving && this.playerGrounded) {
      this.sound.playFootstep(isSprinting);
    }
    this.sound.updateEngine(false, 0, false);

    this.landingSquash = THREE.MathUtils.damp(this.landingSquash, 0, 12, dt);
    const sy = 1 - this.landingSquash * 0.65;
    const sxz = 1 + this.landingSquash * 0.45;
    this.playerRig.root.scale.set(sxz, sy, sxz);
    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.root.rotation.y = this.playerFacing;
  }

  private interactWithNpc(npc: PedestrianActor): void {
    this.talkingNpc = npc;
    npc.activity = 'talk';
    npc.activityTimer = 8;
    npc.yaw = Math.atan2(this.playerX - npc.x, this.playerZ - npc.z);
    this.playerFacing = Math.atan2(npc.x - this.playerX, npc.z - this.playerZ);
    this.interactAnimTimer = 0.4;
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
    this.activeDialogue = {
      npcName: npc.name,
      role: npc.role,
      line,
      hint: npc.hint,
    };
    this.sound.playDialogueOpen();
    this.pushHudSnapshot();
  }

  private animateHumanPose(
    rig: HumanRig,
    state: CharacterAnimState,
    phase: number,
    dt: number,
    steerHint: number,
  ): void {
    if (state === 'seated') {
      rig.hips.position.y = THREE.MathUtils.damp(rig.hips.position.y, 0.56, 16, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, 0.08, 14, dt);
      rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, -1.35, 16, dt);
      rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, -1.35, 16, dt);
      rig.leftShin.rotation.x = THREE.MathUtils.damp(rig.leftShin.rotation.x, 1.35, 16, dt);
      rig.rightShin.rotation.x = THREE.MathUtils.damp(rig.rightShin.rotation.x, 1.35, 16, dt);
      // Reach forward if steering
      const armPitch = steerHint !== 0 ? -0.95 : -0.32;
      const forearmBend = steerHint !== 0 ? -0.45 : -0.65;
      rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, armPitch + steerHint * 0.16, 14, dt);
      rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, armPitch - steerHint * 0.16, 14, dt);
      rig.leftForearm.rotation.x = THREE.MathUtils.damp(rig.leftForearm.rotation.x, forearmBend, 14, dt);
      rig.rightForearm.rotation.x = THREE.MathUtils.damp(rig.rightForearm.rotation.x, forearmBend, 14, dt);
      rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, -steerHint * 0.25, 10, dt);
      return;
    }

    if (state === 'jump') {
      rig.hips.position.y = THREE.MathUtils.damp(rig.hips.position.y, 0.9, 14, dt);
      rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, -0.45, 14, dt);
      rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0.35, 14, dt);
      rig.leftShin.rotation.x = THREE.MathUtils.damp(rig.leftShin.rotation.x, 0.85, 14, dt);
      rig.rightShin.rotation.x = THREE.MathUtils.damp(rig.rightShin.rotation.x, 0.45, 14, dt);
      rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.85, 14, dt);
      rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -0.65, 14, dt);
      rig.leftForearm.rotation.x = THREE.MathUtils.damp(rig.leftForearm.rotation.x, -0.45, 14, dt);
      rig.rightForearm.rotation.x = THREE.MathUtils.damp(rig.rightForearm.rotation.x, -0.45, 14, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, 0.12, 12, dt);
      return;
    }

    if (state === 'interact') {
      rig.hips.position.y = THREE.MathUtils.damp(rig.hips.position.y, 0.9, 14, dt);
      rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -1.05, 16, dt);
      rig.rightForearm.rotation.x = THREE.MathUtils.damp(rig.rightForearm.rotation.x, -0.55, 16, dt);
      rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.15, 14, dt);
      rig.leftForearm.rotation.x = THREE.MathUtils.damp(rig.leftForearm.rotation.x, -0.25, 14, dt);
      rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0, 14, dt);
      rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0, 14, dt);
      rig.leftShin.rotation.x = THREE.MathUtils.damp(rig.leftShin.rotation.x, 0.05, 14, dt);
      rig.rightShin.rotation.x = THREE.MathUtils.damp(rig.rightShin.rotation.x, 0.05, 14, dt);
      return;
    }

    if (state === 'walk' || state === 'run') {
      const sprinting = state === 'run';
      const swing = sprinting ? 0.82 : 0.56;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      rig.leftLeg.rotation.x = s * swing;
      rig.rightLeg.rotation.x = -s * swing;
      // Knee bends smoothly on backswing & lift
      rig.leftShin.rotation.x = Math.max(0.06, -c * (sprinting ? 0.95 : 0.58));
      rig.rightShin.rotation.x = Math.max(0.06, c * (sprinting ? 0.95 : 0.58));

      rig.leftArm.rotation.x = -s * swing * 0.82;
      rig.rightArm.rotation.x = s * swing * 0.82;
      rig.leftForearm.rotation.x = THREE.MathUtils.damp(
        rig.leftForearm.rotation.x,
        sprinting ? -0.95 : -0.35,
        14,
        dt,
      );
      rig.rightForearm.rotation.x = THREE.MathUtils.damp(
        rig.rightForearm.rotation.x,
        sprinting ? -0.95 : -0.35,
        14,
        dt,
      );

      rig.hips.position.y = 0.9 + Math.abs(c) * (sprinting ? 0.065 : 0.032);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, sprinting ? 0.18 : 0.06, 12, dt);
      rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, 0, 10, dt);
      return;
    }

    // Idle
    const breathe = Math.sin(this.elapsedSec * 2.2) * 0.028;
    rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0, 12, dt);
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0, 12, dt);
    rig.leftShin.rotation.x = THREE.MathUtils.damp(rig.leftShin.rotation.x, 0.04, 12, dt);
    rig.rightShin.rotation.x = THREE.MathUtils.damp(rig.rightShin.rotation.x, 0.04, 12, dt);
    rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, breathe, 10, dt);
    rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -breathe, 10, dt);
    rig.leftForearm.rotation.x = THREE.MathUtils.damp(rig.leftForearm.rotation.x, -0.14, 10, dt);
    rig.rightForearm.rotation.x = THREE.MathUtils.damp(rig.rightForearm.rotation.x, -0.14, 10, dt);
    rig.hips.position.y = THREE.MathUtils.damp(rig.hips.position.y, 0.9, 12, dt);
    rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, 0, 12, dt);
    rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, Math.sin(this.elapsedSec * 0.7) * 0.08, 6, dt);
  }

  private findNearestVehicle(maxDist: number): VehicleActor | null {
    let best: VehicleActor | null = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  private beginEnterVehicle(v: VehicleActor): void {
    this.isSitting = false;
    this.activeDialogue = null;
    v.isTraffic = false;
    v.speed = 0;
    this.sound.playDoorToggle(true);
    this.vehicleTransition = {
      active: true,
      entering: true,
      vehicle: v,
      progress: 0,
      duration: 0.28,
      fromX: this.playerX,
      fromY: this.playerY,
      fromZ: this.playerZ,
      toX: v.x,
      toY: v.y + 0.5,
      toZ: v.z,
    };
  }

  private finishEnterVehicle(v: VehicleActor): void {
    this.currentVehicle = v;
    this.animState = 'seated';
    if (v.rig.driverSeatOffset) {
      v.rig.chassis.add(this.playerRig.root);
      this.playerRig.root.position.set(
        v.rig.driverSeatOffset.x,
        v.rig.driverSeatOffset.y,
        v.rig.driverSeatOffset.z,
      );
      this.playerRig.root.rotation.set(0, 0, 0);
      this.playerRig.root.scale.set(0.92, 0.92, 0.92);
      this.playerRig.shadowDisc.visible = false;
      this.playerRig.root.visible = true;
    } else {
      this.playerRig.root.visible = false;
    }
    this.showBanner(`Driving ${v.name}`, 1.8);
    this.camYaw = v.heading + Math.PI;
    this.pushHudSnapshot();
  }

  private beginExitVehicle(): void {
    const v = this.currentVehicle;
    if (!v) return;
    if (this.playerRig.root.parent !== this.scene) {
      this.scene.add(this.playerRig.root);
    }
    this.playerRig.root.scale.set(1, 1, 1);
    this.playerRig.shadowDisc.visible = true;
    this.playerRig.root.visible = true;

    const sideOffset = v.type === 'bus' ? 2.2 : 1.7;
    const rawExitX = v.x + Math.cos(v.heading) * sideOffset;
    const rawExitZ = v.z - Math.sin(v.heading) * sideOffset;
    const resolved = resolveCircleColliders(rawExitX, rawExitZ, 0.55, this.city.colliders);
    const exitY = groundHeightAt(resolved.x, resolved.z);

    v.speed *= 0.2;
    this.currentVehicle = null;
    this.sound.playDoorToggle(false);
    this.sound.updateEngine(false, 0, false);

    this.vehicleTransition = {
      active: true,
      entering: false,
      vehicle: v,
      progress: 0,
      duration: 0.25,
      fromX: v.x,
      fromY: v.y + 0.5,
      fromZ: v.z,
      toX: resolved.x,
      toY: exitY,
      toZ: resolved.z,
    };
  }

  private finishExitVehicle(v: VehicleActor, exitX: number, exitZ: number): void {
    this.playerX = exitX;
    this.playerZ = exitZ;
    this.playerY = groundHeightAt(this.playerX, this.playerZ);
    this.playerVy = 0;
    this.playerGrounded = true;
    this.playerFacing = v.heading;
    this.animState = 'idle';
    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.root.rotation.y = this.playerFacing;
    this.pushHudSnapshot();
  }

  private updateDrivenVehicle(v: VehicleActor, dt: number): void {
    let throttle = 0;
    let brake = 0;
    let steer = 0;

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) throttle = 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) brake = 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) steer += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) steer -= 1;

    throttle = Math.max(throttle, this.touchInput.throttle);
    brake = Math.max(brake, this.touchInput.brake);
    steer = Math.max(-1, Math.min(1, steer + this.touchInput.steer));

    if (this.hornJustPressed || this.touchInput.hornPressed) {
      this.sound.playHorn(v.type === 'bus');
      this.alertNearbyPedestrians(v.x, v.z, 18);
    }

    const prevX = v.x;
    const prevZ = v.z;
    const next = stepVehicleKinematics(
      { x: v.x, z: v.z, heading: v.heading, speed: v.speed },
      {
        throttle,
        brake,
        steer,
        maxSpeed: v.maxSpeed,
        accel: v.accel,
        turnRate: v.turnRate,
      },
      dt,
    );

    const resolved = resolveCircleColliders(next.x, next.z, v.radius, this.city.colliders);
    if (resolved.collided && Math.abs(next.speed) > 8) {
      this.camShakeTrauma = Math.min(0.6, this.camShakeTrauma + 0.35);
      this.emitParticles(resolved.x, v.y + 0.4, resolved.z, 8, 0xfbbf24, 4.5);
    }
    v.x = resolved.x;
    v.z = resolved.z;
    v.heading = next.heading;
    v.speed = resolved.collided ? next.speed * 0.35 : next.speed;

    const frontY = groundHeightAt(v.x + Math.sin(v.heading) * 1.4, v.z + Math.cos(v.heading) * 1.4);
    const rearY = groundHeightAt(v.x - Math.sin(v.heading) * 1.4, v.z - Math.cos(v.heading) * 1.4);
    v.y = THREE.MathUtils.damp(v.y, groundHeightAt(v.x, v.z), 18, dt);
    const slopePitch = Math.atan2(rearY - frontY, 2.8);

    v.rig.root.position.set(v.x, v.y, v.z);
    v.rig.root.rotation.y = v.heading;
    v.rig.chassis.rotation.x = THREE.MathUtils.damp(v.rig.chassis.rotation.x, slopePitch, 10, dt);

    const lean = steer * Math.min(1, Math.abs(v.speed) / 14) * (v.type === 'moto' ? -0.24 : 0.06);
    v.rig.chassis.rotation.z = THREE.MathUtils.damp(v.rig.chassis.rotation.z, lean, 10, dt);

    v.wheelSpin += v.speed * dt * 2.4;
    for (const w of v.rig.wheels) w.rotation.x = v.wheelSpin;
    v.steerVisual = THREE.MathUtils.damp(v.steerVisual, -steer * 0.42, 12, dt);
    for (const p of v.rig.frontSteerPivots) p.rotation.y = v.steerVisual;
    if (v.rig.steeringWheel && v.type === 'coupe') {
      v.rig.steeringWheel.rotation.z = -steer * 0.65;
    }

    // Brake taillight brightness
    for (const tm of v.rig.taillightMats) {
      tm.emissiveIntensity = brake > 0.1 ? 1.8 : 0.55;
    }

    // Animate visible seated driver in convertible / on motorcycle
    if (v.rig.driverSeatOffset) {
      this.animateHumanPose(this.playerRig, 'seated', 0, dt, steer || 0.01);
    }

    this.distanceTraveled += Math.hypot(v.x - prevX, v.z - prevZ);
    this.playerX = v.x;
    this.playerY = v.y;
    this.playerZ = v.z;
    this.playerFacing = v.heading;
    this.animState = 'seated';

    if (!this.draggingCamera && Math.abs(v.speed) > 2) {
      const targetCamYaw = v.heading + Math.PI;
      this.camYaw = lerpAngle(this.camYaw, targetCamYaw, 1 - Math.exp(-3.2 * dt));
    }

    this.sound.updateEngine(true, v.speed / v.maxSpeed, v.type === 'moto');
  }

  private alertNearbyPedestrians(cx: number, cz: number, radius: number): void {
    for (const p of this.pedestrians) {
      if (p.isStationaryConcierge) continue;
      if (Math.hypot(p.x - cx, p.z - cz) < radius) {
        p.hurryTimer = 2.8;
        p.activity = 'hurry';
      }
    }
  }

  private updateTraffic(dt: number): void {
    const signals = getTrafficSignalState(this.elapsedSec);

    for (const v of this.vehicles) {
      if (!v.isTraffic || v === this.currentVehicle) continue;

      const distPlayer = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
      let shouldBrake = distPlayer < 7.5 && !this.currentVehicle;

      // Obey 4-way traffic light signals before entering signalized intersections
      for (const tl of this.city.trafficSignals) {
        if (v.trafficAxis === 'ns' && Math.abs(v.x - tl.x) < 7) {
          const distBefore = (tl.z - v.z) * v.trafficDir;
          if (distBefore > 7.5 && distBefore < 16 && !signals.nsGreen) {
            shouldBrake = true;
            break;
          }
        } else if (v.trafficAxis === 'ew' && Math.abs(v.z - tl.z) < 7) {
          const distBefore = (tl.x - v.x) * v.trafficDir;
          if (distBefore > 7.5 && distBefore < 16 && !signals.ewGreen) {
            shouldBrake = true;
            break;
          }
        }
      }

      // Check other vehicles ahead in same lane
      if (!shouldBrake) {
        for (const other of this.vehicles) {
          if (other === v) continue;
          const dx = other.x - v.x;
          const dz = other.z - v.z;
          const forwardDot = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
          const sideDist = Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading));
          if (forwardDot > 0 && forwardDot < 13 && sideDist < 3.0) {
            shouldBrake = true;
            break;
          }
        }
      }

      const targetSpd = shouldBrake ? 0 : v.type === 'bus' ? 8.5 : 11.5;
      v.speed = THREE.MathUtils.damp(v.speed, targetSpd, 4.5, dt);
      for (const tm of v.rig.taillightMats) {
        tm.emissiveIntensity = shouldBrake ? 1.6 : 0.5;
      }

      if (v.trafficAxis === 'ns') {
        v.z += v.trafficDir * v.speed * dt;
        v.x = THREE.MathUtils.damp(v.x, v.trafficLaneCoord, 6, dt);
        if (v.z > 128) v.z = -128;
        if (v.z < -128) v.z = 128;
      } else {
        v.x += v.trafficDir * v.speed * dt;
        v.z = THREE.MathUtils.damp(v.z, v.trafficLaneCoord, 6, dt);
        if (v.x > BEACH_START_X - 4) v.x = -128;
        if (v.x < -128) v.x = BEACH_START_X - 4;
      }

      v.y = groundHeightAt(v.x, v.z);
      v.rig.root.position.set(v.x, v.y, v.z);
      v.rig.root.rotation.y = v.heading;
      v.wheelSpin += v.speed * dt * 2.4;
      for (const w of v.rig.wheels) w.rotation.x = v.wheelSpin;
    }
  }

  private updatePedestrians(dt: number): void {
    const signals = getTrafficSignalState(this.elapsedSec);

    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];

      if (p.isStationaryConcierge) {
        p.rig.root.rotation.y = lerpAngle(p.rig.root.rotation.y, p.yaw, 1 - Math.exp(-8 * dt));
        this.animateHumanPose(p.rig, p.activity === 'talk' ? 'interact' : 'idle', 0, dt, 0);
        continue;
      }

      if (p.socialCooldown > 0) {
        p.socialCooldown = Math.max(0, p.socialCooldown - dt);
      }

      if (p.hurryTimer > 0) {
        p.hurryTimer -= dt;
        if (p.hurryTimer <= 0 && p.activity === 'hurry') {
          p.activity = 'walk';
        }
      }

      if (p.activity === 'talk' || p.activity === 'idle_look' || p.activity === 'sit') {
        p.activityTimer -= dt;
        p.rig.root.position.set(p.x, p.y, p.z);
        p.rig.root.rotation.y = lerpAngle(p.rig.root.rotation.y, p.yaw, 1 - Math.exp(-8 * dt));
        const pose: CharacterAnimState =
          p.activity === 'sit'
            ? 'seated'
            : p.activity === 'talk' && Math.sin(this.elapsedSec * 2.5 + i) > 0.55
              ? 'interact'
              : 'idle';
        this.animateHumanPose(p.rig, pose, p.walkPhase, dt, 0);
        if (p.activityTimer <= 0) {
          if (p.activity === 'sit') {
            p.x += Math.sin(p.yaw) * 0.95;
            p.z += Math.cos(p.yaw) * 0.95;
            p.y = groundHeightAt(p.x, p.z);
            p.occupiedBenchId = null;
          }
          p.socialCooldown = 12 + Math.random() * 8;
          p.activity = 'walk';
          if (this.talkingNpc === p) {
            this.activeDialogue = null;
            this.talkingNpc = null;
          }
        }
        continue;
      }

      // Hurry if vehicle approaches closely
      for (const v of this.vehicles) {
        if (Math.abs(v.speed) > 4 && Math.hypot(v.x - p.x, v.z - p.z) < 5.5) {
          p.hurryTimer = 2.0;
          p.activity = 'hurry';
          break;
        }
      }

      // Friendly sidewalk pair chat for socializers / strollers
      if (
        p.hurryTimer <= 0 &&
        p.socialCooldown <= 0 &&
        (p.personality === 'socializer' || p.personality === 'stroller') &&
        !isOnRoadAsphalt(p.x, p.z)
      ) {
        let partner: PedestrianActor | null = null;
        for (let j = i + 1; j < this.pedestrians.length; j++) {
          const other = this.pedestrians[j];
          if (
            other.isStationaryConcierge ||
            other.activity !== 'walk' ||
            other.hurryTimer > 0 ||
            other.socialCooldown > 0 ||
            isOnRoadAsphalt(other.x, other.z)
          ) {
            continue;
          }
          if (Math.hypot(other.x - p.x, other.z - p.z) < 1.85) {
            partner = other;
            break;
          }
        }
        if (partner) {
          const dur = 2.6 + Math.random() * 1.4;
          p.activity = 'talk';
          p.activityTimer = dur;
          p.yaw = Math.atan2(partner.x - p.x, partner.z - p.z);
          partner.activity = 'talk';
          partner.activityTimer = dur;
          partner.yaw = Math.atan2(p.x - partner.x, p.z - partner.z);
          continue;
        }
      }

      const targetNode = this.pedGraph[p.targetNodeId];
      const dx = targetNode.x - p.x;
      const dz = targetNode.z - p.z;
      const distToTarget = Math.hypot(dx, dz);

      // Crosswalk signal check before leaving curb
      const crossing = getCrossingRoadAxis(p.x, p.z, targetNode.x, targetNode.z);
      if (crossing && distToTarget > 2.0 && distToTarget < 15 && !canPedestrianCross(crossing, signals) && p.hurryTimer <= 0) {
        p.activity = 'wait_crosswalk';
        p.yaw = Math.atan2(dx, dz);
        p.rig.root.rotation.y = lerpAngle(p.rig.root.rotation.y, p.yaw, 1 - Math.exp(-8 * dt));
        this.animateHumanPose(p.rig, 'idle', p.walkPhase, dt, 0);
        continue;
      } else if (p.activity === 'wait_crosswalk') {
        p.activity = 'walk';
      }

      if (distToTarget < 0.85) {
        p.prevNodeId = p.currentNodeId;
        p.currentNodeId = p.targetNodeId;
        p.targetNodeId = chooseNextWaypoint(
          this.pedGraph,
          p.currentNodeId,
          p.prevNodeId,
          p.personality,
        );

        // Occasional bench sitting or scenic idle look at bench waypoints
        if (this.pedGraph[p.currentNodeId].isBenchSpot && p.personality !== 'jogger' && p.socialCooldown <= 0) {
          const nearBench = this.city.benches.find(
            (b) =>
              Math.hypot(b.x - p.x, b.z - p.z) < 6.5 &&
              !this.pedestrians.some((other) => other.occupiedBenchId === b.id),
          );
          if (nearBench && Math.random() < 0.45) {
            p.occupiedBenchId = nearBench.id;
            p.x = nearBench.x;
            p.z = nearBench.z;
            p.y = nearBench.y + 0.08;
            p.yaw = nearBench.facingYaw;
            p.activity = 'sit';
            p.activityTimer = 4.5 + Math.random() * 3.0;
            continue;
          }
          if (Math.random() < 0.3) {
            p.activity = 'idle_look';
            p.activityTimer = 2.6 + Math.random() * 2.2;
            continue;
          }
        }
      }

      // Compute steering vector toward target + gentle separation from nearby pedestrians
      let dirX = distToTarget > 0.01 ? dx / distToTarget : 0;
      let dirZ = distToTarget > 0.01 ? dz / distToTarget : 0;

      for (let j = 0; j < this.pedestrians.length; j++) {
        if (i === j) continue;
        const other = this.pedestrians[j];
        const sx = p.x - other.x;
        const sz = p.z - other.z;
        const dSq = sx * sx + sz * sz;
        if (dSq > 0.001 && dSq < 2.2) {
          const d = Math.sqrt(dSq);
          const push = (1.5 - d) * 0.9;
          dirX += (sx / d) * push;
          dirZ += (sz / d) * push;
        }
      }

      const dLen = Math.hypot(dirX, dirZ) || 1;
      dirX /= dLen;
      dirZ /= dLen;

      const spd = p.baseSpeed * (p.hurryTimer > 0 ? 1.75 : 1.0);
      const step = spd * dt;
      const nextX = p.x + dirX * step;
      const nextZ = p.z + dirZ * step;
      const resolved = resolveCircleColliders(nextX, nextZ, 0.45, this.city.colliders);
      p.x = resolved.x;
      p.z = resolved.z;
      p.y = groundHeightAt(p.x, p.z);
      p.yaw = Math.atan2(dirX, dirZ);

      // Stuck recovery
      p.stuckTimer += dt;
      if (p.stuckTimer > 1.8) {
        const moved = Math.hypot(p.x - p.lastCheckX, p.z - p.lastCheckZ);
        p.lastCheckX = p.x;
        p.lastCheckZ = p.z;
        p.stuckTimer = 0;
        if (moved < 0.4) {
          p.targetNodeId = chooseNextWaypoint(this.pedGraph, p.currentNodeId, p.targetNodeId, p.personality);
        }
      }

      p.rig.root.position.set(p.x, p.y, p.z);
      p.rig.root.rotation.y = lerpAngle(p.rig.root.rotation.y, p.yaw, 1 - Math.exp(-10 * dt));

      p.walkPhase += step * (p.personality === 'jogger' ? 2.1 : 2.5);
      this.animateHumanPose(
        p.rig,
        p.personality === 'jogger' || p.hurryTimer > 0 ? 'run' : 'walk',
        p.walkPhase,
        dt,
        0,
      );
    }
  }

  private updateObjectivesAndStars(_dt: number): void {
    // Custom waypoint arrival check
    if (this.customWaypoint) {
      const cwDist = Math.hypot(this.playerX - this.customWaypoint.x, this.playerZ - this.customWaypoint.z);
      if (cwDist < 4.5) {
        this.setCustomWaypoint(null, null);
        this.sound.playCheckpoint();
        this.showBanner('Custom Waypoint Reached!', 2.0);
      }
    }

    // Golden stars collection
    for (const s of this.stars) {
      if (s.collected) continue;
      if (Math.hypot(this.playerX - s.x, this.playerZ - s.z) < 2.6) {
        s.collected = true;
        s.mesh.visible = false;
        this.starsCollected++;
        this.cash += 150;
        this.sound.playStarPickup();
        this.emitParticles(s.x, s.y + 1, s.z, 14, 0xfacc15, 5.5);
        this.showBanner(`Golden Palm Star Collected! +$150`, 2.2);
        this.saveGame(true);
        this.pushHudSnapshot();
      }
    }

    // Active Mission Checkpoint
    const mission = CAMPAIGN_MISSIONS[this.missionIdx];
    if (!mission) return;
    const cp = mission.checkpoints[this.checkpointIdx];
    if (!cp) return;

    const dist = Math.hypot(this.playerX - cp.x, this.playerZ - cp.z);
    if (dist <= cp.radius) {
      if (cp.requireVehicle && !this.currentVehicle) {
        this.showBanner('Drive a vehicle through this checkpoint!', 1.5);
        return;
      }

      this.emitParticles(cp.x, groundHeightAt(cp.x, cp.z) + 1.2, cp.z, 18, 0xf43f5e, 6.2);
      if (this.checkpointIdx + 1 < mission.checkpoints.length) {
        this.checkpointIdx++;
        this.sound.playCheckpoint();
        this.updateCheckpointBeaconVisual();
        this.showBanner(`Checkpoint Reached!`, 1.8);
      } else {
        this.cash += mission.reward;
        this.missionsCompleted++;
        this.sound.playMissionComplete();

        if (this.missionIdx + 1 < CAMPAIGN_MISSIONS.length) {
          this.missionIdx++;
          this.checkpointIdx = 0;
          this.updateCheckpointBeaconVisual();
          this.showBanner(`Mission Complete! +$${mission.reward} — Next: ${CAMPAIGN_MISSIONS[this.missionIdx].title}`, 3.6);
        } else {
          this.checkpointGroup.visible = false;
          this.saveGame(true);
          this.setMode('gameover');
          return;
        }
      }
      this.saveGame(true);
      this.pushHudSnapshot();
    }
  }

  private updateCheckpointBeaconVisual(): void {
    const mission = CAMPAIGN_MISSIONS[this.missionIdx];
    const cp = mission?.checkpoints[this.checkpointIdx];
    if (!cp || this.mode === 'title') {
      this.checkpointGroup.visible = false;
      return;
    }
    this.checkpointGroup.visible = true;
    const y = groundHeightAt(cp.x, cp.z);
    this.checkpointGroup.position.set(cp.x, y, cp.z);
  }

  private updateParticles(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummyObj.position.set(0, -50, 0);
        _dummyObj.scale.setScalar(0.001);
        _dummyObj.updateMatrix();
        this.particlesMesh.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = 1 - p.life / p.maxLife;
      _dummyObj.position.set(p.x, p.y, p.z);
      _dummyObj.rotation.set(p.life * 6, p.life * 4, 0);
      _dummyObj.scale.setScalar(p.size * t);
      _dummyObj.updateMatrix();
      this.particlesMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    if (anyActive) {
      this.particlesMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateGameplayCamera(dt: number): void {
    const inVeh = this.currentVehicle !== null;
    const targetX = inVeh ? this.currentVehicle!.x : this.playerX;
    const targetY = inVeh ? this.currentVehicle!.y + 1.55 : this.playerY + 1.45;
    const targetZ = inVeh ? this.currentVehicle!.z : this.playerZ;

    const interiorCeiling = inVeh ? null : getInteriorCeilingHeight(targetX, targetZ);
    const baseDist = inVeh
      ? this.currentVehicle!.type === 'bus'
        ? 11.5
        : 8.2
      : interiorCeiling !== null
        ? 3.4
        : 5.4;
    const clampedPitch = interiorCeiling !== null ? Math.min(this.camPitch, 0.38) : this.camPitch;
    const cosP = Math.cos(clampedPitch);
    const sinP = Math.sin(clampedPitch);

    _camTarget.set(targetX, targetY, targetZ);
    _camDesired.set(
      targetX + Math.sin(this.camYaw) * cosP * baseDist,
      targetY + sinP * baseDist,
      targetZ + Math.cos(this.camYaw) * cosP * baseDist,
    );

    _rayOrigin.copy(_camTarget);
    _rayDir.subVectors(_camDesired, _rayOrigin);
    const desiredDist = _rayDir.length();
    if (desiredDist > 0.1) {
      _rayDir.divideScalar(desiredDist);
      this.raycaster.set(_rayOrigin, _rayDir);
      this.raycaster.near = 0.4;
      this.raycaster.far = desiredDist;
      const hits = this.raycaster.intersectObjects(this.city.raycastWalls, false);
      if (hits.length > 0 && hits[0].distance < desiredDist) {
        const pullDist = Math.max(1.5, hits[0].distance - 0.5);
        _camDesired.copy(_rayOrigin).addScaledVector(_rayDir, pullDist);
      }
    }

    const camGround = groundHeightAt(_camDesired.x, _camDesired.z);
    if (_camDesired.y < camGround + 0.65) {
      _camDesired.y = camGround + 0.65;
    }
    const camCeiling = getInteriorCeilingHeight(_camDesired.x, _camDesired.z);
    if (camCeiling !== null && _camDesired.y > camCeiling - 0.6) {
      _camDesired.y = camCeiling - 0.6;
    }

    const dampK = 1 - Math.exp(-12 * dt);
    this.camCurrentPos.lerp(_camDesired, dampK);
    this.camCurrentLook.lerp(_camTarget, 1 - Math.exp(-16 * dt));

    this.camera.position.copy(this.camCurrentPos);

    if (this.camShakeTrauma > 0.001) {
      const shake = this.camShakeTrauma * this.camShakeTrauma * 0.45;
      this.camera.position.x += (Math.random() * 2 - 1) * shake;
      this.camera.position.y += (Math.random() * 2 - 1) * shake;
      this.camShakeTrauma = Math.max(0, this.camShakeTrauma - dt * 1.8);
    }

    this.camera.lookAt(this.camCurrentLook);

    const speedRatio = inVeh ? Math.min(1, Math.abs(this.currentVehicle!.speed) / 30) : 0;
    const targetFov = 58 + speedRatio * 10;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 8, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private pushHudSnapshot(): void {
    const mission = CAMPAIGN_MISSIONS[this.missionIdx];
    const cp = mission?.checkpoints[this.checkpointIdx] ?? null;
    const dayInfo = getDayNightParams(this.timeNormalized);
    const interact = this.findNearestInteractable();

    const nearbyVehicles: MinimapEntity[] = this.vehicles.map((v) => ({
      x: v.x,
      z: v.z,
      yaw: v.heading,
      kind: v.type,
    }));

    for (const s of this.stars) {
      if (!s.collected) {
        nearbyVehicles.push({ x: s.x, z: s.z, yaw: 0, kind: 'star' });
      }
    }

    this.onHudUpdate({
      mode: this.mode,
      cash: this.cash,
      missionsCompleted: this.missionsCompleted,
      totalMissions: CAMPAIGN_MISSIONS.length,
      starsCollected: this.starsCollected,
      totalStars: GOLDEN_STARS.length,
      distanceTraveled: Math.round(this.distanceTraveled),
      activeMissionTitle: mission ? mission.title : 'Free Roam',
      activeObjectiveLabel: cp ? cp.label : 'Explore Solana Bay',
      checkpointIndex: this.checkpointIdx,
      checkpointTotal: mission ? mission.checkpoints.length : 0,
      checkpointDist: cp ? Math.round(Math.hypot(this.playerX - cp.x, this.playerZ - cp.z)) : 0,
      inVehicle: this.currentVehicle !== null,
      vehicleName: this.currentVehicle ? this.currentVehicle.name : '',
      vehicleType: this.currentVehicle ? this.currentVehicle.type : null,
      speedKmh: this.currentVehicle ? Math.round(Math.abs(this.currentVehicle.speed) * 4.2) : 0,
      stamina: Math.round(this.stamina),
      animState: this.animState,
      interactPrompt: interact.prompt,
      interactKind: interact.kind,
      timeOfDayNormalized: this.timeNormalized,
      timeLabel: dayInfo.label,
      weatherMode: this.weatherMode,
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerYaw: this.camYaw,
      waypointX: cp ? cp.x : null,
      waypointZ: cp ? cp.z : null,
      customWaypoint: this.customWaypoint,
      bannerText: this.bannerText,
      fpsEstimate: this.fpsEstimate,
      nearbyVehicles,
      activeDialogue: this.activeDialogue,
      isSitting: this.isSitting,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    this.sound.dispose();
    this.textures.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const disposeMat = (mat: THREE.Material) => {
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          mat.dispose();
        };
        if (Array.isArray(m.material)) m.material.forEach(disposeMat);
        else if (m.material) disposeMat(m.material);
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
