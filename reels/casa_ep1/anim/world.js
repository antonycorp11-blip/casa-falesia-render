import * as T from './lib/three.module.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return s - Math.floor(s);
};

function mat(color, opts = {}) {
  return new T.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.76,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? T.FrontSide,
  });
}

function box(parent, w, h, d, x, y, z, material, cast = true, receive = true) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function cyl(parent, rt, rb, h, x, y, z, material, segs = 14, cast = true) {
  const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, segs), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ============================================================================
// Texturas procedurais determinísticas (estilo ECO · A Escola)
// ============================================================================
function makeWoodPlankTex(base = '#6f4e37', grain = '#573b27', seam = '#3b2619', rx = 4, ry = 4) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  const planks = 8;
  const ph = 512 / planks;
  for (let i = 0; i < planks; i++) {
    const shade = (hash(i * 17) - 0.5) * 18;
    ctx.fillStyle = shade > 0 ? 'rgba(255,220,180,0.06)' : 'rgba(20,10,5,0.08)';
    ctx.fillRect(0, i * ph, 512, ph);

    ctx.strokeStyle = grain;
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      ctx.beginPath();
      const gy = i * ph + (g + 0.5) * (ph / 6);
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(170, gy + (hash(i * 7 + g) - 0.5) * 6, 340, gy - (hash(i * 13 + g) - 0.5) * 6, 512, gy);
      ctx.stroke();
    }
    ctx.fillStyle = seam;
    ctx.fillRect(0, i * ph, 512, 2);
    const jx = Math.floor(hash(i * 29 + 5) * 420) + 40;
    ctx.fillRect(jx, i * ph, 2, ph);
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

function makeTileTex(c1, c2, grout, rx = 5, ry = 5) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? c1 : c2;
      ctx.fillRect(c * 128 + 3, r * 128 + 3, 122, 122);
    }
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

function makeStoneTex(c1 = '#676d74', c2 = '#555b62', mortar = '#3d4248', rx = 3, ry = 3) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, 512, 512);
  const rows = 8;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 56;
    for (let c = -1; c < 5; c++) {
      const bw = 118 + Math.floor(hash(r * 13 + c * 7) * 18);
      const bx = c * 128 + offset;
      ctx.fillStyle = (r + c) % 2 === 0 ? c1 : c2;
      ctx.fillRect(bx + 4, r * rh + 4, bw - 8, rh - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(bx + 4, r * rh + 4, bw - 8, 6);
    }
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

function makeRugTex() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 384;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#6c2d2c';
  ctx.fillRect(0, 0, 512, 384);
  ctx.strokeStyle = '#d4b47c';
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, 472, 344);
  ctx.strokeStyle = '#25384a';
  ctx.lineWidth = 8;
  ctx.strokeRect(42, 42, 428, 300);

  // Medalhão central geométrico
  ctx.fillStyle = '#243647';
  ctx.beginPath();
  ctx.moveTo(256, 78);
  ctx.lineTo(392, 192);
  ctx.lineTo(256, 306);
  ctx.lineTo(120, 192);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e0c28a';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#8b3e33';
  ctx.beginPath();
  ctx.moveTo(256, 126);
  ctx.lineTo(334, 192);
  ctx.lineTo(256, 258);
  ctx.lineTo(178, 192);
  ctx.closePath();
  ctx.fill();

  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function makeMarbleTex() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#dcdad5';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(110,120,130,0.28)';
  for (let i = 0; i < 16; i++) {
    ctx.lineWidth = 1 + hash(i * 11) * 2.5;
    ctx.beginPath();
    ctx.moveTo(hash(i * 3) * 512, 0);
    ctx.bezierCurveTo(hash(i * 7) * 512, 90, hash(i * 13) * 512, 170, hash(i * 19) * 512, 256);
    ctx.stroke();
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function makeOldPortraitTex() {
  // Retrato antigo sépia da festa de 20 anos atrás: Sofia de vestido branco segurando a taça dourada!
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 640;
  const ctx = cv.getContext('2d');

  const g = ctx.createRadialGradient(256, 250, 40, 256, 320, 380);
  g.addColorStop(0, '#a88c68');
  g.addColorStop(0.55, '#6b533b');
  g.addColorStop(1, '#2b1e14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 640);

  // Lareira antiga desfocada ao fundo do retrato
  ctx.fillStyle = '#3b2b1d';
  ctx.fillRect(42, 210, 145, 290);
  ctx.fillStyle = '#9c612e';
  ctx.beginPath();
  ctx.arc(114, 390, 42, Math.PI, 0);
  ctx.fill();

  // Convidados sombreados dos lados
  ctx.fillStyle = 'rgba(42,30,20,0.68)';
  for (const cx of [125, 388]) {
    ctx.beginPath();
    ctx.arc(cx, 255, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 46, 292, 92, 210);
  }

  // Figura central: Sofia de vestido branco claro segurando a taça dourada!
  ctx.fillStyle = '#dfd1b8';
  ctx.beginPath();
  ctx.moveTo(256, 286);
  ctx.lineTo(324, 540);
  ctx.lineTo(188, 540);
  ctx.closePath();
  ctx.fill();

  // Cabelo comprido sépia + rosto
  ctx.fillStyle = '#402e20';
  ctx.beginPath();
  ctx.ellipse(256, 232, 48, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d4be9b';
  ctx.beginPath();
  ctx.ellipse(256, 224, 30, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#352418';
  ctx.beginPath();
  ctx.arc(245, 220, 3.5, 0, Math.PI * 2);
  ctx.arc(267, 220, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // TAÇA DOURADA em destaque na mão dela!
  ctx.fillStyle = '#f2c453';
  ctx.beginPath();
  ctx.moveTo(298, 288);
  ctx.lineTo(334, 288);
  ctx.lineTo(324, 326);
  ctx.lineTo(308, 326);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(313, 326, 6, 32);
  ctx.fillRect(302, 356, 28, 6);

  // Envelhecimento & legenda
  ctx.strokeStyle = 'rgba(230,205,165,0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 476, 604);
  ctx.fillStyle = '#ead9bc';
  ctx.font = 'italic bold 26px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('CASA DA FALÉSIA · 20 ANOS', 256, 594);

  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function makeSeaArtTex() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 320;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, '#1e3a52');
  g.addColorStop(0.55, '#3b647d');
  g.addColorStop(0.56, '#142c3c');
  g.addColorStop(1, '#0c1b26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 320);
  // Lua sobre o penhasco
  ctx.fillStyle = '#e7dec5';
  ctx.beginPath();
  ctx.arc(365, 86, 26, 0, Math.PI * 2);
  ctx.fill();
  // Falésia
  ctx.fillStyle = '#141c24';
  ctx.beginPath();
  ctx.moveTo(0, 178);
  ctx.lineTo(185, 148);
  ctx.lineTo(245, 225);
  ctx.lineTo(0, 240);
  ctx.closePath();
  ctx.fill();
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function makeContractTex() {
  const cv = document.createElement('canvas');
  cv.width = 384;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f3ebd8';
  ctx.fillRect(0, 0, 384, 512);
  ctx.fillStyle = '#202630';
  ctx.font = 'bold 24px Georgia';
  ctx.fillText('CONTRATO DE VENDA', 48, 56);
  ctx.font = '16px Georgia';
  ctx.fillText('IMÓVEL: CASA DA FALÉSIA', 48, 92);
  ctx.fillStyle = '#555d66';
  for (let y = 132; y < 390; y += 26) {
    ctx.fillRect(48, y, 288 - (y % 3) * 28, 6);
  }
  ctx.strokeStyle = '#9e262e';
  ctx.lineWidth = 4;
  ctx.strokeRect(205, 405, 132, 54);
  ctx.fillStyle = '#9e262e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ASSINADO', 218, 439);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function makeWarningTex() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e5b82e';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#181a1e';
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, 232, 232);
  ctx.fillStyle = '#181a1e';
  ctx.beginPath();
  ctx.moveTo(142, 36);
  ctx.lineTo(82, 134);
  ctx.lineTo(126, 134);
  ctx.lineTo(110, 218);
  ctx.lineTo(176, 114);
  ctx.lineTo(132, 114);
  ctx.closePath();
  ctx.fill();
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

// ============================================================================
// Auxiliares de mobília rica
// ============================================================================
function buildLamp(parent, x, y, z, standH = 1.45, shadeColor = '#f4dfb8') {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const brass = mat('#b6924b', { roughness: 0.3, metalness: 0.78 });
  cyl(g, 0.16, 0.19, 0.04, 0, 0.02, 0, brass, 14);
  cyl(g, 0.02, 0.024, standH, 0, standH * 0.5, 0, brass, 10);
  const shadeMat = mat(shadeColor, {
    roughness: 0.72,
    emissive: '#ffba66',
    emissiveIntensity: 0.95,
    side: T.DoubleSide,
  });
  const shade = new T.Mesh(new T.CylinderGeometry(0.16, 0.27, 0.34, 16, 1, true), shadeMat);
  shade.position.y = standH;
  g.add(shade);
  return shadeMat;
}

function buildGoblet(parent, x, y, z, isGold = false, liquidColor = '#6f1d73') {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const m = isGold
    ? mat('#f4c64f', { roughness: 0.16, metalness: 0.9, emissive: '#66480e', emissiveIntensity: 0.28 })
    : new T.MeshPhysicalMaterial({ color: '#d8eef8', transparent: true, opacity: 0.45, roughness: 0.08, metalness: 0.12 });
  cyl(g, 0.045, 0.052, 0.014, 0, 0.007, 0, m, 12, false);
  cyl(g, 0.008, 0.010, 0.11, 0, 0.068, 0, m, 10, false);
  const cup = new T.Mesh(new T.CylinderGeometry(0.052, 0.026, 0.115, 14), m);
  cup.position.y = 0.168;
  g.add(cup);
  const liq = new T.Mesh(new T.CylinderGeometry(0.044, 0.024, 0.065, 12), mat(liquidColor, { roughness: 0.22 }));
  liq.position.y = 0.162;
  g.add(liq);
  return g;
}

function buildBed(parent, x, y, z, w = 2.1, d = 2.25, blanketColor = '#344c69', rotY = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  const woodM = mat('#5c402c', { roughness: 0.65 });
  // Base + cabeceira estofada
  box(g, w + 0.12, 0.28, d + 0.12, 0, 0.18, 0, woodM);
  box(g, w + 0.14, 1.15, 0.12, 0, 0.62, d * 0.5 + 0.04, mat('#3d434d', { roughness: 0.85 }));
  // Colchão branco + edredom + manta dobrada
  box(g, w, 0.26, d, 0, 0.42, 0, mat('#eeeae0', { roughness: 0.88 }));
  box(g, w + 0.04, 0.24, d * 0.72, 0, 0.45, -d * 0.14, mat(blanketColor, { roughness: 0.85 }));
  box(g, w + 0.06, 0.08, 0.42, 0, 0.56, -d * 0.34, mat('#d9b675', { roughness: 0.82 }));
  // 2 travesseiros
  for (const sx of [-w * 0.24, w * 0.24]) {
    const pil = new T.Mesh(new T.CapsuleGeometry(0.11, w * 0.26, 6, 10), mat('#f6f3ec', { roughness: 0.86 }));
    pil.rotation.z = Math.PI / 2;
    pil.position.set(sx, 0.60, d * 0.32);
    pil.scale.set(1, 1, 0.72);
    g.add(pil);
  }
  return g;
}

function buildPlant(parent, x, y, z, scale = 1) {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);
  cyl(g, 0.22, 0.16, 0.42, 0, 0.21, 0, mat('#9e6846', { roughness: 0.82 }), 12);
  cyl(g, 0.20, 0.20, 0.04, 0, 0.41, 0, mat('#33251c', { roughness: 0.95 }), 10, false);
  const leafMat = mat('#2f5d3a', { roughness: 0.65, side: T.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = new T.Mesh(new T.SphereGeometry(0.18, 8, 6), leafMat);
    leaf.scale.set(0.55, 1.85, 0.18);
    leaf.position.set(Math.cos(a) * 0.18, 0.65 + (i % 3) * 0.12, Math.sin(a) * 0.18);
    leaf.rotation.set(Math.sin(a) * 0.55, a, -Math.cos(a) * 0.55);
    g.add(leaf);
  }
}

// ============================================================================
// Construtor principal: A Casa da Falésia
// ============================================================================
export function makeWorld(scene) {
  const root = new T.Group();
  scene.add(root);

  scene.background = new T.Color('#0c1726');
  const fog = new T.FogExp2('#102033', 0.013);
  scene.fog = fog;

  const rooms = {
    sala: [0, 0, 0],
    cozinha: [12, 0, 0],
    varanda: [0, 0, -12],
    piscina: [0, 0, -23],
    escada: [-11, 0, 0],
    quarto1: [-11, 4, 10],
    quarto2: [0, 4, 10],
    quarto3: [11, 4, 10],
    porao: [0, -4, 10],
    garagem: [12, -4, 10],
  };

  // --- Materiais compartilhados com texturas procedurais ---
  const woodFloorTex = makeWoodPlankTex('#755138', '#5b3c27', '#3a2517', 5, 5);
  const deckWoodTex = makeWoodPlankTex('#5c4738', '#463529', '#2b2018', 6, 6);
  const kitchenTileTex = makeTileTex('#d5d7d2', '#b9bec2', '#828a92', 6, 6);
  const poolTileTex = makeTileTex('#1b7f9c', '#156c87', '#0f4c61', 8, 6);
  const stoneTex = makeStoneTex('#6c7178', '#5a6068', '#3c4147', 3, 2);
  const basementStoneTex = makeStoneTex('#525861', '#424850', '#2b3036', 4, 2);
  const concreteTex = makeTileTex('#5f656c', '#575d64', '#43484e', 5, 5);
  const marbleTex = makeMarbleTex();

  const matWoodFloor = mat('#ffffff', { map: woodFloorTex, roughness: 0.56 });
  const matDeck = mat('#ffffff', { map: deckWoodTex, roughness: 0.34, metalness: 0.08 });
  const matKitchenFloor = mat('#ffffff', { map: kitchenTileTex, roughness: 0.45 });
  const matConcrete = mat('#ffffff', { map: concreteTex, roughness: 0.85 });
  const matStone = mat('#ffffff', { map: stoneTex, roughness: 0.86 });
  const matBaseStone = mat('#ffffff', { map: basementStoneTex, roughness: 0.9 });
  const matWallCream = mat('#dfd6c5', { roughness: 0.84 });
  const matWallTrim = mat('#4b3526', { roughness: 0.65 });
  const matWainscot = mat('#c7bca8', { roughness: 0.8 });
  const matDarkWood = mat('#4f3626', { roughness: 0.62 });
  const matWarmWood = mat('#825c3e', { roughness: 0.64 });
  const matMetalDark = mat('#242c35', { roughness: 0.4, metalness: 0.65 });
  const matSteel = mat('#aeb8c2', { roughness: 0.28, metalness: 0.82 });
  const matBrass = mat('#cfa54e', { roughness: 0.25, metalness: 0.82 });
  const matGlass = new T.MeshPhysicalMaterial({
    color: '#9ec4d8',
    transparent: true,
    opacity: 0.20,
    roughness: 0.08,
    metalness: 0.14,
    side: T.DoubleSide,
  });

  const emissiveLamps = []; // materiais que apagam no apagão

  function addCeiling(x, z, w, d, y, color = '#d9d0be') {
    // FrontSide voltado para -Y: visível de dentro do cômodo, mas INVISÍVEL visto de cima (plano geral y=7)!
    const ceil = new T.Mesh(new T.PlaneGeometry(w, d), mat(color, { roughness: 0.88 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(x, y, z);
    root.add(ceil);
  }

  function addRoomShell(x, z, w, d, y, floorMat, wallMat, opts = {}) {
    const h = 3.35;
    box(root, w, 0.24, d, x, y - 0.12, z, floorMat, false, true);
    if (!opts.noCeiling) addCeiling(x, z, w, d, y + h, opts.ceilColor || '#dad2c2');

    // Paredes (com vãos largos onde necessário)
    if (!opts.openLeft) box(root, 0.24, h, d, x - w / 2, y + h / 2, z, wallMat, false, true);
    if (!opts.openRight) box(root, 0.24, h, d, x + w / 2, y + h / 2, z, wallMat, false, true);
    if (!opts.openBack) box(root, w, h, 0.24, x, y + h / 2, z + d / 2, wallMat, false, true);
    if (!opts.openFront) box(root, w, h, 0.24, x, y + h / 2, z - d / 2, wallMat, false, true);

    // Rodapé de madeira
    if (!opts.noTrim) {
      if (!opts.openLeft) box(root, 0.28, 0.16, d - 0.2, x - w / 2 + 0.02, y + 0.08, z, matWallTrim, false);
      if (!opts.openRight) box(root, 0.28, 0.16, d - 0.2, x + w / 2 - 0.02, y + 0.08, z, matWallTrim, false);
      if (!opts.openBack) box(root, w - 0.2, 0.16, 0.28, x, y + 0.08, z + d / 2 - 0.02, matWallTrim, false);
    }
  }

  // ==========================================================================
  // 1) SALA COM LAREIRA (x: -5.5..5.5, z: -5..5, y: 0..3.35)
  // ==========================================================================
  addRoomShell(0, 0, 11, 10, 0, matWoodFloor, matWallCream, { openFront: true, openRight: true, openLeft: true });
  // Paredes laterais parciais deixando vãos para cozinha (direita) e escada (esquerda)
  box(root, 0.24, 3.35, 6.2, -5.5, 1.675, 1.9, matWallCream, false, true);
  box(root, 0.24, 3.35, 1.4, -5.5, 1.675, -4.3, matWallCream, false, true);
  box(root, 0.24, 1.0, 2.4, -5.5, 2.85, -2.4, matWallCream, false, true);
  // Arco entre Sala e Cozinha (x = 5.5)
  box(root, 0.24, 3.35, 3.2, 5.5, 1.675, 3.4, matWallCream, false, true);
  box(root, 0.24, 3.35, 2.2, 5.5, 1.675, -3.9, matWallCream, false, true);
  box(root, 0.24, 0.85, 4.6, 5.5, 2.92, -0.5, matWallCream, false, true);

  // Lambril / boiserie elegante na parede de fundo da sala (z = 4.88)
  box(root, 10.6, 1.05, 0.08, 0, 0.525, 4.86, matWainscot, false, true);
  box(root, 10.6, 0.07, 0.12, 0, 1.06, 4.85, matWallTrim, false, true);

  // Portas de vidro deslizantes voltadas para a varanda/mar (z = -5)
  for (const fx of [-5.2, -2.6, 0, 2.6, 5.2]) {
    box(root, 0.10, 3.35, 0.12, fx, 1.675, -4.98, matMetalDark, false);
  }
  box(root, 10.6, 0.14, 0.14, 0, 3.28, -4.98, matMetalDark, false);
  box(root, 10.4, 3.15, 0.04, 0, 1.65, -4.98, matGlass, false, false);

  // LAREIRA DE PEDRA COM FOGO ANIMADO (parede esquerda x = -5.0, z = 1.1)
  const fireplace = new T.Group();
  fireplace.position.set(-4.95, 0, 1.1);
  root.add(fireplace);
  box(fireplace, 0.85, 3.35, 2.9, 0, 1.675, 0, matStone); // chaminé até o teto
  box(fireplace, 1.15, 0.16, 3.1, 0.12, 0.08, 0, matStone); // base da lareira
  box(fireplace, 1.05, 0.14, 3.15, 0.12, 1.56, 0, matDarkWood); // prateleira (mantle)
  // Boca escura com brasa
  box(fireplace, 0.55, 1.15, 1.85, 0.24, 0.72, 0, mat('#171110', { emissive: '#6e2108', emissiveIntensity: 0.45 }), false);
  // Lenha cruzada
  const logMat = mat('#3c2618', { roughness: 0.92 });
  for (let i = 0; i < 3; i++) {
    const lg = cyl(fireplace, 0.08, 0.09, 1.2, 0.45, 0.28 + i * 0.06, (i - 1) * 0.25, logMat, 8);
    lg.rotation.x = Math.PI / 2 + (i - 1) * 0.25;
    lg.rotation.z = 0.12;
  }
  // Chamas animadas em camadas (laranja + amarelo brilhante)
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const isInner = i % 2 === 1;
    const f = new T.Mesh(
      new T.ConeGeometry(isInner ? 0.14 : 0.22, isInner ? 0.62 : 0.92, 7),
      new T.MeshBasicMaterial({
        color: isInner ? '#ffd257' : '#ff6a22',
        transparent: true,
        opacity: isInner ? 0.92 : 0.78,
      })
    );
    f.position.set(0.46 + (i % 2) * 0.06, 0.58, -0.58 + i * 0.19);
    fireplace.add(f);
    flames.push({ mesh: f, baseY: f.position.y, phase: i * 1.4 });
  }
  // Castiçais e relógio antigo sobre a lareira
  for (const cz of [-1.05, 1.05]) {
    cyl(fireplace, 0.04, 0.06, 0.26, 0.42, 1.76, cz, matBrass, 10);
    cyl(fireplace, 0.025, 0.025, 0.16, 0.42, 1.96, cz, mat('#f6efe0'), 8);
    const cFlame = new T.Mesh(new T.SphereGeometry(0.022, 6, 6), new T.MeshBasicMaterial({ color: '#ffcb52' }));
    cFlame.position.set(0.42, 2.06, cz);
    fireplace.add(cFlame);
  }
  box(fireplace, 0.16, 0.28, 0.42, 0.40, 1.77, 0, matDarkWood); // relógio de mesa

  // Luz principal da lareira (quente e viva!)
  const fireLight = new T.PointLight('#ff943b', 14, 15, 1.3);
  fireLight.position.set(-3.6, 1.55, 1.1);
  root.add(fireLight);

  // TAPETE PERSA/COSTEIRO NO CENTRO DA SALA
  const rug = new T.Mesh(
    new T.PlaneGeometry(5.6, 4.0),
    mat('#ffffff', { map: makeRugTex(), roughness: 0.92 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.5, 0.015, 1.4);
  rug.receiveShadow = true;
  root.add(rug);

  // SOFÁ ESTOFADO PRINCIPAL (fundo direita, z = 3.55, voltado para -Z)
  const sofa = new T.Group();
  sofa.position.set(1.5, 0, 3.55);
  root.add(sofa);
  const sofaMat = mat('#36495c', { roughness: 0.88 });
  const cushionMat = mat('#42586e', { roughness: 0.85 });
  box(sofa, 3.1, 0.42, 1.05, 0, 0.26, 0, sofaMat); // base
  box(sofa, 3.1, 0.56, 0.28, 0, 0.68, 0.40, sofaMat); // encosto
  for (const sx of [-1.45, 1.45]) box(sofa, 0.24, 0.64, 1.06, sx, 0.38, 0, sofaMat); // braços
  for (const cx of [-0.9, 0, 0.9]) {
    box(sofa, 0.86, 0.16, 0.78, cx, 0.50, -0.06, cushionMat); // almofadas assento
    box(sofa, 0.82, 0.44, 0.18, cx, 0.72, 0.22, cushionMat); // almofadas encosto
  }
  // Almofadas decorativas (mostarda + creme) + LENÇO VINHO DA NINA no braço do sofá!
  const pil1 = box(sofa, 0.36, 0.34, 0.14, -1.12, 0.68, 0.05, mat('#d9a026', { roughness: 0.84 }));
  pil1.rotation.set(-0.2, 0.35, 0.12);
  const pil2 = box(sofa, 0.34, 0.32, 0.14, 1.08, 0.67, 0.06, mat('#e6dcc8', { roughness: 0.84 }));
  pil2.rotation.set(-0.18, -0.32, -0.1);
  // Lenço de seda vinho da Nina dobrado no braço esquerdo do sofá
  box(sofa, 0.26, 0.04, 0.48, -1.44, 0.72, -0.05, mat('#861f3b', { roughness: 0.42 }));
  box(sofa, 0.22, 0.34, 0.04, -1.44, 0.54, -0.30, mat('#861f3b', { roughness: 0.42 }));

  // POLTRONA PARA TINA (pos: [3.7, 0, 2.0], pose: 'sentado' em direcao.js!)
  const armchair = new T.Group();
  armchair.position.set(3.75, 0, 2.15);
  armchair.rotation.y = -0.45;
  root.add(armchair);
  const chairMat = mat('#6e4c44', { roughness: 0.86 });
  box(armchair, 0.96, 0.38, 0.88, 0, 0.24, 0, chairMat);
  box(armchair, 0.96, 0.62, 0.22, 0, 0.64, 0.34, chairMat);
  for (const sx of [-0.44, 0.44]) box(armchair, 0.16, 0.56, 0.88, sx, 0.34, 0, chairMat);

  // MESA DO BRINDE COM BOLO DE 20 ANOS, TAÇAS E A TAÇA DOURADA EM DESTAQUE!
  // Posicionada em (-0.25, 0, 2.25) — limpa do qaPortrait em (0, 0, 0..1.1) e visível no Plano 1!
  const partyTable = new T.Group();
  partyTable.position.set(-0.25, 0, 2.28);
  root.add(partyTable);
  box(partyTable, 1.95, 0.08, 0.96, 0, 0.72, 0, matDarkWood);
  box(partyTable, 1.82, 0.015, 0.44, 0, 0.768, 0, mat('#ede4d2', { roughness: 0.85 }), false); // trilho de mesa
  for (const lx of [-0.84, 0.84]) {
    for (const lz of [-0.38, 0.38]) {
      box(partyTable, 0.08, 0.72, 0.08, lx, 0.36, lz, matDarkWood);
    }
  }
  // Bolo de aniversário de 20 anos do Caio (2 andares + cobertura + velas acesas!)
  cyl(partyTable, 0.28, 0.28, 0.03, -0.35, 0.785, 0, mat('#ece8e0', { roughness: 0.25 }), 18); // prato
  cyl(partyTable, 0.22, 0.23, 0.15, -0.35, 0.875, 0, mat('#f7ecda', { roughness: 0.65 }), 18); // base
  cyl(partyTable, 0.23, 0.23, 0.04, -0.35, 0.945, 0, mat('#4e2b1d', { roughness: 0.45 }), 18); // calda chocolate
  cyl(partyTable, 0.14, 0.15, 0.12, -0.35, 1.01, 0, mat('#f7ecda', { roughness: 0.65 }), 16); // topo
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2 + 0.4;
    const cx = -0.35 + Math.cos(a) * 0.07;
    const cz = Math.sin(a) * 0.07;
    cyl(partyTable, 0.009, 0.009, 0.10, cx, 1.12, cz, mat('#e8be50'), 6, false);
    const cf = new T.Mesh(new T.SphereGeometry(0.016, 6, 6), new T.MeshBasicMaterial({ color: '#ffd34e' }));
    cf.position.set(cx, 1.18, cz);
    partyTable.add(cf);
  }
  // Taças de cristal + TAÇA DOURADA em destaque absoluto!
  buildGoblet(partyTable, 0.18, 0.77, -0.14, false);
  buildGoblet(partyTable, 0.36, 0.77, 0.16, false);
  buildGoblet(partyTable, 0.62, 0.77, -0.18, false);
  buildGoblet(partyTable, 0.76, 0.77, 0.12, false);
  const heroGoldGoblet = buildGoblet(partyTable, 0.44, 0.77, -0.05, true);
  heroGoldGoblet.scale.setScalar(1.18);

  // Pistas no tapete perto da lareira (taça dourada caída + caneta azul de treino no clímax)
  const fallenClues = new T.Group();
  fallenClues.position.set(-2.05, 0.02, 1.95);
  root.add(fallenClues);
  const fallenCup = buildGoblet(fallenClues, 0, 0.04, 0, true);
  fallenCup.rotation.z = Math.PI / 2;
  const bluePen = cyl(fallenClues, 0.016, 0.016, 0.18, 0.24, 0.018, 0.12, mat('#2c72c7', { roughness: 0.3 }), 10);
  bluePen.rotation.set(Math.PI / 2, 0.4, 0.6);

  // VITROLA ANTIGA NO APARADOR (fora da tomada, disco que gira!)
  const vitrolaGroup = new T.Group();
  vitrolaGroup.position.set(4.65, 0, -0.75);
  vitrolaGroup.rotation.y = -Math.PI / 2;
  root.add(vitrolaGroup);
  box(vitrolaGroup, 1.15, 0.84, 0.56, 0, 0.42, 0, matDarkWood); // aparador
  box(vitrolaGroup, 0.52, 0.20, 0.48, 0, 0.94, 0, mat('#5c3822', { roughness: 0.52 })); // caixa madeira
  const vinylDisc = cyl(vitrolaGroup, 0.19, 0.19, 0.014, -0.04, 1.05, 0, mat('#14171c', { roughness: 0.28, metalness: 0.35 }), 22);
  const vinylLabel = cyl(vitrolaGroup, 0.058, 0.058, 0.017, -0.04, 1.051, 0, mat('#a83232', { roughness: 0.5 }), 14);
  // Braço da agulha
  const toneArm = box(vitrolaGroup, 0.02, 0.02, 0.26, 0.14, 1.09, -0.04, matBrass, false);
  toneArm.rotation.y = 0.42;
  // Corneta dourada vintage da vitrola
  cyl(vitrolaGroup, 0.026, 0.032, 0.26, 0.18, 1.16, -0.14, matBrass, 10);
  const horn = new T.Mesh(new T.ConeGeometry(0.22, 0.42, 18, 1, true), mat('#dfb14c', { roughness: 0.26, metalness: 0.85, side: T.DoubleSide }));
  horn.position.set(0.10, 1.34, -0.02);
  horn.rotation.set(-0.78, 0.25, 0.22);
  vitrolaGroup.add(horn);
  // Fio elétrico solto pendurado fora da tomada na parede!
  const plugCord = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.58, 6), mat('#1a1c20'));
  plugCord.position.set(0.45, 0.62, -0.24);
  plugCord.rotation.z = 0.22;
  vitrolaGroup.add(plugCord);

  // ESTANTE DE LIVROS CHEIA DE DETALHES (parede de fundo direita x = 3.85, z = 4.55)
  const shelf = new T.Group();
  shelf.position.set(3.95, 0, 4.52);
  root.add(shelf);
  box(shelf, 1.75, 2.45, 0.42, 0, 1.225, 0, matDarkWood);
  box(shelf, 1.62, 2.30, 0.36, 0, 1.225, -0.05, mat('#2d1e15', { roughness: 0.88 }), false);
  const bookColors = ['#7c262b', '#234466', '#2d5c44', '#b5842c', '#583d6b', '#8f5236', '#c9beaa'];
  for (let row = 0; row < 5; row++) {
    const sy = 0.32 + row * 0.46;
    box(shelf, 1.66, 0.045, 0.38, 0, sy, -0.01, matDarkWood, false);
    for (let b = 0; b < 9; b++) {
      if ((row + b) % 7 === 0) continue; // espaçamento orgânico
      const bh = 0.24 + hash(row * 13 + b * 7) * 0.14;
      const bw = 0.065 + hash(row * 5 + b * 11) * 0.045;
      box(shelf, bw, bh, 0.24, -0.68 + b * 0.165, sy + bh * 0.5 + 0.02, -0.04, mat(bookColors[(row * 3 + b) % bookColors.length], { roughness: 0.78 }), false);
    }
  }

  // ABAJURES QUENTES NA SALA
  emissiveLamps.push(buildLamp(root, -0.45, 0, 4.15, 1.52));
  emissiveLamps.push(buildLamp(root, 4.75, 0, 2.85, 1.48));
  buildPlant(root, -4.65, 0, -3.95, 1.15);
  buildPlant(root, 4.65, 0, -3.95, 1.0);

  // RETRATO ANTIGO DA FESTA DE 20 ANOS ATRÁS (parede de fundo x = -2.25, z = 4.82, voltado para -Z!)
  const portraitGroup = new T.Group();
  portraitGroup.position.set(-2.25, 2.08, 4.82);
  root.add(portraitGroup);
  box(portraitGroup, 1.48, 1.82, 0.09, 0, 0, 0, matBrass); // moldura dourada ornamentada
  box(portraitGroup, 1.32, 1.66, 0.10, 0, 0, -0.01, mat('#2a1d14'), false);
  const portraitPlane = new T.Mesh(
    new T.PlaneGeometry(1.20, 1.52),
    mat('#ffffff', { map: makeOldPortraitTex(), roughness: 0.55 })
  );
  portraitPlane.rotation.y = Math.PI; // voltado para -Z (câmera da sala!)
  portraitPlane.position.z = -0.065;
  portraitGroup.add(portraitPlane);

  // Quadro costeiro na parede de fundo acima do sofá
  const seaArtGroup = new T.Group();
  seaArtGroup.position.set(1.45, 2.12, 4.82);
  root.add(seaArtGroup);
  box(seaArtGroup, 1.95, 1.24, 0.07, 0, 0, 0, matDarkWood);
  const seaArt = new T.Mesh(new T.PlaneGeometry(1.78, 1.08), mat('#ffffff', { map: makeSeaArtTex(), roughness: 0.6 }));
  seaArt.rotation.y = Math.PI;
  seaArt.position.z = -0.04;
  seaArtGroup.add(seaArt);

  // Arandelas quentes na parede de fundo
  for (const sx of [-3.65, -0.65, 2.85]) {
    const sMat = mat('#ffdfa8', { emissive: '#ffbb5c', emissiveIntensity: 1.1 });
    emissiveLamps.push(sMat);
    box(root, 0.12, 0.24, 0.12, sx, 2.25, 4.78, sMat, false);
  }

  // ==========================================================================
  // 2) COZINHA (x: 6.5..17.5, z: -5..5, y: 0..3.35)
  // ==========================================================================
  addRoomShell(12, 0, 11, 10, 0, matKitchenFloor, matWallCream, { openLeft: true });
  // Janela grande na parede frontal da cozinha (z = -5) para a tempestade
  box(root, 5.2, 1.75, 0.30, 12, 1.95, -4.98, mat('#152638', { roughness: 0.2, metalness: 0.3 }), false);
  box(root, 5.35, 0.08, 0.34, 12, 1.08, -4.98, matMetalDark, false);
  box(root, 5.35, 0.08, 0.34, 12, 2.82, -4.98, matMetalDark, false);

  // ILHA CENTRAL DA COZINHA (x = 12, z = 0) com tampo de mármore + JARRA DE PONCHE ROXA!
  const island = new T.Group();
  island.position.set(12, 0, 0);
  root.add(island);
  const cabMat = mat('#2c3d4b', { roughness: 0.62 });
  const marbleMat = mat('#ffffff', { map: marbleTex, roughness: 0.26, metalness: 0.06 });
  box(island, 3.8, 0.94, 1.45, 0, 0.47, 0, cabMat);
  box(island, 4.05, 0.09, 1.68, 0, 0.985, 0, marbleMat);
  // Banquetas na frente da ilha
  for (const bx of [-1.15, 0, 1.15]) {
    cyl(island, 0.18, 0.18, 0.06, bx, 0.66, -1.08, matDarkWood, 12);
    cyl(island, 0.028, 0.036, 0.64, bx, 0.32, -1.08, matMetalDark, 8);
  }
  // JARRA DE PONCHE ROXA (herói da cozinha!)
  const jugGroup = new T.Group();
  jugGroup.position.set(-0.78, 1.03, -0.06);
  island.add(jugGroup);
  const jugGlass = new T.MeshPhysicalMaterial({ color: '#e2f0fa', transparent: true, opacity: 0.38, roughness: 0.06, metalness: 0.1 });
  cyl(jugGroup, 0.145, 0.175, 0.44, 0, 0.22, 0, jugGlass, 16);
  // Ponche roxo vibrante por dentro!
  cyl(jugGroup, 0.128, 0.155, 0.32, 0, 0.17, 0, mat('#7b1c82', { roughness: 0.18, emissive: '#38093d', emissiveIntensity: 0.32 }), 16);
  const jugHandle = new T.Mesh(new T.TorusGeometry(0.10, 0.016, 8, 16, Math.PI), jugGlass);
  jugHandle.position.set(0.15, 0.24, 0);
  jugHandle.rotation.z = -Math.PI / 2;
  jugGroup.add(jugHandle);
  // Taças e tábua de madeira na ilha
  buildGoblet(island, -0.35, 1.03, 0.12, true); // taça dourada na bancada
  buildGoblet(island, -0.10, 1.03, -0.18, false);
  buildGoblet(island, 0.14, 1.03, -0.15, false);
  box(island, 0.56, 0.035, 0.38, 0.95, 1.045, 0.08, matWarmWood, false); // tábua de corte
  // Fruteira
  cyl(island, 0.24, 0.14, 0.10, 1.48, 1.08, -0.15, mat('#d5cec2', { roughness: 0.4 }), 14);
  for (const [fx, fz, fc] of [[1.42, -0.18, '#c9382e'], [1.54, -0.12, '#e0a928'], [1.48, -0.15, '#598c35']]) {
    const fr = new T.Mesh(new T.SphereGeometry(0.055, 8, 8), mat(fc, { roughness: 0.5 }));
    fr.position.set(fx, 1.15, fz);
    island.add(fr);
  }

  // ARMÁRIOS DE COZINHA, PIA E GELADEIRA (parede fundo z = 4.4)
  box(root, 6.8, 0.94, 0.85, 12.6, 0.47, 4.45, cabMat); // armários inferiores
  box(root, 6.85, 0.08, 0.90, 12.6, 0.98, 4.43, marbleMat); // bancada
  box(root, 6.6, 0.82, 0.52, 12.6, 2.28, 4.62, cabMat); // armários aéreos
  // Puxadores metálicos nos armários
  for (let i = 0; i < 8; i++) {
    box(root, 0.03, 0.16, 0.04, 9.6 + i * 0.84, 0.72, 4.00, matSteel, false);
    box(root, 0.03, 0.16, 0.04, 9.6 + i * 0.84, 2.04, 4.34, matSteel, false);
  }
  // Pia de inox + torneira curva
  box(root, 0.96, 0.03, 0.58, 13.6, 1.025, 4.38, matSteel, false);
  box(root, 0.82, 0.02, 0.46, 13.6, 1.032, 4.38, mat('#444e58', { roughness: 0.3, metalness: 0.8 }), false);
  cyl(root, 0.018, 0.022, 0.34, 13.6, 1.20, 4.68, matSteel, 8);
  const spout = new T.Mesh(new T.TorusGeometry(0.085, 0.014, 6, 12, Math.PI), matSteel);
  spout.position.set(13.6, 1.36, 4.59);
  spout.rotation.y = Math.PI / 2;
  root.add(spout);

  // GELADEIRA DE INOX GRANDE (canto direito z = 4.25, x = 16.65)
  const fridge = new T.Group();
  fridge.position.set(16.65, 0, 4.18);
  root.add(fridge);
  box(fridge, 1.15, 2.22, 0.92, 0, 1.11, 0, mat('#b8c2cc', { roughness: 0.28, metalness: 0.72 }));
  box(fridge, 0.025, 2.16, 0.04, 0, 1.11, -0.46, mat('#2c343d'), false); // fenda porta dupla
  for (const hx of [-0.08, 0.08]) box(fridge, 0.03, 0.72, 0.05, hx, 1.38, -0.49, matSteel, false);
  box(fridge, 0.22, 0.34, 0.03, -0.32, 1.46, -0.47, mat('#15202b', { emissive: '#225d80', emissiveIntensity: 0.6 }), false); // dispenser água

  // FOGÃO E COIFA (parede direita x = 16.8, z = 0.2)
  box(root, 0.85, 0.96, 1.25, 16.95, 0.48, 0.2, mat('#262d36', { roughness: 0.35, metalness: 0.6 }));
  box(root, 0.78, 0.32, 1.30, 16.92, 2.35, 0.2, matSteel);
  cyl(root, 0.14, 0.14, 0.18, 16.85, 1.06, 0.0, matSteel, 14); // panela

  // PORTA DO PORÃO COM TRINCO (parede fundo esquerda da cozinha x = 7.8, z = 4.86)
  box(root, 1.12, 2.32, 0.14, 7.8, 1.16, 4.86, matDarkWood);
  box(root, 0.16, 0.06, 0.06, 8.18, 1.15, 4.76, matBrass, false); // trinco

  // LUMINÁRIAS PENDENTES SOBRE A ILHA DA COZINHA
  for (const px of [10.8, 12.0, 13.2]) {
    cyl(root, 0.01, 0.01, 0.85, px, 2.92, 0, matMetalDark, 6, false);
    const pMat = mat('#ffebc4', { emissive: '#ffcf80', emissiveIntensity: 1.2 });
    emissiveLamps.push(pMat);
    const dome = new T.Mesh(new T.SphereGeometry(0.14, 12, 8), pMat);
    dome.position.set(px, 2.48, 0);
    root.add(dome);
  }

  // CÂMERA OCULTA DA COZINHA (Arquivo 20) com LED vermelho!
  const camBody = box(root, 0.16, 0.12, 0.22, 16.4, 2.95, 4.45, mat('#181d24', { roughness: 0.4, metalness: 0.5 }), false);
  camBody.rotation.y = -0.78;
  const camLedMat = mat('#ff293b', { emissive: '#ff1f30', emissiveIntensity: 2.0 });
  const camLed = new T.Mesh(new T.SphereGeometry(0.022, 8, 8), camLedMat);
  camLed.position.set(16.28, 2.95, 4.35);
  root.add(camLed);

  // ==========================================================================
  // 3) VARANDA COBERTA, PISCINA DE BORDA INFINITA E MAR NA TEMPESTADE
  // ==========================================================================
  // Piso deck da varanda + deck da piscina
  box(root, 13, 0.24, 12, 0, -0.12, -11, matDeck, false, true);
  box(root, 17, 0.24, 13, 0, -0.12, -23.2, matStone, false, true);

  // Cobertura de madeira e colunas da varanda
  for (const px of [-5.2, 5.2]) {
    cyl(root, 0.16, 0.18, 3.35, px, 1.675, -15.8, matDarkWood, 12);
    // Arandela externa quente na coluna
    const wl = mat('#ffe0a6', { emissive: '#ffba59', emissiveIntensity: 1.0 });
    emissiveLamps.push(wl);
    box(root, 0.16, 0.28, 0.16, px, 2.25, -15.56, wl, false);
  }
  box(root, 12.2, 0.22, 11.4, 0, 3.38, -10.8, matDarkWood, false);
  // Vigas da pérgola
  for (let vz = -15.2; vz <= -6.2; vz += 1.5) {
    box(root, 11.4, 0.14, 0.16, 0, 3.24, vz, mat('#3b281c'), false);
  }

  // Móveis externos da varanda (sofá de fibra + mesa lateral + plantas)
  box(root, 1.0, 0.42, 2.4, -4.3, 0.24, -11.5, mat('#594b3e', { roughness: 0.85 }));
  box(root, 0.22, 0.52, 2.4, -4.72, 0.56, -11.5, mat('#594b3e', { roughness: 0.85 }));
  box(root, 0.85, 0.14, 2.2, -4.22, 0.48, -11.5, mat('#d9d1c2', { roughness: 0.85 }));
  buildPlant(root, -4.6, 0, -14.8, 1.35);
  buildPlant(root, 4.6, 0, -14.8, 1.35);

  // PISCINA DE BORDA INFINITA (x: -6..6, z: -27.5..-19.5)
  const poolFloor = new T.Mesh(new T.PlaneGeometry(12.2, 8.2), mat('#ffffff', { map: poolTileTex, roughness: 0.35 }));
  poolFloor.rotation.x = -Math.PI / 2;
  poolFloor.position.set(0, -0.22, -23.5);
  root.add(poolFloor);

  // Borda de pedra da piscina + faixas LED subaquáticas brilhantes!
  box(root, 13.0, 0.14, 0.45, 0, 0.04, -19.3, matStone);
  box(root, 0.45, 0.14, 8.6, -6.3, 0.04, -23.5, matStone);
  box(root, 0.45, 0.14, 8.6, 6.3, 0.04, -23.5, matStone);
  box(root, 13.0, 0.16, 0.25, 0, -0.02, -27.7, matStone); // borda infinita

  const poolGlowMat = mat('#4de6ff', { emissive: '#1ecbe8', emissiveIntensity: 1.5 });
  box(root, 11.4, 0.08, 0.06, 0, -0.10, -19.55, poolGlowMat, false);
  box(root, 11.4, 0.08, 0.06, 0, -0.10, -27.45, poolGlowMat, false);

  // Superfície d'água da piscina com reflexo e anéis de chuva
  const poolWaterMat = new T.MeshPhysicalMaterial({
    color: '#1995b5',
    emissive: '#0c4e66',
    emissiveIntensity: 0.45,
    roughness: 0.10,
    metalness: 0.22,
    transparent: true,
    opacity: 0.78,
    side: T.DoubleSide,
  });
  const water = new T.Mesh(new T.PlaneGeometry(12.2, 8.1), poolWaterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.015, -23.5);
  root.add(water);

  // Anéis animados de pingos de chuva na piscina
  const ripples = [];
  for (let i = 0; i < 14; i++) {
    const rp = new T.Mesh(
      new T.RingGeometry(0.08, 0.12, 16),
      new T.MeshBasicMaterial({ color: '#b5f0ff', transparent: true, opacity: 0.55, side: T.DoubleSide })
    );
    rp.rotation.x = -Math.PI / 2;
    rp.position.set((hash(i * 13) - 0.5) * 10.2, 0.03, -20.2 - hash(i * 29) * 6.5);
    root.add(rp);
    ripples.push({ mesh: rp, phase: hash(i * 7) });
  }

  // Espreguiçadeiras ao lado da piscina
  for (const sx of [-7.4, 7.4]) {
    box(root, 0.85, 0.26, 2.1, sx, 0.16, -22.2, mat('#44382f'));
    const back = box(root, 0.82, 0.10, 0.75, sx, 0.42, -21.2, mat('#d8d2c5'));
    back.rotation.x = 0.55;
  }

  // Luz subaquática turquesa da piscina (garante leitura linda na tempestade/apagão!)
  const poolLight = new T.PointLight('#2bd4f2', 11, 18, 1.25);
  poolLight.position.set(0, 0.85, -22.8);
  root.add(poolLight);

  // PENHASCO E MAR TEMPESTUOSO AO FUNDO
  const seaMat = mat('#0e2536', { roughness: 0.22, metalness: 0.35 });
  const sea = new T.Mesh(new T.PlaneGeometry(120, 60), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -1.8, -56);
  root.add(sea);
  // Rochas da falésia nas laterais
  for (const [rx, ry, rz, rs] of [[-13, -1.2, -31, 3.8], [14, -1.0, -32, 4.2], [-18, -0.5, -24, 3.2], [18, -0.8, -25, 3.5]]) {
    const rock = new T.Mesh(new T.DodecahedronGeometry(rs, 1), mat('#242b33', { roughness: 0.94 }));
    rock.position.set(rx, ry, rz);
    rock.scale.set(1.2, 0.85, 1.1);
    root.add(rock);
  }

  // ==========================================================================
  // 4) ESCADA DE MADEIRA COM TAPETE E CORRIMÃO (x = -11, sobe z: 2.3..8.4, y: 0..3.92)
  // ==========================================================================
  addRoomShell(-11, 0, 9, 10, 0, matWoodFloor, matWallCream, { openRight: true, openBack: true, noCeiling: true });
  // Paredes laterais altas acompanhando a escada até o andar superior
  box(root, 0.24, 7.6, 10.2, -15.5, 3.8, 0.0, matWallCream, false, true);
  box(root, 0.24, 7.6, 10.2, -6.5, 3.8, 0.0, matWallCream, false, true);

  // 12 degraus de madeira com tapete vinho central e balaustrada nos dois lados
  // Alinhados para Nina em [-11, 1.4, 5] pisar exatamente no degrau e Sofia ficar no patamar [-11, 4, 9]!
  const runnerMat = mat('#73212d', { roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const sy = i * 0.32 + 0.14;
    const sz = 2.35 + i * 0.54;
    box(root, 2.95, 0.26, 0.58, -11, sy, sz, matDarkWood);
    box(root, 1.45, 0.28, 0.60, -11, sy + 0.01, sz, runnerMat, false); // passadeira vinho
    for (const bx of [-12.38, -9.62]) {
      cyl(root, 0.028, 0.028, 0.92, bx, sy + 0.56, sz, matDarkWood, 8);
    }
  }
  // Corrimão inclinado contínuo nos dois lados + pilares de início
  for (const bx of [-12.38, -9.62]) {
    box(root, 0.14, 1.12, 0.14, bx, 0.56, 2.15, matDarkWood);
    const rail = box(root, 0.09, 0.08, 7.5, bx, 2.92, 5.4, matWarmWood);
    rail.rotation.x = -Math.atan2(3.84, 6.48);
  }
  // Patamar superior da escada (onde Sofia aparece em [-11, 4, 9]!)
  box(root, 4.4, 0.22, 2.2, -11, 3.90, 9.2, matDarkWood);
  box(root, 1.8, 0.24, 2.0, -11, 3.91, 9.2, runnerMat, false);

  // Quadros em escada na parede esquerda
  for (let i = 0; i < 4; i++) {
    box(root, 0.07, 0.78, 0.62, -15.32, 1.75 + i * 0.58, 1.6 + i * 1.15, matBrass, false);
    box(root, 0.08, 0.64, 0.48, -15.29, 1.75 + i * 0.58, 1.6 + i * 1.15, mat('#594c3e'), false);
  }

  // ==========================================================================
  // 5) ANDAR SUPERIOR — 3 QUARTOS (y = 4.0, z = 10)
  // ==========================================================================
  // --- QUARTO 1 (Suíte Caio e Nina: x = -11, y = 4, z = 10) ---
  // Piso começa em z = 8.1 para não obstruir a subida da escada no Plano 5!
  box(root, 10, 0.24, 7.0, -11, 3.88, 11.5, matWoodFloor, false, true);
  addCeiling(-11, 10, 10, 10, 7.35, '#dad2c2');
  box(root, 0.24, 3.35, 10, -16, 5.675, 10, matWallCream, false, true);
  box(root, 0.24, 3.35, 10, -6, 5.675, 10, matWallCream, false, true);
  box(root, 10, 3.35, 0.24, -11, 5.675, 15, matWallCream, false, true);
  // Tapete + Cama Queen + Mesa de cabeceira + Abajur
  box(root, 4.2, 0.02, 3.2, -11.5, 4.015, 11.2, mat('#3f4c59', { roughness: 0.92 }), false);
  buildBed(root, -13.1, 4, 11.6, 2.15, 2.35, '#2b3d54');
  box(root, 0.58, 0.58, 0.52, -11.55, 4.29, 12.45, matDarkWood);
  emissiveLamps.push(buildLamp(root, -11.55, 4.58, 12.45, 0.36));

  // Escrivaninha do Caio em (-8.2, 4, 12.3) com gavetas reviradas, contrato, foto antiga e celular!
  const desk1 = new T.Group();
  desk1.position.set(-8.2, 4, 12.35);
  root.add(desk1);
  box(desk1, 2.05, 0.07, 0.85, 0, 0.78, 0, matDarkWood);
  box(desk1, 0.58, 0.74, 0.78, -0.68, 0.37, 0, matDarkWood);
  box(desk1, 0.58, 0.74, 0.78, 0.68, 0.37, 0, matDarkWood);
  // Gaveta puxada aberta (Tina revirou!)
  box(desk1, 0.52, 0.18, 0.45, -0.68, 0.56, -0.52, matWarmWood);
  // Contrato da casa + foto amarelada espalhados sobre a escrivaninha
  const contractMesh = new T.Mesh(new T.PlaneGeometry(0.34, 0.44), mat('#ffffff', { map: makeContractTex(), roughness: 0.88 }));
  contractMesh.rotation.set(-Math.PI / 2, 0, 0.22);
  contractMesh.position.set(-0.22, 0.822, -0.05);
  desk1.add(contractMesh);
  const oldPhoto = new T.Mesh(new T.PlaneGeometry(0.22, 0.28), mat('#ffffff', { map: makeOldPortraitTex(), roughness: 0.7 }));
  oldPhoto.rotation.set(-Math.PI / 2, 0, -0.35);
  oldPhoto.position.set(0.18, 0.824, 0.08);
  desk1.add(oldPhoto);
  // Celular de Caio brilhando azul na escrivaninha!
  box(desk1, 0.11, 0.015, 0.20, 0.52, 0.825, -0.10, mat('#18202a', { roughness: 0.3 }));
  box(desk1, 0.095, 0.017, 0.175, 0.52, 0.827, -0.10, mat('#8be0ff', { emissive: '#59c6ff', emissiveIntensity: 1.6 }), false);
  // Cadeira da escrivaninha + janela com cortinas
  box(desk1, 0.52, 0.06, 0.50, 0.1, 0.46, -0.78, mat('#2f3944'));
  box(desk1, 0.52, 0.52, 0.06, 0.1, 0.72, -1.0, mat('#2f3944'));
  box(root, 2.8, 1.9, 0.12, -10.8, 5.75, 14.84, mat('#1e3854', { emissive: '#22496e', emissiveIntensity: 0.55 }), false);
  for (const cx of [-12.35, -9.25]) box(root, 0.45, 2.35, 0.16, cx, 5.65, 14.74, mat('#8f7f6b', { roughness: 0.9 }), false);

  // --- QUARTO 2 (Tina e Maya: x = 0, y = 4, z = 10) ---
  addRoomShell(0, 10, 10, 10, 4, matWoodFloor, matWallCream, { openFront: true });
  box(root, 3.8, 0.02, 3.0, 0.2, 4.015, 10.6, mat('#695070', { roughness: 0.92 }), false);
  // Cama alinhada para Maya (pos: [1, 4, 10], pose: 'sentado') sentar na beirada!
  buildBed(root, 1.15, 4, 11.45, 2.05, 2.25, '#7c5c96');
  // Escrivaninha com notebook aberto da Maya + abajur
  box(root, 1.55, 0.07, 0.72, -2.2, 4.78, 12.6, matWarmWood);
  box(root, 0.08, 0.78, 0.65, -2.9, 4.39, 12.6, matDarkWood);
  box(root, 0.08, 0.78, 0.65, -1.5, 4.39, 12.6, matDarkWood);
  // Notebook aberto com tela brilhando!
  box(root, 0.44, 0.02, 0.30, -2.2, 4.83, 12.55, mat('#2c333d'));
  const laptopScreen = box(root, 0.44, 0.30, 0.02, -2.2, 4.98, 12.70, mat('#9ad7ff', { emissive: '#4fa8e8', emissiveIntensity: 1.25 }), false);
  laptopScreen.rotation.x = -0.18;
  emissiveLamps.push(buildLamp(root, -3.4, 4, 12.2, 1.38));
  // Janela + pôsteres na parede
  box(root, 2.4, 1.75, 0.12, -0.2, 5.75, 14.84, mat('#1e3854', { emissive: '#22496e', emissiveIntensity: 0.5 }), false);
  box(root, 0.78, 1.05, 0.05, 2.4, 5.85, 14.82, mat('#c99528'), false);
  box(root, 0.78, 1.05, 0.05, 3.4, 5.65, 14.82, mat('#69458c'), false);

  // --- QUARTO 3 (Leo e Gael: x = 11, y = 4, z = 10) ---
  addRoomShell(11, 10, 10, 10, 4, matWoodFloor, matWallCream, { openFront: true });
  box(root, 3.8, 0.02, 3.0, 11.0, 4.015, 10.8, mat('#354659', { roughness: 0.92 }), false);
  buildBed(root, 9.2, 4, 11.75, 2.0, 2.25, '#2b4f7a');
  // Cômoda + mochila do Gael + abajur
  box(root, 1.45, 0.88, 0.56, 13.6, 4.44, 12.4, matDarkWood);
  box(root, 0.48, 0.42, 0.28, 13.4, 5.09, 12.35, mat('#223347', { roughness: 0.85 })); // mochila do Gael
  emissiveLamps.push(buildLamp(root, 14.0, 4.88, 12.4, 0.36));
  box(root, 2.6, 1.85, 0.12, 11.2, 5.75, 14.84, mat('#1e3854', { emissive: '#22496e', emissiveIntensity: 0.5 }), false);

  // ==========================================================================
  // 6) SUBSOLO: PORÃO (x = 0, y = -4, z = 10) — Quadro de Luz, Adega e Poeira
  // ==========================================================================
  addRoomShell(0, 10, 11, 10, -4, matConcrete, matBaseStone, { openFront: true, openRight: true, noTrim: true, ceilColor: '#3a3f46' });
  // Parede divisória parcial entre Porão e Garagem (com porta interna!)
  box(root, 0.28, 3.35, 3.8, 5.5, -2.325, 13.1, matBaseStone, false, true);
  box(root, 0.28, 3.35, 3.8, 5.5, -2.325, 6.9, matBaseStone, false, true);
  box(root, 0.28, 0.95, 2.4, 5.5, -1.12, 10.0, matBaseStone, false, true);
  // Vigas expostas e canos metálicos no teto do porão
  for (let pz = 6.5; pz <= 13.5; pz += 2.2) {
    box(root, 10.6, 0.20, 0.22, 0, -0.78, pz, matDarkWood, false);
  }
  cyl(root, 0.05, 0.05, 10.4, 0, -0.96, 12.2, mat('#695444', { metalness: 0.65, roughness: 0.45 }), 10, false).rotation.z = Math.PI / 2;

  // QUADRO DE LUZ / DISJUNTORES (parede esquerda x = -5.25, z = 10.4 — foco do Plano 9!)
  const breakerBox = new T.Group();
  breakerBox.position.set(-5.22, -2.35, 10.4);
  root.add(breakerBox);
  box(breakerBox, 0.18, 1.35, 0.98, 0, 0, 0, mat('#343c44', { roughness: 0.45, metalness: 0.65 }));
  box(breakerBox, 0.12, 1.18, 0.84, 0.06, 0, 0, mat('#1e2328', { roughness: 0.6 }), false);
  // Porta do quadro aberta para o lado + adesivo amarelo de raio!
  const openDoor = box(breakerBox, 0.04, 1.32, 0.94, 0.42, 0, 0.62, mat('#444e58', { roughness: 0.45, metalness: 0.6 }));
  openDoor.rotation.y = -0.65;
  const warnSign = new T.Mesh(new T.PlaneGeometry(0.32, 0.32), mat('#ffffff', { map: makeWarningTex(), roughness: 0.5 }));
  warnSign.position.set(0.45, 0.18, 0.58);
  warnSign.rotation.y = Math.PI / 2 - 0.65;
  breakerBox.add(warnSign);
  // Fileira de disjuntores + CHAVE GERAL VERMELHA ABAIXADA NA MÃO!
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    box(breakerBox, 0.08, 0.12, 0.18, 0.12, 0.25 - row * 0.24, -0.18 + col * 0.34, mat('#cfd6dc', { roughness: 0.4 }), false);
  }
  const mainSwitch = box(breakerBox, 0.12, 0.07, 0.28, 0.15, -0.38, 0, mat('#d93038', { emissive: '#6e1116', emissiveIntensity: 0.45 }), false);
  mainSwitch.rotation.z = -0.55; // abaixada!
  // Conduítes subindo do quadro
  for (const cz of [-0.25, 0.25]) cyl(breakerBox, 0.032, 0.032, 1.25, 0, 1.25, cz, matSteel, 8);

  // ADEGA DE VINHOS EMPOEIRADA + PAREDE FALSA LACRADA AO FUNDO (x = 1.6, z = 13.6)
  const cellar = new T.Group();
  cellar.position.set(1.6, -4, 13.5);
  root.add(cellar);
  // Parede falsa de pedra mais antiga atrás da adega
  box(cellar, 3.8, 3.0, 0.35, 0, 1.5, 1.15, mat('#49423a', { roughness: 0.96 }), false);
  // Estante de madeira da adega
  for (const sx of [-1.6, 0, 1.6]) box(cellar, 0.12, 2.45, 0.72, sx, 1.225, 0, matDarkWood);
  const bottleColors = ['#1f4528', '#421622', '#1c3b2c', '#362118'];
  for (let shelfIdx = 0; shelfIdx < 4; shelfIdx++) {
    const sy = 0.36 + shelfIdx * 0.56;
    box(cellar, 3.35, 0.08, 0.70, 0, sy, 0, matDarkWood);
    for (let b = 0; b < 8; b++) {
      const bx = -1.35 + b * 0.38;
      const bMat = mat(bottleColors[(shelfIdx + b) % bottleColors.length], { roughness: 0.18, metalness: 0.15 });
      const bottle = cyl(cellar, 0.055, 0.055, 0.32, bx, sy + 0.11, -0.05, bMat, 10, false);
      bottle.rotation.x = Math.PI / 2;
      const neck = cyl(cellar, 0.02, 0.03, 0.12, bx, sy + 0.11, -0.24, matBrass, 8, false);
      neck.rotation.x = Math.PI / 2;
    }
  }
  // Caixotes antigos e barril de vinho no canto do porão
  box(cellar, 0.85, 0.58, 0.65, -2.85, 0.29, -0.4, matWarmWood);
  box(cellar, 0.72, 0.48, 0.56, -2.75, 0.82, -0.45, matDarkWood);
  cyl(cellar, 0.36, 0.34, 0.88, -3.75, 0.44, -0.2, mat('#66462e', { roughness: 0.8 }), 14);

  // Poeira flutuante no porão!
  const dustCount = 90;
  const dustPos = new Float32Array(dustCount * 3);
  const dustBase = [];
  for (let i = 0; i < dustCount; i++) {
    const dx = -4.5 + hash(i * 11 + 1) * 9.0;
    const dy = -3.6 + hash(i * 17 + 3) * 2.6;
    const dz = 6.5 + hash(i * 23 + 5) * 7.2;
    dustBase.push([dx, dy, dz]);
    dustPos[i * 3] = dx;
    dustPos[i * 3 + 1] = dy;
    dustPos[i * 3 + 2] = dz;
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3));
  const dustPoints = new T.Points(dustGeo, new T.PointsMaterial({ color: '#d8e6f2', size: 0.04, transparent: true, opacity: 0.55 }));
  root.add(dustPoints);

  // ==========================================================================
  // 7) SUBSOLO: GARAGEM (x = 12, y = -4, z = 10) — Carro, Bancada e Caixa de Ferramentas
  // ==========================================================================
  addRoomShell(12, 10, 11, 10, -4, matConcrete, matStone, { openFront: true, openLeft: true, noTrim: true, ceilColor: '#454c54' });
  // Portão metálico canelado da garagem no fundo (z = 14.82)
  box(root, 6.2, 2.6, 0.14, 11.2, -2.7, 14.82, mat('#66717c', { roughness: 0.45, metalness: 0.58 }), false);
  for (let gy = -3.7; gy <= -1.6; gy += 0.35) {
    box(root, 6.1, 0.04, 0.18, 11.2, gy, 14.78, mat('#49525c'), false);
  }

  // CARRO ESPORTIVO/SUV MODERNO DO CAIO (estacionado em x = 10.6, z = 11.5 — livre da Tina em [14, -4, 10]!)
  const car = new T.Group();
  car.position.set(10.6, -4, 11.5);
  root.add(car);
  const carPaint = mat('#223548', { roughness: 0.24, metalness: 0.65 });
  const carGlass = mat('#101924', { roughness: 0.10, metalness: 0.5 });
  box(car, 2.05, 0.62, 4.55, 0, 0.62, 0, carPaint); // carroceria inferior
  box(car, 1.76, 0.52, 2.15, 0, 1.14, 0.22, carPaint); // teto/cabine
  // Para-brisa e vidro traseiro inclinados
  const windshield = box(car, 1.66, 0.50, 0.06, 0, 1.12, -0.92, carGlass, false);
  windshield.rotation.x = 0.52;
  const rearGlass = box(car, 1.66, 0.48, 0.06, 0, 1.12, 1.32, carGlass, false);
  rearGlass.rotation.x = -0.48;
  box(car, 1.80, 0.38, 1.55, 0, 1.14, 0.22, carGlass, false); // vidros laterais
  // Grade frontal + Faróis + Lanternas traseiras
  box(car, 1.15, 0.22, 0.08, 0, 0.54, -2.28, mat('#161b22', { metalness: 0.6 }), false);
  for (const hx of [-0.72, 0.72]) {
    box(car, 0.36, 0.15, 0.08, hx, 0.66, -2.28, mat('#eef7ff', { emissive: '#b4ddff', emissiveIntensity: 0.85 }), false);
    box(car, 0.38, 0.14, 0.08, hx, 0.68, 2.28, mat('#c92832', { emissive: '#8f121b', emissiveIntensity: 0.65 }), false);
  }
  // 4 Rodas com calotas metálicas
  for (const wx of [-0.98, 0.98]) {
    for (const wz of [-1.42, 1.42]) {
      const tire = cyl(car, 0.38, 0.38, 0.26, wx, 0.38, wz, mat('#181b20', { roughness: 0.88 }), 16);
      tire.rotation.z = Math.PI / 2;
      const rim = cyl(car, 0.23, 0.23, 0.28, wx, 0.38, wz, matSteel, 12, false);
      rim.rotation.z = Math.PI / 2;
    }
  }

  // BANCADA + CAIXA DE FERRAMENTAS METÁLICA (foco do Plano 10 em x = 15.2, z = 13.3!)
  const bench = new T.Group();
  bench.position.set(15.2, -4, 13.3);
  root.add(bench);
  box(bench, 2.55, 0.10, 0.96, 0, 0.92, 0, matWarmWood); // tampo grosso
  box(bench, 2.40, 0.06, 0.82, 0, 0.26, 0, mat('#3b424a')); // prateleira inferior
  for (const bx of [-1.18, 1.18]) {
    for (const bz of [-0.42, 0.42]) {
      box(bench, 0.08, 0.92, 0.08, bx, 0.46, bz, matMetalDark);
    }
  }
  // Painel perfurado (pegboard) com ferramentas penduradas na parede atrás da bancada
  box(bench, 2.35, 1.05, 0.06, 0, 1.78, 0.46, mat('#44382d', { roughness: 0.85 }), false);
  for (let ti = 0; ti < 6; ti++) {
    box(bench, 0.045, 0.34 + (ti % 2) * 0.12, 0.03, -0.85 + ti * 0.34, 1.78, 0.41, matSteel, false);
  }
  // CAIXA DE FERRAMENTAS METÁLICA VERMELHA/AÇO COM TRAVA ENFERRUJADA + PONTA DO LENÇO VINHO!
  const toolBox = new T.Group();
  toolBox.position.set(-0.15, 0.97, -0.05);
  bench.add(toolBox);
  box(toolBox, 0.78, 0.36, 0.38, 0, 0.18, 0, mat('#9e2b2b', { roughness: 0.38, metalness: 0.62 }));
  box(toolBox, 0.80, 0.06, 0.40, 0, 0.37, 0, mat('#802222', { roughness: 0.38, metalness: 0.62 }));
  // Alça metálica + trava enferrujada + fiapo branco + pontinha do lenço vinho
  box(toolBox, 0.32, 0.03, 0.03, 0, 0.46, 0, matSteel, false);
  box(toolBox, 0.08, 0.10, 0.04, 0, 0.31, -0.20, mat('#784528', { roughness: 0.85 }), false); // trava enferrujada
  box(toolBox, 0.10, 0.025, 0.08, 0.22, 0.35, -0.21, mat('#861f3b', { roughness: 0.45 }), false); // ponta lenço Nina!

  // QUADRO DE CHAVES VAZIO NA PAREDE DIREITA DA GARAGEM (x = 17.28, y = -2.35, z = 9.5)
  box(root, 0.08, 0.82, 1.15, 17.30, -2.35, 9.5, matDarkWood, false);
  for (let k = 0; k < 4; k++) {
    cyl(root, 0.014, 0.014, 0.06, 17.22, -2.20, 9.15 + k * 0.24, matBrass, 6, false).rotation.z = Math.PI / 2;
  }

  // Lâmpadas fluorescentes da garagem
  const garageLampMats = [];
  for (const gx of [10.5, 14.5]) {
    const gm = mat('#e8f6ff', { emissive: '#cfeaff', emissiveIntensity: 1.4 });
    garageLampMats.push(gm);
    box(root, 1.6, 0.07, 0.18, gx, -0.74, 10.5, gm, false);
  }

  // ==========================================================================
  // 8) CHUVA NA TEMPESTADE (partículas inclinadas determinísticas)
  // ==========================================================================
  let seed = 91731;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rainCount = 720;
  const rainArr = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) {
    const x = (rand() - 0.5) * 34;
    const z = -5.2 - rand() * 34;
    const y = rand() * 11;
    rainArr.set([x, y, z, x - 0.10, y - 0.62, z + 0.04], i * 6);
  }
  const rainGeo = new T.BufferGeometry();
  rainGeo.setAttribute('position', new T.BufferAttribute(rainArr, 3));
  const rainLines = new T.LineSegments(
    rainGeo,
    new T.LineBasicMaterial({ color: '#b4d8f0', transparent: true, opacity: 0.52 })
  );
  root.add(rainLines);

  // ==========================================================================
  // 9) ILUMINAÇÃO CINEMATOGRÁFICA (Lareira Quente vs Tempestade Fria — NUNCA escuro demais!)
  // ==========================================================================
  const ambient = new T.HemisphereLight('#a8c9eb', '#524034', 1.15);
  scene.add(ambient);

  const stormLight = new T.DirectionalLight('#a8ceff', 0.95);
  stormLight.position.set(-14, 18, -26);
  scene.add(stormLight);

  // Luzes práticas por ambiente (quentes na casa, fria/industrial no subsolo)
  const roomLights = [];
  const lightSpecs = [
    [0.5, 2.85, 0.8, '#ffda9e', 9.5, 16],    // Sala
    [12.0, 2.75, 0.2, '#ffe6be', 10.5, 16],  // Cozinha
    [-11.0, 3.2, 2.5, '#ffd8a0', 8.5, 15],   // Escada
    [-11.0, 6.8, 10.5, '#ffdca8', 9.0, 14],  // Quarto 1
    [0.0, 6.8, 10.5, '#ffe0b4', 9.0, 14],    // Quarto 2
    [11.0, 6.8, 10.5, '#ffdca8', 9.0, 14],   // Quarto 3
    [0.0, -1.15, 10.0, '#cfe0f0', 8.0, 14],  // Porão
    [12.5, -1.15, 10.5, '#dceeff', 10.0, 15],// Garagem
  ];
  for (const [lx, ly, lz, col, baseInt, dist] of lightSpecs) {
    const l = new T.PointLight(col, baseInt, dist, 1.35);
    l.position.set(lx, ly, lz);
    root.add(l);
    roomLights.push({ light: l, baseInt });
  }

  // Luz de flash fotográfico / relâmpago no topo da escada (dá recorte épico em Nina e Sofia!)
  const stairFlashLight = new T.PointLight('#cceeff', 0, 18, 1.2);
  stairFlashLight.position.set(-11, 5.2, 7.2);
  root.add(stairFlashLight);

  // ==========================================================================
  // Atualização determinística por frame
  // ==========================================================================
  function update(t, light = 'normal', fx = []) {
    const blackout = light === 'apagao';
    const flicker = light === 'piscando';
    const hasLightning = fx.includes('relampago');
    const hasFlash = fx.includes('flash');
    const hasVitrola = fx.includes('vitrola');

    // Relâmpago determinístico com picos nítidos e brilho azul-frio base
    const boltWave = Math.pow(Math.max(0, Math.sin(t * 2.6) * Math.sin(t * 17.0)), 6);
    const lightningBoost = hasLightning ? 0.55 + boltWave * 3.8 : 0;
    const camFlashBoost = hasFlash ? 0.85 + Math.pow(Math.max(0, Math.sin(t * 3.4)), 8) * 3.2 : 0;

    // Ambiente: nunca deixa o quadro virar breu preto ilegível!
    ambient.intensity = blackout ? 0.52 + lightningBoost * 0.18 : flicker ? 0.82 : 1.15;
    ambient.color.set(blackout ? '#7da9db' : '#a8c9eb');
    stormLight.intensity = (blackout ? 0.78 : 0.95) + lightningBoost + camFlashBoost * 0.5;

    // Cor do céu/névoa reage ao relâmpago
    const skyGlow = clamp(lightningBoost * 0.14, 0, 0.35);
    scene.background.setRGB(0.05 + skyGlow * 0.6, 0.09 + skyGlow * 0.75, 0.16 + skyGlow);
    fog.color.copy(scene.background);

    // Lareira: fogo continua aceso mesmo no apagão!
    const fireFlicker = 1 + 0.16 * Math.sin(t * 16) + 0.08 * Math.sin(t * 37);
    fireLight.intensity = (blackout ? 11.5 : 14.5) * fireFlicker;
    for (const fl of flames) {
      const s = 0.86 + 0.24 * Math.sin(t * 14 + fl.phase);
      fl.mesh.scale.set(0.92 + 0.1 * Math.cos(t * 11 + fl.phase), s, 0.92);
      fl.mesh.position.y = fl.baseY + (s - 1) * 0.16;
    }

    // Luzes práticas dos cômodos + abajures
    const pracFactor = blackout
      ? 0.08
      : flicker
        ? Math.sin(t * 21) * Math.cos(t * 9) > -0.15
          ? 0.95
          : 0.14
        : 1.0;

    roomLights.forEach(({ light: l, baseInt }, i) => {
      const f = flicker ? (Math.sin(t * (19 + i * 3) + i) > -0.15 ? 0.95 : 0.12) : pracFactor;
      l.intensity = baseInt * f;
    });
    for (const em of emissiveLamps) {
      em.emissiveIntensity = blackout ? 0.05 : flicker ? 0.9 * pracFactor : 1.05;
    }
    for (const gm of garageLampMats) {
      gm.emissiveIntensity = blackout ? 0.05 : flicker ? (Math.sin(t * 24) > -0.2 ? 1.5 : 0.12) : 1.4;
    }

    // Piscina: mantém um brilho turquesa mágico mesmo no apagão!
    poolLight.intensity = blackout ? 7.5 + lightningBoost * 1.4 : 11.5;
    poolGlowMat.emissiveIntensity = blackout ? 0.95 : 1.55;
    poolWaterMat.emissiveIntensity = 0.38 + 0.08 * Math.sin(t * 2.5);

    // Flash na escada
    stairFlashLight.intensity = hasFlash ? 8.5 + camFlashBoost * 3.5 : blackout ? 2.2 : 1.5;

    // LED da câmera oculta piscando
    camLedMat.emissiveIntensity = 1.0 + 1.4 * Math.max(0, Math.sin(t * 7));

    // Vitrola girando o disco + pistas no tapete no clímax
    if (hasVitrola || blackout) {
      vinylDisc.rotation.y = t * 3.5;
      vinylLabel.rotation.y = t * 3.5;
    }
    fallenClues.visible = hasVitrola || t >= 48;

    // Animação da chuva e anéis na água da piscina
    rainLines.position.y = -((t * 9.5) % 1.4);
    for (const rp of ripples) {
      const u = (t * 0.9 + rp.phase) % 1;
      const sc = 0.4 + u * 2.8;
      rp.mesh.scale.set(sc, sc, 1);
      rp.mesh.material.opacity = (1 - u) * 0.55;
    }

    // Poeira flutuante do porão
    const dp = dustGeo.attributes.position;
    for (let i = 0; i < dustBase.length; i++) {
      const [bx, by, bz] = dustBase[i];
      dp.setXYZ(i, bx + Math.sin(t * 0.6 + i) * 0.09, by + Math.cos(t * 0.45 + i * 1.3) * 0.07, bz + Math.sin(t * 0.5 + i * 0.7) * 0.08);
    }
    dp.needsUpdate = true;
  }

  return { rooms, update };
}
