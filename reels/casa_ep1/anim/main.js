import * as T from './lib/three.module.js';
import { makeWorld } from './world.js';
import { makeCharacters } from './chars.js';
import { planos, planoEm, DURACAO } from './direcao.js';
import { makeOverlay } from './overlay.js';

const qs = new URLSearchParams(location.search);
const isQA = qs.has('qa');

if (isQA || qs.has('t')) {
  document.body.classList.add('frame');
}
if (isQA) {
  document.body.classList.add('qa');
}

const canvas = document.querySelector('#c');
const overlayCanvas = document.querySelector('#overlay');
const _qsR = new URLSearchParams(location.search); const ESCALA = +(_qsR.get('escala') || 1); const RAPIDO = _qsR.has('rapido');
const renderer = new T.WebGLRenderer({ canvas, antialias: !RAPIDO, preserveDrawingBuffer: true });
renderer.setSize(Math.round(1920 * ESCALA), Math.round(1080 * ESCALA), false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = !_qsR.has("semsombra");
renderer.shadowMap.type = RAPIDO ? T.PCFShadowMap : T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.outputColorSpace = T.SRGBColorSpace;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(63, 16 / 9, 0.05, 160);
scene.add(camera);

const world = makeWorld(scene);
const chars = makeCharacters(scene);
const overlay = makeOverlay(overlayCanvas);
let words = [];

// ============================================================================
// Mãos POV do LEO (manga verde-musgo puxada + pulseira preta + relógio digital)
// Estilo articulado do ECO · A Escola
// ============================================================================
function createLeoHands() {
  const group = new T.Group();
  const matSleeve = new T.MeshStandardMaterial({ color: '#4d6640', roughness: 0.78 });
  const matCuff = new T.MeshStandardMaterial({ color: '#3b5031', roughness: 0.82 });
  const matSkin = new T.MeshStandardMaterial({ color: '#c9936d', roughness: 0.58 });
  const matMetal = new T.MeshStandardMaterial({ color: '#cfd8e0', roughness: 0.28, metalness: 0.8 });

  function buildForearm(side) {
    const arm = new T.Group();
    // Manga verde-musgo puxada até o antebraço
    const sleeve = new T.Mesh(new T.CapsuleGeometry(0.045, 0.22, 6, 12), matSleeve);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, 0, 0.17);
    arm.add(sleeve);

    const cuff = new T.Mesh(new T.CylinderGeometry(0.042, 0.045, 0.036, 12), matCuff);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0, 0.055);
    arm.add(cuff);

    // Antebraço exposto (pele)
    const wrist = new T.Mesh(new T.CapsuleGeometry(0.035, 0.085, 6, 10), matSkin);
    wrist.rotation.x = Math.PI / 2;
    wrist.position.set(0, -0.002, -0.01);
    arm.add(wrist);

    // Traço único do LEO no pulso esquerdo (side === -1): pulseira de corda preta + relógio digital!
    if (side === -1) {
      const cord = new T.Mesh(new T.TorusGeometry(0.038, 0.0055, 6, 16), new T.MeshStandardMaterial({ color: '#17191d', roughness: 0.85 }));
      cord.position.set(0, -0.002, 0.015);
      arm.add(cord);
      const clasp = new T.Mesh(new T.BoxGeometry(0.016, 0.012, 0.014), matMetal);
      clasp.position.set(0, 0.037, 0.015);
      arm.add(clasp);

      const watchBand = new T.Mesh(new T.CylinderGeometry(0.039, 0.039, 0.026, 14), new T.MeshStandardMaterial({ color: '#21262e', roughness: 0.5 }));
      watchBand.rotation.x = Math.PI / 2;
      watchBand.position.set(0, -0.002, -0.022);
      arm.add(watchBand);
      const watchFace = new T.Mesh(new T.BoxGeometry(0.036, 0.010, 0.032), new T.MeshStandardMaterial({ color: '#141920', roughness: 0.25 }));
      watchFace.position.set(0, 0.036, -0.022);
      arm.add(watchFace);
      const watchDigits = new T.Mesh(new T.PlaneGeometry(0.026, 0.018), new T.MeshBasicMaterial({ color: '#58e8a8' }));
      watchDigits.rotation.x = -Math.PI / 2;
      watchDigits.position.set(0, 0.042, -0.022);
      arm.add(watchDigits);
    }

    const palm = new T.Mesh(new T.BoxGeometry(0.072, 0.028, 0.088), matSkin);
    palm.position.set(0, -0.004, -0.088);
    arm.add(palm);

    for (let i = 0; i < 4; i++) {
      const f = new T.Mesh(new T.CapsuleGeometry(0.008, 0.044, 4, 6), matSkin);
      f.rotation.x = Math.PI / 2 + 0.24;
      f.position.set(-0.024 + i * 0.016, -0.010, -0.146);
      arm.add(f);
    }
    const thumb = new T.Mesh(new T.CapsuleGeometry(0.009, 0.036, 4, 6), matSkin);
    thumb.position.set(-side * 0.042, -0.006, -0.102);
    thumb.rotation.set(Math.PI / 2, 0, side * 0.52);
    arm.add(thumb);

    return arm;
  }

  const left = buildForearm(-1);
  left.position.set(-0.24, -0.27, -0.34);
  left.rotation.set(0.10, -0.28, -0.14);

  const right = buildForearm(1);
  right.position.set(0.22, -0.25, -0.34);
  right.rotation.set(0.16, 0.26, 0.16);

  // Celular na mão direita (tela emissiva que ilumina no apagão!)
  const phone = new T.Group();
  phone.position.set(0.17, -0.18, -0.46);
  phone.rotation.set(-0.18, -0.22, 0.06);
  const phoneBody = new T.Mesh(
    new T.BoxGeometry(0.095, 0.185, 0.012),
    new T.MeshStandardMaterial({ color: '#1b222c', metalness: 0.55, roughness: 0.25 })
  );
  phone.add(phoneBody);
  const screen = new T.Mesh(
    new T.PlaneGeometry(0.084, 0.168),
    new T.MeshBasicMaterial({ color: '#9cd8f5' })
  );
  screen.position.z = 0.007;
  phone.add(screen);

  // Lanterna metálica
  const flashlight = new T.Group();
  flashlight.position.set(0.20, -0.22, -0.45);
  const flBody = new T.Mesh(
    new T.CylinderGeometry(0.024, 0.022, 0.20, 14),
    new T.MeshStandardMaterial({ color: '#58646e', metalness: 0.72, roughness: 0.3 })
  );
  flBody.rotation.x = Math.PI / 2;
  flashlight.add(flBody);
  const flLens = new T.Mesh(new T.CircleGeometry(0.023, 14), new T.MeshBasicMaterial({ color: '#fff8de' }));
  flLens.rotation.y = Math.PI;
  flLens.position.z = -0.102;
  flashlight.add(flLens);

  // Caneta de adrenalina de treino (azul)
  const pen = new T.Group();
  pen.position.set(0.18, -0.19, -0.45);
  pen.rotation.set(0.25, 0.1, 0.45);
  const penBody = new T.Mesh(
    new T.CylinderGeometry(0.012, 0.012, 0.17, 10),
    new T.MeshStandardMaterial({ color: '#2b6fc7', roughness: 0.32 })
  );
  pen.add(penBody);
  const penCap = new T.Mesh(
    new T.CylinderGeometry(0.013, 0.013, 0.04, 10),
    new T.MeshStandardMaterial({ color: '#e6ecf2', roughness: 0.4 })
  );
  penCap.position.y = 0.075;
  pen.add(penCap);

  // Guardanapo / lenço dobrado
  const napkin = new T.Mesh(
    new T.BoxGeometry(0.15, 0.13, 0.012),
    new T.MeshStandardMaterial({ color: '#efe8da', roughness: 0.88 })
  );
  napkin.position.set(0.16, -0.20, -0.45);
  napkin.rotation.set(-0.2, -0.25, 0.1);

  group.add(left, right, phone, flashlight, pen, napkin);
  return { group, left, right, phone, flashlight, pen, napkin };
}

const leoHands = createLeoHands();
camera.add(leoHands.group);

// ============================================================================
// Iluminação inteligente acoplada à câmera (garante rostos visíveis no apagão!)
// ============================================================================
const torch = new T.SpotLight('#e8f5ff', 0, 22, Math.PI / 3.8, 0.68, 1.25);
torch.position.set(0.16, -0.12, -0.25);
torch.target.position.set(0, -0.05, -6);
camera.add(torch, torch.target);

const faceFill = new T.PointLight('#cfe4ff', 2.4, 10, 1.45);
faceFill.position.set(0.18, 0.22, -0.35);
camera.add(faceFill);

// Luzes exclusivas para retratos QA (desligadas nos planos normais)
const qaKey = new T.DirectionalLight('#fff2de', 0);
qaKey.position.set(1.6, 2.6, 2.4);
scene.add(qaKey);
const qaRim = new T.DirectionalLight('#9ed2ff', 0);
qaRim.position.set(-1.8, 2.4, -1.6);
scene.add(qaRim);

// ============================================================================
// Carregamento de legendas e dados de áudio
// ============================================================================
async function loadJSON(path) {
  try {
    const r = await fetch(path);
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

Promise.all([loadJSON('../words.json'), loadJSON('../falas.json'), loadJSON('../partes.json')]).then(([w, f, p]) => {
  words = Array.isArray(w) ? w : Array.isArray(w.words) ? w.words : [];
  if (!words.length && Array.isArray(f)) words = f.flatMap((x) => x.words ?? []);
  overlay.setData(words, Array.isArray(p) ? p : p.partes ?? []);
  renderFrame(Number(qs.get('t') || 0));
  window.ready = true;
});

const audio = new Audio(qs.get('audio') || '../audio_final.m4a');
audio.preload = 'auto';
let playing = false;
let start = 0;
let base = 0;

window.DURACAO = DURACAO;
window.planos = planos;
document.querySelector('#scrub').max = DURACAO;

function smooth(u) {
  u = Math.max(0, Math.min(1, u));
  return u * u * (3 - 2 * u);
}

function renderFrame(t) {
  t = Math.max(0, Math.min(DURACAO, t));
  qaKey.intensity = 0;
  qaRim.intensity = 0;

  if (camera.fov !== 63) {
    camera.fov = 63;
    camera.updateProjectionMatrix();
  }

  const p = planoEm(t);
  const u = (t - p.t0) / Math.max(0.001, p.t1 - p.t0);
  const v = smooth(u);

  const pos = new T.Vector3(...p.cam.pos);
  const look = new T.Vector3(...p.cam.olhar);
  if (p.cam.movimento === 'andar') {
    pos.z += v * 0.55;
    pos.y += Math.sin(t * 11) * 0.025;
  } else if (p.cam.movimento === 'respirar') {
    pos.y += Math.sin(t * 1.3) * 0.018;
  }

  camera.position.copy(pos);
  camera.lookAt(look);
  if (p.cam.movimento === 'andar') camera.rotation.z += Math.sin(t * 5) * 0.006;

  // Mãos POV e objetos segurados
  const seg = p.maos?.segura || 'nada';
  const showHands = !p.especial && seg !== 'nada';
  leoHands.group.visible = showHands;
  leoHands.phone.visible = seg === 'celular';
  leoHands.flashlight.visible = seg === 'lanterna';
  leoHands.pen.visible = seg === 'caneta';
  leoHands.napkin.visible = seg === 'guardanapo';
  const handBreath = Math.sin(t * 2.2) * 0.005;
  leoHands.group.position.y = handBreath;

  // Iluminação de rosto/lanterna no apagão (nunca deixa quem fala no escuro!)
  const isBlackout = p.luz === 'apagao';
  if (seg === 'lanterna') {
    torch.color.set('#eef7ff');
    torch.intensity = 22;
    faceFill.intensity = 4.6;
  } else if (isBlackout && p.especial === 'seguranca') {
    torch.color.set('#a8e0ee');
    torch.intensity = 12;
    faceFill.intensity = 3.8;
  } else if (isBlackout) {
    torch.color.set('#bde3ff');
    torch.intensity = 14;
    faceFill.intensity = 4.4;
  } else {
    torch.intensity = 0;
    faceFill.intensity = 2.4;
  }

  world.update(t, p.luz, p.fx);
  chars.update(t, p.atores, words, camera);
  renderer.render(scene, camera);

  if (isQA) {
    overlayCanvas.getContext('2d').clearRect(0, 0, 1920, 1080);
  } else {
    overlay.draw(t, p);
  }

  document.querySelector('#scrub').value = t;
  document.querySelector('#time').textContent = `${t.toFixed(2)} / ${DURACAO.toFixed(2)}`;
  return p;
}

window.renderFrame = renderFrame;
window.getActors = () => chars.actors;

if (qs.has('t')) {
  renderFrame(Number(qs.get('t')));
} else {
  renderFrame(0);
}

function tick(now) {
  if (!playing) return;
  const t = audio.readyState >= 2 && !audio.paused ? audio.currentTime : base + (now - start) / 1000;
  renderFrame(t);
  if (t >= DURACAO) {
    playing = false;
    audio.pause();
    document.querySelector('#play').textContent = '▶ PLAY';
    return;
  }
  requestAnimationFrame(tick);
}

document.querySelector('#play').onclick = async () => {
  if (playing) {
    playing = false;
    audio.pause();
    document.querySelector('#play').textContent = '▶ PLAY';
  } else {
    playing = true;
    base = Number(document.querySelector('#scrub').value);
    start = performance.now();
    audio.currentTime = base;
    try {
      await audio.play();
    } catch {}
    document.querySelector('#play').textContent = 'Ⅱ PAUSE';
    requestAnimationFrame(tick);
  }
};

document.querySelector('#scrub').oninput = (e) => {
  base = Number(e.target.value);
  start = performance.now();
  if (audio.readyState >= 2) audio.currentTime = base;
  renderFrame(base);
};

// ============================================================================
// Retrato QA de personagem (enquadramento perfeito na altura da cabeça/ombros)
// ============================================================================
window.qaPortrait = (name) => {
  document.body.classList.add('frame', 'qa');
  const a = chars.actors[name];
  const hy = a ? a.headY : 1.56;

  camera.fov = 48;
  camera.updateProjectionMatrix();
  camera.position.set(0, hy + 0.015, 0.94);
  camera.lookAt(0, hy - 0.02, 0);

  leoHands.group.visible = false;
  torch.intensity = 0;
  faceFill.intensity = 1.6;
  qaKey.intensity = 1.55;
  qaRim.intensity = 0.85;

  world.update(1.0, 'normal', []);
  chars.update(1.0, [{ nome: name, pos: [0, 0, 0], pose: 'em_pe', olhaPara: 'camera' }], [], camera);
  renderer.render(scene, camera);
  overlayCanvas.getContext('2d').clearRect(0, 0, 1920, 1080);
};

// captura composta (3D + legenda) para o render na nuvem
const _comp = document.createElement('canvas'); _comp.width = 1920; _comp.height = 1080;
window.capturaFrame = () => { const g = _comp.getContext('2d'); g.drawImage(canvas, 0, 0, 1920, 1080); g.drawImage(overlayCanvas, 0, 0, 1920, 1080); return _comp.toDataURL('image/jpeg', 0.92).split(',')[1]; };
