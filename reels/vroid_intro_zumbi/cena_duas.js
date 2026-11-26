import * as T from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { loadMixamoAnimation } from './lib/loadMixamoAnimation.js';
import { makeWorld } from './world.js';

const canvas = document.querySelector('#c');
const playButton = document.querySelector('#play');
const caption = document.querySelector('#legenda');
const errorBox = document.querySelector('#erro');
const audio = document.querySelector('#audio');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(35, 16 / 9, 0.05, 160);
camera.up.set(0, 1, 0);
const world = makeWorld(scene);
// A mesa fica exatamente na linha entre a câmera e a área livre da conversa.
const worldRoot = scene.children.find((item) => item.isGroup);
const table = worldRoot?.children.find((item) =>
  item.isGroup && item.position.distanceToSquared(new T.Vector3(-0.25, 0, 2.28)) < 0.0001
);
if (table) table.visible = false;
const worldLights = [];
scene.traverse((item) => {
  if (item.isLight) worldLights.push(item);
});
const key = new T.DirectionalLight('#ffdfba', 1.15);
key.position.set(-2.4, 3.5, 2.6);
scene.add(key);
const fill = new T.DirectionalLight('#e4eeff', 0.52);
fill.position.set(2.5, 2.0, 2.7);
scene.add(fill);
const rim = new T.DirectionalLight('#89b8ed', 0.66);
rim.position.set(0, 2.8, -3.3);
scene.add(rim);

const clamp = T.MathUtils.clamp;
const smooth = (a, b, t) => {
  if (b <= a) return t >= b ? 1 : 0;
  const u = clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const pulse = (t, at, width) => Math.max(0, 1 - Math.abs(t - at) / width);
const MOTIONS = ['idle', 'walking', 'walk', 'start_walking', 'running', 'talking', 'talking2', 'waving', 'surprised', 'terrified'];
const ACTORS = [
  { name: 'LUNA', url: '../vrm/test.vrm', home: new T.Vector3(-0.72, 0, 0.18), entry: new T.Vector3(-3.15, 0, -0.32), yaw: 0.58 },
  { name: 'BIA', url: '../vrm/bia.vrm', home: new T.Vector3(0.72, 0, 0.02), entry: new T.Vector3(1.48, 0, -0.12), yaw: -0.58 },
];
let falas = [];
let words = [];
let duration = 0;
let firstLuna = 2;
let alertAt = Infinity;
let knockAt = Infinity;
let runAt = Infinity;
let lastTime = null;
let shot = '';
let cameraAim = new T.Vector3();
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
  falas = falas.filter((f) => Number.isFinite(Number(f.start)) && Number.isFinite(Number(f.end)))
    .map((f) => ({ ...f, start: Number(f.start), end: Number(f.end) }))
    .sort((a, b) => a.start - b.start);
  words = words.filter((w) => Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)))
    .map((w) => ({ ...w, start: Number(w.start), end: Number(w.end) }))
    .sort((a, b) => a.start - b.start);
  const lunaLine = falas.find((f) => String(f.speaker).toUpperCase() === 'LUNA');
  if (lunaLine) firstLuna = lunaLine.start;
  const alert = falas.find((f) => /esse rádio|rádio estava/i.test(f.text) || (Number(f.parte) === 2 && String(f.speaker).toUpperCase() === 'NARRADOR'));
  const knock = falas.find((f) => /tem alguém lá fora|três batidas|batida/i.test(f.text) || (Number(f.parte) === 3 && String(f.speaker).toUpperCase() === 'NARRADOR'));
  if (alert) alertAt = alert.start;
  if (knock) knockAt = knock.start;
  const speechEnd = Math.max(0, ...falas.map((f) => f.end));
  duration = Math.max(speechEnd, Number.isFinite(audio.duration) ? audio.duration : 0);
  runAt = duration > 5 ? Math.max(knockAt + 2, duration - 3.1) : Infinity;
  window.DURACAO = duration;
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
  actor.vrm.scene.position.copy(actor.entry);
  actor.vrm.scene.rotation.y = actor.baseYaw + actor.yaw;
  actor.vrm.scene.updateMatrixWorld(true);
  const head = actor.vrm.humanoid.getNormalizedBoneNode('head');
  actor.headY = head ? head.getWorldPosition(new T.Vector3()).y : 1.48;
  actor.gaze = new T.Object3D();
  scene.add(actor.gaze);
  if (actor.vrm.lookAt) actor.vrm.lookAt.target = actor.gaze;
  actor.mixer = new T.AnimationMixer(actor.vrm.scene);
  actor.actions = {};
  // O retarget é o exemplo oficial humanoidAnimation do three-vrm 2.x.
  for (const name of MOTIONS) {
    const clip = await loadMixamoAnimation(`../vrm/mixamo/${name}.fbx`, actor.vrm);
    // O deslocamento horizontal é dirigido pela cena. Fixar o quadril evita
    // que a translação embutida no FBX duplique o percurso ou gere saltos.
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.position')) continue;
      const first = track.values.slice(0, 3);
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = first[0];
        track.values[i + 2] = first[2];
        if (['walking', 'walk', 'start_walking', 'running'].includes(name)) track.values[i + 1] = first[1];
      }
    }
    const action = actor.mixer.clipAction(clip);
    action.setLoop(['waving', 'surprised', 'terrified', 'start_walking'].includes(name) ? T.LoopOnce : T.LoopRepeat);
    action.clampWhenFinished = true;
    actor.actions[name] = action;
  }
  actor.motion = '';
}

function lineAt(t) {
  return falas.find((f) => t >= f.start && t < f.end) || null;
}

function motionFor(actor, line, t) {
  if (t >= runAt + (actor.name === 'LUNA' ? 0.28 : 0)) return 'running';
  if (Math.abs(t - knockAt) < 1.15) return 'terrified';
  if (Math.abs(t - alertAt) < 0.95) return 'surprised';
  if (actor.name === 'LUNA') {
    const arrival = Math.max(1.1, firstLuna - 0.65);
    if (t < arrival) return 'walking';
    if (t < firstLuna + 0.55) return 'waving';
  } else if (t < Math.min(1.9, firstLuna - 0.6)) {
    return 'walk';
  }
  if (line && String(line.speaker).toUpperCase() === actor.name) {
    return (Number(line.i) || falas.indexOf(line)) % 2 ? 'talking2' : 'talking';
  }
  return 'idle';
}

function setMotion(actor, name, t, delta, seek) {
  const action = actor.actions[name];
  if (!action) return;
  if (seek) {
    for (const a of Object.values(actor.actions)) a.stop();
    action.reset().play();
    action.time = t % Math.max(0.001, action.getClip().duration);
    actor.motion = name;
    actor.mixer.update(0);
    return;
  }
  if (name !== actor.motion) {
    const old = actor.actions[actor.motion];
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    if (old) old.crossFadeTo(action, 0.4, true);
    actor.motion = name;
  }
  actor.mixer.update(delta);
}

function placeActors(t) {
  const arrival = Math.max(1.1, firstLuna - 0.65);
  for (const actor of ACTORS) {
    const isLuna = actor.name === 'LUNA';
    const entryEnd = isLuna ? arrival : Math.min(1.9, firstLuna - 0.6);
    const entryFactor = smooth(0.05, Math.max(0.6, entryEnd), t);
    actor.vrm.scene.position.copy(actor.entry).lerp(actor.home, entryFactor);
    actor.vrm.scene.position.y = 0;
    if (t >= runAt) {
      const start = runAt + (isLuna ? 0.28 : 0);
      const travel = smooth(start, start + 2.65, t);
      actor.vrm.scene.position.lerp(new T.Vector3(isLuna ? -5.6 : -6.1, 0, isLuna ? -0.72 : -0.46), travel);
      actor.vrm.scene.rotation.y = actor.baseYaw + T.MathUtils.lerp(actor.yaw, -1.68, smooth(start - 0.2, start + 0.42, t));
    } else {
      actor.vrm.scene.rotation.y = actor.baseYaw + actor.yaw;
    }
    actor.vrm.scene.updateMatrixWorld(true);
  }
}

function activeWord(t, speaker) {
  return words.find((w) => String(w.speaker).toUpperCase() === speaker && t >= w.start && t < w.end);
}

function mouthFor(word, t) {
  if (!word) return [0, 0, 0];
  const raw = String(word.word || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const vowels = [...raw].filter((c) => 'aeiou'.includes(c));
  const u = clamp((t - word.start) / Math.max(0.06, word.end - word.start), 0, 0.999);
  const vowel = vowels[Math.floor(u * vowels.length)] || 'a';
  const opening = 0.18 + 0.63 * Math.sin(Math.PI * u) * (0.72 + 0.28 * Math.sin(t * 32) ** 2);
  return vowel === 'i' || vowel === 'e' ? [0.08, opening, 0] : vowel === 'o' || vowel === 'u' ? [0.04, 0, opening] : [opening, 0, 0];
}

function expressions(actor, line, t) {
  const ex = actor.vrm.expressionManager;
  if (!ex) return;
  const wave = actor.name === 'LUNA' ? smooth(firstLuna - 0.6, firstLuna - 0.25, t) * (1 - smooth(firstLuna + 0.25, firstLuna + 0.8, t)) : 0;
  const alert = pulse(t, alertAt + 0.3, 1.25);
  const knock = pulse(t, knockAt + 0.35, 1.6);
  const talking = line && String(line.speaker).toUpperCase() === actor.name;
  const word = talking ? activeWord(t, actor.name) : null;
  const mouth = mouthFor(word, t);
  ex.setValue('happy', wave * 0.75);
  ex.setValue('surprised', alert * 0.82);
  ex.setValue('fear', Math.max(knock * 0.84, t >= runAt ? 0.34 : 0));
  ex.setValue('aa', mouth[0]);
  ex.setValue('ih', mouth[1]);
  ex.setValue('ou', mouth[2]);
  const blink = Math.max(pulse(t % 4.1, actor.name === 'LUNA' ? 3.1 : 1.7, 0.095), pulse(t % 6.7, actor.name === 'LUNA' ? 5.9 : 4.8, 0.1));
  ex.setValue('blink', blink * (1 - Math.max(alert, knock) * 0.7));
}

function headPosition(actor) {
  const node = actor.vrm.humanoid.getNormalizedBoneNode('head');
  return node ? node.getWorldPosition(new T.Vector3()) : actor.vrm.scene.position.clone().add(new T.Vector3(0, actor.headY, 0));
}

function directCamera(t, line) {
  const who = String(line?.speaker || '').toUpperCase();
  const scare = (Math.abs(t - knockAt) < 1.25 || Math.abs(t - alertAt) < 1.0) && t < runAt;
  const opening = t < firstLuna - 0.25;
  const running = t >= runAt;
  const speaker = ACTORS.find((a) => a.name === who);
  const kind = running ? 'run' : scare ? 'scare' : opening || !speaker ? 'wide' : `ots-${who}`;
  const target = new T.Vector3();
  const position = new T.Vector3();
  let fov = 35;
  if (kind === 'wide' || kind === 'run') {
    const middle = ACTORS[0].vrm.scene.position.clone().add(ACTORS[1].vrm.scene.position).multiplyScalar(0.5);
    position.set(kind === 'run' ? -0.45 : 0.05, 1.8, kind === 'run' ? 4.0 : 3.35);
    target.set(kind === 'run' ? -1.5 : middle.x, 1.22, kind === 'run' ? -0.1 : middle.z);
    fov = kind === 'run' ? 43 : 39;
  } else if (kind === 'scare') {
    const focus = who === 'BIA' ? ACTORS[1] : ACTORS[0];
    target.copy(headPosition(focus)).add(new T.Vector3(0, -0.02, 0));
    position.copy(target).add(new T.Vector3(who === 'BIA' ? 0.23 : -0.23, 0.06, 1.13));
    fov = 29;
  } else {
    const listener = ACTORS.find((a) => a !== speaker);
    target.copy(headPosition(speaker)).add(new T.Vector3(0, -0.18, 0));
    const side = who === 'LUNA' ? 1 : -1;
    // Ombro do ouvinte em primeiro plano; a face iluminada de quem fala fica livre.
    position.copy(listener.vrm.scene.position).add(new T.Vector3(side * 0.27, 1.61, 1.50));
    fov = 32;
  }
  // Corte a cada troca de fala, com leve movimento dentro de cada plano.
  if (kind !== shot) {
    camera.position.copy(position);
    cameraAim.copy(target);
    shot = kind;
  } else {
    camera.position.lerp(position, 0.11);
    cameraAim.lerp(target, 0.16);
  }
  camera.position.x += Math.sin(t * 0.43) * 0.006;
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraAim);
  camera.rotation.z = 0;
}

function updateCaption(line) {
  caption.replaceChildren();
  if (!line) return;
  const name = document.createElement('strong');
  name.textContent = `${String(line.speaker || '').toUpperCase()}:`;
  caption.append(name, document.createTextNode(String(line.text || '')));
}

function draw(t, forced = false) {
  if (!window.ready) return;
  const time = clamp(Number(t) || 0, 0, duration || Math.max(0, Number(t) || 0));
  const delta = lastTime === null ? 0 : clamp(time - lastTime, 0, 0.05);
  const seek = forced && (lastTime === null || Math.abs(time - lastTime) > 0.12 || time < lastTime);
  const line = lineAt(time);
  placeActors(time);
  for (const actor of ACTORS) {
    setMotion(actor, motionFor(actor, line, time), time, delta, seek);
    actor.vrm.scene.updateMatrixWorld(true);
  }
  const heads = ACTORS.map(headPosition);
  for (let i = 0; i < ACTORS.length; i++) {
    const actor = ACTORS[i];
    actor.gaze.position.copy(heads[1 - i]);
    if (String(line?.speaker || '').toUpperCase() === actor.name) {
      actor.gaze.position.lerp(camera.position, 0.16);
    }
    expressions(actor, line, time);
    actor.vrm.update(Math.max(delta, forced ? 1 / 30 : 0));
  }
  directCamera(time, line);
  const fx = Math.abs(time - alertAt) < 1.1 || Math.abs(time - knockAt) < 1.5 ? ['relampago'] : [];
  world.update(time, 'normal', fx);
  for (const light of worldLights) {
    light.intensity *= light.isHemisphereLight ? 0.47 : light.isPointLight ? 0.25 : 0.48;
  }
  updateCaption(line);
  renderer.render(scene, camera);
  lastTime = time;
}

window.renderFrame = (t) => draw(t, true);
window.capturaFrame = () => {
  if (!window.ready) throw new Error('Cena ainda não carregada');
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
};

async function boot() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const [timedLines, timedWords] = await Promise.all([
      optionalJson('../cena_duas/falas.json'),
      optionalJson('../cena_duas/words.json'),
    ]);
    falas = timedLines;
    words = timedWords;
    setupTiming();
    await Promise.all(ACTORS.map(loadActor));
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
  if (window.ready && !audio.paused) draw(audio.currentTime);
}
loop();
boot().catch(() => {});
