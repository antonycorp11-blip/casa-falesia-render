import * as T from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { makeWorld } from './world.js';

const canvas = document.querySelector('#c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.outputColorSpace = T.SRGBColorSpace;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(30, 16 / 9, 0.05, 160);
scene.add(camera);
const world = makeWorld(scene);
world.update(1, 'normal', []);

// A mesa do brinde e suas taças ocupam a linha entre a câmera e a origem.
const worldRoot = scene.children.find((item) => item.isGroup);
const table = worldRoot?.children.find((item) =>
  item.isGroup && item.position.distanceToSquared(new T.Vector3(-0.25, 0, 2.28)) < 0.0001
);
if (table) table.visible = false;

// Mesma combinação de preenchimento e luzes de retrato usada no main.js.
const faceFill = new T.PointLight('#cfe4ff', 1.6, 10, 1.45);
faceFill.position.set(0.18, 0.22, -0.35);
camera.add(faceFill);
const key = new T.DirectionalLight('#fff2de', 1.75);
key.position.set(1.6, 2.6, 2.4);
scene.add(key);
const rim = new T.DirectionalLight('#9ed2ff', 0.95);
rim.position.set(-1.8, 2.4, -1.6);
scene.add(rim);

window.ready = false;
let vrm;
let height = 1.6;
let headY = 1.48;

function render() {
  renderer.render(scene, camera);
}

function pose() {
  const left = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
  const right = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
  if (left) left.rotation.z = -T.MathUtils.degToRad(70);
  if (right) right.rotation.z = T.MathUtils.degToRad(70);
  vrm.expressionManager?.setValue('happy', 0.3);
}

window.foto = (angulo = 0, tipo = 'corpo') => {
  if (!window.ready) throw new Error('VRM ainda não carregado');
  const theta = Number.isFinite(Number(angulo)) ? T.MathUtils.degToRad(Number(angulo)) : 0;
  const rosto = tipo === 'rosto';
  camera.fov = 30;
  camera.updateProjectionMatrix();
  const distance = rosto ? 0.95 : height / (2 * Math.tan(T.MathUtils.degToRad(15))) * 1.15;
  const targetY = rosto ? headY + 0.09 : height * 0.5;
  camera.position.set(Math.sin(theta) * distance, targetY, Math.cos(theta) * distance);
  camera.lookAt(0, targetY, 0);
  render();
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
};

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.load('../vrm/test.vrm', (gltf) => {
  vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('Arquivo sem dados VRM');
  if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
  vrm.scene.position.set(0, 0, 0);
  scene.add(vrm.scene);
  pose();
  vrm.scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(vrm.scene);
  height = bounds.max.y - Math.min(0, bounds.min.y);
  const head = vrm.humanoid.getNormalizedBoneNode('head');
  if (head) headY = head.getWorldPosition(new T.Vector3()).y;
  window.ready = true;
  window.foto(0, 'corpo');
}, undefined, (error) => {
  document.querySelector('#erro').textContent = `Erro ao carregar VRM: ${error.message || error}`;
  console.error(error);
});

const clock = new T.Clock();
let elapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!vrm) return;
  elapsed += dt;
  // Piscar curto, repetido a cada quatro segundos.
  const phase = elapsed % 4;
  const blink = Math.max(0, 1 - Math.abs(phase - 3.5) / 0.11);
  vrm.expressionManager?.setValue('blink', blink);
  vrm.update(dt);
  render();
}
animate();
