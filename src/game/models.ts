import * as THREE from 'three';
import type { VehicleType } from './types';

export interface HumanRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  shadowDisc: THREE.Mesh;
}

export interface VehicleRig {
  root: THREE.Group;
  chassis: THREE.Group;
  wheels: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
  steeringWheel: THREE.Object3D | null;
  driverSeatOffset: { x: number; y: number; z: number } | null;
  headlightMats: THREE.MeshStandardMaterial[];
  taillightMats: THREE.MeshStandardMaterial[];
  shadowDisc: THREE.Mesh;
}

const SKIN_TONES = [0xd89d76, 0xb87650, 0x8a5234, 0xe8b896, 0xc78862];
const SHIRT_COLORS = [0x14b8a6, 0xf43f5e, 0x38bdf8, 0xfbbf24, 0xa855f7, 0xfb7185];
const PANTS_COLORS = [0xf1f5f9, 0x1e293b, 0x334155, 0xd6cfc2, 0x0f172a];
const HAIR_COLORS = [0x1e1b18, 0x4a3123, 0x85583a, 0x0f172a, 0xd4a359];

export function createHumanRig(
  styleIndex: number,
  isPlayer: boolean,
  shadowTexture: THREE.Texture,
): HumanRig {
  const root = new THREE.Group();

  const skinColor = isPlayer ? 0xd99b72 : SKIN_TONES[styleIndex % SKIN_TONES.length];
  const shirtColor = isPlayer ? 0x0ea5e9 : SHIRT_COLORS[styleIndex % SHIRT_COLORS.length];
  const pantsColor = isPlayer ? 0xf8fafc : PANTS_COLORS[styleIndex % PANTS_COLORS.length];
  const hairColor = isPlayer ? 0x1e1b18 : HAIR_COLORS[styleIndex % HAIR_COLORS.length];

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.62, metalness: 0.02 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.82, metalness: 0.03 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.86, metalness: 0.02 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.15 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.52, metalness: 0.05 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.78, metalness: 0.05 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.12, metalness: 0.72 });

  // Ground contact shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.54, 18),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // Hips pivot at y = 0.90
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.15, 0.23), pantsMat);
  pelvisMesh.castShadow = isPlayer;
  hips.add(pelvisMesh);

  const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.385, 0.045, 0.245), beltMat);
  beltMesh.position.y = 0.065;
  hips.add(beltMesh);

  // Articulated legs with thigh + knee/shin pivot
  const buildLeg = (side: -1 | 1): { hip: THREE.Group; shin: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.05, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.41, 8), pantsMat);
    thigh.position.y = -0.205;
    thigh.castShadow = isPlayer;
    hip.add(thigh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.41, 0);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.064, 8, 6), pantsMat);
    shin.add(kneeCap);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.052, 0.36, 8), pantsMat);
    calf.position.y = -0.18;
    calf.castShadow = isPlayer;
    shin.add(calf);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.08, 0.23), shoeMat);
    shoe.position.set(0, -0.39, 0.04);
    shin.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.028, 0.24), soleMat);
    sole.position.set(0, -0.43, 0.04);
    shin.add(sole);

    hip.add(shin);
    return { hip, shin };
  };

  const leftLegParts = buildLeg(1);
  const rightLegParts = buildLeg(-1);
  const leftLeg = leftLegParts.hip;
  const rightLeg = rightLegParts.hip;
  const leftShin = leftLegParts.shin;
  const rightShin = rightLegParts.shin;
  hips.add(leftLeg, rightLeg);

  // Torso with tapered chest + rounded shoulders
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), shirtMat);
  waist.position.y = 0.1;
  waist.castShadow = isPlayer;
  torso.add(waist);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.25), shirtMat);
  chest.position.y = 0.36;
  chest.castShadow = isPlayer;
  torso.add(chest);

  const collarMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0xfef08a : 0xffffff,
    roughness: 0.78,
  });
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.26), collarMat);
  collar.position.set(0, 0.535, 0.01);
  torso.add(collar);

  if (isPlayer) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.095, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.78 }),
    );
    stripe.position.y = 0.35;
    torso.add(stripe);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.78 }),
    );
    pocket.position.set(-0.11, 0.39, 0.13);
    torso.add(pocket);
  }

  // Articulated arms with upper arm + elbow/forearm pivot
  const buildArm = (side: -1 | 1): { shoulder: THREE.Group; forearm: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.275, 0.48, 0);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), shirtMat);
    shoulder.add(shoulderCap);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.22, 8), shirtMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = isPlayer;
    shoulder.add(sleeve);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.24, 0);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), skinMat);
    forearm.add(elbow);

    const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.26, 8), skinMat);
    lowerArm.position.y = -0.13;
    lowerArm.castShadow = isPlayer;
    forearm.add(lowerArm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.095), skinMat);
    hand.position.y = -0.28;
    forearm.add(hand);

    shoulder.add(forearm);
    return { shoulder, forearm };
  };

  const leftArmParts = buildArm(1);
  const rightArmParts = buildArm(-1);
  const leftArm = leftArmParts.shoulder;
  const rightArm = rightArmParts.shoulder;
  const leftForearm = leftArmParts.forearm;
  const rightForearm = rightArmParts.forearm;
  torso.add(leftArm, rightArm);

  // Head with sculpted nose, ears, hair volume
  const head = new THREE.Group();
  head.position.y = 0.57;
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.074, 0.1, 10), skinMat);
  neck.position.y = 0.03;
  head.add(neck);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.245, 0.23), skinMat);
  skull.position.y = 0.19;
  skull.castShadow = isPlayer;
  head.add(skull);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.045), skinMat);
  nose.position.set(0, 0.18, 0.125);
  head.add(nose);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.095, 0.255), hairMat);
  hairTop.position.set(0, 0.305, -0.01);
  head.add(hairTop);

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.238, 0.17, 0.075), hairMat);
  hairBack.position.set(0, 0.22, -0.105);
  head.add(hairBack);

  if (isPlayer || styleIndex % 2 === 0) {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.035), visorMat);
    shades.position.set(0, 0.215, 0.118);
    head.add(shades);
  } else {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.02), eyeMat);
    eyeL.position.set(0.048, 0.215, 0.118);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.048;
    head.add(eyeL, eyeR);
  }

  return {
    root,
    hips,
    torso,
    head,
    leftArm,
    rightArm,
    leftForearm,
    rightForearm,
    leftLeg,
    rightLeg,
    leftShin,
    rightShin,
    shadowDisc,
  };
}

export function createVehicleRig(
  type: VehicleType,
  bodyColorHex: number,
  shadowTexture: THREE.Texture,
): VehicleRig {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);

  const wheels: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];
  const headlightMats: THREE.MeshStandardMaterial[] = [];
  const taillightMats: THREE.MeshStandardMaterial[] = [];
  let steeringWheel: THREE.Object3D | null = null;
  let driverSeatOffset: { x: number; y: number; z: number } | null = null;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: bodyColorHex,
    roughness: 0.24,
    metalness: 0.56,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
  });
  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0xf1e7d5,
    roughness: 0.72,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.45,
    transparent: true,
    opacity: 0.46,
  });
  const darkGlassMat = new THREE.MeshStandardMaterial({
    color: 0x162638,
    roughness: 0.12,
    metalness: 0.75,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.2,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.92,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.22,
    metalness: 0.85,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  headlightMats.push(headMat);

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 0.5,
    roughness: 0.25,
  });
  taillightMats.push(tailMat);

  const makeWheel = (radius: number, width: number): THREE.Group => {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, width, 16),
      tireMat,
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wGroup.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 12),
      rimMat,
    );
    rim.rotation.z = Math.PI / 2;
    wGroup.add(rim);
    return wGroup;
  };

  if (type === 'coupe') {
    // Ground contact shadow
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5.1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    root.add(shadow);

    // Open-Top Coastal Convertible Sports Coupe
    // Lower floorpan & sills
    const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 4.35), bodyMat);
    floorPan.position.set(0, 0.42, 0);
    floorPan.castShadow = true;
    floorPan.receiveShadow = true;
    chassis.add(floorPan);

    // Sculpted Front Hood (+Z)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.4, 1.55), bodyMat);
    hood.position.set(0, 0.72, 1.42);
    hood.castShadow = true;
    chassis.add(hood);

    // Rear Trunk Deck (-Z)
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.44, 1.25), bodyMat);
    trunk.position.set(0, 0.74, -1.55);
    trunk.castShadow = true;
    chassis.add(trunk);

    // Side Doors (leaving open cockpit between z = -0.9..0.65)
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 1.65), bodyMat);
      door.position.set(side * 0.87, 0.73, -0.14);
      door.castShadow = true;
      chassis.add(door);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), chromeMat);
      mirror.position.set(side * 1.02, 0.96, 0.45);
      chassis.add(mirror);
    }

    // Interior Cockpit Tub & Cream Leather Bucket Seats
    const cockpitFloor = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.08, 1.58), trimMat);
    cockpitFloor.position.set(0, 0.54, -0.14);
    chassis.add(cockpitFloor);

    for (const sx of [0.38, -0.38]) {
      const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.52), interiorMat);
      seatBase.position.set(sx, 0.62, -0.22);
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.14), interiorMat);
      seatBack.position.set(sx, 0.9, -0.45);
      seatBack.rotation.x = -0.2;
      chassis.add(seatBase, seatBack);
    }

    // Dashboard & Steering Wheel Pivot (left-hand drive x = +0.38 in +Z vehicle space)
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.24, 0.32), trimMat);
    dash.position.set(0, 0.84, 0.56);
    chassis.add(dash);

    const steerPivot = new THREE.Group();
    steerPivot.position.set(0.38, 0.92, 0.34);
    steerPivot.rotation.x = -0.35;
    const steerRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 18), trimMat);
    const steerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), chromeMat);
    steerHub.rotation.x = Math.PI / 2;
    steerPivot.add(steerRim, steerHub);
    chassis.add(steerPivot);
    steeringWheel = steerPivot;
    driverSeatOffset = { x: 0.38, y: 0.34, z: -0.16 };

    // Raked Windshield Frame & Twin Sport Roll Hoops
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.44, 0.05), glassMat);
    windshield.position.set(0, 1.08, 0.56);
    windshield.rotation.x = -0.52;
    const headerBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.05, 0.07), chromeMat);
    headerBar.position.set(0, 1.26, 0.45);
    chassis.add(windshield, headerBar);

    for (const hx of [0.38, -0.38]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 14, Math.PI), chromeMat);
      hoop.position.set(hx, 0.96, -0.62);
      chassis.add(hoop);
    }

    // Front & rear bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 0.22), trimMat);
    frontBumper.position.set(0, 0.36, 2.22);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 0.22), trimMat);
    rearBumper.position.set(0, 0.36, -2.2);
    chassis.add(frontBumper, rearBumper);

    // Rear spoiler wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.06, 0.28), bodyMat);
    wing.position.set(0, 1.06, -1.98);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.16), trimMat);
    strutL.position.set(0.65, 0.96, -1.96);
    const strutR = strutL.clone();
    strutR.position.x = -0.65;
    chassis.add(wing, strutL, strutR);

    // Headlights (+Z front) & Taillights (-Z rear)
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), headMat);
    hlL.position.set(0.62, 0.68, 2.2);
    const hlR = hlL.clone();
    hlR.position.x = -0.62;
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), tailMat);
    tlL.position.set(0.62, 0.72, -2.18);
    const tlR = tlL.clone();
    tlR.position.x = -0.62;
    chassis.add(hlL, hlR, tlL, tlR);

    // Chrome dual exhaust
    const exL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), chromeMat);
    exL.rotation.x = Math.PI / 2;
    exL.position.set(0.55, 0.32, -2.26);
    const exR = exL.clone();
    exR.position.x = -0.55;
    chassis.add(exL, exR);

    // 4 Wheels
    const wheelRadius = 0.36;
    const wheelSpecs: [number, number, boolean][] = [
      [0.92, 1.38, true],
      [-0.92, 1.38, true],
      [0.92, -1.36, false],
      [-0.92, -1.36, false],
    ];
    for (const [wx, wz, isFront] of wheelSpecs) {
      const steerPivot2 = new THREE.Group();
      steerPivot2.position.set(wx, wheelRadius, wz);
      const w = makeWheel(wheelRadius, 0.26);
      steerPivot2.add(w);
      chassis.add(steerPivot2);
      wheels.push(w);
      if (isFront) frontSteerPivots.push(steerPivot2);
    }

    return {
      root,
      chassis,
      wheels,
      frontSteerPivots,
      steeringWheel,
      driverSeatOffset,
      headlightMats,
      taillightMats,
      shadowDisc: shadow,
    };
  }

  if (type === 'bus') {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 9.2),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    root.add(shadow);

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.44, 1.25, 8.4), bodyMat);
    lowerBody.position.y = 1.05;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    chassis.add(lowerBody);

    const accentStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.48, 0.26, 8.42),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 }),
    );
    accentStripe.position.y = 1.48;
    chassis.add(accentStripe);

    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.38, 1.15, 8.2), darkGlassMat);
    upperCabin.position.y = 2.15;
    chassis.add(upperCabin);

    // Window mullions along bus sides
    for (let mz = -3.2; mz <= 3.2; mz += 1.6) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.44, 1.16, 0.14), bodyMat);
      pillar.position.set(0, 2.15, mz);
      chassis.add(pillar);
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.2, 8.35), chromeMat);
    roof.position.y = 2.82;
    roof.castShadow = true;
    chassis.add(roof);

    for (const az of [-2.0, 1.6]) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 1.3), trimMat);
      ac.position.set(0, 3.02, az);
      chassis.add(ac);
    }

    const ledSign = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.22, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.9 }),
    );
    ledSign.position.set(0, 2.58, 4.12);
    chassis.add(ledSign);

    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.08), headMat);
    hlL.position.set(0.85, 0.72, 4.21);
    const hlR = hlL.clone();
    hlR.position.x = -0.85;
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.08), tailMat);
    tlL.position.set(0.88, 0.82, -4.21);
    const tlR = tlL.clone();
    tlR.position.x = -0.88;
    chassis.add(hlL, hlR, tlL, tlR);

    const wheelRadius = 0.48;
    const wheelSpecs: [number, number, boolean][] = [
      [1.18, 2.7, true],
      [-1.18, 2.7, true],
      [1.18, -2.4, false],
      [-1.18, -2.4, false],
    ];
    for (const [wx, wz, isFront] of wheelSpecs) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, wheelRadius, wz);
      const w = makeWheel(wheelRadius, 0.34);
      steerPivot.add(w);
      chassis.add(steerPivot);
      wheels.push(w);
      if (isFront) frontSteerPivots.push(steerPivot);
    }

    return {
      root,
      chassis,
      wheels,
      frontSteerPivots,
      steeringWheel: null,
      driverSeatOffset: null,
      headlightMats,
      taillightMats,
      shadowDisc: shadow,
    };
  }

  // Motorcycle ('moto') — visible rider seated on saddle!
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 2.6),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 1.35), trimMat);
  frame.position.set(0, 0.56, -0.05);
  frame.castShadow = true;
  chassis.add(frame);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.58), bodyMat);
  tank.position.set(0, 0.82, 0.22);
  tank.castShadow = true;
  chassis.add(tank);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.62), trimMat);
  seat.position.set(0, 0.78, -0.34);
  chassis.add(seat);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 8), chromeMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.2, 0.34, -0.45);
  chassis.add(exhaust);

  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.06), tailMat);
  tl.position.set(0, 0.76, -0.78);
  chassis.add(tl);

  const frontFork = new THREE.Group();
  frontFork.position.set(0, 0.34, 0.76);
  const forkTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8), chromeMat);
  forkTube.position.set(0, 0.3, -0.06);
  forkTube.rotation.x = -0.22;
  frontFork.add(forkTube);

  const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.06), chromeMat);
  handlebar.position.set(0, 0.62, -0.14);
  frontFork.add(handlebar);

  const windDeflector = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.04), glassMat);
  windDeflector.position.set(0, 0.74, -0.04);
  windDeflector.rotation.x = -0.45;
  frontFork.add(windDeflector);

  const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12), headMat);
  hl.rotation.x = Math.PI / 2;
  hl.position.set(0, 0.5, 0.04);
  frontFork.add(hl);

  const frontWheel = makeWheel(0.34, 0.16);
  frontFork.add(frontWheel);
  chassis.add(frontFork);
  wheels.push(frontWheel);
  frontSteerPivots.push(frontFork);
  steeringWheel = frontFork;
  driverSeatOffset = { x: 0, y: 0.44, z: -0.28 };

  const rearWheel = makeWheel(0.34, 0.18);
  rearWheel.position.set(0, 0.34, -0.74);
  chassis.add(rearWheel);
  wheels.push(rearWheel);

  return {
    root,
    chassis,
    wheels,
    frontSteerPivots,
    steeringWheel,
    driverSeatOffset,
    headlightMats,
    taillightMats,
    shadowDisc: shadow,
  };
}
