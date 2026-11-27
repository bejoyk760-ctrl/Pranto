import * as THREE from 'three';

export interface ProceduralTextureSet {
  roadNS: THREE.CanvasTexture;
  roadEW: THREE.CanvasTexture;
  intersection: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  lobbyTile: THREE.CanvasTexture;
  facadeAlbedo: THREE.CanvasTexture;
  facadeEmissive: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAniso: number): ProceduralTextureSet {
  // 1. Road Asphalt (NS oriented: lane markings vertical along Y)
  const [roadC, rCtx] = makeCanvas(256, 256);
  rCtx.fillStyle = '#2c313a';
  rCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    rCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
    rCtx.fillRect(x, y, 2, 2);
  }
  rCtx.fillStyle = '#e5e7eb';
  rCtx.fillRect(10, 0, 5, 256);
  rCtx.fillRect(241, 0, 5, 256);
  rCtx.fillStyle = '#fbbf24';
  for (let y = 12; y < 256; y += 64) {
    rCtx.fillRect(123, y, 4, 34);
    rCtx.fillRect(129, y, 4, 34);
  }
  const roadNS = finalizeTexture(roadC, maxAniso, 1, 20, true);

  // Road EW (rotated copy)
  const [roadEWC, ewCtx] = makeCanvas(256, 256);
  ewCtx.translate(128, 128);
  ewCtx.rotate(Math.PI / 2);
  ewCtx.drawImage(roadC, -128, -128);
  const roadEW = finalizeTexture(roadEWC, maxAniso, 20, 1, true);

  // Intersection with Zebra Crosswalks
  const [interC, iCtx] = makeCanvas(256, 256);
  iCtx.fillStyle = '#2b3039';
  iCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    iCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.07)';
    iCtx.fillRect((i * 53) % 256, (i * 97) % 256, 2, 2);
  }
  iCtx.fillStyle = '#f3f4f6';
  for (let s = 26; s < 230; s += 26) {
    iCtx.fillRect(s, 8, 14, 28);
    iCtx.fillRect(s, 220, 14, 28);
    iCtx.fillRect(8, s, 28, 14);
    iCtx.fillRect(220, s, 28, 14);
  }
  const intersection = finalizeTexture(interC, maxAniso, 1, 1, true);

  // 2. Sidewalk Tiles
  const [sideC, sCtx] = makeCanvas(256, 256);
  sCtx.fillStyle = '#d9d2c5';
  sCtx.fillRect(0, 0, 256, 256);
  sCtx.strokeStyle = '#b8afa0';
  sCtx.lineWidth = 3;
  for (let g = 0; g <= 256; g += 64) {
    sCtx.beginPath();
    sCtx.moveTo(g, 0);
    sCtx.lineTo(g, 256);
    sCtx.stroke();
    sCtx.beginPath();
    sCtx.moveTo(0, g);
    sCtx.lineTo(256, g);
    sCtx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    sCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(90,75,60,0.06)';
    sCtx.fillRect((i * 41) % 256, (i * 83) % 256, 2, 2);
  }
  const sidewalk = finalizeTexture(sideC, maxAniso, 28, 28, true);

  // 3. Tropical Beach Sand
  const [sandC, sandCtx] = makeCanvas(256, 256);
  sandCtx.fillStyle = '#edd8a6';
  sandCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    sandCtx.fillStyle = i % 3 === 0 ? '#f6e7c1' : i % 3 === 1 ? '#dec288' : '#d2b275';
    sandCtx.fillRect((i * 61) % 256, (i * 113) % 256, 2, 2);
  }
  const sand = finalizeTexture(sandC, maxAniso, 8, 24, true);

  // 4. Park Grass
  const [grassC, gCtx] = makeCanvas(256, 256);
  gCtx.fillStyle = '#3f8f4e';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    gCtx.fillStyle = i % 2 === 0 ? '#4da35c' : '#357a42';
    gCtx.fillRect((i * 47) % 256, (i * 89) % 256, 3, 2);
  }
  const grass = finalizeTexture(grassC, maxAniso, 16, 16, true);

  // 5. Pier Wood Planks
  const [woodC, wCtx] = makeCanvas(256, 256);
  wCtx.fillStyle = '#9c6e44';
  wCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    wCtx.fillStyle = (y / 32) % 2 === 0 ? '#a4754b' : '#90643d';
    wCtx.fillRect(0, y, 256, 30);
    wCtx.fillStyle = '#5c3c22';
    wCtx.fillRect(0, y + 30, 256, 2);
  }
  const wood = finalizeTexture(woodC, maxAniso, 6, 2, true);

  // 6. Art Deco Interior Marble Terrazzo Tile
  const [tileC, tCtx] = makeCanvas(256, 256);
  tCtx.fillStyle = '#f8f5ee';
  tCtx.fillRect(0, 0, 256, 256);
  const step = 64;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const alt = ((x / step) + (y / step)) % 2 === 0;
      tCtx.fillStyle = alt ? '#f5efe2' : '#d5ebe6';
      tCtx.fillRect(x + 2, y + 2, step - 4, step - 4);
      tCtx.strokeStyle = '#cbbba0';
      tCtx.lineWidth = 2;
      tCtx.strokeRect(x, y, step, step);
    }
  }
  const lobbyTile = finalizeTexture(tileC, maxAniso, 4, 4, true);

  // 7. Architectural Building Facade Windows (Albedo + Night Emissive)
  const [facC, fCtx] = makeCanvas(256, 256);
  const [emC, eCtx] = makeCanvas(256, 256);
  fCtx.fillStyle = '#ffffff';
  fCtx.fillRect(0, 0, 256, 256);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 256);

  const cols = 4;
  const rows = 4;
  const cellW = 256 / cols;
  const cellH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + 12;
      const wy = r * cellH + 12;
      const ww = cellW - 24;
      const wh = cellH - 22;

      fCtx.fillStyle = '#25384d';
      fCtx.fillRect(wx, wy, ww, wh);
      fCtx.fillStyle = '#4f7a9e';
      fCtx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      fCtx.fillStyle = '#cbd5e1';
      fCtx.fillRect(wx + ww / 2 - 1, wy, 2, wh);

      const hash = (r * 7 + c * 13) % 5;
      if (hash !== 0) {
        eCtx.fillStyle = hash === 1 ? '#ffe6a3' : hash === 2 ? '#ffd285' : '#99e6ff';
        eCtx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
  }
  const facadeAlbedo = finalizeTexture(facC, maxAniso, 2, 3, true);
  const facadeEmissive = finalizeTexture(emC, maxAniso, 2, 3, true);

  // 8. Contact Shadow Radial Disc
  const [shadC, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(6, 10, 18, 0.72)');
  grad.addColorStop(0.55, 'rgba(6, 10, 18, 0.34)');
  grad.addColorStop(1, 'rgba(6, 10, 18, 0.0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = finalizeTexture(shadC, 1, 1, 1, true);
  contactShadow.wrapS = THREE.ClampToEdgeWrapping;
  contactShadow.wrapT = THREE.ClampToEdgeWrapping;

  return {
    roadNS,
    roadEW,
    intersection,
    sidewalk,
    sand,
    grass,
    wood,
    lobbyTile,
    facadeAlbedo,
    facadeEmissive,
    contactShadow,
    dispose: () => {
      roadNS.dispose();
      roadEW.dispose();
      intersection.dispose();
      sidewalk.dispose();
      sand.dispose();
      grass.dispose();
      wood.dispose();
      lobbyTile.dispose();
      facadeAlbedo.dispose();
      facadeEmissive.dispose();
      contactShadow.dispose();
    },
  };
}
