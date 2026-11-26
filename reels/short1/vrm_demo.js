import * as T from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { makeWorld } from './world.js';
import { carregarAnims } from './vrm_anims.js';

const canvas = document.querySelector('#c');
const stage = document.querySelector('#stage');
const playButton = document.querySelector('#play');
const errorBox = document.querySelector('#erro');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = T.SRGBColorSpace;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(35, 16 / 9, 0.05, 160);
const world = makeWorld(scene);
world.update(0, 'normal', []);

// A mesa do brinde encobre o caminho entre a personagem e a câmera.
const worldRoot = scene.children.find((item) => item.isGroup);
const table = worldRoot?.children.find((item) =>
  item.isGroup && item.position.distanceToSquared(new T.Vector3(-0.25, 0, 2.28)) < 0.0001
);
if (table) table.visible = false;

// Suaviza as luzes práticas já criadas pela sala antes da iluminação de retrato.
scene.traverse((item) => {
  if (item.isHemisphereLight) item.intensity = 0.38;
  else if (item.isDirectionalLight) item.intensity *= 0.35;
  else if (item.isPointLight) item.intensity *= 0.24;
});
const key = new T.DirectionalLight('#ffdfb8', 1.15);
key.position.set(-2.5, 3.4, 3.1);
scene.add(key);
const rim = new T.DirectionalLight('#a4c8ef', 0.65);
rim.position.set(1.8, 2.7, -2.4);
scene.add(rim);

const clamp = T.MathUtils.clamp;
const mix = T.MathUtils.lerp;
const smooth = (a, b, v) => {
  const u = clamp((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const pulse = (t, center, width) => Math.max(0, 1 - Math.abs(t - center) / width);
const LOOP = 24;
const START = new T.Vector3(-2.65, 0, -0.35);
const STOP = new T.Vector3(-0.45, 0, 0.72);
const WALK_IN = [1, 4.8];
const WALK_OUT = [19, 22.2];
const direction = Math.atan2(STOP.x - START.x, STOP.z - START.z);
const cameraGoal = new T.Vector3();
const cameraAim = new T.Vector3();
const lookTarget = new T.Object3D();
scene.add(lookTarget);

let vrm;
let anims;
let headY = 1.48;
let facingOffset = 0;
let playing = true;
let elapsed = 0;
let currentMotion = '';

function resize() {
  const width = Math.max(1, Math.round(stage.clientWidth));
  const height = Math.max(1, Math.round(stage.clientHeight));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

function setPlayback(value) {
  playing = value;
  playButton.textContent = playing ? '❚❚' : '▶';
  playButton.setAttribute('aria-label', playing ? 'Pausar animação' : 'Reproduzir animação');
  playButton.title = playing ? 'Pausar animação' : 'Reproduzir animação';
}
playButton.addEventListener('click', () => setPlayback(!playing));

function dirigir(t, delta) {
  const motion = t < WALK_IN[0] ? 'idle'
    : t < WALK_IN[1] ? 'walk'
        : t < 5.3 ? 'idle'
        : t < 8.1 ? 'wave'
          : t < 8.5 ? 'idle'
            : t < 13.7 ? 'talk'
              : t < 14.1 ? 'idle'
                : t < 18.2 ? 'surprised'
                  : t < WALK_OUT[0] ? 'idle'
                    : t < WALK_OUT[1] ? 'walk' : 'idle';
  if (motion !== currentMotion) {
    const duracao = motion === 'walk'
      ? (t < WALK_IN[1] ? WALK_IN[1] - WALK_IN[0] : WALK_OUT[1] - WALK_OUT[0])
      : motion === 'surprised' ? 4.1 : undefined;
    anims.tocar(motion, { fade: motion === 'surprised' ? 0.32 : 0.42, duracao });
    currentMotion = motion;
  }
  anims.atualizar(delta);

  // A translação segue a distância registrada pelo quadril no BVH. O mesmo
  // ciclo de passos leva a personagem de volta, agora virada para o retorno.
  let travel;
  if (t < WALK_IN[0]) travel = 0;
  else if (t < WALK_IN[1]) {
    travel = anims.deslocamento('walk', (t - WALK_IN[0]) / (WALK_IN[1] - WALK_IN[0]) * anims.motions.walk.clip.duration);
  } else if (t < WALK_OUT[0]) travel = 1;
  else if (t < WALK_OUT[1]) {
    travel = 1 - anims.deslocamento('walk', (t - WALK_OUT[0]) / (WALK_OUT[1] - WALK_OUT[0]) * anims.motions.walk.clip.duration);
  } else travel = 0;
  vrm.scene.position.copy(START).lerp(STOP, travel);
  const faceCamera = smooth(4.8, 5.3, t) * (1 - smooth(18.05, 18.95, t));
  const turnOut = smooth(18.05, 18.95, t);
  const turnHome = smooth(22.2, 23.2, t);
  vrm.scene.rotation.y = facingOffset + mix(direction, 0, faceCamera) - Math.PI * (turnOut - turnHome);

  const wave = smooth(5.3, 5.7, t) * (1 - smooth(7.8, 8.2, t));
  const talk = smooth(8.5, 8.9, t) * (1 - smooth(13.3, 13.8, t));
  const alarm = smooth(14.1, 14.45, t) * (1 - smooth(17.9, 18.45, t));
  const expression = vrm.expressionManager;
  const speaking = talk * (0.18 + 0.38 * Math.pow(Math.sin(t * 8.8), 2));
  expression?.setValue('happy', wave * 0.85 + talk * 0.12);
  expression?.setValue('surprised', alarm * 0.9);
  expression?.setValue('aa', speaking * (0.65 + 0.35 * Math.sin(t * 5.3)));
  expression?.setValue('oh', speaking * (0.35 - 0.25 * Math.sin(t * 5.3)));
  const blinks = [2.2, 5.75, 8.3, 11.7, 14.3, 18.5, 22.7];
  expression?.setValue('blink', Math.max(...blinks.map((at) => pulse(t, at, 0.12))));
}

function moveCamera(t, delta, cut = false) {
  const actor = vrm.scene.position;
  const medium = smooth(4.5, 5.8, t) * (1 - smooth(21.4, 23.7, t));
  const close = smooth(8.2, 9.5, t) * (1 - smooth(13.1, 14.4, t));
  const retreat = smooth(14.5, 16.3, t) * (1 - smooth(21.4, 23.7, t));
  const offsetX = mix(0.62, 0.18, medium) - close * 0.1 + retreat * 0.55;
  const offsetZ = mix(3.55, 2.35, medium) - close * 1.12 + retreat * 0.75;
  cameraGoal.set(actor.x + offsetX, mix(1.72, 1.47, close), actor.z + offsetZ);
  cameraAim.set(actor.x, mix(headY * 0.75, headY + 0.02, close), actor.z);
  const amount = cut ? 1 : 1 - Math.exp(-delta * 3.8);
  camera.position.lerp(cameraGoal, amount);
  camera.userData.aim ??= cameraAim.clone();
  camera.userData.aim.lerp(cameraAim, amount);
  camera.lookAt(camera.userData.aim);
  camera.fov = mix(camera.fov, mix(35, 31, close), amount);
  camera.updateProjectionMatrix();
}

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.load('../vrm/test.vrm', async (gltf) => {
  try {
  vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('Arquivo sem dados VRM');
  if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
  facingOffset = vrm.scene.rotation.y;
  scene.add(vrm.scene);
  vrm.scene.updateMatrixWorld(true);
  const head = vrm.humanoid.getNormalizedBoneNode('head');
  if (head) headY = head.getWorldPosition(new T.Vector3()).y;
  if (vrm.lookAt) vrm.lookAt.target = lookTarget;
  anims = await carregarAnims(vrm);
  anims.tocar('idle', { fade: 0 });
  currentMotion = 'idle';
  anims.atualizar(0);
  vrm.scene.position.copy(START);
  vrm.scene.rotation.y = facingOffset + direction;
  moveCamera(0, 0, true);
  } catch (error) {
    errorBox.textContent = `Erro ao carregar animações: ${error.message || error}`;
    console.error(error);
    vrm = null;
  }
}, undefined, (error) => {
  errorBox.textContent = `Erro ao carregar VRM: ${error.message || error}`;
  console.error(error);
});

const clock = new T.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (vrm && anims) {
    if (playing) elapsed += delta;
    const t = elapsed % LOOP;
    dirigir(t, playing ? delta : 0);
    moveCamera(t, delta);
    // O alvo do lookAt fica na câmera e, no susto, passa para as portas de vidro.
    const windowWeight = smooth(14.6, 15.4, t) * (1 - smooth(21.4, 23.7, t));
    lookTarget.position.copy(camera.position).lerp(new T.Vector3(-2.6, headY, -5), windowWeight);
    vrm.update(playing ? delta : 0); // atualiza olhos, expressões e SpringBone a cada quadro
  }
  renderer.render(scene, camera);
}
animate();
