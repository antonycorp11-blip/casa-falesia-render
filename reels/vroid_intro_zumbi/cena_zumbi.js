import * as T from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { FBXLoader } from './lib/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { loadMixamoAnimation } from './lib/loadMixamoAnimation.js';
import { makeWorld } from './world.js';

const canvas = document.querySelector('#c');
const playButton = document.querySelector('#play');
const caption = document.querySelector('#legenda');
const errorBox = document.querySelector('#erro');
const audio = document.querySelector('#audio');
const hudEl = document.querySelector('#hud');
const hudClockEl = document.querySelector('#hud-clock');
const hudTagEl = document.querySelector('#hud-tag');
const hudMetaEl = document.querySelector('#hud-meta');
const hudDotEl = document.querySelector('#hud-dot');

const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(36, 16 / 9, 0.05, 160);
camera.up.set(0, 1, 0);

const world = makeWorld(scene);
const worldRoot = scene.children.find((item) => item.isGroup);

// Remove a mesa do brinde no centro da sala para liberar circulação e enquadramentos.
const partyTable = worldRoot?.children.find(
  (item) => item.isGroup && item.position.distanceToSquared(new T.Vector3(-0.25, 0, 2.28)) < 0.001
);
if (partyTable) partyTable.visible = false;

// Localiza o painel de vidro principal da sala (z = -4.98, width = 10.4) para rachar e estourar.
const salaGlassPanel = worldRoot?.children.find(
  (item) =>
    item.isMesh &&
    item.material?.transparent &&
    Math.abs(item.position.z - -4.98) < 0.08 &&
    Math.abs(item.position.y - 1.65) < 0.15
);

const worldLights = [];
scene.traverse((item) => {
  if (item.isLight) worldLights.push(item);
});

// Luzes cinematográficas que acompanham o ambiente ativo (sala, cozinha, escada, porão).
const keyLight = new T.DirectionalLight('#ffdfba', 1.12);
keyLight.position.set(-2.4, 3.6, 2.8);
keyLight.target = new T.Object3D();
scene.add(keyLight, keyLight.target);

const fillLight = new T.DirectionalLight('#d8e8ff', 0.48);
fillLight.position.set(2.6, 2.2, 2.6);
fillLight.target = new T.Object3D();
scene.add(fillLight, fillLight.target);

const rimLight = new T.DirectionalLight('#7db4f0', 0.72);
rimLight.position.set(0, 2.9, -4.0);
rimLight.target = new T.Object3D();
scene.add(rimLight, rimLight.target);

// Clarão de relâmpago na varanda para recortar silhuetas e pele dos zumbis na chuva.
const lightningLight = new T.PointLight('#cbe6ff', 0, 34, 1.15);
lightningLight.position.set(0, 3.8, -8.8);
scene.add(lightningLight);

// Luz sutil para leitura dos rostos no escuro final do porão (sem virar breu ilegível).
const darkFaceLight = new T.PointLight('#6fa3db', 0, 6.5, 1.5);
darkFaceLight.position.set(0, -2.5, 8.2);
scene.add(darkFaceLight);

const clamp = T.MathUtils.clamp;
const lerp = T.MathUtils.lerp;
const smooth = (a, b, t) => {
  if (b <= a) return t >= b ? 1 : 0;
  const u = clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const pulse = (t, at, width) => Math.max(0, 1 - Math.abs(t - at) / width);
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return s - Math.floor(s);
};
function lerpAngle(a, b, u) {
  const diff = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + diff * u;
}

// ============================================================================
// SkeletonUtils.clone (Three.js r160) embutido para clonar o X Bot com rigging
// ============================================================================
function cloneSkeleton(source) {
  const sourceLookup = new Map();
  const cloneLookup = new Map();
  const clone = source.clone();
  const parallelTraverse = (a, b, cb) => {
    cb(a, b);
    for (let i = 0; i < a.children.length; i++) {
      parallelTraverse(a.children[i], b.children[i], cb);
    }
  };
  parallelTraverse(source, clone, (sourceNode, clonedNode) => {
    sourceLookup.set(clonedNode, sourceNode);
    cloneLookup.set(sourceNode, clonedNode);
  });
  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const sourceMesh = sourceLookup.get(node);
    const sourceBones = sourceMesh.skeleton.bones;
    node.skeleton = sourceMesh.skeleton.clone();
    node.bindMatrix.copy(sourceMesh.bindMatrix);
    node.skeleton.bones = sourceBones.map((bone) => cloneLookup.get(bone));
    node.bind(node.skeleton, node.bindMatrix);
  });
  return clone;
}

// ============================================================================
// Elementos de cena extras: rachadura/cacos de vidro, banco da cozinha,
// escada de 14 degraus do porão, porta de aço com trava e sombra final
// ============================================================================
function makeMat(color, opts = {}) {
  return new T.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.08,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? T.FrontSide,
  });
}

function addBox(parent, w, h, d, x, y, z, material, cast = true, receive = true) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function makeZombieSkinTex(baseHex, blotchHex, seedOffset) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = hash(i * 11 + seedOffset) * 256;
    const y = hash(i * 19 + seedOffset + 7) * 256;
    const r = 3 + hash(i * 23 + seedOffset) * 14;
    ctx.fillStyle = i % 3 === 0 ? blotchHex : 'rgba(18, 24, 18, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(22, 30, 20, 0.26)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 55; i++) {
    const x = hash(i * 31 + seedOffset) * 256;
    const y = hash(i * 37 + seedOffset) * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (hash(i * 41 + seedOffset) - 0.5) * 32, y + (hash(i * 43 + seedOffset) - 0.5) * 32);
    ctx.stroke();
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// --- 1) Rachadura e estilhaços do vidro da sala ---
const glassFxGroup = new T.Group();
scene.add(glassFxGroup);

const CRACK_IMPACT = [-0.35, 1.42, -4.93];
const crackGroup = new T.Group();
crackGroup.position.set(CRACK_IMPACT[0], CRACK_IMPACT[1], CRACK_IMPACT[2]);
crackGroup.visible = false;
glassFxGroup.add(crackGroup);

const crackMat = new T.LineBasicMaterial({ color: '#e6f6ff', transparent: true, opacity: 0.92 });
const palmMat = new T.MeshBasicMaterial({ color: '#2b332c', transparent: true, opacity: 0.42, side: T.DoubleSide });
let crackLines;
let crackPalm;

{
  // Rachadura longa de ponta a ponta + teia centrada no impacto da palma em CRACK_IMPACT
  const impact = CRACK_IMPACT;
  const segments = [
    // Fratura principal de ponta a ponta
    [-2.58, 0.28, -4.93, -1.55, 0.92, -4.93],
    [-1.55, 0.92, -4.93, -0.35, 1.42, -4.93],
    [-0.35, 1.42, -4.93, 0.88, 1.98, -4.93],
    [0.88, 1.98, -4.93, 2.58, 2.86, -4.93],
    // Segunda fratura diagonal
    [-2.48, 2.75, -4.93, -1.2, 1.95, -4.93],
    [-1.2, 1.95, -4.93, -0.35, 1.42, -4.93],
    [-0.35, 1.42, -4.93, 0.65, 0.72, -4.93],
    [0.65, 0.72, -4.93, 2.15, 0.14, -4.93],
  ];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + hash(i * 9) * 0.22;
    const len = 0.55 + hash(i * 17) * 1.45;
    const mx = impact[0] + Math.cos(a) * len * 0.52;
    const my = clamp(impact[1] + Math.sin(a) * len * 0.48, 0.12, 3.15);
    const ex = clamp(impact[0] + Math.cos(a + 0.14) * len, -2.55, 2.55);
    const ey = clamp(impact[1] + Math.sin(a - 0.12) * len, 0.12, 3.15);
    segments.push([impact[0], impact[1], -4.93, mx, my, -4.93]);
    segments.push([mx, my, -4.93, ex, ey, -4.93]);
  }
  const verts = [];
  for (const s of segments) {
    verts.push(
      s[0] - impact[0],
      s[1] - impact[1],
      s[2] - impact[2],
      s[3] - impact[0],
      s[4] - impact[1],
      s[5] - impact[2]
    );
  }
  const crackGeo = new T.BufferGeometry();
  crackGeo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  crackLines = new T.LineSegments(crackGeo, crackMat);
  crackGroup.add(crackLines);

  // Marca de palma suja no ponto de impacto
  crackPalm = new T.Mesh(new T.CircleGeometry(0.11, 12), palmMat);
  crackPalm.position.set(0, 0, -0.01);
  crackGroup.add(crackPalm);
}

const shatterGroup = new T.Group();
shatterGroup.visible = false;
glassFxGroup.add(shatterGroup);

// Paineis laterais que permanecem intactos quando os dois paineis centrais estouram
const intactSideGlassMat = new T.MeshPhysicalMaterial({
  color: '#9ec4d8',
  transparent: true,
  opacity: 0.22,
  roughness: 0.08,
  metalness: 0.14,
  side: T.DoubleSide,
});
addBox(shatterGroup, 2.55, 3.15, 0.04, -3.9, 1.65, -4.98, intactSideGlassMat, false, false);
addBox(shatterGroup, 2.55, 3.15, 0.04, 3.9, 1.65, -4.98, intactSideGlassMat, false, false);

const shardMat = new T.MeshPhysicalMaterial({
  color: '#d4f0ff',
  emissive: '#4c7994',
  emissiveIntensity: 0.28,
  transparent: true,
  opacity: 0.78,
  roughness: 0.12,
  metalness: 0.25,
  side: T.DoubleSide,
});
const shards = [];
for (let i = 0; i < 64; i++) {
  const sx = 0.06 + hash(i * 13) * 0.16;
  const sy = 0.05 + hash(i * 19) * 0.15;
  const m = new T.Mesh(new T.TetrahedronGeometry(1, 0), shardMat);
  m.scale.set(sx, sy, 0.015);
  shatterGroup.add(m);
  shards.push({
    mesh: m,
    x0: -2.45 + hash(i * 7 + 1) * 4.9,
    y0: 0.35 + hash(i * 11 + 2) * 2.55,
    z0: -4.95,
    vx: (hash(i * 17 + 3) - 0.5) * 2.6,
    vy: 0.4 + hash(i * 23 + 4) * 2.4,
    vz: 1.6 + hash(i * 29 + 5) * 4.2,
    rx: (hash(i * 31) - 0.5) * 14,
    ry: (hash(i * 37) - 0.5) * 14,
    rz: (hash(i * 41) - 0.5) * 14,
  });
}

// --- 2) Banco da cozinha onde Luna tropeça ---
const tripStool = new T.Group();
tripStool.position.set(9.55, 0, -1.05);
scene.add(tripStool);
{
  const seatMat = makeMat('#4f3626', { roughness: 0.62 });
  const legMat = makeMat('#242c35', { roughness: 0.42, metalness: 0.62 });
  const seat = new T.Mesh(new T.CylinderGeometry(0.20, 0.20, 0.06, 14), seatMat);
  seat.position.y = 0.64;
  seat.castShadow = true;
  tripStool.add(seat);
  const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.62, 10), legMat);
  pole.position.y = 0.31;
  tripStool.add(pole);
  const foot = new T.Mesh(new T.CylinderGeometry(0.18, 0.20, 0.03, 12), legMat);
  foot.position.y = 0.015;
  tripStool.add(foot);
}

// --- 3) Escada de 14 degraus para o porão + corredor + porta de aço com trava ---
const basementGroup = new T.Group();
scene.add(basementGroup);
const matBaseConcrete = makeMat('#4b5159', { roughness: 0.92, metalness: 0.04 });
const matBaseWall = makeMat('#3a4048', { roughness: 0.92, metalness: 0.05 });
const matRail = makeMat('#262d36', { roughness: 0.42, metalness: 0.72 });
const matSteelDoor = makeMat('#65727e', { roughness: 0.36, metalness: 0.78 });
const matSteelFrame = makeMat('#273038', { roughness: 0.5, metalness: 0.65 });

// Lance 1: 7 degraus descendo de (-7.5, 0, 5.1) até (-7.5, -2.0, 7.3)
for (let i = 0; i < 7; i++) {
  const sy = -((i + 1) * (2.0 / 7));
  const sz = 5.15 + i * 0.32;
  addBox(basementGroup, 1.48, 0.26, 0.36, -7.5, sy - 0.13, sz, matBaseConcrete);
}
// Patamar intermediário (y = -2.0)
addBox(basementGroup, 2.8, 0.24, 1.4, -6.9, -2.12, 7.95, matBaseConcrete);
// Lance 2: 7 degraus descendo de (-6.3, -2.0, 7.3) até (-6.3, -4.0, 4.5)
for (let i = 0; i < 7; i++) {
  const sy = -2.0 - ((i + 1) * (2.0 / 7));
  const sz = 7.25 - i * 0.42;
  addBox(basementGroup, 1.38, 0.26, 0.45, -6.3, sy - 0.13, sz, matBaseConcrete);
}
// Paredes da caixa da escada do porão (sem bloquear a câmera)
addBox(basementGroup, 0.22, 6.2, 3.9, -8.35, -1.0, 6.9, matBaseWall, false, true);
addBox(basementGroup, 3.0, 6.2, 0.22, -6.9, -1.0, 8.75, matBaseWall, false, true);
addBox(basementGroup, 0.22, 2.4, 3.6, -5.52, -0.8, 6.9, matBaseWall, false, true);
// Corrimãos dos lances
addBox(basementGroup, 0.06, 0.06, 2.5, -8.15, -0.25, 6.2, matRail, false).rotation.x = 0.72;
addBox(basementGroup, 0.06, 0.06, 3.3, -6.95, -2.25, 5.9, matRail, false).rotation.x = -0.62;

// Corredor subterrâneo em frente à porta de aço (y = -4.0, z = 2.6..5.0)
addBox(basementGroup, 8.6, 0.24, 2.8, -3.1, -4.12, 3.7, matBaseConcrete, false, true);
addBox(basementGroup, 8.6, 0.20, 2.8, -3.1, -0.58, 3.7, matBaseWall, false, true);
addBox(basementGroup, 8.6, 3.4, 0.24, -3.1, -2.3, 2.35, matBaseWall, false, true);
addBox(basementGroup, 0.24, 3.4, 2.8, -7.25, -2.3, 3.7, matBaseWall, false, true);
addBox(basementGroup, 0.24, 3.4, 2.8, 1.15, -2.3, 3.7, matBaseWall, false, true);

// Luzes frias da escada do porão e corredor
const stairLightTop = new T.PointLight('#c4d8ee', 5.2, 9.5, 1.35);
stairLightTop.position.set(-7.1, 0.4, 6.6);
basementGroup.add(stairLightTop);
const stairLightBot = new T.PointLight('#b4cfe8', 5.8, 10.5, 1.35);
stairLightBot.position.set(-4.6, -1.2, 3.7);
basementGroup.add(stairLightBot);

// Parede frontal do porão em z = 5.0 com vão da porta de aço em x = -4.82..-3.18
addBox(basementGroup, 0.68, 3.35, 0.26, -5.16, -2.325, 5.0, matBaseWall, false, true);
addBox(basementGroup, 8.68, 3.35, 0.26, 1.16, -2.325, 5.0, matBaseWall, false, true);
addBox(basementGroup, 1.64, 1.00, 0.26, -4.0, -1.15, 5.0, matBaseWall, false, true);
// Batente metálico da porta de aço
addBox(basementGroup, 0.12, 2.38, 0.32, -4.82, -2.81, 5.0, matSteelFrame);
addBox(basementGroup, 0.12, 2.38, 0.32, -3.18, -2.81, 5.0, matSteelFrame);
addBox(basementGroup, 1.76, 0.14, 0.32, -4.0, -1.62, 5.0, matSteelFrame);

// Folha pivotada da porta de aço (abre para dentro +Z encostando à esquerda)
const steelDoorPivot = new T.Group();
steelDoorPivot.position.set(-4.78, -4.0, 5.04);
basementGroup.add(steelDoorPivot);
addBox(steelDoorPivot, 1.58, 2.32, 0.11, 0.79, 1.16, 0, matSteelDoor);
// Travessas horizontais e rebites industriais
for (const ry of [0.35, 1.16, 1.96]) {
  addBox(steelDoorPivot, 1.50, 0.09, 0.15, 0.79, ry, 0, matSteelFrame, false);
}
// Maçaneta / barra de empurrar interna
addBox(steelDoorPivot, 0.52, 0.06, 0.08, 1.18, 1.06, 0.09, matRail, false);
// Trava pesada que desce no último segundo
const lockBolt = addBox(steelDoorPivot, 0.28, 0.08, 0.09, 1.44, 1.36, 0.10, makeMat('#c83b3b', { roughness: 0.4, metalness: 0.65 }), false);
// LED de status acima da porta de aço (lado interno do porão)
const lockLedMat = makeMat('#ffae33', { emissive: '#ff9922', emissiveIntensity: 1.6 });
const lockLed = new T.Mesh(new T.SphereGeometry(0.045, 10, 10), lockLedMat);
lockLed.position.set(-4.0, -1.48, 5.18);
basementGroup.add(lockLed);
const lockLedLight = new T.PointLight('#ff4030', 1.2, 4.8, 1.5);
lockLedLight.position.set(-4.0, -1.55, 5.42);
basementGroup.add(lockLedLight);

// --- 4) Presença / silhueta respirando no fundo escuro do porão (final) ---
const shadowFigure = new T.Group();
shadowFigure.position.set(0.18, -4.0, 12.35);
shadowFigure.rotation.y = Math.PI;
shadowFigure.visible = false;
scene.add(shadowFigure);
{
  const darkMat = makeMat('#0a0e14', { roughness: 0.96, metalness: 0.02 });
  const torso = new T.Mesh(new T.CylinderGeometry(0.20, 0.24, 0.72, 12), darkMat);
  torso.position.y = 1.12;
  shadowFigure.add(torso);
  const head = new T.Mesh(new T.SphereGeometry(0.145, 12, 12), darkMat);
  head.position.set(0, 1.63, 0.02);
  shadowFigure.add(head);
  for (const sx of [-0.11, 0.11]) {
    const leg = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.78, 8), darkMat);
    leg.position.set(sx, 0.39, 0);
    shadowFigure.add(leg);
  }
  for (const sx of [-0.27, 0.27]) {
    const arm = new T.Mesh(new T.CylinderGeometry(0.055, 0.048, 0.66, 8), darkMat);
    arm.position.set(sx, 1.06, 0.04);
    arm.rotation.z = sx < 0 ? 0.12 : -0.12;
    shadowFigure.add(arm);
  }
  const eyeMat = new T.MeshBasicMaterial({ color: '#9ab6cc', transparent: true, opacity: 0.55 });
  for (const ex of [-0.045, 0.045]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.011, 6, 6), eyeMat);
    eye.position.set(ex, 1.65, 0.145);
    shadowFigure.add(eye);
  }
}

// ============================================================================
// Configuração das animações Mixamo (personagens VRM + zumbis X Bot)
// ============================================================================
const MOTION_FILES = {
  idle: 'idle',
  weight_shift: 'weight_shift',
  look_around: 'look_around',
  nervously_look_around: 'nervously_look_around',
  laughing: 'laughing',
  surprised: 'surprised',
  terrified: 'terrified',
  walking: 'walking',
  walk: 'walk',
  walking_backwards: 'walking_backwards',
  running: 'running',
  fast_run: 'fast_run',
  jogging_stumble: 'jogging_stumble',
  crouched_walking: 'crouched_walking',
  kneeling: 'kneeling',
  opening: 'opening',
  pushing: 'pushing',
  talking: 'talking',
  talking2: 'talking2',
  talking_1: 'talking_1',
  talking_2: 'talking_2',
  talking_on_phone: 'talking_on_phone',
  standing_arguing: 'standing_arguing',
  yelling: 'yelling',
  yelling_out: 'yelling_out',
  happy_hand_gesture: 'pack_gestos/happy_hand_gesture',
  dismissing_gesture: 'pack_gestos/dismissing_gesture',
  angry_gesture: 'pack_gestos/angry_gesture',
  shaking_head_no: 'pack_gestos/shaking_head_no',
  look_away_gesture: 'pack_gestos/look_away_gesture',
};

const UPRIGHT_LOCOMOTION = new Set(['walking', 'walk', 'walking_backwards', 'running', 'fast_run']);
const ONE_SHOT_MOTIONS = new Set(['surprised', 'terrified', 'jogging_stumble', 'opening']);

const ZOMBIE_MOTION_FILES = {
  zombie_idle: './vrm/mixamo/pack_zumbi/zombie_idle.fbx',
  zombie_walk: './vrm/mixamo/pack_zumbi/zombie_walk.fbx',
  zombie_run: './vrm/mixamo/pack_zumbi/zombie_run.fbx',
  zombie_attack: './vrm/mixamo/pack_zumbi/zombie_attack.fbx',
  zombie_scream: './vrm/mixamo/pack_zumbi/zombie_scream.fbx',
};

const ACTORS = [
  { name: 'LUNA', url: './vrm/test.vrm', actions: {}, motionTrack: [], headY: 1.48 },
  { name: 'BIA', url: './vrm/bia.vrm', actions: {}, motionTrack: [], headY: 1.50 },
];

const ZOMBIES = [
  { id: 0, scale: 1.02, color: '#4c584e', blotch: '#323c33', joint: '#272f29' },
  { id: 1, scale: 0.96, color: '#3f4b44', blotch: '#2a332d', joint: '#232a25' },
  { id: 2, scale: 1.06, color: '#545f51', blotch: '#394236', joint: '#2b3228' },
];

let falas = [];
let words = [];
let duration = 144;
let crackStartTime = 54.094;
let shatterStartTime = 78.543;
let bootPromise;
window.ready = false;
window.DURACAO = 0;

function fail(error) {
  errorBox.textContent = String(error?.message || error);
  console.error(error);
}

async function optionalJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function setupTiming() {
  falas = falas
    .filter((f) => Number.isFinite(Number(f.start)) && Number.isFinite(Number(f.end)))
    .map((f) => ({ ...f, start: Number(f.start), end: Number(f.end) }))
    .sort((a, b) => a.start - b.start);
  words = words
    .filter((w) => Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)))
    .map((w) => ({ ...w, start: Number(w.start), end: Number(w.end) }))
    .sort((a, b) => a.start - b.start);
  const crackLine = falas.find((f) => /rachadura/i.test(String(f.text || '')));
  if (crackLine) crackStartTime = crackLine.start;
  const shatterLine = falas.find((f) => /vidro\s+estoura/i.test(String(f.text || '')));
  if (shatterLine) shatterStartTime = shatterLine.start;
  const speechEnd = Math.max(0, ...falas.map((f) => f.end));
  const audioDur = Number.isFinite(audio.duration) && audio.duration > 1 ? audio.duration : Math.max(speechEnd + 1.8, 143);
  duration = audioDur + 1;
  window.DURACAO = duration;
}

// ============================================================================
// Carregamento dos VRMs e FBX Mixamo
// ============================================================================
async function loadClipForActor(actor, key, file) {
  try {
    const clip = await loadMixamoAnimation(`./vrm/mixamo/${file}.fbx`, actor.vrm);
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.position')) continue;
      const first = track.values.slice(0, 3);
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = first[0];
        track.values[i + 2] = first[2];
        if (UPRIGHT_LOCOMOTION.has(key)) track.values[i + 1] = first[1];
      }
    }
    const action = actor.mixer.clipAction(clip);
    action.setLoop(ONE_SHOT_MOTIONS.has(key) ? T.LoopOnce : T.LoopRepeat);
    action.clampWhenFinished = true;
    actor.actions[key] = action;
  } catch (err) {
    console.warn(`[${actor.name}] falha ao carregar ${file}.fbx:`, err);
  }
}

async function loadActor(actor) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(actor.url);
  actor.vrm = gltf.userData.vrm;
  if (!actor.vrm) throw new Error(`${actor.name}: VRM inválido`);
  if (actor.vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(actor.vrm);
  actor.baseYaw = actor.vrm.scene.rotation.y;
  scene.add(actor.vrm.scene);
  actor.vrm.scene.updateMatrixWorld(true);
  const head = actor.vrm.humanoid.getNormalizedBoneNode('head');
  actor.headY = head ? head.getWorldPosition(new T.Vector3()).y : 1.48;
  actor.gaze = new T.Object3D();
  scene.add(actor.gaze);
  if (actor.vrm.lookAt) actor.vrm.lookAt.target = actor.gaze;
  actor.mixer = new T.AnimationMixer(actor.vrm.scene);
  actor.actions = {};

  const entries = Object.entries(MOTION_FILES);
  const batchSize = 6;
  for (let i = 0; i < entries.length; i += batchSize) {
    await Promise.all(entries.slice(i, i + batchSize).map(([k, f]) => loadClipForActor(actor, k, f)));
  }
  if (!actor.actions.idle) throw new Error(`${actor.name}: animação base idle não carregada`);
}

function normBoneName(name) {
  return String(name || '')
    .replace(/^mixamorig\d*:?/i, '')
    .toLowerCase();
}

function adaptClipForZombie(rawClip, model, motionName) {
  const boneMap = new Map();
  model.traverse((obj) => {
    if (obj.name) boneMap.set(normBoneName(obj.name), obj.name);
  });
  const clip = rawClip.clone();
  for (const track of clip.tracks) {
    const dot = track.name.indexOf('.');
    if (dot < 0) continue;
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    if (!model.getObjectByName(nodeName)) {
      const mapped = boneMap.get(normBoneName(nodeName));
      if (mapped) track.name = `${mapped}.${prop}`;
    }
    if (prop === 'position' && normBoneName(nodeName) === 'hips') {
      const first = track.values.slice(0, 3);
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = first[0];
        track.values[i + 2] = first[2];
        if (motionName === 'zombie_walk' || motionName === 'zombie_run') {
          track.values[i + 1] = first[1];
        }
      }
    }
  }
  return clip;
}

async function loadZombies() {
  const fbxLoader = new FBXLoader();
  const baseBot = await fbxLoader.loadAsync('./vrm/mixamo/pack_zumbi/x_bot.fbx');
  baseBot.updateMatrixWorld(true);

  let hipsY = 0;
  baseBot.traverse((obj) => {
    if (normBoneName(obj.name) === 'hips' && !hipsY) {
      hipsY = Math.abs(obj.getWorldPosition(new T.Vector3()).y);
    }
  });
  const bbox = new T.Box3().setFromObject(baseBot);
  const boxH = bbox.max.y - bbox.min.y;
  const baseScale = hipsY > 5 ? 0.96 / hipsY : boxH > 3 ? 1.74 / boxH : 1.0;

  const rawClips = {};
  await Promise.all(
    Object.entries(ZOMBIE_MOTION_FILES).map(async ([name, url]) => {
      try {
        const animAsset = await fbxLoader.loadAsync(url);
        const clip =
          T.AnimationClip.findByName(animAsset.animations, 'mixamo.com') || animAsset.animations[0];
        if (clip) rawClips[name] = clip;
      } catch (err) {
        console.warn(`[ZUMBI] falha ao carregar ${url}:`, err);
      }
    })
  );

  for (const z of ZOMBIES) {
    const group = new T.Group();
    scene.add(group);
    const model = cloneSkeleton(baseBot);
    model.scale.setScalar(baseScale * z.scale);
    model.updateMatrixWorld(true);
    const zBox = new T.Box3().setFromObject(model);
    if (Number.isFinite(zBox.min.y) && Math.abs(zBox.min.y) < 1.2) {
      model.position.y -= zBox.min.y;
    }

    const skinTex = makeZombieSkinTex(z.color, z.blotch, z.id * 53 + 11);
    const skinMat = new T.MeshStandardMaterial({
      color: '#ffffff',
      map: skinTex,
      roughness: 0.94 + z.id * 0.01,
      metalness: 0.02,
    });
    const jointMat = new T.MeshStandardMaterial({
      color: z.joint,
      roughness: 0.96,
      metalness: 0.02,
    });

    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const isJoint = /joint/i.test(node.name);
      node.material = isJoint ? jointMat : skinMat;
    });

    group.add(model);
    z.group = group;
    z.model = model;
    z.mixer = new T.AnimationMixer(model);
    z.actions = {};
    for (const [mName, rawClip] of Object.entries(rawClips)) {
      const adapted = adaptClipForZombie(rawClip, model, mName);
      const action = z.mixer.clipAction(adapted);
      action.setLoop(T.LoopRepeat);
      action.clampWhenFinished = true;
      z.actions[mName] = action;
    }
  }
}

// ============================================================================
// Seleção semântica e sem repetição das animações de fala
// ============================================================================
function pickSpeechMotion(line, prevSpeechMotion, seedIdx) {
  const text = String(line.text || '').toLowerCase();
  let pool;
  if (/celular|rádio|sinal/.test(text)) {
    pool = ['talking_on_phone', 'talking_1', 'talking'];
  } else if (/relaxa|chuva já passa/.test(text)) {
    pool = ['happy_hand_gesture', 'talking', 'talking2'];
  } else if (/vizinho|bêbado|vou abrir/.test(text)) {
    pool = ['dismissing_gesture', 'talking2', 'talking_1'];
  } else if (/para!|pescoço/.test(text)) {
    pool = ['standing_arguing', 'angry_gesture', 'yelling'];
  } else if (/não é bêbado|sai daí/.test(text)) {
    pool = ['angry_gesture', 'standing_arguing', 'yelling'];
  } else if (/meu deus|vai quebrar/.test(text)) {
    pool = ['yelling_out', 'terrified', 'yelling'];
  } else if (/cozinha, corre|corre!/.test(text)) {
    pool = ['yelling', 'yelling_out', 'angry_gesture'];
  } else if (/não faz barulho|fica quieta/.test(text)) {
    pool = ['shaking_head_no', 'talking_1', 'talking'];
  } else if (/ai, droga/.test(text)) {
    pool = ['jogging_stumble', 'surprised', 'yelling_out'];
  } else if (/levanta!|vem comigo/.test(text)) {
    pool = ['talking_2', 'yelling_out', 'standing_arguing'];
  } else if (/fecha!|fecha logo/.test(text)) {
    pool = ['pushing', 'yelling', 'yelling_out'];
  } else if (/\?|ouviu/.test(text)) {
    pool = ['look_away_gesture', 'talking_1', 'nervously_look_around'];
  } else {
    pool = ['talking', 'talking2', 'talking_1', 'talking_2', 'standing_arguing'];
  }
  const rotated = pool.filter((m) => m !== prevSpeechMotion);
  const chosen = rotated[seedIdx % Math.max(1, rotated.length)] || pool[0];
  return chosen;
}

// ============================================================================
// Coreografia determinística: Waypoints (sala → cozinha → escada → porão)
// ============================================================================
const LUNA_PATH = [
  // Cold open 23:12 (sala perto do vidro)
  { t: 0.0, x: -0.68, y: 0, z: -3.25, yaw: Math.PI + 0.12 },
  { t: 1.4, x: -0.68, y: 0, z: -3.25, yaw: Math.PI + 0.12 },
  { t: 2.9, x: -0.58, y: 0, z: -2.45, yaw: Math.PI + 0.16, faceYaw: true },
  { t: 10.68, x: -0.58, y: 0, z: -2.45, yaw: Math.PI + 0.22, cut: true },
  // Flashback 23:06 (sala tranquila perto do centro/sofá)
  { t: 10.69, x: -0.65, y: 0, z: 0.45, yaw: 0.56 },
  { t: 20.6, x: -0.65, y: 0, z: 0.45, yaw: 0.58 },
  { t: 21.6, x: -0.45, y: 0, z: 0.25, yaw: 1.25, faceYaw: true }, // olha para o rádio/vitrola
  { t: 26.8, x: -0.45, y: 0, z: 0.25, yaw: Math.PI - 0.15 },
  { t: 32.1, x: -0.45, y: 0, z: 0.25, yaw: Math.PI },
  // Anda até o vidro sem medo (32.1 -> 35.1)
  { t: 35.1, x: -0.65, y: 0, z: -3.20, yaw: Math.PI - 0.55 },
  { t: 36.8, x: -0.65, y: 0, z: -3.20, yaw: Math.PI - 0.48 },
  // Dá mais um passo para abrir o vidro (36.8 -> 38.0)
  { t: 38.0, x: -0.55, y: 0, z: -3.95, yaw: Math.PI + 0.05 },
  { t: 48.8, x: -0.55, y: 0, z: -3.95, yaw: Math.PI + 0.02 },
  // Recua de costas olhando para o zumbi (48.8 -> 51.3)
  { t: 51.3, x: -0.45, y: 0, z: -2.75, yaw: Math.PI, faceYaw: true },
  { t: 54.0, x: -0.45, y: 0, z: -2.75, yaw: Math.PI, faceYaw: true },
  // Recua mais diante dos 3 infectados (54.0 -> 64.5)
  { t: 58.2, x: 0.15, y: 0, z: -1.65, yaw: Math.PI - 0.15, faceYaw: true },
  { t: 64.5, x: 1.25, y: 0, z: -1.05, yaw: Math.PI - 0.35, faceYaw: true },
  { t: 67.85, x: 1.25, y: 0, z: -1.05, yaw: Math.PI - 0.52 },
  // Fuga correndo sala -> cozinha -> agachada atrás da bancada (67.85 -> 71.8)
  { t: 69.25, x: 5.5, y: 0, z: 0.55 },
  { t: 70.45, x: 9.3, y: 0, z: 1.45 },
  { t: 71.75, x: 11.35, y: 0, z: 1.75, yaw: 0.62 },
  { t: 84.4, x: 11.35, y: 0, z: 1.75, yaw: 0.62 },
  // Recua agachada pela lateral da bancada e tropeça no banco (84.4 -> 88.8)
  { t: 85.4, x: 9.65, y: 0, z: 1.15 },
  { t: 86.45, x: 9.38, y: 0, z: -0.82 },
  { t: 88.7, x: 8.85, y: 0, z: -0.58, yaw: -1.45, faceYaw: true },
  { t: 94.3, x: 8.85, y: 0, z: -0.58, yaw: -1.35 },
  // Sprint: cozinha -> sala -> escada -> 14 degraus -> porão (94.3 -> 101.4)
  { t: 95.15, x: 5.5, y: 0, z: 0.55 },
  { t: 96.35, x: -0.4, y: 0, z: -1.45 },
  { t: 97.15, x: -5.5, y: 0, z: -2.40 },
  { t: 97.65, x: -7.5, y: 0, z: -1.10 },
  { t: 98.45, x: -7.5, y: 0, z: 5.05 },
  // Lance 1 (7 degraus)
  { t: 99.05, x: -7.5, y: -2.0, z: 7.35 },
  // Patamar U-turn
  { t: 99.38, x: -6.3, y: -2.0, z: 7.55 },
  // Lance 2 (7 degraus)
  { t: 100.05, x: -6.3, y: -4.0, z: 4.50 },
  // Corredor subterrâneo -> entra pela porta de aço no porão
  { t: 100.45, x: -5.2, y: -4.0, z: 3.85 },
  { t: 100.95, x: -4.15, y: -4.0, z: 3.95 },
  { t: 101.55, x: -4.42, y: -4.0, z: 5.65, yaw: Math.PI + 0.15 },
  // Empurra a porta de aço até trancar (101.55 -> 106.5)
  { t: 105.6, x: -4.42, y: -4.0, z: 5.58, yaw: Math.PI + 0.12 },
  { t: 110.2, x: -4.35, y: -4.0, z: 6.15, yaw: Math.PI + 0.10 },
  // Recua no escuro do porão contornando a escotilha (110.2 -> 117.6)
  { t: 113.8, x: -3.55, y: -4.0, z: 9.25 },
  { t: 117.6, x: -0.68, y: -4.0, z: 9.75, yaw: Math.PI + 0.25 },
  { t: 130.9, x: -0.68, y: -4.0, z: 9.75, yaw: Math.PI + 0.45 },
  // Vira devagar para trás (+Z) ao ouvir a respiração no escuro (130.9 -> 134.2)
  { t: 134.2, x: -0.68, y: -4.0, z: 9.75, yaw: 0.18 },
  { t: 146.0, x: -0.68, y: -4.0, z: 9.75, yaw: 0.15 },
];

const BIA_PATH = [
  // Cold open 23:12
  { t: 0.0, x: 0.85, y: 0, z: -2.45, yaw: Math.PI - 0.18 },
  { t: 10.68, x: 0.85, y: 0, z: -2.25, yaw: Math.PI - 0.22, cut: true },
  // Flashback 23:06
  { t: 10.69, x: 0.88, y: 0, z: 0.38, yaw: -0.56 },
  { t: 20.6, x: 0.88, y: 0, z: 0.38, yaw: -0.56 },
  { t: 21.6, x: 1.15, y: 0, z: 0.15, yaw: 1.42, faceYaw: true }, // olha para o rádio
  { t: 26.8, x: 1.05, y: 0, z: 0.20, yaw: Math.PI + 0.12 },
  { t: 32.8, x: 1.05, y: 0, z: 0.20, yaw: Math.PI + 0.12 },
  // Acompanha cautelosamente Luna (32.8 -> 35.8)
  { t: 35.8, x: 0.98, y: 0, z: -1.85, yaw: Math.PI + 0.35 },
  { t: 54.0, x: 0.98, y: 0, z: -1.85, yaw: Math.PI + 0.30 },
  // Recua em direção à cozinha chamando Luna (54.0 -> 64.5)
  { t: 60.0, x: 1.75, y: 0, z: -0.95, yaw: Math.PI + 0.22, faceYaw: true },
  { t: 64.5, x: 2.35, y: 0, z: -0.35, yaw: -2.65, faceYaw: true },
  { t: 67.1, x: 2.35, y: 0, z: -0.35, yaw: -2.15, faceYaw: true },
  { t: 67.9, x: 2.35, y: 0, z: -0.35, yaw: 1.29 },
  // Fuga correndo sala -> cozinha -> agachada atrás da bancada (67.9 -> 71.55)
  { t: 69.1, x: 5.5, y: 0, z: 0.55 },
  { t: 70.3, x: 9.4, y: 0, z: 1.55 },
  { t: 71.55, x: 12.48, y: 0, z: 1.75, yaw: -0.62 },
  { t: 85.0, x: 12.48, y: 0, z: 1.75, yaw: -0.62 },
  // Move agachada e corre para puxar Luna após o tropeço (85.0 -> 92.0)
  { t: 88.2, x: 10.65, y: 0, z: 1.35 },
  { t: 90.2, x: 9.75, y: 0, z: 0.72 },
  { t: 92.0, x: 9.42, y: 0, z: 0.08, yaw: -2.42 },
  { t: 94.55, x: 9.42, y: 0, z: 0.08, yaw: -2.35 },
  // Sprint: cozinha -> sala -> escada -> 14 degraus -> porão (94.55 -> 101.65)
  { t: 95.4, x: 5.5, y: 0, z: 0.55 },
  { t: 96.6, x: -0.3, y: 0, z: -1.35 },
  { t: 97.4, x: -5.5, y: 0, z: -2.40 },
  { t: 97.9, x: -7.5, y: 0, z: -1.05 },
  { t: 98.7, x: -7.5, y: 0, z: 5.05 },
  { t: 99.3, x: -7.5, y: -2.0, z: 7.35 },
  { t: 99.62, x: -6.3, y: -2.0, z: 7.55 },
  { t: 100.3, x: -6.3, y: -4.0, z: 4.50 },
  { t: 100.7, x: -5.1, y: -4.0, z: 3.85 },
  { t: 101.2, x: -3.9, y: -4.0, z: 3.95 },
  { t: 101.75, x: -3.58, y: -4.0, z: 5.65, yaw: Math.PI - 0.15 },
  // Empurra a porta de aço com Luna até trancar (101.75 -> 106.5)
  { t: 105.6, x: -3.58, y: -4.0, z: 5.58, yaw: Math.PI - 0.12 },
  { t: 110.5, x: -3.55, y: -4.0, z: 6.25, yaw: Math.PI - 0.12 },
  // Recua no escuro do porão contornando a escotilha (110.5 -> 117.9)
  { t: 114.1, x: -3.05, y: -4.0, z: 9.15 },
  { t: 117.9, x: 0.72, y: -4.0, z: 9.75, yaw: Math.PI - 0.28 },
  { t: 131.2, x: 0.72, y: -4.0, z: 9.75, yaw: Math.PI - 0.45 },
  // Vira devagar para trás (+Z) ao ouvir a respiração no escuro (131.2 -> 134.5)
  { t: 134.5, x: 0.72, y: -4.0, z: 9.75, yaw: -0.18 },
  { t: 146.0, x: 0.72, y: -4.0, z: 9.75, yaw: -0.15 },
];

// Trajetórias dos 3 zumbis
const ZOMBIE_PATHS = [
  // Zumbi 0: o principal que bate no vidro, estoura, invade a sala, corre pela cozinha/escada e soca a porta de aço
  [
    { t: 0.0, x: -0.35, y: 0, z: -5.50, yaw: 0, visible: true },
    { t: 10.68, x: -0.35, y: 0, z: -5.50, yaw: 0, visible: true, cut: true },
    { t: 10.69, x: -0.35, y: 0, z: -15.0, yaw: 0, visible: false, cut: true },
    { t: 26.75, x: -0.25, y: 0, z: -13.0, yaw: 0, visible: false, cut: true },
    // Aparece na varanda no relâmpago (26.76 -> 44.8)
    { t: 26.76, x: -0.25, y: 0, z: -12.6, yaw: 0, visible: true },
    { t: 35.0, x: -0.30, y: 0, z: -9.4, yaw: 0, visible: true },
    { t: 44.5, x: -0.35, y: 0, z: -5.60, yaw: 0, visible: true },
    { t: 51.3, x: -0.35, y: 0, z: -5.52, yaw: 0, visible: true },
    { t: 78.55, x: -0.35, y: 0, z: -5.45, yaw: 0, visible: true },
    // Estoura o vidro e entra pisando nos cacos (78.55 -> 88.6)
    { t: 80.5, x: -0.25, y: 0, z: -4.2, visible: true },
    { t: 84.5, x: 1.65, y: 0, z: -1.8, visible: true },
    { t: 88.6, x: 4.55, y: 0, z: 0.15, visible: true },
    // Dispara correndo atrás delas (88.6 -> 104.2)
    { t: 91.6, x: 8.15, y: 0, z: 0.25, visible: true },
    { t: 94.5, x: 8.65, y: 0, z: -0.15, visible: true },
    { t: 96.3, x: 5.5, y: 0, z: 0.55, visible: true },
    { t: 97.8, x: -0.6, y: 0, z: -1.45, visible: true },
    { t: 98.8, x: -5.5, y: 0, z: -2.40, visible: true },
    { t: 99.4, x: -7.5, y: 0, z: -1.0, visible: true },
    { t: 100.3, x: -7.5, y: 0, z: 5.05, visible: true },
    { t: 101.1, x: -7.5, y: -2.0, z: 7.35, visible: true },
    { t: 101.55, x: -6.3, y: -2.0, z: 7.55, visible: true },
    { t: 102.45, x: -6.3, y: -4.0, z: 4.50, visible: true },
    { t: 103.3, x: -5.0, y: -4.0, z: 3.85, visible: true },
    { t: 104.1, x: -4.0, y: -4.0, z: 4.45, yaw: 0, visible: true },
    // Soca a porta de aço pelo lado de fora
    { t: 146.0, x: -4.0, y: -4.0, z: 4.45, yaw: 0, visible: true },
  ],
  // Zumbi 1: avança na chuva pela esquerda e depois acompanha até a porta de aço
  [
    { t: 0.0, x: -2.0, y: 0, z: -14.0, yaw: 0, visible: false, cut: true },
    { t: 57.5, x: -2.2, y: 0, z: -11.5, yaw: 0, visible: false, cut: true },
    { t: 57.6, x: -2.2, y: 0, z: -11.2, yaw: 0.12, visible: true },
    { t: 62.5, x: -1.65, y: 0, z: -5.65, yaw: 0.1, visible: true },
    { t: 81.5, x: -1.65, y: 0, z: -5.65, yaw: 0.1, visible: true },
    { t: 87.5, x: -0.9, y: 0, z: -2.4, visible: true },
    { t: 97.5, x: -5.5, y: 0, z: -2.4, visible: true },
    { t: 101.0, x: -7.5, y: 0, z: 5.05, visible: true },
    { t: 103.5, x: -7.5, y: -2.0, z: 7.35, visible: true },
    { t: 106.5, x: -6.3, y: -4.0, z: 4.50, visible: true },
    { t: 108.4, x: -4.65, y: -4.0, z: 4.25, yaw: 0.35, visible: true },
    { t: 146.0, x: -4.65, y: -4.0, z: 4.25, yaw: 0.35, visible: true },
  ],
  // Zumbi 2: avança na chuva pela direita e acompanha até a porta de aço
  [
    { t: 0.0, x: 2.1, y: 0, z: -14.0, yaw: 0, visible: false, cut: true },
    { t: 57.5, x: 2.15, y: 0, z: -12.0, yaw: 0, visible: false, cut: true },
    { t: 57.6, x: 2.15, y: 0, z: -11.8, yaw: -0.15, visible: true },
    { t: 63.0, x: 1.55, y: 0, z: -5.65, yaw: -0.15, visible: true },
    { t: 83.0, x: 1.55, y: 0, z: -5.65, yaw: -0.15, visible: true },
    { t: 89.5, x: 0.4, y: 0, z: -2.1, visible: true },
    { t: 99.0, x: -5.5, y: 0, z: -2.4, visible: true },
    { t: 102.5, x: -7.5, y: 0, z: 5.05, visible: true },
    { t: 105.0, x: -7.5, y: -2.0, z: 7.35, visible: true },
    { t: 107.6, x: -6.3, y: -4.0, z: 4.50, visible: true },
    { t: 109.2, x: -3.38, y: -4.0, z: 4.18, yaw: -0.35, visible: true },
    { t: 146.0, x: -3.38, y: -4.0, z: 4.18, yaw: -0.35, visible: true },
  ],
];

const ZOMBIE_MOTIONS = [
  [
    { t: 0.0, motion: 'zombie_attack' },
    { t: 10.69, motion: 'zombie_idle', cut: true },
    { t: 26.76, motion: 'zombie_walk', cut: true },
    { t: 44.5, motion: 'zombie_idle' },
    { t: 51.3, motion: 'zombie_attack' },
    { t: 60.4, motion: 'zombie_scream' },
    { t: 63.4, motion: 'zombie_attack' },
    { t: 78.55, motion: 'zombie_scream' },
    { t: 80.2, motion: 'zombie_walk' },
    { t: 88.6, motion: 'zombie_run', speed: 1.15 },
    { t: 104.1, motion: 'zombie_attack' },
  ],
  [
    { t: 0.0, motion: 'zombie_idle' },
    { t: 57.6, motion: 'zombie_walk', cut: true },
    { t: 62.5, motion: 'zombie_attack' },
    { t: 81.5, motion: 'zombie_walk' },
    { t: 108.4, motion: 'zombie_attack' },
  ],
  [
    { t: 0.0, motion: 'zombie_idle' },
    { t: 57.6, motion: 'zombie_walk', cut: true },
    { t: 63.0, motion: 'zombie_scream' },
    { t: 66.2, motion: 'zombie_attack' },
    { t: 83.0, motion: 'zombie_walk' },
    { t: 109.2, motion: 'zombie_attack' },
  ],
];

function evalPath(points, t) {
  if (t <= points[0].t) {
    const p = points[0];
    return { pos: new T.Vector3(p.x, p.y, p.z), yaw: p.yaw ?? 0, visible: p.visible ?? true };
  }
  let idx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (t >= points[i].t) idx = i;
  }
  const a = points[idx];
  const b = points[Math.min(idx + 1, points.length - 1)];
  if (a === b || a.cut) {
    const p = a.cut && t >= b.t ? b : a;
    return { pos: new T.Vector3(p.x, p.y, p.z), yaw: p.yaw ?? 0, visible: p.visible ?? true };
  }
  const span = Math.max(0.0001, b.t - a.t);
  const u = clamp((t - a.t) / span, 0, 1);
  const pos = new T.Vector3(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);

  let yaw;
  if (dist > 0.05 && !a.faceYaw) {
    yaw = Math.atan2(dx, dz);
    // Suaviza curvas nas transições de waypoint sem teleporte angular
    const prev = idx > 0 ? points[idx - 1] : null;
    if (prev && !prev.cut && t - a.t < 0.22) {
      const pdx = a.x - prev.x;
      const pdz = a.z - prev.z;
      const pYaw = Math.hypot(pdx, pdz) > 0.05 && !prev.faceYaw ? Math.atan2(pdx, pdz) : (a.yaw ?? yaw);
      yaw = lerpAngle(pYaw, yaw, smooth(0, 0.22, t - a.t));
    }
    if (b.yaw !== undefined && b.t - t < 0.28) {
      const next = idx + 2 < points.length ? points[idx + 2] : null;
      const nextMoves = next && !b.cut && Math.hypot(next.x - b.x, next.z - b.z) > 0.05;
      if (!nextMoves) yaw = lerpAngle(yaw, b.yaw, smooth(0, 0.28, 0.28 - (b.t - t)));
    }
  } else {
    const aYaw = a.yaw ?? 0;
    const bYaw = b.yaw ?? aYaw;
    yaw = lerpAngle(aYaw, bYaw, smooth(0, 1, u));
  }
  return { pos, yaw, visible: a.visible ?? true };
}

function buildMotionTracks() {
  const baseLuna = [
    { t: 0.0, motion: 'terrified', loop: false },
    { t: 1.4, motion: 'walking_backwards', loop: true },
    { t: 2.9, motion: 'nervously_look_around', loop: true },
    { t: 10.69, motion: 'laughing', loop: true, cut: true },
    { t: 14.8, motion: 'idle', loop: true },
    { t: 17.5, motion: 'weight_shift', loop: true },
    { t: 20.65, motion: 'look_around', loop: true },
    { t: 23.4, motion: 'surprised', loop: false },
    { t: 25.0, motion: 'nervously_look_around', loop: true },
    { t: 32.1, motion: 'walking', loop: true },
    { t: 35.1, motion: 'idle', loop: true },
    { t: 36.8, motion: 'walking', loop: true },
    { t: 38.0, motion: 'idle', loop: true },
    { t: 41.2, motion: 'surprised', loop: false },
    { t: 44.7, motion: 'nervously_look_around', loop: true },
    { t: 48.8, motion: 'walking_backwards', loop: true },
    { t: 51.3, motion: 'terrified', loop: false },
    { t: 54.0, motion: 'walking_backwards', loop: true },
    { t: 64.5, motion: 'terrified', loop: false },
    { t: 67.85, motion: 'running', loop: true, speed: 1.08 },
    { t: 70.45, motion: 'crouched_walking', loop: true },
    { t: 71.75, motion: 'kneeling', loop: true },
    { t: 84.4, motion: 'crouched_walking', loop: true },
    { t: 86.45, motion: 'jogging_stumble', loop: false },
    { t: 88.8, motion: 'kneeling', loop: true },
    { t: 94.3, motion: 'fast_run', loop: true, speed: 1.15 },
    { t: 101.55, motion: 'pushing', loop: true },
    { t: 105.8, motion: 'nervously_look_around', loop: true },
    { t: 110.2, motion: 'walking', loop: true },
    { t: 117.6, motion: 'nervously_look_around', loop: true },
    { t: 123.0, motion: 'kneeling', loop: true },
    { t: 126.8, motion: 'nervously_look_around', loop: true },
    { t: 131.0, motion: 'terrified', loop: false },
    { t: 134.5, motion: 'nervously_look_around', loop: true },
  ];

  const baseBia = [
    { t: 0.0, motion: 'angry_gesture', loop: true },
    { t: 3.0, motion: 'nervously_look_around', loop: true },
    { t: 10.69, motion: 'talking_on_phone', loop: true, cut: true },
    { t: 15.1, motion: 'weight_shift', loop: true },
    { t: 20.65, motion: 'look_around', loop: true },
    { t: 23.4, motion: 'surprised', loop: false },
    { t: 25.0, motion: 'nervously_look_around', loop: true },
    { t: 32.8, motion: 'walk', loop: true },
    { t: 35.8, motion: 'nervously_look_around', loop: true },
    { t: 40.3, motion: 'surprised', loop: false },
    { t: 44.5, motion: 'nervously_look_around', loop: true },
    { t: 51.3, motion: 'terrified', loop: false },
    { t: 54.0, motion: 'walking_backwards', loop: true },
    { t: 64.5, motion: 'nervously_look_around', loop: true },
    { t: 67.6, motion: 'running', loop: true, speed: 1.08 },
    { t: 70.2, motion: 'crouched_walking', loop: true },
    { t: 71.55, motion: 'kneeling', loop: true },
    { t: 85.0, motion: 'crouched_walking', loop: true },
    { t: 90.2, motion: 'running', loop: true },
    { t: 92.0, motion: 'talking_2', loop: true },
    { t: 93.55, motion: 'opening', loop: false },
    { t: 94.55, motion: 'fast_run', loop: true, speed: 1.15 },
    { t: 101.75, motion: 'pushing', loop: true },
    { t: 105.8, motion: 'nervously_look_around', loop: true },
    { t: 110.5, motion: 'walking', loop: true },
    { t: 117.9, motion: 'nervously_look_around', loop: true },
    { t: 131.2, motion: 'terrified', loop: false },
    { t: 134.8, motion: 'nervously_look_around', loop: true },
  ];

  // Injeta animações de fala variadas (sem repetir a anterior) diretamente das falas do JSON
  let prevSpeech = '';
  let speechIdx = 0;
  const speechByActor = { LUNA: [], BIA: [] };
  for (const line of falas) {
    const who = String(line.speaker || '').toUpperCase();
    if (who !== 'LUNA' && who !== 'BIA') continue;
    const motion = pickSpeechMotion(line, prevSpeech, speechIdx++);
    prevSpeech = motion;
    // Em i=25 ("Não faz barulho. Fica quieta.") Bia fala agachada atrás da bancada (close 1.2m)
    const crouchedSpeak = who === 'BIA' && line.start > 74 && line.end < 79;
    speechByActor[who].push({
      start: line.start,
      end: line.end,
      motion,
      loop: !ONE_SHOT_MOTIONS.has(motion),
      yOffset: crouchedSpeak ? -0.44 : 0,
    });
  }

  function mergeTrack(base, speeches) {
    const out = [];
    const points = [...base].sort((a, b) => a.t - b.t);
    const sampleBase = (t) => {
      let cur = points[0];
      for (const p of points) {
        if (p.t <= t) cur = p;
      }
      return cur;
    };
    const events = [];
    for (const p of points) events.push({ t: p.t, seg: p });
    for (const s of speeches) {
      events.push({ t: s.start, seg: { t: s.start, motion: s.motion, loop: s.loop, yOffset: s.yOffset || 0, isSpeech: true } });
      const after = sampleBase(s.end + 0.01);
      events.push({ t: s.end, seg: { t: s.end, motion: after.motion, loop: after.loop, speed: after.speed, yOffset: 0 } });
    }
    events.sort((a, b) => a.t - b.t || (a.seg.isSpeech ? 1 : -1));
    for (const ev of events) {
      // Remove segmentos base que caem no meio de uma fala ativa
      const insideSpeech = !ev.seg.isSpeech && speeches.some((s) => ev.t > s.start + 0.01 && ev.t < s.end - 0.01);
      if (insideSpeech) continue;
      if (out.length && Math.abs(out[out.length - 1].t - ev.t) < 0.02) {
        out[out.length - 1] = ev.seg;
      } else {
        out.push(ev.seg);
      }
    }
    return out;
  }

  ACTORS[0].motionTrack = mergeTrack(baseLuna, speechByActor.LUNA);
  ACTORS[1].motionTrack = mergeTrack(baseBia, speechByActor.BIA);
}

function resolveAction(actions, motionName) {
  return (
    actions[motionName] ||
    actions.talking ||
    actions.idle ||
    actions.zombie_idle ||
    Object.values(actions)[0] ||
    null
  );
}

function calcClipTime(action, elapsed, loop = true, speed = 1) {
  const clipDur = Math.max(0.05, action.getClip().duration);
  const scaled = Math.max(0, elapsed * (speed || 1));
  return loop ? scaled % clipDur : clamp(scaled, 0, clipDur - 0.002);
}

function applyDeterministicTrack(mixer, actions, track, t) {
  let idx = 0;
  for (let i = 0; i < track.length; i++) {
    if (t >= track[i].t) idx = i;
  }
  const seg = track[idx];
  const prev = idx > 0 ? track[idx - 1] : null;
  const currAction = resolveAction(actions, seg.motion);
  if (!currAction) return seg;

  const fade = seg.cut ? 0 : 0.24;
  const prevAction = prev && prev.motion !== seg.motion ? resolveAction(actions, prev.motion) : null;
  const blend = prevAction && fade > 0 ? smooth(0, fade, t - seg.t) : 1;

  for (const act of Object.values(actions)) {
    if (act !== currAction && (blend >= 1 || act !== prevAction)) {
      if (act.isRunning()) act.stop();
    }
  }

  const currLoop = seg.loop ?? !ONE_SHOT_MOTIONS.has(seg.motion);
  currAction.reset();
  currAction.setLoop(currLoop ? T.LoopRepeat : T.LoopOnce, Infinity);
  currAction.clampWhenFinished = true;
  currAction.setEffectiveTimeScale(1);
  currAction.setEffectiveWeight(blend);
  currAction.play();
  currAction.time = calcClipTime(currAction, t - seg.t, currLoop, seg.speed || 1);

  if (blend < 1 && prevAction && prevAction !== currAction) {
    const prevLoop = prev.loop ?? !ONE_SHOT_MOTIONS.has(prev.motion);
    prevAction.reset();
    prevAction.setLoop(prevLoop ? T.LoopRepeat : T.LoopOnce, Infinity);
    prevAction.clampWhenFinished = true;
    prevAction.setEffectiveTimeScale(1);
    prevAction.setEffectiveWeight(1 - blend);
    prevAction.play();
    prevAction.time = calcClipTime(prevAction, t - prev.t, prevLoop, prev.speed || 1);
  }

  mixer.update(0);
  return seg;
}

// ============================================================================
// Lip-sync forte (aa até 0.9 + ih/ou), sacadas, olhar e expressões faciais
// ============================================================================
function lineAt(t) {
  return falas.find((f) => t >= f.start && t < f.end) || null;
}

function activeWord(t, speaker) {
  return words.find((w) => String(w.speaker).toUpperCase() === speaker && t >= w.start && t < w.end) || null;
}

function mouthFor(word, t) {
  if (!word) return [0, 0, 0];
  const raw = String(word.word || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const vowels = [...raw].filter((c) => 'aeiou'.includes(c));
  const dur = Math.max(0.06, word.end - word.start);
  const u = clamp((t - word.start) / dur, 0, 0.999);
  const idx = vowels.length ? Math.floor(u * vowels.length) : 0;
  const vowel = vowels[idx] || 'a';
  const env = Math.sin(Math.PI * u);
  const syll = 0.78 + 0.22 * Math.sin(t * 36) ** 2;
  const amp = clamp((0.24 + 0.66 * env) * syll, 0, 0.9);
  if (vowel === 'a') return [amp, amp * 0.14, 0];
  if (vowel === 'e' || vowel === 'i') return [amp * 0.34, clamp(amp * 0.88, 0, 0.85), 0];
  return [amp * 0.28, 0, clamp(amp * 0.88, 0, 0.85)];
}

function setExpr(ex, name, val) {
  try {
    ex.setValue(name, clamp(val, 0, 1));
  } catch {
    // Ignora presets ausentes no modelo
  }
}

function applyExpressions(actor, line, t) {
  const ex = actor.vrm.expressionManager;
  if (!ex) return;
  const isLuna = actor.name === 'LUNA';
  const talking = Boolean(line && String(line.speaker).toUpperCase() === actor.name);
  const word = talking ? activeWord(t, actor.name) : null;
  const [aa, ih, ou] = mouthFor(word, t);

  // Emoções conforme a narrativa e a fala
  let happy = 0;
  let surprised = 0;
  let angry = 0;
  let sad = 0;

  if (t < 10.68) {
    surprised = isLuna ? 0.78 : 0.42;
    sad = isLuna ? 0.48 : 0.22;
    angry = isLuna ? 0 : 0.48;
  } else if (t < 20.6) {
    happy = isLuna ? 0.78 : 0.08;
    sad = isLuna ? 0 : 0.22;
  } else if (t < 26.8) {
    surprised = pulse(t, 23.8, 2.2) * 0.72 + 0.18;
    sad = 0.24;
  } else if (t < 38.0) {
    happy = isLuna ? 0.62 : 0;
    surprised = isLuna ? 0 : 0.52;
    angry = !isLuna && talking ? 0.56 : 0;
  } else if (t < 51.3) {
    surprised = isLuna ? smooth(40.2, 42.5, t) * 0.82 : 0.45;
    angry = !isLuna ? 0.68 : 0;
    sad = isLuna ? smooth(44.5, 48.0, t) * 0.45 : 0.18;
  } else if (t < 68.2) {
    surprised = 0.72 + pulse(t, 52.0, 2.0) * 0.25;
    sad = isLuna ? 0.62 : 0.30;
    angry = !isLuna ? 0.62 : 0.18;
  } else if (t < 78.5) {
    surprised = 0.35;
    sad = 0.55;
    angry = !isLuna && talking ? 0.42 : 0;
  } else if (t < 105.5) {
    surprised = 0.64 + pulse(t, 79.0, 2.0) * 0.32 + pulse(t, 87.2, 1.8) * 0.30;
    angry = !isLuna ? 0.58 : talking ? 0.42 : 0.22;
    sad = isLuna ? 0.58 : 0.28;
  } else {
    const breathShock = smooth(122.8, 128.0, t);
    surprised = 0.42 + breathShock * 0.48;
    sad = 0.58 + breathShock * 0.28;
  }

  setExpr(ex, 'happy', happy);
  setExpr(ex, 'surprised', surprised);
  setExpr(ex, 'angry', angry);
  setExpr(ex, 'sad', sad);
  setExpr(ex, 'fear', Math.max(surprised * 0.6, sad * 0.7));
  setExpr(ex, 'aa', aa);
  setExpr(ex, 'ih', ih);
  setExpr(ex, 'ou', ou);

  // Piscar natural (reduzido em momentos de susto máximo)
  const fearSuppress = clamp(surprised, 0, 0.8);
  const blink = Math.max(
    pulse(t % 3.9, isLuna ? 2.8 : 1.5, 0.085),
    pulse(t % 6.3, isLuna ? 5.4 : 4.2, 0.095)
  );
  setExpr(ex, 'blink', blink * (1 - fearSuppress * 0.75));
}

function headPosition(actor) {
  const node = actor.vrm.humanoid.getNormalizedBoneNode('head');
  return node
    ? node.getWorldPosition(new T.Vector3())
    : actor.vrm.scene.position.clone().add(new T.Vector3(0, actor.headY, 0));
}

function updateGaze(t, line, heads) {
  const who = String(line?.speaker || '').toUpperCase();
  const z0Pos = ZOMBIES[0].group.position.clone().add(new T.Vector3(0, 1.42, 0));

  for (let i = 0; i < ACTORS.length; i++) {
    const actor = ACTORS[i];
    const otherHead = heads[1 - i];
    const target = otherHead.clone();

    if (t < 10.68 || (t >= 26.8 && t < 67.5)) {
      // Olha para o perigo no vidro/varanda, alternando para a amiga quando falam
      target.copy(z0Pos);
      if (who === 'LUNA' || who === 'BIA') {
        target.lerp(otherHead, actor.name === who ? 0.55 : 0.75);
      }
    } else if (t >= 20.6 && t < 26.8) {
      target.set(4.65, 1.15, -0.75); // rádio / vitrola
    } else if (t >= 71.5 && t < 84.5) {
      // Escondidas atrás da bancada: olham para o arco da sala (perigo) ou para a amiga ao falar
      target.set(5.5, 1.35, 0.35);
      if (who === 'BIA') target.lerp(otherHead, 0.85);
    } else if (t >= 84.5 && t < 101.5) {
      // Em fuga olham para frente na direção da corrida / parceira
      const fwd = new T.Vector3(Math.sin(actor.currentYaw), 0, Math.cos(actor.currentYaw));
      target.copy(heads[i]).addScaledVector(fwd, 3.5);
      if (t >= 91.5 && t < 94.5) target.copy(otherHead);
    } else if (t >= 101.5 && t < 110.5) {
      target.set(-4.0, -2.6, 4.8); // porta de aço
    } else if (t >= 117.5 && t < 131.0) {
      // No escuro olham nervosas em volta e uma para a outra
      const sweep = Math.sin(t * 1.1 + i * 2.1) * 2.2;
      target.set(sweep, -2.55, 7.2);
      if (who === 'LUNA') target.lerp(otherHead, 0.82);
    } else if (t >= 131.0) {
      // Olham horrorizadas para a presença no fundo do porão
      target.set(0.18, -2.45, 12.35);
    }

    // Sacadas oculares determinísticas (micro-deslocamentos naturais do olhar)
    const sacStep = Math.floor(t * 2.4 + i * 3.7);
    const sx = (hash(sacStep * 13 + i) - 0.5) * 0.24;
    const sy = (hash(sacStep * 19 + i + 5) - 0.5) * 0.14;
    target.x += sx;
    target.y += sy;

    if (who === actor.name) {
      target.lerp(camera.position, 0.14);
    }
    actor.gaze.position.copy(target);
  }
}

// ============================================================================
// Relâmpagos, vidro, banco, porta de aço e iluminação por ambiente
// ============================================================================
const LIGHTNING_TIMES = [0.35, 1.85, 3.85, 5.4, 7.8, 27.3, 30.8, 41.0, 43.3, 52.2, 54.6, 58.5, 62.6, 78.65];

function lightningIntensityAt(t) {
  let v = 0;
  for (const at of LIGHTNING_TIMES) {
    v = Math.max(v, pulse(t, at, 0.30) + pulse(t, at + 0.18, 0.18) * 0.75);
  }
  return clamp(v, 0, 1.35);
}

function updateSceneProps(t) {
  // Vidro intacto -> rachadura cresce em ~1 s a partir da fala da rachadura -> estoura em cacos
  const shattered = t >= shatterStartTime;
  const cracked = t >= crackStartTime && !shattered;
  if (salaGlassPanel) salaGlassPanel.visible = !shattered;
  crackGroup.visible = cracked;
  shatterGroup.visible = shattered;

  if (cracked) {
    const grow = smooth(crackStartTime, crackStartTime + 1.0, t);
    const s = Math.max(0.02, grow);
    if (crackLines) crackLines.scale.set(s, s, 1);
    crackMat.opacity = 0.94 * clamp(grow * 2.5, 0.15, 1);
    if (crackPalm) crackPalm.scale.setScalar(clamp(grow * 3.0, 0.15, 1));
    palmMat.opacity = 0.44 * clamp(grow * 3.0, 0, 1);
  }

  if (shattered) {
    const dt = t - shatterStartTime;
    const g = 9.8;
    for (const s of shards) {
      const tFlight = Math.max(0, dt);
      let y = s.y0 + s.vy * tFlight - 0.5 * g * tFlight * tFlight;
      let hitT = tFlight;
      if (y < 0.025) {
        // Tempo determinístico em que o caco toca o chão
        const disc = s.vy * s.vy + 2 * g * Math.max(0.01, s.y0 - 0.025);
        hitT = (s.vy + Math.sqrt(disc)) / g;
        y = 0.025;
      }
      const x = s.x0 + s.vx * Math.min(tFlight, hitT);
      const z = s.z0 + s.vz * Math.min(tFlight, hitT);
      s.mesh.position.set(x, y, z);
      if (y <= 0.026) {
        s.mesh.rotation.set(Math.PI / 2, s.ry * hitT, 0);
      } else {
        s.mesh.rotation.set(s.rx * tFlight, s.ry * tFlight, s.rz * tFlight);
      }
    }
  }

  // Banco da cozinha tomba quando Luna tropeça (t = 86.55)
  const tip = smooth(86.55, 87.15, t);
  tripStool.rotation.z = tip * 1.48;
  tripStool.position.set(9.55 - tip * 0.42, tip * 0.18, -1.05 - tip * 0.25);

  // Porta de aço do porão: aberta -> bate fechando (101.8..104.8) -> trava desce (104.9..105.9) -> treme nos socos
  const closeU = smooth(101.8, 104.85, t);
  const lockU = smooth(104.95, 105.95, t);
  const pounding = t >= 106.2 ? Math.pow(Math.max(0, Math.sin((t - 106.2) * 5.2)), 10) * (t < 118.2 ? 1 : 0.35) : 0;
  steelDoorPivot.rotation.y = lerp(-1.42, 0, closeU) + pounding * 0.022;
  lockBolt.position.y = lerp(1.36, 1.06, lockU);
  lockBolt.position.x = lerp(1.42, 1.54, lockU);

  if (lockU > 0.85) {
    lockLedMat.color.set('#ff3038');
    lockLedMat.emissive.set('#ff1c24');
    lockLedMat.emissiveIntensity = 1.4 + 0.5 * Math.sin(t * 5);
    lockLedLight.color.set('#ff2a2a');
    lockLedLight.intensity = t >= 108.66 ? 1.5 : 1.0;
  } else {
    lockLedMat.color.set('#ffb440');
    lockLedMat.emissive.set('#ff9922');
    lockLedMat.emissiveIntensity = 1.2;
    lockLedLight.color.set('#ffaa33');
    lockLedLight.intensity = 0.8;
  }

  // Presença respirando no fundo do porão
  shadowFigure.visible = t >= 121.8;
  if (shadowFigure.visible) {
    const breath = Math.sin(t * 2.15);
    shadowFigure.scale.set(1 + breath * 0.018, 1 + breath * 0.025, 1 + breath * 0.025);
  }
}

function updateLighting(t, focusPos) {
  const flash = lightningIntensityAt(t);
  const inPoraoDark = t >= 108.66;
  const flickering = t >= 100.0 && t < 108.66;
  const lightMode = inPoraoDark ? 'apagao' : flickering ? 'piscando' : 'normal';
  const fx = flash > 0.08 ? ['relampago'] : [];
  world.update(t, lightMode, fx);

  for (const light of worldLights) {
    const scale = light.isHemisphereLight ? 0.45 : light.isPointLight ? 0.26 : 0.48;
    light.intensity *= scale;
  }

  // Direciona key/fill/rim para o ponto de ação atual
  keyLight.target.position.copy(focusPos);
  fillLight.target.position.copy(focusPos);
  rimLight.target.position.copy(focusPos);
  keyLight.target.updateMatrixWorld();
  fillLight.target.updateMatrixWorld();
  rimLight.target.updateMatrixWorld();

  if (inPoraoDark) {
    keyLight.position.set(focusPos.x - 1.5, focusPos.y + 2.4, focusPos.z - 2.2);
    fillLight.position.set(focusPos.x + 1.8, focusPos.y + 1.8, focusPos.z - 1.8);
    rimLight.position.set(focusPos.x, focusPos.y + 2.5, focusPos.z + 2.8);
    keyLight.color.set('#6d92bd');
    keyLight.intensity = 0.30;
    fillLight.intensity = 0.16;
    rimLight.color.set('#4c7cb8');
    rimLight.intensity = 0.42;
    stairLightTop.intensity = 0.4;
    stairLightBot.intensity = t < 113 ? 3.8 : 0.5;
    darkFaceLight.position.set(focusPos.x, focusPos.y + 1.55, focusPos.z - 1.55);
    darkFaceLight.intensity = 2.4;
    renderer.toneMappingExposure = 0.72;
  } else {
    keyLight.position.set(focusPos.x - 2.4, focusPos.y + 3.5, focusPos.z + 2.6);
    fillLight.position.set(focusPos.x + 2.5, focusPos.y + 2.1, focusPos.z + 2.4);
    rimLight.position.set(focusPos.x, focusPos.y + 2.8, focusPos.z - 3.6);
    keyLight.color.set('#ffdfba');
    keyLight.intensity = flickering ? 0.72 : 1.08;
    fillLight.intensity = flickering ? 0.36 : 0.48;
    rimLight.color.set('#89b8ed');
    rimLight.intensity = 0.66 + flash * 1.25;
    stairLightTop.intensity = 5.2;
    stairLightBot.intensity = flickering ? (Math.sin(t * 23) > -0.1 ? 6.0 : 1.6) : 5.6;
    darkFaceLight.intensity = 0;
    renderer.toneMappingExposure = 0.82 + flash * 0.16;
  }

  lightningLight.intensity = flash * 34;
}

// ============================================================================
// Direção de câmera 100% determinística (planos variados + closes de 1,2 m)
// ============================================================================
function closeUpPose(actor, dist = 1.22, sideAngle = 0.24, yOffset = 0.02) {
  const head = headPosition(actor);
  const yaw = actor.currentYaw + sideAngle;
  const pos = new T.Vector3(
    head.x + Math.sin(yaw) * dist,
    head.y + yOffset,
    head.z + Math.cos(yaw) * dist
  );
  // Garante que a câmera de close na sala não atravesse o vidro frontal (z = -4.98)
  if (head.y > -1.0 && head.x > -5.2 && head.x < 5.2 && pos.z < -4.55) {
    pos.z = -4.55;
  }
  const target = head.clone().add(new T.Vector3(0, -0.05, 0));
  return { pos, target, fov: 30 };
}

function directCamera(t, line, heads) {
  const who = String(line?.speaker || '').toUpperCase();
  const lunaPos = ACTORS[0].vrm.scene.position;
  const biaPos = ACTORS[1].vrm.scene.position;
  const lunaHead = heads[0];
  const biaHead = heads[1];
  const z0Pos = ZOMBIES[0].group.position;

  let pos = new T.Vector3(0, 1.65, 3.0);
  let target = new T.Vector3(0, 1.35, 0);
  let fov = 36;

  // --- ATO 1A: COLD OPEN 23:12 (0..10.68) ---
  if (t < 2.89) {
    // Gancho visto de dentro da sala: zumbi batendo a palma no vidro sob relâmpago
    const u = smooth(0, 2.89, t);
    pos.set(lerp(0.35, 0.05, u), 1.48, lerp(-2.75, -3.15, u));
    target.set(-0.35, 1.38, -5.25);
    fov = 34;
  } else if (t < 6.55) {
    // Plano aberto de dentro da sala: Luna e Bia + zumbi batendo no vidro na tempestade
    const u = smooth(2.89, 6.55, t);
    pos.set(lerp(2.4, 1.8, u), 1.58, lerp(0.8, 0.1, u));
    target.set(-0.35, 1.32, -4.85);
    fov = 44;
  } else if (t < 10.68) {
    // Médio tenso pegando os rostos de Luna e Bia olhando o vidro
    const u = smooth(6.55, 10.68, t);
    pos.set(lerp(-0.15, 0.25, u), 1.44, -4.35);
    target.copy(lunaHead).lerp(biaHead, 0.5).add(new T.Vector3(0, -0.06, 0));
    fov = 34;

    // --- ATO 1B: FLASHBACK 23:06 (10.68..26.76) ---
  } else if (t < 15.30) {
    // Plano médio/aberto calmo na sala
    const u = smooth(10.68, 15.30, t);
    pos.set(lerp(-0.2, 0.25, u), 1.58, 3.05);
    target.set(0.1, 1.32, 0.4);
    fov = 37;
  } else if (t < 17.55) {
    // Close de 1,2 m em Luna ("Relaxa, Bia, a chuva já passa.")
    ({ pos, target, fov } = closeUpPose(ACTORS[0], 1.22, -0.22, 0.01));
  } else if (t < 20.65) {
    // Close de 1,2 m em Bia ("O celular morreu de sinal. Escuta o rádio.")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.22, 0.22, 0.01));
  } else if (t < 23.40) {
    // Plano médio virando com elas para o rádio/vitrola
    const u = smooth(20.65, 23.40, t);
    pos.set(lerp(-1.1, -0.6, u), 1.52, 2.15);
    target.set(lerp(1.4, 2.6, u), 1.26, -0.2);
    fov = 35;
  } else if (t < 26.76) {
    // Dois planos próximos tensos com alerta do rádio
    pos.set(0.25, 1.50, 2.25);
    target.copy(lunaHead).lerp(biaHead, 0.5).add(new T.Vector3(0, -0.06, 0));
    fov = 33;

    // --- ATO 2: SOMBRAS NA VARANDA 23:10 (26.76..51.30) ---
  } else if (t < 32.63) {
    // Varanda na chuva e relâmpago: silhueta cambaleando a 8m
    const u = smooth(26.76, 32.63, t);
    pos.set(lerp(0.65, 0.25, u), 1.68, lerp(-2.2, -3.9, u));
    target.set(z0Pos.x, 1.25, z0Pos.z);
    fov = 38;
  } else if (t < 35.12) {
    // Tracking acompanhando Luna caminhando até o vidro
    pos.set(-2.35, 1.52, lunaPos.z + 1.35);
    target.copy(lunaHead).add(new T.Vector3(0.1, -0.1, -0.35));
    fov = 35;
  } else if (t < 37.85) {
    // Close de 1,2 m em Luna ("É o vizinho bêbado de novo. Vou abrir.")
    ({ pos, target, fov } = closeUpPose(ACTORS[0], 1.22, 0.28, 0.02));
  } else if (t < 40.26) {
    // Close de 1,2 m em Bia ("Para! Olha o pescoço dele.")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.22, -0.26, 0.02));
  } else if (t < 44.70) {
    // Clarão no zumbi lá fora revelando pele cinza e braços tortos
    const u = smooth(40.26, 44.70, t);
    pos.set(lerp(-1.1, -0.75, u), 1.55, -5.25);
    target.set(z0Pos.x, 1.38, z0Pos.z);
    fov = 31;
  } else if (t < 48.22) {
    // POV do zumbi pelo vidro encarando Luna congelada
    pos.set(-0.42, 1.56, -5.75);
    target.copy(lunaHead).add(new T.Vector3(0, -0.04, 0));
    fov = 30;
  } else if (t < 51.30) {
    // Close de 1,2 m em Bia ("Não é bêbado. Sai daí agora!")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.20, -0.24, 0.02));

    // --- ATO 3A: O VIDRO RACHA 23:12 (51.30..68.21) ---
  } else if (t < 54.09) {
    // Susto: POV externo colado ao vidro na batida da palma
    const u = smooth(51.30, 54.09, t);
    pos.set(lerp(0.85, 0.55, u), 1.52, -5.85);
    target.set(-0.35, 1.42, lerp(-4.8, -3.1, u));
    fov = 36;
  } else if (t < 57.66) {
    // Rachadura de ponta a ponta no painel com zumbi atrás
    pos.set(-1.15, 1.45, -2.0);
    target.set(-0.25, 1.42, -4.95);
    fov = 38;
  } else if (t < 60.45) {
    // Mais duas sombras avançando na chuva
    pos.set(0.0, 1.72, -1.9);
    target.set(0.0, 1.26, -8.5);
    fov = 44;
  } else if (t < 65.17) {
    // Plano aberto da sala: 3 infectados atrás do vidro fino + elas recuando
    const u = smooth(60.45, 65.17, t);
    pos.set(lerp(3.1, 2.7, u), 1.68, lerp(1.5, 1.85, u));
    target.set(0.0, 1.32, -4.0);
    fov = 43;
  } else if (t < 66.95) {
    // Close de 1,2 m em Luna ("Meu Deus, vai quebrar!")
    ({ pos, target, fov } = closeUpPose(ACTORS[0], 1.20, 0.22, 0.02));
  } else if (t < 68.21) {
    // Close de 1,2 m em Bia ("Cozinha, corre!")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.20, -0.22, 0.02));

    // --- ATO 3B: COZINHA AGACHADAS 23:13 (68.21..78.54) ---
  } else if (t < 71.92) {
    // Acompanha corrida pela cozinha e agachamento atrás da bancada
    const u = smooth(68.21, 71.92, t);
    const mid = lunaPos.clone().lerp(biaPos, 0.5);
    pos.set(lerp(7.2, 10.2, u), lerp(1.62, 1.42, u), lerp(-2.4, 3.25, u));
    target.set(mid.x, lerp(1.25, 0.95, u), mid.z);
    fov = 40;
  } else if (t < 75.71) {
    // Plano médio baixo atrás da bancada mostrando as duas escondidas
    pos.set(11.95, 1.12, 3.45);
    target.copy(lunaHead).lerp(biaHead, 0.5).add(new T.Vector3(0, -0.05, 0));
    fov = 33;
  } else if (t < 78.54) {
    // Close de 1,2 m em Bia ("Não faz barulho. Fica quieta.")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.20, 0.14, 0.02));

    // --- ATO 4A: VIDRO ESTOURA E PERSEGUIÇÃO (78.54..93.57) ---
  } else if (t < 80.55) {
    // Estouro do vidro na sala com cacos voando
    pos.set(1.55, 1.50, -1.15);
    target.set(-0.3, 1.38, -4.95);
    fov = 42;
  } else if (t < 84.50) {
    // Zumbi entra, pisa nos cacos e vira para a cozinha
    pos.set(4.65, 1.45, 1.55);
    target.set(z0Pos.x, 1.28, z0Pos.z);
    fov = 38;
  } else if (t < 87.97) {
    // Luna recua agachada e tropeça no banco da cozinha
    pos.set(7.55, 1.28, -2.45);
    target.copy(lunaHead).add(new T.Vector3(0, -0.18, 0));
    fov = 36;
  } else if (t < 88.80) {
    // Corte rápido: close de 1,2 m em Luna ("Ai, droga!")
    pos.set(lunaHead.x - 1.12, lunaHead.y + 0.08, lunaHead.z - 0.45);
    target.copy(lunaHead).add(new T.Vector3(0, -0.05, 0));
    fov = 31;
  } else if (t < 92.04) {
    // Infectado dispara correndo para a cozinha
    pos.set(11.1, 1.42, -2.25);
    target.set(z0Pos.x, 1.32, z0Pos.z);
    fov = 39;
  } else if (t < 93.57) {
    // Close de 1,2 m em Bia ("Levanta! Vem comigo!")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.20, 0.25, 0.02));

    // --- ATO 4B: CORRIDA E 14 DEGRAUS (93.57..100.18) ---
  } else if (t < 95.67) {
    // Bia puxa Luna e ambas disparam pelo arco da cozinha
    const mid = lunaPos.clone().lerp(biaPos, 0.5);
    pos.set(7.2, 1.48, -2.45);
    target.set(mid.x, 1.25, mid.z);
    fov = 40;
  } else if (t < 97.45) {
    // Corte dinâmico na sala: elas correm para a escada com zumbi atrás
    const mid = lunaPos.clone().lerp(biaPos, 0.5);
    pos.set(-3.1, 1.62, 1.85);
    target.set(mid.x, 1.26, mid.z);
    fov = 44;
  } else if (t < 99.05) {
    // Descendo o primeiro lance da escada: câmera a ~1,6-2,1 m na altura do peito olhando os rostos
    const leadPos = lunaPos.clone().lerp(biaPos, 0.35);
    const leadHead = lunaHead.clone().lerp(biaHead, 0.35);
    pos.set(
      clamp(leadPos.x + 0.35, -8.05, -6.85),
      leadPos.y + 1.18,
      clamp(leadPos.z + 1.95, 0.6, 8.35)
    );
    target.copy(leadHead);
    fov = 38;
  } else if (t < 100.18) {
    // Descendo o segundo lance até o corredor: câmera a ~1,7-2,0 m na altura do peito olhando os rostos
    const leadPos = lunaPos.clone().lerp(biaPos, 0.35);
    const leadHead = lunaHead.clone().lerp(biaHead, 0.35);
    const camZ = clamp(leadPos.z - 1.90, 2.85, 5.55);
    const rawY = leadPos.y + 1.18;
    pos.set(
      clamp(leadPos.x + 0.35, -6.75, -5.95),
      camZ < 5.15 ? Math.min(rawY, -1.05) : rawY,
      camZ
    );
    target.copy(leadHead);
    fov = 40;

    // --- ATO 4C: PORTA DE AÇO (100.18..108.66) ---
  } else if (t < 101.05) {
    // Corredor subterrâneo: Luna grita ("Fecha! Fecha logo!") a ~1,9 m na altura do peito
    pos.set(lunaPos.x + 1.65, -2.82, 3.15);
    target.copy(lunaHead).add(new T.Vector3(0, -0.04, 0));
    fov = 34;
  } else if (t < 101.80) {
    // Entrando pela porta de aço no porão: câmera a ~1,85 m na altura do peito olhando os rostos
    pos.set(-3.75, -2.82, clamp(lunaPos.z + 1.75, 5.85, 7.35));
    target.copy(lunaHead).lerp(biaHead, 0.25).add(new T.Vector3(0, -0.04, 0));
    fov = 35;
  } else if (t < 105.00) {
    // Dentro do porão (~1,9 m, altura do peito): elas fecham a porta de aço contra o zumbi
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(-3.25, -2.82, 7.35);
    target.copy(midHead).add(new T.Vector3(0, -0.05, 0));
    fov = 40;
  } else if (t < 108.66) {
    // Porta de aço travando no último segundo (~1,7 m, altura do peito)
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(-3.15, -2.82, 7.15);
    target.copy(midHead).lerp(new T.Vector3(-3.80, -2.72, 5.15), 0.3);
    fov = 36;

    // --- ATO 5: NÃO ESTÃO SOZINHAS (108.66..fim) ---
  } else if (t < 112.79) {
    // Lado de fora da porta de aço (~1,9 m, altura do peito): os 3 zumbis socam o metal
    pos.set(-5.35, -2.80, 3.05);
    target.set(-4.05, -2.58, 4.45);
    fov = 42;
  } else if (t < 118.12) {
    // Dentro do porão escuro (~2,0 m, altura do peito): elas recuam para o fundo
    const mid = lunaPos.clone().lerp(biaPos, 0.5);
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(mid.x + 0.65, -2.82, mid.z + 1.85);
    target.copy(midHead);
    fov = 39;
  } else if (t < 122.60) {
    // Silêncio no escuro (~2,0 m, altura do peito): rostos tensos olhando em volta
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(0.02, -2.82, 7.75);
    target.copy(midHead);
    fov = 36;
  } else if (t < 128.10) {
    // Aproximação frontal (~2,1 -> 1,6 m, altura do peito) revelando a silhueta respirando atrás delas
    const u = smooth(122.60, 128.10, t);
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(0.02, -2.85, lerp(7.65, 8.15, u));
    target.copy(midHead).lerp(new T.Vector3(0.12, -2.48, 10.65), 0.35);
    fov = 38;
  } else if (t < 130.86) {
    // Close em Luna ("Bia... você ouviu isso?") a ~1,56 m na altura do peito
    pos.set(lunaHead.x + 0.35, -2.80, lunaHead.z - 1.50);
    target.copy(lunaHead).add(new T.Vector3(0, -0.04, 0));
    fov = 31;
  } else if (t < 135.16) {
    // Médio frontal/lateral (~1,95 m, altura do peito) mostrando as duas virando horrorizadas
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(1.45, -2.82, 11.05);
    target.copy(midHead);
    fov = 38;
  } else {
    // Por cima do ombro (~1,9 -> 1,55 m, altura do peito) revelando a figura na sombra atrás no porão
    const u = smooth(135.16, Math.max(141.5, duration), t);
    pos.set(0.02, -2.82, lerp(7.85, 8.20, u));
    target.set(0.16, -2.46, 12.35);
    fov = 38;
  }

  // Leve respiração/vibração determinística de câmera (mais viva na fuga e nos impactos)
  const chaseAmp = t >= 67.5 && t < 105.0 ? 0.028 : 0.008;
  const hitShake =
    (pulse(t, 0.45, 0.25) + pulse(t, 52.3, 0.28) + pulse(t, 78.65, 0.35)) * 0.065;
  pos.x += Math.sin(t * 2.1) * chaseAmp + Math.sin(t * 47) * hitShake;
  pos.y += Math.cos(t * 1.7) * chaseAmp * 0.6 + Math.cos(t * 53) * hitShake * 0.7;

  // Garante que o alvo nunca fique a menos de ~26° da vertical em relação à câmera
  const toTarget = target.clone().sub(pos);
  const horizDist = Math.hypot(toTarget.x, toTarget.z);
  const minHoriz = Math.max(0.45, Math.abs(toTarget.y) * Math.tan(T.MathUtils.degToRad(26)));
  if (horizDist < minHoriz) {
    const dx = horizDist > 1e-4 ? toTarget.x / horizDist : 0;
    const dz = horizDist > 1e-4 ? toTarget.z / horizDist : -1;
    const push = minHoriz - horizDist;
    pos.x -= dx * push;
    pos.z -= dz * push;
  }

  camera.position.copy(pos);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(target);

  return target;
}

// ============================================================================
// Legenda e HUD com relógio (23:12 -> 23:06 -> 23:10 -> 23:12 -> 23:13 -> 23:14)
// ============================================================================
const HUD_STATES = [
  { t: 0.0, clock: '23:12', tag: 'SALA', danger: true, items: [['Sala cede em', '2 min'], ['Saídas', '1']] },
  { t: 10.683, clock: '23:06', tag: 'SALA', danger: false, items: [['Sinal', '0'], ['Rádio', 'alerta ativo']] },
  { t: 26.761, clock: '23:10', tag: 'VARANDA', danger: true, items: [['Distância', '8 metros'], ['Barreira', 'vidro']] },
  { t: 51.302, clock: '23:12', tag: 'SALA', danger: true, items: [['Infectados', '3'], ['Vidro', 'rachando']] },
  { t: 68.214, clock: '23:13', tag: 'COZINHA', danger: true, items: [['Ruído', '0 dB'], ['Vidro', 'cedendo']] },
  { t: 78.543, clock: '23:13', tag: 'COZINHA', danger: true, items: [['Infectados dentro', '1'], ['Distância', '3 metros']] },
  { t: 93.572, clock: '23:14', tag: 'ESCADA', danger: true, items: [['Degraus até porão', '14'], ['Porta de aço', 'aberta']] },
  { t: 100.175, clock: '23:14', tag: 'PORÃO', danger: false, items: [['Porta de aço', 'trancada']] },
  { t: 108.658, clock: '23:14', tag: 'PORÃO', danger: true, items: [['Porta de aço', 'trancada'], ['Pessoas no porão', '3']] },
];

let lastHudIdx = -1;
function updateHud(t) {
  let idx = 0;
  for (let i = 0; i < HUD_STATES.length; i++) {
    if (t >= HUD_STATES[i].t) idx = i;
  }
  const st = HUD_STATES[idx];
  if (idx !== lastHudIdx) {
    lastHudIdx = idx;
    hudEl.classList.toggle('danger', st.danger);
    hudClockEl.textContent = st.clock;
    hudTagEl.textContent = st.tag;
    hudMetaEl.replaceChildren();
    for (const [label, val] of st.items) {
      const span = document.createElement('span');
      span.append(document.createTextNode(`${label}: `));
      const b = document.createElement('b');
      b.textContent = val;
      span.append(b);
      hudMetaEl.append(span);
    }
  }
  hudDotEl.style.opacity = st.danger ? String(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 7.5))) : '0.9';
}

function updateCaption(line) {
  caption.replaceChildren();
  if (!line) return;
  const name = document.createElement('strong');
  name.textContent = `${String(line.speaker || '').toUpperCase()}:`;
  caption.append(name, document.createTextNode(String(line.text || '')));
}

// ============================================================================
// Render determinístico de qualquer instante t
// ============================================================================
function draw(t, forced = false) {
  if (!window.ready) return;
  const time = clamp(Number(t) || 0, 0, duration || Math.max(0, Number(t) || 0));
  const line = lineAt(time);

  // 1) Posicionamento e animações determinísticas das personagens VRM
  const paths = [LUNA_PATH, BIA_PATH];
  for (let i = 0; i < ACTORS.length; i++) {
    const actor = ACTORS[i];
    const p = evalPath(paths[i], time);
    const seg = applyDeterministicTrack(actor.mixer, actor.actions, actor.motionTrack, time);
    actor.vrm.scene.position.set(p.pos.x, p.pos.y + (seg.yOffset || 0), p.pos.z);
    actor.vrm.scene.rotation.y = actor.baseYaw + p.yaw;
    actor.currentYaw = p.yaw;
    actor.vrm.scene.updateMatrixWorld(true);
  }

  // 2) Posicionamento e animações determinísticas dos 3 zumbis
  for (let i = 0; i < ZOMBIES.length; i++) {
    const z = ZOMBIES[i];
    const p = evalPath(ZOMBIE_PATHS[i], time);
    z.group.visible = p.visible;
    z.group.position.copy(p.pos);
    z.group.rotation.y = p.yaw;
    if (p.visible) {
      applyDeterministicTrack(z.mixer, z.actions, ZOMBIE_MOTIONS[i], time);
    }
    z.group.updateMatrixWorld(true);
  }

  // 3) Props dinâmicos (vidro, cacos, banco, porta de aço, silhueta final)
  updateSceneProps(time);

  // 4) Cabeças, câmera, olhar/sacadas e expressões faciais
  const heads = ACTORS.map(headPosition);
  const focusPos = directCamera(time, line, heads);
  updateGaze(time, line, heads);
  for (const actor of ACTORS) {
    applyExpressions(actor, line, time);
    actor.vrm.update(forced ? 1 / 30 : 1 / 60);
  }

  // 5) Iluminação, relâmpagos, HUD e legenda
  updateLighting(time, focusPos);
  updateHud(time);
  updateCaption(line);

  renderer.render(scene, camera);
}

window.renderFrame = (t) => draw(t, true);
window.capturaFrame = () => {
  if (!window.ready) throw new Error('Cena ainda não carregada');
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
};

function waitAudioMetadata(timeoutMs = 1500) {
  if (Number.isFinite(audio.duration) && audio.duration > 1) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    audio.addEventListener('loadedmetadata', done, { once: true });
  });
}

async function boot() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const [timedLines, timedWords] = await Promise.all([
      optionalJson('./falas.json'),
      optionalJson('./words.json'),
      waitAudioMetadata(1500),
    ]);
    falas = timedLines;
    words = timedWords;
    setupTiming();
    buildMotionTracks();

    await Promise.all([...ACTORS.map(loadActor), loadZombies()]);

    setupTiming();
    window.ready = true;
    draw(0, true);
  })().catch((error) => {
    fail(error);
    throw error;
  });
  return bootPromise;
}

audio.addEventListener('loadedmetadata', () => {
  setupTiming();
});
audio.addEventListener('ended', () => {
  playButton.hidden = false;
  playButton.setAttribute('aria-label', 'Reiniciar áudio e cena');
});
playButton.addEventListener('click', async () => {
  try {
    await boot();
    if (audio.ended || (duration && audio.currentTime >= duration - 0.1)) audio.currentTime = 0;
    await audio.play();
    playButton.hidden = true;
    errorBox.textContent = '';
  } catch (error) {
    fail(error);
  }
});

const clock = new T.Clock();
function loop() {
  requestAnimationFrame(loop);
  clock.getDelta();
  if (window.ready && !audio.paused) draw(audio.currentTime, false);
}
loop();
boot().catch(() => {});
