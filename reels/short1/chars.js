import * as T from './lib/three.module.js';
import { planos } from './direcao.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smoothstep = (e0, e1, x) => {
  const u = clamp((x - e0) / Math.max(1e-5, e1 - e0), 0, 1);
  return u * u * (3 - 2 * u);
};
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return s - Math.floor(s);
};
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

function stdMat(color, opts = {}) {
  return new T.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.68,
    metalness: opts.metalness ?? 0.04,
    clearcoat: opts.clearcoat ?? 0,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.6,
    sheen: opts.sheen ?? 0,
    sheenRoughness: opts.sheenRoughness ?? 0.7,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? T.FrontSide,
    depthWrite: opts.depthWrite ?? true,
  });
}

function addShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// Caixa de cantos realmente arredondados para detalhes de roupa e acessórios.
// A malha é projetada sobre um paralelepípedo interno e uma borda esférica.
function roundedBoxGeo(width, height, depth, radius = Math.min(width, height, depth) * 0.42) {
  const r = Math.min(radius, width * 0.49, height * 0.49, depth * 0.49);
  const seg = (size) => Math.min(16, Math.max(4, Math.ceil(size / Math.max(r, 0.004))));
  const geo = new T.BoxGeometry(width, height, depth, seg(width), seg(height), seg(depth));
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const ix = width * 0.5 - r;
  const iy = height * 0.5 - r;
  const iz = depth * 0.5 - r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = clamp(x, -ix, ix), cy = clamp(y, -iy, iy), cz = clamp(z, -iz, iz);
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    p.setXYZ(i, cx + dx * r / len, cy + dy * r / len, cz + dz * r / len);
    n.setXYZ(i, dx / len, dy / len, dz / len);
  }
  p.needsUpdate = true;
  n.needsUpdate = true;
  return geo;
}

function taperedLimbGeo(top, middle, bottom, length) {
  const h = length * 0.5;
  const pts = [
    [0.002, -h], [bottom * 0.68, -h + 0.009], [bottom, -h + 0.026],
    [middle * 0.94, -h * 0.35], [middle, 0],
    [top * 0.96, h * 0.58], [top, h - 0.026],
    [top * 0.76, h - 0.008], [0.002, h],
  ];
  return new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 32);
}

function softCylinderGeo(top, bottom, height) {
  const h = height * 0.5;
  const edge = Math.min(height * 0.24, top * 0.25, bottom * 0.25);
  return new T.LatheGeometry([
    [0.002, -h], [bottom - edge, -h], [bottom, -h + edge],
    [top, h - edge], [top - edge, h], [0.002, h],
  ].map(([r, y]) => new T.Vector2(r, y)), 32);
}

// ============================================================================
// Contorno leve tipo toon (casca invertida por extrusão suave de normais)
// ============================================================================
const MAT_OUTLINE = new T.MeshBasicMaterial({
  color: '#11121c',
  side: T.BackSide,
});

function makeExtrudedOutlineGeo(srcGeo, thickness, sx = 1, sy = 1, sz = 1) {
  const geo = srcGeo.clone();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;

  // Média de normais por posição coincidente para manter caixas e cilindros sem rachaduras
  const accum = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    let acc = accum.get(key);
    if (!acc) {
      acc = [0, 0, 0];
      accum.set(key, acc);
    }
    acc[0] += nrm.getX(i);
    acc[1] += nrm.getY(i);
    acc[2] += nrm.getZ(i);
  }

  const invX = 1 / Math.max(0.18, Math.abs(sx));
  const invY = 1 / Math.max(0.18, Math.abs(sy));
  const invZ = 1 / Math.max(0.18, Math.abs(sz));

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const key = `${Math.round(px * 1000)},${Math.round(py * 1000)},${Math.round(pz * 1000)}`;
    const acc = accum.get(key);
    let nx = acc ? acc[0] : nrm.getX(i);
    let ny = acc ? acc[1] : nrm.getY(i);
    let nz = acc ? acc[2] : nrm.getZ(i);

    let wx = nx * invX;
    let wy = ny * invY;
    let wz = nz * invZ;
    const len = Math.hypot(wx, wy, wz);
    if (len > 1e-5) {
      wx /= len;
      wy /= len;
      wz /= len;
    } else {
      wx = 0;
      wy = 1;
      wz = 0;
    }

    pos.setXYZ(
      i,
      px + wx * thickness * invX,
      py + wy * thickness * invY,
      pz + wz * thickness * invZ
    );
  }
  pos.needsUpdate = true;
  return geo;
}

function addOutline(mesh, thickness = 0.0046) {
  const outGeo = makeExtrudedOutlineGeo(mesh.geometry, thickness, mesh.scale.x, mesh.scale.y, mesh.scale.z);
  const outMesh = new T.Mesh(outGeo, MAT_OUTLINE);
  outMesh.castShadow = false;
  outMesh.receiveShadow = false;
  outMesh.renderOrder = 0;
  mesh.add(outMesh);
  return mesh;
}

// ============================================================================
// Geometria de mecha esculpida e afilada (ribbon-lock orgânico)
// ============================================================================
const HEAD_CENTER = new T.Vector3(0, 0.135, 0);

function buildTaperedStrand(pts, opts = {}) {
  const {
    rStart = 0.014,
    rMid = 0.017,
    rTip = 0.0018,
    flatten = 0.56,
    segs = Math.max(10, pts.length * 4),
    radialSegs = 10,
    mat,
    castShadow = true,
    outline = 0,
  } = opts;

  const vecs = pts.map((p) => (p instanceof T.Vector3 ? p : new T.Vector3(p[0], p[1], p[2])));
  const curve = new T.CatmullRomCurve3(vecs);
  const positions = [];
  const uvs = [];
  const indices = [];

  const tmpOut = new T.Vector3();
  const tmpTan = new T.Vector3();
  const tmpN = new T.Vector3();
  const tmpB = new T.Vector3();
  const prevB = new T.Vector3(1, 0, 0);

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const P = curve.getPoint(u);
    curve.getTangent(u, tmpTan).normalize();

    tmpOut.subVectors(P, HEAD_CENTER);
    const dot = tmpOut.dot(tmpTan);
    tmpN.copy(tmpOut).addScaledVector(tmpTan, -dot);
    if (tmpN.lengthSq() < 1e-5) {
      tmpN.set(Math.abs(tmpTan.y) < 0.9 ? 0 : 1, Math.abs(tmpTan.y) < 0.9 ? 1 : 0, 0);
      tmpN.addScaledVector(tmpTan, -tmpN.dot(tmpTan));
    }
    tmpN.normalize();
    tmpB.crossVectors(tmpTan, tmpN).normalize();

    if (i > 0 && tmpB.dot(prevB) < 0) {
      tmpB.negate();
      tmpN.negate();
    }
    prevB.copy(tmpB);

    let r;
    if (u < 0.18) {
      r = lerp(rStart, rMid, u / 0.18);
    } else {
      const tu = (u - 0.18) / 0.82;
      r = lerp(rMid, rTip, Math.pow(tu, 1.45));
    }
    const rx = r;
    const ry = r * flatten;

    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a) * rx;
      const sa = Math.sin(a) * ry;
      positions.push(
        P.x + tmpB.x * ca + tmpN.x * sa,
        P.y + tmpB.y * ca + tmpN.y * sa,
        P.z + tmpB.z * ca + tmpN.z * sa
      );
      uvs.push(j / radialSegs, u);
    }
  }

  const ringStride = radialSegs + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a00 = i * ringStride + j;
      const a10 = (i + 1) * ringStride + j;
      const a11 = (i + 1) * ringStride + j + 1;
      const a01 = i * ringStride + j + 1;
      indices.push(a00, a10, a11, a00, a11, a01);
    }
  }

  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new T.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  if (outline > 0) addOutline(mesh, outline);
  return mesh;
}

function makeHairPalette(hexColors, opts = {}) {
  return hexColors.map((c) =>
    stdMat(c, {
      roughness: opts.roughness ?? 0.60,
      metalness: opts.metalness ?? 0.06,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      depthWrite: opts.depthWrite ?? true,
    })
  );
}

// Calota discreta colada ao topo/nuca do crânio (nunca invade testa/sobrancelhas)
function addScalpBase(hairGroup, mat, opts = {}) {
  const {
    radius = 0.144,
    y = 0.140,
    z = -0.014,
    phiLen = Math.PI * 0.46,
    rotX = -0.30,
    scale = [0.94, 1.05, 0.95],
    outline = 0.0036,
  } = opts;
  const cap = addShadow(
    new T.Mesh(new T.SphereGeometry(radius, 20, 14, 0, Math.PI * 2, 0, phiLen), mat),
    false,
    true
  );
  cap.position.set(0, y, z);
  cap.rotation.x = rotX;
  cap.scale.set(...scale);
  if (outline > 0) addOutline(cap, outline);
  hairGroup.add(cap);
  return cap;
}

// ============================================================================
// Penteados únicos e detalhados — Elenco "E SE VOCÊ…" (biblia.md)
// ============================================================================
function buildHair(headPivot, name, skinMat) {
  const hair = new T.Group();
  headPivot.add(hair);
  const long = name === 'CLARA' || name === 'LARA';
  const bob = name === 'HELENA';
  const lara = name === 'LARA';
  const colors = name === 'CLARA'
    ? ['#39251e', '#51352a', '#644333', '#493025']
    : lara ? ['#101018', '#1c1723', '#292034', '#51286d', '#693493']
    : bob ? ['#12131a', '#1d1d27', '#282632']
    : name === 'ANTONY' ? ['#241914', '#35251b', '#493225']
    : ['#17191d', '#25272b', '#343437'];
  const mats = colors.map(c => stdMat(c, { roughness: 0.48, sheen: 0.24 }));
  const dark = mats[0];
  // A base é fina e fica sob mechas individuais, sem uma massa lisa sobre a face.
  addScalpBase(hair, dark, { radius: 0.139, y: 0.135, phiLen: Math.PI * 0.43,
    scale: [0.91, 1.01, 0.93], outline: 0 });

  if (long || bob) {
    const count = long ? 42 : 34;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = Math.sin(a), z = Math.cos(a);
      const side = Math.sign(x) || 1;
      // Na frente, as mechas laterais passam pelos ombros e deixam olhos e boca livres.
      const front = z > 0.22;
      if (front && Math.abs(x) < 0.36) continue;
      const end = bob ? -0.20 - 0.028 * hash(i + 8) : -0.51 - 0.075 * hash(i + 8);
      const startX = x * 0.092;
      const outerX = x * (front ? 0.157 : 0.162);
      const endX = x * (front ? 0.205 : 0.175) + side * (hash(i * 9) - 0.5) * 0.018;
      const backZ = front ? 0.043 + (i % 3) * 0.012 : -0.142 + z * 0.016;
      const pts = [
        [startX, 0.267 - 0.025 * hash(i), z * 0.073 - 0.014],
        [outerX, 0.168, z * 0.124 - 0.014],
        [outerX + side * 0.010, 0.015, front ? 0.052 : backZ],
        [endX - side * 0.018, end * 0.55, backZ + 0.027 * Math.sin(i * 2.2)],
        [endX, end, backZ + 0.018 * Math.cos(i * 2.2)],
      ];
      const purple = lara && (i % 4 === 0 || i % 7 === 0);
      hair.add(buildTaperedStrand(pts, { rStart: 0.011, rMid: long ? 0.016 : 0.015,
        rTip: long ? 0.004 : 0.006, flatten: 0.56, segs: 24, radialSegs: 10,
        mat: mats[purple ? 3 + (i % 2) : i % (lara ? 3 : mats.length)] }));
      if (purple) {
        hair.add(buildTaperedStrand(pts.slice(2), { rStart: 0.008, rMid: 0.011,
          rTip: 0.002, segs: 14, mat: mats[3 + (i % 2)] }));
      }
    }
    // Risca e ondas da franja moldadas como fios, não uma calota avançada.
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
      const u = i / 6;
      hair.add(buildTaperedStrand([
        [side * (0.012 + u * 0.018), 0.275, 0.045],
        [side * (0.064 + u * 0.021), 0.257, 0.103],
        [side * (0.117 + u * 0.012), 0.199 - u * 0.014, 0.090],
        [side * (0.151 + u * 0.010), 0.108 - u * 0.030, 0.034],
      ], { rStart: 0.009, rMid: 0.013, rTip: 0.0015, segs: 16,
        mat: mats[(i + (side > 0 ? 1 : 0)) % (lara ? 3 : mats.length)] }));
    }
  } else {
    // Cabelo masculino em cachos/volumes curtos com direções variadas.
    const curls = name === 'ANTONY';
    for (let i = 0; i < 48; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / 48) * 0.123;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 0.013;
      const lift = curls ? 0.042 + hash(i * 13) * 0.025 : 0.019 + hash(i * 13) * 0.014;
      hair.add(buildTaperedStrand([
        [x * 0.85, 0.254 - r * 0.21, z * 0.85],
        [x + 0.014 * Math.sin(i), 0.270 + lift, z + (curls ? 0.020 : -0.012)],
        [x + 0.026 * Math.sin(i + 1), 0.252 + lift * 0.45, z + (curls ? 0.053 : -0.023)],
        [x + 0.035 * Math.sin(i + 2), 0.238, z + (curls ? 0.064 : -0.032)],
      ], { rStart: 0.010, rMid: curls ? 0.015 : 0.013,
        rTip: 0.0015, segs: 13, mat: mats[i % mats.length] }));
    }
    for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
      hair.add(buildTaperedStrand([
        [side * 0.112, 0.215 - i * 0.008, 0.056 - i * 0.015],
        [side * 0.133, 0.192 - i * 0.008, 0.035 - i * 0.015],
        [side * 0.122, 0.165 - i * 0.006, 0.006 - i * 0.013],
      ], { rStart: 0.008, rMid: 0.011, rTip: 0.002,
        mat: mats[(i + 1) % mats.length] }));
    }
  }
  return hair;
}

// ============================================================================
// Geometrias esculpidas (torso anatômico/oversized/atlético e quadril)
// ============================================================================
function buildTorsoGeo(feminine, bx, bz, opts = {}) {
  const athletic = !!opts.athletic;
  const jacket = !!opts.jacket;
  const fabric = !!opts.fabric;
  const profile = feminine ? [
    [0.000, 0.122, 0.112], [0.065, 0.113, 0.106], [0.145, 0.088, 0.086],
    [0.220, 0.112, 0.102], [0.305, 0.153, 0.130], [0.380, 0.164, 0.119],
    [0.433, 0.122, 0.091], [0.475, 0.058, 0.055],
  ] : athletic ? [
    [0.000, 0.130, 0.110], [0.075, 0.125, 0.112], [0.150, 0.128, 0.113],
    [0.240, 0.157, 0.128], [0.340, 0.190, 0.148], [0.405, 0.195, 0.139],
    [0.455, 0.146, 0.103], [0.480, 0.068, 0.060],
  ] : [
    [0.000, 0.128, 0.106], [0.075, 0.125, 0.110], [0.150, 0.126, 0.114],
    [0.240, 0.148, 0.126], [0.340, 0.174, 0.142], [0.405, 0.179, 0.136],
    [0.455, 0.138, 0.101], [0.480, 0.065, 0.056],
  ];
  const section = (y) => {
    let i = 0;
    while (i < profile.length - 2 && profile[i + 1][0] < y) i++;
    const a = profile[i], b = profile[i + 1];
    const u = smoothstep(0, 1, (y - a[0]) / (b[0] - a[0]));
    return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  };
  const positions = [], indices = [], uvs = [];
  const ySteps = 48, radial = 64;
  const start = opts.thetaStart ?? -Math.PI;
  const end = opts.thetaEnd ?? Math.PI;
  for (let iy = 0; iy <= ySteps; iy++) {
    for (let ia = 0; ia <= radial; ia++) {
      const theta = lerp(start, end, ia / radial);
      const cs = Math.cos(theta), sn = Math.sin(theta);
      const topY = opts.scoop ? (cs > 0 ? 0.425 - 0.112 * cs ** 4 : 0.445) : 0.48;
      const y = iy / ySteps * topY;
      const [rx, rz] = section(y);
      let x = sn * (rx + (jacket ? 0.010 : fabric ? 0.003 : 0)) * bx;
      let z = cs * (rz + (jacket ? 0.008 : fabric ? 0.003 : 0)) * bz;
      if (cs > 0) {
        const pec = Math.exp(-Math.pow((y - 0.326) / 0.091, 2));
        if (feminine) {
          const twin = Math.exp(-Math.pow((Math.abs(x) - 0.075 * bx) / (0.072 * bx), 2));
          z += pec * twin * (jacket ? 0.072 : 0.067) * bz * cs;
        } else {
          z += pec * (athletic ? 0.029 : 0.022) * bz * cs;
        }
      }
      // Costas suavemente arqueadas e cintura feminina marcada na lateral.
      if (cs < 0) z += 0.009 * Math.exp(-Math.pow((y - 0.17) / 0.09, 2));
      positions.push(x, y, z);
      uvs.push(ia / radial, iy / ySteps);
    }
  }
  for (let iy = 0; iy < ySteps; iy++) for (let ia = 0; ia < radial; ia++) {
    const k = iy * (radial + 1) + ia;
    indices.push(k, k + 1, k + radial + 1, k + 1, k + radial + 2, k + radial + 1);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildPelvisGeo(feminine, bx, bz) {
  const profile = feminine ? [
    [0.002, -0.090], [0.140, -0.085], [0.183, -0.052],
    [0.196, 0.004], [0.175, 0.058], [0.112, 0.092], [0.002, 0.096],
  ] : [
    [0.002, -0.084], [0.115, -0.078], [0.141, -0.033],
    [0.144, 0.026], [0.125, 0.080], [0.002, 0.087],
  ];
  const geo = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 48);
  geo.scale(bx, 1, 0.83 * bz);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Especificação do elenco "E SE VOCÊ…" conforme biblia.md
// ============================================================================
const CAST = {
  ANTONY: {
    skin: '#c8926c',
    shirt: '#f26a1b', // jaqueta corta-vento laranja-sinalização
    pants: '#343a44', // calça cargo chumbo
    shoes: '#4b3626', // botas de trabalho
    hair: '#2b1e16',
    iris: '#4a3520',
    lip: '#9d6253',
    height: 1.74,
    buildX: 1.0,
    buildZ: 0.96,
    headScale: [0.92, 1.06, 0.94],
    eyeScaleY: 0.94,
    longSleeve: true,
    shoeStyle: 'workboot',
    age: 23,
  },
  HELENA: {
    skin: '#cfa086',
    shirt: '#861f3b', // malha vinho justa
    pants: '#171920',
    shoes: '#13141a',
    hair: '#14151d',
    iris: '#2c1e1d',
    lip: '#882b3e',
    height: 1.73,
    buildX: 0.90,
    buildZ: 0.88,
    headScale: [0.87, 1.07, 0.91], // proporção adulta (34 anos)
    eyeScaleY: 0.86,
    longSleeve: true,
    feminine: true,
    mature: true,
    shoeStyle: 'heel',
    age: 34,
  },
  BRUNO: {
    skin: '#bc8564',
    shirt: '#2b5797', // jaqueta esportiva azul-cobalto
    pants: '#b9a58c',
    shoes: '#1e242e',
    hair: '#15161e',
    iris: '#35251a',
    lip: '#8f5847',
    height: 1.85,
    buildX: 1.18, // ombros largos (Bruno, 40 anos)
    buildZ: 1.08,
    headScale: [0.93, 1.08, 0.96],
    eyeScaleY: 0.88,
    longSleeve: true,
    mature: true,
    athletic: true,
    shoeStyle: 'sneaker',
    age: 40,
  },
  CLARA: {
    skin: '#d19874',
    shirt: '#f3f0eb', // blusa branca justa
    pants: '#315d95',
    shoes: '#f3f2ef',
    hair: '#4d3025',
    iris: '#57361e',
    lip: '#a65d4f',
    height: 1.67,
    buildX: 0.91,
    buildZ: 0.90,
    headScale: [0.91, 1.05, 0.93],
    eyeScaleY: 0.93,
    longSleeve: false,
    feminine: true,
    shoeStyle: 'sneaker',
    age: 25,
  },
  LARA: {
    skin: '#d6ae97',
    shirt: '#15141a', // regata preta justa
    pants: '#17171d',
    shoes: '#16171f',
    hair: '#191623',
    iris: '#3c2a44',
    lip: '#9f5b65',
    height: 1.60,
    buildX: 0.92,
    buildZ: 0.94,
    headScale: [0.93, 1.04, 0.94],
    eyeScaleY: 0.98,
    longSleeve: false,
    feminine: true,
    oversized: false,
    shoeStyle: 'platform',
    age: 19,
  },
};

// ============================================================================
// Construção de um personagem articulado, esculpido e com contorno toon
// ============================================================================
function buildActor(name, spec) {
  const matSkin = stdMat(spec.skin, { roughness: 0.58, sheen: 0.12, clearcoat: 0.055, clearcoatRoughness: 0.88 });
  const matShirt = stdMat(spec.shirt, {
    roughness: 0.82,
    sheen: 0.14,
  });
  const matPants = stdMat(spec.pants, { roughness: 0.80 });
  const matShoes = stdMat(spec.shoes, { roughness: spec.shoeStyle === 'platform' ? 0.39 : 0.55, clearcoat: spec.shoeStyle === 'platform' ? 0.24 : 0.05 });
  const matGold = stdMat('#e5be58', { roughness: 0.22, metalness: 0.86 });
  const matSilver = stdMat('#cfd8e0', { roughness: 0.24, metalness: 0.82 });

  const scale = spec.height / 1.72;
  const bx = spec.buildX;
  const bz = spec.buildZ;

  const root = new T.Group();
  root.scale.setScalar(scale);

  const body = new T.Group();
  root.add(body);

  const pelvis = new T.Group();
  pelvis.position.set(0, 0.84, 0);
  body.add(pelvis);

  // Quadril esculpido
  const hipMesh = addOutline(
    addShadow(new T.Mesh(buildPelvisGeo(!!spec.feminine, bx, bz), matPants)),
    0.0046
  );
  pelvis.add(hipMesh);

  // Tronco esculpido com cintura e caixa torácica
  const torso = new T.Group();
  torso.position.set(0, 0.05, 0);
  pelvis.add(torso);

  // A pele segue o tronco inteiro. Nas regatas, o tecido termina no decote
  // e revela os ombros; nas jaquetas, a camiseta é o próprio volume do peito.
  if (spec.feminine && name !== 'HELENA') {
    torso.add(addShadow(new T.Mesh(buildTorsoGeo(true, bx, bz), matSkin)));
  }
  const chestMesh = addShadow(new T.Mesh(
    buildTorsoGeo(!!spec.feminine, bx, bz, {
      athletic: !!spec.athletic,
      scoop: name === 'CLARA' || name === 'LARA',
      fabric: true,
    }),
    name === 'ANTONY' ? stdMat('#34363d', { roughness: 0.86, sheen: 0.08 })
      : name === 'BRUNO' ? stdMat('#111216', { roughness: 0.85 }) : matShirt
  ));
  torso.add(chestMesh);

  const addCurve = (parent, pts, radius, material) => {
    const curve = new T.CatmullRomCurve3(pts.map(v => new T.Vector3(...v)));
    const mesh = addShadow(new T.Mesh(new T.TubeGeometry(curve, 30, radius, 10, false), material));
    parent.add(mesh);
    return mesh;
  };
  const darkTrim = stdMat('#252932', { roughness: 0.78 });
  const leather = stdMat('#553923', { roughness: 0.46, clearcoat: 0.18 });
  const metal = matSilver;

  if (name === 'ANTONY' || name === 'BRUNO') {
    const orange = name === 'ANTONY';
    const jacket = matShirt;
    const seam = stdMat(orange ? '#b44712' : '#173e72', { roughness: 0.72 });
    // Duas metades moldadas sobre o mesmo peito: vão central realmente aberto.
    for (const side of [-1, 1]) {
      const panel = addShadow(new T.Mesh(buildTorsoGeo(false, bx, bz, {
        athletic: !!spec.athletic, jacket: true,
        thetaStart: side > 0 ? 0.43 : -Math.PI,
        thetaEnd: side > 0 ? Math.PI : -0.43,
      }), jacket));
      torso.add(panel);
      const lipX = side * (orange ? 0.074 : 0.083) * bx;
      addCurve(torso, [[lipX * 0.72, 0.045, 0.119 * bz],
        [lipX, 0.175, 0.143 * bz],
        [lipX * 1.34, 0.320, 0.153 * bz],
        [side * 0.078 * bx, 0.445, 0.073 * bz]], 0.0075, seam);
      // Lapela dobrada para fora da abertura; acompanha a curvatura do torso.
      const lapel = addShadow(new T.Mesh(new T.SphereGeometry(1, 24, 16), jacket));
      lapel.position.set(side * 0.113 * bx, 0.362, 0.128 * bz);
      lapel.scale.set(0.047 * bx, 0.105, 0.012);
      lapel.rotation.z = -side * 0.33;
      torso.add(lapel);
      addCurve(torso, [[side * 0.067 * bx, 0.454, 0.058 * bz],
        [side * 0.119 * bx, 0.388, 0.133 * bz],
        [side * 0.149 * bx, 0.291, 0.151 * bz]], 0.006, seam);
      // Costura e bolso pequenos sobre a jaqueta, sem placas no peito.
      addCurve(torso, [[side * 0.154 * bx, 0.169, 0.095 * bz],
        [side * 0.170 * bx, 0.184, 0.074 * bz]], 0.003, seam);
    }
    // Gola da camiseta encaixada no pescoço.
    addCurve(torso, [[-0.058, 0.461, 0.043], [-0.033, 0.441, 0.071],
      [0, 0.434, 0.078], [0.033, 0.441, 0.071], [0.058, 0.461, 0.043]],
    0.005, darkTrim);
    if (orange) {
      const belt = new T.Mesh(softCylinderGeo(0.137 * bx, 0.139 * bx, 0.038), darkTrim);
      belt.position.y = 0.026; belt.scale.z = 0.83 * bz; torso.add(belt);
      const buckle = new T.Mesh(roundedBoxGeo(0.040, 0.028, 0.010), metal);
      buckle.position.set(0, 0.027, 0.116 * bz); torso.add(buckle);
      const tape = new T.Mesh(roundedBoxGeo(0.052, 0.056, 0.031),
        stdMat('#e9b919', { roughness: 0.48 }));
      tape.position.set(-0.137 * bx, 0.015, 0.075 * bz); torso.add(tape);
    }
  } else if (name === 'HELENA') {
    // Malha vinho ajustada na cintura, com a mesma anatomia ampulheta.
    const neck = new T.Mesh(softCylinderGeo(0.055, 0.062, 0.065), matShirt);
    neck.position.y = 0.478; torso.add(neck);
    const rib = stdMat('#641b31', { roughness: 0.89, sheen: 0.12 });
    for (const side of [-1, 1]) {
      addCurve(torso, [[side * 0.105 * bx, 0.065, 0.055],
        [side * 0.085 * bx, 0.152, 0.080],
        [side * 0.129 * bx, 0.247, 0.090]], 0.0028, rib);
    }
    const belt = new T.Mesh(softCylinderGeo(0.112 * bx, 0.116 * bx, 0.030), darkTrim);
    belt.position.y = 0.026; belt.scale.z = 0.83 * bz; torso.add(belt);
    const buckle = new T.Mesh(roundedBoxGeo(0.035, 0.023, 0.009), metal);
    buckle.position.set(0, 0.026, 0.098); torso.add(buckle);
  } else {
    // Decote e alças da blusa ajustada. O busto é parte da superfície contínua.
    const edge = name === 'CLARA'
      ? stdMat('#dedbd6', { roughness: 0.82 }) : stdMat('#25232a', { roughness: 0.88 });
    for (const side of [-1, 1]) {
      addCurve(torso, [[side * 0.120 * bx, 0.391, 0.095 * bz],
        [side * 0.103 * bx, 0.448, 0.071 * bz],
        [side * 0.096 * bx, 0.475, 0.024]], name === 'CLARA' ? 0.012 : 0.015, matShirt);
    }
    addCurve(torso, [[-0.103 * bx, 0.374, 0.118 * bz],
      [-0.065 * bx, 0.337, 0.191 * bz], [0, 0.316, 0.201 * bz],
      [0.065 * bx, 0.337, 0.191 * bz], [0.103 * bx, 0.374, 0.118 * bz]],
    0.0045, edge);
    const belt = new T.Mesh(softCylinderGeo(0.128 * bx, 0.135 * bx, 0.037),
      name === 'CLARA' ? leather : stdMat('#25242a', { roughness: 0.72 }));
    belt.position.y = 0.018; belt.scale.z = 0.84 * bz; torso.add(belt);
    const buckle = new T.Mesh(roundedBoxGeo(0.040, 0.028, 0.010), metal);
    buckle.position.set(0, 0.018, 0.116 * bz); torso.add(buckle);
    if (name === 'LARA') {
      const choker = new T.Mesh(new T.TorusGeometry(0.046, 0.007, 10, 36),
        stdMat('#0e0e12', { roughness: 0.46, clearcoat: 0.2 }));
      choker.rotation.x = Math.PI / 2; choker.position.y = 0.536; torso.add(choker);
      // Corrente prateada caída do passante lateral do cinto.
      addCurve(torso, [[-0.138 * bx, 0.025, 0.074], [-0.166 * bx, -0.012, 0.092],
        [-0.095 * bx, -0.050, 0.133], [-0.033 * bx, 0.019, 0.128]], 0.0038, metal);
    }
  }

  // ==========================================================================
  // Pescoço anatômico e Cabeça esculpida (proporção e rosto por idade!)
  // ==========================================================================
  const neckW = spec.athletic ? 0.052 : spec.feminine ? 0.041 : 0.045;
  const neckGeo = taperedLimbGeo(neckW * 0.92, neckW, neckW * 1.24, 0.115);
  const neck = addOutline(addShadow(new T.Mesh(neckGeo, matSkin)), 0.0038);
  neck.position.set(0, 0.502, 0.004);
  neck.rotation.x = 0.05;
  torso.add(neck);

  const headPivot = new T.Group();
  headPivot.position.set(0, 0.54, 0);
  const headFactor = 0.82; // crânio + cabelo: cerca de 1/7,5 da altura total
  headPivot.scale.setScalar(headFactor);
  torso.add(headPivot);

  // Escultura craniana diferenciando jovens adultos e adultos maduros
  const headGeo = new T.SphereGeometry(0.143, 48, 36);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);

    if (y < 0) {
      const tLow = clamp(-y / 0.143, 0, 1);
      // Bruno (40): mandíbula mais quadrada; Helena (34): rosto alongado.
      const jawFactor = spec.athletic ? 0.08 : spec.mature && spec.feminine ? 0.25 : spec.feminine ? 0.22 : 0.13;
      const jawTaper = 1 - tLow * jawFactor;
      x *= jawTaper;
      if (spec.athletic && tLow > 0.35 && tLow < 0.85) {
        // Ângulo mandibular masculino adulto mais marcado
        x *= 1.04;
      }
      if (z > 0) z *= 1 - tLow * (spec.mature ? 0.03 : 0.045);
    }

    // Maçãs do rosto mais esculpidas nos adultos maduros
    const cheek = Math.exp(-Math.pow((y + 0.016) / 0.040, 2)) * clamp(z / 0.143, 0, 1);
    const cheekBoost = spec.mature ? (spec.feminine ? 0.052 : 0.036) : spec.feminine ? 0.034 : 0.020;
    x *= 1 + cheek * cheekBoost;

    // Arco superciliar levemente mais pronunciado em homens adultos (Bruno)
    if (spec.athletic && z > 0.06) {
      const browRidge = Math.exp(-Math.pow((y - 0.046) / 0.022, 2));
      z += browRidge * 0.008;
    }

    hPos.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();

  const headMesh = addShadow(new T.Mesh(headGeo, matSkin));
  headMesh.position.set(0, 0.13, 0);
  headMesh.scale.set(...spec.headScale);
  addOutline(headMesh, 0.0048);
  headPivot.add(headMesh);

  // Queixo esculpido conforme idade/gênero
  const chinR = spec.athletic ? 0.058 : spec.feminine ? 0.045 : 0.053;
  const chin = new T.Mesh(new T.SphereGeometry(chinR, 28, 20), matSkin);
  chin.position.set(0, spec.mature ? 0.022 : 0.028, 0.056);
  chin.scale.set(spec.athletic ? 1.18 : spec.feminine ? 0.90 : 1.06, 0.82, 0.92);
  headPivot.add(chin);

  // Orelhas com contorno suave
  for (const sx of [-1, 1]) {
    const ear = addShadow(new T.Mesh(new T.SphereGeometry(0.025, 24, 16), matSkin));
    ear.position.set(sx * 0.132 * spec.headScale[0], 0.125, -0.008);
    ear.scale.set(0.48, 1.12, 0.74);
    addOutline(ear, 0.0030);
    headPivot.add(ear);
  }

  // Nariz esculpido (ponte + ponta + abas)
  const noseW = spec.feminine ? 0.0092 : spec.athletic ? 0.0124 : 0.0112;
  const noseBridge = new T.Mesh(new T.CapsuleGeometry(noseW, spec.mature ? 0.032 : 0.028, 10, 16), matSkin);
  noseBridge.position.set(0, 0.126, 0.127);
  noseBridge.rotation.x = -0.22;
  headPivot.add(noseBridge);

  const noseTip = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.0130 : spec.athletic ? 0.0162 : 0.0150, 24, 16), matSkin);
  noseTip.position.set(0, 0.106, 0.136);
  noseTip.scale.set(0.92, 0.84, 0.96);
  headPivot.add(noseTip);

  for (const sx of [-1, 1]) {
    const wing = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.0074 : 0.0090, 20, 14), matSkin);
    wing.position.set(sx * 0.0095, 0.103, 0.130);
    wing.scale.set(1.0, 0.75, 0.85);
    headPivot.add(wing);
  }

  // ==========================================================================
  // Olhos expressivos, mais alongados e firmes nos adultos maduros
  // ==========================================================================
  const eyes = [];
  const eyeBalls = [];
  const matEyeWhite = stdMat('#fafbfd', { roughness: 0.20 });
  const matLimbal = stdMat('#141218', { roughness: 0.20 });
  const matIris = stdMat(spec.iris, { roughness: 0.16, metalness: 0.06 });
  const matPupil = stdMat('#07080d', { roughness: 0.06 });
  const matHighlight = new T.MeshBasicMaterial({ color: '#ffffff' });
  const matLash = stdMat('#131018', { roughness: 0.65 });

  const eyeYScale = spec.eyeScaleY ?? 1.0;
  const eyeBaseRadius = spec.mature ? 0.0228 : 0.0242;

  for (const sx of [-1, 1]) {
    const eyeGroup = new T.Group();
    eyeGroup.position.set(sx * (spec.mature ? 0.045 : 0.047), 0.146, 0.117);
    headPivot.add(eyeGroup);

    const sclera = new T.Mesh(new T.SphereGeometry(eyeBaseRadius, 28, 20), matEyeWhite);
    sclera.scale.set(1.10, 1.0 * eyeYScale, 0.70);
    eyeGroup.add(sclera);

    const eyeBall = new T.Group();
    eyeGroup.add(eyeBall);

    const irisR = spec.mature ? 0.0132 : 0.0142;
    const limbal = new T.Mesh(new T.SphereGeometry(irisR + 0.0014, 24, 18), matLimbal);
    limbal.position.set(0, 0, 0.0114);
    limbal.scale.set(1.0, 1.02, 0.46);
    eyeBall.add(limbal);

    const iris = new T.Mesh(new T.SphereGeometry(irisR, 24, 18), matIris);
    iris.position.set(0, 0, 0.0124);
    iris.scale.set(1.0, 1.02, 0.50);
    eyeBall.add(iris);

    const pupil = new T.Mesh(new T.SphereGeometry(spec.mature ? 0.0074 : 0.0080, 20, 16), matPupil);
    pupil.position.set(0, 0, 0.0166);
    pupil.scale.set(1, 1, 0.45);
    eyeBall.add(pupil);

    const glint = new T.Mesh(new T.SphereGeometry(0.0038, 8, 6), matHighlight);
    glint.position.set(0.0048, 0.0052, 0.0192);
    eyeBall.add(glint);

    const glint2 = new T.Mesh(new T.SphereGeometry(0.0019, 6, 6), matHighlight);
    glint2.position.set(-0.0042, -0.0038, 0.0188);
    eyeBall.add(glint2);

    const lash = new T.Mesh(
      new T.TorusGeometry(eyeBaseRadius, spec.feminine ? 0.0036 : 0.0022, 6, 14, Math.PI * 0.88),
      matLash
    );
    lash.position.set(0, 0.0045 * eyeYScale, 0.0082);
    lash.scale.set(1.04, eyeYScale, 1);
    lash.rotation.z = Math.PI * 0.06;
    eyeGroup.add(lash);

    if (spec.feminine) {
      for (let c = 0; c < 3; c++) {
        const flick = new T.Mesh(new T.ConeGeometry(0.0023, 0.0115 - c * 0.0016, 5), matLash);
        flick.position.set(sx * (0.020 + c * 0.0024), (0.010 - c * 0.0030) * eyeYScale, 0.0105 - c * 0.0014);
        flick.rotation.z = -sx * (0.78 + c * 0.24);
        flick.rotation.x = -0.20;
        eyeGroup.add(flick);
      }
      const lowerLash = new T.Mesh(new T.TorusGeometry(eyeBaseRadius - 0.001, 0.0014, 5, 10, Math.PI * 0.45), matLash);
      lowerLash.position.set(sx * 0.003, -0.003 * eyeYScale, 0.0072);
      lowerLash.rotation.z = sx > 0 ? -Math.PI * 0.42 : -Math.PI * 0.98;
      eyeGroup.add(lowerLash);
    }

    eyes.push(eyeGroup);
    eyeBalls.push(eyeBall);
  }

  // Sobrancelhas arqueadas expressivas
  const matBrow = stdMat(spec.hair, { roughness: 0.74 });
  function makeBrow(side) {
    const g = new T.Group();
    g.position.set(side * (spec.mature ? 0.046 : 0.048), spec.mature ? 0.184 : 0.186, 0.123);
    const thick = spec.feminine ? (spec.mature ? 0.0038 : 0.0044) : spec.athletic ? 0.0070 : 0.0060;
    const inner = new T.Mesh(new T.CapsuleGeometry(thick, 0.024, 8, 16), matBrow);
    inner.rotation.z = Math.PI / 2 - side * (spec.mature && spec.feminine ? 0.18 : 0.14);
    inner.position.set(-side * 0.010, 0.001, 0.002);
    g.add(inner);

    const outer = new T.Mesh(new T.CapsuleGeometry(thick * 0.80, 0.020, 8, 16), matBrow);
    outer.rotation.z = Math.PI / 2 + side * (spec.mature && spec.feminine ? 0.30 : 0.26);
    outer.position.set(side * 0.012, -0.001, -0.002);
    g.add(outer);

    headPivot.add(g);
    return g;
  }
  const browL = makeBrow(-1);
  const browR = makeBrow(1);

  // Boca animada com arco do cupido, dentes e lábios
  const mouthGroup = new T.Group();
  mouthGroup.position.set(0, spec.mature ? 0.066 : 0.068, 0.122);
  headPivot.add(mouthGroup);

  const mouthInner = new T.Mesh(
    new T.SphereGeometry(0.024, 10, 8),
    stdMat('#3a131c', { roughness: 0.90 })
  );
  mouthInner.scale.set(1.10, 0.18, 0.50);
  mouthGroup.add(mouthInner);

  const mouthTeeth = new T.Mesh(
    roundedBoxGeo(0.028, 0.007, 0.008),
    stdMat('#f4f1ea', { roughness: 0.30 })
  );
  mouthTeeth.position.set(0, 0.003, 0.005);
  mouthTeeth.visible = false;
  mouthGroup.add(mouthTeeth);

  const matLip = stdMat(spec.lip, { roughness: spec.feminine ? 0.36 : 0.54 });
  const mouthUpper = new T.Group();
  mouthGroup.add(mouthUpper);
  for (const sx of [-1, 1]) {
    const uHalf = new T.Mesh(new T.CapsuleGeometry(spec.feminine ? 0.0046 : 0.0042, 0.018, 8, 16), matLip);
    uHalf.rotation.z = Math.PI / 2 + sx * 0.18;
    uHalf.position.set(sx * 0.010, 0.0042, 0.0085);
    mouthUpper.add(uHalf);
  }

  const mouthLip = new T.Mesh(
    new T.CapsuleGeometry(spec.feminine ? 0.0062 : 0.0052, 0.032, 8, 16),
    matLip
  );
  mouthLip.rotation.z = Math.PI / 2;
  mouthLip.position.set(0, -0.0055, 0.009);
  mouthGroup.add(mouthLip);

  // ==========================================================================
  // Traços faciais e acessórios de cabeça únicos de cada personagem
  // ==========================================================================
  if (name === 'ANTONY') {
    // ÓCULOS DE PROTEÇÃO INDUSTRIAL TRANSPARENTES COM HASTE LARANJA NA TESTA!
    const goggleGroup = new T.Group();
    goggleGroup.position.set(0, 0.228, 0.002);
    goggleGroup.rotation.x = -0.28; // assentado na testa, limpo acima das sobrancelhas!
    headPivot.add(goggleGroup);

    const gOrange = stdMat('#f26a1b', { roughness: 0.34, metalness: 0.12 });
    const gDark = stdMat('#1c2028', { roughness: 0.56 });
    const gLensMat = stdMat('#d8f0ff', {
      roughness: 0.06,
      metalness: 0.18,
      transparent: true,
      opacity: 0.34,
      side: T.DoubleSide,
    });

    // Tira elástica preta envolvendo o crânio
    const strap = new T.Mesh(new T.TorusGeometry(0.132, 0.010, 8, 26), gDark);
    strap.rotation.x = Math.PI / 2;
    strap.scale.set(0.95, 1.0, 0.92);
    strap.position.set(0, 0.004, -0.010);
    goggleGroup.add(strap);

    // Armação envolvente laranja + lentes duplas transparentes de proteção
    for (const sx of [-1, 1]) {
      const frame = addOutline(
        new T.Mesh(new T.TorusGeometry(0.036, 0.0072, 8, 18), gOrange),
        0.0018
      );
      frame.position.set(sx * 0.046, 0, 0.126);
      frame.rotation.y = sx * 0.22;
      frame.scale.set(1.16, 0.78, 1.0);
      goggleGroup.add(frame);

      const lens = new T.Mesh(new T.CircleGeometry(0.034, 16), gLensMat);
      lens.position.set(sx * 0.046, 0, 0.127);
      lens.rotation.y = sx * 0.22;
      lens.scale.set(1.14, 0.76, 1.0);
      goggleGroup.add(lens);

      // Haste lateral laranja ligando à tira
      const sideArm = addOutline(
        new T.Mesh(roundedBoxGeo(0.012, 0.024, 0.062), gOrange),
        0.0016
      );
      sideArm.position.set(sx * 0.118, 0.002, 0.078);
      sideArm.rotation.y = -sx * 0.32;
      goggleGroup.add(sideArm);
    }

    // Ponte nasal + barra superior da armação laranja
    const topBar = addOutline(new T.Mesh(roundedBoxGeo(0.140, 0.011, 0.014), gOrange), 0.0016);
    topBar.position.set(0, 0.025, 0.128);
    goggleGroup.add(topBar);
    const bridge = new T.Mesh(roundedBoxGeo(0.028, 0.010, 0.012), gDark);
    bridge.position.set(0, 0.002, 0.132);
    goggleGroup.add(bridge);
  } else if (name === 'HELENA') {
    // Brincos dourados elegantes + sutis linhas de contorno maduro (34 anos)
    for (const sx of [-1, 1]) {
      const hoop = new T.Mesh(new T.TorusGeometry(0.018, 0.0032, 8, 18), matGold);
      hoop.position.set(sx * 0.121, 0.094, 0.003);
      hoop.rotation.y = Math.PI / 2 + sx * 0.22;
      headPivot.add(hoop);

      // Sutil contorno sob a maçã do rosto / sulco suave que dá maturidade elegante aos 34 anos
      const cheekShade = new T.Mesh(
        new T.SphereGeometry(0.016, 8, 6),
        stdMat('#a67760', { roughness: 0.75, transparent: true, opacity: 0.22, depthWrite: false })
      );
      cheekShade.position.set(sx * 0.064, 0.096, 0.098);
      cheekShade.scale.set(1.25, 0.55, 0.45);
      cheekShade.rotation.z = sx * 0.36;
      headPivot.add(cheekShade);
    }
  } else if (name === 'BRUNO') {
    // Sombra de barba rala ao longo da mandíbula, queixo e buço
    const stubbleMat = stdMat('#583c2c', {
      roughness: 0.88,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const jawStubble = new T.Mesh(
      new T.SphereGeometry(0.118, 16, 12, -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.56, Math.PI * 0.34),
      stubbleMat
    );
    jawStubble.position.set(0, 0.106, 0.022);
    jawStubble.scale.set(0.92, 0.94, 0.98);
    headPivot.add(jawStubble);

    const chinStubble = new T.Mesh(new T.SphereGeometry(0.056, 12, 10), stubbleMat);
    chinStubble.position.set(0, 0.026, 0.062);
    chinStubble.scale.set(1.12, 0.78, 0.88);
    headPivot.add(chinStubble);

    const mustacheStubble = new T.Mesh(roundedBoxGeo(0.052, 0.010, 0.014), stubbleMat);
    mustacheStubble.position.set(0, 0.084, 0.128);
    headPivot.add(mustacheStubble);
  } else if (name === 'CLARA') {
    // Sardas discretas e argolas douradas.
    const matFreckle = stdMat('#8a4b2e', { roughness: 0.72 });
    const frecklePos = [
      [-0.012, 0.114, 0.136], [0.010, 0.115, 0.136],
      [-0.042, 0.107, 0.123], [-0.054, 0.103, 0.118],
      [0.042, 0.107, 0.123], [0.054, 0.103, 0.118],
    ];
    for (const [fx, fy, fz] of frecklePos) {
      const dot = new T.Mesh(new T.SphereGeometry(0.0028, 6, 6), matFreckle);
      dot.position.set(fx, fy, fz);
      dot.scale.set(1, 1, 0.5);
      headPivot.add(dot);
    }
    for (const sx of [-1, 1]) {
      const hoop = new T.Mesh(new T.TorusGeometry(0.019, 0.003, 10, 28), matGold);
      hoop.position.set(sx * 0.125, 0.090, 0.003);
      hoop.rotation.y = Math.PI / 2 + sx * 0.20;
      headPivot.add(hoop);
    }
  }

  // Cabelo esculpido
  const hairGroup = buildHair(headPivot, name, matSkin);

  // ==========================================================================
  // Braços articulados com ombro arredondado, punho, luvas e relógio
  // ==========================================================================
  function makeArm(side) {
    const bare = name === 'CLARA' || name === 'LARA';
    const sleeveMat = bare ? matSkin : matShirt;
    const shoulder = new T.Group();
    shoulder.position.set(side * (spec.athletic ? 0.205 : spec.feminine ? 0.163 : 0.184) * bx, 0.402, 0);
    torso.add(shoulder);
    const upperR = spec.athletic ? 0.057 : spec.feminine ? 0.044 : 0.050;
    const lowerR = spec.athletic ? 0.046 : spec.feminine ? 0.035 : 0.041;
    // Sobreposição interna das juntas: o contorno externo permanece contínuo ao girar.
    const cap = addShadow(new T.Mesh(new T.SphereGeometry(upperR * 1.08, 32, 24), sleeveMat));
    cap.position.y = -0.026;
    cap.scale.set(1, 1.15, 0.94);
    shoulder.add(cap);
    const upper = addShadow(new T.Mesh(
      taperedLimbGeo(upperR * 1.04, upperR, lowerR * 1.03, 0.246), sleeveMat));
    upper.position.y = -0.123;
    shoulder.add(upper);
    const elbow = new T.Group();
    elbow.position.y = -0.235;
    shoulder.add(elbow);
    const elbowFill = addShadow(new T.Mesh(new T.SphereGeometry(lowerR * 1.04, 28, 20), sleeveMat));
    elbow.add(elbowFill);
    const lower = addShadow(new T.Mesh(
      taperedLimbGeo(lowerR * 1.06, lowerR * 0.99, lowerR * 0.73, 0.220), sleeveMat));
    lower.position.y = -0.113;
    elbow.add(lower);
    if (!bare) {
      const cuff = new T.Mesh(softCylinderGeo(lowerR * 0.83, lowerR * 0.81, 0.030),
        stdMat(name === 'ANTONY' ? '#c65920' : name === 'BRUNO' ? '#204a82' : '#691b34',
          { roughness: 0.76 }));
      cuff.position.y = -0.206;
      elbow.add(cuff);
      const fold = stdMat(name === 'ANTONY' ? '#d75c1d' : name === 'BRUNO' ? '#204b85' : '#742039',
        { roughness: 0.80 });
      for (let i = 0; i < 3; i++) {
        const wrinkle = new T.Mesh(new T.TorusGeometry(lowerR * (1.03 + i * 0.015), 0.0025, 8, 28), fold);
        wrinkle.position.y = -0.147 - i * 0.025;
        wrinkle.rotation.x = Math.PI / 2 + (i - 1) * 0.10;
        elbow.add(wrinkle);
      }
    }
    const hand = new T.Group();
    hand.position.y = -0.222;
    elbow.add(hand);
    const hs = spec.athletic ? 1.08 : spec.feminine ? 0.95 : 1;
    const wrist = new T.Mesh(new T.SphereGeometry(0.022 * hs, 22, 16), matSkin);
    wrist.scale.set(0.80, 1.05, 0.68);
    wrist.position.y = -0.006;
    hand.add(wrist);
    const palm = addShadow(new T.Mesh(new T.SphereGeometry(0.040 * hs, 30, 20), matSkin));
    palm.position.set(0, -0.045, 0.003);
    palm.scale.set(0.91, 1.15, 0.49);
    hand.add(palm);
    const thumbRoot = new T.Group();
    thumbRoot.position.set(-side * 0.031 * hs, -0.031, 0.016);
    thumbRoot.rotation.z = -side * 0.42;
    hand.add(thumbRoot);
    const thumb = new T.Mesh(new T.CapsuleGeometry(0.010 * hs, 0.029 * hs, 8, 16), matSkin);
    thumb.position.y = -0.023;
    thumbRoot.add(thumb);
    const indexPivot = new T.Group();
    indexPivot.position.set(-side * 0.023 * hs, -0.083, 0.004);
    hand.add(indexPivot);
    const otherFingers = new T.Group();
    otherFingers.position.set(0, -0.083, 0.004);
    hand.add(otherFingers);
    const fingerLengths = [0.061, 0.071, 0.065, 0.053];
    for (let i = 0; i < 4; i++) {
      const parent = i === 0 ? indexPivot : otherFingers;
      const finger = new T.Group();
      finger.position.x = i === 0 ? 0 : side * (i - 1) * 0.015 * hs;
      finger.rotation.z = side * (i - 1.4) * 0.050;
      parent.add(finger);
      const r = (i === 1 ? 0.0082 : 0.0072) * hs;
      const len = fingerLengths[i] * hs;
      const phalanx = new T.Mesh(new T.CapsuleGeometry(r, len * 0.52, 8, 14), matSkin);
      phalanx.position.y = -len * 0.31;
      finger.add(phalanx);
      const tip = new T.Mesh(new T.CapsuleGeometry(r * 0.84, len * 0.25, 8, 14), matSkin);
      tip.position.y = -len * 0.73;
      finger.add(tip);
    }
    if (name === 'ANTONY' && side === 1) {
      const band = new T.Mesh(softCylinderGeo(0.033, 0.033, 0.024), darkTrim);
      band.position.y = -0.210; elbow.add(band);
      const face = new T.Mesh(roundedBoxGeo(0.026, 0.031, 0.010),
        stdMat('#f26a1b', { roughness: 0.32, clearcoat: 0.25 }));
      face.position.set(0.034, -0.210, 0); elbow.add(face);
    }
    if (name === 'HELENA' && side === 1) {
      const band = new T.Mesh(softCylinderGeo(0.030, 0.030, 0.015), matGold);
      band.position.y = -0.210; elbow.add(band);
    }
    return { shoulder, elbow, hand, indexPivot, otherFingers, baseShoulderY: 0.402 };
  }

  const armL = makeArm(1);
  const armR = makeArm(-1);

  // ==========================================================================
  // Pernas articuladas e calçados modelados (pés assentados em y = 0)
  // ==========================================================================
  function makeLeg(side) {
    const flare = name === 'CLARA';
    const skinny = name === 'LARA' || name === 'HELENA';
    const hip = new T.Group();
    hip.position.set(side * (spec.feminine ? 0.105 : 0.094) * bx, -0.021, 0);
    pelvis.add(hip);
    const thighR = spec.feminine ? 0.091 : spec.athletic ? 0.079 : 0.071;
    const kneeR = spec.feminine ? 0.057 : spec.athletic ? 0.060 : 0.053;
    const thigh = addShadow(new T.Mesh(taperedLimbGeo(thighR, thighR * 1.03, kneeR, 0.388), matPants));
    thigh.position.y = -0.190;
    hip.add(thigh);
    const knee = new T.Group();
    knee.position.y = -0.376;
    hip.add(knee);
    const kneeFill = addShadow(new T.Mesh(new T.SphereGeometry(kneeR * 1.04, 28, 20), matPants));
    kneeFill.scale.set(1, 1.05, 0.92);
    knee.add(kneeFill);
    const ankleR = flare ? 0.083 : skinny ? 0.036 : 0.044;
    const shin = addShadow(new T.Mesh(taperedLimbGeo(kneeR * 1.03,
      flare ? 0.064 : kneeR * 0.86, ankleR, 0.370), matPants));
    shin.position.y = -0.181;
    knee.add(shin);
    // Vincos e costuras acompanham o tecido, sem discos de junta aparentes.
    const foldMat = stdMat(name === 'CLARA' ? '#244d82' : name === 'BRUNO' ? '#a9957e' : '#252932',
      { roughness: 0.90 });
    for (const y of [-0.060, -0.310]) {
      const fold = new T.Mesh(new T.TorusGeometry(y > -0.2 ? kneeR * 1.035 : ankleR * 1.015,
        0.0022, 8, 32), foldMat);
      fold.position.y = y;
      fold.rotation.x = Math.PI / 2 + 0.14 * side;
      knee.add(fold);
    }
    if (name === 'ANTONY') {
      const cargo = new T.Mesh(roundedBoxGeo(0.026, 0.097, 0.081), matPants);
      cargo.position.set(side * thighR * 0.95, -0.203, 0.003);
      hip.add(cargo);
      const flap = new T.Mesh(roundedBoxGeo(0.029, 0.014, 0.084), foldMat);
      flap.position.set(side * thighR, -0.158, 0.003); hip.add(flap);
    }
    if (flare) {
      const seam = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(side * 0.056, -0.025, 0.069),
        new T.Vector3(side * 0.048, -0.18, 0.064),
        new T.Vector3(side * 0.060, -0.348, 0.061),
      ]), 20, 0.002, 8, false), foldMat);
      knee.add(seam);
    }
    const shoe = new T.Group();
    shoe.position.set(0, -0.405, 0.017);
    knee.add(shoe);
    const boot = name === 'LARA' || name === 'ANTONY';
    const soleH = name === 'LARA' ? 0.034 : boot ? 0.025 : 0.018;
    const soleMat = stdMat(name === 'CLARA' ? '#e5e4e2' : '#17171b',
      { roughness: name === 'LARA' ? 0.46 : 0.82, clearcoat: name === 'LARA' ? 0.18 : 0 });
    const shaft = addShadow(new T.Mesh(taperedLimbGeo(boot ? 0.051 : 0.043,
      boot ? 0.052 : 0.048, 0.045, boot ? 0.115 : 0.071), matShoes));
    shaft.position.set(0, boot ? 0.025 : 0.003, -0.013);
    shoe.add(shaft);
    const toe = addShadow(new T.Mesh(new T.SphereGeometry(0.048, 28, 20), matShoes));
    toe.position.set(0, -0.008, 0.064);
    toe.scale.set(1.00, 0.68, 1.50);
    shoe.add(toe);
    const sole = new T.Mesh(roundedBoxGeo(0.104, soleH, 0.202, 0.010), soleMat);
    sole.position.set(0, -0.045 + soleH * 0.5, 0.032);
    shoe.add(sole);
    const laceMat = stdMat(name === 'CLARA' ? '#f7f7f6' : '#b7a99a', { roughness: 0.75 });
    for (let i = 0; i < (boot ? 5 : 3); i++) {
      const lace = new T.Mesh(roundedBoxGeo(0.039, 0.0035, 0.006), laceMat);
      lace.position.set(0, 0.031 - i * 0.014, 0.031 + i * 0.008);
      shoe.add(lace);
    }
    return { hip, knee, shoe };
  }

  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  return {
    name,
    root,
    body,
    pelvis,
    torso,
    head: headPivot,
    headPivot,
    browL,
    browR,
    eyes,
    eyeBalls,
    mouth: mouthInner,
    mouthGroup,
    mouthInner,
    mouthUpper,
    mouthLip,
    mouthTeeth,
    hairGroup,
    armL,
    armR,
    arms: [armL.shoulder, armR.shoulder],
    legL,
    legR,
    scale,
    headY: (0.84 + 0.05 + 0.54 + 0.146 * headFactor) * scale,
    feminine: !!spec.feminine,
  };
}

// ============================================================================
// Análise determinística de falas (utterances + lipsync + falante ativo)
// ============================================================================
const utterancesCache = new WeakMap();

function getUtterances(words) {
  if (!Array.isArray(words) || words.length === 0) return [];
  let cached = utterancesCache.get(words);
  if (cached) return cached;

  const utts = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const spk = String(w.speaker || w.nome || '').toUpperCase();
    const s = Number(w.start);
    const e = Number(w.end);
    if (!spk || !Number.isFinite(s) || !Number.isFinite(e)) continue;
    const prev = utts[utts.length - 1];
    if (prev && prev.speaker === spk && s - prev.end < 0.58) {
      prev.end = Math.max(prev.end, e);
      prev.words.push({ s, e });
    } else {
      utts.push({ index: utts.length, speaker: spk, start: s, end: e, words: [{ s, e }] });
    }
  }
  utterancesCache.set(words, utts);
  return utts;
}

function getSpeechInfo(utts, t) {
  let activeSpeaker = null;
  let activeWeight = 0;
  let activeUttIndex = -1;
  const weights = {};
  const uttIdxBySpeaker = {};
  const mouthOpenBySpeaker = {};

  for (let i = 0; i < utts.length; i++) {
    const u = utts[i];
    if (t < u.start - 0.25) break;
    if (t > u.end + 0.40) continue;

    const env = smoothstep(u.start - 0.18, u.start + 0.14, t) * (1 - smoothstep(u.end - 0.04, u.end + 0.34, t));
    if (env > (weights[u.speaker] || 0)) {
      weights[u.speaker] = env;
      uttIdxBySpeaker[u.speaker] = u.index;
    }
    if (env > activeWeight) {
      activeWeight = env;
      activeSpeaker = u.speaker;
      activeUttIndex = u.index;
    }

    // Lipsync natural por palavra ativa
    if (t >= u.start - 0.02 && t <= u.end + 0.04) {
      for (let k = 0; k < u.words.length; k++) {
        const w = u.words[k];
        if (t >= w.s - 0.01 && t <= w.e + 0.03) {
          const dur = Math.max(0.06, w.e - w.s);
          const p = clamp((t - w.s) / dur, 0, 1);
          const arch = Math.sin(p * Math.PI);
          const syll = 0.65 + 0.35 * Math.abs(Math.sin(t * 17.5 + k * 1.9));
          mouthOpenBySpeaker[u.speaker] = Math.max(mouthOpenBySpeaker[u.speaker] || 0, clamp(0.18 + arch * syll * 0.78, 0, 1));
          break;
        }
      }
    }
  }

  return { activeSpeaker, activeWeight, activeUttIndex, weights, uttIdxBySpeaker, mouthOpenBySpeaker };
}

// ============================================================================
// Estado numérico de pose para transições suaves e 100% determinísticas
// ============================================================================
function makeNeutralState() {
  return {
    bodyX: 0, bodyY: 0, bodyZ: 0,
    bodyRotX: 0, bodyRotY: 0, bodyRotZ: 0,
    pelvisX: 0, pelvisRotZ: 0,
    torsoY: 0.05, torsoRotX: 0.02, torsoRotY: 0, torsoRotZ: 0,
    breathScale: 1,
    shoulderLift: 0,
    armL: { sx: 0.04, sy: 0, sz: 0.10, ex: -0.16, ey: 0, ez: 0, hx: 0, hy: 0, hz: 0, curl: 0.32, point: 0 },
    armR: { sx: 0.04, sy: 0, sz: -0.10, ex: -0.16, ey: 0, ez: 0, hx: 0, hy: 0, hz: 0, curl: 0.32, point: 0 },
    legL: { hx: 0, hy: 0, hz: 0, kx: 0 },
    legR: { hx: 0, hy: 0, hz: 0, kx: 0 },
    headX: 0, headY: 0, headZ: 0,
    browLY: 0.186, browRY: 0.186, browLZ: 0.03, browRZ: -0.03,
    mouthGasp: 0,
    mouthTilt: 0,
  };
}

function lerpArm(a, b, u) {
  return {
    sx: lerp(a.sx, b.sx, u),
    sy: lerp(a.sy, b.sy, u),
    sz: lerp(a.sz, b.sz, u),
    ex: lerp(a.ex, b.ex, u),
    ey: lerp(a.ey, b.ey, u),
    ez: lerp(a.ez, b.ez, u),
    hx: lerp(a.hx, b.hx, u),
    hy: lerp(a.hy, b.hy, u),
    hz: lerp(a.hz, b.hz, u),
    curl: lerp(a.curl, b.curl, u),
    point: lerp(a.point, b.point, u),
  };
}

function lerpLeg(a, b, u) {
  return {
    hx: lerp(a.hx, b.hx, u),
    hy: lerp(a.hy, b.hy, u),
    hz: lerp(a.hz, b.hz, u),
    kx: lerp(a.kx, b.kx, u),
  };
}

function lerpPoseState(a, b, u) {
  return {
    bodyX: lerp(a.bodyX, b.bodyX, u),
    bodyY: lerp(a.bodyY, b.bodyY, u),
    bodyZ: lerp(a.bodyZ, b.bodyZ, u),
    bodyRotX: lerp(a.bodyRotX, b.bodyRotX, u),
    bodyRotY: lerp(a.bodyRotY, b.bodyRotY, u),
    bodyRotZ: lerp(a.bodyRotZ, b.bodyRotZ, u),
    pelvisX: lerp(a.pelvisX, b.pelvisX, u),
    pelvisRotZ: lerp(a.pelvisRotZ, b.pelvisRotZ, u),
    torsoY: lerp(a.torsoY, b.torsoY, u),
    torsoRotX: lerp(a.torsoRotX, b.torsoRotX, u),
    torsoRotY: lerp(a.torsoRotY, b.torsoRotY, u),
    torsoRotZ: lerp(a.torsoRotZ, b.torsoRotZ, u),
    breathScale: lerp(a.breathScale, b.breathScale, u),
    shoulderLift: lerp(a.shoulderLift, b.shoulderLift, u),
    armL: lerpArm(a.armL, b.armL, u),
    armR: lerpArm(a.armR, b.armR, u),
    legL: lerpLeg(a.legL, b.legL, u),
    legR: lerpLeg(a.legR, b.legR, u),
    headX: lerp(a.headX, b.headX, u),
    headY: lerp(a.headY, b.headY, u),
    headZ: lerp(a.headZ, b.headZ, u),
    browLY: lerp(a.browLY, b.browLY, u),
    browRY: lerp(a.browRY, b.browRY, u),
    browLZ: lerp(a.browLZ, b.browLZ, u),
    browRZ: lerp(a.browRZ, b.browRZ, u),
    mouthGasp: lerp(a.mouthGasp, b.mouthGasp, u),
    mouthTilt: lerp(a.mouthTilt, b.mouthTilt, u),
  };
}

function setMoodOnState(st, mood) {
  if (mood === 'scared') {
    st.browLZ = 0.28;
    st.browRZ = -0.28;
    st.browLY = 0.194;
    st.browRY = 0.194;
    st.mouthGasp = 0.22;
    st.mouthTilt = -0.06;
  } else if (mood === 'urgent') {
    st.browLZ = -0.22;
    st.browRZ = 0.22;
    st.browLY = 0.181;
    st.browRY = 0.181;
    st.mouthTilt = -0.02;
  } else if (mood === 'sarcastic') {
    st.browLZ = 0.16;
    st.browRZ = 0.04;
    st.browLY = 0.191;
    st.browRY = 0.183;
    st.mouthTilt = 0.09;
  } else if (mood === 'suspicious') {
    st.browLZ = -0.14;
    st.browRZ = 0.16;
    st.browLY = 0.182;
    st.browRY = 0.189;
    st.mouthTilt = 0.03;
  } else {
    st.browLZ = 0.04;
    st.browRZ = -0.04;
    st.browLY = 0.186;
    st.browRY = 0.186;
  }
}

// ============================================================================
// Avaliação completa de pose: idle vivo + fala gesticulada + reações de escuta
// ============================================================================
function evaluatePoseState(a, pose, t, phase, ctx) {
  const st = makeNeutralState();

  // Caído: imóvel no chão (sem respiração perceptível, sem gesticulação)
  if (pose === 'caido') {
    st.bodyY = 0.16;
    st.bodyRotX = -Math.PI / 2 + 0.08;
    st.bodyRotY = 0.25;
    st.bodyRotZ = 1.18;
    st.torsoRotX = 0.08;
    st.torsoRotY = 0.12;
    st.armL = { sx: -0.65, sy: 0, sz: 0.62, ex: -0.45, ey: 0, ez: 0, hx: 0, hy: 0, hz: 0, curl: 0.45, point: 0 };
    st.armR = { sx: -1.25, sy: 0.20, sz: -0.42, ex: -0.35, ey: 0, ez: 0, hx: 0, hy: 0, hz: 0, curl: 0.45, point: 0 };
    st.legL = { hx: -0.22, hy: 0, hz: 0.15, kx: 0.45 };
    st.legR = { hx: 0.10, hy: 0, hz: -0.18, kx: 0.20 };
    setMoodOnState(st, 'scared');
    st.mouthGasp = 0.08;
    return st;
  }

  // ---- 1) IDLE VIVO (respiração, peso trocando de perna, micro-movimentos) ----
  const breath = Math.sin(t * 2.05 + phase);
  const breathSlow = Math.sin(t * 1.02 + phase * 1.3);
  const weightShift = Math.sin(t * 0.62 + phase * 0.9) * 0.72 + Math.sin(t * 0.31 + phase) * 0.28;
  const idleHeadY = Math.sin(t * 0.78 + phase) * 0.065 + Math.sin(t * 1.48 + phase * 1.7) * 0.025;
  const idleHeadZ = Math.sin(t * 0.56 + phase * 0.8) * 0.042;
  const idleHeadX = Math.sin(t * 1.05 + phase * 0.6) * 0.028;

  st.breathScale = 1 + breath * 0.016;
  st.shoulderLift = breath * 0.0045;
  st.bodyY = breath * 0.006;

  if (pose === 'sentado') {
    st.bodyY = -0.34 + breath * 0.004;
    st.torsoRotX = 0.07 + breath * 0.018;
    st.torsoRotZ = Math.sin(t * 0.55 + phase) * 0.028;
    st.legL = { hx: -1.46, hy: 0.06, hz: 0.05, kx: 1.42 };
    st.legR = { hx: -1.46, hy: -0.06, hz: -0.05, kx: 1.42 };
    st.armL = { sx: -0.54 + breath * 0.02, sy: -0.18, sz: 0.14, ex: -0.86, ey: 0, ez: 0, hx: 0.12, hy: 0, hz: 0, curl: 0.36, point: 0 };
    st.armR = { sx: -0.54 - breath * 0.02, sy: 0.18, sz: -0.14, ex: -0.86, ey: 0, ez: 0, hx: 0.12, hy: 0, hz: 0, curl: 0.36, point: 0 };
    setMoodOnState(st, a.name === 'HELENA' ? 'suspicious' : 'neutral');
  } else if (pose === 'apontando') {
    const pulse = Math.sin(t * 3.8 + phase);
    st.pelvisX = weightShift * 0.018;
    st.torsoRotX = 0.07 + breath * 0.015;
    st.torsoRotY = 0.16 + pulse * 0.03;
    st.torsoRotZ = -0.03;
    st.armR = {
      sx: -1.34 + pulse * 0.06,
      sy: 0.10,
      sz: -0.12,
      ex: -0.18 + pulse * 0.05,
      ey: 0,
      ez: 0,
      hx: -0.05,
      hy: 0,
      hz: 0,
      curl: 0.85,
      point: 1,
    };
    st.armL = {
      sx: -0.34 - pulse * 0.04,
      sy: -0.24,
      sz: 0.18,
      ex: -0.68,
      ey: 0,
      ez: 0,
      hx: 0.1,
      hy: 0,
      hz: 0,
      curl: 0.42,
      point: 0,
    };
    st.legL = { hx: -0.08, hy: 0, hz: 0.04, kx: 0.12 };
    st.legR = { hx: 0.09, hy: 0, hz: -0.04, kx: 0.06 };
    setMoodOnState(st, 'urgent');
  } else if (pose === 'assustado') {
    const tremor = Math.sin(t * 13.5 + phase) * 0.018;
    const rapidBreath = Math.sin(t * 4.2 + phase);
    st.breathScale = 1 + rapidBreath * 0.024;
    st.shoulderLift = 0.008 + rapidBreath * 0.005;
    st.bodyY = -0.045 + rapidBreath * 0.005;

    const slot = Math.floor((t + phase * 1.1) / 4.8);
    const localU = ((t + phase * 1.1) % 4.8) / 4.8;
    const pickStyle = (s) => {
      if (a.name === 'CLARA') return [2, 0, 1, 2][Math.abs(s) % 4];
      if (a.name === 'LARA') return [1, 1, 0, 2][Math.abs(s) % 4];
      if (a.name === 'HELENA') return [0, 1, 2][Math.abs(s) % 3];
      return [2, 1, 0][Math.abs(s) % 3];
    };
    const curStyle = pickStyle(slot);
    const prevStyle = pickStyle(slot - 1);
    const blend = smoothstep(0.0, 0.14, localU);

    const buildFearSub = (style) => {
      const sub = makeNeutralState();
      sub.bodyY = st.bodyY;
      sub.breathScale = st.breathScale;
      sub.shoulderLift = st.shoulderLift;
      sub.legL = { hx: -0.14, hy: 0.05, hz: 0.06, kx: 0.26 };
      sub.legR = { hx: 0.11, hy: -0.05, hz: -0.06, kx: 0.14 };
      setMoodOnState(sub, 'scared');

      if (style === 0) {
        sub.torsoRotX = -0.07;
        sub.torsoRotY = 0.06;
        sub.torsoRotZ = tremor * 0.7;
        sub.headX = -0.05;
        sub.headZ = 0.06;
        sub.mouthGasp = 0.38;
        sub.armR = {
          sx: -1.28 + rapidBreath * 0.03,
          sy: 0.62,
          sz: -0.06,
          ex: -2.04,
          ey: 0,
          ez: 0,
          hx: 0.18,
          hy: 0.32,
          hz: 0,
          curl: 0.16,
          point: 0,
        };
        sub.armL = {
          sx: -0.34,
          sy: -0.78,
          sz: 0.14,
          ex: -1.48,
          ey: 0,
          ez: 0,
          hx: 0.15,
          hy: 0,
          hz: 0,
          curl: 0.38,
          point: 0,
        };
      } else if (style === 1) {
        sub.torsoRotX = 0.10;
        sub.torsoRotZ = tremor * 1.15;
        sub.headX = 0.08;
        sub.headZ = -0.05;
        sub.mouthGasp = 0.14;
        sub.armL = {
          sx: -0.42 + rapidBreath * 0.02,
          sy: -1.08,
          sz: 0.08,
          ex: -1.78,
          ey: 0,
          ez: 0,
          hx: 0.20,
          hy: 0,
          hz: 0,
          curl: 0.52,
          point: 0,
        };
        sub.armR = {
          sx: -0.32 - rapidBreath * 0.02,
          sy: 1.06,
          sz: -0.10,
          ex: -1.68,
          ey: 0,
          ez: 0,
          hx: 0.20,
          hy: 0,
          hz: 0,
          curl: 0.52,
          point: 0,
        };
      } else {
        sub.torsoRotX = -0.09;
        sub.torsoRotZ = tremor;
        sub.mouthGasp = 0.28;
        sub.armL = {
          sx: -0.96 + rapidBreath * 0.04,
          sy: -0.26,
          sz: 0.24,
          ex: -1.28,
          ey: 0,
          ez: 0,
          hx: -0.35,
          hy: 0,
          hz: 0,
          curl: 0.12,
          point: 0,
        };
        sub.armR = {
          sx: -0.96 - rapidBreath * 0.04,
          sy: 0.26,
          sz: -0.24,
          ex: -1.28,
          ey: 0,
          ez: 0,
          hx: -0.35,
          hy: 0,
          hz: 0,
          curl: 0.12,
          point: 0,
        };
      }
      return sub;
    };

    const fearState = curStyle === prevStyle ? buildFearSub(curStyle) : lerpPoseState(buildFearSub(prevStyle), buildFearSub(curStyle), blend);
    Object.assign(st, fearState);
  } else if (pose === 'ajoelhado') {
    st.bodyY = -0.46 + breath * 0.005;
    st.torsoRotX = 0.24 + breath * 0.02;
    st.torsoRotZ = Math.sin(t * 0.9 + phase) * 0.025;
    st.legL = { hx: -1.35, hy: 0, hz: 0.05, kx: 1.85 };
    st.legR = { hx: -0.45, hy: 0, hz: -0.05, kx: 1.65 };
    st.armL = { sx: -0.78 + breath * 0.03, sy: -0.15, sz: 0.15, ex: -0.65, ey: 0, ez: 0, hx: 0.12, hy: 0, hz: 0, curl: 0.34, point: 0 };
    st.armR = { sx: -0.92 - breath * 0.03, sy: 0.18, sz: -0.12, ex: -0.42, ey: 0, ez: 0, hx: 0.12, hy: 0, hz: 0, curl: 0.26, point: 0 };
    setMoodOnState(st, 'urgent');
  } else {
    // 'em_pe' — IDLE RICO: troca de peso de perna, contrabalanço de quadril/ombros, braços orgânicos
    const w = weightShift;
    st.pelvisX = w * 0.026;
    st.pelvisRotZ = -w * 0.045;
    st.torsoRotX = (a.name === 'ANTONY' ? 0.042 : a.name === 'HELENA' ? -0.01 : 0.025) + breath * 0.015;
    st.torsoRotY = breathSlow * 0.045;
    st.torsoRotZ = w * 0.052;

    const relaxL = Math.max(0, -w);
    const relaxR = Math.max(0, w);
    st.legL = { hx: -relaxL * 0.11, hy: 0.04, hz: 0.035 + relaxL * 0.025, kx: relaxL * 0.19 };
    st.legR = { hx: -relaxR * 0.11, hy: -0.04, hz: -0.035 - relaxR * 0.025, kx: relaxR * 0.19 };
    st.bodyY = breath * 0.006 - Math.max(relaxL, relaxR) * 0.008;

    const baseSz = a.name === 'BRUNO' ? 0.15 : a.name === 'CLARA' || a.name === 'LARA' ? 0.14 : 0.11;
    st.armL = {
      sx: 0.05 + breath * 0.03 - w * 0.04,
      sy: -0.05,
      sz: baseSz + Math.max(0, w) * 0.03,
      ex: -0.22 - breath * 0.03,
      ey: 0,
      ez: 0,
      hx: 0.06,
      hy: 0,
      hz: 0,
      curl: 0.34,
      point: 0,
    };
    st.armR = {
      sx: 0.05 - breath * 0.03 + w * 0.04,
      sy: 0.05,
      sz: -baseSz - Math.max(0, -w) * 0.03,
      ex: -0.22 + breath * 0.03,
      ey: 0,
      ez: 0,
      hx: 0.06,
      hy: 0,
      hz: 0,
      curl: 0.34,
      point: 0,
    };
    setMoodOnState(st, a.name === 'HELENA' ? 'suspicious' : a.name === 'BRUNO' ? 'urgent' : 'neutral');
  }

  st.headX += idleHeadX;
  st.headY += idleHeadY;
  st.headZ += idleHeadZ;

  // ---- 2) REAÇÕES DE QUEM ESCUTA ----
  const isListening = ctx.activeSpeaker && ctx.activeSpeaker !== a.name && ctx.activeWeight > 0.01;
  if (isListening && (pose === 'em_pe' || pose === 'sentado')) {
    const lw = ctx.activeWeight;
    const utt = ctx.activeUttIndex;
    const anyScaredInScene = ctx.anyScared;

    let reactKind = 'attentive';
    if (pose === 'em_pe') {
      if (anyScaredInScene && a.name === 'LARA') {
        reactKind = 'self_hug';
      } else if (a.name === 'HELENA') {
        reactKind = utt % 2 === 0 ? 'crossed' : 'attentive';
      } else if (a.name === 'LARA') {
        reactKind = utt % 2 === 0 ? 'self_hug' : 'crossed';
      } else if (a.name === 'BRUNO') {
        reactKind = utt % 2 === 0 ? 'crossed' : 'attentive';
      } else if (a.name === 'CLARA') {
        reactKind = anyScaredInScene ? 'hand_mouth' : 'attentive';
      } else if (a.name === 'ANTONY') {
        reactKind = utt % 3 === 0 ? 'crossed' : 'attentive';
      }
    }

    if (reactKind === 'crossed') {
      const targetL = { sx: -0.28, sy: -1.04, sz: 0.12, ex: -1.66, ey: 0, ez: -0.14, hx: 0.18, hy: 0, hz: 0, curl: 0.48, point: 0 };
      const targetR = { sx: -0.16, sy: 1.02, sz: -0.14, ex: -1.56, ey: 0, ez: 0.14, hx: 0.18, hy: 0, hz: 0, curl: 0.48, point: 0 };
      st.armL = lerpArm(st.armL, targetL, lw);
      st.armR = lerpArm(st.armR, targetR, lw);
      st.torsoRotY += 0.08 * lw;
      st.headZ += (a.name === 'HELENA' ? -0.05 : 0.05) * lw;
      st.browLZ = lerp(st.browLZ, -0.10, lw * 0.7);
      st.browRZ = lerp(st.browRZ, 0.14, lw * 0.7);
    } else if (reactKind === 'self_hug') {
      const shiver = Math.sin(t * 11.5 + phase) * 0.010;
      const targetL = { sx: -0.42, sy: -1.08, sz: 0.08, ex: -1.78, ey: 0, ez: 0, hx: 0.22, hy: 0, hz: 0, curl: 0.50, point: 0 };
      const targetR = { sx: -0.32, sy: 1.06, sz: -0.10, ex: -1.68, ey: 0, ez: 0, hx: 0.22, hy: 0, hz: 0, curl: 0.50, point: 0 };
      st.armL = lerpArm(st.armL, targetL, lw);
      st.armR = lerpArm(st.armR, targetR, lw);
      st.torsoRotX += 0.07 * lw;
      st.torsoRotZ += shiver * lw;
      st.browLY = lerp(st.browLY, 0.193, lw * 0.75);
      st.browRY = lerp(st.browRY, 0.193, lw * 0.75);
      st.browLZ = lerp(st.browLZ, 0.20, lw * 0.75);
      st.browRZ = lerp(st.browRZ, -0.20, lw * 0.75);
    } else if (reactKind === 'hand_mouth') {
      const targetR = { sx: -1.26, sy: 0.62, sz: -0.06, ex: -2.02, ey: 0, ez: 0, hx: 0.18, hy: 0.30, hz: 0, curl: 0.18, point: 0 };
      const targetL = { sx: -0.34, sy: -0.76, sz: 0.14, ex: -1.44, ey: 0, ez: 0, hx: 0.12, hy: 0, hz: 0, curl: 0.36, point: 0 };
      st.armR = lerpArm(st.armR, targetR, lw);
      st.armL = lerpArm(st.armL, targetL, lw);
      st.mouthGasp = Math.max(st.mouthGasp, 0.26 * lw);
      st.browLY = lerp(st.browLY, 0.194, lw * 0.8);
      st.browRY = lerp(st.browRY, 0.194, lw * 0.8);
      st.browLZ = lerp(st.browLZ, 0.22, lw * 0.8);
      st.browRZ = lerp(st.browRZ, -0.22, lw * 0.8);
    }

    st.headX += Math.sin(t * 2.2 + phase) * 0.045 * lw;
    st.headZ += Math.sin(t * 1.15 + phase) * 0.040 * lw;
  }

  // ---- 3) QUEM FALA GESTICULA (mãos, braços, cabeça, sobrancelhas) ----
  const sw = ctx.speakWeight;
  if (sw > 0.005) {
    const beat1 = Math.sin(t * 4.6 + phase);
    const beat2 = Math.cos(t * 2.8 + phase * 1.4);
    const beat3 = Math.sin(t * 6.4 + phase * 0.7);
    const uttIdx = ctx.speakUttIndex;

    st.headX += (0.03 + beat1 * 0.075 + beat3 * 0.025) * sw;
    st.headY += beat2 * 0.095 * sw;
    st.headZ += Math.sin(t * 2.1 + phase) * 0.068 * sw;

    st.torsoRotX += (0.035 + beat1 * 0.025) * sw;
    st.torsoRotY += beat2 * 0.065 * sw;

    const browPulse = Math.max(0, beat1) * 0.0075 + Math.max(0, beat3) * 0.003;
    st.browLY += browPulse * sw;
    st.browRY += browPulse * sw;
    if (a.name === 'HELENA' || a.name === 'BRUNO') {
      st.browLY += 0.0032 * sw;
    }

    if (pose === 'apontando') {
      st.armR.sx += beat1 * 0.12 * sw;
      st.armR.ex += beat2 * 0.10 * sw;
      st.armL.sx = lerp(st.armL.sx, -0.58 - beat2 * 0.14, sw);
      st.armL.sy = lerp(st.armL.sy, -0.22 + beat1 * 0.14, sw);
      st.armL.ex = lerp(st.armL.ex, -1.18 + beat1 * 0.18, sw);
      st.armL.curl = lerp(st.armL.curl, 0.18, sw);
    } else if (pose === 'sentado') {
      const gL = { sx: -0.68 + beat1 * 0.10, sy: -0.10 + beat2 * 0.15, sz: 0.22, ex: -1.18 + beat2 * 0.20, ey: 0, ez: 0, hx: -0.18, hy: 0.25, hz: 0, curl: 0.18, point: 0 };
      const gR = { sx: -0.78 - beat2 * 0.12, sy: 0.12 - beat1 * 0.16, sz: -0.24, ex: -1.24 - beat1 * 0.22, ey: 0, ez: 0, hx: -0.22, hy: -0.25, hz: 0, curl: 0.16, point: 0 };
      st.armL = lerpArm(st.armL, gL, sw);
      st.armR = lerpArm(st.armR, gR, sw);
    } else if (pose === 'ajoelhado') {
      st.armL.sx -= 0.18 * sw + beat1 * 0.08 * sw;
      st.armL.ex -= 0.32 * sw + beat2 * 0.12 * sw;
      st.armR.sx -= 0.14 * sw - beat2 * 0.10 * sw;
    } else if (pose === 'assustado') {
      const gL = { sx: -0.78 + beat1 * 0.16, sy: -0.16 + beat2 * 0.18, sz: 0.26, ex: -1.22 + beat2 * 0.20, ey: 0, ez: 0, hx: -0.28, hy: 0.2, hz: 0, curl: 0.12, point: 0 };
      const gR = { sx: -0.84 - beat2 * 0.16, sy: 0.16 - beat1 * 0.18, sz: -0.26, ex: -1.28 - beat1 * 0.20, ey: 0, ez: 0, hx: -0.28, hy: -0.2, hz: 0, curl: 0.12, point: 0 };
      st.armL = lerpArm(st.armL, gL, sw * 0.82);
      st.armR = lerpArm(st.armR, gR, sw * 0.82);
    } else {
      const style = (uttIdx + (a.name === 'HELENA' ? 2 : a.name === 'BRUNO' ? 1 : 0)) % 3;
      let gL, gR;
      if (style === 0) {
        gL = {
          sx: -0.58 + beat1 * 0.16,
          sy: -0.14 + beat2 * 0.22,
          sz: 0.22 + Math.max(0, beat2) * 0.10,
          ex: -1.22 + beat2 * 0.24,
          ey: 0,
          ez: 0,
          hx: -0.20 + beat1 * 0.12,
          hy: 0.35,
          hz: 0,
          curl: 0.18,
          point: 0,
        };
        gR = {
          sx: -0.64 - beat2 * 0.16,
          sy: 0.14 - beat1 * 0.22,
          sz: -0.22 - Math.max(0, beat1) * 0.10,
          ex: -1.28 - beat1 * 0.24,
          ey: 0,
          ez: 0,
          hx: -0.20 - beat2 * 0.12,
          hy: -0.35,
          hz: 0,
          curl: 0.18,
          point: 0,
        };
      } else if (style === 1) {
        // Ênfase forte (Bruno gesticulando grande!)
        gR = {
          sx: -0.84 + beat1 * 0.22,
          sy: 0.10 + beat2 * 0.18,
          sz: -0.26,
          ex: -1.08 + beat2 * 0.28,
          ey: 0,
          ez: 0,
          hx: -0.18,
          hy: -0.28,
          hz: 0,
          curl: 0.22,
          point: 0,
        };
        gL = {
          sx: -0.38 - beat2 * 0.08,
          sy: -0.22,
          sz: 0.18,
          ex: -0.88 - beat1 * 0.12,
          ey: 0,
          ez: 0,
          hx: 0.05,
          hy: 0.18,
          hz: 0,
          curl: 0.30,
          point: 0,
        };
      } else {
        // Controlado e firme (Helena / Antony explicando a conta)
        gR = {
          sx: -0.56 + beat1 * 0.12,
          sy: 0.22 - beat2 * 0.16,
          sz: -0.18,
          ex: -1.28 + beat2 * 0.18,
          ey: 0,
          ez: 0,
          hx: -0.15,
          hy: -0.32,
          hz: 0,
          curl: 0.20,
          point: 0,
        };
        gL = {
          sx: -0.44,
          sy: -0.45,
          sz: 0.14,
          ex: -1.15 + beat1 * 0.08,
          ey: 0,
          ez: 0,
          hx: 0.10,
          hy: 0.15,
          hz: 0,
          curl: 0.34,
          point: 0,
        };
      }
      st.armL = lerpArm(st.armL, gL, sw);
      st.armR = lerpArm(st.armR, gR, sw);
    }
  }

  return st;
}

function applyPoseStateToActor(a, st) {
  a.body.position.set(st.bodyX, st.bodyY, st.bodyZ);
  a.body.rotation.set(st.bodyRotX, st.bodyRotY, st.bodyRotZ);

  a.pelvis.position.x = st.pelvisX;
  a.pelvis.rotation.z = st.pelvisRotZ;

  a.torso.position.y = st.torsoY;
  a.torso.rotation.set(st.torsoRotX, st.torsoRotY, st.torsoRotZ);
  a.torso.scale.set(1, 1, st.breathScale);

  const applyArm = (arm, d) => {
    arm.shoulder.position.y = arm.baseShoulderY + st.shoulderLift;
    arm.shoulder.rotation.set(d.sx, d.sy, d.sz);
    arm.elbow.rotation.set(clamp(d.ex, -2.25, -0.05), d.ey, d.ez);
    arm.hand.rotation.set(d.hx, d.hy, d.hz);
    arm.indexPivot.rotation.x = lerp(d.curl * 0.65, 0.04, d.point);
    arm.otherFingers.rotation.x = lerp(d.curl * 0.85, 1.15, d.point);
  };
  applyArm(a.armL, st.armL);
  applyArm(a.armR, st.armR);

  a.legL.hip.rotation.set(st.legL.hx, st.legL.hy, st.legL.hz);
  a.legL.knee.rotation.set(Math.max(0, st.legL.kx), 0, 0);
  a.legR.hip.rotation.set(st.legR.hx, st.legR.hy, st.legR.hz);
  a.legR.knee.rotation.set(Math.max(0, st.legR.kx), 0, 0);

  a.browL.position.y = st.browLY;
  a.browR.position.y = st.browRY;
  a.browL.rotation.z = st.browLZ;
  a.browR.rotation.z = st.browRZ;

  a.mouthGroup.rotation.z = st.mouthTilt;
}

function setMouth(a, open01) {
  const o = clamp(open01, 0, 1);
  a.mouthInner.scale.set(1.08 - o * 0.14, 0.16 + o * 0.94, 0.50);
  a.mouthUpper.position.y = o * 0.0028;
  a.mouthLip.position.y = -0.0055 - o * 0.0155;
  a.mouthTeeth.visible = o > 0.24;
  if (a.mouthTeeth.visible) {
    a.mouthTeeth.position.y = 0.0035 - o * 0.002;
  }
}

// ============================================================================
// Lookup determinístico do plano anterior (para transição suave entre poses)
// ============================================================================
function findPrevPoseForTransition(t, placements) {
  if (!Array.isArray(planos) || planos.length < 2 || !placements.length) return null;
  let curIdx = -1;
  for (let i = 0; i < planos.length; i++) {
    if (t >= planos[i].t0 && t < planos[i].t1) {
      curIdx = i;
      break;
    }
  }
  if (curIdx <= 0) return null;
  const cur = planos[curIdx];
  const prev = planos[curIdx - 1];
  const dt = t - cur.t0;
  if (dt < 0 || dt > 0.44) return null;
  if (cur.local !== prev.local) return null;

  if (!cur.atores || placements.length !== cur.atores.length) return null;
  const first = placements[0];
  const curFirst = cur.atores[0];
  if (!first || !curFirst || first.nome !== curFirst.nome) return null;
  if (Math.hypot(first.pos[0] - curFirst.pos[0], first.pos[2] - curFirst.pos[2]) > 0.25) return null;

  return { prev, blend: smoothstep(0.0, 0.40, dt) };
}

// ============================================================================
// API pública 100% compatível com main.js e direcao.js
// ============================================================================
export function makeCharacters(scene) {
  const actors = {};
  let idx = 0;
  for (const [name, spec] of Object.entries(CAST)) {
    const a = buildActor(name, spec);
    a._phase = idx++ * 1.37;
    scene.add(a.root);
    actors[name] = a;
  }

  function update(t, placements = [], words = [], camera = null) {
    const camPos = camera ? camera.position : null;
    const utts = getUtterances(words);
    const speech = getSpeechInfo(utts, t);
    const trans = findPrevPoseForTransition(t, placements);

    const anyScared = placements.some((v) => v.pose === 'assustado');
    const placementMap = {};
    for (let i = 0; i < placements.length; i++) {
      placementMap[placements[i].nome] = placements[i];
    }

    for (const [name, a] of Object.entries(actors)) {
      const p = placementMap[name];
      a.root.visible = !!p;
      if (!p) continue;

      const pose = p.pose || 'em_pe';
      a.root.position.set(p.pos[0], p.pos[1], p.pos[2]);

      const ctx = {
        speakWeight: pose === 'caido' ? 0 : speech.weights[name] || 0,
        speakUttIndex: speech.uttIdxBySpeaker[name] ?? 0,
        activeSpeaker: speech.activeSpeaker,
        activeWeight: speech.activeWeight,
        activeUttIndex: speech.activeUttIndex,
        anyScared,
      };

      let st = evaluatePoseState(a, pose, t, a._phase, ctx);

      if (trans && pose !== 'caido') {
        const prevActor = (trans.prev.atores || []).find((v) => v.nome === name);
        if (prevActor && (prevActor.pose || 'em_pe') !== pose && prevActor.pose !== 'caido') {
          const dist = Math.hypot(prevActor.pos[0] - p.pos[0], prevActor.pos[2] - p.pos[2]);
          if (dist < 1.35) {
            const prevSt = evaluatePoseState(a, prevActor.pose || 'em_pe', t, a._phase, ctx);
            st = lerpPoseState(prevSt, st, trans.blend);
          }
        }
      }

      let baseYaw = p.rot ?? 0;
      let camPitch = 0;
      let listenHeadYaw = 0;
      let listenTorsoYaw = 0;
      let listenEyeX = 0;

      if (p.olhaPara === 'camera' && camPos && pose !== 'caido') {
        const dx = camPos.x - p.pos[0];
        const dz = camPos.z - p.pos[2];
        baseYaw = Math.atan2(dx, dz);

        const headWorldY = p.pos[1] + (1.56 + st.bodyY) * a.scale;
        const dy = camPos.y - headWorldY;
        const horiz = Math.max(0.2, Math.hypot(dx, dz));
        camPitch = clamp(-Math.atan2(dy, horiz), -0.42, 0.35);
      } else if (p.olhaPara && placementMap[p.olhaPara] && pose !== 'caido') {
        const target = placementMap[p.olhaPara];
        baseYaw = Math.atan2(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]);
      }

      // Quem escuta vira cabeça, olhar e ombros suavemente para o falante ativo
      if (
        pose !== 'caido' &&
        speech.activeSpeaker &&
        speech.activeSpeaker !== name &&
        speech.activeWeight > 0.01
      ) {
        let targetPos = null;
        if (placementMap[speech.activeSpeaker]) {
          const sp = placementMap[speech.activeSpeaker];
          targetPos = [sp.pos[0], sp.pos[2]];
        } else if ((speech.activeSpeaker === 'ANTONY' || speech.activeSpeaker === 'NARRADOR') && camPos) {
          targetPos = [camPos.x, camPos.z];
        }
        if (targetPos) {
          const spYaw = Math.atan2(targetPos[0] - p.pos[0], targetPos[1] - p.pos[2]);
          const delta = wrapAngle(spYaw - baseYaw);
          const lw = speech.activeWeight;
          listenTorsoYaw = clamp(delta * 0.24, -0.22, 0.22) * lw;
          listenHeadYaw = clamp(delta * 0.56, -0.52, 0.52) * lw;
          listenEyeX = clamp(delta * 0.28, -0.22, 0.22) * lw;
        }
      }

      a.root.rotation.y = baseYaw;
      st.torsoRotY += listenTorsoYaw;
      applyPoseStateToActor(a, st);

      if (pose === 'caido') {
        a.headPivot.rotation.set(0, 0.25, 0);
      } else if (p.olhaPara === 'camera' && camPos) {
        a.headPivot.rotation.set(
          clamp(camPitch + st.headX, -0.48, 0.42),
          clamp(st.headY + listenHeadYaw, -0.68, 0.68),
          clamp(st.headZ, -0.24, 0.24)
        );
      } else {
        a.headPivot.rotation.set(
          clamp(st.headX, -0.35, 0.35),
          clamp(st.headY + listenHeadYaw, -0.65, 0.65),
          clamp(st.headZ, -0.22, 0.22)
        );
      }

      // Piscada natural + movimento vivo determinístico do olhar
      if (pose === 'caido') {
        a.eyes.forEach((e) => {
          e.scale.y = 0.08;
        });
      } else {
        const blink1 = Math.pow(Math.max(0, Math.sin(t * 1.38 + a._phase * 2.1)), 42);
        const blink2 = Math.pow(Math.max(0, Math.sin(t * 0.61 + a._phase * 3.7 + 1.1)), 64);
        const blink = Math.min(1, blink1 + blink2);
        const widen = pose === 'assustado' ? 1.12 : 1.0;
        a.eyes.forEach((e) => {
          e.scale.y = (1 - blink * 0.92) * widen;
        });

        const glanceCycle = Math.sin(t * 0.92 + a._phase * 1.7);
        const glanceGate = smoothstep(0.55, 0.92, Math.abs(glanceCycle));
        const saccadeY = Math.sign(glanceCycle) * glanceGate * 0.14 * (ctx.speakWeight > 0.2 ? 0.55 : 1.0);
        const saccadeX = Math.sin(t * 0.63 + a._phase * 2.3) * 0.05;
        const eyeYaw = clamp(saccadeY + listenEyeX, -0.26, 0.26);
        const eyePitch = clamp(saccadeX, -0.14, 0.14);
        a.eyeBalls.forEach((eb) => {
          eb.rotation.set(eyePitch, eyeYaw, 0);
        });
      }

      // Lipsync expressivo + abertura de susto/surpresa
      const speechOpen = pose === 'caido' ? 0 : speech.mouthOpenBySpeaker[name] || 0;
      const mouthOpen = Math.max(speechOpen, st.mouthGasp);
      setMouth(a, mouthOpen);
    }
  }

  return { actors, update };
}
