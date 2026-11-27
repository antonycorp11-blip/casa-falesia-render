import * as T from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { FBXLoader } from './lib/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './lib/three-vrm.module.js';
import { loadMixamoAnimation } from './lib/loadMixamoAnimation.js';
import { makeWorld } from './world.js';
import { PONTOS, BOUNDS, localDoPonto, caminhoMaisCurto } from './pontos.js';

const qs = new URLSearchParams(location.search);
const folder = (value, base) => new URL(value.endsWith('/') ? value : `${value}/`, base);
const ASSETS = folder(qs.get('assets') || './assets/', import.meta.url);
const EP = folder(qs.get('ep') || './previa3/', import.meta.url);
const vertical = qs.get('vertical') === '1';
const qaMode = qs.get('qa') === '1';
const W = vertical ? 1080 : 1920, H = vertical ? 1920 : 1080;
const canvas = document.querySelector('#c'), overlay = document.querySelector('#overlay');
const ctx = overlay.getContext('2d'), audio = document.querySelector('#audio');
const play = document.querySelector('#play'), errorBox = document.querySelector('#erro');
const capture = document.createElement('canvas');
canvas.width = overlay.width = capture.width = W;
canvas.height = overlay.height = capture.height = H;
document.documentElement.classList.toggle('vertical', vertical);
const captureCtx = capture.getContext('2d');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;
renderer.setClearColor(qaMode ? '#ff00ff' : '#020408', 1);
const scene = new T.Scene(), camera = new T.PerspectiveCamera(50, W / H, 0.1, 160);
const world = makeWorld(scene);
const skyMats = [];
scene.traverse(x => {
  if (x.isMesh && x.material?.isMeshBasicMaterial && x.material.map && x.material.fog === false) {
    if (!skyMats.some(s => s.mat === x.material)) {
      skyMats.push({ mat: x.material, map: x.material.map, color: x.material.color.clone() });
    }
  }
});
if (qaMode) {
  scene.background = new T.Color('#ff00ff');
  scene.fog = null;
  for (const s of skyMats) {
    s.mat.map = null;
    s.mat.color.set('#ff00ff');
    s.mat.toneMapped = false;
    s.mat.needsUpdate = true;
  }
}
const worldRoot = scene.children.find(x => x.isGroup);
// A mesa central bloqueia o fluxo. A porta de aço lateral fica aberta para quem a atravessa.
const table = worldRoot?.children.find(x => x.isGroup && x.position.distanceToSquared(new T.Vector3(-0.25,0,2.28)) < .001);
if (table) table.visible = false;
const steelDoor = scene.children.find(x => x.isGroup && x.children.some(y => y.isGroup && Math.abs(y.position.x + 4.78) < .02));
steelDoor?.children.find(x => x.isGroup && Math.abs(x.position.x + 4.78) < .02)?.rotation.set(0, -Math.PI / 2, 0);
const solidWorld = [];
scene.traverse(x => { if (x.isMesh && x.visible && (!x.material?.transparent || Math.abs(x.position.z+4.98)<.05)) solidWorld.push(x); });
const glassPanels=worldRoot?.children.filter(x=>x.isMesh && x.material?.transparent &&
  Math.abs(x.position.z+4.98)<.05 && Math.abs(x.position.y-1.65)<.1) || [];
const glassSet=new Set(glassPanels);
const hash = n => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x-Math.floor(x); };
const shards=[];
const shardMaterial=new T.MeshPhysicalMaterial({color:'#d4f0ff',transparent:true,opacity:.72,
  roughness:.06,metalness:.08,side:T.DoubleSide});
for (let i=0;i<36;i++) {
  const geometry=new T.BufferGeometry();
  const w=.12+hash(i*5)*.3,h=.14+hash(i*11)*.34;
  geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0,w,h,0,-w*.7,h*.2,0],3));
  geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,shardMaterial);
  const base=[-4.8+hash(i*19)*9.6, .25+hash(i*23)*2.7, -4.96];
  mesh.position.fromArray(base);mesh.visible=false;scene.add(mesh);
  shards.push({mesh,base,phase:hash(i*31)});
}
const ray = new T.Raycaster();
const ambient = new T.DirectionalLight('#fff0dc', 1.1); ambient.position.set(-3,5,2); scene.add(ambient);
const fill = new T.DirectionalLight('#dbeaff', .6); fill.position.set(3,4,-3); scene.add(fill);
const flash = new T.PointLight('#d9ecff', 0, 35); flash.position.set(0,4,-8); scene.add(flash);
const baseLights = [];
scene.traverse(x => { if (x.isLight && x !== ambient && x !== fill && x !== flash) baseLights.push([x,x.intensity]); });
const camFill = new T.PointLight('#b8d4f8', 0.85, 18, 1); scene.add(camFill);
const rimLight = new T.DirectionalLight('#cfe4ff', 0.55); scene.add(rimLight); scene.add(rimLight.target);
const clamp = T.MathUtils.clamp;
const vec = p => new T.Vector3(...p);
const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const mix = (a,b,u) => a.map((v,i) => v+(b[i]-v)*u);
const smooth = (a,b,t) => { const u=clamp((t-a)/(b-a || 1),0,1); return u*u*(3-2*u); };
const asset = path => new URL(path, ASSETS).href;
const epFile = path => new URL(path, EP).href;
let falas=[], words=[], beats=[], textCues=[], hudCues=[], duracao=0;
let shatterAt=Infinity;
let actors = new Map(), zombies = new Map(), actorPlans = new Map(), zombiePlans = new Map();
window.ready = false; window.DURACAO = 0;

const ACTOR_FILES = { LUNA:'test.vrm', BIA:'bia.vrm', ANTONY:'antony.vrm' };
const ZOMBIE_FILES = { zombiegirl:'zombiegirl.fbx', copzombie:'copzombie.fbx', yaku:'yaku.fbx' };
const ACTIONS = {
  falar:['talking','talking2','talking_1','talking_2','standing_arguing','pack_gestos/angry_gesture','pack_gestos/dismissing_gesture','pack_gestos/happy_hand_gesture','pack_gestos/shaking_head_no'],
  ouvir:['idle'], andar:['walking','walk','start_walking'],
  correr:['running','fast_run','jogging'], agachar:['kneeling'],
  agachar_andando:['crouched_walking','sneak_walk'],
  esconder:['kneeling'], ajoelhar:['kneeling','kneeling_down'],
  olhar_em_volta:['look_around','nervously_look_around'], espiar:['look_around','pack_gestos/look_away_gesture'],
  apontar:['pack_gestos/angry_gesture','pushing'], empurrar:['pushing','button_pushing'],
  abrir_porta:['pushing','button_pushing'],
  subir_escada:['ascending_stairs','running_up_stairs'], descer_escada:['walking','walk'],
  tropecar:['jogging_stumble'], cair:['terrified','jogging_stumble'], levantar:['idle','pack_gestos/weight_shift'],
  telefone:['talking_on_phone'], chorar:['crying','sad_idle'], rir_nervoso:['laughing','pack_gestos/relieved_sigh'],
  gritar:['yelling','yelling_out'], cobrir_boca:['terrified','surprised'], imovel:['idle','pack_gestos/weight_shift'],
};
const SPEECH_CALM = ['idle', 'sad_idle', 'pack_gestos/weight_shift'];
const CROUCH_ENTER = new Set(['agachar', 'esconder', 'ajoelhar', 'agachar_andando']);
const CROUCH_EXIT = new Set(['levantar', 'andar', 'correr', 'subir_escada', 'descer_escada']);
const Z_LOCOMOTION = new Set(['andar', 'correr', 'rastejar']);
const EMOCOES = new Set(['medo', 'tensa', 'alivio', 'triste']);
const DANGER_FX = new Set(['relampago', 'vidro_quebrado', 'escuro', 'tremor']);
const DANGER_LIGHTS = new Set(['tempestade', 'apagao', 'emergencia']);
const HIGH_DANGER_ACTIONS = new Set(['gritar', 'cair', 'tropecar', 'cobrir_boca']);
const Z_ACTIONS = { andar:['zombie_walk'], correr:['zombie_run'], farejar:['zombie_idle'],
  gritar:['zombie_scream'], atacar:['zombie_attack'], bater_vidro:['zombie_attack'],
  bater_porta:['zombie_attack'], rastejar:['zombie_crawl','running_crawl'],
  morder:['zombie_biting','zombie_biting_2','zombie_neck_bite'], parado:['zombie_idle'] };
const Z_FILES = { zombie_walk:'zombie_walk', zombie_run:'zombie_run', zombie_idle:'zombie_idle',
  zombie_scream:'zombie_scream', zombie_attack:'zombie_attack', zombie_crawl:'zombie_crawl',
  running_crawl:'running_crawl', zombie_biting:'zombie_biting',
  zombie_biting_2:'zombie_biting_2', zombie_neck_bite:'zombie_neck_bite' };
const LOCOMOTION = new Set(['andar','correr','agachar_andando','subir_escada','descer_escada']);
const ONE_SHOT = new Set(['jogging_stumble','kneeling_down','surprised','terrified','opening','pushing','button_pushing']);
function pick(pool, previous, seed) {
  const list = pool.filter(x => x !== previous);
  return (list.length ? list : pool)[Math.floor(hash(seed) * (list.length || pool.length))];
}
function speechPool(line) {
  const text = String(line?.text || '').toLowerCase();
  if (/não|pare|sai|corre|perigo/.test(text)) return ['standing_arguing','pack_gestos/angry_gesture','pack_gestos/dismissing_gesture','talking_2'];
  if (/\?/.test(text)) return ['talking_1','talking2','pack_gestos/shaking_head_no','pack_gestos/look_away_gesture'];
  return ACTIONS.falar;
}
function pickSpeechMotion(line, prevMotion, seed, speechState) {
  const idx = speechState.count++;
  const useGesture = hash(seed * 1.37 + idx * 19.3) < 0.35;
  if (useGesture) {
    const allowed = (pool) => pool.filter(g => !speechState.lastUsed.has(g) || (idx - speechState.lastUsed.get(g)) >= 4);
    let candidates = allowed(speechPool(line));
    if (!candidates.length) candidates = allowed(ACTIONS.falar);
    if (!candidates.length) {
      candidates = [...ACTIONS.falar].sort((a, b) => (speechState.lastUsed.get(a) ?? -99) - (speechState.lastUsed.get(b) ?? -99)).slice(0, 3);
    }
    const chosen = pick(candidates, prevMotion, seed + idx * 7);
    speechState.lastUsed.set(chosen, idx);
    return { motion: chosen, subtleSpeak: false };
  }
  const chosen = pick(SPEECH_CALM, prevMotion, seed + idx * 11);
  return { motion: chosen, subtleSpeak: true };
}
async function fetchRequired(path, type='json') {
  const res = await fetch(epFile(path), {cache:'no-store'});
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return type === 'text' ? res.text() : res.json();
}
async function loadDirection() {
  const results = await Promise.all(Array.from({length:20}, (_,i) =>
    fetch(epFile(`dir/parte${i+1}.json`), {cache:'no-store'}).then(async r => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`dir/parte${i+1}.json: HTTP ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.beats)) throw new Error(`parte${i+1}.json sem beats[]`);
      return data.beats;
    })
  ));
  return results.flatMap(x => x || []).map((b,i) => ({...b,_i:i})).sort((a,b) => a.t0-b.t0 || a._i-b._i);
}
function parseRoteiro(raw) {
  let pendingText=null, pendingHud=null, cursor=0;
  for (const line of raw.split(/\r?\n/).map(x=>x.trim())) {
    const tx=line.match(/^\[TEXTO:\s*(.+?)\]$/i), hd=line.match(/^\[HUD:\s*(.+?)\]$/i);
    if (tx) { pendingText=tx[1]; continue; }
    if (hd) { pendingHud=hd[1]; continue; }
    const speech=line.match(/^([\p{L}_]+)\s*:\s*(.+)$/u);
    if (!speech) continue;
    const norm=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    let idx=falas.findIndex((f,j)=>j>=cursor && norm(f.speaker)===norm(speech[1]) && norm(f.text).slice(0,16)===norm(speech[2]).slice(0,16));
    if (idx<0) idx=cursor;
    const f=falas[idx]; if (!f) continue;
    cursor=idx+1;
    if (pendingText) { textCues.push({t:f.start,text:pendingText.toUpperCase()}); pendingText=null; }
    if (pendingHud) { hudCues.push({t:f.start,text:pendingHud}); pendingHud=null; }
  }
}
function validateBeats() {
  for (const b of beats) {
    if (!Number.isFinite(b.t0) || !Number.isFinite(b.t1) || b.t1 <= b.t0) throw new Error(`Beat inválido em t=${b.t0}`);
    for (const a of b.atores || []) {
      if (!ACTOR_FILES[a.nome] || !ACTIONS[a.acao]) throw new Error(`Ator/ação inválido: ${a.nome}/${a.acao}`);
      for (const key of ['de','para']) if (a[key] && !PONTOS[a[key]]) throw new Error(`Ponto desconhecido: ${a[key]}`);
    }
    for (const z of b.zumbis || []) {
      if (!z.id || !ZOMBIE_FILES[z.modelo] || !Z_ACTIONS[z.acao]) throw new Error(`Zumbi inválido: ${z.id}/${z.modelo}/${z.acao}`);
      for (const key of ['de','para']) if (z[key] && !PONTOS[z[key]]) throw new Error(`Ponto desconhecido: ${z[key]}`);
    }
  }
}

const BLUSH_REGEX = /blush|rubor|cheek|shy|tereru|flush|hoho|embarrass|redface|赤|照れ|頬/i;
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
    } catch (e) {
      console.error('FBX falhou', url, e && e.message);
    }
  }
  return null;
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


const groundRay = new T.Raycaster();
const DOWN = new T.Vector3(0, -1, 0);
const _nrmMat = new T.Matrix3();
const _nrm = new T.Vector3();
function findGroundY(x, y, z, solids) {
  groundRay.set(new T.Vector3(x, y + 0.35, z), DOWN);
  groundRay.near = 0;
  groundRay.far = 0.75;
  const hits = groundRay.intersectObjects(solids, false);
  let bestY = null, bestDiff = Infinity;
  for (const h of hits) {
    if (h.face) {
      _nrmMat.getNormalMatrix(h.object.matrixWorld);
      _nrm.copy(h.face.normal).applyMatrix3(_nrmMat).normalize();
      if (Math.abs(_nrm.y) < 0.5) continue;
    }
    const hy = h.point.y;
    if (hy <= y + 0.35 && y - hy <= 0.4) {
      const diff = Math.abs(hy - y);
      if (diff < bestDiff) { bestDiff = diff; bestY = hy; }
    }
  }
  return bestY;
}

// Planejador sem teleporte: só desloca se existir caminho que caiba no tempo ou atrás de corte_preto.
function routeSample(route, traveled) {
  let left = Math.max(0,traveled);
  for (let i=1; i<route.length; i++) {
    const d=dist(route[i-1],route[i]);
    if (left <= d || i===route.length-1) {
      const u=clamp(left/(d||1),0,1);
      return {pos:mix(route[i-1],route[i],u),edge:i, yaw:Math.atan2(route[i][0]-route[i-1][0],route[i][2]-route[i-1][2])};
    }
    left-=d;
  }
  return {pos:route[0],edge:0,yaw:0};
}
function samplePlan(plans, t) {
  if (!plans?.length || t < plans[0].t0) return null;
  let p=plans[0];
  for (const item of plans) { if (item.t0 <= t) p=item; else break; }
  if (p.jumpPos && t >= p.jumpAt) {
    return {pos:[...p.jumpPos], edge:0, yaw:p.jumpYaw ?? p.yaw, plan:p, traveled:0};
  }
  const traveled=Math.min(p.length,Math.max(0,Math.min(t,p.t1)-p.t0)*p.speed);
  const sample=routeSample(p.route,traveled);
  if (p.route.length===1) sample.yaw=p.yaw;
  return {...sample, plan:p, traveled};
}
function nearZombie(a,b,t0,t1) {
  const d=dist(a,b), count=Math.max(4,Math.ceil(d/.35));
  for (let k=0;k<=count;k++) {
    const q=mix(a,b,k/count);
    for (let j=0;j<=Math.max(1,Math.ceil((t1-t0)/.4));j++) {
      const t=t0+(t1-t0)*j/Math.max(1,Math.ceil((t1-t0)/.4));
      for (const plans of zombiePlans.values()) {
        const z=samplePlan(plans,t); if (!z) continue;
        if (Math.abs(q[1]-z.pos[1])<1.8 && Math.hypot(q[0]-z.pos[0],q[2]-z.pos[2])<2) return true;
      }
    }
  }
  return false;
}
const PORTAS=Object.entries(PONTOS).filter(([name])=>name.includes('_porta'));
const DOOR_FACE=Object.freeze({
  varanda_porta:[1.25,0,-4.98], cozinha_porta:[7.8,0,4.86],
  porao_porta_aco_fora:[-4,-4,5.0], porao_porta_aco_dentro:[-4,-4,5.0],
  porao_porta_garagem:[5.5,-4,10], garagem_porta:[5.5,-4,10],
  garagem_portao:[11.2,-4,14.82], bunker_porta:[0.65,-8,6.21],
});
function proximo(p,lista,raio) {
  return lista.filter(([,q])=>dist(p,q)<=raio).sort((a,b)=>dist(p,a[1])-dist(p,b[1]))[0] || null;
}
function compileEntity(direction, previous, beat, isZombie, seed, speechState) {
  const isBlackCut = (beat.fx || []).includes('corte_preto');
  const startName = direction.de || (isZombie ? 'varanda_fora' : 'sala_centro');
  const start = previous || { pos: [...PONTOS[startName]], node: startName, next: null, yaw: 0, crouched: false };
  let acao = direction.acao, olhar = direction.olha;
  let crouched = !isZombie && Boolean(start.crouched);
  if (!isZombie) {
    if (CROUCH_ENTER.has(acao)) crouched = true;
    else if (CROUCH_EXIT.has(acao)) crouched = false;
  }
  const rawEmo = direction.emocao && EMOCOES.has(direction.emocao) ? direction.emocao : null;
  const dur = Math.max(0.001, beat.t1 - beat.t0);
  const lookAngle = (from, target) => Math.atan2(target[0] - from[0], target[2] - from[2]);

  // Atrás de corte_preto a tela está preta: pode saltar para o destino sem teleporte visível.
  if (isBlackCut) {
    const jumpNode = direction.para || (previous ? direction.de : null) || start.node;
    const endPos = [...PONTOS[jumpNode]];
    const jumped = jumpNode !== start.node || dist(start.pos, endPos) > 0.02;
    const motion = isZombie ? 'zombie_idle' : (crouched ? 'kneeling' : 'idle');
    const lookTarget = PONTOS[olhar];
    const endYaw = lookTarget ? lookAngle(endPos, lookTarget) : start.yaw;
    const plan = {
      t0: beat.t0, t1: beat.t1, route: [[...start.pos]], length: 0, speed: 0,
      motion, acao, yaw: start.yaw,
      jumpPos: jumped ? endPos : null, jumpAt: (beat.t0 + beat.t1) * 0.5, jumpYaw: endYaw,
      olha: olhar, beat, model: direction.modelo, crouched, emocao: rawEmo, subtleSpeak: false,
    };
    return { plan, state: { pos: endPos, node: jumpNode, next: null, motion, yaw: endYaw, crouched } };
  }

  const wantsMove = Boolean(direction.para && (direction.para !== start.node || dist(start.pos, PONTOS[direction.para]) > 0.05));
  const blocked = (a, b) =>
    (isZombie && beat.t0 < shatterAt &&
      ((a === 'sala_vidro' && b === 'varanda_porta') || (b === 'sala_vidro' && a === 'varanda_porta'))) ||
    (!isZombie && nearZombie(PONTOS[a], PONTOS[b], beat.t0, beat.t1));

  let best = null;
  if (wantsMove) {
    const names = caminhoMaisCurto(start.node, direction.para, blocked);
    if (names) {
      const route = [[...start.pos], ...names.slice(1).map(x => [...PONTOS[x]])];
      const length = route.slice(1).reduce((n, p, i) => n + dist(route[i], p), 0);
      best = { route, routeNames: names, length };
    }
  }

  let doorTarget = null;
  if (!isZombie && (acao === 'empurrar' || acao === 'abrir_porta')) {
    const porta = proximo(start.pos, PORTAS, 1.2);
    if (porta) {
      doorTarget = DOOR_FACE[porta[0]] || porta[1];
      if (!olhar || !String(olhar).includes('_porta')) olhar = porta[0];
    } else {
      acao = 'olhar_em_volta';
    }
  }

  const maxSpeed = acao === 'correr' ? 3.5 :
    ['agachar_andando', 'esconder', 'rastejar'].includes(acao) ? 0.7 : 1.3;
  const fitsInTime = Boolean(best && best.length <= maxSpeed * dur + 1e-4);
  const moving = wantsMove && fitsInTime && best.length > 0.02;
  const moveFailed = wantsMove && !fitsInTime;

  const route = moving ? best.route : [[...start.pos]];
  const length = moving ? best.length : 0;
  const speed = moving ? length / dur : 0;
  const endNode = moving ? direction.para : start.node;
  const endPos = moving ? [...PONTOS[direction.para]] : [...start.pos];

  let motion, subtleSpeak = false;
  let faceGlass = false;
  if (isZombie) {
    if (moving) {
      const pool = Z_LOCOMOTION.has(acao) ? Z_ACTIONS[acao] : Z_ACTIONS.andar;
      motion = pick(pool, previous?.motion, seed);
    } else if (moveFailed) {
      if (beat.t0 < shatterAt && dist(start.pos, PONTOS.varanda_porta) < 0.85) {
        acao = 'bater_vidro'; olhar = 'sala_vidro'; faceGlass = true;
        motion = 'zombie_attack';
      } else {
        motion = 'zombie_idle';
      }
    } else {
      // Zumbi sem `para` fica parado no lugar (idle, farejando ou batendo), sem andar sozinho.
      motion = Z_LOCOMOTION.has(acao) ? 'zombie_idle' : pick(Z_ACTIONS[acao], previous?.motion, seed);
      if (acao === 'bater_vidro' && dist(start.pos, PONTOS.varanda_porta) < 1.6) faceGlass = true;
    }
  } else {
    if (moveFailed) {
      motion = crouched ? 'kneeling' : 'idle';
    } else if (moving) {
      if (crouched) motion = pick(['crouched_walking', 'sneak_walk'], previous?.motion, seed);
      else if (LOCOMOTION.has(acao)) motion = pick(ACTIONS[acao], previous?.motion, seed);
      else motion = pick(ACTIONS.andar, previous?.motion, seed);
    } else if (crouched) {
      motion = (acao === 'ajoelhar' && !start.crouched) ? 'kneeling_down' : 'kneeling';
      if (acao === 'falar') subtleSpeak = true;
    } else if (acao === 'falar') {
      const sp = pickSpeechMotion(falas.find(f => f.start <= beat.t0 && f.end > beat.t0), previous?.motion, seed, speechState);
      motion = sp.motion; subtleSpeak = sp.subtleSpeak;
    } else if (acao === 'ouvir' || LOCOMOTION.has(acao)) {
      motion = 'idle';
    } else {
      motion = pick(ACTIONS[acao], previous?.motion, seed);
    }
  }

  const initialLook = doorTarget || (faceGlass ? PONTOS.sala_vidro : PONTOS[olhar]);
  const yaw = (doorTarget || faceGlass) && initialLook
    ? lookAngle(start.pos, initialLook)
    : previous?.yaw ?? (initialLook ? lookAngle(start.pos, initialLook) : 0);
  const plan = {
    t0: beat.t0, t1: beat.t1, route, length, speed, motion, acao, yaw,
    olha: olhar, beat, model: direction.modelo, crouched, emocao: rawEmo, subtleSpeak,
  };
  const endSample = moving ? routeSample(route, length) : { pos: endPos, yaw };
  return {
    plan,
    state: { pos: endPos, node: endNode, next: null, motion, yaw: moving ? endSample.yaw : yaw, crouched },
  };
}
function compilePlans() {
  const zState=new Map(), aState=new Map();
  const speechState = { count: 0, lastUsed: new Map() };
  for (const b of beats) for (const z of b.zumbis||[]) {
    if (zState.has(z.id) && zState.get(z.id).model!==z.modelo) throw new Error(`Modelo de ${z.id} mudou entre beats`);
    const old=zState.get(z.id)?.state;
    const r=compileEntity(z,old,b,true,b._i*31+z.id.length*7,speechState);
    zState.set(z.id,{state:r.state,model:z.modelo});
    if (!zombiePlans.has(z.id)) zombiePlans.set(z.id,[]);
    zombiePlans.get(z.id).push(r.plan);
  }
  for (const b of beats) for (const a of b.atores||[]) {
    const r=compileEntity(a,aState.get(a.nome),b,false,b._i*37+a.nome.length*11,speechState);
    aState.set(a.nome,r.state);
    if (!actorPlans.has(a.nome)) actorPlans.set(a.nome,[]);
    actorPlans.get(a.nome).push(r.plan);
  }
}
const REST_BONES = ['hips','spine','chest','upperChest','neck','head','leftShoulder','rightShoulder'];
async function loadActor(name) {
  const loader=new GLTFLoader(); loader.register(parser=>new VRMLoaderPlugin(parser));
  const gltf=await loader.loadAsync(asset(ACTOR_FILES[name]));
  const vrm=gltf.userData.vrm;
  if (!vrm) throw new Error(`${name}: VRM inválido`);
  if (vrm.meta?.metaVersion==='0') VRMUtils.rotateVRM0(vrm);
  const actor={name,vrm,actions:{},forbiddenMorphs:[],baseYaw:vrm.scene.rotation.y,
    vrmSign:vrm.meta?.metaVersion==='0'?-1:1,restPose:{}};
  for (const bk of REST_BONES) {
    const node=vrm.humanoid?.getNormalizedBoneNode(bk);
    if (node) actor.restPose[bk]={node,q:node.quaternion.clone(),p:node.position.clone()};
  }
  sanitizeActorVRM(actor); scene.add(vrm.scene);
  const hand=vrm.humanoid.getNormalizedBoneNode('rightHand');
  if (hand) {
    const phone=new T.Group();
    const body=new T.Mesh(new T.BoxGeometry(.075,.145,.013),
      new T.MeshStandardMaterial({color:'#050609',roughness:.3}));
    const screen=new T.Mesh(new T.BoxGeometry(.061,.126,.002),
      new T.MeshBasicMaterial({color:'#142332'}));
    body.frustumCulled=false;screen.frustumCulled=false;
    screen.position.z=.008;phone.add(body,screen);
    phone.position.set(0,-.055,.03);phone.rotation.set(-.35,0,.25);
    hand.add(phone);actor.phone=phone;phone.visible=false;
  }
  actor.mixer=new T.AnimationMixer(vrm.scene);
  actor.gaze=new T.Object3D(); scene.add(actor.gaze);
  if (vrm.lookAt) vrm.lookAt.target=actor.gaze;
  const needed=new Set(['idle',...actorPlans.get(name).map(p=>p.motion)]);
  const files=[...needed];
  for (let i=0;i<files.length;i+=5) await Promise.all(files.slice(i,i+5).map(async key=>{
    const clip=await loadMixamoAnimation(asset(`mixamo/${key}.fbx`),vrm);
    for (const track of clip.tracks) if (track.name.endsWith('.position')) {
      const first=track.values.slice(0,3);
      for (let j=0;j<track.values.length;j+=3) {
        track.values[j]=first[0]; track.values[j+2]=first[2];
        if (/walk|run|jog|stair|sneak|crouch/.test(key)) track.values[j+1]=first[1];
      }
    }
    actor.actions[key]=actor.mixer.clipAction(clip);
  }));
  actors.set(name,actor);
}
async function loadZombie(id,modelName,rawClips,refY) {
  const model=await new FBXLoader().loadAsync(asset(`mixamo/zumbis/${ZOMBIE_FILES[modelName]}`));
  fixZombieMaterials(model); model.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(model), height=box.max.y-box.min.y;
  model.scale.setScalar(1.75/(height>0.1&&height<5000?height:175));
  model.updateMatrixWorld(true);
  const scaled=new T.Box3().setFromObject(model); model.position.y-=scaled.min.y;
  const group=new T.Group(); group.add(model); scene.add(group);
  const z={id,modelName,model,group,mixer:new T.AnimationMixer(model),actions:{}};
  const needed=new Set(zombiePlans.get(id).map(p=>p.motion));
  needed.add('zombie_idle');
  for (const key of needed) {
    const raw=rawClips[key]; if (!raw) throw new Error(`Animação zumbi ausente: ${key}`);
    const clip=adaptClipForZombie(raw,model,key,refY);
    z.actions[key]=z.mixer.clipAction(clip);
  }
  zombies.set(id,z);
}
async function loadCharacters() {
  const needed=new Set(['zombie_idle']);
  for (const plans of zombiePlans.values()) for (const p of plans) needed.add(p.motion);
  const rawClips={};
  await Promise.all([...needed].map(async key=>{
    const clip=await loadFirstAvailableClip([asset(`mixamo/pack_zumbi/${Z_FILES[key]}.fbx`)]);
    if (!clip) throw new Error(`Não carregou ${key}.fbx`);
    rawClips[key]=clip;
  }));
  const refY=getClipHipsY(rawClips.zombie_idle)||95;
  await Promise.all([
    ...[...actorPlans.keys()].map(loadActor),
    ...[...zombiePlans.keys()].map(id=>loadZombie(id,zombiePlans.get(id)[0].model,rawClips,refY)),
  ]);
}

function absoluteAction(entity,plans,t) {
  if (!plans?.length) return;
  let idx=0; for (let i=0;i<plans.length;i++) if (plans[i].t0<=t) idx=i;
  const p=plans[idx], prev=idx>0?plans[idx-1]:null;
  const blend=prev && p.motion!==prev.motion ? smooth(p.t0,p.t0+.35,t):1;
  for (const action of Object.values(entity.actions)) action.stop();
  const apply=(name,weight,elapsed,plan)=>{
    const action=entity.actions[name] || entity.actions.idle || entity.actions.zombie_idle;
    if (!action || weight<=0) return;
    const nominal=plan.acao==='correr'?3.5:plan.acao==='agachar_andando'||plan.acao==='rastejar'?.7:1.3;
    const rate=plan.speed && (LOCOMOTION.has(plan.acao)||plan.acao==='rastejar')?
      clamp(plan.speed/nominal,.3,1.5):1;
    const once=ONE_SHOT.has(name);
    action.reset(); action.setLoop(once?T.LoopOnce:T.LoopRepeat,Infinity);
    action.clampWhenFinished=once;
    action.setEffectiveWeight(weight); action.setEffectiveTimeScale(1);
    const duration=Math.max(.05,action.getClip().duration);
    action.play(); action.time=once?clamp(elapsed*rate,0,duration-.002):Math.max(0,elapsed*rate)%duration;
  };
  apply(p.motion,blend,t-p.t0,p);
  if (blend<1 && prev) apply(prev.motion,1-blend,t-prev.t0,prev);
  entity.mixer.update(0);
}
function focusPosition(key) {
  if (PONTOS[key]) return vec(PONTOS[key]).add(new T.Vector3(0,1.4,0));
  const a=actors.get(key);
  if (a) return headPosition(a);
  const z=zombies.get(key);
  if (z) return z.group.position.clone().add(new T.Vector3(0,1.5,0));
  return null;
}
function headPosition(actor) {
  actor.vrm.scene.updateMatrixWorld(true);
  const head=actor.vrm.humanoid.getNormalizedBoneNode('head');
  return head?head.getWorldPosition(new T.Vector3()):actor.vrm.scene.position.clone().add(new T.Vector3(0,1.48,0));
}
function effectiveEmotion(plan, beat) {
  if (plan?.emocao) return plan.emocao;
  const fx = beat?.fx || [];
  if (HIGH_DANGER_ACTIONS.has(plan?.acao) || fx.includes('vidro_quebrado')) return 'medo';
  return 'tensa';
}
const _postureQ = new T.Quaternion();
const _postureE = new T.Euler();
function resetActorRestPose(actor) {
  for (const r of Object.values(actor.restPose || {})) {
    r.node.quaternion.copy(r.q);
    r.node.position.copy(r.p);
  }
}
function applyActorPosture(actor, plan, beat, t, line) {
  if (!plan) return;
  const sgn = actor.vrmSign || 1;
  const deg = T.MathUtils.degToRad;
  const seed = actor.name.length * 1.37 + actor.name.charCodeAt(0) * 0.13;
  const rotBone = (bk, rx, ry, rz) => {
    const node = actor.restPose?.[bk]?.node;
    if (!node) return;
    _postureQ.setFromEuler(_postureE.set(rx, ry, rz, 'XYZ'));
    node.quaternion.multiply(_postureQ);
  };
  const emo = effectiveEmotion(plan, beat);
  if (emo === 'medo') {
    const br = Math.sin(t * 5.8 + seed);
    rotBone('spine', sgn * deg(8), 0, 0);
    rotBone('chest', sgn * deg(br * 2.4), 0, 0);
    rotBone('leftShoulder', sgn * deg(4), -deg(8), sgn * deg(5 + br * 2.0));
    rotBone('rightShoulder', sgn * deg(4), deg(8), -sgn * deg(5 + br * 2.0));
  } else if (emo === 'tensa') {
    const br = Math.sin(t * 3.1 + seed);
    rotBone('chest', sgn * deg(br * 1.4), 0, 0);
    rotBone('leftShoulder', 0, -deg(2.5), sgn * deg(1.5 + br * 0.8));
    rotBone('rightShoulder', 0, deg(2.5), -sgn * deg(1.5 + br * 0.8));
  } else if (emo === 'triste') {
    const br = Math.sin(t * 1.8 + seed);
    rotBone('spine', sgn * deg(4), 0, 0);
    rotBone('chest', sgn * deg(br * 1.2), 0, 0);
    rotBone('head', sgn * deg(5.5), 0, 0);
  } else {
    const br = Math.sin(t * 1.7 + seed);
    rotBone('chest', sgn * deg(br * 1.1), 0, 0);
  }
  const speakingNow = String(line?.speaker || '').toUpperCase() === actor.name;
  if (plan.subtleSpeak && (speakingNow || plan.acao === 'falar')) {
    const activeWord = speakingNow && words.some(w => String(w.speaker).toUpperCase() === actor.name && w.start <= t && w.end > t);
    const env = activeWord ? 1 : (speakingNow ? 0.55 : 0.28);
    const nod = (Math.sin(t * 4.4 + seed) * 3.8 + Math.sin(t * 2.1 + seed * 2) * 1.8) * env;
    const tilt = Math.sin(t * 1.35 + seed * 3) * 3.5 * env;
    const turn = Math.sin(t * 1.9 + seed * 5) * 2.2 * env;
    rotBone('head', sgn * deg(nod), deg(turn), sgn * deg(tilt));
    rotBone('neck', sgn * deg(nod * 0.35), deg(turn * 0.3), sgn * deg(tilt * 0.3));
  }
  // Correção fixa de postura só na BIA (evita inclinação para trás).
  if (actor.name === 'BIA') {
    rotBone('hips', -sgn * deg(3.5), 0, 0);
    if (actor.restPose?.hips?.node) actor.restPose.hips.node.position.z -= sgn * 0.025;
    rotBone('spine', sgn * deg(7), 0, 0);
    rotBone('chest', sgn * deg(6.5), 0, 0);
  }
}
function expression(actor,t,line,plan,beat) {
  const ex=actor.vrm.expressionManager; if (!ex) return;
  const speaking=String(line?.speaker||'').toUpperCase()===actor.name;
  const word=speaking?words.find(w=>String(w.speaker).toUpperCase()===actor.name&&w.start<=t&&w.end>t):null;
  const mouth=mouthFor(word,t);
  const emo=effectiveEmotion(plan,beat);
  const seed=actor.name.length*1.7;
  let surprised=0, fear=0, sad=0, angry=0, happy=0, relaxed=0;
  if (emo==='medo') {
    surprised=0.46+0.12*(0.5+0.5*Math.sin(t*2.4+seed));
    fear=0.52;
    sad=0.16;
  } else if (emo==='tensa') {
    angry=0.25;
    sad=0.22;
    surprised=0.08;
  } else if (emo==='triste') {
    sad=0.52;
    angry=0.05;
  } else {
    relaxed=0.35;
    happy=0.22;
  }
  if (plan?.acao==='gritar') { surprised=Math.max(surprised,0.55); angry=Math.max(angry,0.3); }
  if (plan?.acao==='chorar') sad=Math.max(sad,0.6);
  if (plan?.acao==='rir_nervoso') happy=Math.max(happy,0.3);
  const blinkCycle=emo==='medo'?4.6:3.4;
  const blink=Math.max(0,1-Math.abs((t+hash(actor.name.length)*3)%blinkCycle-2.25)/.085)*(emo==='medo'?.45:.7);
  for (const [key,val] of Object.entries({aa:mouth[0],ih:mouth[1],ou:mouth[2],
    surprised,fear,sad,angry,happy,relaxed,blink})) setExpr(ex,key,val);
  for (const fm of actor.forbiddenMorphs) fm.mesh.morphTargetInfluences[fm.index]=0;
}
function updateGaze(actor,plan,t) {
  const target=plan?.olha==='camera'?camera.position.clone():focusPosition(plan?.olha);
  const current=headPosition(actor);
  if (target) actor.gaze.position.copy(target);
  else actor.gaze.position.copy(current).add(new T.Vector3(Math.sin(actor.currentYaw)*4,0,Math.cos(actor.currentYaw)*4));
  const tick=Math.floor(t*2.7), seed=actor.name.length;
  actor.gaze.position.x+=(hash(tick*17+seed)-.5)*.16;
  actor.gaze.position.y+=(hash(tick*29+seed)-.5)*.1;
}
let lastCameraTarget='', lastCameraLocal='';
function citadoNaFala(line,t) {
  if (!line || t<line.start || t>=line.start+1.55) return null;
  const texto=String(line.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const termos=[
    [/\bluna\b/,'LUNA'],[/\bbia\b/,'BIA'],[/\bantony\b/,'ANTONY'],
    [/\bgarota(?:\s+(?:zumbi|infectada))?\b/,'zombiegirl'],
    [/\bpolicial\b|\bpoliciais\b/,'copzombie'],
    [/\bcorredor(?:es)?\b/,'yaku'],[/\binfectad[oa]s?\b|\bzumbis?\b/,'nearestZombie'],
  ];
  const encontrados=termos.map(([rx,id])=>({indice:texto.search(rx),id})).filter(x=>x.indice>=0)
    .sort((a,b)=>a.indice-b.indice);
  for (const item of encontrados) {
    let key=item.id;
    if (key==='nearestZombie') {
      const meninas=[...actors.values()].filter(a=>['LUNA','BIA'].includes(a.name)&&a.vrm.scene.visible);
      const vivos=[...zombies.values()].filter(z=>z.group.visible && samplePlan(zombiePlans.get(z.id),t));
      const distMeninas=z=>meninas.length?Math.min(...meninas.map(g=>g.vrm.scene.position.distanceTo(z.group.position))):0;
      vivos.sort((a,b)=>distMeninas(a)-distMeninas(b) || a.id.localeCompare(b.id));
      key=vivos[0]?.id;
    } else if (key===key.toLowerCase()) {
      key=[...zombies.values()].find(z=>z.modelName===key&&z.group.visible&&samplePlan(zombiePlans.get(z.id),t))?.id;
    }
    if (key && (actors.has(key)?actors.get(key).vrm.scene.visible&&samplePlan(actorPlans.get(key),t):
      zombies.has(key)&&zombies.get(key).group.visible&&samplePlan(zombiePlans.get(key),t))) return key;
  }
  return null;
}
function limiteCamera(pos,local) {
  const b=BOUNDS[local];
  if (!b) return pos;
  return new T.Vector3(...pos.toArray().map((v,i)=>clamp(v,b.min[i]+.08,b.max[i]-.08)));
}
const ZOMBIE_CAM_MIN_DIST = 1.42;
function minDistToZombies(pos) {
  let minD = Infinity;
  for (const z of zombies.values()) {
    if (!z.group.visible) continue;
    const zHead = z.group.position.clone().add(new T.Vector3(0, 1.5, 0));
    const zMid = z.group.position.clone().add(new T.Vector3(0, 1.0, 0));
    minD = Math.min(minD, pos.distanceTo(zHead), pos.distanceTo(zMid));
  }
  return minD;
}
function enforceZombieCameraClearance(pos, target, local, visibleSolids) {
  let cur = pos.clone();
  const visibleZ = [...zombies.values()].filter(z => z.group.visible);
  if (!visibleZ.length) return cur;
  let pullDir = cur.clone().sub(target);
  if (pullDir.lengthSq() < 1e-4) pullDir.set(0, 0, 1);
  else pullDir.normalize();
  for (let pass = 0; pass < 3; pass++) {
    let pushed = false;
    for (const z of visibleZ) {
      for (const hOff of [1.5, 1.0]) {
        const zPt = z.group.position.clone().add(new T.Vector3(0, hOff, 0));
        const v = cur.clone().sub(zPt);
        const d = v.length();
        if (d >= ZOMBIE_CAM_MIN_DIST) continue;
        // Recua ao longo do vetor alvo→câmera respeitando as paredes.
        const b = v.dot(pullDir);
        const c = d * d - ZOMBIE_CAM_MIN_DIST * ZOMBIE_CAM_MIN_DIST;
        const disc = b * b - c;
        const needed = disc >= 0 ? Math.max(0.05, -b + Math.sqrt(disc)) : (ZOMBIE_CAM_MIN_DIST - d + 0.1);
        const tryPush = (dir, distReq) => {
          ray.set(cur, dir); ray.near = 0.05; ray.far = distReq + 0.3;
          const hit = ray.intersectObjects(visibleSolids, false)[0];
          const allowed = hit ? Math.max(0, hit.distance - 0.3) : distReq;
          return limiteCamera(cur.clone().addScaledVector(dir, allowed), local);
        };
        let bestCand = tryPush(pullDir, needed);
        let bestClear = minDistToZombies(bestCand);
        if (bestClear < ZOMBIE_CAM_MIN_DIST - 0.02) {
          for (const ang of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
            const altDir = pullDir.clone().applyAxisAngle(new T.Vector3(0, 1, 0), ang).normalize();
            const cand = tryPush(altDir, needed + 0.2);
            const clear = minDistToZombies(cand);
            if (clear > bestClear + 0.02) { bestCand = cand; bestClear = clear; }
          }
        }
        cur.copy(bestCand);
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  return cur;
}
function cameraFor(t,beat,line) {
  const cfg=beat?.cam||{};
  const isBlackCut=(beat?.fx||[]).includes('corte_preto');
  const isSpecialPlano=cfg.plano==='destaque'||cfg.plano==='silhueta';
  const defaultTarget=String(line?.speaker||'').toUpperCase();
  const citado=(isSpecialPlano||isBlackCut)?null:citadoNaFala(line,t);
  const overrideCitado=Boolean(citado && citado!==cfg.alvo);
  const key=(overrideCitado ? citado : null)||cfg.alvo||
    (actors.has(defaultTarget)?defaultTarget:[...actors.keys()][0]) || [...zombies.keys()][0];
  const target=focusPosition(key)||new T.Vector3(0,1.5,0);
  const local=localDoPonto(target.toArray(),PONTOS[key]?key:'');
  lastCameraTarget=key;lastCameraLocal=local;
  const subject=actors.get(key)||zombies.get(key);
  const isZombieTarget=zombies.has(key);
  let yaw=subject?.currentYaw ?? 0;
  scene.updateMatrixWorld(true);
  const side=cfg.lado==='esq'?-1:1;
  const kind=overrideCitado?(cfg.plano==='close'?'close':'medio'):(cfg.plano||'medio');
  const isDestaque=kind==='destaque';
  const isSilhueta=kind==='silhueta';
  if (!overrideCitado && kind==='pov_zumbi') {
    const z=(zombies.get(cfg.alvo)?.group.visible?zombies.get(cfg.alvo):null) ||
      [...zombies.values()].find(x=>x.group.visible);
    if (z) { const at=z.group.position.clone().add(new T.Vector3(0,1.55,0));
      const look=focusPosition(cfg.alvo)||target;
      const direction=look.clone().sub(at),length=direction.length();
      if (length>.3) {
        ray.set(at,direction.normalize());ray.near=.12;ray.far=length;
        if (!ray.intersectObjects(solidWorld.filter(x=>x.visible),false).length) {
          placeCamera(at,look,beat,42,true,localDoPonto(at.toArray()));
          return {target:look,key,local,kind,isDestaque:false,isSilhueta:false,side};
        }
      }
    }
  }
  const baseDistance={aberto:6,medio:3,close:1.45,ombro:2.3,detalhe:.85,destaque:1.3,silhueta:2.4}[kind]||3;
  const distance=isZombieTarget?Math.max(baseDistance,1.65):baseDistance;
  const height={aberto:.65,medio:.15,close:0,ombro:.05,detalhe:-.1,destaque:0,silhueta:-.14}[kind]||0;
  const baseAngle=isSilhueta?0:yaw;
  const offsets=isSilhueta
    ?[0,side*.32,-side*.32,side*.68,-side*.68,side*1.2,-side*1.2,Math.PI]
    :kind==='ombro'
      ?[side*.55,-side*.55,0,side*1.4,-side*1.4,side*2.3,-side*2.3]
      :[side*.24,-side*.24,side*.8,-side*.8,0,side*1.5,-side*1.5,side*2.3,-side*2.3,Math.PI];
  const fov=isDestaque?40:kind==='close'?43:isSilhueta?46:50;
  let best=null, bestScore=-Infinity;
  const visibleSolids=solidWorld.filter(x=>x.visible);
  const destaqueLook = (camPos) => {
    const lookTarget = target.clone();
    if (isDestaque) {
      const fwd = target.clone().sub(camPos); fwd.y = 0;
      if (fwd.lengthSq() > 1e-4) {
        fwd.normalize();
        const right = new T.Vector3(-fwd.z, 0, fwd.x);
        lookTarget.addScaledVector(right, side * (vertical ? 0.06 : 0.22));
      }
    }
    return lookTarget;
  };
  for (const offset of offsets) {
    const a=baseAngle+offset;
    const candidate=limiteCamera(target.clone().add(new T.Vector3(Math.sin(a)*distance,height,Math.cos(a)*distance)),local);
    const from=target.clone(), direction=candidate.clone().sub(from);
    const length=direction.length();
    if (length<=.01) continue;
    ray.set(from,direction.normalize()); ray.near=.12; ray.far=length;
    const hit=ray.intersectObjects(visibleSolids,false)[0];
    const possible=hit?from.clone().addScaledVector(direction,Math.max(.05,hit.distance-.3)):candidate;
    const available=possible.distanceTo(target);
    const zClear=minDistToZombies(possible);
    if (!hit && zClear>=ZOMBIE_CAM_MIN_DIST) {
      placeCamera(possible,destaqueLook(possible),beat,fov,false,local);
      return {target,key,local,kind,isDestaque,isSilhueta,side};
    }
    const score=(zClear>=ZOMBIE_CAM_MIN_DIST?10:zClear*4)+available-(hit?2:0);
    if (score>bestScore) { best={pos:possible,target}; bestScore=score; }
  }
  const chosenPos=best?.pos||target.clone().add(new T.Vector3(0,.1,isZombieTarget?1.65:.5));
  placeCamera(chosenPos,destaqueLook(chosenPos),beat,fov,false,local);
  return {target,key,local,kind,isDestaque,isSilhueta,side};
}
function placeCamera(pos,target,beat,fov,pov,local) {
  const visibleSolids=solidWorld.filter(x=>x.visible);
  const bounded=limiteCamera(pos,local);
  const vector=bounded.clone().sub(target),length=vector.length();
  if (length>.01) {
    ray.set(target,vector.normalize());ray.near=.08;ray.far=length;
    const hit=ray.intersectObjects(visibleSolids,false)[0];
    if (hit) bounded.copy(target).addScaledVector(vector,Math.max(.05,hit.distance-.3));
  }
  let finalPos=limiteCamera(bounded,local);
  if (!pov) finalPos=enforceZombieCameraClearance(finalPos,target,local,visibleSolids);
  camera.position.copy(finalPos);
  if (!pov && (beat?.fx||[]).includes('tremor')) {
    const q=Math.sin(beat.t0*53+pos.x*7)*.018;
    camera.position.x+=q;
  }
  camera.position.copy(limiteCamera(camera.position,local));
  camera.up.set(0,1,0); camera.lookAt(target);
  camera.fov=fov; camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return target;
}
function currentBeatIndex(t) {
  let active=-1;
  for (let i=0;i<beats.length;i++) { if (beats[i].t0<=t) active=i; else break; }
  return active;
}
function currentBeat(t) {
  const idx=currentBeatIndex(t);
  return idx>=0?beats[idx]:null;
}
function lineAt(t) { return falas.find(f=>f.start<=t&&f.end>t)||null; }
function wrap(text,maxWidth) {
  const out=[]; let row='';
  for (const word of text.split(/\s+/)) {
    const next=row?`${row} ${word}`:word;
    if (row && ctx.measureText(next).width>maxWidth) {out.push(row);row=word;} else row=next;
  }
  if (row) out.push(row); return out;
}
const PT_STOPWORDS = new Set(['A','O','AS','OS','UM','UMA','UNS','UMAS','DE','DO','DA','DOS','DAS','EM','NO','NA','NOS','NAS','E','OU','QUE','SE','POR','PARA','PRA','COM','SEM','AO','AOS','À','ÀS','É','ERA','SÃO','FOI','MAS','JÁ','SÓ','TÁ','PRO','PELO','PELA','NUM','NUMA']);
function pickRedWordIndex(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const clean = tokens[i].replace(/[^\p{L}\p{N}]/gu, '');
    if (clean.length >= 3 && !PT_STOPWORDS.has(clean)) return i;
  }
  return Math.max(0, tokens.length - 1);
}
function drawDestaqueText(rawText, faceX, faceY, alpha) {
  const text = String(rawText || '').trim().toUpperCase();
  if (!text) return;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return;
  const redIdx = pickRedWordIndex(tokens);
  const margin = vertical ? 54 : 88;
  const placeRight = faceX <= W * 0.5;
  const sideGap = Math.min(W, H) * (vertical ? 0.16 : 0.19);
  let xLeft, xRight, align;
  if (placeRight) {
    xLeft = clamp(faceX + sideGap, W * 0.44, W * 0.58);
    xRight = W - margin;
    align = 'left';
  } else {
    xLeft = margin;
    xRight = clamp(faceX - sideGap, W * 0.42, W * 0.56);
    align = 'right';
  }
  const availW = Math.max(240, xRight - xLeft);
  let size = vertical ? 76 : 96;
  let rows = [];
  const buildRows = (fontSize, targetW) => {
    ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
    const out = []; let cur = [], curW = 0;
    const spaceW = ctx.measureText(' ').width;
    for (let i = 0; i < tokens.length; i++) {
      const w = ctx.measureText(tokens[i]).width;
      const nextW = cur.length ? curW + spaceW + w : w;
      if (cur.length && nextW > targetW) {
        out.push(cur); cur = [{ word: tokens[i], isRed: i === redIdx, w }]; curW = w;
      } else {
        cur.push({ word: tokens[i], isRed: i === redIdx, w }); curW = nextW;
      }
    }
    if (cur.length) out.push(cur);
    return out;
  };
  for (; size >= 44; size -= 4) {
    let targetW = availW;
    rows = buildRows(size, targetW);
    if (tokens.length >= 2 && rows.length === 1) {
      const narrow = buildRows(size, availW * 0.62);
      if (narrow.length >= 2 && narrow.length <= 3) rows = narrow;
    }
    const maxRowW = Math.max(...rows.map(r => {
      const sp = ctx.measureText(' ').width;
      return r.reduce((acc, tk, j) => acc + tk.w + (j ? sp : 0), 0);
    }));
    if (rows.length <= 3 && maxRowW <= availW + 4) break;
  }
  const lh = size * 1.12;
  const centerY = clamp(faceY, H * 0.28, H * 0.66);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const spaceW = ctx.measureText(' ').width;
  rows.forEach((row, rIdx) => {
    const rowW = row.reduce((acc, tk, j) => acc + tk.w + (j ? spaceW : 0), 0);
    let x = align === 'left' ? xLeft : (xRight - rowW);
    const y = centerY + (rIdx - (rows.length - 1) / 2) * lh;
    for (const tk of row) {
      ctx.lineWidth = Math.max(10, size * 0.16);
      ctx.strokeStyle = '#050608';
      ctx.strokeText(tk.word, x, y);
      ctx.fillStyle = tk.isRed ? '#ff2424' : '#ffffff';
      ctx.fillText(tk.word, x, y);
      x += tk.w + spaceW;
    }
  });
  ctx.restore();
}
function overlayDraw(t, line, beat, camMeta) {
  ctx.clearRect(0, 0, W, H);
  const beatIdx = currentBeatIndex(t);
  const fx = beat?.fx || [];
  const isBlackCut = fx.includes('corte_preto');
  const isDestaque = Boolean(camMeta?.isDestaque) && !isBlackCut;
  const isSilhueta = Boolean(camMeta?.isSilhueta) && !isBlackCut;

  if (isDestaque) {
    const fxX = camMeta.faceX ?? W * 0.35;
    const fxY = camMeta.faceY ?? H * 0.45;
    const rInner = Math.min(W, H) * 0.14;
    const rOuter = Math.max(W, H) * 0.56;
    const grad = ctx.createRadialGradient(fxX, fxY, rInner, fxX, fxY, rOuter);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.32, 'rgba(0,0,0,0.58)');
    grad.addColorStop(0.58, 'rgba(0,0,0,0.93)');
    grad.addColorStop(1, 'rgba(0,0,0,0.985)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const recentCue = [...textCues].reverse().find(c => c.t <= t);
    const destaqueText = beat?.cam?.texto || beat?.texto || recentCue?.text || '';
    if (destaqueText) {
      const fadeIn = smooth(beat.t0, beat.t0 + 0.18, t);
      drawDestaqueText(destaqueText, fxX, fxY, fadeIn);
    }
  } else if (isSilhueta) {
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.25, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  const cue = (!isDestaque && !isBlackCut) ? [...textCues].reverse().find(c => c.t <= t && t < c.t + 2.6) : null;
  if (cue) {
    const elapsed=t-cue.t, size=vertical?88:76;
    const pop=1+.22*(1-smooth(0,.2,elapsed));
    ctx.save(); ctx.translate(W/2,H*(vertical?.18:.16)); ctx.scale(pop,pop);
    ctx.globalAlpha=Math.min(1,elapsed/.05,(2.6-elapsed)/.3);
    ctx.font=`900 ${size}px Impact, Arial Black, sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    const rows=wrap(cue.text,W*.86);
    rows.forEach((row,i)=>{const y=(i-(rows.length-1)/2)*size*1.14;
      ctx.lineWidth=16;ctx.strokeStyle='#08090d';ctx.strokeText(row,0,y);
      ctx.fillStyle='#fff';ctx.fillText(row,0,y);
    });ctx.restore();
  }
  const hud = !isBlackCut ? [...hudCues].reverse().find(c => c.t <= t) : null;
  if (hud) {
    let label=hud.text;
    const match=label.match(/^(\d{1,2}):(\d\d)(?::(\d\d))?$/);
    if (match) {
      const initial=Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0);
      const total=(initial+Math.floor(t-hud.t))%86400;
      label=`${String(Math.floor(total/3600)).padStart(2,'0')}:${String(Math.floor(total/60)%60).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    }
    ctx.save();ctx.font=`700 ${vertical?42:36}px monospace`;ctx.textAlign='right';
    ctx.lineWidth=7;ctx.strokeStyle='#000';ctx.strokeText(label,W-55,64);
    ctx.fillStyle='#d6edff';ctx.fillText(label,W-55,64);ctx.restore();
  }

  if (isBlackCut && beat) {
    const prevBeat = beatIdx > 0 ? beats[beatIdx - 1] : null;
    const nextBeat = beatIdx >= 0 && beatIdx < beats.length - 1 ? beats[beatIdx + 1] : null;
    const prevBlack = (prevBeat?.fx || []).includes('corte_preto') && Math.abs(prevBeat.t1 - beat.t0) < 0.05;
    const nextBlack = (nextBeat?.fx || []).includes('corte_preto') && Math.abs(nextBeat.t0 - beat.t1) < 0.05;
    const dur = Math.max(0.01, beat.t1 - beat.t0);
    const fade = Math.min(0.3, dur * 0.45);
    const aIn = prevBlack ? 1 : clamp((t - beat.t0) / fade, 0, 1);
    const aOut = nextBlack ? 1 : clamp((beat.t1 - t) / fade, 0, 1);
    const blackAlpha = Math.min(aIn, aOut);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${blackAlpha})`;
    ctx.fillRect(0, 0, W, H);
    const cutText = String(beat.texto || beat.cam?.texto || '').trim();
    if (cutText) {
      const size = vertical ? 74 : 68;
      ctx.globalAlpha = blackAlpha;
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const rows = wrap(cutText.toUpperCase(), W * 0.82);
      rows.forEach((row, i) => {
        const y = H * 0.5 + (i - (rows.length - 1) / 2) * size * 1.18;
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#000';
        ctx.strokeText(row, W / 2, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(row, W / 2, y);
      });
    }
    ctx.restore();
  }

  if (line?.text) {
    ctx.save();ctx.font=`700 ${vertical?40:38}px system-ui, sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    const body=`${String(line.speaker||'').toUpperCase()}: ${line.text}`;
    const rows=wrap(body,W*.84), lh=(vertical?52:48), cy=H-(vertical?180:96);
    const boxH=rows.length*lh+30;
    ctx.fillStyle='rgba(4,8,16,.67)';ctx.beginPath();
    ctx.roundRect(W*.07,cy-boxH/2,W*.86,boxH,17);ctx.fill();
    rows.forEach((row,i)=>{const y=cy+(i-(rows.length-1)/2)*lh;
      ctx.lineWidth=8;ctx.strokeStyle='#000';ctx.strokeText(row,W/2,y);
      ctx.fillStyle='#fff';ctx.fillText(row,W/2,y);
    });ctx.restore();
  }
}
function separateCharacters(visibleSolids) {
  const bodies=[
    ...[...actors.values()].filter(a=>a.vrm.scene.visible).map(a=>({position:a.vrm.scene.position,zombie:false})),
    ...[...zombies.values()].filter(z=>z.group.visible).map(z=>({position:z.group.position,zombie:true})),
  ];
  const obstacleRay=new T.Raycaster();
  const bounds=Object.values(world.rooms).map(room=>room?.bounds).filter(Boolean);
  const limit=(body,dx,dz,distance)=>{
    const p=body.position;
    let allowed=distance;
    const room=bounds.find(b=>p.x>=b.min.x && p.x<=b.max.x && p.z>=b.min.z && p.z<=b.max.z);
    if (room) {
      if (dx>0) allowed=Math.min(allowed,(room.max.x-p.x)/dx);
      if (dx<0) allowed=Math.min(allowed,(room.min.x-p.x)/dx);
      if (dz>0) allowed=Math.min(allowed,(room.max.z-p.z)/dz);
      if (dz<0) allowed=Math.min(allowed,(room.min.z-p.z)/dz);
    }
    if (allowed<=0) return 0;
    obstacleRay.set(new T.Vector3(p.x,p.y+.9,p.z),new T.Vector3(dx,0,dz));
    obstacleRay.far=allowed+.08;
    const hit=obstacleRay.intersectObjects(visibleSolids,false)[0];
    allowed=Math.max(0,Math.min(allowed,hit?hit.distance-.08:allowed));
    if (allowed>0 && findGroundY(p.x+dx*allowed,p.y,p.z+dz*allowed,visibleSolids)===null) return 0;
    return allowed;
  };
  for (let pass=0;pass<12;pass++) {
    let changed=false;
    for (let i=0;i<bodies.length;i++) for (let j=i+1;j<bodies.length;j++) {
      const a=bodies[i],b=bodies[j],pa=a.position,pb=b.position;
      if (Math.abs(pa.y-pb.y)>.9) continue;
      const x=pb.x-pa.x,z=pb.z-pa.z,d2=x*x+z*z;
      const minimum=a.zombie||b.zombie?1:.75;
      if (d2>=minimum*minimum-1e-8) continue;
      const length=Math.sqrt(d2),ux=length?x/length:1,uz=length?z/length:0;
      let best=null;
      for (const [dx,dz] of [[ux,uz],[-uz,ux],[uz,-ux]]) {
        const projection=x*dx+z*dz;
        const needed=-projection+Math.sqrt(projection*projection+minimum*minimum-d2);
        const aMax=limit(a,-dx,-dz,needed),bMax=limit(b,dx,dz,needed);
        const total=Math.min(needed,aMax+bMax);
        const aStep=Math.min(aMax,Math.max(total-bMax,total/2));
        const bStep=total-aStep;
        const after=(x+dx*total)**2+(z+dz*total)**2;
        if (!best || after>best.after) best={dx,dz,aStep,bStep,after};
      }
      if (best.after<=d2+1e-10) continue;
      pa.x-=best.dx*best.aStep;pa.z-=best.dz*best.aStep;
      pb.x+=best.dx*best.bStep;pb.z+=best.dz*best.bStep;
      changed=true;
    }
    if (!changed) break;
  }
}
function findLastValidGroundedPos(plans, t, visibleSolids) {
  if (!plans?.length) return null;
  let activeIdx = 0;
  for (let i = 0; i < plans.length; i++) if (plans[i].t0 <= t) activeIdx = i;
  for (let i = activeIdx; i >= 0; i--) {
    const p = plans[i];
    if (p.jumpPos && (i < activeIdx || t >= p.jumpAt)) {
      const gy = findGroundY(p.jumpPos[0], p.jumpPos[1], p.jumpPos[2], visibleSolids);
      if (gy !== null) return [p.jumpPos[0], gy, p.jumpPos[2]];
    }
    const maxTrav = i === activeIdx
      ? Math.min(p.length, Math.max(0, Math.min(t, p.t1) - p.t0) * p.speed)
      : p.length;
    const steps = Math.max(1, Math.ceil(maxTrav / 0.2));
    for (let s = steps; s >= 0; s--) {
      const pt = routeSample(p.route, maxTrav * (s / steps)).pos;
      const gy = findGroundY(pt[0], pt[1], pt[2], visibleSolids);
      if (gy !== null) return [pt[0], gy, pt[2]];
    }
  }
  return null;
}
function groundEntities(t, visibleSolids) {
  const snap = (entity, pos, plans) => {
    const gy = findGroundY(pos.x, pos.y, pos.z, visibleSolids);
    if (gy !== null) {
      pos.y = gy;
      entity.lastValidPos = pos.clone();
      return;
    }
    const fallback = findLastValidGroundedPos(plans, t, visibleSolids);
    if (fallback) {
      pos.fromArray(fallback);
      entity.lastValidPos = pos.clone();
    } else if (entity.lastValidPos) {
      pos.copy(entity.lastValidPos);
    }
  };
  for (const [name, z] of zombies) {
    if (z.group.visible) snap(z, z.group.position, zombiePlans.get(name));
  }
  for (const [name, a] of actors) {
    if (a.vrm.scene.visible) snap(a, a.vrm.scene.position, actorPlans.get(name));
  }
}
function draw(t) {
  if (!window.ready) return;
  t=clamp(Number(t)||0,0,duracao);
  const beat=currentBeat(t), line=lineAt(t);
  const fx=beat?.fx||[], light=beat?.luz||'normal';
  world.update(t,light==='apagao'||fx.includes('escuro')?'apagao':light==='emergencia'?'piscando':'normal',
    light==='tempestade'&& !fx.includes('relampago')?[...fx,'relampago']:fx);
  if (qaMode) {
    renderer.setClearColor('#ff00ff', 1);
    scene.background.set('#ff00ff');
    scene.fog = null;
  }
  const isBlackout = light === 'apagao' || fx.includes('escuro');
  const isEmergency = !isBlackout && light === 'emergencia';
  if (isBlackout || isEmergency) {
    const roomFloor = isBlackout ? 0.26 : 0.36;
    const hemiFloor = isBlackout ? 0.85 : 0.95;
    for (const [l, baseInt] of baseLights) {
      if (l.isHemisphereLight) l.intensity = Math.max(l.intensity, hemiFloor);
      else if (l.isPointLight && baseInt > 0) l.intensity = Math.max(l.intensity, baseInt * roomFloor);
    }
  }
  const broken=t>=shatterAt;
  for (const pane of glassPanels) pane.visible=!broken;
  for (const s of shards) {
    const dt=t-shatterAt;s.mesh.visible=broken;
    if (s.mesh.visible) {
      const vy0=.4+s.phase*.8, g=9.8, h0=Math.max(0,s.base[1]-.018);
      const tLand=(vy0+Math.sqrt(vy0*vy0+2*g*h0))/g;
      const tf=Math.min(Math.max(0,dt),tLand), landed=dt>=tLand;
      const y=landed?.018:s.base[1]+vy0*tf-.5*g*tf*tf;
      s.mesh.position.set(s.base[0]+(s.phase-.5)*1.4*tf, y, s.base[2]+(.6+s.phase*1.1)*tf);
      s.mesh.rotation.set(landed?-Math.PI/2:tf*5*(.5+s.phase),
        landed?s.phase*6.28:tf*4*(1-s.phase), landed?0:tf*3);
    }
  }
  const dim = isBlackout ? 0.55 : isEmergency ? 0.82 : 1;
  ambient.intensity=1.1*dim;fill.intensity=.6*dim;
  flash.position.set(0,4,-8); flash.distance=35;
  flash.intensity=fx.includes('relampago')?Math.pow(Math.max(0,Math.sin(t*17)),8)*9:0;
  for (const [name,z] of zombies) {
    const sample=samplePlan(zombiePlans.get(name),t);
    z.group.visible=!!sample;
    if (!sample) continue;
    z.group.position.fromArray(sample.pos);z.group.rotation.y=sample.yaw;
    z.currentYaw=sample.yaw;absoluteAction(z,zombiePlans.get(name),t);
  }
  for (const [name,a] of actors) {
    const sample=samplePlan(actorPlans.get(name),t);
    a.vrm.scene.visible=!!sample;
    if (!sample) continue;
    a.vrm.scene.position.fromArray(sample.pos);
    a.currentYaw=sample.yaw;
    a.vrm.scene.rotation.y=a.baseYaw+sample.yaw;
    resetActorRestPose(a);
    absoluteAction(a,actorPlans.get(name),t);
    applyActorPosture(a,sample.plan,beat,t,line);
    if (a.phone) a.phone.visible=sample.plan.acao==='telefone';
  }
  scene.updateMatrixWorld(true);
  const visibleSolids=solidWorld.filter(x=>x.visible);
  separateCharacters(visibleSolids);
  groundEntities(t,visibleSolids);
  const camMeta = cameraFor(t,beat,line);
  const camTarget = camMeta.target;
  const dCam = camera.position.distanceTo(camTarget);
  camFill.position.copy(camera.position);
  camFill.position.y += 0.18;
  const fillBase = isBlackout ? 2.5 : isEmergency ? 1.85 : 0.85;
  camFill.intensity = fillBase * clamp(dCam / 2.4, 0.55, 1.4);
  const rimFwd = camTarget.clone().sub(camera.position);
  rimFwd.y = 0;
  if (rimFwd.lengthSq() < 1e-4) rimFwd.set(0, 0, -1);
  else rimFwd.normalize();
  const rimSide = new T.Vector3(-rimFwd.z, 0, rimFwd.x);
  rimLight.position.copy(camTarget)
    .addScaledVector(rimFwd, 4)
    .addScaledVector(rimSide, 2.4)
    .add(new T.Vector3(0, 3.2, 0));
  rimLight.target.position.copy(camTarget);
  rimLight.target.updateMatrixWorld();
  rimLight.intensity = isBlackout ? 1.15 : isEmergency ? 0.95 : 0.55;
  if (camMeta.isDestaque) {
    camFill.intensity = Math.max(camFill.intensity, 1.45);
  }
  if (camMeta.isSilhueta) {
    for (const [l] of baseLights) l.intensity *= 0.03;
    ambient.intensity = 0.03;
    fill.intensity = 0;
    camFill.intensity = 0;
    rimLight.position.copy(camTarget).addScaledVector(rimFwd, 4.5).add(new T.Vector3(0, 1.2, 0));
    rimLight.target.position.copy(camTarget);
    rimLight.target.updateMatrixWorld();
    rimLight.intensity = 3.2;
    const pulse = (fx.includes('relampago') || light === 'tempestade')
      ? 0.45 + 0.55 * Math.pow(Math.max(0, Math.sin(t * 11)), 6)
      : 0.55;
    flash.position.copy(camTarget).addScaledVector(rimFwd, 2.4).add(new T.Vector3(0, 0.4, 0));
    flash.distance = 18;
    flash.intensity = 15 + pulse * 14;
    if (!qaMode) {
      const bgR = 0.08 + pulse * 0.28, bgG = 0.14 + pulse * 0.36, bgB = 0.24 + pulse * 0.46;
      scene.background.setRGB(bgR, bgG, bgB);
      if (scene.fog) scene.fog.color.copy(scene.background);
      for (const s of skyMats) {
        if (s.mat.map !== null) { s.mat.map = null; s.mat.needsUpdate = true; }
        s.mat.color.setRGB(bgR * 1.4, bgG * 1.4, Math.min(1, bgB * 1.4));
      }
    }
  } else if (!qaMode) {
    for (const s of skyMats) {
      if (s.mat.map !== s.map) { s.mat.map = s.map; s.mat.needsUpdate = true; }
      s.mat.color.copy(s.color);
    }
  }
  window.qaBackgroundHex=scene.background.getHexString();
  window.qaInfo={alvo:lastCameraTarget,local:lastCameraLocal,beat_local:beat?.local||''};
  for (const a of actors.values()) if (a.vrm.scene.visible) {
    const plan=samplePlan(actorPlans.get(a.name),t)?.plan;
    updateGaze(a,plan,t); expression(a,t,line,plan,beat);
    a.vrm.update(0);
    for (const fm of a.forbiddenMorphs) fm.mesh.morphTargetInfluences[fm.index]=0;
  }
  if (camMeta.isDestaque) {
    const faceWorld = focusPosition(camMeta.key) || camTarget;
    camera.updateMatrixWorld(true);
    const proj = faceWorld.clone().project(camera);
    if (proj.z <= 1) {
      camMeta.faceX = clamp((proj.x * 0.5 + 0.5) * W, W * 0.14, W * 0.86);
      camMeta.faceY = clamp((-proj.y * 0.5 + 0.5) * H, H * 0.14, H * 0.86);
    } else {
      camMeta.faceX = W * (camMeta.side > 0 ? 0.34 : 0.66);
      camMeta.faceY = H * 0.45;
    }
  }
  overlayDraw(t,line,beat,camMeta);
  renderer.render(scene,camera);
}
window.renderFrame = draw;
window.capturaFrame = () => {
  if (!window.ready) throw new Error('Cena ainda não carregada');
  captureCtx.drawImage(canvas,0,0,W,H);captureCtx.drawImage(overlay,0,0,W,H);
  return capture.toDataURL('image/jpeg',.92).split(',')[1];
};
function audioMetadata() {
  return new Promise((resolve,reject)=>{
    if (Number.isFinite(audio.duration) && audio.duration>0) {resolve();return;}
    audio.addEventListener('loadedmetadata',()=>resolve(),{once:true});
    audio.addEventListener('error',()=>reject(new Error('audio.mp3 não carregou')),{once:true});
    audio.load();
  });
}
async function boot() {
  try {
    audio.src=epFile('audio.mp3');
    const [lines,wordData,script,direction]=await Promise.all([
      fetchRequired('falas.json'),fetchRequired('words.json'),fetchRequired('roteiro.txt','text'),loadDirection(),audioMetadata(),
    ]);
    if (!Array.isArray(lines)||!Array.isArray(wordData)) throw new Error('falas.json/words.json precisam ser listas');
    falas=lines.map(x=>({...x,start:Number(x.start),end:Number(x.end)})).sort((a,b)=>a.start-b.start);
    words=wordData.map(x=>({...x,start:Number(x.start),end:Number(x.end)})).sort((a,b)=>a.start-b.start);
    beats=direction;validateBeats();parseRoteiro(script);
    shatterAt=beats.find(b=>(b.fx||[]).includes('vidro_quebrado'))?.t0 ?? Infinity;
    duracao=audio.duration+1;window.DURACAO=duracao;
    compilePlans();await loadCharacters();
    window.ready=true;draw(0);
  } catch (error) {
    errorBox.textContent=String(error?.message||error);console.error(error);
  }
}
const bootPromise=boot();
play.addEventListener('click',async()=>{
  await bootPromise;
  if (!window.ready) return;
  if (audio.ended) audio.currentTime=0;
  try {await audio.play();play.hidden=true;} catch(e) {errorBox.textContent=String(e);}
});
audio.addEventListener('ended',()=>{play.hidden=false;});
function loop() { requestAnimationFrame(loop); if (window.ready&&!audio.paused) draw(audio.currentTime); }
loop();
