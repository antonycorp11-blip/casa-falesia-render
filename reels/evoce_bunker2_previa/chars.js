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
    radialSegs = 6,
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
  const hairGroup = new T.Group();
  headPivot.add(hairGroup);

  if (name === 'ANTONY') {
    // ========================================================================
    // ANTONY (23): CABELO CASTANHO-ESCURO CURTO E ESPETADO PARA FRENTE
    // COM MECHA REBELDE ASSIMÉTRICA (encaixado limpo acima dos óculos na testa)
    // ========================================================================
    const pal = makeHairPalette(['#201510', '#312117', '#442e20', '#291b13'], { roughness: 0.58 });
    const sideFade = stdMat('#251912', { roughness: 0.78 });

    addScalpBase(hairGroup, sideFade, {
      radius: 0.143,
      y: 0.141,
      z: -0.014,
      phiLen: Math.PI * 0.45,
      rotX: -0.32,
      scale: [0.92, 1.06, 0.94],
      outline: 0.0034,
    });

    // Nuca curta limpa
    const backCap = addShadow(
      new T.Mesh(
        new T.SphereGeometry(0.139, 16, 10, Math.PI * 0.68, Math.PI * 1.64, Math.PI * 0.34, Math.PI * 0.36),
        sideFade
      ),
      false,
      true
    );
    backCap.position.set(0, 0.134, -0.014);
    backCap.scale.set(0.92, 1.05, 0.94);
    hairGroup.add(backCap);

    // Camada de mechas curtas texturizadas no topo/coroa projetadas para frente
    for (let i = 0; i < 28; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / 28) * 0.118;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 0.016;
      const y = 0.278 - r * 0.48;
      const isFront = z > -0.01;
      const dirX = x * 0.38 + (isFront ? 0.022 : 0) + (hash(i * 11) - 0.5) * 0.022;
      const dirZ = isFront ? 0.056 + hash(i * 7) * 0.022 : z * 0.52 - 0.032;
      const liftY = isFront ? 0.036 + hash(i * 17) * 0.014 : 0.024;
      const pts = [
        [x * 0.86, y - 0.010, z * 0.86],
        [x + dirX * 0.5, y + liftY, z + dirZ * 0.55],
        [x + dirX * 1.08, y + (isFront ? 0.012 : -0.014), z + dirZ * 1.08],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.013,
          rMid: 0.017,
          rTip: 0.0024,
          flatten: 0.52,
          segs: 10,
          mat: pal[i % pal.length],
          outline: i % 4 === 0 ? 0.0024 : 0,
        })
      );
    }

    // Mecha rebelde assimétrica espetada para frente (assinatura do Antony na miniatura!)
    const spikeSpecs = [
      { x0: -0.018, x1: 0.012, x2: 0.036, y0: 0.278, y1: 0.295, y2: 0.258, z0: 0.048, z1: 0.128, z2: 0.168, rMid: 0.020 },
      { x0: 0.012, x1: 0.042, x2: 0.068, y0: 0.274, y1: 0.288, y2: 0.250, z0: 0.050, z1: 0.122, z2: 0.158, rMid: 0.018 },
      { x0: -0.048, x1: -0.028, x2: -0.008, y0: 0.272, y1: 0.284, y2: 0.252, z0: 0.046, z1: 0.118, z2: 0.152, rMid: 0.017 },
      { x0: 0.040, x1: 0.068, x2: 0.092, y0: 0.264, y1: 0.272, y2: 0.242, z0: 0.042, z1: 0.106, z2: 0.136, rMid: 0.015 },
      { x0: -0.072, x1: -0.064, x2: -0.054, y0: 0.260, y1: 0.266, y2: 0.238, z0: 0.036, z1: 0.098, z2: 0.124, rMid: 0.014 },
    ];
    spikeSpecs.forEach((sp, idx) => {
      hairGroup.add(
        buildTaperedStrand(
          [
            [sp.x0, sp.y0, sp.z0],
            [sp.x1, sp.y1, sp.z1],
            [sp.x2, sp.y2, sp.z2],
          ],
          {
            rStart: 0.014,
            rMid: sp.rMid,
            rTip: 0.0022,
            flatten: 0.48,
            segs: 12,
            mat: pal[(idx + 1) % pal.length],
            outline: 0.0024,
          }
        )
      );
    });
  } else if (name === 'HELENA') {
    // ========================================================================
    // HELENA (34): CABELO PRETO LISO NA ALTURA DOS OMBROS COM RISCA LATERAL,
    // CORTE RETO SOFISTICADO E ROSTO ADULTO 100% VISÍVEL
    // ========================================================================
    const pal = makeHairPalette(['#0f1017', '#171924', '#222536', '#13141e'], {
      roughness: 0.30,
      metalness: 0.16,
    });

    addScalpBase(hairGroup, pal[0], {
      radius: 0.143,
      y: 0.138,
      z: -0.015,
      phiLen: Math.PI * 0.44,
      rotX: -0.36,
      scale: [0.89, 1.07, 0.92],
      outline: 0.0036,
    });

    const napeCap = addShadow(
      new T.Mesh(
        new T.SphereGeometry(0.140, 16, 12, Math.PI * 0.64, Math.PI * 0.72, Math.PI * 0.26, Math.PI * 0.48),
        pal[0]
      ),
      false,
      true
    );
    napeCap.position.set(0, 0.134, -0.015);
    napeCap.scale.set(0.89, 1.06, 0.93);
    hairGroup.add(napeCap);

    // Risca lateral elegante
    const partX = 0.042;
    const partRibbon = buildTaperedStrand(
      [
        [partX, 0.258, 0.070],
        [partX * 0.95, 0.278, 0.014],
        [partX * 0.85, 0.275, -0.046],
      ],
      {
        rStart: 0.0030,
        rMid: 0.0035,
        rTip: 0.0020,
        flatten: 0.35,
        segs: 8,
        radialSegs: 4,
        mat: skinMat,
        castShadow: false,
      }
    );
    hairGroup.add(partRibbon);

    // Lado maior da risca lateral (cai liso nos ombros, encaixado atrás da orelha direita)
    for (let i = 0; i < 12; i++) {
      const u = i / 11;
      const zStart = lerp(0.074, -0.070, u);
      const yTop = lerp(0.260, 0.274, Math.sin(u * Math.PI * 0.75));
      const earZ = lerp(-0.024, -0.092, u);
      const shoulderX = lerp(-0.148, -0.114, u) + (hash(i * 11) - 0.5) * 0.008;
      const shoulderZ = lerp(-0.056, -0.130, u);
      const endY = lerp(-0.125, -0.165, Math.sin(u * Math.PI * 0.75 + 0.25)); // altura exata dos ombros!

      const pts = [
        [partX - 0.004, yTop, zStart],
        [lerp(-0.040, -0.062, u), lerp(0.262, 0.266, u), lerp(0.088, -0.074, u)],
        [lerp(-0.120, -0.130, u), lerp(0.212, 0.204, u), lerp(0.032, -0.088, u)],
        [lerp(-0.134, -0.140, u), 0.134, earZ],
        [shoulderX, -0.010, shoulderZ],
        [shoulderX * 0.98, endY, shoulderZ - 0.008],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.020,
          rTip: 0.006,
          flatten: 0.38,
          segs: 15,
          mat: pal[i % pal.length],
          outline: i % 2 === 0 ? 0.0026 : 0,
        })
      );
    }

    // Lado menor da risca lateral (cai liso atrás da orelha esquerda até o ombro)
    for (let i = 0; i < 9; i++) {
      const u = i / 8;
      const zStart = lerp(0.070, -0.070, u);
      const yTop = lerp(0.258, 0.272, Math.sin(u * Math.PI * 0.75));
      const earZ = lerp(-0.024, -0.092, u);
      const shoulderX = lerp(0.146, 0.114, u) + (hash(i * 13 + 5) - 0.5) * 0.008;
      const shoulderZ = lerp(-0.056, -0.130, u);
      const endY = lerp(-0.122, -0.160, Math.sin(u * Math.PI * 0.75 + 0.25));

      const pts = [
        [partX + 0.006, yTop, zStart],
        [lerp(0.100, 0.094, u), lerp(0.242, 0.250, u), lerp(0.062, -0.076, u)],
        [lerp(0.126, 0.132, u), 0.194, lerp(0.018, -0.088, u)],
        [lerp(0.134, 0.138, u), 0.132, earZ],
        [shoulderX, -0.010, shoulderZ],
        [shoulderX * 0.98, endY, shoulderZ - 0.008],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.015,
          rMid: 0.019,
          rTip: 0.006,
          flatten: 0.38,
          segs: 15,
          mat: pal[(i + 1) % pal.length],
          outline: i % 2 === 0 ? 0.0026 : 0,
        })
      );
    }

    // Franja lateral refinada alta na testa, presa atrás da orelha
    for (let f = 0; f < 3; f++) {
      const pts = [
        [partX - 0.002, 0.260 - f * 0.003, 0.078 - f * 0.006],
        [-0.032 - f * 0.005, 0.240 - f * 0.004, 0.110 - f * 0.004],
        [-0.104 - f * 0.004, 0.212 - f * 0.005, 0.068 - f * 0.008],
        [-0.128 - f * 0.003, 0.150 - f * 0.005, -0.018 - f * 0.008],
        [-0.142, -0.012, -0.048 - f * 0.008],
        [-0.144, -0.128 - f * 0.010, -0.052 - f * 0.006],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.012,
          rMid: 0.015,
          rTip: 0.005,
          flatten: 0.36,
          segs: 14,
          mat: pal[(f + 1) % pal.length],
          outline: f === 0 ? 0.0022 : 0,
        })
      );
    }

    // Corte reto liso nas costas na altura dos ombros (long bob elegante)
    for (let i = 0; i < 16; i++) {
      const u = i / 15;
      const a = lerp(-Math.PI * 0.44, Math.PI * 0.44, u);
      const sx = Math.sin(a);
      const sz = -Math.cos(a);
      const lenY = lerp(-0.172, -0.138, Math.abs(u - 0.5) * 2);

      const pts = [
        [sx * 0.072, 0.262, sz * 0.074 - 0.018],
        [sx * 0.136, 0.172, sz * 0.138 - 0.014],
        [sx * 0.148, 0.022, sz * 0.146 - 0.016],
        [sx * 0.146, lenY, sz * 0.140 - 0.018],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.017,
          rMid: 0.023,
          rTip: 0.008,
          flatten: 0.38,
          segs: 13,
          mat: pal[i % pal.length],
          outline: i % 2 === 0 ? 0.0028 : 0,
        })
      );
    }

    // Mechas finas descansando sobre a frente dos ombros (abaixo do queixo)
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const pts = [
          [side * (0.130 + k * 0.006), 0.130, -0.022 - k * 0.010],
          [side * (0.142 + k * 0.007), 0.024, -0.020 - k * 0.008],
          [side * (0.144 + k * 0.006), -0.075, 0.012 - k * 0.010],
          [side * (0.138 + k * 0.005), -0.142 - k * 0.014, 0.032 - k * 0.010],
        ];
        hairGroup.add(
          buildTaperedStrand(pts, {
            rStart: 0.013,
            rMid: 0.016,
            rTip: 0.005,
            flatten: 0.36,
            segs: 11,
            mat: pal[(k + (side > 0 ? 1 : 2)) % pal.length],
            outline: k === 0 ? 0.0022 : 0,
          })
        );
      }
    }
  } else if (name === 'BRUNO') {
    // ========================================================================
    // BRUNO (27): CABELO PRETO CURTO COM RISCO LATERAL NÍTIDO E FADE ESPORTIVO
    // ========================================================================
    const pal = makeHairPalette(['#101116', '#1a1c24', '#252834', '#15161e'], { roughness: 0.62 });
    const fadeMat = stdMat('#1c1e24', { roughness: 0.84 });

    addScalpBase(hairGroup, fadeMat, {
      radius: 0.143,
      y: 0.140,
      z: -0.014,
      phiLen: Math.PI * 0.46,
      rotX: -0.26,
      scale: [0.915, 1.07, 0.955],
      outline: 0.0034,
    });

    const backFade = addShadow(
      new T.Mesh(
        new T.SphereGeometry(0.139, 16, 10, Math.PI * 0.70, Math.PI * 1.60, Math.PI * 0.34, Math.PI * 0.36),
        fadeMat
      ),
      false,
      true
    );
    backFade.position.set(0, 0.133, -0.014);
    backFade.scale.set(0.915, 1.06, 0.95);
    hairGroup.add(backFade);

    // Risco lateral marcado (corte navalhado esportivo na lateral direita da cabeça)
    const partGroove = new T.Mesh(new T.BoxGeometry(0.013, 0.008, 0.132), skinMat);
    partGroove.position.set(-0.088, 0.242, 0.022);
    partGroove.rotation.set(0.12, 0.08, -0.44);
    hairGroup.add(partGroove);

    // Topo curto penteado para o lado (+X) a partir do risco lateral
    for (let i = 0; i < 28; i++) {
      const row = Math.floor(i / 7);
      const col = (i % 7) - 3;
      const u = col / 3;
      const x0 = u * 0.086 + (hash(i * 17) - 0.5) * 0.010;
      const z0 = 0.094 - row * 0.052 + (1 - Math.abs(u)) * 0.012;
      if (x0 < -0.068 && z0 > -0.05) continue; // mantém o risco lateral super nítido!

      const y0 = 0.248 + (1 - Math.abs(u)) * 0.024 - row * 0.008;
      const lift = (1 - Math.abs(u) * 0.35) * (0.044 - row * 0.007);
      const sweepX = 0.036 + (row === 0 ? 0.010 : 0);

      const pts = [
        [x0 * 0.94, y0 - 0.008, z0],
        [x0 + sweepX * 0.45, y0 + lift, z0 - 0.006],
        [x0 * 0.94 + sweepX, y0 + lift * 0.62, z0 - 0.056],
        [x0 * 0.88 + sweepX * 0.92, y0 - 0.006, Math.max(-0.148, z0 - 0.118)],
      ];
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.013,
          rMid: 0.0175 + (row === 0 ? 0.002 : 0),
          rTip: 0.003,
          flatten: 0.54,
          segs: 12,
          mat: pal[(i + row) % pal.length],
          outline: i % 3 === 0 ? 0.0024 : 0,
        })
      );
    }

    // Laterais curtas aparadas abaixo do risco
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const y = 0.194 + i * 0.011;
        const zStart = 0.064 - i * 0.012;
        const pts = [
          [side * 0.116, y, zStart],
          [side * 0.128, y + 0.008, zStart - 0.052],
          [side * 0.122, y - 0.006, zStart - 0.112],
        ];
        hairGroup.add(
          buildTaperedStrand(pts, {
            rStart: 0.010,
            rMid: 0.012,
            rTip: 0.003,
            flatten: 0.48,
            segs: 8,
            mat: pal[i % 3],
          })
        );
      }
    }
  } else if (name === 'CLARA') {
    // ========================================================================
    // CLARA (25): COQUE CACHEADO CASTANHO-ACOBREADO BAGUNÇADO (ÚMIDO DA CHUVA)
    // ========================================================================
    const pal = makeHairPalette(['#542312', '#7e391d', '#a24e28', '#c46636'], {
      roughness: 0.44, // leve brilho úmido da tempestade
      metalness: 0.08,
    });

    addScalpBase(hairGroup, pal[0], {
      radius: 0.145,
      y: 0.141,
      z: -0.014,
      phiLen: Math.PI * 0.48,
      rotX: -0.28,
      scale: [0.92, 1.05, 0.94],
      outline: 0.0036,
    });

    // Base traseira cobrindo toda a nuca puxada para o coque
    const backPull = addShadow(
      new T.Mesh(
        new T.SphereGeometry(0.141, 18, 12, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.25, Math.PI * 0.50),
        pal[0]
      ),
      false,
      true
    );
    backPull.position.set(0, 0.135, -0.015);
    backPull.scale.set(0.92, 1.05, 0.94);
    hairGroup.add(backPull);

    // Mechas puxadas de toda a cabeça em direção ao coque alto-traseiro
    const bunCenter = [0, 0.276, -0.128];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const sx = Math.sin(a) * 0.118;
      const sz = Math.cos(a) * 0.110 - 0.014;
      const sy = sz > 0 ? 0.228 : 0.155 + (1 - Math.abs(Math.sin(a))) * 0.03;
      const midX = lerp(sx, bunCenter[0], 0.45) * 1.08;
      const midY = Math.max(sy + 0.045, 0.270);
      const midZ = lerp(sz, bunCenter[2], 0.45) - 0.01;

      hairGroup.add(
        buildTaperedStrand(
          [
            [sx * 0.92, sy, sz],
            [midX, midY, midZ],
            [bunCenter[0] + sx * 0.18, bunCenter[1], bunCenter[2] + 0.018],
          ],
          {
            rStart: 0.014,
            rMid: 0.018,
            rTip: 0.010,
            flatten: 0.56,
            segs: 10,
            mat: pal[i % pal.length],
          }
        )
      );
    }

    // Elástico/presilha escura na base do coque
    const tie = addOutline(
      new T.Mesh(new T.TorusGeometry(0.048, 0.011, 8, 18), stdMat('#1c2028', { roughness: 0.65 })),
      0.0022
    );
    tie.position.set(0, 0.264, -0.114);
    tie.rotation.x = Math.PI * 0.34;
    hairGroup.add(tie);

    // Núcleo do coque cacheado + 22 cachos espirais volumosos formando o coque bagunçado!
    const bunCore = addOutline(
      addShadow(new T.Mesh(new T.SphereGeometry(0.068, 14, 12), pal[1])),
      0.0034
    );
    bunCore.position.set(bunCenter[0], bunCenter[1] + 0.012, bunCenter[2] - 0.016);
    bunCore.scale.set(1.12, 0.96, 0.98);
    hairGroup.add(bunCore);

    function addBunCurl(idx) {
      const phi = Math.acos(1 - (2 * (idx + 0.5)) / 22);
      const theta = idx * 2.39996;
      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(theta);

      const pts = [];
      const phase = hash(idx * 23.1) * Math.PI * 2;
      const rad = 0.056 + (idx % 3) * 0.014;
      for (let s = 0; s <= 9; s++) {
        const u = s / 9;
        const ang = u * Math.PI * 2.4 + phase;
        const loopR = 0.022 + Math.sin(u * Math.PI) * 0.018;
        pts.push([
          bunCenter[0] + dx * rad + Math.cos(ang) * loopR,
          bunCenter[1] + 0.014 + dy * rad * 0.92 + Math.sin(ang) * loopR * 0.85,
          bunCenter[2] - 0.016 + dz * rad * 0.92 + Math.sin(ang * 0.7) * 0.016,
        ]);
      }
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.013,
          rMid: 0.017,
          rTip: 0.004,
          flatten: 0.76,
          segs: 14,
          radialSegs: 5,
          mat: pal[idx % pal.length],
          outline: idx % 2 === 0 ? 0.0024 : 0,
        })
      );
    }
    for (let i = 0; i < 22; i++) addBunCurl(i);

    // Cachinhos soltos bagunçados nas têmporas e nuca (rosto 100% aberto!)
    function addLooseCurl(startPt, dirX, dirZ, len, turns, amp, matIdx) {
      const pts = [];
      const phase = hash(matIdx * 17.3 + startPt[0] * 30) * Math.PI * 2;
      for (let s = 0; s <= 9; s++) {
        const u = s / 9;
        const flare = Math.sin(u * Math.PI * 0.85) * amp;
        const ang = u * Math.PI * 2 * turns + phase;
        pts.push([
          startPt[0] + dirX * u * 0.055 + Math.cos(ang) * flare,
          startPt[1] - u * len,
          startPt[2] + dirZ * u * 0.045 + Math.sin(ang) * flare,
        ]);
      }
      hairGroup.add(
        buildTaperedStrand(pts, {
          rStart: 0.009,
          rMid: 0.0115,
          rTip: 0.0022,
          flatten: 0.74,
          segs: 12,
          radialSegs: 5,
          mat: pal[matIdx % pal.length],
          outline: matIdx % 2 === 0 ? 0.0020 : 0,
        })
      );
    }

    for (const side of [-1, 1]) {
      addLooseCurl([side * 0.095, 0.232, 0.068], side * 0.55, -0.10, 0.115, 1.8, 0.011, side > 0 ? 1 : 2);
      addLooseCurl([side * 0.116, 0.205, 0.032], side * 0.48, -0.22, 0.135, 2.0, 0.012, side > 0 ? 2 : 3);
      addLooseCurl([side * 0.108, 0.148, -0.055], side * 0.42, -0.35, 0.095, 1.5, 0.010, side > 0 ? 3 : 0);
    }
    // 2 cachinhos curtos soltos na nuca
    addLooseCurl([-0.038, 0.105, -0.118], -0.2, -0.35, 0.072, 1.4, 0.010, 1);
    addLooseCurl([0.042, 0.102, -0.118], 0.2, -0.35, 0.076, 1.4, 0.010, 2);
  } else {
    // ========================================================================
    // LARA (19): CABELO CURTO PRETO REPICADO COM PONTAS LAVANDA E FRANJA ABERTA
    // ========================================================================
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
      scale: [0.945, 1.05, 0.955],
      outline: 0.0036,
    });

    // 1) Camada superior curta repicada
    for (let i = 0; i < 18; i++) {
      const a = lerp(-Math.PI * 0.72, Math.PI * 0.72, i / 17) + Math.PI;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      const len = 0.08 + (i % 3) * 0.022;
      const pts = [
        [sx * 0.045, 0.284, sz * 0.045 - 0.012],
        [sx * 0.136, 0.258, sz * 0.128 - 0.012],
        [sx * (0.165 + (i % 2) * 0.014), 0.215 - len * 0.45, sz * 0.150 - 0.014],
        [sx * (0.182 + (i % 2) * 0.016), 0.195 - len, sz * 0.158 - 0.014],
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

    // 2) Camada média/nuca com pontas roxo-lavanda
    for (let i = 0; i < 24; i++) {
      const a = lerp(-Math.PI * 0.66, Math.PI * 0.66, i / 23) + Math.PI;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      const isBack = Math.abs(sx) < 0.65 && sz < 0;
      const dropY = isBack ? -0.098 - (i % 3) * 0.022 : -0.018 - (i % 3) * 0.024;
      const kick = 0.030 + (i % 2) * 0.014;

      const midY = lerp(0.18, dropY, 0.56);
      hairGroup.add(
        buildTaperedStrand(
          [
            [sx * 0.105, 0.242, sz * 0.095 - 0.012],
            [sx * 0.154, 0.155, sz * 0.144 - 0.014],
            [sx * 0.156, midY, sz * 0.146 - 0.016],
          ],
          {
            rStart: 0.017,
            rMid: 0.020,
            rTip: 0.013,
            flatten: 0.48,
            segs: 10,
            mat: palDark[i % palDark.length],
          }
        )
      );

      const isPurpleTip = i % 3 !== 1;
      hairGroup.add(
        buildTaperedStrand(
          [
            [sx * 0.156, midY + 0.014, sz * 0.146 - 0.016],
            [sx * (0.160 + kick * 0.45), lerp(midY, dropY, 0.55), sz * (0.150 + kick * 0.3) - 0.016],
            [sx * (0.166 + kick), dropY, sz * (0.153 + kick * 0.55) - 0.012],
          ],
          {
            rStart: 0.014,
            rMid: 0.016,
            rTip: 0.002,
            flatten: 0.46,
            segs: 10,
            mat: isPurpleTip ? palPurple[i % palPurple.length] : palDark[(i + 1) % palDark.length],
            outline: i % 2 === 0 ? 0.0024 : 0,
          }
        )
      );
    }

    // 3) Franja cortininha desfiada aberta no centro com pontas lavanda
    for (const side of [-1, 1]) {
      for (let f = 0; f < 5; f++) {
        const edge = f / 4;
        hairGroup.add(
          buildTaperedStrand(
            [
              [side * (0.014 + edge * 0.036), 0.274, 0.068 - edge * 0.010],
              [side * (0.058 + edge * 0.056), 0.242 - edge * 0.014, 0.124 - edge * 0.026],
              [side * (0.104 + edge * 0.044), 0.196 - edge * 0.038, 0.118 - edge * 0.044],
              [side * (0.130 + edge * 0.026), 0.162 - edge * 0.062, 0.086 - edge * 0.056],
            ],
            {
              rStart: 0.012,
              rMid: 0.015,
              rTip: 0.002,
              flatten: 0.44,
              segs: 10,
              mat: edge > 0.62 ? palPurple[f % palPurple.length] : palDark[f % palDark.length],
            }
          )
        );
      }
    }
  }

  return hairGroup;
}

// ============================================================================
// Geometrias esculpidas (torso anatômico/oversized/atlético e quadril)
// ============================================================================
function buildTorsoGeo(feminine, bx, bz, opts = {}) {
  let profile;
  if (opts.oversized) {
    // Moletom largo (Lara): silhueta solta, confortável e moderna
    profile = [
      [0.002, 0.00],
      [0.144, 0.018],
      [0.148, 0.08],
      [0.144, 0.16],
      [0.148, 0.26],
      [0.156, 0.35],
      [0.160, 0.405],
      [0.126, 0.452],
      [0.068, 0.472],
      [0.002, 0.478],
    ];
  } else if (feminine) {
    profile = [
      [0.002, 0.00],
      [0.124, 0.015],
      [0.122, 0.06],
      [0.106, 0.14], // cintura definida
      [0.118, 0.22],
      [0.142, 0.31], // caixa torácica
      [0.148, 0.39], // linha dos ombros
      [0.118, 0.445],
      [0.064, 0.470],
      [0.002, 0.475],
    ];
  } else if (opts.athletic) {
    // Tronco em V atlético com ombros largos (Bruno, 27 anos)
    profile = [
      [0.002, 0.00],
      [0.126, 0.015],
      [0.122, 0.08],
      [0.118, 0.15], // cintura atlética firme
      [0.142, 0.24],
      [0.168, 0.345], // peitoral amplo
      [0.176, 0.410], // ombros largos
      [0.136, 0.456],
      [0.074, 0.476],
      [0.002, 0.482],
    ];
  } else {
    profile = [
      [0.002, 0.00],
      [0.130, 0.015],
      [0.126, 0.08],
      [0.122, 0.15],
      [0.138, 0.24],
      [0.156, 0.34],
      [0.162, 0.405],
      [0.128, 0.452],
      [0.070, 0.474],
      [0.002, 0.480],
    ];
  }

  const pts = profile.map(([r, y]) => new T.Vector2(r, y));
  const geo = new T.LatheGeometry(pts, 22);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * bx;
    const y = pos.getY(i);
    let z = pos.getZ(i) * (0.76 * bz);

    if (feminine && !opts.oversized && z > 0) {
      const bust = Math.exp(-Math.pow((y - 0.305) / 0.068, 2));
      const sideTwin = 0.65 + 0.35 * Math.cos(clamp(x / (0.075 * bx), -1.5, 1.5) * Math.PI * 0.5);
      z += bust * sideTwin * 0.024 * bz;
    } else if (!feminine && z > 0) {
      const pec = Math.exp(-Math.pow((y - 0.335) / 0.075, 2));
      z += pec * (opts.athletic ? 0.022 : 0.014) * bz;
    }
    if (z < 0 && !opts.oversized) {
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
    shirt: '#861f3b', // suéter vinho/bordô de gola alta
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
    pants: '#222730',
    shoes: '#1e242e',
    hair: '#15161e',
    iris: '#35251a',
    lip: '#8f5847',
    height: 1.85,
    buildX: 1.18, // ombros largos (instrutor físico, 27 anos)
    buildZ: 1.08,
    headScale: [0.91, 1.08, 0.95], // proporção adulta (27 anos)
    eyeScaleY: 0.88,
    longSleeve: true,
    mature: true,
    athletic: true,
    shoeStyle: 'sneaker',
    age: 27,
  },
  CLARA: {
    skin: '#d19874',
    shirt: '#d9a026', // jaqueta amarelo-mostarda molhada
    pants: '#25354a',
    shoes: '#2a3038',
    hair: '#823b1f',
    iris: '#57361e',
    lip: '#a65d4f',
    height: 1.67,
    buildX: 0.91,
    buildZ: 0.90,
    headScale: [0.91, 1.05, 0.93],
    eyeScaleY: 0.93,
    longSleeve: true,
    feminine: true,
    wetCoat: true,
    shoeStyle: 'boot',
    age: 25,
  },
  LARA: {
    skin: '#d6ae97',
    shirt: '#8b64c9', // moletom roxo largo
    pants: '#1c1e28',
    shoes: '#16171f',
    hair: '#191623',
    iris: '#3c2a44',
    lip: '#9f5b65',
    height: 1.60,
    buildX: 0.92,
    buildZ: 0.94,
    headScale: [0.93, 1.04, 0.94],
    eyeScaleY: 0.98,
    longSleeve: true,
    feminine: true,
    oversized: true,
    shoeStyle: 'platform',
    age: 19,
  },
};

// ============================================================================
// Construção de um personagem articulado, esculpido e com contorno toon
// ============================================================================
function buildActor(name, spec) {
  const matSkin = stdMat(spec.skin, { roughness: 0.56 });
  const matShirt = stdMat(spec.shirt, {
    roughness: spec.wetCoat ? 0.24 : 0.72,
    metalness: spec.wetCoat ? 0.14 : 0.04,
  });
  const matPants = stdMat(spec.pants, { roughness: 0.80 });
  const matShoes = stdMat(spec.shoes, { roughness: spec.wetCoat ? 0.34 : 0.48 });
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

  const chestMesh = addOutline(
    addShadow(
      new T.Mesh(
        buildTorsoGeo(!!spec.feminine, bx, bz, {
          oversized: !!spec.oversized,
          athletic: !!spec.athletic,
        }),
        matShirt
      )
    ),
    0.0052
  );
  torso.add(chestMesh);

  // ==========================================================================
  // Roupas detalhadas, acessórios e objetos de cena de cada personagem
  // ==========================================================================
  if (name === 'ANTONY') {
    // JAQUETA CORTA-VENTO LARANJA (#f26a1b), zíper escuro aberto sobre camiseta grafite,
    // cinto tático e fita métrica amarela presa no cinto!
    const orangeDark = stdMat('#cc5312', { roughness: 0.64 });
    const seamDark = stdMat('#a3400c', { roughness: 0.72 });
    const trimBlack = stdMat('#1c1f26', { roughness: 0.76 });

    // Camiseta preta grafite interna sob o zíper aberto
    const innerTee = addShadow(new T.Mesh(new T.BoxGeometry(0.118, 0.39, 0.044), trimBlack));
    innerTee.position.set(0, 0.242, 0.096 * bz);
    torso.add(innerTee);

    const teeCollar = new T.Mesh(new T.TorusGeometry(0.064, 0.010, 6, 16), stdMat('#282c36', { roughness: 0.80 }));
    teeCollar.position.set(0, 0.440, 0.026);
    teeCollar.rotation.x = Math.PI / 2 + 0.38;
    torso.add(teeCollar);

    // Gola alta do corta-vento + capuz dobrado atrás
    const jCollar = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.108, 0.026, 8, 18, Math.PI * 1.44), matShirt)),
      0.0034
    );
    jCollar.position.set(0, 0.452, -0.010);
    jCollar.rotation.set(Math.PI / 2 + 0.12, 0, Math.PI * 0.78);
    torso.add(jCollar);

    const jHood = addShadow(new T.Mesh(new T.SphereGeometry(0.104, 12, 10), orangeDark));
    jHood.position.set(0, 0.394, -0.102);
    jHood.scale.set(1.10, 0.85, 0.50);
    addOutline(jHood, 0.0034);
    torso.add(jHood);

    // Abas abertas da jaqueta corta-vento, zíper escuro, bolsos utilitários
    for (const s of [-1, 1]) {
      const flap = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.074, 0.39, 0.036), orangeDark)),
        0.0026
      );
      flap.position.set(s * 0.084, 0.236, 0.100 * bz);
      torso.add(flap);

      const zipTrack = new T.Mesh(new T.BoxGeometry(0.009, 0.38, 0.012), trimBlack);
      zipTrack.position.set(s * 0.048, 0.236, 0.118 * bz);
      torso.add(zipTrack);

      // Recorte escuro utilitário no peito + bolso com zíper
      const chestStripe = new T.Mesh(new T.BoxGeometry(0.072, 0.012, 0.012), trimBlack);
      chestStripe.position.set(s * 0.088, 0.332, 0.116 * bz);
      torso.add(chestStripe);

      const chestPkt = new T.Mesh(new T.BoxGeometry(0.056, 0.052, 0.014), matShirt);
      chestPkt.position.set(s * 0.092, 0.296, 0.116 * bz);
      torso.add(chestPkt);

      // Bolso inferior lateral da jaqueta
      const lowPkt = new T.Mesh(new T.BoxGeometry(0.058, 0.016, 0.014), seamDark);
      lowPkt.position.set(s * 0.092, 0.132, 0.115 * bz);
      lowPkt.rotation.z = s * 0.20;
      torso.add(lowPkt);
    }

    // Cinto tático escuro com fivela metálica
    const belt = new T.Mesh(new T.CylinderGeometry(0.136 * bx, 0.138 * bx, 0.038, 18), trimBlack);
    belt.position.set(0, 0.032, 0);
    belt.scale.set(1, 1, 0.80 * bz);
    addOutline(belt, 0.0032);
    torso.add(belt);

    const buckle = new T.Mesh(new T.BoxGeometry(0.044, 0.036, 0.016), matSilver);
    buckle.position.set(0, 0.032, 0.112 * bz);
    torso.add(buckle);

    // FITA MÉTRICA AMARELA PRESA NO CINTO (acessório-assinatura do Antony!)
    const tapeGroup = new T.Group();
    tapeGroup.position.set(-0.128 * bx, 0.030, 0.072 * bz);
    tapeGroup.rotation.y = -0.58;
    torso.add(tapeGroup);

    const tapeYellow = stdMat('#f4c41c', { roughness: 0.34, metalness: 0.06 });
    const tapeRubber = stdMat('#1c1f26', { roughness: 0.82 });
    const tapeBody = addOutline(
      addShadow(new T.Mesh(new T.BoxGeometry(0.062, 0.064, 0.034), tapeYellow)),
      0.0024
    );
    tapeGroup.add(tapeBody);
    // Moldura preta de borracha + botão de trava vermelho + clipe metálico + gancho da fita
    const rubberBand = new T.Mesh(new T.BoxGeometry(0.066, 0.022, 0.036), tapeRubber);
    rubberBand.position.y = -0.014;
    tapeGroup.add(rubberBand);
    const lockBtn = new T.Mesh(new T.BoxGeometry(0.018, 0.016, 0.012), stdMat('#d92c2c', { roughness: 0.35 }));
    lockBtn.position.set(0, 0.024, 0.018);
    tapeGroup.add(lockBtn);
    const tapeClip = new T.Mesh(new T.BoxGeometry(0.014, 0.048, 0.008), matSilver);
    tapeClip.position.set(0, 0.012, -0.020);
    tapeGroup.add(tapeClip);
    const tapeHook = new T.Mesh(new T.BoxGeometry(0.016, 0.014, 0.008), matSilver);
    tapeHook.position.set(0.034, -0.018, 0);
    tapeGroup.add(tapeHook);
  } else if (name === 'HELENA') {
    // SUÉTER VINHO DE GOLA ALTA CANELADA (34 anos, postura executiva rígida)
    const knitDark = stdMat('#64162c', { roughness: 0.80 });
    const knitMid = stdMat('#781b35', { roughness: 0.76 });

    // Gola alta canelada estruturada
    const turtleNeck = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(0.056, 0.066, 0.106, 16), matShirt)),
      0.0036
    );
    turtleNeck.position.set(0, 0.474, 0);
    torso.add(turtleNeck);
    for (let r = 0; r < 4; r++) {
      const rib = new T.Mesh(new T.TorusGeometry(0.059 + r * 0.0018, 0.0038, 6, 16), knitDark);
      rib.position.set(0, 0.504 - r * 0.020, 0);
      rib.rotation.x = Math.PI / 2;
      torso.add(rib);
    }

    // Textura sutil de tricô canelado no suéter + barra justa
    for (const s of [-1, 1]) {
      const dart = new T.Mesh(new T.BoxGeometry(0.0045, 0.28, 0.0045), knitDark);
      dart.position.set(s * 0.056, 0.225, 0.102 * bz);
      torso.add(dart);
      const sideRib = new T.Mesh(new T.BoxGeometry(0.004, 0.24, 0.004), knitMid);
      sideRib.position.set(s * 0.095, 0.21, 0.088 * bz);
      torso.add(sideRib);
    }

    // Colar fino dourado discreto por cima da gola vinho (toque adulto sofisticado)
    const necklace = new T.Mesh(new T.TorusGeometry(0.072, 0.0035, 6, 22), matGold);
    necklace.position.set(0, 0.422, 0.032);
    necklace.rotation.x = Math.PI / 2 + 0.44;
    torso.add(necklace);

    // Cós alto social preto com cinto fino e fivela prateada
    const waistBand = new T.Mesh(new T.CylinderGeometry(0.118 * bx, 0.125 * bx, 0.044, 16), matPants);
    waistBand.position.set(0, 0.036, 0);
    waistBand.scale.set(1, 1, 0.78 * bz);
    addOutline(waistBand, 0.0032);
    torso.add(waistBand);
    const silverBuckle = new T.Mesh(new T.BoxGeometry(0.034, 0.026, 0.012), matSilver);
    silverBuckle.position.set(0, 0.036, 0.098 * bz);
    torso.add(silverBuckle);
  } else if (name === 'BRUNO') {
    // JAQUETA ESPORTIVA AZUL-COBALTO (#2b5797), ombros largos, faixas esportivas, zíper
    const cobaltDark = stdMat('#1f4174', { roughness: 0.62 });
    const sportWhite = stdMat('#e6ecf4', { roughness: 0.48 });
    const innerMat = stdMat('#1d2128', { roughness: 0.80 });

    // Camiseta esportiva escura sob o zíper aberto no peito
    const innerTee = addShadow(new T.Mesh(new T.BoxGeometry(0.118, 0.34, 0.046), innerMat));
    innerTee.position.set(0, 0.275, 0.108 * bz);
    torso.add(innerTee);

    // Gola alta esportiva aberta na frente (track jacket, sem fechar o pescoço)
    const sportCollar = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.104, 0.026, 8, 18, Math.PI * 1.46), cobaltDark)),
      0.0034
    );
    sportCollar.position.set(0, 0.458, -0.010);
    sportCollar.rotation.set(Math.PI / 2 + 0.12, 0, Math.PI * 0.77);
    torso.add(sportCollar);

    // Recorte esportivo no peito + abas da jaqueta + zíper prateado + bolsos com zíper
    for (const s of [-1, 1]) {
      const panel = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.096, 0.39, 0.040), matShirt)),
        0.0026
      );
      panel.position.set(s * 0.104, 0.240, 0.106 * bz);
      torso.add(panel);

      // Faixa esportiva branca/azul-marinho cruzando ombro e peito
      const shoulderStripe = new T.Mesh(new T.BoxGeometry(0.112, 0.018, 0.018), sportWhite);
      shoulderStripe.position.set(s * 0.115, 0.365, 0.118 * bz);
      shoulderStripe.rotation.z = -s * 0.18;
      torso.add(shoulderStripe);

      const darkAccent = new T.Mesh(new T.BoxGeometry(0.114, 0.036, 0.014), cobaltDark);
      darkAccent.position.set(s * 0.115, 0.392, 0.112 * bz);
      darkAccent.rotation.z = -s * 0.18;
      torso.add(darkAccent);

      // Zíper frontal
      const zip = new T.Mesh(new T.BoxGeometry(0.008, 0.38, 0.010), matSilver);
      zip.position.set(s * 0.052, 0.240, 0.128 * bz);
      torso.add(zip);

      // Bolso esportivo lateral com zíper escuro
      const pktZip = new T.Mesh(new T.BoxGeometry(0.010, 0.088, 0.012), innerMat);
      pktZip.position.set(s * 0.115, 0.135, 0.126 * bz);
      pktZip.rotation.z = s * 0.22;
      torso.add(pktZip);
    }

    // Barra elástica esportiva com listra branca
    const hem = new T.Mesh(new T.CylinderGeometry(0.128 * bx, 0.132 * bx, 0.046, 18), cobaltDark);
    hem.position.set(0, 0.028, 0);
    hem.scale.set(1, 1, 0.78 * bz);
    addOutline(hem, 0.0034);
    torso.add(hem);
    const hemLine = new T.Mesh(new T.TorusGeometry(0.132 * bx, 0.004, 6, 20), sportWhite);
    hemLine.position.set(0, 0.030, 0);
    hemLine.rotation.x = Math.PI / 2;
    hemLine.scale.set(1, 0.79 * bz, 1);
    torso.add(hemLine);
  } else if (name === 'CLARA') {
    // JAQUETA AMARELO-MOSTARDA MOLHADA (#d9a026) + BOLSA DE PRIMEIROS SOCORROS!
    const wetDark = stdMat('#b88218', { roughness: 0.22, metalness: 0.16 });
    const trimDark = stdMat('#1f242c', { roughness: 0.45, metalness: 0.10 });
    const dropletMat = stdMat('#dceeff', { roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.72 });

    // Gola alta impermeável + capuz molhado dobrado atrás
    const jCollar = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.098, 0.025, 8, 18, Math.PI * 1.48), matShirt)),
      0.0034
    );
    jCollar.position.set(0, 0.448, -0.010);
    jCollar.rotation.set(Math.PI / 2 + 0.12, 0, Math.PI * 0.76);
    torso.add(jCollar);

    const jHood = addShadow(new T.Mesh(new T.SphereGeometry(0.098, 12, 10), wetDark));
    jHood.position.set(0, 0.392, -0.098);
    jHood.scale.set(1.10, 0.86, 0.52);
    addOutline(jHood, 0.0034);
    torso.add(jHood);

    // Carcela central impermeável fechada com botões de pressão
    const stormFlap = addOutline(
      addShadow(new T.Mesh(new T.BoxGeometry(0.044, 0.40, 0.022), wetDark)),
      0.0022
    );
    stormFlap.position.set(0, 0.235, 0.114 * bz);
    torso.add(stormFlap);

    for (let b = 0; b < 5; b++) {
      const snap = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.006, 8), trimDark);
      snap.rotation.x = Math.PI / 2;
      snap.position.set(0, 0.08 + b * 0.082, 0.127 * bz);
      torso.add(snap);
    }

    // Bolsos impermeáveis com aba + sutis gotículas de chuva brilhantes nos ombros
    for (const s of [-1, 1]) {
      const pktFlap = new T.Mesh(new T.BoxGeometry(0.064, 0.022, 0.016), wetDark);
      pktFlap.position.set(s * 0.080, 0.135, 0.112 * bz);
      pktFlap.rotation.z = s * 0.14;
      torso.add(pktFlap);

      // Gotas de água refletivas nos ombros/peito da jaqueta molhada
      for (let d = 0; d < 4; d++) {
        const drop = new T.Mesh(new T.SphereGeometry(0.0045 + (d % 2) * 0.0015, 6, 6), dropletMat);
        drop.scale.set(0.85, 1.35, 0.55);
        drop.position.set(
          s * (0.052 + d * 0.024),
          0.365 - d * 0.026 + (d % 2) * 0.012,
          (0.108 - d * 0.006) * bz
        );
        torso.add(drop);
      }
    }

    // BOLSA DE PRIMEIROS SOCORROS (alça transversal + maleta médica com cruz vermelha!)
    const strapMat = stdMat('#1c2028', { roughness: 0.72 });
    const strapFront = buildTaperedStrand(
      [
        [0.092 * bx, 0.445, 0.010],
        [0.036, 0.335, 0.130 * bz],
        [-0.048, 0.210, 0.138 * bz],
        [-0.126 * bx, 0.105, 0.118 * bz],
      ],
      { rStart: 0.011, rMid: 0.012, rTip: 0.011, flatten: 0.30, segs: 12, mat: strapMat, outline: 0.0018 }
    );
    torso.add(strapFront);
    const strapBack = buildTaperedStrand(
      [
        [0.092 * bx, 0.445, -0.012],
        [0.032, 0.325, -0.116 * bz],
        [-0.056, 0.200, -0.112 * bz],
        [-0.132 * bx, 0.100, 0.045 * bz],
      ],
      { rStart: 0.011, rMid: 0.012, rTip: 0.011, flatten: 0.30, segs: 12, mat: strapMat }
    );
    torso.add(strapBack);

    const medBag = new T.Group();
    medBag.position.set(-0.138 * bx, 0.032, 0.098 * bz);
    medBag.rotation.set(0.06, -0.28, -0.06);
    torso.add(medBag);

    const medRed = stdMat('#c8242e', { roughness: 0.36 });
    const medWhite = stdMat('#f4f6f8', { roughness: 0.40 });
    const bagBody = addOutline(
      addShadow(new T.Mesh(new T.BoxGeometry(0.115, 0.148, 0.178), medRed)),
      0.0028
    );
    medBag.add(bagBody);

    // Tampa superior e faixa branca médica
    const bagLid = new T.Mesh(new T.BoxGeometry(0.122, 0.034, 0.184), stdMat('#a61c24', { roughness: 0.40 }));
    bagLid.position.y = 0.062;
    medBag.add(bagLid);

    // Emblema branco + cruz vermelha visível tanto pela lateral quanto pela frente da bolsa!
    const badgeSide = new T.Mesh(new T.BoxGeometry(0.008, 0.072, 0.072), medWhite);
    badgeSide.position.set(-0.059, -0.004, 0);
    medBag.add(badgeSide);
    const crossSideV = new T.Mesh(new T.BoxGeometry(0.012, 0.050, 0.016), medRed);
    crossSideV.position.set(-0.060, -0.004, 0);
    medBag.add(crossSideV);
    const crossSideH = new T.Mesh(new T.BoxGeometry(0.012, 0.016, 0.050), medRed);
    crossSideH.position.set(-0.060, -0.004, 0);
    medBag.add(crossSideH);

    // Cruz branca destacada também na face frontal da bolsa para leitura instantânea de frente!
    const crossFrontV = new T.Mesh(new T.BoxGeometry(0.018, 0.058, 0.010), medWhite);
    crossFrontV.position.set(0, -0.004, 0.091);
    medBag.add(crossFrontV);
    const crossFrontH = new T.Mesh(new T.BoxGeometry(0.058, 0.018, 0.010), medWhite);
    crossFrontH.position.set(0, -0.004, 0.091);
    medBag.add(crossFrontH);
  } else if (name === 'LARA') {
    // MOLETOM ROXO LARGO (#8b64c9) + FONE NO PESCOÇO + BOLSA TÉRMICA PRETA COM TRAVA!
    const hoodieDark = stdMat('#6f4ca8', { roughness: 0.84 });
    const stitchMat = stdMat('#a482de', { roughness: 0.86 });

    // Barra canelada larga na cintura do moletom
    const hem = addShadow(new T.Mesh(new T.CylinderGeometry(0.140 * bx, 0.144 * bx, 0.048, 18), hoodieDark));
    hem.position.set(0, 0.026, 0);
    hem.scale.set(1, 1, 0.80 * bz);
    addOutline(hem, 0.0036);
    torso.add(hem);

    // Capuz volumoso atrás do pescoço
    const hoodRing = addOutline(
      addShadow(new T.Mesh(new T.TorusGeometry(0.118, 0.036, 10, 20), matShirt)),
      0.0038
    );
    hoodRing.position.set(0, 0.448, -0.022);
    hoodRing.rotation.x = Math.PI / 2 + 0.24;
    torso.add(hoodRing);

    const hoodBack = addShadow(new T.Mesh(new T.SphereGeometry(0.118, 14, 10), hoodieDark));
    hoodBack.position.set(0, 0.388, -0.108);
    hoodBack.scale.set(1.14, 0.92, 0.56);
    addOutline(hoodBack, 0.0038);
    torso.add(hoodBack);

    // Bolso canguru amplo
    const pocket = addOutline(
      addShadow(new T.Mesh(new T.BoxGeometry(0.210, 0.112, 0.034), hoodieDark)),
      0.0028
    );
    pocket.position.set(0, 0.136, 0.116 * bz);
    torso.add(pocket);

    const pocketStitch = new T.Mesh(new T.BoxGeometry(0.198, 0.005, 0.005), stitchMat);
    pocketStitch.position.set(0, 0.188, 0.134 * bz);
    torso.add(pocketStitch);

    // Cordões claros do moletom
    const matStr = stdMat('#e8e4f0', { roughness: 0.68 });
    for (const sx of [-0.042, 0.042]) {
      const str = new T.Mesh(new T.CylinderGeometry(0.0052, 0.0052, 0.148, 6), matStr);
      str.position.set(sx, 0.342, 0.122 * bz);
      torso.add(str);
    }

    // FONE NO PESCOÇO (preto grafite com aro lavanda!)
    const hpMat = stdMat('#1c1f28', { roughness: 0.34, metalness: 0.18 });
    const hpPadMat = stdMat('#2c2838', { roughness: 0.78 });
    const hpAccent = stdMat('#b48cf0', { roughness: 0.30, metalness: 0.42 });
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
      cup.position.set(s * 0.088, 0.405, 0.084);
      torso.add(cup);
      const ring = new T.Mesh(new T.TorusGeometry(0.034, 0.005, 8, 16), hpAccent);
      ring.rotation.copy(cup.rotation);
      ring.rotation.y += Math.PI / 2;
      ring.position.set(s * 0.102, 0.405, 0.090);
      torso.add(ring);
      const pad = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.015, 12), hpPadMat);
      pad.rotation.copy(cup.rotation);
      pad.position.set(s * 0.074, 0.405, 0.078);
      torso.add(pad);
    }

    // BOLSA TÉRMICA PRETA COM TRAVA (pista central da trama da Lara!)
    const thermBlack = stdMat('#161820', { roughness: 0.56, metalness: 0.08 });
    const thermTrim = stdMat('#282d38', { roughness: 0.64 });
    const reflStrip = stdMat('#9aa6b5', { roughness: 0.25, metalness: 0.55 });

    // Alça transversal da bolsa térmica
    const bagStrapF = buildTaperedStrand(
      [
        [-0.094 * bx, 0.446, 0.010],
        [-0.034, 0.335, 0.138 * bz],
        [0.052, 0.210, 0.148 * bz],
        [0.124 * bx, 0.105, 0.126 * bz],
      ],
      { rStart: 0.012, rMid: 0.013, rTip: 0.012, flatten: 0.28, segs: 12, mat: thermBlack, outline: 0.0018 }
    );
    torso.add(bagStrapF);
    const bagStrapB = buildTaperedStrand(
      [
        [-0.094 * bx, 0.446, -0.014],
        [-0.034, 0.325, -0.124 * bz],
        [0.058, 0.200, -0.116 * bz],
        [0.130 * bx, 0.100, 0.048 * bz],
      ],
      { rStart: 0.012, rMid: 0.013, rTip: 0.012, flatten: 0.28, segs: 12, mat: thermBlack }
    );
    torso.add(bagStrapB);

    // Caixa térmica preta estruturada na lateral-frente do quadril (100% visível de frente, sem colidir com o braço!)
    const thermalBag = new T.Group();
    thermalBag.position.set(0.134 * bx, 0.032, 0.106 * bz);
    thermalBag.rotation.set(0.05, 0.24, 0.05);
    torso.add(thermalBag);

    const tBody = addOutline(
      addShadow(new T.Mesh(new T.BoxGeometry(0.135, 0.168, 0.195), thermBlack)),
      0.0030
    );
    thermalBag.add(tBody);

    // Tampa superior estruturada com borda de zíper + faixa refletiva
    const tLid = new T.Mesh(new T.BoxGeometry(0.142, 0.034, 0.202), thermTrim);
    tLid.position.y = 0.072;
    thermalBag.add(tLid);

    const tStripe = new T.Mesh(new T.BoxGeometry(0.140, 0.014, 0.200), reflStrip);
    tStripe.position.y = 0.044;
    thermalBag.add(tStripe);

    // Trava metálica de segurança bem visível na frente da bolsa térmica!
    const latchPlate = new T.Mesh(new T.BoxGeometry(0.038, 0.046, 0.014), matSilver);
    latchPlate.position.set(0, 0.052, 0.102);
    thermalBag.add(latchPlate);
    const latchClip = new T.Mesh(new T.BoxGeometry(0.022, 0.026, 0.018), stdMat('#4d5563', { roughness: 0.3, metalness: 0.8 }));
    latchClip.position.set(0, 0.042, 0.108);
    thermalBag.add(latchClip);

    // Alça de mão no topo da tampa
    const topHandle = new T.Mesh(new T.TorusGeometry(0.036, 0.006, 6, 12, Math.PI), thermTrim);
    topHandle.position.set(0, 0.088, 0);
    thermalBag.add(topHandle);
  }

  // ==========================================================================
  // Pescoço anatômico e Cabeça esculpida (proporção e rosto por idade!)
  // ==========================================================================
  const neckW = spec.athletic ? 0.052 : spec.feminine ? 0.041 : 0.045;
  const neckGeo = new T.CylinderGeometry(neckW, neckW * 1.24, 0.115, 14);
  const neck = addOutline(addShadow(new T.Mesh(neckGeo, matSkin)), 0.0038);
  neck.position.set(0, 0.502, 0.004);
  neck.rotation.x = 0.05;
  torso.add(neck);

  const headPivot = new T.Group();
  headPivot.position.set(0, 0.54, 0);
  torso.add(headPivot);

  // Escultura craniana diferenciando jovens adultos (19–25) de adultos (27–34)
  const headGeo = new T.SphereGeometry(0.143, 24, 20);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);

    if (y < 0) {
      const tLow = clamp(-y / 0.143, 0, 1);
      // Bruno (27): mandíbula mais quadrada e firme; Helena (34): rosto mais alongado e definido
      const jawFactor = spec.athletic ? 0.08 : spec.mature && spec.feminine ? 0.25 : spec.feminine ? 0.22 : 0.13;
      const jawTaper = 1 - tLow * jawFactor;
      x *= jawTaper;
      if (spec.athletic && tLow > 0.35 && tLow < 0.85) {
        // Ângulo mandibular masculino adulto mais marcado
        x *= 1.04;
      }
      if (z > 0) z *= 1 - tLow * (spec.mature ? 0.03 : 0.045);
    }

    // Maçãs do rosto (mais esculpidas nos adultos de 27-34 anos)
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
  const chin = new T.Mesh(new T.SphereGeometry(chinR, 12, 10), matSkin);
  chin.position.set(0, spec.mature ? 0.022 : 0.028, 0.056);
  chin.scale.set(spec.athletic ? 1.18 : spec.feminine ? 0.90 : 1.06, 0.82, 0.92);
  headPivot.add(chin);

  // Orelhas com contorno suave
  for (const sx of [-1, 1]) {
    const ear = addShadow(new T.Mesh(new T.SphereGeometry(0.025, 10, 8), matSkin));
    ear.position.set(sx * 0.132 * spec.headScale[0], 0.125, -0.008);
    ear.scale.set(0.48, 1.12, 0.74);
    addOutline(ear, 0.0030);
    headPivot.add(ear);
  }

  // Nariz esculpido (ponte + ponta + abas)
  const noseW = spec.feminine ? 0.0092 : spec.athletic ? 0.0124 : 0.0112;
  const noseBridge = new T.Mesh(new T.CapsuleGeometry(noseW, spec.mature ? 0.032 : 0.028, 6, 8), matSkin);
  noseBridge.position.set(0, 0.126, 0.127);
  noseBridge.rotation.x = -0.22;
  headPivot.add(noseBridge);

  const noseTip = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.0130 : spec.athletic ? 0.0162 : 0.0150, 10, 8), matSkin);
  noseTip.position.set(0, 0.106, 0.136);
  noseTip.scale.set(0.92, 0.84, 0.96);
  headPivot.add(noseTip);

  for (const sx of [-1, 1]) {
    const wing = new T.Mesh(new T.SphereGeometry(spec.feminine ? 0.0074 : 0.0090, 8, 6), matSkin);
    wing.position.set(sx * 0.0095, 0.103, 0.130);
    wing.scale.set(1.0, 0.75, 0.85);
    headPivot.add(wing);
  }

  // ==========================================================================
  // Olhos expressivos (proporção de idade: mais alongados e firmes em 27–34 anos!)
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

    const sclera = new T.Mesh(new T.SphereGeometry(eyeBaseRadius, 14, 10), matEyeWhite);
    sclera.scale.set(1.10, 1.0 * eyeYScale, 0.70);
    eyeGroup.add(sclera);

    const eyeBall = new T.Group();
    eyeGroup.add(eyeBall);

    const irisR = spec.mature ? 0.0132 : 0.0142;
    const limbal = new T.Mesh(new T.SphereGeometry(irisR + 0.0014, 12, 10), matLimbal);
    limbal.position.set(0, 0, 0.0114);
    limbal.scale.set(1.0, 1.02, 0.46);
    eyeBall.add(limbal);

    const iris = new T.Mesh(new T.SphereGeometry(irisR, 12, 10), matIris);
    iris.position.set(0, 0, 0.0124);
    iris.scale.set(1.0, 1.02, 0.50);
    eyeBall.add(iris);

    const pupil = new T.Mesh(new T.SphereGeometry(spec.mature ? 0.0074 : 0.0080, 10, 8), matPupil);
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
    const inner = new T.Mesh(new T.CapsuleGeometry(thick, 0.024, 4, 8), matBrow);
    inner.rotation.z = Math.PI / 2 - side * (spec.mature && spec.feminine ? 0.18 : 0.14);
    inner.position.set(-side * 0.010, 0.001, 0.002);
    g.add(inner);

    const outer = new T.Mesh(new T.CapsuleGeometry(thick * 0.80, 0.020, 4, 8), matBrow);
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
    new T.BoxGeometry(0.028, 0.007, 0.008),
    stdMat('#f4f1ea', { roughness: 0.30 })
  );
  mouthTeeth.position.set(0, 0.003, 0.005);
  mouthTeeth.visible = false;
  mouthGroup.add(mouthTeeth);

  const matLip = stdMat(spec.lip, { roughness: spec.feminine ? 0.36 : 0.54 });
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
        new T.Mesh(new T.BoxGeometry(0.012, 0.024, 0.062), gOrange),
        0.0016
      );
      sideArm.position.set(sx * 0.118, 0.002, 0.078);
      sideArm.rotation.y = -sx * 0.32;
      goggleGroup.add(sideArm);
    }

    // Ponte nasal + barra superior da armação laranja
    const topBar = addOutline(new T.Mesh(new T.BoxGeometry(0.140, 0.011, 0.014), gOrange), 0.0016);
    topBar.position.set(0, 0.025, 0.128);
    goggleGroup.add(topBar);
    const bridge = new T.Mesh(new T.BoxGeometry(0.028, 0.010, 0.012), gDark);
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
    // Sombra de barba rala (stubble 27 anos) ao longo da mandíbula, queixo e buço
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

    const mustacheStubble = new T.Mesh(new T.BoxGeometry(0.052, 0.010, 0.014), stubbleMat);
    mustacheStubble.position.set(0, 0.084, 0.128);
    headPivot.add(mustacheStubble);
  } else if (name === 'CLARA') {
    // Sardas sutis de enfermeira jovem-adulta + pequenos brincos prateados
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
      const stud = new T.Mesh(new T.SphereGeometry(0.0046, 8, 6), matSilver);
      stud.position.set(sx * 0.123, 0.104, 0.002);
      headPivot.add(stud);
    }
  }

  // Cabelo esculpido
  const hairGroup = buildHair(headPivot, name, matSkin);

  // ==========================================================================
  // Braços articulados com ombro arredondado, punho, luvas e relógio
  // ==========================================================================
  function makeArm(side) {
    const shoulder = new T.Group();
    shoulder.position.set(side * (0.178 * bx), 0.402, 0);
    torso.add(shoulder);

    const deltoidR = spec.athletic ? 0.064 : spec.oversized ? 0.054 : spec.feminine ? 0.048 : 0.056;
    const deltoid = addShadow(new T.Mesh(new T.SphereGeometry(deltoidR, 12, 10), matShirt));
    deltoid.scale.set(1.02, 1.06, 0.94);
    addOutline(deltoid, 0.0040);
    shoulder.add(deltoid);

    const upperR = spec.athletic ? 0.053 : spec.oversized ? 0.047 : spec.feminine ? 0.039 : 0.046;
    const upper = addOutline(
      addShadow(new T.Mesh(new T.CapsuleGeometry(upperR, 0.178, 6, 12), matShirt)),
      0.0042
    );
    upper.position.set(0, -0.108, 0);
    shoulder.add(upper);

    // Faixa esportiva branca na manga superior do Bruno
    if (name === 'BRUNO') {
      const armStripe = new T.Mesh(new T.BoxGeometry(0.014, 0.190, 0.020), stdMat('#e6ecf4', { roughness: 0.48 }));
      armStripe.position.set(side * (upperR + 0.002), -0.104, 0);
      shoulder.add(armStripe);
    }

    const elbow = new T.Group();
    elbow.position.set(0, -0.222, 0);
    shoulder.add(elbow);

    const lowerMat = spec.longSleeve ? matShirt : matSkin;
    const lowerR = spec.athletic ? 0.043 : spec.oversized ? 0.042 : spec.feminine ? 0.032 : 0.038;
    const lower = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(lowerR, lowerR * 0.78, 0.205, 12), lowerMat)),
      0.0038
    );
    lower.position.set(0, -0.102, 0);
    elbow.add(lower);

    if (name === 'BRUNO') {
      const lowStripe = new T.Mesh(new T.BoxGeometry(0.012, 0.178, 0.016), stdMat('#e6ecf4', { roughness: 0.48 }));
      lowStripe.position.set(side * (lowerR * 0.90), -0.095, 0);
      elbow.add(lowStripe);
    }

    const elbowCap = new T.Mesh(new T.SphereGeometry(lowerR * 1.02, 10, 8), matShirt);
    elbow.add(elbowCap);

    // Punho da manga
    if (spec.longSleeve) {
      const cuffColor =
        name === 'ANTONY'
          ? '#1c2028'
          : name === 'HELENA'
            ? '#64162c'
            : name === 'BRUNO'
              ? '#1f4174'
              : name === 'CLARA'
                ? '#1f242c'
                : '#6f4ca8';
      const cuff = addOutline(
        new T.Mesh(new T.CylinderGeometry(lowerR * 0.88, lowerR * 0.84, 0.034, 12), stdMat(cuffColor, { roughness: 0.76 })),
        0.0028
      );
      cuff.position.set(0, -0.188, 0);
      elbow.add(cuff);
    }

    // Mão esculpida (com LUVAS PRETAS SEM DEDOS para o ANTONY!)
    const hand = new T.Group();
    hand.position.set(0, -0.214, 0);
    elbow.add(hand);

    const isGloved = name === 'ANTONY';
    const gloveMat = stdMat('#191c22', { roughness: 0.72 });
    const gloveGuardMat = stdMat('#2b303c', { roughness: 0.52, metalness: 0.12 });

    const palm = addShadow(new T.Mesh(new T.SphereGeometry(0.031, 10, 8), isGloved ? gloveMat : matSkin));
    palm.position.set(0, -0.020, 0);
    palm.scale.set(0.86, 1.12, 0.56);
    addOutline(palm, 0.0030);
    hand.add(palm);

    if (isGloved) {
      // Proteção dos nós dos dedos + tira de velcro da luva sem dedos
      const knuckle = new T.Mesh(new T.BoxGeometry(0.052, 0.012, 0.012), gloveGuardMat);
      knuckle.position.set(0, -0.040, 0.014);
      hand.add(knuckle);
      const wristStrap = new T.Mesh(new T.CylinderGeometry(0.028, 0.029, 0.018, 12), gloveGuardMat);
      wristStrap.position.set(0, 0.002, 0);
      hand.add(wristStrap);
    }

    // Polegar (base preta da luva + ponta em pele no Antony)
    if (isGloved) {
      const thumbBase = new T.Mesh(new T.CapsuleGeometry(0.0078, 0.011, 4, 6), gloveMat);
      thumbBase.position.set(-side * 0.022, -0.015, 0.013);
      thumbBase.rotation.set(0.32, 0, side * 0.48);
      hand.add(thumbBase);
      const thumbTip = new T.Mesh(new T.CapsuleGeometry(0.0068, 0.011, 4, 6), matSkin);
      thumbTip.position.set(-side * 0.029, -0.026, 0.017);
      thumbTip.rotation.set(0.32, 0, side * 0.48);
      hand.add(thumbTip);
    } else {
      const thumb = new T.Mesh(new T.CapsuleGeometry(0.0072, 0.022, 4, 6), matSkin);
      thumb.position.set(-side * 0.024, -0.018, 0.014);
      thumb.rotation.set(0.32, 0, side * 0.48);
      hand.add(thumb);
    }

    // 4 dedos (indicador separado para apontar + médio/anelar/mínimo)
    const fingerSpecs = [
      { x: -side * 0.016, len: 0.028, r: 0.0058 },
      { x: -side * 0.005, len: 0.032, r: 0.0060 },
      { x: side * 0.006, len: 0.028, r: 0.0056 },
      { x: side * 0.016, len: 0.022, r: 0.0050 },
    ];
    const indexPivot = new T.Group();
    indexPivot.position.set(fingerSpecs[0].x, -0.045, 0.003);
    hand.add(indexPivot);
    if (isGloved) {
      const idxGlove = new T.Mesh(new T.CapsuleGeometry(fingerSpecs[0].r + 0.0008, fingerSpecs[0].len * 0.42, 4, 6), gloveMat);
      idxGlove.position.set(0, -fingerSpecs[0].len * 0.25, 0);
      indexPivot.add(idxGlove);
      const idxTip = new T.Mesh(new T.CapsuleGeometry(fingerSpecs[0].r, fingerSpecs[0].len * 0.56, 4, 6), matSkin);
      idxTip.position.set(0, -fingerSpecs[0].len * 0.72, 0);
      indexPivot.add(idxTip);
    } else {
      const indexMesh = new T.Mesh(new T.CapsuleGeometry(fingerSpecs[0].r, fingerSpecs[0].len, 4, 6), matSkin);
      indexMesh.position.set(0, -fingerSpecs[0].len * 0.55, 0);
      indexPivot.add(indexMesh);
    }

    const otherFingers = new T.Group();
    otherFingers.position.set(0, -0.045, 0.002);
    hand.add(otherFingers);
    for (let f = 1; f < fingerSpecs.length; f++) {
      const fs = fingerSpecs[f];
      if (isGloved) {
        const fg = new T.Mesh(new T.CapsuleGeometry(fs.r + 0.0008, fs.len * 0.42, 4, 6), gloveMat);
        fg.position.set(fs.x, -fs.len * 0.25, 0);
        otherFingers.add(fg);
        const ft = new T.Mesh(new T.CapsuleGeometry(fs.r, fs.len * 0.56, 4, 6), matSkin);
        ft.position.set(fs.x, -fs.len * 0.72, 0);
        otherFingers.add(ft);
      } else {
        const fm = new T.Mesh(new T.CapsuleGeometry(fs.r, fs.len, 4, 6), matSkin);
        fm.position.set(fs.x, -fs.len * 0.55, 0);
        otherFingers.add(fm);
      }
    }

    // RELÓGIO LARANJA NO PULSO ESQUERDO DO ANTONY (side === 1 = braço esquerdo!)
    if (name === 'ANTONY' && side === 1) {
      const watchBand = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.024, 14), stdMat('#1b1e25', { roughness: 0.55 }));
      watchBand.position.set(0, -0.194, 0);
      elbow.add(watchBand);
      const watchCase = addOutline(
        new T.Mesh(new T.BoxGeometry(0.022, 0.032, 0.034), stdMat('#f26a1b', { roughness: 0.30, metalness: 0.12 })),
        0.0018
      );
      watchCase.position.set(0.032, -0.194, 0.004);
      elbow.add(watchCase);
      const watchScreen = new T.Mesh(new T.PlaneGeometry(0.022, 0.022), new T.MeshBasicMaterial({ color: '#ff9636' }));
      watchScreen.rotation.y = Math.PI / 2;
      watchScreen.position.set(0.044, -0.194, 0.004);
      elbow.add(watchScreen);
    }

    // Relógio executivo discreto no pulso esquerdo da Helena
    if (name === 'HELENA' && side === 1) {
      const strap = new T.Mesh(new T.CylinderGeometry(0.030, 0.030, 0.016, 12), matGold);
      strap.position.set(0, -0.198, 0);
      elbow.add(strap);
      const dial = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.008, 12), stdMat('#f7f4ec', { roughness: 0.2 }));
      dial.rotation.z = Math.PI / 2;
      dial.position.set(0.031, -0.198, 0.004);
      elbow.add(dial);
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
  // Pernas articuladas e calçados modelados (pés assentados em y = 0)
  // ==========================================================================
  function makeLeg(side) {
    const hip = new T.Group();
    hip.position.set(side * (0.090 * bx), -0.02, 0);
    pelvis.add(hip);

    const thighTop = spec.athletic ? 0.072 : spec.feminine ? 0.062 : 0.066;
    const thighBot = spec.athletic ? 0.056 : spec.feminine ? 0.047 : 0.052;
    const thigh = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(thighTop, thighBot, 0.36, 14), matPants)),
      0.0044
    );
    thigh.position.set(0, -0.18, 0);
    hip.add(thigh);

    // Bolsos laterais da calça cargo do Antony
    if (name === 'ANTONY') {
      const cargoPkt = addOutline(
        addShadow(new T.Mesh(new T.BoxGeometry(0.024, 0.112, 0.088), stdMat('#2c323b', { roughness: 0.84 }))),
        0.0022
      );
      cargoPkt.position.set(side * (thighTop * 0.92), -0.19, 0.006);
      hip.add(cargoPkt);
    }

    const knee = new T.Group();
    knee.position.set(0, -0.37, 0);
    hip.add(knee);

    const kneeCap = new T.Mesh(new T.SphereGeometry(thighBot * 0.98, 10, 8), matPants);
    knee.add(kneeCap);

    const shinTop = spec.athletic ? 0.053 : spec.feminine ? 0.045 : 0.050;
    const shinBot = spec.athletic ? 0.041 : spec.feminine ? 0.034 : 0.039;
    const shin = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(shinTop, shinBot, 0.37, 14), matPants)),
      0.0042
    );
    shin.position.set(0, -0.185, 0);
    knee.add(shin);

    const pantCuff = new T.Mesh(new T.CylinderGeometry(shinBot * 1.12, shinBot * 1.12, 0.026, 12), matPants);
    pantCuff.position.set(0, -0.360, 0);
    knee.add(pantCuff);

    // Sapato/bota esculpida (base encosta exatamente em y = -0.45 -> chão y = 0)
    const shoe = new T.Group();
    shoe.position.set(0, -0.405, 0.020);
    knee.add(shoe);

    const isPlatform = spec.shoeStyle === 'platform';
    const isHeel = spec.shoeStyle === 'heel';
    const isWorkboot = spec.shoeStyle === 'workboot';
    const soleH = isPlatform ? 0.030 : isWorkboot ? 0.024 : 0.018;
    const soleColor = spec.shoeStyle === 'sneaker' ? '#e8e4dc' : '#121419';
    const matSole = stdMat(soleColor, { roughness: 0.84 });

    const heelBody = addOutline(
      addShadow(new T.Mesh(new T.CylinderGeometry(0.045, 0.048, isWorkboot ? 0.088 : 0.068, 12), matShoes)),
      0.0034
    );
    heelBody.position.set(0, isWorkboot ? 0.014 : 0.005, -0.012);
    shoe.add(heelBody);

    const toeBox = addShadow(new T.Mesh(new T.SphereGeometry(0.046, 12, 10), matShoes));
    toeBox.position.set(0, -0.010, 0.066);
    toeBox.scale.set(0.96, 0.68, 1.58);
    addOutline(toeBox, 0.0034);
    shoe.add(toeBox);

    const sole = addOutline(new T.Mesh(new T.BoxGeometry(0.094, soleH, 0.198), matSole), 0.0026);
    sole.position.set(0, -0.045 + soleH * 0.5, 0.036);
    shoe.add(sole);

    if (isHeel) {
      const heelBlock = new T.Mesh(new T.BoxGeometry(0.050, 0.024, 0.048), matSole);
      heelBlock.position.set(0, -0.033, -0.030);
      shoe.add(heelBlock);
    }

    if (spec.shoeStyle === 'sneaker' || isWorkboot) {
      const laceMat = stdMat(isWorkboot ? '#d89b32' : '#eef2f6', { roughness: 0.72 });
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
    armL,
    armR,
    arms: [armL.shoulder, armR.shoulder],
    legL,
    legR,
    scale,
    headY: 1.56 * scale,
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
