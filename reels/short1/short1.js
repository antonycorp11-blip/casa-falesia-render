import * as T from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { FBXLoader } from './lib/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { loadMixamoAnimation } from './lib/loadMixamoAnimation.js';
import { makeWorld } from './world.js';

const W = 1080;
const H = 1920;

const canvas = document.querySelector('#c');
const overlayCanvas = document.querySelector('#overlay');
const overlayCtx = overlayCanvas.getContext('2d');
const playButton = document.querySelector('#play');
const caption = document.querySelector('#legenda');
const errorBox = document.querySelector('#erro');
const audio = document.querySelector('#audio');

// Canvas fixo 1080x1920 (independe do tamanho da janela)
canvas.width = W;
canvas.height = H;
overlayCanvas.width = W;
overlayCanvas.height = H;

const captureCanvas = document.createElement('canvas');
captureCanvas.width = W;
captureCanvas.height = H;
const captureCtx = captureCanvas.getContext('2d');

const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(50, 9 / 16, 0.05, 160);
camera.up.set(0, 1, 0);

const world = makeWorld(scene);
const worldRoot = scene.children.find((item) => item.isGroup);

// Remove a mesa do brinde no centro da sala para liberar circulação e enquadramentos 9:16.
const partyTable = worldRoot?.children.find(
  (item) => item.isGroup && item.position.distanceToSquared(new T.Vector3(-0.25, 0, 2.28)) < 0.001
);
if (partyTable) partyTable.visible = false;

// Localiza o painel de vidro principal da sala (z = -4.98) para rachar e estourar.
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

// Luzes cinematográficas direcionais neutras/suaves (sem luz colorida colada aos rostos).
const keyLight = new T.DirectionalLight('#fff0dc', 1.12);
keyLight.position.set(-2.4, 3.6, 2.8);
keyLight.target = new T.Object3D();
scene.add(keyLight, keyLight.target);

const fillLight = new T.DirectionalLight('#e4efff', 0.54);
fillLight.position.set(2.6, 2.2, 2.6);
fillLight.target = new T.Object3D();
scene.add(fillLight, fillLight.target);

const rimLight = new T.DirectionalLight('#8bbdf2', 0.72);
rimLight.position.set(0, 2.9, -4.0);
rimLight.target = new T.Object3D();
scene.add(rimLight, rimLight.target);

// Clarão de relâmpago na varanda para recortar silhuetas e pele dos zumbis na chuva.
const lightningLight = new T.PointLight('#d8ecff', 0, 34, 1.15);
lightningLight.position.set(0, 3.8, -8.8);
scene.add(lightningLight);

// Luz sutil e neutra (sempre >= 2,2 m dos rostos) para leitura no escuro final do porão.
const darkFaceLight = new T.PointLight('#dce8f5', 0, 7.5, 1.45);
darkFaceLight.position.set(0, -2.2, 6.8);
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

// ============================================================================
// Props específicos do Short 1: mesa do rádio, faca na cozinha, vidro rachado/
// estilhaçado, escada do porão, porta de aço com trava e presença no escuro
// ============================================================================

// --- 1) Mesa pequena com rádio de emergência na sala (Bia ajusta no início) ---
const radioTable = new T.Group();
radioTable.position.set(1.22, 0, -2.08);
scene.add(radioTable);
{
  const tableWood = makeMat('#4f3626', { roughness: 0.62 });
  const radioBody = makeMat('#262d36', { roughness: 0.48, metalness: 0.35 });
  const radioDial = makeMat('#ffcb6b', { emissive: '#ffaa33', emissiveIntensity: 1.35, roughness: 0.3 });
  const radioMetal = makeMat('#9aa6b2', { roughness: 0.3, metalness: 0.8 });
  addBox(radioTable, 0.74, 0.05, 0.48, 0, 0.78, 0, tableWood);
  for (const lx of [-0.30, 0.30]) {
    for (const lz of [-0.18, 0.18]) {
      addBox(radioTable, 0.05, 0.78, 0.05, lx, 0.39, lz, tableWood);
    }
  }
  const radio = new T.Group();
  radio.position.set(-0.04, 0.805, 0);
  radio.rotation.y = -0.35;
  radioTable.add(radio);
  addBox(radio, 0.34, 0.19, 0.16, 0, 0.095, 0, radioBody);
  addBox(radio, 0.13, 0.05, 0.02, -0.06, 0.125, -0.075, radioDial, false);
  addBox(radio, 0.12, 0.11, 0.02, 0.08, 0.095, -0.075, makeMat('#161b22', { roughness: 0.8 }), false);
  const knob = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.025, 10), radioMetal);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(-0.08, 0.06, -0.085);
  radio.add(knob);
  const ant = new T.Mesh(new T.CylinderGeometry(0.004, 0.006, 0.44, 6), radioMetal);
  ant.position.set(0.13, 0.34, 0.04);
  ant.rotation.z = -0.22;
  radio.add(ant);
}

// --- 2) Faca na bancada da cozinha (Luna corre até o balcão e pega a faca) ---
const knifeGroup = new T.Group();
{
  const handleMat = makeMat('#241c18', { roughness: 0.65 });
  const bladeMat = makeMat('#d4dde6', { roughness: 0.18, metalness: 0.92 });
  addBox(knifeGroup, 0.024, 0.028, 0.115, 0, 0, -0.055, handleMat, true, false);
  addBox(knifeGroup, 0.006, 0.036, 0.21, 0, 0.004, 0.105, bladeMat, true, false);
}
const KNIFE_COUNTER_POS = new T.Vector3(10.18, 1.045, 0.08);
knifeGroup.position.copy(KNIFE_COUNTER_POS);
knifeGroup.rotation.set(0, 0.55, Math.PI / 2);
scene.add(knifeGroup);

// --- 3) Rachadura e estilhaços do vidro da sala ---
const glassFxGroup = new T.Group();
scene.add(glassFxGroup);

const CRACK_IMPACT = [-0.20, 1.44, -4.93];
const crackGroup = new T.Group();
crackGroup.position.set(CRACK_IMPACT[0], CRACK_IMPACT[1], CRACK_IMPACT[2]);
crackGroup.visible = false;
glassFxGroup.add(crackGroup);

const crackMat = new T.LineBasicMaterial({ color: '#e6f6ff', transparent: true, opacity: 0.92 });
const palmMat = new T.MeshBasicMaterial({ color: '#2b332c', transparent: true, opacity: 0.44, side: T.DoubleSide });
let crackLines;
let crackPalm;

{
  const impact = CRACK_IMPACT;
  const segments = [
    [-2.58, 0.28, -4.93, -1.45, 0.92, -4.93],
    [-1.45, 0.92, -4.93, impact[0], impact[1], -4.93],
    [impact[0], impact[1], -4.93, 0.92, 1.98, -4.93],
    [0.92, 1.98, -4.93, 2.58, 2.86, -4.93],
    [-2.48, 2.75, -4.93, -1.15, 1.95, -4.93],
    [-1.15, 1.95, -4.93, impact[0], impact[1], -4.93],
    [impact[0], impact[1], -4.93, 0.72, 0.72, -4.93],
    [0.72, 0.72, -4.93, 2.15, 0.14, -4.93],
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

  crackPalm = new T.Mesh(new T.CircleGeometry(0.11, 12), palmMat);
  crackPalm.position.set(0, 0, -0.01);
  crackGroup.add(crackPalm);
}

const shatterGroup = new T.Group();
shatterGroup.visible = false;
glassFxGroup.add(shatterGroup);

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

// --- 4) Escada de 14 degraus para o porão + corredor + porta de aço com trava ---
const basementGroup = new T.Group();
scene.add(basementGroup);
const matBaseConcrete = makeMat('#4b5159', { roughness: 0.92, metalness: 0.04 });
const matBaseWall = makeMat('#3a4048', { roughness: 0.92, metalness: 0.05 });
const matRail = makeMat('#262d36', { roughness: 0.42, metalness: 0.72 });
const matSteelDoor = makeMat('#65727e', { roughness: 0.36, metalness: 0.78 });
const matSteelFrame = makeMat('#273038', { roughness: 0.5, metalness: 0.65 });

for (let i = 0; i < 7; i++) {
  const sy = -((i + 1) * (2.0 / 7));
  const sz = 5.15 + i * 0.32;
  addBox(basementGroup, 1.48, 0.26, 0.36, -7.5, sy - 0.13, sz, matBaseConcrete);
}
addBox(basementGroup, 2.8, 0.24, 1.4, -6.9, -2.12, 7.95, matBaseConcrete);
for (let i = 0; i < 7; i++) {
  const sy = -2.0 - ((i + 1) * (2.0 / 7));
  const sz = 7.25 - i * 0.42;
  addBox(basementGroup, 1.38, 0.26, 0.45, -6.3, sy - 0.13, sz, matBaseConcrete);
}
addBox(basementGroup, 0.22, 6.2, 3.9, -8.35, -1.0, 6.9, matBaseWall, false, true);
addBox(basementGroup, 3.0, 6.2, 0.22, -6.9, -1.0, 8.75, matBaseWall, false, true);
addBox(basementGroup, 0.22, 2.4, 3.6, -5.52, -0.8, 6.9, matBaseWall, false, true);
addBox(basementGroup, 0.06, 0.06, 2.5, -8.15, -0.25, 6.2, matRail, false).rotation.x = 0.72;
addBox(basementGroup, 0.06, 0.06, 3.3, -6.95, -2.25, 5.9, matRail, false).rotation.x = -0.62;

addBox(basementGroup, 8.6, 0.24, 2.8, -3.1, -4.12, 3.7, matBaseConcrete, false, true);
addBox(basementGroup, 8.6, 0.20, 2.8, -3.1, -0.58, 3.7, matBaseWall, false, true);
addBox(basementGroup, 8.6, 3.4, 0.24, -3.1, -2.3, 2.35, matBaseWall, false, true);
addBox(basementGroup, 0.24, 3.4, 2.8, -7.25, -2.3, 3.7, matBaseWall, false, true);
addBox(basementGroup, 0.24, 3.4, 2.8, 1.15, -2.3, 3.7, matBaseWall, false, true);

const stairLightTop = new T.PointLight('#dce7f5', 5.2, 10.0, 1.35);
stairLightTop.position.set(-7.1, 0.85, 6.6);
basementGroup.add(stairLightTop);
const stairLightBot = new T.PointLight('#d6e5f5', 5.8, 11.0, 1.35);
stairLightBot.position.set(-4.6, -0.95, 3.5);
basementGroup.add(stairLightBot);

addBox(basementGroup, 0.68, 3.35, 0.26, -5.16, -2.325, 5.0, matBaseWall, false, true);
addBox(basementGroup, 8.68, 3.35, 0.26, 1.16, -2.325, 5.0, matBaseWall, false, true);
addBox(basementGroup, 1.64, 1.00, 0.26, -4.0, -1.15, 5.0, matBaseWall, false, true);
addBox(basementGroup, 0.12, 2.38, 0.32, -4.82, -2.81, 5.0, matSteelFrame);
addBox(basementGroup, 0.12, 2.38, 0.32, -3.18, -2.81, 5.0, matSteelFrame);
addBox(basementGroup, 1.76, 0.14, 0.32, -4.0, -1.62, 5.0, matSteelFrame);

const steelDoorPivot = new T.Group();
steelDoorPivot.position.set(-4.78, -4.0, 5.04);
basementGroup.add(steelDoorPivot);
addBox(steelDoorPivot, 1.58, 2.32, 0.11, 0.79, 1.16, 0, matSteelDoor);
for (const ry of [0.35, 1.16, 1.96]) {
  addBox(steelDoorPivot, 1.50, 0.09, 0.15, 0.79, ry, 0, matSteelFrame, false);
}
addBox(steelDoorPivot, 0.52, 0.06, 0.08, 1.18, 1.06, 0.09, matRail, false);
const lockBolt = addBox(
  steelDoorPivot,
  0.28,
  0.08,
  0.09,
  1.44,
  1.36,
  0.10,
  makeMat('#c83b3b', { roughness: 0.4, metalness: 0.65 }),
  false
);
// LED emissivo apenas visual (sem PointLight vermelho próximo aos rostos!)
const lockLedMat = makeMat('#ffae33', { emissive: '#ff9922', emissiveIntensity: 1.5 });
const lockLed = new T.Mesh(new T.SphereGeometry(0.045, 10, 10), lockLedMat);
lockLed.position.set(-4.0, -1.48, 5.18);
basementGroup.add(lockLed);

// --- 5) Presença / silhueta que se move no fundo escuro do porão ---
const shadowFigure = new T.Group();
shadowFigure.position.set(0.12, -4.0, 12.65);
shadowFigure.rotation.y = Math.PI;
shadowFigure.visible = false;
scene.add(shadowFigure);
{
  const darkMat = makeMat('#0a0f16', { roughness: 0.96, metalness: 0.02 });
  const torso = new T.Mesh(new T.CylinderGeometry(0.21, 0.25, 0.76, 12), darkMat);
  torso.position.y = 1.14;
  shadowFigure.add(torso);
  const head = new T.Mesh(new T.SphereGeometry(0.15, 12, 12), darkMat);
  head.position.set(0, 1.66, 0.02);
  shadowFigure.add(head);
  for (const sx of [-0.11, 0.11]) {
    const leg = new T.Mesh(new T.CylinderGeometry(0.082, 0.072, 0.80, 8), darkMat);
    leg.position.set(sx, 0.40, 0);
    shadowFigure.add(leg);
  }
  for (const sx of [-0.28, 0.28]) {
    const arm = new T.Mesh(new T.CylinderGeometry(0.056, 0.048, 0.68, 8), darkMat);
    arm.position.set(sx, 1.08, 0.04);
    arm.rotation.z = sx < 0 ? 0.12 : -0.12;
    shadowFigure.add(arm);
  }
  const eyeMat = new T.MeshBasicMaterial({ color: '#b4d0e6', transparent: true, opacity: 0.68 });
  for (const ex of [-0.045, 0.045]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.012, 6, 6), eyeMat);
    eye.position.set(ex, 1.68, 0.15);
    shadowFigure.add(eye);
  }
}

// ============================================================================
// Coleta de todas as luzes locais da cena para guarda de distância >= 1,5 m
// ============================================================================
const allLocalLights = [];
scene.traverse((obj) => {
  if (obj.isPointLight || obj.isSpotLight) allLocalLights.push(obj);
});

function isColoredLight(light) {
  const c = light.color;
  const maxC = Math.max(c.r, c.g, c.b);
  const minC = Math.min(c.r, c.g, c.b);
  return maxC - minC > 0.12;
}

const _lightWorldPos = new T.Vector3();
function enforceSafeLightDistance(heads) {
  for (const light of allLocalLights) {
    if (!isColoredLight(light) || light.intensity <= 0) continue;
    light.getWorldPosition(_lightWorldPos);
    let minD = Infinity;
    for (const h of heads) {
      const d = _lightWorldPos.distanceTo(h);
      if (d < minD) minD = d;
    }
    if (minD < 2.0) {
      light.intensity *= smooth(1.5, 2.0, minD);
    }
  }
}

// ============================================================================
// Configuração das animações Mixamo (VRMs + Zumbis reais do Mixamo)
// ============================================================================
const MOTION_FILES = {
  idle: 'idle',
  weight_shift: 'weight_shift',
  look_around: 'look_around',
  nervously_look_around: 'nervously_look_around',
  surprised: 'surprised',
  terrified: 'terrified',
  walking: 'walking',
  walk: 'walk',
  walking_backwards: 'walking_backwards',
  running: 'running',
  fast_run: 'fast_run',
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
const ONE_SHOT_MOTIONS = new Set(['surprised', 'terrified', 'opening']);

const ZOMBIE_MOTION_FILES = {
  zombie_idle: ['./vrm/mixamo/pack_zumbi/zombie_idle.fbx'],
  zombie_walk: ['./vrm/mixamo/pack_zumbi/zombie_walk.fbx'],
  zombie_run: ['./vrm/mixamo/pack_zumbi/zombie_run.fbx'],
  zombie_attack: ['./vrm/mixamo/pack_zumbi/zombie_attack.fbx'],
  zombie_scream: ['./vrm/mixamo/pack_zumbi/zombie_scream.fbx'],
  zombie_biting: ['./vrm/mixamo/pack_zumbi/zombie_biting.fbx'],
  running_crawl: [
    './vrm/mixamo/pack_zumbi/running_crawl.fbx',
    './vrm/mixamo/running_crawl.fbx',
  ],
};

const ACTORS = [
  { name: 'LUNA', url: './vrm/test.vrm', actions: {}, motionTrack: [], headY: 1.48, forbiddenMorphs: [] },
  { name: 'BIA', url: './vrm/bia.vrm', actions: {}, motionTrack: [], headY: 1.50, forbiddenMorphs: [] },
];

// Zumbis reais do Mixamo (malha + textura originais, esqueleto mixamorig direto)
const ZOMBIES = [
  { id: 0, name: 'garota_zumbi', url: './vrm/mixamo/zumbis/zombiegirl.fbx', targetHeight: 1.72 },
  { id: 1, name: 'policial_zumbi', url: './vrm/mixamo/zumbis/copzombie.fbx', targetHeight: 1.78 },
  { id: 2, name: 'corredor', url: './vrm/mixamo/zumbis/yaku.fbx', targetHeight: 1.75 },
];

let falas = [];
let words = [];
let textCues = [];
let duration = 60.5;
let crackStartTime = 15.80;
let shatterStartTime = 25.85;
let bootPromise;
window.ready = false;
window.DURACAO = 0;

const BLUSH_REGEX = /blush|rubor|cheek|shy|tereru|flush|hoho|embarrass|redface|赤|照れ|頬/i;

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

async function optionalText(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

// ============================================================================
// Parsing de [TEXTO: ...] do roteiro.txt vinculado ao início da fala seguinte
// ============================================================================
const KEYWORD_HINTS = {
  'NÃO ABRA A PORTA': { word: 'PORTA', color: '#ff2e38' },
  'ELA JÁ ESTÁ NO VIDRO': { word: 'VIDRO', color: '#ffe033' },
  'TRÊS CONTRA DUAS': { word: 'TRÊS', color: '#ff2e38' },
  'ELES NÃO PARAM': { word: 'PARAM', color: '#ff2e38' },
  'O BUNKER NÃO ESTAVA VAZIO': { word: 'VAZIO', color: '#ffe033' },
};

function chooseHighlight(text, idx) {
  const upper = text.trim().toUpperCase();
  if (KEYWORD_HINTS[upper]) return KEYWORD_HINTS[upper];
  const tokens = upper.split(/\s+/).filter(Boolean);
  const candidates = tokens.filter((w) => w.replace(/[^A-ZÀ-Ú]/gi, '').length >= 4);
  const word = candidates[candidates.length - 1] || tokens[tokens.length - 1] || '';
  return { word, color: idx % 2 === 0 ? '#ff2e38' : '#ffe033' };
}

function buildTextCues(roteiroRaw) {
  const cues = [];
  if (roteiroRaw && falas.length) {
    const lines = roteiroRaw.split(/\r?\n/);
    let pendingText = null;
    let falaCursor = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const tm = line.match(/^\[TEXTO:\s*(.+?)\s*\]$/i);
      if (tm) {
        pendingText = tm[1].trim();
        continue;
      }
      const sm = line.match(/^(NARRADOR|RADIO|RÁDIO|LUNA|BIA)\s*:\s*(.+)$/i);
      if (sm) {
        const spk = sm[1].toUpperCase().replace('Á', 'A');
        const body = sm[2].trim();
        let matched = null;
        for (let j = falaCursor; j < falas.length; j++) {
          const f = falas[j];
          const fSpk = String(f.speaker || '').toUpperCase().replace('Á', 'A');
          if (fSpk === spk && String(f.text || '').trim().slice(0, 16).toLowerCase() === body.slice(0, 16).toLowerCase()) {
            matched = f;
            falaCursor = j + 1;
            break;
          }
        }
        if (!matched && falaCursor < falas.length) {
          matched = falas[falaCursor++];
        }
        if (pendingText && matched) {
          const hi = chooseHighlight(pendingText, cues.length);
          cues.push({
            text: pendingText.toUpperCase(),
            start: matched.start,
            dur: 2.55,
            keyword: hi.word,
            color: hi.color,
          });
          pendingText = null;
        }
      }
    }
  }
  if (!cues.length) {
    const fallback = [
      { text: 'NÃO ABRA A PORTA', start: 0.0 },
      { text: 'ELA JÁ ESTÁ NO VIDRO', start: 14.739 },
      { text: 'TRÊS CONTRA DUAS', start: 25.62 },
      { text: 'ELES NÃO PARAM', start: 37.503 },
      { text: 'O BUNKER NÃO ESTAVA VAZIO', start: 51.641 },
    ];
    fallback.forEach((item, idx) => {
      const hi = chooseHighlight(item.text, idx);
      cues.push({ text: item.text, start: item.start, dur: 2.55, keyword: hi.word, color: hi.color });
    });
  }
  textCues = cues;
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

  const garotaLine = falas.find((f) => /garota\s+zumbi/i.test(String(f.text || '')));
  if (garotaLine) crackStartTime = garotaLine.start + 1.05;
  const shatterLine = falas.find((f) => /vidro\s+(explode|estoura)/i.test(String(f.text || '')));
  if (shatterLine) shatterStartTime = shatterLine.start + 0.25;

  const speechEnd = Math.max(0, ...falas.map((f) => f.end));
  const audioDur =
    Number.isFinite(audio.duration) && audio.duration > 1 ? audio.duration : Math.max(speechEnd + 2.0, 60);
  duration = audioDur + 0.5;
  window.DURACAO = duration;
}

// ============================================================================
// Sanitização do VRM (corrige o bug do rosto vermelho da Bia ao agachar/olhar)
// ============================================================================
function sanitizeActorVRM(actor) {
  actor.forbiddenMorphs = [];

  actor.vrm.scene.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;

    // 1) Bloqueia qualquer blendshape de rubor/blush/bochecha vermelha
    if (node.morphTargetDictionary && node.morphTargetInfluences) {
      for (const [mName, idx] of Object.entries(node.morphTargetDictionary)) {
        if (BLUSH_REGEX.test(mName)) {
          actor.forbiddenMorphs.push({ mesh: node, index: idx });
          node.morphTargetInfluences[idx] = 0;
        }
      }
    }

    // 2) Neutraliza rim/emissive avermelhado e shadeColorFactor excessivamente vermelho em MToon
    const isFaceOrSkin = /face|skin|head|body|brow|cheek|mouth/i.test(node.name || '');
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of mats) {
      if (!m) continue;
      const matIsFace = isFaceOrSkin || /face|skin|head|body/i.test(m.name || '');

      if (matIsFace && m.emissive && m.emissive.r > 0.12 && m.emissive.r > m.emissive.g * 1.25) {
        m.emissive.setRGB(0, 0, 0);
        if ('emissiveIntensity' in m) m.emissiveIntensity = 0;
      }

      // MToon 1.0 (three-vrm v2/v3)
      if (m.parametricRimColorFactor) {
        const rc = m.parametricRimColorFactor;
        if (matIsFace || (rc.r > rc.g + 0.10 && rc.r > rc.b + 0.10)) {
          rc.setRGB(0.05, 0.05, 0.06);
        }
        if (matIsFace && 'parametricRimLiftFactor' in m) {
          m.parametricRimLiftFactor = 0;
        }
      }
      if (matIsFace && m.shadeColorFactor) {
        const sc = m.shadeColorFactor;
        // Evita que sombra MToon no rosto (ao agachar ou inclinar cabeça) fique vermelha saturada
        if (sc.r > sc.g * 1.22 && sc.r > sc.b * 1.30) {
          sc.g = Math.max(sc.g, sc.r * 0.85);
          sc.b = Math.max(sc.b, sc.r * 0.78);
        }
      }

      // MToon 0.x uniforms fallback
      if (m.uniforms) {
        const rimU = m.uniforms.rimColor?.value || m.uniforms.parametricRimColorFactor?.value;
        if (rimU && (matIsFace || (rimU.r > rimU.g + 0.10 && rimU.r > rimU.b + 0.10))) {
          rimU.setRGB(0.05, 0.05, 0.06);
        }
        const shadeU = m.uniforms.shadeColor?.value || m.uniforms.shadeColorFactor?.value;
        if (matIsFace && shadeU && shadeU.r > shadeU.g * 1.22 && shadeU.r > shadeU.b * 1.30) {
          shadeU.g = Math.max(shadeU.g, shadeU.r * 0.85);
          shadeU.b = Math.max(shadeU.b, shadeU.r * 0.78);
        }
      }
      m.needsUpdate = true;
    }
  });

  // 3) Remove binds de rubor/cor vermelha dentro das expressões do VRM
  const ex = actor.vrm.expressionManager;
  if (ex) {
    const exprList = Array.isArray(ex.expressions)
      ? ex.expressions
      : ex._expressionMap
        ? Object.values(ex._expressionMap)
        : [];
    for (const expr of exprList) {
      if (!expr) continue;
      if (BLUSH_REGEX.test(expr.expressionName || expr.name || '')) {
        try {
          ex.setValue(expr.expressionName || expr.name, 0);
        } catch {
          // ignora
        }
      }
      const binds = expr._binds || expr.binds;
      if (Array.isArray(binds)) {
        for (let i = binds.length - 1; i >= 0; i--) {
          const b = binds[i];
          const isMaterialColor = Boolean(b?.material && b?.type && /color|rim|emissive|shade/i.test(String(b.type)));
          if (isMaterialColor) {
            binds.splice(i, 1);
            continue;
          }
          // Se o morphTargetBind aponta para um morph de blush/rubor, remove o bind
          if (b?.primitives && Number.isInteger(b?.index)) {
            const hitsBlush = b.primitives.some((prim) => {
              const dict = prim?.morphTargetDictionary;
              if (!dict) return false;
              return Object.entries(dict).some(([k, v]) => v === b.index && BLUSH_REGEX.test(k));
            });
            if (hitsBlush) binds.splice(i, 1);
          }
        }
      }
    }
  }
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
  sanitizeActorVRM(actor);
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
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function fixZombieMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) {
        m.map.colorSpace = T.SRGBColorSpace;
        m.map.needsUpdate = true;
      }
      if (m.emissiveMap) {
        m.emissiveMap.colorSpace = T.SRGBColorSpace;
        m.emissiveMap.needsUpdate = true;
      }
      // Garante materiais originais opacos (FBXLoader do Mixamo às vezes marca transparent=true/opacity=0)
      m.transparent = false;
      m.opacity = 1;
      m.alphaTest = 0;
      m.depthWrite = true;
      m.depthTest = true;
      m.side = T.DoubleSide;
      if (m.color && m.map && m.color.r < 0.02 && m.color.g < 0.02 && m.color.b < 0.02) {
        m.color.set('#ffffff');
      }
      if ('shininess' in m && m.shininess > 28) {
        m.shininess = 18;
      }
      m.needsUpdate = true;
    }
  });
}

function getClipHipsY(clip) {
  if (!clip) return 0;
  for (const track of clip.tracks) {
    const dot = track.name.indexOf('.');
    if (dot < 0) continue;
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    if (prop === 'position' && normBoneName(nodeName) === 'hips' && track.values.length >= 3) {
      return Math.abs(track.values[1]);
    }
  }
  return 0;
}

function adaptClipForZombie(rawClip, model, motionName, refClipHipsY) {
  const boneMap = new Map();
  let hipsBone = null;
  model.traverse((obj) => {
    if (!obj.name) return;
    const norm = normBoneName(obj.name);
    if (!boneMap.has(norm)) boneMap.set(norm, obj.name);
    if (norm === 'hips' && !hipsBone) hipsBone = obj;
  });

  const restHips = hipsBone ? hipsBone.position.clone() : new T.Vector3(0, refClipHipsY || 95, 0);
  const ratio =
    refClipHipsY > 1e-4 && Math.abs(restHips.y) > 1e-4 ? Math.abs(restHips.y) / refClipHipsY : 1;

  const keptTracks = [];
  for (const rawTrack of rawClip.tracks) {
    const dot = rawTrack.name.indexOf('.');
    if (dot < 0) continue;
    const nodeName = rawTrack.name.slice(0, dot);
    const prop = rawTrack.name.slice(dot + 1);
    if (prop === 'scale') continue; // Evita distorções de escala vindas de FBX diferentes

    let targetName = nodeName;
    if (!model.getObjectByName(nodeName)) {
      const mapped = boneMap.get(normBoneName(nodeName));
      if (!mapped) continue;
      targetName = mapped;
    }

    const track = rawTrack.clone();
    track.name = `${targetName}.${prop}`;

    if (prop === 'position' && normBoneName(nodeName) === 'hips') {
      const firstY = track.values[1] || refClipHipsY || restHips.y;
      const isUprightMove = motionName === 'zombie_walk' || motionName === 'zombie_run';
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = restHips.x;
        track.values[i + 2] = restHips.z;
        if (isUprightMove) {
          track.values[i + 1] = restHips.y + (track.values[i + 1] - firstY) * ratio * 0.5;
        } else {
          track.values[i + 1] = track.values[i + 1] * ratio;
        }
      }
    }
    keptTracks.push(track);
  }
  return new T.AnimationClip(`${rawClip.name}_${motionName}`, rawClip.duration, keptTracks);
}

async function loadFirstAvailableClip(urls) {
  for (const url of urls) {
    try {
      const animAsset = await new FBXLoader().loadAsync(url);
      const clip =
        T.AnimationClip.findByName(animAsset.animations, 'mixamo.com') || animAsset.animations[0];
      if (clip) return clip;
    } catch {
      // tenta próximo candidato
    }
  }
  return null;
}

async function loadZombies() {
  const rawClips = {};
  await Promise.all(
    Object.entries(ZOMBIE_MOTION_FILES).map(async ([name, urls]) => {
      const clip = await loadFirstAvailableClip(urls);
      if (clip) rawClips[name] = clip;
    })
  );

  const refClipHipsY =
    getClipHipsY(rawClips.zombie_idle) ||
    getClipHipsY(rawClips.zombie_walk) ||
    getClipHipsY(Object.values(rawClips)[0]) ||
    95;

  await Promise.all(
    ZOMBIES.map(async (z) => {
      const model = await new FBXLoader().loadAsync(z.url);
      fixZombieMaterials(model);

      // Escale cada personagem zumbi para ~1,75 m com pés assentados em y = 0
      model.updateMatrixWorld(true);
      const rawBox = new T.Box3().setFromObject(model);
      let rawH = rawBox.max.y - rawBox.min.y;
      if (!Number.isFinite(rawH) || rawH < 0.1 || rawH > 5000) {
        let minY = Infinity;
        let maxY = -Infinity;
        const tmp = new T.Vector3();
        model.traverse((obj) => {
          if (obj.isBone) {
            obj.getWorldPosition(tmp);
            minY = Math.min(minY, tmp.y);
            maxY = Math.max(maxY, tmp.y);
          }
        });
        rawH = maxY > minY ? (maxY - minY) * 1.12 : 175;
      }
      const scale = (z.targetHeight || 1.75) / rawH;
      model.scale.setScalar(scale);
      model.updateMatrixWorld(true);
      const scaledBox = new T.Box3().setFromObject(model);
      if (Number.isFinite(scaledBox.min.y) && Math.abs(scaledBox.min.y) < 3.0) {
        model.position.y -= scaledBox.min.y;
      }

      const group = new T.Group();
      group.add(model);
      scene.add(group);

      z.group = group;
      z.model = model;
      z.mixer = new T.AnimationMixer(model);
      z.actions = {};
      for (const [mName, rawClip] of Object.entries(rawClips)) {
        const adapted = adaptClipForZombie(rawClip, model, mName, refClipHipsY);
        const action = z.mixer.clipAction(adapted);
        action.setLoop(T.LoopRepeat);
        action.clampWhenFinished = true;
        z.actions[mName] = action;
      }
    })
  );
}

// ============================================================================
// Seleção variada e sem repetição de gestos de fala
// ============================================================================
function pickSpeechMotion(line, usedHistory, seedIdx) {
  const text = String(line.text || '').toLowerCase();
  let pool;
  if (/loucura|\?/.test(text)) {
    pool = ['look_away_gesture', 'talking_1', 'standing_arguing', 'talking2'];
  } else if (/calma|afasta/.test(text)) {
    pool = ['dismissing_gesture', 'talking_2', 'talking', 'shaking_head_no'];
  } else if (/sozinha|resolvo/.test(text)) {
    pool = ['angry_gesture', 'standing_arguing', 'talking_1', 'happy_hand_gesture'];
  } else if (/não tá|atrás dela/.test(text)) {
    pool = ['shaking_head_no', 'yelling_out', 'talking_2', 'dismissing_gesture'];
  } else if (/corre|porão|bora/.test(text)) {
    pool = ['yelling', 'yelling_out', 'angry_gesture'];
  } else if (/conseguimos|escuro/.test(text)) {
    pool = ['nervously_look_around', 'look_away_gesture', 'talking2', 'talking'];
  } else {
    pool = [
      'talking',
      'talking2',
      'talking_1',
      'talking_2',
      'standing_arguing',
      'dismissing_gesture',
      'look_away_gesture',
      'shaking_head_no',
    ];
  }
  const recent = new Set(usedHistory.slice(-3));
  const fresh = pool.filter((m) => !recent.has(m));
  const candidates = fresh.length ? fresh : pool.filter((m) => m !== usedHistory[usedHistory.length - 1]);
  const pickIdx = Math.floor(hash(seedIdx * 17 + 5) * Math.max(1, candidates.length));
  return candidates[pickIdx] || pool[0];
}

// ============================================================================
// Coreografia do Short 1 (60 s): sala -> varanda -> cozinha -> sala -> escada -> porão
// ============================================================================
const LUNA_PATH = [
  // PARTE 1 — SALA: encostada perto do vidro olhando a tempestade (0..14.7)
  { t: 0.0, x: -0.32, y: 0, z: -4.22, yaw: Math.PI + 0.08 },
  { t: 6.4, x: -0.32, y: 0, z: -4.22, yaw: Math.PI + 0.05 },
  // Vira e dá uns passos afastando-se um pouco ao ouvir o alerta no rádio (6.4..8.6)
  { t: 8.6, x: -0.45, y: 0, z: -3.45, yaw: 0.92 },
  { t: 11.2, x: -0.45, y: 0, z: -3.45, yaw: 0.98 },
  { t: 14.5, x: -0.42, y: 0, z: -3.28, yaw: Math.PI + 0.06 },
  // VARANDA: garota zumbi bate no vidro; Luna recua impulsiva de costas (15.6..18.6)
  { t: 15.6, x: -0.42, y: 0, z: -3.28, yaw: Math.PI + 0.04, faceYaw: true },
  { t: 18.6, x: -0.25, y: 0, z: -1.45, yaw: Math.PI - 0.12, faceYaw: true },
  // PARTE 2 — COZINHA: corre até o balcão e pega a faca pronta para reagir (18.9..21.3)
  { t: 18.9, x: -0.10, y: 0, z: -1.30 },
  { t: 20.1, x: 4.85, y: 0, z: -0.45 },
  { t: 21.25, x: 9.42, y: 0, z: -0.08, yaw: 1.52 },
  { t: 21.85, x: 9.42, y: 0, z: -0.08, yaw: -1.48 },
  { t: 25.15, x: 9.42, y: 0, z: -0.08, yaw: -1.52 },
  // SALA: corre de volta para a sala quando o vidro explode, trava por 1 s e Bia a puxa (25.15..30.0)
  { t: 26.6, x: 5.45, y: 0, z: -0.45 },
  { t: 28.0, x: 2.35, y: 0, z: -0.78, yaw: Math.PI - 0.35 },
  { t: 29.75, x: 2.35, y: 0, z: -0.78, yaw: Math.PI - 0.42 },
  // Fuga correndo pela sala até a escada do porão (29.75..37.2)
  { t: 31.4, x: 0.15, y: 0, z: -1.15 },
  { t: 33.4, x: -3.25, y: 0, z: -1.95 },
  { t: 35.0, x: -5.45, y: 0, z: -2.38 },
  { t: 36.1, x: -7.50, y: 0, z: -1.10 },
  { t: 37.5, x: -7.50, y: 0, z: 3.65 },
  // PARTE 3 — ESCADA: desce correndo os 14 degraus com o corredor logo atrás (37.5..43.2)
  { t: 38.1, x: -7.50, y: 0, z: 5.05 },
  { t: 39.7, x: -7.50, y: -2.0, z: 7.35 },
  { t: 40.3, x: -6.30, y: -2.0, z: 7.55 },
  { t: 41.9, x: -6.30, y: -4.0, z: 4.50 },
  { t: 42.75, x: -5.05, y: -4.0, z: 3.90 },
  { t: 43.35, x: -4.22, y: -4.0, z: 4.95 },
  // PORÃO: Bia empurra Luna para dentro e trava a porta de aço (43.35..46.3)
  { t: 44.1, x: -4.35, y: -4.0, z: 5.95, yaw: Math.PI + 0.12 },
  { t: 46.2, x: -4.35, y: -4.0, z: 5.95, yaw: Math.PI + 0.12 },
  // Anda cautelosa contornando a escotilha até o centro do porão escuro (46.2..49.4)
  { t: 47.9, x: -3.55, y: -4.0, z: 9.05 },
  { t: 49.4, x: -0.52, y: -4.0, z: 9.55, yaw: Math.PI + 0.20 },
  { t: 50.6, x: -0.52, y: -4.0, z: 9.55, yaw: Math.PI + 0.25 },
  // Vira devagar para trás (+Z) ao perceber algo se movendo no escuro (50.6..52.4)
  { t: 52.4, x: -0.52, y: -4.0, z: 9.55, yaw: 0.15 },
  { t: 62.0, x: -0.52, y: -4.0, z: 9.55, yaw: 0.12 },
];

const BIA_PATH = [
  // PARTE 1 — SALA: ajusta o rádio na mesa com calma (0..11.0)
  { t: 0.0, x: 0.68, y: 0, z: -2.32, yaw: 0.65 },
  { t: 6.2, x: 0.68, y: 0, z: -2.32, yaw: 0.55 },
  { t: 8.4, x: 0.68, y: 0, z: -2.32, yaw: -2.35 },
  // Dá um passo calmo em direção a Luna ("Fica calma, Luna. Afasta da janela.")
  { t: 11.0, x: 0.68, y: 0, z: -2.32, yaw: -2.42 },
  { t: 12.6, x: 0.48, y: 0, z: -2.55, yaw: -2.65 },
  { t: 14.5, x: 0.48, y: 0, z: -2.55, yaw: Math.PI - 0.16 },
  // VARANDA: observa sem entrar em pânico enquanto Luna recua (14.5..19.2)
  { t: 19.2, x: 0.48, y: 0, z: -2.55, yaw: Math.PI - 0.20 },
  // PARTE 2 — COZINHA: acompanha até o arco da cozinha e aponta para a varanda (19.2..25.3)
  { t: 21.5, x: 5.85, y: 0, z: -1.18 },
  { t: 22.6, x: 7.45, y: 0, z: -1.15, yaw: -1.78 },
  { t: 25.3, x: 7.45, y: 0, z: -1.15, yaw: -1.85 },
  // SALA: corre de volta para puxar Luna pelo braço quando o vidro explode (25.3..29.8)
  { t: 26.8, x: 4.75, y: 0, z: -0.95 },
  { t: 28.4, x: 1.65, y: 0, z: -1.05, yaw: 1.15 },
  { t: 29.75, x: 1.65, y: 0, z: -1.05, yaw: -1.85 },
  // Fuga correndo na frente rumo à escada do porão (29.75..37.5)
  { t: 31.2, x: -0.55, y: 0, z: -1.45 },
  { t: 33.2, x: -3.95, y: 0, z: -2.18 },
  { t: 34.7, x: -5.65, y: 0, z: -2.40 },
  { t: 35.8, x: -7.50, y: 0, z: -0.95 },
  { t: 37.5, x: -7.50, y: 0, z: 4.95 },
  // PARTE 3 — ESCADA: desce os 14 degraus à frente de Luna (37.5..43.0)
  { t: 39.1, x: -7.50, y: -2.0, z: 7.35 },
  { t: 39.7, x: -6.30, y: -2.0, z: 7.55 },
  { t: 41.3, x: -6.30, y: -4.0, z: 4.50 },
  { t: 42.15, x: -4.85, y: -4.0, z: 3.85 },
  { t: 42.95, x: -3.95, y: -4.0, z: 4.90 },
  // PORÃO: empurra Luna para dentro, fecha e trava a porta de aço (42.95..46.3)
  { t: 43.8, x: -3.62, y: -4.0, z: 5.62, yaw: Math.PI - 0.14 },
  { t: 46.2, x: -3.62, y: -4.0, z: 5.58, yaw: Math.PI - 0.12 },
  // Contorna a escotilha até o centro do porão escuro (46.2..48.9)
  { t: 47.6, x: -3.15, y: -4.0, z: 8.95 },
  { t: 48.9, x: 0.52, y: -4.0, z: 9.55, yaw: Math.PI - 0.22 },
  { t: 49.9, x: 0.52, y: -4.0, z: 9.55, yaw: Math.PI - 0.25 },
  // Vira devagar para trás (+Z) ao perguntar "Quem tá aí no escuro?" (49.9..51.8)
  { t: 51.8, x: 0.52, y: -4.0, z: 9.55, yaw: -0.15 },
  { t: 62.0, x: 0.52, y: -4.0, z: 9.55, yaw: -0.12 },
];

// Trajetórias dos 3 zumbis reais do Mixamo
const ZOMBIE_PATHS = [
  // Zumbi 0 — GAROTA ZUMBI (zombiegirl.fbx): surge na varanda, bate no vidro, invade e segue até o porão
  [
    { t: 0.0, x: -0.20, y: 0, z: -13.5, yaw: 0, visible: false, cut: true },
    { t: 14.1, x: -0.20, y: 0, z: -7.4, yaw: 0, visible: false, cut: true },
    { t: 14.2, x: -0.20, y: 0, z: -7.2, yaw: 0, visible: true },
    { t: 15.55, x: -0.20, y: 0, z: -5.45, yaw: 0, visible: true },
    { t: 25.85, x: -0.20, y: 0, z: -5.45, yaw: 0, visible: true },
    // Estoura o vidro e invade a sala -> persegue até a escada -> porão
    { t: 27.5, x: -0.15, y: 0, z: -3.85, yaw: 0.05, visible: true },
    { t: 31.0, x: -0.45, y: 0, z: -2.05, visible: true },
    { t: 35.0, x: -3.65, y: 0, z: -2.25, visible: true },
    { t: 38.2, x: -6.95, y: 0, z: -1.25, visible: true },
    { t: 40.2, x: -7.50, y: 0, z: 5.05, visible: true },
    { t: 42.1, x: -7.50, y: -2.0, z: 7.35, visible: true },
    { t: 42.8, x: -6.30, y: -2.0, z: 7.55, visible: true },
    { t: 44.6, x: -6.30, y: -4.0, z: 4.50, visible: true },
    { t: 46.1, x: -3.45, y: -4.0, z: 4.28, yaw: -0.30, visible: true },
    { t: 62.0, x: -3.45, y: -4.0, z: 4.28, yaw: -0.30, visible: true },
  ],
  // Zumbi 1 — POLICIAL ZUMBI (copzombie.fbx): surge atrás da garota zumbi, estoura o vidro e persegue
  [
    { t: 0.0, x: -1.1, y: 0, z: -14.5, yaw: 0, visible: false, cut: true },
    { t: 21.4, x: -1.15, y: 0, z: -10.8, yaw: 0.08, visible: false, cut: true },
    { t: 21.5, x: -1.15, y: 0, z: -10.5, yaw: 0.08, visible: true },
    { t: 25.4, x: -0.92, y: 0, z: -6.05, yaw: 0.12, visible: true },
    { t: 25.85, x: -0.90, y: 0, z: -5.65, yaw: 0.12, visible: true },
    // Invade a sala atrás da explosão do vidro -> corre até a escada -> porão
    { t: 28.0, x: -0.75, y: 0, z: -3.25, visible: true },
    { t: 31.8, x: -1.85, y: 0, z: -1.95, visible: true },
    { t: 35.6, x: -5.25, y: 0, z: -2.35, visible: true },
    { t: 38.8, x: -7.50, y: 0, z: 3.45, visible: true },
    { t: 39.6, x: -7.50, y: 0, z: 5.05, visible: true },
    { t: 41.4, x: -7.50, y: -2.0, z: 7.35, visible: true },
    { t: 42.0, x: -6.30, y: -2.0, z: 7.55, visible: true },
    { t: 43.8, x: -6.30, y: -4.0, z: 4.50, visible: true },
    { t: 45.4, x: -4.62, y: -4.0, z: 4.30, yaw: 0.30, visible: true },
    { t: 62.0, x: -4.62, y: -4.0, z: 4.30, yaw: 0.30, visible: true },
  ],
  // Zumbi 2 — O CORREDOR (yaku.fbx): rápido/rastejante, invade e quase agarra o ombro na escada!
  [
    { t: 0.0, x: 1.1, y: 0, z: -15.0, yaw: 0, visible: false, cut: true },
    { t: 21.4, x: 1.15, y: 0, z: -12.0, yaw: -0.10, visible: false, cut: true },
    { t: 21.5, x: 1.15, y: 0, z: -11.6, yaw: -0.10, visible: true },
    { t: 25.4, x: 0.82, y: 0, z: -6.10, yaw: -0.14, visible: true },
    { t: 25.85, x: 0.78, y: 0, z: -5.50, yaw: -0.14, visible: true },
    // Dispara pelo vidro estilhaçado e cola em Luna na escada!
    { t: 27.8, x: 0.55, y: 0, z: -2.45, visible: true },
    { t: 30.8, x: -0.35, y: 0, z: -1.55, visible: true },
    { t: 34.4, x: -4.15, y: 0, z: -2.25, visible: true },
    { t: 36.6, x: -7.45, y: 0, z: -1.15, visible: true },
    { t: 37.8, x: -7.50, y: 0, z: 2.35, visible: true },
    { t: 38.8, x: -7.50, y: 0, z: 5.05, visible: true },
    { t: 40.25, x: -7.50, y: -2.0, z: 7.35, visible: true },
    { t: 40.8, x: -6.30, y: -2.0, z: 7.55, visible: true },
    { t: 42.3, x: -6.30, y: -4.0, z: 4.50, visible: true },
    { t: 43.35, x: -4.95, y: -4.0, z: 3.92, visible: true },
    { t: 44.3, x: -4.05, y: -4.0, z: 4.46, yaw: 0, visible: true },
    { t: 62.0, x: -4.05, y: -4.0, z: 4.46, yaw: 0, visible: true },
  ],
];

const ZOMBIE_MOTIONS = [
  // Garota Zumbi
  [
    { t: 0.0, motion: 'zombie_idle' },
    { t: 14.2, motion: 'zombie_walk', cut: true },
    { t: 15.55, motion: 'zombie_attack' },
    { t: 18.2, motion: 'zombie_scream' },
    { t: 20.8, motion: 'zombie_attack' },
    { t: 25.85, motion: 'zombie_scream' },
    { t: 27.3, motion: 'zombie_walk' },
    { t: 33.5, motion: 'zombie_run', speed: 1.05 },
    { t: 46.1, motion: 'zombie_attack' },
  ],
  // Policial Zumbi
  [
    { t: 0.0, motion: 'zombie_idle' },
    { t: 21.5, motion: 'zombie_walk', cut: true },
    { t: 25.4, motion: 'zombie_attack' },
    { t: 26.8, motion: 'zombie_walk' },
    { t: 31.8, motion: 'zombie_run', speed: 1.08 },
    { t: 45.4, motion: 'zombie_biting' },
    { t: 48.0, motion: 'zombie_attack' },
  ],
  // O Corredor (usa zombie_run / running_crawl)
  [
    { t: 0.0, motion: 'zombie_idle' },
    { t: 21.5, motion: 'running_crawl', speed: 1.15, cut: true },
    { t: 25.85, motion: 'zombie_run', speed: 1.24 },
    { t: 37.8, motion: 'running_crawl', speed: 1.22 },
    { t: 41.2, motion: 'zombie_run', speed: 1.28 },
    { t: 42.3, motion: 'zombie_attack', speed: 1.15 },
    { t: 43.1, motion: 'zombie_run', speed: 1.25 },
    { t: 44.3, motion: 'zombie_attack', speed: 1.10 },
  ],
];

function evalPath(points, t) {
  if (t <= points[0].t) {
    const p = points[0];
    return { pos: new T.Vector3(p.x, p.y, p.z), yaw: p.yaw ?? 0, visible: p.visible ?? true, speed: 0 };
  }
  let idx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (t >= points[i].t) idx = i;
  }
  const a = points[idx];
  const b = points[Math.min(idx + 1, points.length - 1)];
  if (a === b || a.cut) {
    const p = a.cut && t >= b.t ? b : a;
    return { pos: new T.Vector3(p.x, p.y, p.z), yaw: p.yaw ?? 0, visible: p.visible ?? true, speed: 0 };
  }
  const span = Math.max(0.0001, b.t - a.t);
  const u = clamp((t - a.t) / span, 0, 1);
  const pos = new T.Vector3(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const speed = dist / span;

  let yaw;
  if (dist > 0.05 && !a.faceYaw) {
    yaw = Math.atan2(dx, dz);
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
  return { pos, yaw, visible: a.visible ?? true, speed };
}

function buildMotionTracks() {
  const baseLuna = [
    { t: 0.0, motion: 'look_around', loop: true },
    { t: 3.2, motion: 'nervously_look_around', loop: true },
    { t: 6.4, motion: 'walking', loop: true },
    { t: 8.6, motion: 'idle', loop: true },
    { t: 11.2, motion: 'nervously_look_around', loop: true },
    { t: 14.8, motion: 'surprised', loop: false },
    { t: 15.6, motion: 'walking_backwards', loop: true },
    { t: 18.6, motion: 'nervously_look_around', loop: true },
    { t: 18.9, motion: 'running', loop: true, speed: 1.12 },
    { t: 21.25, motion: 'opening', loop: false },
    { t: 21.85, motion: 'idle', loop: true },
    { t: 25.15, motion: 'running', loop: true, speed: 1.15 },
    { t: 28.0, motion: 'terrified', loop: false },
    { t: 29.75, motion: 'fast_run', loop: true, speed: 1.16 },
    { t: 44.1, motion: 'nervously_look_around', loop: true },
    { t: 46.2, motion: 'walking', loop: true },
    { t: 49.4, motion: 'nervously_look_around', loop: true },
    { t: 51.6, motion: 'terrified', loop: false },
    { t: 53.6, motion: 'nervously_look_around', loop: true },
  ];

  const baseBia = [
    { t: 0.0, motion: 'weight_shift', loop: true },
    { t: 3.2, motion: 'look_around', loop: true },
    { t: 6.2, motion: 'idle', loop: true },
    { t: 11.0, motion: 'walk', loop: true },
    { t: 12.6, motion: 'idle', loop: true },
    { t: 15.5, motion: 'nervously_look_around', loop: true },
    { t: 19.2, motion: 'walking', loop: true },
    { t: 22.6, motion: 'idle', loop: true },
    { t: 25.3, motion: 'running', loop: true, speed: 1.14 },
    { t: 28.4, motion: 'opening', loop: false },
    { t: 29.75, motion: 'fast_run', loop: true, speed: 1.16 },
    { t: 43.2, motion: 'pushing', loop: true },
    { t: 45.8, motion: 'nervously_look_around', loop: true },
    { t: 46.2, motion: 'walking', loop: true },
    { t: 48.9, motion: 'nervously_look_around', loop: true },
    { t: 51.8, motion: 'terrified', loop: false },
    { t: 53.8, motion: 'nervously_look_around', loop: true },
  ];

  // Injeta gestos de fala variados (sorteio sem repetir) apenas quando a personagem não está correndo
  const usedHistory = [];
  let speechIdx = 0;
  const speechByActor = { LUNA: [], BIA: [] };
  for (const line of falas) {
    const who = String(line.speaker || '').toUpperCase();
    if (who !== 'LUNA' && who !== 'BIA') continue;
    const path = who === 'LUNA' ? LUNA_PATH : BIA_PATH;
    const midSpeed = evalPath(path, (line.start + line.end) * 0.5).speed;
    if (midSpeed > 1.35) continue; // Em corrida, mantém fast_run/running e anima só lip-sync/rosto!

    const motion = pickSpeechMotion(line, usedHistory, speechIdx++);
    usedHistory.push(motion);
    speechByActor[who].push({
      start: line.start,
      end: line.end,
      motion,
      loop: !ONE_SHOT_MOTIONS.has(motion),
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
      events.push({ t: s.start, seg: { t: s.start, motion: s.motion, loop: s.loop, isSpeech: true } });
      const after = sampleBase(s.end + 0.01);
      events.push({ t: s.end, seg: { t: s.end, motion: after.motion, loop: after.loop, speed: after.speed } });
    }
    events.sort((a, b) => a.t - b.t || (a.seg.isSpeech ? 1 : -1));
    for (const ev of events) {
      const insideSpeech =
        !ev.seg.isSpeech && speeches.some((s) => ev.t > s.start + 0.01 && ev.t < s.end - 0.01);
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
  if (actions[motionName]) return actions[motionName];
  if (motionName === 'running_crawl' && actions.zombie_run) return actions.zombie_run;
  if (motionName === 'zombie_biting' && actions.zombie_attack) return actions.zombie_attack;
  return (
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

  const fade = seg.cut ? 0 : 0.22;
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
// Lip-sync, expressões (pesos <= 0,7 e SEM rubor/blush) e olhar
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
  const amp = clamp((0.20 + 0.50 * env) * syll, 0, 0.7);
  if (vowel === 'a') return [amp, amp * 0.14, 0];
  if (vowel === 'e' || vowel === 'i') return [amp * 0.34, clamp(amp * 0.85, 0, 0.7), 0];
  return [amp * 0.28, 0, clamp(amp * 0.85, 0, 0.7)];
}

function setExpr(ex, name, val) {
  if (BLUSH_REGEX.test(name)) return;
  try {
    ex.setValue(name, clamp(val, 0, 0.7));
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

  let happy = 0;
  let surprised = 0;
  let angry = 0;
  let sad = 0;

  if (t < 8.5) {
    surprised = isLuna ? 0.26 : 0.14;
    sad = isLuna ? 0.10 : 0.14;
  } else if (t < 14.7) {
    surprised = isLuna ? 0.42 : 0.12;
    sad = isLuna ? 0.22 : 0.16;
  } else if (t < 20.5) {
    // Garota zumbi no vidro: Luna assustada, Bia controlada/calma
    surprised = isLuna ? 0.65 : 0.28;
    sad = isLuna ? 0.32 : 0.15;
  } else if (t < 25.6) {
    // Cozinha: Luna confiante/irritada, Bia séria e calma
    angry = isLuna ? 0.38 : 0.12;
    surprised = isLuna ? 0.15 : 0.34;
    sad = isLuna ? 0.08 : 0.18;
  } else if (t < 43.0) {
    // Vidro explode + perseguição na escada
    surprised = isLuna ? 0.64 : 0.46;
    sad = isLuna ? 0.42 : 0.26;
    angry = isLuna ? 0.18 : 0.22;
  } else if (t < 49.5) {
    // Porta fecha: breve alívio tenso
    surprised = 0.22;
    sad = 0.32;
  } else {
    // Algo se move no escuro do bunker
    const dread = smooth(49.5, 52.5, t);
    surprised = 0.28 + dread * 0.40;
    sad = 0.30 + dread * 0.32;
  }

  setExpr(ex, 'happy', happy);
  setExpr(ex, 'surprised', surprised);
  setExpr(ex, 'angry', angry);
  setExpr(ex, 'sad', sad);
  setExpr(ex, 'aa', aa);
  setExpr(ex, 'ih', ih);
  setExpr(ex, 'ou', ou);

  const fearSuppress = clamp(surprised, 0, 0.7);
  const blink = Math.max(
    pulse(t % 3.9, isLuna ? 2.8 : 1.5, 0.085),
    pulse(t % 6.3, isLuna ? 5.4 : 4.2, 0.095)
  );
  setExpr(ex, 'blink', blink * (1 - fearSuppress * 0.7) * 0.7);
}

function headPosition(actor) {
  const node = actor.vrm.humanoid.getNormalizedBoneNode('head');
  return node
    ? node.getWorldPosition(new T.Vector3())
    : actor.vrm.scene.position.clone().add(new T.Vector3(0, actor.headY, 0));
}

function updateGaze(t, line, heads) {
  const who = String(line?.speaker || '').toUpperCase();
  const z0Pos = ZOMBIES[0].group.position.clone().add(new T.Vector3(0, 1.44, 0));

  for (let i = 0; i < ACTORS.length; i++) {
    const actor = ACTORS[i];
    const otherHead = heads[1 - i];
    const target = otherHead.clone();

    if (t < 6.4) {
      // Luna olha a tempestade lá fora; Bia olha para o rádio na mesa
      if (actor.name === 'LUNA') target.set(-0.2, 1.35, -8.5);
      else target.set(1.22, 0.92, -2.08);
    } else if (t < 14.5) {
      target.copy(otherHead);
      if (actor.name === 'BIA' && t > 12.2) target.lerp(new T.Vector3(-0.2, 1.4, -5.2), 0.45);
    } else if (t < 19.2) {
      target.copy(z0Pos);
    } else if (t < 25.3) {
      if (actor.name === 'LUNA' && t < 21.8) target.set(10.18, 1.05, 0.08);
      else if (actor.name === 'BIA') target.set(0.0, 1.42, -5.8);
      else target.copy(otherHead);
    } else if (t < 29.75) {
      target.copy(z0Pos);
      if (actor.name === 'BIA') target.lerp(otherHead, 0.65);
    } else if (t < 43.2) {
      const fwd = new T.Vector3(Math.sin(actor.currentYaw), 0, Math.cos(actor.currentYaw));
      target.copy(heads[i]).addScaledVector(fwd, 3.5);
    } else if (t < 46.4) {
      target.set(-4.0, -2.6, 4.8);
    } else if (t < 50.2) {
      target.copy(otherHead);
    } else {
      target.set(shadowFigure.position.x, -2.38, shadowFigure.position.z);
    }

    const sacStep = Math.floor(t * 2.4 + i * 3.7);
    target.x += (hash(sacStep * 13 + i) - 0.5) * 0.20;
    target.y += (hash(sacStep * 19 + i + 5) - 0.5) * 0.12;

    if (who === actor.name) {
      target.lerp(camera.position, 0.14);
    }
    actor.gaze.position.copy(target);
  }
}

// ============================================================================
// Relâmpagos, faca na mão da Luna, vidro, porta de aço, silhueta e iluminação
// ============================================================================
const LIGHTNING_TIMES = [0.40, 2.25, 4.45, 7.60, 14.85, 15.85, 18.40, 24.45, 25.90, 28.60, 32.80];

function lightningIntensityAt(t) {
  let v = 0;
  for (const at of LIGHTNING_TIMES) {
    v = Math.max(v, pulse(t, at, 0.28) + pulse(t, at + 0.17, 0.16) * 0.75);
  }
  return clamp(v, 0, 1.35);
}

const _handPos = new T.Vector3();
const _handQuat = new T.Quaternion();
const _knifeOffset = new T.Vector3(0.03, -0.02, 0.08);
const _knifeRot = new T.Quaternion().setFromEuler(new T.Euler(0.15, 0, Math.PI * 0.5));

function updateSceneProps(t) {
  // Faca: no balcão da cozinha antes de 21.35s, na mão direita da Luna de 21.35..30.2s
  const rightHand = ACTORS[0].vrm?.humanoid?.getNormalizedBoneNode('rightHand');
  if (rightHand && t >= 21.35 && t < 31.2) {
    rightHand.getWorldPosition(_handPos);
    rightHand.getWorldQuaternion(_handQuat);
    knifeGroup.position.copy(_handPos).add(_knifeOffset.clone().applyQuaternion(_handQuat));
    knifeGroup.quaternion.copy(_handQuat).multiply(_knifeRot);
    knifeGroup.visible = true;
  } else if (t < 21.35) {
    knifeGroup.position.copy(KNIFE_COUNTER_POS);
    knifeGroup.rotation.set(0, 0.55, Math.PI / 2);
    knifeGroup.visible = true;
  } else {
    knifeGroup.visible = false;
  }

  // Vidro intacto -> rachadura na batida da garota zumbi -> explode em cacos
  const shattered = t >= shatterStartTime;
  const cracked = t >= crackStartTime && !shattered;
  if (salaGlassPanel) salaGlassPanel.visible = !shattered;
  crackGroup.visible = cracked;
  shatterGroup.visible = shattered;

  if (cracked) {
    const grow = smooth(crackStartTime, crackStartTime + 0.85, t);
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

  // Porta de aço do bunker: aberta -> bate fechando (43.3..45.1) -> trava (45.1..45.9) -> treme nos socos
  const closeU = smooth(43.3, 45.1, t);
  const lockU = smooth(45.1, 45.9, t);
  const pounding =
    t >= 45.3 ? Math.pow(Math.max(0, Math.sin((t - 45.3) * 5.6)), 10) * (t < 51.5 ? 1 : 0.45) : 0;
  steelDoorPivot.rotation.y = lerp(-1.42, 0, closeU) + pounding * 0.024;
  lockBolt.position.y = lerp(1.36, 1.06, lockU);
  lockBolt.position.x = lerp(1.42, 1.54, lockU);

  if (lockU > 0.85) {
    lockLedMat.color.set('#ff3038');
    lockLedMat.emissive.set('#ff1c24');
    lockLedMat.emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 5);
  } else {
    lockLedMat.color.set('#ffb440');
    lockLedMat.emissive.set('#ff9922');
    lockLedMat.emissiveIntensity = 1.2;
  }

  // Presença no fundo escuro do porão: visível e avançando devagar a partir de 48.2 s
  shadowFigure.visible = t >= 48.2;
  if (shadowFigure.visible) {
    const advance = smooth(49.5, Math.max(58.5, duration), t);
    const breath = Math.sin(t * 2.3);
    shadowFigure.position.set(
      0.12 + Math.sin(t * 1.4) * 0.05,
      -4.0,
      lerp(12.65, 11.35, advance)
    );
    shadowFigure.scale.set(1 + breath * 0.02, 1 + breath * 0.028, 1 + breath * 0.025);
  }
}

function updateLighting(t, focusPos, heads) {
  const flash = lightningIntensityAt(t);
  const inPoraoDark = t >= 47.4;
  const flickering = t >= 37.2 && t < 47.4;
  const lightMode = inPoraoDark ? 'apagao' : flickering ? 'piscando' : 'normal';
  const fx = flash > 0.08 ? ['relampago'] : [];
  world.update(t, lightMode, fx);

  for (const light of worldLights) {
    const scale = light.isHemisphereLight ? 0.46 : light.isPointLight ? 0.25 : 0.48;
    light.intensity *= scale;
  }

  keyLight.target.position.copy(focusPos);
  fillLight.target.position.copy(focusPos);
  rimLight.target.position.copy(focusPos);
  keyLight.target.updateMatrixWorld();
  fillLight.target.updateMatrixWorld();
  rimLight.target.updateMatrixWorld();

  if (inPoraoDark) {
    keyLight.position.set(focusPos.x - 1.6, focusPos.y + 2.4, focusPos.z - 2.4);
    fillLight.position.set(focusPos.x + 1.8, focusPos.y + 1.8, focusPos.z - 2.0);
    rimLight.position.set(focusPos.x, focusPos.y + 2.5, focusPos.z + 2.8);
    keyLight.color.set('#b8cbe0');
    keyLight.intensity = 0.36;
    fillLight.intensity = 0.20;
    rimLight.color.set('#7fa6d4');
    rimLight.intensity = 0.45;
    stairLightTop.intensity = 0.35;
    stairLightBot.intensity = t < 49.0 ? 3.2 : 0.45;
    // Sempre >= 2,2 m dos rostos, cor neutra suave
    darkFaceLight.position.set(focusPos.x, focusPos.y + 1.65, focusPos.z - 2.35);
    darkFaceLight.intensity = 2.6;
    renderer.toneMappingExposure = 0.76;
  } else {
    keyLight.position.set(focusPos.x - 2.4, focusPos.y + 3.5, focusPos.z + 2.6);
    fillLight.position.set(focusPos.x + 2.5, focusPos.y + 2.1, focusPos.z + 2.4);
    rimLight.position.set(focusPos.x, focusPos.y + 2.8, focusPos.z - 3.6);
    keyLight.color.set('#fff0dc');
    keyLight.intensity = flickering ? 0.78 : 1.12;
    fillLight.intensity = flickering ? 0.40 : 0.54;
    rimLight.color.set('#96c2f2');
    rimLight.intensity = 0.68 + flash * 1.25;
    stairLightTop.intensity = 5.2;
    stairLightBot.intensity = flickering ? (Math.sin(t * 23) > -0.1 ? 6.0 : 1.8) : 5.6;
    darkFaceLight.intensity = 0;
    renderer.toneMappingExposure = 0.84 + flash * 0.15;
  }

  lightningLight.intensity = flash * 34;

  // Garante que NENHUMA luz colorida fique a menos de 1,5 m dos rostos
  enforceSafeLightDistance(heads);
}

// ============================================================================
// Direção de câmera vertical 9:16 (fov ~50, planos fechados, sempre nivelada)
// ============================================================================
function closeUpPose(actor, dist = 1.38, sideAngle = 0.20) {
  const head = headPosition(actor);
  const yaw = actor.currentYaw + sideAngle;
  const pos = new T.Vector3(
    head.x + Math.sin(yaw) * dist,
    head.y + 0.02,
    head.z + Math.cos(yaw) * dist
  );
  // Evita atravessar o vidro frontal da sala (z = -4.98)
  if (head.y > -1.0 && head.x > -5.2 && head.x < 5.2 && pos.z < -4.52) {
    pos.z = -4.52;
  }
  const target = new T.Vector3(head.x, head.y - 0.01, head.z);
  return { pos, target, fov: 46 };
}

function directCamera(t, heads) {
  const lunaPos = ACTORS[0].vrm.scene.position;
  const biaPos = ACTORS[1].vrm.scene.position;
  const lunaHead = heads[0];
  const biaHead = heads[1];
  const z0Pos = ZOMBIES[0].group.position;
  const z2Pos = ZOMBIES[2].group.position;

  let pos = new T.Vector3(0, 1.48, -1.6);
  let target = new T.Vector3(0, 1.42, -3.8);
  let fov = 50;

  // --- PARTE 1: SALA & ALERTA NO RÁDIO (0..14.74) ---
  if (t < 3.21) {
    // Abertura: Luna perto do vidro olhando a chuva forte (terço superior livre pro TEXTO)
    const u = smooth(0, 3.21, t);
    pos.set(lerp(-0.08, -0.30, u), 1.46, lerp(-1.85, -2.35, u));
    target.set(-0.30, 1.44, -4.35);
    fov = 50;
  } else if (t < 6.40) {
    // Rádio de emergência: plano médio fechado em Bia ajustando o rádio na mesa
    const u = smooth(3.21, 6.40, t);
    pos.set(lerp(-0.48, -0.32, u), 1.38, lerp(-0.92, -1.12, u));
    target.set(lerp(0.95, 0.85, u), 1.30, -2.20);
    fov = 48;
  } else if (t < 8.73) {
    // Plano médio fechado: Luna vira e se afasta um pouco do vidro em direção a Bia
    const u = smooth(6.40, 8.73, t);
    pos.set(lerp(0.18, 0.08, u), 1.46, lerp(-0.35, -0.75, u));
    target.copy(lunaHead).lerp(biaHead, 0.45);
    fov = 52;
  } else if (t < 11.01) {
    // Close vertical em Luna ("Que loucura é essa, Bia?")
    ({ pos, target, fov } = closeUpPose(ACTORS[0], 1.36, -0.22));
  } else if (t < 14.55) {
    // Close vertical em Bia ("Fica calma, Luna. Afasta da janela.")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.36, 0.22));

    // --- PARTE 1B: VARANDA — GAROTA ZUMBI NO VIDRO (14.55..20.10) ---
  } else if (t < 17.55) {
    // Garota zumbi surge na chuva e bate no vidro (enquadramento vertical fechado!)
    const u = smooth(14.55, 17.55, t);
    pos.set(lerp(-0.08, -0.20, u), 1.45, lerp(-2.75, -3.35, u));
    target.set(z0Pos.x, 1.42, z0Pos.z);
    fov = 48;
  } else if (t < 20.10) {
    // Reação: Luna recua impulsiva enquanto Bia observa calma pelo vidro
    const u = smooth(17.55, 20.10, t);
    pos.set(lerp(-0.18, 0.15, u), 1.44, -4.45);
    target.copy(lunaHead).lerp(biaHead, 0.48);
    fov = 52;

    // --- PARTE 2A: COZINHA — FACA NO BALCÃO E OS OUTROS DOIS ZUMBIS (20.10..25.62) ---
  } else if (t < 22.96) {
    // Luna corre até o balcão, pega a faca e fala ("Ela tá sozinha, eu resolvo.")
    const u = smooth(20.10, 22.96, t);
    pos.set(lerp(6.85, 7.85, u), 1.44, lerp(-1.35, -0.92, u));
    target.set(lunaHead.x, lunaHead.y - 0.04, lunaHead.z);
    fov = 50;
  } else if (t < 24.20) {
    // Close vertical em Bia perto do arco da cozinha ("Não tá, não. Olha atrás dela.")
    ({ pos, target, fov } = closeUpPose(ACTORS[1], 1.40, 0.18));
  } else if (t < 25.62) {
    // Varanda: policial zumbi e corredor surgem atrás da garota zumbi na chuva!
    const u = smooth(24.20, 25.62, t);
    pos.set(0.0, 1.46, lerp(-1.85, -2.35, u));
    target.set(0.0, 1.40, -6.10);
    fov = 52;

    // --- PARTE 2B: SALA — VIDRO EXPLODE E CORRIDA PARA O PORÃO (25.62..37.20) ---
  } else if (t < 28.45) {
    // Explosão do vidro! Os três zumbis invadem a sala
    const u = smooth(25.62, 28.45, t);
    pos.set(lerp(0.15, 0.45, u), 1.46, lerp(-1.55, -0.55, u));
    target.set(0.0, 1.42, lerp(-5.0, -3.5, u));
    fov = 52;
  } else if (t < 30.89) {
    // Luna trava por 1 s e Bia a puxa pelo braço rumo à saída
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(1.25, 1.46, 0.95);
    target.copy(midHead);
    fov = 50;
  } else if (t < 34.97) {
    // Tracking frontal nivelado na sala: as duas correndo com os zumbis no encalço!
    const midPos = lunaPos.clone().lerp(biaPos, 0.5);
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(clamp(midPos.x - 2.35, -5.0, 3.2), 1.44, clamp(midPos.z + 0.65, -3.8, 2.5));
    target.set(midHead.x, midHead.y - 0.04, midHead.z);
    fov = 52;
  } else if (t < 37.20) {
    // Luna grita "Bora, corre pro porão!" entrando no corredor da escada
    const camX = lunaPos.x < -5.3 ? -7.35 : clamp(lunaPos.x - 1.95, -5.1, 0);
    const camZ = lunaPos.x < -5.3 ? clamp(lunaPos.z + 2.15, 1.6, 5.2) : clamp(lunaPos.z + 0.75, -3.5, 2.0);
    pos.set(camX, 1.44, camZ);
    target.set(lunaHead.x, lunaHead.y - 0.02, lunaHead.z);
    fov = 48;

    // --- PARTE 3A: ESCADA NO ESCURO — CORREDOR QUASE AGARRA (37.20..43.01) ---
  } else if (t < 40.20) {
    // Lance 1 da escada: câmera à frente na altura do peito/rosto
    const leadPos = lunaPos.clone().lerp(biaPos, 0.35);
    const leadHead = lunaHead.clone().lerp(biaHead, 0.35);
    pos.set(
      clamp(leadPos.x + 0.20, -8.05, -6.95),
      leadPos.y + 1.24,
      clamp(leadPos.z + 2.15, 2.6, 8.35)
    );
    target.set(leadHead.x, leadHead.y - 0.02, leadHead.z);
    fov = 52;
  } else if (t < 43.01) {
    // Lance 2 da escada: corredor quase agarra o ombro de Luna!
    const focusHead = lunaHead.clone().lerp(new T.Vector3(z2Pos.x, z2Pos.y + 1.4, z2Pos.z), 0.32);
    const camZ = clamp(lunaPos.z - 2.15, 2.80, 5.55);
    const rawY = lunaPos.y + 1.24;
    pos.set(
      clamp(lunaPos.x + 0.22, -6.75, -5.95),
      camZ < 5.15 ? Math.min(rawY, -1.10) : rawY,
      camZ
    );
    target.copy(focusHead);
    fov = 52;

    // --- PARTE 3B: PORÃO / BUNKER — PORTA DE AÇO E PRESENÇA NO ESCURO (43.01..fim) ---
  } else if (t < 46.20) {
    // Dentro do bunker: Bia empurra Luna para dentro e trava a porta de aço
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(-3.75, -2.62, 7.65);
    target.set(midHead.x, midHead.y - 0.02, lerp(midHead.z, 5.2, 0.32));
    fov = 50;
  } else if (t < 47.69) {
    // Lado de fora da porta de aço: os 3 zumbis batem com força
    pos.set(-5.30, -2.62, 2.85);
    target.set(-4.05, -2.58, 4.42);
    fov = 52;
  } else if (t < 51.64) {
    // Dentro do porão escuro: Bia ("Conseguimos... espera. Quem tá aí no escuro?")
    const u = smooth(47.69, 51.64, t);
    const midHead = biaHead.clone().lerp(lunaHead, 0.38);
    pos.set(
      lerp(biaPos.x - 0.15, 0.02, u),
      -2.58,
      lerp(biaPos.z - 1.65, 7.75, u)
    );
    target.set(midHead.x, midHead.y - 0.02, midHead.z);
    fov = 48;
  } else if (t < 55.20) {
    // Plano médio vertical das duas viradas com a sombra se movendo atrás no escuro
    const u = smooth(51.64, 55.20, t);
    const midHead = lunaHead.clone().lerp(biaHead, 0.5);
    pos.set(0.0, -2.58, lerp(7.75, 8.10, u));
    target.copy(midHead).lerp(new T.Vector3(shadowFigure.position.x, -2.42, shadowFigure.position.z), 0.38);
    fov = 50;
  } else {
    // Push-in final sobre a presença que avança na escuridão do bunker
    const u = smooth(55.20, Math.max(58.5, duration), t);
    pos.set(0.0, -2.56, lerp(8.10, 8.85, u));
    target.set(shadowFigure.position.x, -2.44, shadowFigure.position.z);
    fov = 48;
  }

  // Vibração cinematográfica contida na fuga e nos impactos (sem entortar o horizonte)
  const chaseAmp = t >= 25.8 && t < 44.5 ? 0.024 : 0.006;
  const hitShake =
    (pulse(t, crackStartTime, 0.25) + pulse(t, shatterStartTime, 0.35) + pulse(t, 45.1, 0.22)) * 0.055;
  pos.x += Math.sin(t * 2.1) * chaseAmp + Math.sin(t * 47) * hitShake;
  pos.y += Math.cos(t * 1.7) * chaseAmp * 0.55 + Math.cos(t * 53) * hitShake * 0.65;

  // Câmera sempre nivelada: limita inclinação vertical extrema e zera qualquer roll
  const toTarget = target.clone().sub(pos);
  const horizDist = Math.hypot(toTarget.x, toTarget.z);
  const maxVerticalDelta = Math.max(0.35, horizDist * Math.tan(T.MathUtils.degToRad(20)));
  if (Math.abs(toTarget.y) > maxVerticalDelta) {
    pos.y = target.y - Math.sign(toTarget.y) * maxVerticalDelta;
  }

  camera.position.copy(pos);
  camera.fov = fov;
  camera.aspect = 9 / 16;
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(target);

  return target;
}

// ============================================================================
// Overlay 2D (1080x1920): [TEXTO: ...] estilo Shorts + legendas menores embaixo
// ============================================================================
function wrapTokens(ctx, tokens, maxWidth) {
  const lines = [];
  let cur = [];
  let curW = 0;
  const spaceW = ctx.measureText(' ').width;
  for (const tok of tokens) {
    const w = ctx.measureText(tok.word).width;
    if (cur.length && curW + spaceW + w > maxWidth) {
      lines.push(cur);
      cur = [tok];
      curW = w;
    } else {
      if (cur.length) curW += spaceW;
      cur.push(tok);
      curW += w;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function drawShortsTextOverlay(t) {
  const cue = textCues.find((c) => t >= c.start && t < c.start + c.dur);
  if (!cue) return;

  const elapsed = t - cue.start;
  const popU = clamp(elapsed / 0.15, 0, 1);
  const scale = lerp(1.3, 1.0, 1 - Math.pow(1 - popU, 3));

  const fadeIn = clamp(elapsed / 0.04, 0, 1);
  const fadeOut = clamp((cue.dur - elapsed) / 0.30, 0, 1);
  const alpha = fadeIn * fadeOut;
  if (alpha <= 0.01) return;

  const shakeDecay = Math.max(0, 1 - elapsed / 0.28);
  const shakeX = Math.sin(elapsed * 95) * 9 * shakeDecay;
  const shakeY = Math.cos(elapsed * 115) * 6 * shakeDecay;
  const shakeRot = Math.sin(elapsed * 80) * 0.022 * shakeDecay;

  const ctx = overlayCtx;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Terço superior centralizado, sem cobrir rostos
  ctx.translate(W * 0.5 + shakeX, 310 + shakeY);
  ctx.rotate(shakeRot);
  ctx.scale(scale, scale);

  const fontSize = cue.text.length > 20 ? 84 : 96;
  ctx.font = `900 ${fontSize}px "Arial Black", "Impact", "Helvetica Neue", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  let highlightedOnce = false;
  const rawWords = cue.text.split(/\s+/).filter(Boolean);
  const tokens = rawWords.map((word) => {
    const clean = word.replace(/[^A-ZÀ-Ú0-9]/gi, '').toUpperCase();
    const isKey = !highlightedOnce && cue.keyword && clean === cue.keyword.toUpperCase();
    if (isKey) highlightedOnce = true;
    return { word, color: isKey ? cue.color : '#ffffff' };
  });

  const lines = wrapTokens(ctx, tokens, W - 130);
  const lineH = fontSize * 1.14;
  const spaceW = ctx.measureText(' ').width;
  const startY = -((lines.length - 1) * lineH) * 0.5;

  for (let li = 0; li < lines.length; li++) {
    const row = lines[li];
    let rowW = 0;
    const widths = row.map((tok) => ctx.measureText(tok.word).width);
    for (let wi = 0; wi < widths.length; wi++) {
      rowW += widths[wi] + (wi > 0 ? spaceW : 0);
    }
    let x = -rowW * 0.5;
    const y = startY + li * lineH;

    for (let wi = 0; wi < row.length; wi++) {
      const tok = row[wi];
      // Sombra + contorno preto grosso
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(tok.word, x, y);
      ctx.restore();

      ctx.fillStyle = tok.color;
      ctx.fillText(tok.word, x, y);

      x += widths[wi] + spaceW;
    }
  }
  ctx.restore();
}

function drawBottomCaption(line) {
  if (!line || !line.text) return;
  const ctx = overlayCtx;
  const speaker = String(line.speaker || '').toUpperCase();
  const showPrefix = speaker && speaker !== 'NARRADOR';
  const prefix = showPrefix ? `${speaker === 'RADIO' ? 'RÁDIO' : speaker}: ` : '';
  const body = String(line.text || '').trim();

  ctx.save();
  const fontSize = 40;
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Helvetica Neue", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const wordsList = [];
  if (prefix) wordsList.push({ word: prefix.trim(), color: '#f9cf8c' });
  for (const w of body.split(/\s+/).filter(Boolean)) {
    wordsList.push({ word: w, color: '#ffffff' });
  }

  const lines = wrapTokens(ctx, wordsList, W - 150);
  const lineH = fontSize * 1.32;
  const spaceW = ctx.measureText(' ').width;
  const baseY = H - 220 - (lines.length - 1) * lineH * 0.5;

  // Fundo sutil arredondado para legibilidade total no celular
  let maxRowW = 0;
  const rowMetrics = lines.map((row) => {
    const widths = row.map((tok) => ctx.measureText(tok.word).width);
    const totalW = widths.reduce((acc, w, i) => acc + w + (i > 0 ? spaceW : 0), 0);
    if (totalW > maxRowW) maxRowW = totalW;
    return { row, widths, totalW };
  });

  const padX = 30;
  const padY = 18;
  const boxW = maxRowW + padX * 2;
  const boxH = lines.length * lineH + padY * 2;
  const boxX = (W - boxW) * 0.5;
  const boxY = baseY - (lines.length * lineH) * 0.5 - padY;

  ctx.fillStyle = 'rgba(6, 10, 18, 0.58)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 18);
  ctx.fill();

  const startY = baseY - ((lines.length - 1) * lineH) * 0.5;
  for (let li = 0; li < rowMetrics.length; li++) {
    const { row, widths, totalW } = rowMetrics[li];
    let x = (W - totalW) * 0.5;
    const y = startY + li * lineH;
    for (let wi = 0; wi < row.length; wi++) {
      const tok = row[wi];
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.94)';
      ctx.strokeText(tok.word, x, y);
      ctx.fillStyle = tok.color;
      ctx.fillText(tok.word, x, y);
      x += widths[wi] + spaceW;
    }
  }
  ctx.restore();
}

function updateOverlay(t, line) {
  overlayCtx.clearRect(0, 0, W, H);
  drawShortsTextOverlay(t);
  drawBottomCaption(line);

  // Atualiza também o DOM #legenda (oculto visualmente para evitar duplicação)
  caption.replaceChildren();
  if (line) {
    const name = document.createElement('strong');
    name.textContent = `${String(line.speaker || '').toUpperCase()}:`;
    caption.append(name, document.createTextNode(String(line.text || '')));
  }
}

// ============================================================================
// Render determinístico de qualquer instante t
// ============================================================================
function draw(t, forced = false) {
  if (!window.ready) return;
  const time = clamp(Number(t) || 0, 0, duration || Math.max(0, Number(t) || 0));
  const line = lineAt(time);

  // 1) Personagens VRM (Luna e Bia)
  const paths = [LUNA_PATH, BIA_PATH];
  for (let i = 0; i < ACTORS.length; i++) {
    const actor = ACTORS[i];
    const p = evalPath(paths[i], time);
    applyDeterministicTrack(actor.mixer, actor.actions, actor.motionTrack, time);
    actor.vrm.scene.position.set(p.pos.x, p.pos.y, p.pos.z);
    actor.vrm.scene.rotation.y = actor.baseYaw + p.yaw;
    actor.currentYaw = p.yaw;
    actor.vrm.scene.updateMatrixWorld(true);
  }

  // 2) Zumbis reais do Mixamo (zombiegirl, copzombie, yaku)
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

  // 3) Props dinâmicos (faca, vidro, cacos, porta de aço, silhueta no escuro)
  updateSceneProps(time);

  // 4) Cabeças, câmera vertical 9:16, olhar e expressões (sem rubor, <= 0,7)
  const heads = ACTORS.map(headPosition);
  const focusPos = directCamera(time, heads);
  updateGaze(time, line, heads);
  for (const actor of ACTORS) {
    applyExpressions(actor, line, time);
    actor.vrm.update(forced ? 1 / 30 : 1 / 60);
    // Garantia extra: zera qualquer morph de rubor após vrm.update
    for (const fm of actor.forbiddenMorphs) {
      fm.mesh.morphTargetInfluences[fm.index] = 0;
    }
  }

  // 5) Iluminação (com guarda >= 1,5 m de luzes coloridas) + Overlay Shorts
  updateLighting(time, focusPos, heads);
  updateOverlay(time, line);

  renderer.render(scene, camera);
}

window.renderFrame = (t) => draw(t, true);
window.capturaFrame = () => {
  if (!window.ready) throw new Error('Cena ainda não carregada');
  captureCtx.drawImage(canvas, 0, 0, W, H);
  captureCtx.drawImage(overlayCanvas, 0, 0, W, H);
  return captureCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];
};

function waitAudioMetadata(timeoutMs = 2500) {
  if (Number.isFinite(audio.duration) && audio.duration > 1) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    audio.addEventListener('loadedmetadata', done, { once: true });
    try {
      audio.load();
    } catch {
      // ignora
    }
  });
}

async function boot() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const [timedLines, timedWords, roteiroRaw] = await Promise.all([
      optionalJson('./falas.json'),
      optionalJson('./words.json'),
      optionalText('./roteiro.txt'),
      waitAudioMetadata(2500),
    ]);
    falas = timedLines;
    words = timedWords;
    setupTiming();
    buildTextCues(roteiroRaw);
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
