import * as THREE from 'three';
import { getWeatherParams } from './math';
import type { WeatherMode } from './types';

const RAIN_COUNT = 168;
const FOG_COUNT = 38;

const RAIN_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aSeed; // x: baseX, y: phaseY, z: layerDepth, w: kind (<0.80 streak, >=0.80 bokeh)
  attribute vec2 aVar;  // x: speedJitter, y: tiltOrScaleJitter

  uniform float uTime;
  uniform float uAspect;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uSteerWind;

  varying vec2 vUv;
  varying float vKind;
  varying float vAlpha;

  void main() {
    vUv = uv;
    float isBokeh = step(0.80, aSeed.w);
    vKind = isBokeh;

    float depth = aSeed.z;
    float tilt = -0.14 - uSpeed * 0.18 + uSteerWind * 0.14 + (aVar.y - 0.5) * 0.06;

    vec2 centerNdc;
    vec2 sizeNorm;
    float angle = 0.0;

    if (isBokeh < 0.5) {
      float fallRate = (1.45 + depth * 1.55 + uSpeed * 0.90) * (0.85 + aVar.x * 0.35);
      float life = fract(aSeed.y - uTime * fallRate);
      float ndcY = (life * 2.36) - 1.18;
      float horizDrift = (1.0 - life) * (-tilt * 0.72);
      float ndcX = mod(aSeed.x + horizDrift + uSteerWind * 0.18 * (1.0 - life) + 1.35, 2.70) - 1.35;

      centerNdc = vec2(ndcX, ndcY);
      float w = mix(0.0046, 0.0086, depth);
      float h = mix(0.095, 0.21, depth) * (1.0 + uSpeed * 0.45) * (0.85 + aVar.y * 0.35);
      sizeNorm = vec2(w, h);
      angle = tilt;
      vAlpha = (0.42 + depth * 0.48) * uIntensity;
    } else {
      float cycle = fract(aSeed.y + uTime * (0.18 + aVar.x * 0.14));
      float fade = sin(cycle * 3.14159265);
      float edgeSign = aSeed.x >= 0.0 ? 1.0 : -1.0;
      float ndcX = edgeSign * (0.32 + abs(aSeed.x) * 0.65);
      float ndcY = (aSeed.z * 1.68 - 0.84) - cycle * 0.12;
      centerNdc = vec2(ndcX, ndcY);
      float r = mix(0.018, 0.042, aVar.y);
      sizeNorm = vec2(r, r);
      vAlpha = fade * (0.24 + depth * 0.18) * uIntensity;
    }

    vec2 local = position.xy * sizeNorm;
    float c = cos(angle);
    float s = sin(angle);
    vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
    rotated.x /= max(0.5, uAspect);

    gl_Position = vec4(centerNdc + rotated, 0.0, 1.0);
  }
`;

const RAIN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vKind;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.004) discard;

    float alpha = 0.0;
    vec3 col = uColor;

    if (vKind < 0.5) {
      float across = abs(vUv.x - 0.5) * 2.0;
      float core = smoothstep(1.0, 0.15, across);
      float tail = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
      float headGlow = smoothstep(0.65, 0.12, vUv.y) * 0.42;
      alpha = (core * tail + core * headGlow) * vAlpha;
      col = mix(uColor, vec3(0.95, 0.99, 1.0), 0.45 * core);
    } else {
      vec2 p = (vUv - 0.5) * 2.0;
      float dist = length(p);
      float disc = smoothstep(1.0, 0.48, dist);
      float rim = smoothstep(0.50, 0.84, dist) * smoothstep(1.0, 0.84, dist);
      alpha = (disc * 0.48 + rim * 1.15) * vAlpha;
      col = mix(uColor, vec3(0.97, 0.99, 1.0), 0.55);
    }

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, min(0.92, alpha));
  }
`;

const FOG_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aSeed; // x: baseX, y: baseY, z: scale, w: phase
  attribute vec2 aVar;  // x: driftSpeed, y: stretch

  uniform float uTime;
  uniform float uAspect;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uSteerWind;

  varying vec2 vUv;
  varying float vPhase;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vPhase = aSeed.w;

    float layer = aSeed.z;
    float speedBoost = 1.0 + uSpeed * 1.45;
    float travel = uTime * aVar.x * speedBoost + uSteerWind * 0.30 * layer;
    float ndcX = mod(aSeed.x + travel + 1.55, 3.10) - 1.55;
    float ndcY = aSeed.y + sin(uTime * 0.48 + aSeed.w) * 0.05;

    float w = mix(0.68, 1.25, layer) * aVar.y * (1.0 + uSpeed * 0.14);
    float h = mix(0.32, 0.58, layer);

    float tilt = sin(aSeed.w * 1.3) * 0.09;
    vec2 local = position.xy * vec2(w, h);
    float c = cos(tilt);
    float s = sin(tilt);
    vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
    rotated.x /= max(0.5, uAspect);

    // Keep upper HUD band lighter while thickening horizon and street-level mist
    float bandWeight = mix(0.58, 1.22, clamp(0.66 - ndcY * 0.48, 0.0, 1.0));
    vAlpha = (0.24 + layer * 0.15) * bandWeight * uIntensity;

    gl_Position = vec4(vec2(ndcX, ndcY) + rotated, 0.0, 1.0);
  }
`;

const FOG_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  varying float vPhase;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.003) discard;

    vec2 p = (vUv - 0.5) * 2.0;
    float radial = length(p);
    if (radial >= 1.0) discard;

    float waveA = sin(vUv.x * 7.5 + vPhase + uTime * 0.35) * cos(vUv.y * 5.2 - vPhase * 0.6);
    float waveB = sin((vUv.x + vUv.y) * 11.0 - uTime * 0.28 + vPhase * 1.4);
    float wisp = 0.78 + 0.16 * waveA + 0.08 * waveB;

    float edgeFade = smoothstep(0.98, 0.12, radial + (1.0 - wisp) * 0.24);
    float coreSoft = smoothstep(1.0, 0.05, radial);
    float alpha = edgeFade * coreSoft * wisp * vAlpha;
    vec3 mistCol = mix(uColor, uColor * 1.08 + vec3(0.05), wisp);

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(mistCol, min(0.55, alpha));
  }
`;

function createInstancedQuadGeometry(
  count: number,
  seedArray: Float32Array,
  varArray: Float32Array,
): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  const positions = new Float32Array([
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
     0.5,  0.5, 0,
    -0.5,  0.5, 0,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.instanceCount = count;
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArray, 4));
  geo.setAttribute('aVar', new THREE.InstancedBufferAttribute(varArray, 2));
  return geo;
}

const _rainTintDay = new THREE.Color(0xdbeafe);
const _rainTintNight = new THREE.Color(0x93c5fd);
const _fogTintDay = new THREE.Color(0xd9e8f2);
const _fogTintSunset = new THREE.Color(0xf4c7b8);
const _fogTintNight = new THREE.Color(0x384967);

export class ScreenSpaceWeatherFX {
  public readonly group = new THREE.Group();

  private rainGeo: THREE.InstancedBufferGeometry;
  private rainMat: THREE.ShaderMaterial;
  private rainMesh: THREE.Mesh;

  private fogGeo: THREE.InstancedBufferGeometry;
  private fogMat: THREE.ShaderMaterial;
  private fogMesh: THREE.Mesh;

  private rainIntensity = 0;
  private fogIntensity = 0;

  constructor() {
    // Deterministic seeded RNG so visual density is balanced across restarts
    let s = 133742;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const rainSeeds = new Float32Array(RAIN_COUNT * 4);
    const rainVars = new Float32Array(RAIN_COUNT * 2);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const i4 = i * 4;
      const i2 = i * 2;
      rainSeeds[i4] = (rand() - 0.5) * 2.4;
      rainSeeds[i4 + 1] = rand();
      rainSeeds[i4 + 2] = 0.15 + rand() * 0.85;
      rainSeeds[i4 + 3] = i / RAIN_COUNT;

      rainVars[i2] = rand();
      rainVars[i2 + 1] = rand();
    }

    this.rainGeo = createInstancedQuadGeometry(RAIN_COUNT, rainSeeds, rainVars);
    this.rainMat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERTEX_SHADER,
      fragmentShader: RAIN_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 16 / 9 },
        uIntensity: { value: 0 },
        uSpeed: { value: 0 },
        uSteerWind: { value: 0 },
        uColor: { value: new THREE.Color(0xdbeafe) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.rainMesh = new THREE.Mesh(this.rainGeo, this.rainMat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.renderOrder = 21;
    this.rainMesh.visible = false;

    const fogSeeds = new Float32Array(FOG_COUNT * 4);
    const fogVars = new Float32Array(FOG_COUNT * 2);
    for (let i = 0; i < FOG_COUNT; i++) {
      const i4 = i * 4;
      const i2 = i * 2;
      fogSeeds[i4] = (rand() - 0.5) * 2.8;
      fogSeeds[i4 + 1] = -0.82 + rand() * 1.42;
      fogSeeds[i4 + 2] = 0.25 + rand() * 0.75;
      fogSeeds[i4 + 3] = rand() * Math.PI * 2;

      fogVars[i2] = (0.032 + rand() * 0.055) * (rand() < 0.22 ? -1 : 1);
      fogVars[i2 + 1] = 1.55 + rand() * 1.05;
    }

    this.fogGeo = createInstancedQuadGeometry(FOG_COUNT, fogSeeds, fogVars);
    this.fogMat = new THREE.ShaderMaterial({
      vertexShader: FOG_VERTEX_SHADER,
      fragmentShader: FOG_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 16 / 9 },
        uIntensity: { value: 0 },
        uSpeed: { value: 0 },
        uSteerWind: { value: 0 },
        uColor: { value: new THREE.Color(0xd9e8f2) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.fogMesh = new THREE.Mesh(this.fogGeo, this.fogMat);
    this.fogMesh.frustumCulled = false;
    this.fogMesh.renderOrder = 20;
    this.fogMesh.visible = false;

    this.group.add(this.fogMesh, this.rainMesh);
  }

  public update(
    dt: number,
    elapsedSec: number,
    aspect: number,
    weather: WeatherMode,
    speedRatio: number,
    steerHint: number,
    isIndoor: boolean,
    sunsetFactor: number,
    nightFactor: number,
    snapImmediate = false,
  ): void {
    const target = getWeatherParams(weather, isIndoor);
    if (snapImmediate || dt <= 0) {
      this.rainIntensity = target.rainIntensity;
      this.fogIntensity = target.fogIntensity;
    } else {
      this.rainIntensity = THREE.MathUtils.damp(this.rainIntensity, target.rainIntensity, 6.8, dt);
      this.fogIntensity = THREE.MathUtils.damp(this.fogIntensity, target.fogIntensity, 5.8, dt);
    }

    const clampedAspect = Math.max(0.5, aspect || 16 / 9);
    const clampedSpeed = Math.max(0, Math.min(1.5, speedRatio));
    const clampedSteer = Math.max(-1, Math.min(1, steerHint));

    this.rainMesh.visible = this.rainIntensity > 0.008;
    if (this.rainMesh.visible) {
      const u = this.rainMat.uniforms;
      u.uTime.value = elapsedSec;
      u.uAspect.value = clampedAspect;
      u.uIntensity.value = this.rainIntensity;
      u.uSpeed.value = clampedSpeed;
      u.uSteerWind.value = clampedSteer;
      (u.uColor.value as THREE.Color).copy(_rainTintDay).lerp(_rainTintNight, nightFactor * 0.7);
    }

    this.fogMesh.visible = this.fogIntensity > 0.008;
    if (this.fogMesh.visible) {
      const u = this.fogMat.uniforms;
      u.uTime.value = elapsedSec;
      u.uAspect.value = clampedAspect;
      u.uIntensity.value = this.fogIntensity;
      u.uSpeed.value = clampedSpeed;
      u.uSteerWind.value = clampedSteer;
      (u.uColor.value as THREE.Color)
        .copy(_fogTintDay)
        .lerp(_fogTintSunset, sunsetFactor * 0.65)
        .lerp(_fogTintNight, nightFactor * 0.85);
    }
  }

  public getIntensities(): { rain: number; fog: number } {
    return { rain: this.rainIntensity, fog: this.fogIntensity };
  }

  public dispose(): void {
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.fogGeo.dispose();
    this.fogMat.dispose();
  }
}
