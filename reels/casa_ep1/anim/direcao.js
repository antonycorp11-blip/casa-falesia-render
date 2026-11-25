import {planos as p1} from './dir/parte1.js';
import {planos as p2} from './dir/parte2.js';
import {planos as p3} from './dir/parte3.js';
import {planos as p4} from './dir/parte4.js';
import {planos as p5} from './dir/parte5.js';
import {planos as p6} from './dir/parte6.js';
import {planos as p7} from './dir/parte7.js';
export const planos=[...p1,...p2,...p3,...p4,...p5,...p6,...p7].sort((a,b)=>a.t0-b.t0);
export const DURACAO=592;
export function planoEm(t){return planos.find(p=>t>=p.t0&&t<p.t1)||planos.at(-1)}
