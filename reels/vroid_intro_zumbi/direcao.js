import {planos as p1} from './dir/parte1.js';
import {planos as p2} from './dir/parte2.js';
import {planos as p3} from './dir/parte3.js';
import {planos as p4} from './dir/parte4.js';
import {planos as p5} from './dir/parte5.js';
import {planos as p6} from './dir/parte6.js';
import {planos as p7} from './dir/parte7.js';
export const planos=[...p1,...p2,...p3,...p4,...p5,...p6,...p7].sort((a,b)=>a.t0-b.t0);

// Afasta atores que ficariam dentro da câmera (cabeça na lente)
for (const p of planos) {
  const c = p.cam?.pos, o = p.cam?.olhar; if (!c) continue;
  for (const a of p.atores || []) {
    const dx = a.pos[0] - c[0], dz = a.pos[2] - c[2], d = Math.hypot(dx, dz), fy = c[1] - a.pos[1];
    if (d < 1.25 && fy > 0.3 && fy < 2.3) {
      let ux = dx, uz = dz;
      if (d < 0.05 && o) { ux = o[0] - c[0]; uz = o[2] - c[2]; }
      const n = Math.hypot(ux, uz) || 1;
      a.pos = [c[0] + ux / n * 1.3, a.pos[1], c[2] + uz / n * 1.3];
    }
  }
}

// Ajustes pontuais do QA do Windows (25/11)
for (const p of planos) {
}

// Rótulo só na primeira aparição de cada personagem
{ const vistos = new Set(); for (const p of planos) { const n = p.rotulo?.nome; if (!n) continue; if (vistos.has(n)) delete p.rotulo; else vistos.add(n); } }

export const DURACAO=Math.ceil(planos.at(-1).t1*10)/10;
export function planoEm(t){return planos.find(p=>t>=p.t0&&t<p.t1)||planos.at(-1)}
