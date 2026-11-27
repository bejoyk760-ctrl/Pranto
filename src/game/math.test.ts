import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCameraRelativeMove,
  stepVehicleKinematics,
  groundHeightAt,
  getInteriorCeilingHeight,
  resolveCircleColliders,
  getDayNightParams,
  getWeatherParams,
  CANAL_Z,
  BRIDGE_HEIGHT,
  PIER_HEIGHT,
} from './math';
import {
  buildPedestrianGraph,
  canPedestrianCross,
  chooseNextWaypoint,
  getCrossingRoadAxis,
  getTrafficSignalState,
} from './npcAi';
import type { BoxCollider } from './types';

test('camera-relative movement moves forward away from camera and right to screen right', () => {
  // At camYaw = 0, camera is at +Z looking toward -Z (North).
  // Forward (W / inputY = +1) must move toward -Z.
  const fwd = computeCameraRelativeMove(0, 1, 0);
  assert.ok(fwd.dirZ < -0.99, `Expected dirZ near -1, got ${fwd.dirZ}`);
  assert.ok(Math.abs(fwd.dirX) < 1e-6);

  // Right (D / inputX = +1) must move toward +X.
  const right = computeCameraRelativeMove(1, 0, 0);
  assert.ok(right.dirX > 0.99, `Expected dirX near +1, got ${right.dirX}`);
  assert.ok(Math.abs(right.dirZ) < 1e-6);

  // Backward (S / inputY = -1) must move toward +Z.
  const back = computeCameraRelativeMove(0, -1, 0);
  assert.ok(back.dirZ > 0.99, `Expected dirZ near +1, got ${back.dirZ}`);

  // Left (A / inputX = -1) must move toward -X.
  const left = computeCameraRelativeMove(-1, 0, 0);
  assert.ok(left.dirX < -0.99, `Expected dirX near -1, got ${left.dirX}`);

  // Facing rotation: facing -Z in Three.js (+Z local forward) must be ~PI or -PI
  assert.ok(Math.abs(Math.abs(fwd.facingYaw) - Math.PI) < 1e-4);
  // Facing +X must be +PI/2
  assert.ok(Math.abs(right.facingYaw - Math.PI / 2) < 1e-4);
});

test('camera-relative movement stays consistent when camera orbits 90 deg right', () => {
  // Looking East (+X): camYaw = -PI/2
  const fwd = computeCameraRelativeMove(0, 1, -Math.PI / 2);
  assert.ok(fwd.dirX > 0.99, `Expected Eastward dirX ~1, got ${fwd.dirX}`);
  // Screen right when looking East (+X) is South (+Z)
  const right = computeCameraRelativeMove(1, 0, -Math.PI / 2);
  assert.ok(right.dirZ > 0.99, `Expected Southward dirZ ~1, got ${right.dirZ}`);
});

test('vehicle steering turns right on +steer and left on -steer without reversal', () => {
  // Heading = PI means vehicle faces North (-Z)
  const base = { x: 0, z: 0, heading: Math.PI, speed: 12 };

  // Steer right (D key, steer = +1): moving North (-Z), turning right must steer toward +X
  let rightState = { ...base };
  for (let i = 0; i < 10; i++) {
    rightState = stepVehicleKinematics(
      rightState,
      { throttle: 1, brake: 0, steer: 1, maxSpeed: 30, accel: 15, turnRate: 2.2 },
      0.05,
    );
  }
  assert.ok(rightState.x > 0.5, `Turning right while heading North must move +X, got x=${rightState.x}`);

  // Steer left (A key, steer = -1): moving North (-Z), turning left must steer toward -X
  let leftState = { ...base };
  for (let i = 0; i < 10; i++) {
    leftState = stepVehicleKinematics(
      leftState,
      { throttle: 1, brake: 0, steer: -1, maxSpeed: 30, accel: 15, turnRate: 2.2 },
      0.05,
    );
  }
  assert.ok(leftState.x < -0.5, `Turning left while heading North must move -X, got x=${leftState.x}`);
});

test('groundHeightAt handles roads, sidewalks, arched canal bridges, and ocean pier', () => {
  // Road center at (0, 0)
  assert.equal(groundHeightAt(0, 0), 0);
  // Sidewalk beside Ocean Drive (x=55, z=10)
  assert.equal(groundHeightAt(55, 10), 0.16);
  // Bridge crest at (48, CANAL_Z)
  assert.ok(Math.abs(groundHeightAt(48, CANAL_Z) - BRIDGE_HEIGHT) < 0.05);
  // Canal water between bridges (x=24, CANAL_Z)
  assert.ok(groundHeightAt(24, CANAL_Z) < -0.5);
  // Ocean Pier far end
  assert.equal(groundHeightAt(110, 0), PIER_HEIGHT);
});

test('resolveCircleColliders pushes actors cleanly out of solid buildings', () => {
  const colliders: BoxCollider[] = [
    { id: 'b1', minX: 10, maxX: 20, minZ: 10, maxZ: 20, height: 12, isSolid: true },
  ];
  const res = resolveCircleColliders(10.2, 15, 0.8, colliders);
  assert.equal(res.collided, true);
  assert.ok(res.x <= 10 - 0.79, `Expected push outside minX-radius (9.2), got ${res.x}`);
});

test('getDayNightParams transitions smoothly between midday, sunset, and midnight', () => {
  const day = getDayNightParams(0.25);
  assert.equal(day.label, 'Daylight');
  assert.ok(day.nightFactor < 0.05);

  const sunset = getDayNightParams(0.51);
  assert.equal(sunset.label, 'Sunset');
  assert.ok(sunset.sunsetFactor > 0.3);

  const night = getDayNightParams(0.75);
  assert.equal(night.label, 'Midnight');
  assert.ok(night.nightFactor > 0.8);
});

test('traffic signals cycle cleanly with mutual exclusion between NS and EW green', () => {
  const s0 = getTrafficSignalState(2);
  assert.equal(s0.nsGreen, true);
  assert.equal(s0.ewGreen, false);

  const sYellow = getTrafficSignalState(7.5);
  assert.equal(sYellow.nsGreen, false);
  assert.equal(sYellow.nsYellow, true);
  assert.equal(sYellow.ewGreen, false);

  const sEW = getTrafficSignalState(12);
  assert.equal(sEW.nsGreen, false);
  assert.equal(sEW.ewGreen, true);

  // Pedestrian crossing Ocean Drive (x=40.5 -> x=55.5) crosses NS road, so safe on EW green
  const axis = getCrossingRoadAxis(40.5, -7.5, 55.5, -7.5);
  assert.equal(axis, 'cross_ns_road');
  assert.equal(canPedestrianCross(axis, s0), false);
  assert.equal(canPedestrianCross(axis, sEW), true);
});

test('pedestrian waypoint graph connects sidewalks, park, pier, and hotel lobby without dead nodes', () => {
  const nodes = buildPedestrianGraph();
  assert.ok(nodes.length > 70);
  for (const n of nodes) {
    assert.ok(n.neighbors.length >= 1, `Node ${n.id} at (${n.x},${n.z}) has no neighbors`);
  }
  const lobbyNode = nodes.find((n) => Math.abs(n.x - 28) < 0.5 && Math.abs(n.z + 24) < 0.5);
  assert.ok(lobbyNode, 'Expected Mint Flamingo Lobby waypoint node at (28, -24)');
  const next = chooseNextWaypoint(nodes, 0, -1, 'stroller', () => 0.5);
  assert.ok(nodes[0].neighbors.includes(next));
});

test('getInteriorCeilingHeight detects Mint Flamingo Lobby and Sunset Surf Cafe interiors', () => {
  // Inside Mint Flamingo Hotel Lobby
  assert.equal(getInteriorCeilingHeight(24, -24), 4.35);
  // Inside Sunset Surf Cafe
  assert.equal(getInteriorCeilingHeight(24, 24), 4.15);
  // Outside on Ocean Drive sidewalk
  assert.equal(getInteriorCeilingHeight(40, 14), null);
});

test('getWeatherParams differentiates clear, rain, and fog modes and attenuates indoors', () => {
  const clear = getWeatherParams('clear', false);
  assert.equal(clear.rainIntensity, 0);
  assert.equal(clear.fogIntensity, 0);
  assert.equal(clear.fogDensityAdd, 0);

  const rain = getWeatherParams('rain', false);
  assert.equal(rain.rainIntensity, 1);
  assert.ok(rain.fogIntensity > 0 && rain.fogIntensity < 0.5);
  assert.ok(rain.roadRoughness < 0.3);

  const fog = getWeatherParams('fog', false);
  assert.equal(fog.rainIntensity, 0);
  assert.equal(fog.fogIntensity, 1);
  assert.ok(fog.fogDensityAdd > rain.fogDensityAdd);

  const indoorRain = getWeatherParams('rain', true);
  assert.ok(indoorRain.rainIntensity < 0.25);

  const indoorFog = getWeatherParams('fog', true);
  assert.ok(indoorFog.fogIntensity < 0.25);
});

