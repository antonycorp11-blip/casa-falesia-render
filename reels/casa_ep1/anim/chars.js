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
  return new T.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.68,
    metalness: opts.metalness ?? 0.04,
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

// ============================================================================
// Contorno leve tipo toon (casca invertida por extrusão suave de normais)
// ============================================================================
const MAT_OUTLINE = new T.MeshBasicMaterial({
  color: '#11121c',
  side: T.BackSide,
});

const MAT_GHOST_OUTLINE = new T.MeshBasicMaterial({
  color: '#7cdbf8',
  side: T.BackSide,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
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

function addOutline(mesh, thickness = 0.0046, isGhost = false) {
  const mat = isGhost ? MAT_GHOST_OUTLINE : MAT_OUTLINE;
  const t = isGhost ? thickness * 1.35 : thickness;
  const outGeo = makeExtrudedOutlineGeo(mesh.geometry, t, mesh.scale.x, mesh.scale.y, mesh.scale.z);
  const outMesh = new T.Mesh(outGeo, mat);
  outMesh.castShadow = false;
  outMesh.receiveShadow = false;
  outMesh.renderOrder = isGhost ? -1 : 0;
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
    radialSegs = 6,
    mat,
    castShadow = true,
    outline = 0,
    isGhost = false,
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
  if (outline > 0) addOutline(mesh, outline, isGhost);
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
    scale = [0.95, 1.05, 0.96],
    outline = 0.0036,
    isGhost = false,
  } = opts;
  const cap = addShadow(
    new T.Mesh(new T.SphereGeometry(radius, 20, 14, 0, Math.PI * 2, 0, phiLen), mat),
    false,
    true
  );
  cap.position.set(0, y, z);
  cap.rotation.x = rotX;
  cap.scale.set(...scale);
  if (outline > 0) addOutline(cap, outline, isGhost);
  hairGroup.add(cap);
  return cap;
}

// ============================================================================
// Penteados únicos e detalhados por personagem
// ============================================================================
function buildHair(headPivot, name, skinMat) {
  const hairGroup = new T.Group();
  headPivot.add(hairGroup);

  if (name === 'CAIO') {
    // LOIRO-ESCURO COM TOPETE PENTEADO PARA TRÁS E CORTE FADE LIMPO NAS LATERAIS
    const pal = makeHairPalette(['#5c4629', '#83663d', '#a58453', '#c2a06b'], { roughness: 0.54 });
    const fadeMat = stdMat('#685235', { roughness: 0.80 });

    addScalpBase(hairGroup, fadeMat, {
      radius: 0.144,
      y: 0.141,
      z: -0.014,
      phiLen: Math.PI * 0.45,
      rotX: -0.28,
      scale: [0.945, 1.06, 0.965],
      outline: 0.0034,
    });
    const backFade = addShadow(
      new T.Mesh(
        new T.SphereGeometry(0.140, 16, 10, Math.PI * 0.72, Math.PI * 1.56, Math.PI * 0.34, Math.PI * 0.36),
        fadeMat
      ),
      false,
      true
    );
    backFade.position.set(0, 0.132, -0.014);
    backFade.scale.set(0.94, 1.06, 0.96);
    hairGroup.add(backFade);

    // Topete volumoso em mechas arqueadas para trás com leve caída lateral
    for (let i = 0; i < 28; i++) {
      const row = Math.floor(i / 7);
      const col = (i % 7) - 3;
      const u = col / 3;
      const jitter = (hash(i * 19 + 3) - 0.5) * 0.012;
      const x0 = u * 0.094 + jitter;
      const arch = (1 - Math.abs(u) * 0.40) * (0.070 - row * 0.011);
      const z0 = 0.096 - row * 0.048 + (1 - Math.abs(u)) * 0.016;
      const y0 = 0.228 + (1 - Math.abs(u)) * 0.022 - row * 0.008;
      const sweepX = 0.024 + (hash(i * 7) - 0.3) * 0.014;

      const pts = [
        [x0 * 0.92, y0 - 0.012, z0 + 0.004],
        [x0 + sweepX * 0.35, y0 + arch * 0.85, z0 + 0.008],
        [x0 * 0.95 + sweepX * 0.85, y0 + arch * 1.04, z0 - 0.068],
        [x0 * 0.86 + sweepX, y0 + arch * 0.54 - 0.018, z0 - 0.145],
        [x0 * 0.78 + sweepX * 0.9, 0.184 - row * 0.018, Math.max(-0.155, z0 - 0.212)],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.021 + (row === 0 ? 0.0035 : 0),
          rTip: 0.003,
          flatten: 0.54,
          segs: 14,
          mat: pal[(i + row) % pal.length],
          outline: i % 3 === 0 ? 0.0026 : 0,
        })
      );
    }

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const y = 0.198 + i * 0.013;
        const zStart = 0.072 - i * 0.012;
        const pts = [
          [side * 0.122, y, zStart],
          [side * 0.138, y + 0.014, zStart - 0.055],
          [side * 0.132, y + 0.004, zStart - 0.122],
          [side * 0.100, y - 0.024, -0.142],
        ];
        hairGroup.add(
          buildTaperedStrand(pts, {
            rStart: 0.011,
            rMid: 0.014,
            rTip: 0.0025,
            flatten: 0.48,
            segs: 10,
            mat: pal[i % 3],
          })
        );
      }
    }
  } else if (name === 'NINA') {
    // ========================================================================
    // NINA: CABELO PRETO LISO COMPRIDO COM RISCA LATERAL, PUXADO ATRÁS DAS
    // ORELHAS E CAINDO NAS COSTAS E NOS OMBROS — ROSTO 100% VISÍVEL!
    // ========================================================================
    const pal = makeHairPalette(['#101118', '#181a25', '#232636', '#14151e'], {
      roughness: 0.32,
      metalness: 0.16,
    });

    // Calota alta inclinada para trás: linha da testa limpa em y >= 0.22 (bem acima das sobrancelhas)
    addScalpBase(hairGroup, pal[0], {
      radius: 0.144,
      y: 0.138,
      z: -0.015,
      phiLen: Math.PI * 0.44,
      rotX: -0.36,
      scale: [0.915, 1.07, 0.94],
      outline: 0.0038,
    });

    // Base traseira da nuca (cobre o crânio atrás das orelhas sem nunca invadir a frente)
    const napeCap = addShadow(
      new T.Mesh(
        new T.SphereGeometry(0.142, 16, 12, Math.PI * 0.64, Math.PI * 0.72, Math.PI * 0.26, Math.PI * 0.48),
        pal[0]
      ),
      false,
      true
    );
    napeCap.position.set(0, 0.134, -0.015);
    napeCap.scale.set(0.92, 1.06, 0.95);
    hairGroup.add(napeCap);

    // Risca lateral elegante no topo-esquerdo do crânio (partX = +0.044)
    const partX = 0.044;
    const partCurvePts = [
      new T.Vector3(partX, 0.260, 0.072),
      new T.Vector3(partX * 0.95, 0.281, 0.015),
      new T.Vector3(partX * 0.85, 0.278, -0.048),
    ];
    const partRibbon = buildTaperedStrand(partCurvePts, {
      rStart: 0.0032,
      rMid: 0.0038,
      rTip: 0.0022,
      flatten: 0.35,
      segs: 8,
      radialSegs: 4,
      mat: skinMat,
      castShadow: false,
    });
    hairGroup.add(partRibbon);

    // 1) Lado principal da risca lateral (varre do topo +0.044 para a direita -X,
    //    passando ALTO sobre a testa, encaixando ATRÁS da orelha direita e caindo sobre o ombro/costas)
    for (let i = 0; i < 12; i++) {
      const u = i / 11; // 0 = frente, 1 = coroa traseira
      const zStart = lerp(0.076, -0.072, u);
      const yTop = lerp(0.262, 0.276, Math.sin(u * Math.PI * 0.75)) + (u < 0.25 ? 0.004 : 0);
      const earZ = lerp(-0.024, -0.095, u); // SEMPRE atrás da orelha (z = -0.008)!
      const shoulderX = lerp(-0.156, -0.118, u) + (hash(i * 11) - 0.5) * 0.012;
      const shoulderZ = lerp(-0.068, -0.142, u);
      const endY = lerp(-0.235, -0.315, Math.sin(u * Math.PI * 0.8 + 0.25)) + (hash(i * 17) - 0.5) * 0.02;

      const pts = [
        [partX - 0.004, yTop, zStart],
        [lerp(-0.042, -0.065, u), lerp(0.264, 0.268, u), lerp(0.092, -0.078, u)],
        [lerp(-0.126, -0.136, u), lerp(0.214, 0.205, u), lerp(0.036, -0.092, u)],
        [lerp(-0.138, -0.144, u), 0.136, earZ],
        [shoulderX, -0.025, shoulderZ],
        [shoulderX * 1.03, endY, shoulderZ - 0.018],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.021,
          rTip: 0.0045,
          flatten: 0.40,
          segs: 16,
          mat: pal[i % pal.length],
          outline: i % 2 === 0 ? 0.0028 : 0,
        })
      );
    }

    // 2) Lado menor da risca lateral (varre de +0.048 para a esquerda +X,
    //    encaixando rente ATRÁS da orelha esquerda e caindo sobre o ombro/costas)
    for (let i = 0; i < 9; i++) {
      const u = i / 8;
      const zStart = lerp(0.072, -0.072, u);
      const yTop = lerp(0.260, 0.274, Math.sin(u * Math.PI * 0.75));
      const earZ = lerp(-0.024, -0.095, u);
      const shoulderX = lerp(0.154, 0.118, u) + (hash(i * 13 + 5) - 0.5) * 0.012;
      const shoulderZ = lerp(-0.068, -0.142, u);
      const endY = lerp(-0.230, -0.310, Math.sin(u * Math.PI * 0.8 + 0.25)) + (hash(i * 19) - 0.5) * 0.02;

      const pts = [
        [partX + 0.006, yTop, zStart],
        [lerp(0.104, 0.096, u), lerp(0.244, 0.252, u), lerp(0.066, -0.080, u)],
        [lerp(0.132, 0.138, u), 0.195, lerp(0.020, -0.092, u)],
        [lerp(0.138, 0.142, u), 0.134, earZ],
        [shoulderX, -0.025, shoulderZ],
        [shoulderX * 1.03, endY, shoulderZ - 0.018],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.020,
          rTip: 0.0045,
          flatten: 0.40,
          segs: 16,
          mat: pal[(i + 1) % pal.length],
          outline: i % 2 === 0 ? 0.0028 : 0,
        })
      );
    }

    // 3) Franja lateral discreta e sofisticada no alto da testa (curva bem acima da sobrancelha e prende atrás da orelha)
    for (let f = 0; f < 3; f++) {
      const pts = [
        [partX - 0.002, 0.262 - f * 0.003, 0.080 - f * 0.006],
        [-0.032 - f * 0.006, 0.242 - f * 0.004, 0.114 - f * 0.004],
        [-0.108 - f * 0.005, 0.214 - f * 0.006, 0.072 - f * 0.008],
        [-0.132 - f * 0.003, 0.152 - f * 0.006, -0.018 - f * 0.008],
        [-0.148 - f * 0.004, -0.015, -0.056 - f * 0.008],
        [-0.156, -0.215 - f * 0.015, -0.074 - f * 0.006],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.012,
          rMid: 0.016,
          rTip: 0.0035,
          flatten: 0.36,
          segs: 16,
          mat: pal[(f + 1) % pal.length],
          outline: f === 0 ? 0.0024 : 0,
        })
      );
    }

    // 4) Cascata lisa comprida caindo pelas costas (totalmente atrás da nuca e ombros)
    for (let i = 0; i < 18; i++) {
      const u = i / 17;
      const a = lerp(-Math.PI * 0.44, Math.PI * 0.44, u); // 100% arco traseiro (-Z)
      const sx = Math.sin(a);
      const sz = -Math.cos(a); // estritamente negativo!
      const lenY = lerp(-0.335, -0.265, Math.abs(u - 0.5) * 2) + (hash(i * 23) - 0.5) * 0.018;

      const pts = [
        [sx * 0.075, 0.265, sz * 0.078 - 0.018],
        [sx * 0.142, 0.175, sz * 0.145 - 0.014],
        [sx * 0.156, 0.025, sz * 0.154 - 0.018],
        [sx * 0.168, -0.145, sz * 0.158 - 0.022],
        [sx * 0.162, lenY, sz * 0.152 - 0.024],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.018,
          rMid: 0.025,
          rTip: 0.0055,
          flatten: 0.38,
          segs: 15,
          mat: pal[i % pal.length],
          outline: i % 2 === 0 ? 0.0030 : 0,
        })
      );
    }

    // 5) Duas mechas finas descansando sobre a frente externa dos ombros (abaixo do queixo, longe do rosto)
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const pts = [
          [side * (0.136 + k * 0.006), 0.132, -0.024 - k * 0.010],
          [side * (0.150 + k * 0.008), 0.020, -0.028 - k * 0.008],
          [side * (0.156 + k * 0.008), -0.095, 0.012 - k * 0.010],
          [side * (0.146 + k * 0.006), -0.220 - k * 0.025, 0.048 - k * 0.012],
        ];
        hairGroup.add(
          buildTaperedStrand(pts, {
            rStart: 0.013,
            rMid: 0.017,
            rTip: 0.003,
            flatten: 0.38,
            segs: 12,
            mat: pal[(k + (side > 0 ? 1 : 2)) % pal.length],
            outline: k === 0 ? 0.0024 : 0,
          })
        );
      }
    }
  } else if (name === 'MAYA') {
    // CABELO CACHEADO CASTANHO-ACOBREADO VOLUMOSO, MEIO PRESO COM PRESILHA DOURADA
    const pal = makeHairPalette(['#4f2213', '#7a381d', '#9e4c28', '#bf6436'], { roughness: 0.62 });

    addScalpBase(hairGroup, pal[0], {
      radius: 0.146,
      y: 0.142,
      z: -0.014,
      phiLen: Math.PI * 0.46,
      rotX: -0.30,
      scale: [0.97, 1.06, 0.98],
      outline: 0.0036,
    });

    // Seção superior meio-presa puxada para trás em direção à presilha
    for (let i = 0; i < 14; i++) {
      const u = (i / 13) * 2 - 1;
      const pts = [
        [u * 0.102, 0.232 + (1 - Math.abs(u)) * 0.028, 0.092 - Math.abs(u) * 0.04],
        [u * 0.094, 0.286 + (1 - Math.abs(u)) * 0.024, 0.012],
        [u * 0.054, 0.276, -0.086],
        [u * 0.028, 0.235, -0.148],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.020,
          rTip: 0.011,
          flatten: 0.56,
          segs: 12,
          mat: pal[i % pal.length],
        })
      );
    }

    const clipMat = stdMat('#dfb354', { roughness: 0.24, metalness: 0.74 });
    const clip = addOutline(addShadow(new T.Mesh(new T.BoxGeometry(0.095, 0.026, 0.026), clipMat)), 0.0028);
    clip.position.set(0, 0.236, -0.158);
    hairGroup.add(clip);
    const clipGem = new T.Mesh(new T.BoxGeometry(0.055, 0.014, 0.030), stdMat('#8a401d', { roughness: 0.34 }));
    clipGem.position.set(0, 0.236, -0.160);
    hairGroup.add(clipGem);

    function addSpiralCurl(startPt, dirX, dirZ, length, turns, amp, rMid, matIdx, withOut = false) {
      const steps = 11;
      const pts = [];
      const phase = hash(matIdx * 31.7 + startPt[0] * 40) * Math.PI * 2;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const flare = Math.sin(u * Math.PI * 0.85) * amp;
        const ang = u * Math.PI * 2 * turns + phase;
        const cx = startPt[0] + dirX * u * 0.105 + Math.cos(ang) * flare;
        const cy = startPt[1] - u * length + Math.sin(u * Math.PI) * 0.020;
        const cz = startPt[2] + dirZ * u * 0.092 + Math.sin(ang) * flare;
        pts.push([cx, cy, cz]);
      }
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: rMid * 0.8,
          rMid,
          rTip: 0.003,
          flatten: 0.76,
          segs: 16,
          radialSegs: 5,
          mat: pal[matIdx % pal.length],
          outline: withOut ? 0.0026 : 0,
        })
      );
    }

    // Cachos volumosos ao redor das laterais e costas (rosto limpo!)
    for (let i = 0; i < 34; i++) {
      const a = lerp(-Math.PI * 0.64, Math.PI * 0.64, i / 33) + Math.PI;
      const tier = i % 3;
      const rad = 0.138 + tier * 0.016;
      const sx = Math.sin(a) * rad;
      const sz = Math.cos(a) * rad - 0.018;
      const sy = 0.238 - tier * 0.046 + (hash(i * 11) - 0.5) * 0.022;
      const len = 0.26 + (tier === 0 ? 0.08 : 0.03) + hash(i * 17) * 0.08;
      const amp = 0.019 + hash(i * 23) * 0.015;
      addSpiralCurl(
        [sx, sy, sz],
        Math.sin(a) * 0.92,
        Math.cos(a) * 0.72,
        len,
        2.3 + (i % 2) * 0.6,
        amp,
        0.0165 + (i % 3) * 0.002,
        i,
        i % 3 === 0
      );
    }

    for (let i = 0; i < 10; i++) {
      const u = (i / 9) * 2 - 1;
      addSpiralCurl([u * 0.05, 0.255, -0.145], u * 0.65, -0.65, 0.25 + hash(i * 5) * 0.08, 2.5, 0.022, 0.017, i + 1, i % 2 === 0);
    }

    // Cachinhos laterais delicados emoldurando a testa (abertos no meio para mostrar sobrancelhas e sardas!)
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const k = (i % 4) / 3;
      const sx = side * lerp(0.058, 0.118, k);
      const sy = 0.252 - k * 0.026;
      const sz = 0.095 - k * 0.035;
      const len = 0.075 + k * 0.095;
      addSpiralCurl([sx, sy, sz], side * 0.55, 0.15 - k * 0.25, len, 1.4, 0.011, 0.0115, i + 2);
    }
  } else if (name === 'GAEL') {
    // CABELO PRETO CRESPO CURTO EM DEGRADÊ BAIXO COM RISCO DISCRETO NA LATERAL
    const pal = makeHairPalette(['#111116', '#1c1b22', '#28252f', '#17151b'], { roughness: 0.82 });
    const fadeLowMat = stdMat('#1c191d', { roughness: 0.88 });

    addScalpBase(hairGroup, fadeLowMat, {
      radius: 0.143,
      y: 0.138,
      z: -0.012,
      phiLen: Math.PI * 0.48,
      rotX: -0.26,
      scale: [0.955, 1.05, 0.965],
      outline: 0.0036,
    });

    const partGroove = new T.Mesh(new T.BoxGeometry(0.014, 0.007, 0.112), skinMat);
    partGroove.position.set(-0.128, 0.214, 0.010);
    partGroove.rotation.set(0.14, 0.12, -0.45);
    hairGroup.add(partGroove);

    const count = 84;
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996;
      const rNorm = Math.sqrt((i + 0.5) / count);
      const x = Math.cos(a) * rNorm * 0.124;
      const z = Math.sin(a) * rNorm * 0.118 - 0.012;

      if (x < -0.098 && Math.abs(z - 0.01) < 0.065) continue;

      const domeY = 0.142 + Math.sqrt(Math.max(0.002, 0.146 * 0.146 - x * x - z * z)) * 1.03;
      const frontBoost = clamp((z + 0.09) / 0.20, 0, 1);
      const edgeFade = 1 - Math.pow(rNorm, 2.2) * 0.55;
      const h = (0.028 + frontBoost * 0.022) * edgeFade + hash(i * 17) * 0.010;
      const twistX = Math.sin(i * 3.7) * 0.010;
      const twistZ = Math.cos(i * 2.9) * 0.010;

      const pts = [
        [x * 0.96, domeY - 0.008, z * 0.96],
        [x + twistX * 0.6, domeY + h * 0.55, z + twistZ * 0.6],
        [x - twistX * 0.4, domeY + h, z + twistZ * 0.9],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.011,
          rMid: 0.0135,
          rTip: 0.0065,
          flatten: 0.84,
          segs: 6,
          radialSegs: 5,
          mat: pal[i % pal.length],
          outline: i % 5 === 0 ? 0.0022 : 0,
        })
      );
    }
  } else if (name === 'TINA') {
    // WOLF-CUT PRETO CURTO REPICADO COM FRANJA CORTININHA E PONTAS ROXO-LAVANDA
    const palDark = makeHairPalette(['#13111a', '#1e1a2a', '#292338', '#171422'], { roughness: 0.50 });
    const palPurple = makeHairPalette(['#9469d6', '#b188f0', '#c7a4ff'], {
      roughness: 0.44,
      emissive: '#281548',
      emissiveIntensity: 0.14,
    });

    addScalpBase(hairGroup, palDark[0], {
      radius: 0.144,
      y: 0.140,
      z: -0.014,
      phiLen: Math.PI * 0.46,
      rotX: -0.30,
      scale: [0.955, 1.05, 0.965],
      outline: 0.0036,
    });

    // 1) Camada superior curta repicada do wolf-cut
    for (let i = 0; i < 18; i++) {
      const a = lerp(-Math.PI * 0.72, Math.PI * 0.72, i / 17) + Math.PI;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      const len = 0.08 + (i % 3) * 0.022;
      const pts = [
        [sx * 0.045, 0.284, sz * 0.045 - 0.012],
        [sx * 0.136, 0.258, sz * 0.128 - 0.012],
        [sx * (0.165 + (i % 2) * 0.014), 0.215 - len * 0.45, sz * 0.150 - 0.014],
        [sx * (0.184 + (i % 2) * 0.018), 0.195 - len, sz * 0.160 - 0.014],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.019,
          rTip: 0.0022,
          flatten: 0.48,
          segs: 12,
          mat: palDark[i % palDark.length],
          outline: i % 3 === 0 ? 0.0024 : 0,
        })
      );
    }

    // 2) Camada média e nuca em camadas (pontas viradinhas para fora + roxo-lavanda!)
    for (let i = 0; i < 24; i++) {
      const a = lerp(-Math.PI * 0.66, Math.PI * 0.66, i / 23) + Math.PI;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      const isBack = Math.abs(sx) < 0.65 && sz < 0;
      const dropY = isBack ? -0.105 - (i % 3) * 0.025 : -0.022 - (i % 3) * 0.026;
      const kick = 0.032 + (i % 2) * 0.014;

      const midY = lerp(0.18, dropY, 0.56);
      const ptsTop = [
        [sx * 0.105, 0.242, sz * 0.095 - 0.012],
        [sx * 0.155, 0.155, sz * 0.145 - 0.014],
        [sx * 0.158, midY, sz * 0.148 - 0.016],
      ];
      hairGroup.add(
        buildTaperedStrand(ptsTop, {
          rStart: 0.017,
          rMid: 0.020,
          rTip: 0.013,
          flatten: 0.48,
          segs: 10,
          mat: palDark[i % palDark.length],
        })
      );

      const isPurpleTip = i % 3 !== 1;
      const ptsTip = [
        [sx * 0.158, midY + 0.014, sz * 0.148 - 0.016],
        [sx * (0.162 + kick * 0.45), lerp(midY, dropY, 0.55), sz * (0.152 + kick * 0.3) - 0.016],
        [sx * (0.168 + kick), dropY, sz * (0.155 + kick * 0.55) - 0.012],
      ];
      hairGroup.add(
        buildTaperedStrand(ptsTip, {
          rStart: 0.014,
          rMid: 0.016,
          rTip: 0.002,
          flatten: 0.46,
          segs: 10,
          mat: isPurpleTip ? palPurple[i % palPurple.length] : palDark[(i + 1) % palDark.length],
          outline: i % 2 === 0 ? 0.0024 : 0,
        })
      );
    }

    // 3) Franja cortininha desfiada aberta no centro (olhos sempre visíveis + mechas laterais lavanda!)
    for (const side of [-1, 1]) {
      for (let f = 0; f < 5; f++) {
        const edge = f / 4;
        const pts = [
          [side * (0.014 + edge * 0.036), 0.274, 0.068 - edge * 0.010],
          [side * (0.058 + edge * 0.056), 0.242 - edge * 0.014, 0.124 - edge * 0.026],
          [side * (0.104 + edge * 0.044), 0.196 - edge * 0.038, 0.118 - edge * 0.044],
          [side * (0.132 + edge * 0.028), 0.164 - edge * 0.064, 0.088 - edge * 0.056],
        ];
        hairGroup.add(
          buildTaperedStrand(pts, {
            rStart: 0.012,
            rMid: 0.015,
            rTip: 0.002,
            flatten: 0.44,
            segs: 10,
            mat: edge > 0.68 ? palPurple[f % palPurple.length] : palDark[f % palDark.length],
          })
        );
      }
    }
  } else if (name === 'SOFIA') {
    // CABELO LONGO ONDULADO ESPECTRAL FLUTUANDO (SEMI-TRANSPARENTE, ROSTO PÁLIDO VISÍVEL)
    const pal = makeHairPalette(['#546b78', '#748d9b', '#93aebc', '#b7d4e0'], {
      roughness: 0.42,
      transparent: true,
      opacity: 0.68,
      emissive: '#3b7491',
      emissiveIntensity: 0.40,
      depthWrite: false,
    });

    addScalpBase(hairGroup, pal[0], {
      radius: 0.144,
      y: 0.140,
      z: -0.014,
      phiLen: Math.PI * 0.46,
      rotX: -0.34,
      scale: [0.92, 1.06, 0.94],
      outline: 0.004,
      isGhost: true,
    });

    // Longas mechas espectrais onduladas nas laterais e costas (nunca tampando os olhos)
    for (let i = 0; i < 28; i++) {
      const a = lerp(-Math.PI * 0.56, Math.PI * 0.56, i / 27) + Math.PI;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      const wave = Math.sin(i * 1.9) * 0.024;
      const len = 0.46 + (i % 4) * 0.048;
      const pts = [
        [sx * 0.065, 0.272, sz * 0.065 - 0.014],
        [sx * 0.146, 0.190, sz * 0.142 - 0.016],
        [sx * 0.172 + wave, 0.040, sz * 0.158 - 0.022],
        [sx * 0.168 - wave, -0.115, sz * 0.158 - 0.028],
        [sx * 0.205 + wave * 1.5, 0.20 - len, sz * 0.185 - 0.038],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.016,
          rMid: 0.021,
          rTip: 0.0025,
          flatten: 0.42,
          segs: 15,
          mat: pal[i % pal.length],
          castShadow: false,
        })
      );
    }

    // Finas mechas etéreas emoldurando as laterais externas do rosto pálido
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const pts = [
          [side * (0.024 + i * 0.014), 0.270, 0.074 - i * 0.012],
          [side * (0.114 + i * 0.010), 0.222, 0.082 - i * 0.014],
          [side * (0.138 + i * 0.008), 0.095, 0.042 - i * 0.018],
          [side * (0.142 + i * 0.014), -0.090 - i * 0.035, 0.018 - i * 0.022],
        ];
        hairGroup.add(
          buildTaperedStrand(pts, {
            rStart: 0.012,
            rMid: 0.015,
            rTip: 0.002,
            flatten: 0.40,
            segs: 12,
            mat: pal[(i + 1) % pal.length],
            castShadow: false,
          })
        );
      }
    }
  } else {
    // LEO: CABELO CASTANHO-ESCURO CURTO COM FRANJA BAGUNÇADA EM CAMADAS
    const pal = makeHairPalette(['#201612', '#31231b', '#443226', '#281c16'], { roughness: 0.62 });

    addScalpBase(hairGroup, pal[0], {
      radius: 0.144,
      y: 0.140,
      z: -0.014,
      phiLen: Math.PI * 0.47,
      rotX: -0.28,
      scale: [0.955, 1.05, 0.965],
      outline: 0.0036,
    });

    for (let i = 0; i < 28; i++) {
      const a = i * 2.399;
      const r = Math.sqrt((i + 0.5) / 28) * 0.124;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 0.014;
      const y = 0.275 - r * 0.50;
      const dirX = x * 0.55 + 0.024 + (hash(i * 11) - 0.5) * 0.028;
      const dirZ = z * 0.55 + (z > 0 ? 0.042 : -0.040);
      const pts = [
        [x * 0.85, y - 0.01, z * 0.85],
        [x + dirX * 0.5, y + 0.034, z + dirZ * 0.45],
        [x + dirX * 1.15, y - 0.006, z + dirZ * 1.02],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.014,
          rMid: 0.018,
          rTip: 0.0025,
          flatten: 0.52,
          segs: 10,
          mat: pal[i % pal.length],
          outline: i % 4 === 0 ? 0.0024 : 0,
        })
      );
    }

    // Franja bagunçada de lado acima das sobrancelhas
    for (let i = 0; i < 9; i++) {
      const u = (i / 8) * 2 - 1;
      const sweep = 0.028 + (hash(i * 7) - 0.5) * 0.014;
      const pts = [
        [u * 0.072, 0.272, 0.060],
        [u * 0.094 + sweep * 0.5, 0.244, 0.124 - Math.abs(u) * 0.018],
        [u * 0.106 + sweep, 0.204 - (i % 3) * 0.009, 0.132 - Math.abs(u) * 0.028],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.013,
          rMid: 0.016,
          rTip: 0.002,
          flatten: 0.48,
          segs: 10,
          mat: pal[(i + 1) % pal.length],
        })
      );
    }
  }

  return hairGroup;
}

// ============================================================================
// Geometrias esculpidas (torso com cintura, membros afilados, sapato, saia)
// ============================================================================
function buildTorsoGeo(feminine, bx, bz) {
  // Perfil de torno (Lathe) da cintura/quadril até clavícula/ombros
  const profile = feminine
    ? [
        [0.002, 0.00],
        [0.124, 0.015],
        [0.122, 0.06],
        [0.106, 0.14], // cintura fina bem definida
        [0.118, 0.22],
        [0.142, 0.31], // busto / caixa torácica
        [0.148, 0.39], // linha dos ombros
        [0.118, 0.445],
        [0.064, 0.470], // base do pescoço
        [0.002, 0.475],
      ]
    : [
        [0.002, 0.00],
        [0.130, 0.015],
        [0.126, 0.08],
        [0.122, 0.15], // cintura atlética
        [0.138, 0.24],
        [0.156, 0.34], // peitoral largo
        [0.162, 0.405], // ombros
        [0.128, 0.452],
        [0.070, 0.474],
        [0.002, 0.480],
      ];

  const pts = profile.map(([r, y]) => new T.Vector2(r, y));
  const geo = new T.LatheGeometry(pts, 22);

  // Escultura anatômica em X (largura) e Z (profundidade + relevo suave de peito/costas)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * bx;
    const y = pos.getY(i);
    let z = pos.getZ(i) * (0.76 * bz);

    if (feminine && z > 0) {
      const bust = Math.exp(-Math.pow((y - 0.305) / 0.068, 2));
      const sideTwin = 0.65 + 0.35 * Math.cos(clamp(x / (0.075 * bx), -1.5, 1.5) * Math.PI * 0.5);
      z += bust * sideTwin * 0.024 * bz;
    } else if (!feminine && z > 0) {
      const pec = Math.exp(-Math.pow((y - 0.335) / 0.075, 2));
      z += pec * 0.014 * bz;
    }
    // Leve curva lombar natural nas costas
    if (z < 0) {
      const lumbar = Math.exp(-Math.pow((y - 0.145) / 0.075, 2));
      z += lumbar * 0.012;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildPelvisGeo(feminine, bx, bz) {
  const profile = feminine
    ? [
        [0.002, -0.078],
        [0.118, -0.060],
        [0.138, -0.012],
        [0.132, 0.036],
        [0.122, 0.066],
        [0.002, 0.072],
      ]
    : [
        [0.002, -0.078],
        [0.116, -0.058],
        [0.132, -0.010],
        [0.130, 0.038],
        [0.126, 0.066],
        [0.002, 0.072],
      ];
  const geo = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 18);
  geo.scale(bx, 1, 0.78 * bz);
  geo.computeVertexNormals();
  return geo;
}

function buildSofiaSkirtGeo() {
  const pts = [
    new T.Vector2(0.112, 0.05),
    new T.Vector2(0.145, -0.08),
    new T.Vector2(0.210, -0.26),
    new T.Vector2(0.275, -0.48),
    new T.Vector2(0.345, -0.73),
  ];
  const geo = new T.LatheGeometry(pts, 28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const drop = clamp((0.05 - y) / 0.78, 0, 1);
    const pleat = 1 + Math.sin(ang * 7) * 0.055 * drop + Math.cos(ang * 11) * 0.025 * drop;
    pos.setXYZ(i, x * pleat, y, z * pleat);
  }
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Especificação do elenco conforme biblia.md
// ============================================================================
const CAST = {
  LEO: {
    skin: '#c9936d',
    shirt: '#4d6640', // verde-musgo
    pants: '#252c36',
    shoes: '#dcd8cf',
    hair: '#2b1e18',
    iris: '#423020',
    lip: '#9d6253',
    height: 1.72,
    buildX: 1.0,
    buildZ: 0.96,
    headScale: [0.95, 1.08, 0.96],
    longSleeve: false, // mangas puxadas até o antebraço
    shoeStyle: 'sneaker',
  },
  CAIO: {
    skin: '#d9ae89',
    shirt: '#eff2ee', // branco-gelo
    pants: '#222b3a',
    shoes: '#4d3322',
    hair: '#8a6c42',
    iris: '#685531',
    lip: '#ad6d5c',
    height: 1.84,
    buildX: 1.12,
    buildZ: 1.02,
    headScale: [0.94, 1.10, 0.97],
    longSleeve: true,
    shoeStyle: 'boot',
  },
  NINA: {
    skin: '#c48d72',
    shirt: '#701d34', // vermelho-vinho (bordô)
    pants: '#171920',
    shoes: '#13141a',
    hair: '#17171f',
    iris: '#2c1e1d',
    lip: '#8f2c3f',
    height: 1.72,
    buildX: 0.87,
    buildZ: 0.86,
    headScale: [0.90, 1.08, 0.93],
    longSleeve: true,
    feminine: true,
    shoeStyle: 'heel',
  },
  MAYA: {
    skin: '#cd936c',
    shirt: '#daa01e', // amarelo-mostarda (corta-vento)
    pants: '#2b3d57',
    shoes: '#e9e3d4',
    hair: '#7e3c20',
    iris: '#5a361d',
    lip: '#a65d4f',
    height: 1.65,
    buildX: 0.92,
    buildZ: 0.92,
    headScale: [0.94, 1.05, 0.95],
    longSleeve: true,
    feminine: true,
    shoeStyle: 'sneaker',
  },
  GAEL: {
    skin: '#8f5d42',
    shirt: '#2355ab', // jaqueta jeans azul-cobalto
    pants: '#242933',
    shoes: '#20242c',
    hair: '#16151b',
    iris: '#2b1b12',
    lip: '#784838',
    height: 1.80,
    buildX: 1.08,
    buildZ: 1.02,
    headScale: [0.97, 1.07, 0.97],
    longSleeve: true,
    shoeStyle: 'sneaker',
  },
  TINA: {
    skin: '#d6ae97',
    shirt: '#8e66b8', // cardigã oversized roxo/lilás
    pants: '#1d1f2a',
    shoes: '#16171e',
    hair: '#1a1724',
    iris: '#3c2a42',
    lip: '#9f5963',
    height: 1.56,
    buildX: 0.84,
    buildZ: 0.86,
    headScale: [0.92, 1.04, 0.94],
    longSleeve: true,
    feminine: true,
    shoeStyle: 'platform',
  },
  SOFIA: {
    skin: '#c4dfe8',
    shirt: '#eef8ff', // vestido branco semi-transparente
    pants: '#e2f4fa',
    shoes: '#d4ebf2',
    hair: '#69818f',
    iris: '#76b5cc',
    lip: '#8faeb8',
    height: 1.69,
    buildX: 0.85,
    buildZ: 0.84,
    headScale: [0.90, 1.08, 0.93],
    longSleeve: false,
    feminine: true,
    ghost: true,
    shoeStyle: 'flat',
  },
};

// ============================================================================
// Construção de um personagem articulado, esculpido e com contorno toon
// ============================================================================
function buildActor(name, spec) {
  const isGhost = !!spec.ghost;
  const ghostOpts = isGhost
    ? { transparent: true, opacity: 0.60, emissive: '#6cc8ea', emissiveIntensity: 0.38, depthWrite: false }
    : {};
  const skinGhostOpts = isGhost
    ? { transparent: true, opacity: 0.76, emissive: '#58a8c7', emissiveIntensity: 0.28 }
    : {};

  const matSkin = stdMat(spec.skin, { roughness: 0.56, ...skinGhostOpts });
  const matShirt = stdMat(spec.shirt, { roughness: 0.72, ...ghostOpts });
  const matPants = stdMat(spec.pants, { roughness: 0.80, ...ghostOpts });
  const matShoes = stdMat(spec.shoes, { roughness: 0.48, ...ghostOpts });
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
    addShadow(new T.Mesh(buildPelvisGeo(!!spec.feminine, bx, bz), matPants), !isGhost),
    0.0046,
    isGhost
  );
  pelvis.add(hipMesh);

  // Tronco esculpido com cintura e caixa torácica
  const torso = new T.Group();
  torso.position.set(0, 0.05, 0);
  pelvis.add(torso);

  const chestMesh = addOutline(
    addShadow(new T.Mesh(buildTorsoGeo(!!spec.feminine, bx, bz), matShirt), !isGhost),
    0.0052,
    isGhost
  );
  torso.add(chestMesh);

  let sofiaSkirt = null;

  // ==========================================================================
  // Roupas detalhadas com gola, capuz, bolsos, costuras e acessórios da bíblia
  // ==========================================================================
  if (name === 'LEO') {
    const hoodieDark = stdMat('#3c5231', { roughness: 0.84 });
    const stitchMat = stdMat('#647f56', { roughness: 0.88 });

    // Barra canelada na cintura do moletom
    const hem = addShadow(new T.Mesh(new T.CylinderGeometry(0.128 * bx, 0.132 * bx, 0.048, 18), hoodieDark));
    hem.position.set(0, 0.028, 0);
    hem.scale.set(1, 1, 0.78 * bz);
    addOutline(hem, 0.0036);
    torso.add(hem);

    // Capuz volumoso e dobrado atrás da gola
    const hoodRing = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.118, 0.036, 10, 20), matShirt)),
      0.0038
    );
    hoodRing.position.set(0, 0.448, -0.022);
    hoodRing.rotation.x = Math.PI / 2 + 0.24;
    torso.add(hoodRing);

    const hoodBack = addShadow(new T.Mesh(new T.SphereGeometry(0.115, 14, 10), hoodieDark));
    hoodBack.position.set(0, 0.388, -0.102);
    hoodBack.scale.set(1.12, 0.92, 0.56);
    addOutline(hoodBack, 0.0038);
    torso.add(hoodBack);

    // Bolso canguru trapezoidal com aberturas laterais e costura
    const pocket = addOutline(
      addShadow(new T.Mesh(new T.BoxGeometry(0.205, 0.112, 0.034), hoodieDark)),
      0.0028
    );
    pocket.position.set(0, 0.138, 0.108 * bz);
    torso.add(pocket);

    const pocketTopStitch = new T.Mesh(new T.BoxGeometry(0.195, 0.005, 0.005), stitchMat);
    pocketTopStitch.position.set(0, 0.190, 0.126 * bz);
    torso.add(pocketTopStitch);

    for (const sx of [-1, 1]) {
      const opening = new T.Mesh(new T.BoxGeometry(0.012, 0.095, 0.012), stdMat('#263620', { roughness: 0.9 }));
      opening.position.set(sx * 0.098, 0.138, 0.116 * bz);
      opening.rotation.z = sx * 0.14;
      torso.add(opening);

      // Costura raglan nos ombros
      const seam = new T.Mesh(new T.BoxGeometry(0.005, 0.14, 0.005), stitchMat);
      seam.position.set(sx * 0.105, 0.375, 0.102 * bz);
      seam.rotation.z = sx * 0.42;
      torso.add(seam);
    }

    // Cordões claros com ponteiras metálicas
    const matStr = stdMat('#ebe7dc', { roughness: 0.68 });
    for (const sx of [-0.042, 0.042]) {
      const str = new T.Mesh(new T.CylinderGeometry(0.0055, 0.0055, 0.155, 6), matStr);
      str.position.set(sx, 0.345, 0.116 * bz);
      torso.add(str);
      const aglet = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.018, 6), matSilver);
      aglet.position.set(sx, 0.264, 0.116 * bz);
      torso.add(aglet);
    }
  } else if (name === 'CAIO') {
    // Camisa de linho branco-gelo com gola dobrada aberta em V, bolso, costura e corrente dourada
    const collarMat = stdMat('#e1e6e1', { roughness: 0.72 });
    const seamMat = stdMat('#c8cec8', { roughness: 0.80 });

    const vSkin = new T.Mesh(new T.ConeGeometry(0.056, 0.135, 10), matSkin);
    vSkin.rotation.x = Math.PI;
    vSkin.position.set(0, 0.415, 0.106 * bz);
    vSkin.scale.set(1, 1, 0.45);
    torso.add(vSkin);

    // Gola estruturada envolvendo a nuca + pontas abertas
    const backCollar = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.088, 0.020, 8, 16, Math.PI * 1.35), collarMat)),
      0.0030
    );
    backCollar.position.set(0, 0.464, -0.008);
    backCollar.rotation.set(Math.PI / 2 + 0.14, 0, Math.PI * 0.82);
    torso.add(backCollar);

    for (const s of [-1, 1]) {
      const lapel = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.056, 0.115, 0.026), collarMat)),
        0.0024
      );
      lapel.position.set(s * 0.068, 0.436, 0.092 * bz);
      lapel.rotation.set(0.18, s * 0.36, s * 0.32);
      torso.add(lapel);
    }

    // Carcela central com costura e botões
    const placket = new T.Mesh(new T.BoxGeometry(0.028, 0.30, 0.012), collarMat);
    placket.position.set(0, 0.20, 0.118 * bz);
    torso.add(placket);
    const btnMat = stdMat('#d5cfc2', { roughness: 0.36 });
    for (let i = 0; i < 4; i++) {
      const btn = new T.Mesh(new T.SphereGeometry(0.0072, 8, 6), btnMat);
      btn.position.set(0, 0.105 + i * 0.066, 0.125 * bz);
      torso.add(btn);
    }

    // Bolso peitoral esquerdo com costura
    const chestPkt = new T.Mesh(new T.BoxGeometry(0.066, 0.068, 0.012), collarMat);
    chestPkt.position.set(0.088, 0.312, 0.116 * bz);
    torso.add(chestPkt);
    const pktStitch = new T.Mesh(new T.BoxGeometry(0.068, 0.005, 0.014), seamMat);
    pktStitch.position.set(0.088, 0.342, 0.117 * bz);
    torso.add(pktStitch);

    // Corrente fina dourada
    const chain = new T.Mesh(new T.TorusGeometry(0.070, 0.0055, 8, 22), matGold);
    chain.position.set(0, 0.448, 0.036);
    chain.rotation.x = Math.PI / 2 + 0.48;
    torso.add(chain);

    // Cinto de couro marrom + passantes + fivela dourada
    const beltMat = stdMat('#442d1e', { roughness: 0.52 });
    const belt = new T.Mesh(new T.CylinderGeometry(0.138 * bx, 0.140 * bx, 0.036, 18), beltMat);
    belt.position.set(0, 0.036, 0);
    belt.scale.set(1, 1, 0.78 * bz);
    addOutline(belt, 0.0032);
    torso.add(belt);
    const buckle = new T.Mesh(new T.BoxGeometry(0.044, 0.038, 0.018), matGold);
    buckle.position.set(0, 0.036, 0.112 * bz);
    torso.add(buckle);
  } else if (name === 'NINA') {
    const knitDark = stdMat('#581528', { roughness: 0.80 });
    const scarfMat = stdMat('#8e223f', { roughness: 0.38, metalness: 0.08 });

    // Gola alta canelada elegante
    const turtleNeck = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(0.058, 0.068, 0.102, 16), matShirt)),
      0.0036
    );
    turtleNeck.position.set(0, 0.472, 0);
    torso.add(turtleNeck);
    for (let r = 0; r < 3; r++) {
      const rib = new T.Mesh(new T.TorusGeometry(0.061 + r * 0.002, 0.004, 6, 16), knitDark);
      rib.position.set(0, 0.498 - r * 0.022, 0);
      rib.rotation.x = Math.PI / 2;
      torso.add(rib);
    }

    // Lenço de seda vinho modelado com nó suave e cauda esvoaçante
    const scarfRing = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.082, 0.020, 8, 20), scarfMat)),
      0.0030
    );
    scarfRing.position.set(0, 0.436, 0.012);
    scarfRing.rotation.x = Math.PI / 2 + 0.24;
    torso.add(scarfRing);

    const scarfKnot = addShadow(new T.Mesh(new T.SphereGeometry(0.024, 10, 8), scarfMat));
    scarfKnot.position.set(0.028, 0.415, 0.088 * bz);
    torso.add(scarfKnot);

    const scarfTail = buildTaperedStrand(
      [
        [0.028, 0.412, 0.090 * bz],
        [0.044, 0.320, 0.118 * bz],
        [0.052, 0.205, 0.114 * bz],
        [0.042, 0.115, 0.102 * bz],
      ],
      { rStart: 0.020, rMid: 0.028, rTip: 0.014, flatten: 0.24, segs: 12, mat: scarfMat, outline: 0.0024 }
    );
    torso.add(scarfTail);

    // Costura vertical estilizada do suéter + cós alto marcado com fivela prateada
    for (const s of [-1, 1]) {
      const dart = new T.Mesh(new T.BoxGeometry(0.004, 0.24, 0.004), knitDark);
      dart.position.set(s * 0.056, 0.22, 0.102 * bz);
      torso.add(dart);
    }
    const waistBand = new T.Mesh(new T.CylinderGeometry(0.116 * bx, 0.124 * bx, 0.044, 16), matPants);
    waistBand.position.set(0, 0.036, 0);
    waistBand.scale.set(1, 1, 0.78 * bz);
    addOutline(waistBand, 0.0032);
    torso.add(waistBand);
    const silverBuckle = new T.Mesh(new T.BoxGeometry(0.032, 0.026, 0.012), matSilver);
    silverBuckle.position.set(0, 0.036, 0.098 * bz);
    torso.add(silverBuckle);
  } else if (name === 'MAYA') {
    const lapelMat = stdMat('#c48c16', { roughness: 0.66 });
    const trimDark = stdMat('#20242c', { roughness: 0.78 });
    const seamMat = stdMat('#a97410', { roughness: 0.76 });

    // Blusa preta interna
    const innerTee = addShadow(new T.Mesh(new T.BoxGeometry(0.106, 0.38, 0.044), stdMat('#1b1e24', { roughness: 0.80 })));
    innerTee.position.set(0, 0.24, 0.088 * bz);
    torso.add(innerTee);

    // Gola alta do corta-vento + capuz dobrado atrás
    const jCollar = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.102, 0.026, 8, 18, Math.PI * 1.48), matShirt)),
      0.0034
    );
    jCollar.position.set(0, 0.448, -0.012);
    jCollar.rotation.set(Math.PI / 2 + 0.12, 0, Math.PI * 0.76);
    torso.add(jCollar);

    const jHood = addShadow(new T.Mesh(new T.SphereGeometry(0.098, 12, 10), lapelMat));
    jHood.position.set(0, 0.392, -0.096);
    jHood.scale.set(1.08, 0.85, 0.50);
    addOutline(jHood, 0.0034);
    torso.add(jHood);

    // Abas da jaqueta, zíper escuro, bolsos laterais com lapela e costura
    for (const s of [-1, 1]) {
      const flap = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.068, 0.38, 0.036), lapelMat)),
        0.0024
      );
      flap.position.set(s * 0.072, 0.23, 0.096 * bz);
      torso.add(flap);

      const zipTrack = new T.Mesh(new T.BoxGeometry(0.008, 0.37, 0.010), trimDark);
      zipTrack.position.set(s * 0.038, 0.23, 0.114 * bz);
      torso.add(zipTrack);

      // Bolso lateral com aba
      const sidePkt = new T.Mesh(new T.BoxGeometry(0.056, 0.018, 0.014), seamMat);
      sidePkt.position.set(s * 0.082, 0.125, 0.112 * bz);
      sidePkt.rotation.z = s * 0.22;
      torso.add(sidePkt);

      // Recorte/costura de peito do corta-vento
      const chestSeam = new T.Mesh(new T.BoxGeometry(0.075, 0.006, 0.010), seamMat);
      chestSeam.position.set(s * 0.082, 0.328, 0.110 * bz);
      torso.add(chestSeam);
    }

    // Barra elástica escura
    const waistHem = new T.Mesh(new T.CylinderGeometry(0.118 * bx, 0.122 * bx, 0.034, 16), trimDark);
    waistHem.position.set(0, 0.025, 0);
    waistHem.scale.set(1, 1, 0.80 * bz);
    torso.add(waistHem);

    // Alça listrada + câmera instantânea detalhada
    const strapMat = stdMat('#e6c858', { roughness: 0.72 });
    const strapPts = [
      [-0.068, 0.46, 0.02],
      [-0.064, 0.34, 0.116],
      [-0.050, 0.20, 0.136],
    ];
    torso.add(buildTaperedStrand(strapPts, { rStart: 0.008, rMid: 0.009, rTip: 0.008, flatten: 0.4, segs: 8, mat: strapMat }));
    torso.add(buildTaperedStrand(strapPts.map(([x, y, z]) => [-x, y, z]), { rStart: 0.008, rMid: 0.009, rTip: 0.008, flatten: 0.4, segs: 8, mat: strapMat }));

    const camGroup = new T.Group();
    camGroup.position.set(0, 0.188, 0.146);
    torso.add(camGroup);
    camGroup.add(addOutline(addShadow(new T.Mesh(new T.BoxGeometry(0.116, 0.096, 0.052), stdMat('#f2ede2', { roughness: 0.44 }))), 0.0028));
    const camBand = new T.Mesh(new T.BoxGeometry(0.118, 0.014, 0.054), stdMat('#d9534f', { roughness: 0.40 }));
    camBand.position.y = -0.022;
    camGroup.add(camBand);
    const camLens = new T.Mesh(new T.CylinderGeometry(0.026, 0.028, 0.026, 14), stdMat('#1c222a', { roughness: 0.25, metalness: 0.6 }));
    camLens.rotation.x = Math.PI / 2;
    camLens.position.set(0, 0.005, 0.032);
    camGroup.add(camLens);
    const camGlass = new T.Mesh(new T.CircleGeometry(0.017, 12), stdMat('#3c688a', { roughness: 0.1, metalness: 0.8 }));
    camGlass.position.set(0, 0.005, 0.046);
    camGroup.add(camGlass);
    const camFlash = new T.Mesh(new T.BoxGeometry(0.022, 0.014, 0.012), stdMat('#fff5d6', { emissive: '#ffebaa', emissiveIntensity: 0.4 }));
    camFlash.position.set(0.036, 0.03, 0.027);
    camGroup.add(camFlash);
  } else if (name === 'GAEL') {
    // Jaqueta jeans azul-cobalto com gola dobrada, bolsos peitorais, botões metálicos e costura ocre!
    const innerTee = addShadow(new T.Mesh(new T.BoxGeometry(0.132, 0.39, 0.046), stdMat('#828b96', { roughness: 0.80 })));
    innerTee.position.set(0, 0.245, 0.102 * bz);
    torso.add(innerTee);

    const teeNeck = new T.Mesh(new T.TorusGeometry(0.068, 0.010, 6, 16), stdMat('#6c7580', { roughness: 0.84 }));
    teeNeck.position.set(0, 0.442, 0.030);
    teeNeck.rotation.x = Math.PI / 2 + 0.38;
    torso.add(teeNeck);

    const jeanDark = stdMat('#1c458c', { roughness: 0.76 });
    const denimStitch = stdMat('#c89242', { roughness: 0.72 });

    for (const s of [-1, 1]) {
      const lapel = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.076, 0.39, 0.040), jeanDark)),
        0.0026
      );
      lapel.position.set(s * 0.095, 0.238, 0.106 * bz);
      torso.add(lapel);

      // Costura vertical ocre da jaqueta jeans
      const vStitch = new T.Mesh(new T.BoxGeometry(0.0045, 0.37, 0.005), denimStitch);
      vStitch.position.set(s * 0.062, 0.238, 0.128 * bz);
      torso.add(vStitch);

      // Bolso peitoral com aba e botão prateado
      const pkt = new T.Mesh(new T.BoxGeometry(0.058, 0.054, 0.015), matShirt);
      pkt.position.set(s * 0.105, 0.308, 0.128 * bz);
      torso.add(pkt);
      const pktFlap = new T.Mesh(new T.BoxGeometry(0.060, 0.018, 0.018), jeanDark);
      pktFlap.position.set(s * 0.105, 0.332, 0.130 * bz);
      torso.add(pktFlap);
      const pktSeam = new T.Mesh(new T.BoxGeometry(0.060, 0.004, 0.019), denimStitch);
      pktSeam.position.set(s * 0.105, 0.323, 0.131 * bz);
      torso.add(pktSeam);
      const btn = new T.Mesh(new T.SphereGeometry(0.0065, 6, 6), matSilver);
      btn.position.set(s * 0.105, 0.328, 0.141 * bz);
      torso.add(btn);

      // Botões frontais da jaqueta
      for (let b = 0; b < 3; b++) {
        const fBtn = new T.Mesh(new T.SphereGeometry(0.006, 6, 6), matSilver);
        fBtn.position.set(s * 0.068, 0.11 + b * 0.095, 0.129 * bz);
        torso.add(fBtn);
      }
    }

    // Gola estruturada da jaqueta jeans
    const jCollar = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.112, 0.026, 8, 18, Math.PI * 1.45), jeanDark)),
      0.0034
    );
    jCollar.position.set(0, 0.452, -0.012);
    jCollar.rotation.set(Math.PI / 2 + 0.14, 0, Math.PI * 0.78);
    torso.add(jCollar);
  } else if (name === 'TINA') {
    // Cardigã oversized roxo/lilás com gola xale, bolsos chapados, botões, costura + headphone branco
    const innerTee = addShadow(new T.Mesh(new T.BoxGeometry(0.112, 0.37, 0.044), stdMat('#1d1b26', { roughness: 0.82 })));
    innerTee.position.set(0, 0.24, 0.088 * bz);
    torso.add(innerTee);

    // Detalhe discreto de estampa na camiseta escura
    const graphic = new T.Mesh(new T.CircleGeometry(0.024, 10), stdMat('#a984e6', { roughness: 0.70 }));
    graphic.position.set(0, 0.285, 0.112 * bz);
    torso.add(graphic);

    const cardiTrim = stdMat('#75509e', { roughness: 0.80 });
    const cardiStitch = stdMat('#a882d4', { roughness: 0.85 });
    const btnDark = stdMat('#271e33', { roughness: 0.45 });

    // Gola xale canelada
    const shawl = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.096, 0.022, 8, 18, Math.PI * 1.35), cardiTrim)),
      0.0030
    );
    shawl.position.set(0, 0.448, -0.010);
    shawl.rotation.set(Math.PI / 2 + 0.20, 0, Math.PI * 0.82);
    torso.add(shawl);

    for (const s of [-1, 1]) {
      const edge = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.062, 0.41, 0.038), cardiTrim)),
        0.0024
      );
      edge.position.set(s * 0.070, 0.225, 0.094 * bz);
      torso.add(edge);

      // Bolso chapado baixo do cardigã com barra canelada
      const pkt = new T.Mesh(new T.BoxGeometry(0.062, 0.066, 0.016), matShirt);
      pkt.position.set(s * 0.080, 0.102, 0.110 * bz);
      torso.add(pkt);
      const pktTrim = new T.Mesh(new T.BoxGeometry(0.064, 0.012, 0.018), cardiStitch);
      pktTrim.position.set(s * 0.080, 0.132, 0.111 * bz);
      torso.add(pktTrim);
    }

    for (let b = 0; b < 3; b++) {
      const btn = new T.Mesh(new T.CylinderGeometry(0.0085, 0.0085, 0.006, 10), btnDark);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(-0.048, 0.09 + b * 0.09, 0.116 * bz);
      torso.add(btn);
    }

    // Headphone branco grande no pescoço
    const hpMat = stdMat('#f2f3f8', { roughness: 0.34, metalness: 0.12 });
    const hpPadMat = stdMat('#2c2838', { roughness: 0.75 });
    const hpAccent = stdMat('#b48cf0', { roughness: 0.30, metalness: 0.40 });
    const hpBand = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.106, 0.017, 10, 22, Math.PI * 1.25), hpMat)),
      0.0026
    );
    hpBand.position.set(0, 0.452, -0.008);
    hpBand.rotation.set(Math.PI / 2 + 0.32, 0, Math.PI * 0.88);
    torso.add(hpBand);
    for (const s of [-1, 1]) {
      const cup = addOutline(
        addShadow(new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.032, 14), hpMat)),
        0.0024
      );
      cup.rotation.set(0.25, 0, Math.PI / 2 - s * 0.35);
      cup.position.set(s * 0.088, 0.405, 0.078);
      torso.add(cup);
      const ring = new T.Mesh(new T.TorusGeometry(0.034, 0.005, 8, 16), hpAccent);
      ring.rotation.copy(cup.rotation);
      ring.rotation.y += Math.PI / 2;
      ring.position.set(s * 0.102, 0.405, 0.084);
      torso.add(ring);
      const pad = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.015, 12), hpPadMat);
      pad.rotation.copy(cup.rotation);
      pad.position.set(s * 0.074, 0.405, 0.072);
      torso.add(pad);
    }
  } else if (name === 'SOFIA') {
    // Vestido branco vintage fluído semi-transparente e assustador
    const dressMat = stdMat('#eaf7ff', {
      roughness: 0.50,
      transparent: true,
      opacity: 0.58,
      emissive: '#76d0f0',
      emissiveIntensity: 0.42,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const dressTrimMat = stdMat('#d4f2ff', {
      roughness: 0.45,
      transparent: true,
      opacity: 0.70,
      emissive: '#8de2ff',
      emissiveIntensity: 0.48,
      side: T.DoubleSide,
      depthWrite: false,
    });

    sofiaSkirt = new T.Mesh(buildSofiaSkirtGeo(), dressMat);
    sofiaSkirt.position.set(0, 0.02, 0);
    pelvis.add(sofiaSkirt);

    // Faixa na cintura + gola rendada vintage
    const sash = new T.Mesh(new T.TorusGeometry(0.098, 0.012, 8, 20), dressTrimMat);
    sash.position.set(0, 0.115, 0);
    sash.rotation.x = Math.PI / 2;
    sash.scale.set(1.0, 0.80, 1.0);
    torso.add(sash);

    const laceCollar = new T.Mesh(new T.TorusGeometry(0.086, 0.017, 8, 20), dressTrimMat);
    laceCollar.position.set(0, 0.445, 0.010);
    laceCollar.rotation.x = Math.PI / 2 + 0.12;
    torso.add(laceCollar);

    // Aura espectral suave
    const glow = new T.PointLight('#8de2ff', 1.75, 5.4, 1.4);
    glow.position.set(0, 1.5, 0.25);
    root.add(glow);
  }

  // ==========================================================================
  // Pescoço anatômico e Cabeça esculpida
  // ==========================================================================
  const neckGeo = new T.CylinderGeometry(0.044, 0.056, 0.115, 14);
  const neck = addOutline(addShadow(new T.Mesh(neckGeo, matSkin), !isGhost), 0.0038, isGhost);
  neck.position.set(0, 0.502, 0.004);
  neck.rotation.x = 0.05;
  torso.add(neck);

  const headPivot = new T.Group();
  headPivot.position.set(0, 0.54, 0);
  torso.add(headPivot);

  // Cabeça com contorno facial refinado (leve afinamento na mandíbula)
  const headGeo = new T.SphereGeometry(0.143, 24, 20);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);
    // Afina suavemente a mandíbula inferior para rosto mais bonito e menos "bola"
    if (y < 0) {
      const tLow = clamp(-y / 0.143, 0, 1);
      const jawTaper = spec.feminine ? 1 - tLow * 0.22 : 1 - tLow * 0.13;
      x *= jawTaper;
      if (z > 0) z *= 1 - tLow * 0.04;
    }
    // Leve destaque nas maçãs do rosto
    const cheek = Math.exp(-Math.pow((y + 0.018) / 0.042, 2)) * clamp(z / 0.143, 0, 1);
    x *= 1 + cheek * (spec.feminine ? 0.035 : 0.02);
    hPos.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();

  const headMesh = addShadow(new T.Mesh(headGeo, matSkin), !isGhost);
  headMesh.position.set(0, 0.13, 0);
  headMesh.scale.set(...spec.headScale);
  addOutline(headMesh, 0.0048, isGhost);
  headPivot.add(headMesh);

  // Queixo delicadamente esculpido
  const chin = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.046 : 0.054, 12, 10), matSkin);
  chin.position.set(0, 0.028, 0.056);
  chin.scale.set(spec.feminine ? 0.94 : 1.08, 0.80, 0.92);
  headPivot.add(chin);

  // Orelhas com contorno suave
  for (const sx of [-1, 1]) {
    const ear = addShadow(new T.Mesh(new T.SphereGeometry(0.025, 10, 8), matSkin), !isGhost);
    ear.position.set(sx * 0.132 * spec.headScale[0], 0.125, -0.008);
    ear.scale.set(0.48, 1.12, 0.74);
    addOutline(ear, 0.0030, isGhost);
    headPivot.add(ear);
  }

  // Nariz esculpido (ponte + ponta delicada + abas sutis)
  const noseW = spec.feminine ? 0.0095 : 0.0115;
  const noseBridge = new T.Mesh(new T.CapsuleGeometry(noseW, 0.028, 6, 8), matSkin);
  noseBridge.position.set(0, 0.126, 0.128);
  noseBridge.rotation.x = -0.24;
  headPivot.add(noseBridge);

  const noseTip = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.0135 : 0.0155, 10, 8), matSkin);
  noseTip.position.set(0, 0.107, 0.137);
  noseTip.scale.set(0.92, 0.84, 0.96);
  headPivot.add(noseTip);

  for (const sx of [-1, 1]) {
    const wing = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.0075 : 0.0088, 8, 6), matSkin);
    wing.position.set(sx * 0.0095, 0.104, 0.131);
    wing.scale.set(1.0, 0.75, 0.85);
    headPivot.add(wing);
  }

  // ==========================================================================
  // Olhos expressivos (esclera + anel limbar + íris + pupila + brilho + cílios!)
  // ==========================================================================
  const eyes = [];
  const eyeBalls = [];
  const matEyeWhite = isGhost
    ? stdMat('#e4f7ff', { roughness: 0.22, emissive: '#9fe6ff', emissiveIntensity: 0.72 })
    : stdMat('#fafbfd', { roughness: 0.20 });
  const matLimbal = stdMat(isGhost ? '#4c8ea8' : '#141218', { roughness: 0.20 });
  const matIris = stdMat(spec.iris, { roughness: 0.16, metalness: 0.06 });
  const matPupil = stdMat('#07080d', { roughness: 0.06 });
  const matHighlight = new T.MeshBasicMaterial({ color: '#ffffff' });
  const matLash = stdMat(isGhost ? '#2b4754' : '#131018', { roughness: 0.65 });

  for (const sx of [-1, 1]) {
    const eyeGroup = new T.Group();
    eyeGroup.position.set(sx * 0.047, 0.146, 0.118);
    headPivot.add(eyeGroup);

    const sclera = new T.Mesh(new T.SphereGeometry(0.0245, 14, 10), matEyeWhite);
    sclera.scale.set(1.08, 1.02, 0.70);
    eyeGroup.add(sclera);

    // Subgrupo eyeBall gira suavemente para olhar animado (saccades + olhar pro falante)
    const eyeBall = new T.Group();
    eyeGroup.add(eyeBall);

    const limbal = new T.Mesh(new T.SphereGeometry(0.0156, 12, 10), matLimbal);
    limbal.position.set(0, 0, 0.0118);
    limbal.scale.set(1.0, 1.04, 0.46);
    eyeBall.add(limbal);

    const iris = new T.Mesh(new T.SphereGeometry(0.0142, 12, 10), matIris);
    iris.position.set(0, 0, 0.0128);
    iris.scale.set(1.0, 1.04, 0.50);
    eyeBall.add(iris);

    const pupil = new T.Mesh(new T.SphereGeometry(isGhost ? 0.0068 : 0.0080, 10, 8), matPupil);
    pupil.position.set(0, 0, 0.0172);
    pupil.scale.set(1, 1, 0.45);
    eyeBall.add(pupil);

    const glint = new T.Mesh(new T.SphereGeometry(0.0040, 8, 6), matHighlight);
    glint.position.set(0.0052, 0.0058, 0.020);
    eyeBall.add(glint);

    const glint2 = new T.Mesh(new T.SphereGeometry(0.0020, 6, 6), matHighlight);
    glint2.position.set(-0.0044, -0.0042, 0.0196);
    eyeBall.add(glint2);

    // Linha superior de cílios + cílios curvados externos nas meninas!
    const lash = new T.Mesh(
      new T.TorusGeometry(0.0245, spec.feminine ? 0.0038 : 0.0022, 6, 14, Math.PI * 0.88),
      matLash
    );
    lash.position.set(0, 0.005, 0.0085);
    lash.rotation.z = Math.PI * 0.06;
    eyeGroup.add(lash);

    if (spec.feminine) {
      // 3 cílios delicados curvados para cima no canto externo do olho
      for (let c = 0; c < 3; c++) {
        const flick = new T.Mesh(new T.ConeGeometry(0.0024, 0.012 - c * 0.0018, 5), matLash);
        flick.position.set(sx * (0.021 + c * 0.0025), 0.011 - c * 0.0032, 0.011 - c * 0.0015);
        flick.rotation.z = -sx * (0.78 + c * 0.24);
        flick.rotation.x = -0.20;
        eyeGroup.add(flick);
      }
      // Sutil delineado inferior nos cantos externos
      const lowerLash = new T.Mesh(new T.TorusGeometry(0.0235, 0.0014, 5, 10, Math.PI * 0.45), matLash);
      lowerLash.position.set(sx * 0.003, -0.003, 0.0075);
      lowerLash.rotation.z = sx > 0 ? -Math.PI * 0.42 : -Math.PI * 0.98;
      eyeGroup.add(lowerLash);
    }

    eyes.push(eyeGroup);
    eyeBalls.push(eyeBall);
  }

  // Sobrancelhas arqueadas expressivas (dois segmentos suaves formando arco natural)
  const matBrow = stdMat(spec.hair, { roughness: 0.74 });
  function makeBrow(side) {
    const g = new T.Group();
    g.position.set(side * 0.048, 0.186, 0.124);
    const thick = spec.feminine ? 0.0044 : 0.0062;
    const inner = new T.Mesh(new T.CapsuleGeometry(thick, 0.024, 4, 8), matBrow);
    inner.rotation.z = Math.PI / 2 - side * 0.14;
    inner.position.set(-side * 0.010, 0.001, 0.002);
    g.add(inner);

    const outer = new T.Mesh(new T.CapsuleGeometry(thick * 0.82, 0.020, 4, 8), matBrow);
    outer.rotation.z = Math.PI / 2 + side * 0.26;
    outer.position.set(side * 0.012, -0.001, -0.002);
    g.add(outer);

    headPivot.add(g);
    return g;
  }
  const browL = makeBrow(-1); // lado -X (direita do personagem, mantendo convenção do código original)
  const browR = makeBrow(1);  // lado +X (esquerda do personagem)

  // Boca animada com arco do cupido (lábio superior + inferior + interior + dentes sutis)
  const mouthGroup = new T.Group();
  mouthGroup.position.set(0, 0.068, 0.123);
  headPivot.add(mouthGroup);

  const mouthInner = new T.Mesh(
    new T.SphereGeometry(0.024, 10, 8),
    stdMat(isGhost ? '#456673' : '#3a131c', { roughness: 0.90 })
  );
  mouthInner.scale.set(1.10, 0.18, 0.50);
  mouthGroup.add(mouthInner);

  const mouthTeeth = new T.Mesh(
    new T.BoxGeometry(0.028, 0.007, 0.008),
    stdMat(isGhost ? '#d9f2fa' : '#f4f1ea', { roughness: 0.30 })
  );
  mouthTeeth.position.set(0, 0.003, 0.005);
  mouthTeeth.visible = false;
  mouthGroup.add(mouthTeeth);

  const matLip = stdMat(spec.lip, { roughness: spec.feminine ? 0.38 : 0.52, ...skinGhostOpts });
  const mouthUpper = new T.Group();
  mouthGroup.add(mouthUpper);
  for (const sx of [-1, 1]) {
    const uHalf = new T.Mesh(new T.CapsuleGeometry(spec.feminine ? 0.0046 : 0.0042, 0.018, 4, 8), matLip);
    uHalf.rotation.z = Math.PI / 2 + sx * 0.18;
    uHalf.position.set(sx * 0.010, 0.0042, 0.0085);
    mouthUpper.add(uHalf);
  }

  const mouthLip = new T.Mesh(
    new T.CapsuleGeometry(spec.feminine ? 0.0062 : 0.0052, 0.032, 5, 10),
    matLip
  );
  mouthLip.rotation.z = Math.PI / 2;
  mouthLip.position.set(0, -0.0055, 0.009);
  mouthGroup.add(mouthLip);

  // ==========================================================================
  // Traços faciais únicos de cada personagem (biblia.md)
  // ==========================================================================
  if (name === 'CAIO') {
    const scar = new T.Mesh(new T.BoxGeometry(0.0045, 0.026, 0.008), stdMat('#ebd1b9', { roughness: 0.65 }));
    scar.position.set(-0.056, 0.188, 0.130);
    scar.rotation.z = -0.28;
    headPivot.add(scar);
  } else if (name === 'NINA') {
    for (const sx of [-1, 1]) {
      const hoop = new T.Mesh(new T.TorusGeometry(0.026, 0.0038, 8, 22), matGold);
      hoop.position.set(sx * 0.126, 0.088, 0.004);
      hoop.rotation.y = Math.PI / 2 + sx * 0.25;
      headPivot.add(hoop);
    }
  } else if (name === 'MAYA') {
    const matFreckle = stdMat('#87482b', { roughness: 0.72 });
    const frecklePos = [
      [-0.012, 0.114, 0.138], [0.010, 0.116, 0.138], [0.0, 0.119, 0.136],
      [-0.038, 0.108, 0.126], [-0.052, 0.104, 0.120], [-0.044, 0.098, 0.124], [-0.062, 0.110, 0.114],
      [0.038, 0.108, 0.126], [0.052, 0.104, 0.120], [0.044, 0.098, 0.124], [0.062, 0.110, 0.114],
    ];
    for (const [fx, fy, fz] of frecklePos) {
      const dot = new T.Mesh(new T.SphereGeometry(0.0032, 6, 6), matFreckle);
      dot.position.set(fx, fy, fz);
      dot.scale.set(1, 1, 0.5);
      headPivot.add(dot);
    }
  } else if (name === 'GAEL') {
    const matFrame = stdMat('#dce8f2', { roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.74 });
    const matLens = stdMat('#e4f3ff', { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.20 });
    for (const sx of [-1, 1]) {
      const rim = new T.Mesh(new T.TorusGeometry(0.035, 0.0046, 8, 22), matFrame);
      rim.position.set(sx * 0.048, 0.146, 0.144);
      rim.scale.set(1.06, 0.88, 1);
      headPivot.add(rim);

      const lens = new T.Mesh(new T.CircleGeometry(0.032, 16), matLens);
      lens.position.set(sx * 0.048, 0.146, 0.144);
      lens.scale.set(1.06, 0.88, 1);
      headPivot.add(lens);

      const temple = new T.Mesh(new T.BoxGeometry(0.0045, 0.006, 0.135), matFrame);
      temple.position.set(sx * 0.090, 0.148, 0.082);
      headPivot.add(temple);
    }
    const bridge = new T.Mesh(new T.BoxGeometry(0.026, 0.0055, 0.0055), matFrame);
    bridge.position.set(0, 0.149, 0.146);
    headPivot.add(bridge);
  }

  // Cabelo esculpido
  const hairGroup = buildHair(headPivot, name, matSkin);

  // ==========================================================================
  // Braços articulados com ombro arredondado, punho e mão com 5 dedos simples
  // ==========================================================================
  function makeArm(side) {
    const shoulder = new T.Group();
    shoulder.position.set(side * (0.178 * bx), 0.402, 0);
    torso.add(shoulder);

    // Ombro arredondado (deltoide) para transição suave com o torso
    const deltoidR = spec.feminine ? 0.048 : 0.056;
    const deltoid = addShadow(new T.Mesh(new T.SphereGeometry(deltoidR, 12, 10), matShirt), !isGhost);
    deltoid.scale.set(1.02, 1.06, 0.94);
    addOutline(deltoid, 0.0040, isGhost);
    shoulder.add(deltoid);

    const upperR = spec.feminine ? 0.039 : 0.046;
    const upper = addOutline(
      addShadow(new T.Mesh(new T.CapsuleGeometry(upperR, 0.178, 6, 12), matShirt), !isGhost),
      0.0042,
      isGhost
    );
    upper.position.set(0, -0.108, 0);
    shoulder.add(upper);

    // Manga bufante leve para o vestido vintage de Sofia
    if (isGhost) {
      const puff = new T.Mesh(new T.SphereGeometry(0.058, 12, 10), matShirt);
      puff.position.set(0, -0.055, 0);
      puff.scale.set(1.08, 1.25, 1.05);
      shoulder.add(puff);
    }

    const elbow = new T.Group();
    elbow.position.set(0, -0.222, 0);
    shoulder.add(elbow);

    const lowerMat = spec.longSleeve ? matShirt : matSkin;
    const lowerR = spec.feminine ? 0.032 : 0.038;
    const lower = addOutline(
      addShadow(
        new T.Mesh(new T.CylinderGeometry(lowerR, lowerR * 0.78, 0.205, 12), lowerMat),
        !isGhost
      ),
      0.0038,
      isGhost
    );
    lower.position.set(0, -0.102, 0);
    elbow.add(lower);

    // Articulação arredondada do cotovelo
    const elbowCap = new T.Mesh(new T.SphereGeometry(lowerR * 1.02, 10, 8), name === 'SOFIA' ? matSkin : matShirt);
    elbow.add(elbowCap);

    // Punho da manga (puxado para Leo, punho acabado para manga longa)
    if (name === 'LEO') {
      const cuff = addOutline(
        new T.Mesh(new T.CylinderGeometry(0.042, 0.040, 0.042, 12), stdMat('#3c5231', { roughness: 0.84 })),
        0.0030
      );
      cuff.position.set(0, -0.022, 0);
      elbow.add(cuff);
    } else if (spec.longSleeve) {
      const cuffColor = name === 'CAIO' ? '#e1e6e1' : name === 'GAEL' ? '#1c458c' : name === 'TINA' ? '#75509e' : spec.shirt;
      const cuff = addOutline(
        new T.Mesh(new T.CylinderGeometry(lowerR * 0.88, lowerR * 0.84, 0.034, 12), stdMat(cuffColor, { roughness: 0.76 })),
        0.0028
      );
      cuff.position.set(0, -0.188, 0);
      elbow.add(cuff);
    }

    // Mão esculpida com palma, polegar e 4 dedos simples articulados
    const hand = new T.Group();
    hand.position.set(0, -0.214, 0);
    elbow.add(hand);

    const palm = addShadow(new T.Mesh(new T.SphereGeometry(0.031, 10, 8), matSkin), !isGhost);
    palm.position.set(0, -0.020, 0);
    palm.scale.set(0.86, 1.12, 0.56);
    addOutline(palm, 0.0030, isGhost);
    hand.add(palm);

    const thumb = new T.Mesh(new T.CapsuleGeometry(0.0072, 0.022, 4, 6), matSkin);
    thumb.position.set(-side * 0.024, -0.018, 0.014);
    thumb.rotation.set(0.32, 0, side * 0.48);
    hand.add(thumb);

    // 4 dedos (indicador separado para apontar + médio/anelar/mínimo)
    const fingerSpecs = [
      { x: -side * 0.016, len: 0.028, r: 0.0058 }, // indicador
      { x: -side * 0.005, len: 0.032, r: 0.0060 }, // médio
      { x: side * 0.006, len: 0.028, r: 0.0056 },  // anelar
      { x: side * 0.016, len: 0.022, r: 0.0050 },  // mínimo
    ];
    const indexPivot = new T.Group();
    indexPivot.position.set(fingerSpecs[0].x, -0.045, 0.003);
    hand.add(indexPivot);
    const indexMesh = new T.Mesh(new T.CapsuleGeometry(fingerSpecs[0].r, fingerSpecs[0].len, 4, 6), matSkin);
    indexMesh.position.set(0, -fingerSpecs[0].len * 0.55, 0);
    indexPivot.add(indexMesh);

    const otherFingers = new T.Group();
    otherFingers.position.set(0, -0.045, 0.002);
    hand.add(otherFingers);
    for (let f = 1; f < fingerSpecs.length; f++) {
      const fs = fingerSpecs[f];
      const fm = new T.Mesh(new T.CapsuleGeometry(fs.r, fs.len, 4, 6), matSkin);
      fm.position.set(fs.x, -fs.len * 0.55, 0);
      otherFingers.add(fm);
    }

    // Acessórios de pulso e dedo conforme biblia.md
    if (name === 'CAIO' && side === -1) {
      const strap = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.024, 14), matGold);
      strap.position.set(0, -0.175, 0);
      elbow.add(strap);
      const face = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.010, 14), stdMat('#faf8f0', { roughness: 0.2 }));
      face.rotation.z = Math.PI / 2;
      face.position.set(-0.038, -0.175, 0.004);
      elbow.add(face);
    }
    if (name === 'GAEL' && side === -1) {
      // Curativo branco no dedo indicador direito!
      const bandage = new T.Mesh(new T.CylinderGeometry(0.0078, 0.0078, 0.020, 8), stdMat('#f6f5ee', { roughness: 0.84 }));
      bandage.position.set(0, -0.014, 0);
      indexPivot.add(bandage);
    }
    if (name === 'NINA' && side === -1) {
      // Anel de prata com pedra ônix no indicador direito!
      const ring = new T.Mesh(new T.TorusGeometry(0.0072, 0.0022, 6, 12), matSilver);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -0.009, 0);
      indexPivot.add(ring);
      const onyx = new T.Mesh(new T.SphereGeometry(0.0046, 6, 6), stdMat('#111218', { roughness: 0.14, metalness: 0.45 }));
      onyx.position.set(0, -0.009, 0.0085);
      indexPivot.add(onyx);
    }
    if (name === 'LEO' && side === 1) {
      const cord = new T.Mesh(new T.TorusGeometry(0.036, 0.0055, 6, 14), stdMat('#1a1c20', { roughness: 0.85 }));
      cord.rotation.x = Math.PI / 2;
      cord.position.set(0, -0.155, 0);
      elbow.add(cord);
      const watch = new T.Mesh(new T.CylinderGeometry(0.037, 0.037, 0.024, 14), stdMat('#232930', { roughness: 0.45 }));
      watch.position.set(0, -0.182, 0);
      elbow.add(watch);
    }

    return {
      shoulder,
      elbow,
      hand,
      indexPivot,
      otherFingers,
      baseShoulderY: 0.402,
    };
  }

  const armL = makeArm(1);
  const armR = makeArm(-1);

  // ==========================================================================
  // Pernas articuladas e sapatos bem modelados (pés assentados em y = 0)
  // ==========================================================================
  function makeLeg(side) {
    const hip = new T.Group();
    hip.position.set(side * (0.090 * bx), -0.02, 0);
    pelvis.add(hip);

    const thighTop = spec.feminine ? 0.062 : 0.066;
    const thighBot = spec.feminine ? 0.047 : 0.052;
    const thigh = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(thighTop, thighBot, 0.36, 14), matPants), !isGhost),
      0.0044,
      isGhost
    );
    thigh.position.set(0, -0.18, 0);
    hip.add(thigh);

    const knee = new T.Group();
    knee.position.set(0, -0.37, 0);
    hip.add(knee);

    const kneeCap = new T.Mesh(new T.SphereGeometry(thighBot * 0.98, 10, 8), matPants);
    knee.add(kneeCap);

    const shinTop = spec.feminine ? 0.045 : 0.050;
    const shinBot = spec.feminine ? 0.034 : 0.039;
    const shin = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(shinTop, shinBot, 0.37, 14), matPants), !isGhost),
      0.0042,
      isGhost
    );
    shin.position.set(0, -0.185, 0);
    knee.add(shin);

    // Barra/dobra da calça no tornozelo
    if (!isGhost) {
      const pantCuff = new T.Mesh(new T.CylinderGeometry(shinBot * 1.12, shinBot * 1.12, 0.026, 12), matPants);
      pantCuff.position.set(0, -0.360, 0);
      knee.add(pantCuff);
    }

    // Sapato esculpido (biqueira arredondada, cabedal, língua/cadarço, sola)
    const shoe = new T.Group();
    shoe.position.set(0, -0.405, 0.020);
    knee.add(shoe);

    const isPlatform = spec.shoeStyle === 'platform';
    const isHeel = spec.shoeStyle === 'heel';
    const soleH = isPlatform ? 0.030 : 0.018;
    const soleColor =
      spec.shoeStyle === 'sneaker' ? '#ece8df' : isGhost ? '#cce7f0' : '#0e1015';
    const matSole = stdMat(soleColor, { roughness: 0.84, ...ghostOpts });

    // Parte traseira / tornozelo do sapato
    const heelBody = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(0.044, 0.047, 0.068, 12), matShoes), !isGhost),
      0.0034,
      isGhost
    );
    heelBody.position.set(0, 0.005, -0.012);
    shoe.add(heelBody);

    // Corpo dianteiro / biqueira arredondada
    const toeBox = addShadow(new T.Mesh(new T.SphereGeometry(0.046, 12, 10), matShoes), !isGhost);
    toeBox.position.set(0, -0.010, 0.066);
    toeBox.scale.set(0.96, 0.66, 1.58);
    addOutline(toeBox, 0.0034, isGhost);
    shoe.add(toeBox);

    // Sola contornada (base encosta exatamente em y = -0.45 -> chão em y = 0!)
    const sole = addOutline(
      new T.Mesh(new T.BoxGeometry(0.092, soleH, 0.196), matSole),
      0.0026,
      isGhost
    );
    sole.position.set(0, -0.045 + soleH * 0.5, 0.036);
    shoe.add(sole);

    if (isHeel) {
      const heelBlock = new T.Mesh(new T.BoxGeometry(0.050, 0.024, 0.048), matSole);
      heelBlock.position.set(0, -0.033, -0.030);
      shoe.add(heelBlock);
    }

    if (spec.shoeStyle === 'sneaker') {
      const laceMat = stdMat(name === 'GAEL' ? '#3b424f' : '#f7f6f2', { roughness: 0.72 });
      for (let l = 0; l < 3; l++) {
        const lace = new T.Mesh(new T.BoxGeometry(0.044, 0.005, 0.008), laceMat);
        lace.position.set(0, 0.016 - l * 0.005, 0.030 + l * 0.018);
        shoe.add(lace);
      }
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
    sofiaSkirt,
    armL,
    armR,
    arms: [armL.shoulder, armR.shoulder],
    legL,
    legR,
    scale,
    headY: 1.56 * scale,
    isGhost,
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

    // Lipsync mais natural por palavra ativa
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

  // Fantasma SOFIA: flutuação etérea, respiração espectral lenta, imobilidade inquietante
  if (a.isGhost) {
    const hover = Math.sin(t * 1.45 + phase);
    st.bodyY = 0.085 + hover * 0.038;
    st.torsoRotX = -0.03 + Math.sin(t * 0.9) * 0.02;
    st.torsoRotZ = Math.sin(t * 0.72) * 0.03;
    st.armL = { sx: 0.08 + hover * 0.04, sy: 0.06, sz: 0.18 + hover * 0.03, ex: -0.20, ey: 0, ez: 0, hx: 0.15, hy: 0, hz: 0, curl: 0.18, point: 0 };
    st.armR = { sx: 0.08 - hover * 0.04, sy: -0.06, sz: -0.18 - hover * 0.03, ex: -0.20, ey: 0, ez: 0, hx: 0.15, hy: 0, hz: 0, curl: 0.18, point: 0 };
    st.headZ = Math.sin(t * 0.65) * 0.085;
    st.headX = 0.06;
    setMoodOnState(st, 'neutral');
    return st;
  }

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
    setMoodOnState(st, a.name === 'TINA' ? 'sarcastic' : 'neutral');
  } else if (pose === 'apontando') {
    const pulse = Math.sin(t * 3.8 + phase);
    st.pelvisX = weightShift * 0.018;
    st.torsoRotX = 0.07 + breath * 0.015;
    st.torsoRotY = 0.16 + pulse * 0.03;
    st.torsoRotZ = -0.03;
    // Braço direito estendido apontando (dedo indicador esticado!)
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
    // Variação determinística de reações de susto/medo:
    //   0 = mão na boca de susto, 1 = abraçar o próprio corpo de medo, 2 = recuo defensivo
    const tremor = Math.sin(t * 13.5 + phase) * 0.018;
    const rapidBreath = Math.sin(t * 4.2 + phase);
    st.breathScale = 1 + rapidBreath * 0.024;
    st.shoulderLift = 0.008 + rapidBreath * 0.005;
    st.bodyY = -0.045 + rapidBreath * 0.005;

    // Escolha determinística baseada no personagem + bloco de tempo (~4.5s) com transição suave
    const slot = Math.floor((t + phase * 1.1) / 4.8);
    const localU = ((t + phase * 1.1) % 4.8) / 4.8;
    const pickStyle = (s) => {
      if (a.name === 'MAYA') return [0, 1, 0, 2][Math.abs(s) % 4];
      if (a.name === 'TINA') return [1, 0, 1, 2][Math.abs(s) % 4];
      if (a.name === 'NINA') return [0, 1, 2][Math.abs(s) % 3];
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
        // MÃO NA BOCA DE SUSTO!
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
        // ABRAÇAR O PRÓPRIO CORPO DE MEDO!
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
        // RECUO DEFENSIVO COM MÃOS ERGUIDAS
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
    st.torsoRotX = 0.025 + breath * 0.015;
    st.torsoRotY = breathSlow * 0.045;
    st.torsoRotZ = w * 0.052;

    // Perna de apoio firme, perna oposta levemente relaxada
    const relaxL = Math.max(0, -w);
    const relaxR = Math.max(0, w);
    st.legL = { hx: -relaxL * 0.11, hy: 0.04, hz: 0.035 + relaxL * 0.025, kx: relaxL * 0.19 };
    st.legR = { hx: -relaxR * 0.11, hy: -0.04, hz: -0.035 - relaxR * 0.025, kx: relaxR * 0.19 };
    st.bodyY = breath * 0.006 - Math.max(relaxL, relaxR) * 0.008;

    st.armL = {
      sx: 0.05 + breath * 0.03 - w * 0.04,
      sy: -0.05,
      sz: 0.11 + Math.max(0, w) * 0.03,
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
      sz: -0.11 - Math.max(0, -w) * 0.03,
      ex: -0.22 + breath * 0.03,
      ey: 0,
      ez: 0,
      hx: 0.06,
      hy: 0,
      hz: 0,
      curl: 0.34,
      point: 0,
    };
    setMoodOnState(st, a.name === 'TINA' ? 'sarcastic' : a.name === 'NINA' ? 'suspicious' : 'neutral');
  }

  // Micro-movimento natural de cabeça no idle
  st.headX += idleHeadX;
  st.headY += idleHeadY;
  st.headZ += idleHeadZ;

  // ---- 2) REAÇÕES DE QUEM ESCUTA (cruzar braços, abraçar corpo, mão na boca, atenção) ----
  const isListening = ctx.activeSpeaker && ctx.activeSpeaker !== a.name && ctx.activeWeight > 0.01;
  if (isListening && (pose === 'em_pe' || pose === 'sentado')) {
    const lw = ctx.activeWeight;
    const utt = ctx.activeUttIndex;
    const anyScaredInScene = ctx.anyScared;

    // Determina reação corporal de escuta por personalidade e momento
    let reactKind = 'attentive';
    if (pose === 'em_pe') {
      if (anyScaredInScene && (a.name === 'MAYA' || a.name === 'TINA')) {
        reactKind = (utt + (a.name === 'MAYA' ? 0 : 1)) % 3 === 0 ? 'hand_mouth' : 'self_hug';
      } else if (a.name === 'NINA') {
        reactKind = utt % 2 === 0 ? 'crossed' : 'ring_twist';
      } else if (a.name === 'TINA') {
        reactKind = utt % 3 !== 2 ? 'crossed' : 'self_hug';
      } else if (a.name === 'GAEL') {
        reactKind = anyScaredInScene ? 'self_hug' : utt % 2 === 0 ? 'crossed' : 'attentive';
      } else if (a.name === 'CAIO') {
        reactKind = utt % 2 === 0 ? 'crossed' : 'attentive';
      } else if (a.name === 'MAYA') {
        reactKind = utt % 3 === 0 ? 'self_hug' : utt % 3 === 1 ? 'hand_mouth' : 'attentive';
      }
    }

    if (reactKind === 'crossed') {
      // CRUZA OS BRAÇOS (postura fechada/desconfiada/atenta)
      const targetL = { sx: -0.28, sy: -1.04, sz: 0.12, ex: -1.66, ey: 0, ez: -0.14, hx: 0.18, hy: 0, hz: 0, curl: 0.48, point: 0 };
      const targetR = { sx: -0.16, sy: 1.02, sz: -0.14, ex: -1.56, ey: 0, ez: 0.14, hx: 0.18, hy: 0, hz: 0, curl: 0.48, point: 0 };
      st.armL = lerpArm(st.armL, targetL, lw);
      st.armR = lerpArm(st.armR, targetR, lw);
      st.torsoRotY += 0.08 * lw;
      st.headZ += (a.name === 'NINA' ? -0.05 : 0.05) * lw;
      st.browLZ = lerp(st.browLZ, -0.10, lw * 0.7);
      st.browRZ = lerp(st.browRZ, 0.14, lw * 0.7);
    } else if (reactKind === 'self_hug') {
      // ABRAÇA O PRÓPRIO CORPO DE MEDO / APREENSÃO
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
      // MÃO NA BOCA DE SUSTO / CHOCADO COM A FALA
      const targetR = { sx: -1.26, sy: 0.62, sz: -0.06, ex: -2.02, ey: 0, ez: 0, hx: 0.18, hy: 0.30, hz: 0, curl: 0.18, point: 0 };
      const targetL = { sx: -0.34, sy: -0.76, sz: 0.14, ex: -1.44, ey: 0, ez: 0, hx: 0.12, hy: 0, hz: 0, curl: 0.36, point: 0 };
      st.armR = lerpArm(st.armR, targetR, lw);
      st.armL = lerpArm(st.armL, targetL, lw);
      st.mouthGasp = Math.max(st.mouthGasp, 0.26 * lw);
      st.browLY = lerp(st.browLY, 0.194, lw * 0.8);
      st.browRY = lerp(st.browRY, 0.194, lw * 0.8);
      st.browLZ = lerp(st.browLZ, 0.22, lw * 0.8);
      st.browRZ = lerp(st.browRZ, -0.22, lw * 0.8);
    } else if (reactKind === 'ring_twist') {
      // NINA girando o anel de ônix com as mãos juntas à frente (traço da bíblia!)
      const tw = Math.sin(t * 4.5 + phase) * 0.08;
      const targetL = { sx: -0.48, sy: -0.52, sz: 0.10, ex: -1.25 + tw, ey: 0, ez: 0, hx: 0.2, hy: 0, hz: 0, curl: 0.42, point: 0 };
      const targetR = { sx: -0.48, sy: 0.52, sz: -0.10, ex: -1.25 - tw, ey: 0, ez: 0, hx: 0.2, hy: 0, hz: 0, curl: 0.38, point: 0 };
      st.armL = lerpArm(st.armL, targetL, lw);
      st.armR = lerpArm(st.armR, targetR, lw);
      st.headZ -= 0.04 * lw;
    }

    // Reação sutil de cabeça ao escutar (acenos/inclinações atentas)
    st.headX += Math.sin(t * 2.2 + phase) * 0.045 * lw;
    st.headZ += Math.sin(t * 1.15 + phase) * 0.040 * lw;
  }

  // ---- 3) QUEM FALA GESTICULA (mãos, braços, cabeça balançando, sobrancelhas!) ----
  const sw = ctx.speakWeight;
  if (sw > 0.005) {
    const beat1 = Math.sin(t * 4.6 + phase);
    const beat2 = Math.cos(t * 2.8 + phase * 1.4);
    const beat3 = Math.sin(t * 6.4 + phase * 0.7);
    const uttIdx = ctx.speakUttIndex;

    // Cabeça balançando expressivamente acompanhando a fala
    st.headX += (0.03 + beat1 * 0.075 + beat3 * 0.025) * sw;
    st.headY += beat2 * 0.095 * sw;
    st.headZ += Math.sin(t * 2.1 + phase) * 0.068 * sw;

    // Tronco acompanha o ritmo da fala
    st.torsoRotX += (0.035 + beat1 * 0.025) * sw;
    st.torsoRotY += beat2 * 0.065 * sw;

    // Sobrancelhas expressivas pulsando com a fala
    const browPulse = Math.max(0, beat1) * 0.0075 + Math.max(0, beat3) * 0.003;
    st.browLY += browPulse * sw;
    st.browRY += browPulse * sw;
    if (a.name === 'TINA' || a.name === 'CAIO') {
      st.browLY += 0.0035 * sw;
    }

    // Gesticulação de braços e mãos adaptada à pose e à personalidade
    if (pose === 'apontando') {
      // Reforça a ênfase do braço que aponta + mão livre acompanhando
      st.armR.sx += beat1 * 0.12 * sw;
      st.armR.ex += beat2 * 0.10 * sw;
      st.armL.sx = lerp(st.armL.sx, -0.58 - beat2 * 0.14, sw);
      st.armL.sy = lerp(st.armL.sy, -0.22 + beat1 * 0.14, sw);
      st.armL.ex = lerp(st.armL.ex, -1.18 + beat1 * 0.18, sw);
      st.armL.curl = lerp(st.armL.curl, 0.18, sw);
    } else if (pose === 'sentado') {
      // Sentada (Tina): levanta antebraços para gesticular com sarcasmo/ênfase
      const gL = { sx: -0.68 + beat1 * 0.10, sy: -0.10 + beat2 * 0.15, sz: 0.22, ex: -1.18 + beat2 * 0.20, ey: 0, ez: 0, hx: -0.18, hy: 0.25, hz: 0, curl: 0.18, point: 0 };
      const gR = { sx: -0.78 - beat2 * 0.12, sy: 0.12 - beat1 * 0.16, sz: -0.24, ex: -1.24 - beat1 * 0.22, ey: 0, ez: 0, hx: -0.22, hy: -0.25, hz: 0, curl: 0.16, point: 0 };
      st.armL = lerpArm(st.armL, gL, sw);
      st.armR = lerpArm(st.armR, gR, sw);
    } else if (pose === 'ajoelhado') {
      st.armL.sx -= 0.18 * sw + beat1 * 0.08 * sw;
      st.armL.ex -= 0.32 * sw + beat2 * 0.12 * sw;
      st.armR.sx -= 0.14 * sw - beat2 * 0.10 * sw;
    } else if (pose === 'assustado') {
      // Falando assustado: gestos urgentes e trêmulos com mãos abertas
      const gL = { sx: -0.78 + beat1 * 0.16, sy: -0.16 + beat2 * 0.18, sz: 0.26, ex: -1.22 + beat2 * 0.20, ey: 0, ez: 0, hx: -0.28, hy: 0.2, hz: 0, curl: 0.12, point: 0 };
      const gR = { sx: -0.84 - beat2 * 0.16, sy: 0.16 - beat1 * 0.18, sz: -0.26, ex: -1.28 - beat1 * 0.20, ey: 0, ez: 0, hx: -0.28, hy: -0.2, hz: 0, curl: 0.12, point: 0 };
      st.armL = lerpArm(st.armL, gL, sw * 0.82);
      st.armR = lerpArm(st.armR, gR, sw * 0.82);
    } else {
      // 'em_pe': 3 estilos expressivos de gesticulação alternando por fala
      const style = (uttIdx + (a.name === 'NINA' ? 2 : a.name === 'CAIO' ? 1 : 0)) % 3;
      let gL, gR;
      if (style === 0) {
        // Explicativo amplo com as duas mãos
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
        // Ênfase teatral com braço direito dominante (ótimo para Caio, Gael, Maya)
        gR = {
          sx: -0.82 + beat1 * 0.20,
          sy: 0.10 + beat2 * 0.18,
          sz: -0.24,
          ex: -1.10 + beat2 * 0.28,
          ey: 0,
          ez: 0,
          hx: -0.18,
          hy: -0.28,
          hz: 0,
          curl: 0.22,
          point: 0,
        };
        gL = {
          sx: -0.36 - beat2 * 0.08,
          sy: -0.22,
          sz: 0.16,
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
        // Elegante e controlado (ótimo para Nina / argumentação fria)
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
    // Dedo indicador estica ao apontar enquanto os outros dobram
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

  // Garante que estamos realmente no plano da direção (não em qaPortrait!)
  if (placements.length !== cur.atores.length) return null;
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

      // Transição suave entre poses quando o ator muda de pose entre planos consecutivos
      if (trans && pose !== 'caido') {
        const prevActor = trans.prev.atores.find((v) => v.nome === name);
        if (prevActor && (prevActor.pose || 'em_pe') !== pose && prevActor.pose !== 'caido') {
          const dist = Math.hypot(prevActor.pos[0] - p.pos[0], prevActor.pos[2] - p.pos[2]);
          if (dist < 1.35) {
            const prevSt = evaluatePoseState(a, prevActor.pose || 'em_pe', t, a._phase, ctx);
            st = lerpPoseState(prevSt, st, trans.blend);
          }
        }
      }

      // Rotação do corpo + mirada da cabeça + virar para quem fala (quando escuta!)
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
      }

      // Se outro personagem está falando na cena, quem escuta vira cabeça, olhar e ombros para o falante!
      if (
        !a.isGhost &&
        pose !== 'caido' &&
        speech.activeSpeaker &&
        speech.activeSpeaker !== name &&
        speech.activeWeight > 0.01
      ) {
        let targetPos = null;
        if (speech.activeSpeaker === 'LEO' && camPos) {
          targetPos = [camPos.x, camPos.z];
        } else if (placementMap[speech.activeSpeaker]) {
          const sp = placementMap[speech.activeSpeaker];
          targetPos = [sp.pos[0], sp.pos[2]];
        }
        if (targetPos) {
          const spYaw = Math.atan2(targetPos[0] - p.pos[0], targetPos[1] - p.pos[2]);
          const delta = wrapAngle(spYaw - baseYaw);
          const lw = speech.activeWeight;
          // Mantém o rosto sempre bem legível para a câmera enquanto vira claramente para quem fala
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

      // Movimentação espectral suave de cabelo e vestido da SOFIA
      if (a.isGhost) {
        if (a.hairGroup) {
          a.hairGroup.rotation.z = Math.sin(t * 1.35) * 0.045;
          a.hairGroup.rotation.x = Math.cos(t * 1.1) * 0.03;
        }
        if (a.sofiaSkirt) {
          a.sofiaSkirt.rotation.z = Math.sin(t * 1.55 + 0.6) * 0.055;
          a.sofiaSkirt.rotation.x = Math.cos(t * 1.2) * 0.04;
        }
      }

      // Piscada natural + movimento vivo do olhar (saccades determinísticas)
      if (pose === 'caido') {
        a.eyes.forEach((e) => {
          e.scale.y = 0.08;
        });
      } else if (a.isGhost) {
        // Sofia raramente pisca — olhar fixo assustador
        const eerieBlink = Math.pow(Math.max(0, Math.sin(t * 0.55)), 90);
        a.eyes.forEach((e) => {
          e.scale.y = 1 - eerieBlink * 0.85;
        });
        a.eyeBalls.forEach((eb) => {
          eb.rotation.set(0, 0, 0);
        });
      } else {
        const blink1 = Math.pow(Math.max(0, Math.sin(t * 1.38 + a._phase * 2.1)), 42);
        const blink2 = Math.pow(Math.max(0, Math.sin(t * 0.61 + a._phase * 3.7 + 1.1)), 64);
        const blink = Math.min(1, blink1 + blink2);
        const widen = pose === 'assustado' ? 1.12 : 1.0;
        a.eyes.forEach((e) => {
          e.scale.y = (1 - blink * 0.92) * widen;
        });

        // Olhar vivo determinístico (pequenos desvios suaves periódicos + mirada para o falante)
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
