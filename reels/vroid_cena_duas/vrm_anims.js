import * as T from './lib/three.module.js';
import { BVHLoader } from './lib/BVHLoader.js';

// CMU BVH joints -> VRM humanoid normalized joints. The normalized rig is
// important: raw VRM0 and VRM1 bones have different local axes.
const JOINTS = {
  hips: 'Hips', spine: 'LowerBack', chest: 'Spine', upperChest: 'Spine1',
  neck: 'Neck1', head: 'Head',
  leftShoulder: 'LeftShoulder', leftUpperArm: 'LeftArm',
  leftLowerArm: 'LeftForeArm', leftHand: 'LeftHand',
  rightShoulder: 'RightShoulder', rightUpperArm: 'RightArm',
  rightLowerArm: 'RightForeArm', rightHand: 'RightHand',
  leftUpperLeg: 'LeftUpLeg', leftLowerLeg: 'LeftLeg',
  leftFoot: 'LeftFoot', leftToes: 'LeftToeBase',
  rightUpperLeg: 'RightUpLeg', rightLowerLeg: 'RightLeg',
  rightFoot: 'RightFoot', rightToes: 'RightToeBase',
};

const FILES = ['idle', 'walk', 'wave', 'talk', 'surprised'];
const v3 = () => new T.Vector3();
const q4 = () => new T.Quaternion();
let ativo = null;

function alturaFonte(skeleton) {
  skeleton.bones[0].updateMatrixWorld(true);
  const head = skeleton.bones.find((b) => b.name === 'Head');
  const feet = skeleton.bones.filter((b) => /^(LeftFoot|RightFoot)$/.test(b.name));
  if (!head || feet.length !== 2) throw new Error('BVH CMU sem cabeça ou pés');
  const yHead = head.getWorldPosition(v3()).y;
  const yFoot = Math.min(...feet.map((b) => b.getWorldPosition(v3()).y));
  return Math.max(0.01, yHead - yFoot);
}

function alturaVrm(vrm) {
  vrm.scene.updateMatrixWorld(true);
  const head = vrm.humanoid.getNormalizedBoneNode('head');
  const left = vrm.humanoid.getNormalizedBoneNode('leftFoot');
  const right = vrm.humanoid.getNormalizedBoneNode('rightFoot');
  if (!head || !left || !right) throw new Error('VRM sem ossos essenciais');
  return head.getWorldPosition(v3()).y - Math.min(
    left.getWorldPosition(v3()).y, right.getWorldPosition(v3()).y,
  );
}

function fazerClip(nome, bvh, vrm) {
  const sources = new Map(bvh.skeleton.bones.map((bone) => [bone.name, bone]));
  const tracks = new Map(bvh.clip.tracks.map((track) => [track.name, track]));
  const scale = alturaVrm(vrm) / alturaFonte(bvh.skeleton);
  const sceneRotationInv = vrm.scene.getWorldQuaternion(q4()).invert();
  const result = [];

  for (const [targetName, sourceName] of Object.entries(JOINTS)) {
    const source = sources.get(sourceName);
    const target = vrm.humanoid.getNormalizedBoneNode(targetName);
    const track = tracks.get(`${sourceName}.quaternion`);
    if (!source || !target || !track) continue;

    // Convert local rotations through the two parents' rest-space bases.
    // This also handles VRM files whose normalized rest bones are not identity.
    const sourceParent = source.parent?.getWorldQuaternion(q4()) ?? q4();
    const targetParent = sceneRotationInv.clone().multiply(
      target.parent?.getWorldQuaternion(q4()) ?? q4(),
    );
    const basis = targetParent.clone().invert().multiply(sourceParent);
    const basisInv = basis.clone().invert();
    const sourceRestInv = source.quaternion.clone().invert();
    const targetRest = target.quaternion.clone();
    const standingLeg = (nome === 'talk' || nome === 'wave') && /(UpperLeg|LowerLeg|Foot|Toes)$/.test(targetName);
    const firstRotation = q4().fromArray(track.values, 0);
    const rotations = [];
    for (let i = 0; i < track.values.length; i += 4) {
      const motion = q4().fromArray(track.values, i);
      if (standingLeg) motion.copy(firstRotation);
      if (targetName === 'hips') {
        const lean = new T.Euler().setFromQuaternion(motion, 'YXZ');
        lean.y = 0; // heading belongs to the continuous scene path
        motion.setFromEuler(lean);
      }
      if (nome === 'idle' && /LowerArm$/.test(targetName)) {
        // The source idle has 55–70° elbows; retain its timing while relaxing
        // the forearms to roughly 12–15° for the resting silhouette.
        motion.copy(q4().slerp(motion, 0.22));
      }
      if (nome === 'idle' && /UpperArm$/.test(targetName)) {
        motion.premultiply(q4().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.1));
      }
      if (nome === 'talk') {
        // The captured "giving directions" motion opens the elbows sideways.
        // Bring its animated arms in front of the torso while preserving the
        // recorded shoulder, elbow, hand and wrist timing.
        const sign = targetName.startsWith('left') ? -1 : 1;
        if (/UpperArm$/.test(targetName)) {
          motion.premultiply(q4().setFromAxisAngle(new T.Vector3(1, 0, 0), -0.4));
          motion.premultiply(q4().setFromAxisAngle(new T.Vector3(0, 1, 0), sign * 0.6));
        } else if (/LowerArm$/.test(targetName)) {
          motion.multiply(q4().setFromAxisAngle(new T.Vector3(0, 1, 0), sign * 0.7));
        }
      }
      motion.premultiply(sourceRestInv);
      const corrected = targetRest.clone().multiply(basis).multiply(motion).multiply(basisInv).normalize();
      corrected.toArray(rotations, i);
    }
    result.push(new T.QuaternionKeyframeTrack(`${target.uuid}.quaternion`, track.times, rotations));

    if (targetName === 'hips') {
      const sourcePosition = tracks.get('Hips.position');
      if (sourcePosition) {
        const base = sourcePosition.values[1];
        const y = [];
        const p = target.position.clone();
        for (let i = 0; i < sourcePosition.values.length; i += 3) {
          // Horizontal root motion is applied to the scene separately. Keeping
          // it off this track avoids a snap whenever a clip is crossfaded.
          const lift = nome === 'talk' || nome === 'wave' ? 0 : (sourcePosition.values[i + 1] - base) * scale;
          y.push(p.x, p.y + lift, p.z);
        }
        result.push(new T.VectorKeyframeTrack(`${target.uuid}.position`, sourcePosition.times, y));
      }
    }
  }

  const root = tracks.get('Hips.position');
  const progress = root ? Array.from(root.values).filter((_, i) => i % 3 === 2) : [];
  const first = progress[0] ?? 0;
  const last = progress.at(-1) ?? first;
  const deslocamento = (time) => {
    if (!root || last === first) return T.MathUtils.clamp(time / bvh.clip.duration, 0, 1);
    const index = T.MathUtils.clamp(time / bvh.clip.duration, 0, 1) * (progress.length - 1);
    const lo = Math.floor(index);
    const z = T.MathUtils.lerp(progress[lo], progress[Math.min(lo + 1, progress.length - 1)], index - lo);
    return T.MathUtils.clamp((z - first) / (last - first), 0, 1);
  };
  return { clip: new T.AnimationClip(nome, bvh.clip.duration, result), deslocamento, scale };
}

function relaxarDedos(vrm) {
  for (const side of ['left', 'right']) {
    for (const finger of ['Index', 'Middle', 'Ring', 'Little']) {
      for (const [segment, angle] of [['Proximal', 0.12], ['Intermediate', 0.16], ['Distal', 0.11]]) {
        const bone = vrm.humanoid.getNormalizedBoneNode(`${side}${finger}${segment}`);
        if (bone) bone.quaternion.multiply(q4().setFromAxisAngle(new T.Vector3(1, 0, 0), angle));
      }
    }
    const thumb = vrm.humanoid.getNormalizedBoneNode(`${side}ThumbProximal`);
    if (thumb) thumb.quaternion.multiply(q4().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.12));
  }
}

export async function carregarAnims(vrm) {
  const loader = new BVHLoader();
  loader.animateBonePositions = true;
  const loaded = await Promise.all(FILES.map((name) => loader.loadAsync(`../vrm/anims/${name}.bvh`)));
  const motions = Object.fromEntries(FILES.map((name, i) => [name, fazerClip(name, loaded[i], vrm)]));
  relaxarDedos(vrm);
  const mixer = new T.AnimationMixer(vrm.scene);
  const actions = Object.fromEntries(FILES.map((name) => {
    const action = mixer.clipAction(motions[name].clip);
    action.setLoop(name === 'idle' ? T.LoopPingPong : T.LoopOnce, Infinity);
    action.clampWhenFinished = name !== 'idle';
    return [name, action];
  }));
  let current = null;
  const controller = {
    mixer,
    motions,
    tocar(nome, { fade = 0.4, duracao } = {}) {
      const next = actions[nome];
      if (!next) throw new Error(`Animação desconhecida: ${nome}`);
      if (current === next) return next;
      next.reset();
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.setEffectiveTimeScale(1);
      if (duracao) next.setDuration(duracao);
      next.play();
      if (current) next.crossFadeFrom(current, fade, false);
      current = next;
      return next;
    },
    atualizar(delta) { mixer.update(delta); },
    deslocamento(nome, time) { return motions[nome]?.deslocamento(time) ?? 0; },
  };
  ativo = controller;
  return controller;
}

export function tocar(nome, options) {
  if (!ativo) throw new Error('Chame carregarAnims(vrm) antes de tocar');
  return ativo.tocar(nome, options);
}
