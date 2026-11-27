// Coordenadas em metros de world.js. Y é a altura do piso, não a do rosto.
// Cada aresta é um corredor livre ou uma passagem explícita; nenhuma aresta atravessa paredes.
export const PONTOS = Object.freeze({
  sala_centro: [0, 0, 0], sala_frente: [0, 0, -2.5], sala_vidro: [1.25, 0, -4.15],
  sala_sofa: [0.4, 0, 2.45], sala_lareira: [-3.35, 0, 1.05],
  sala_canto_esq: [-3.6, 0, -2.45], sala_radio: [1.25, 0, -1.25],
  sala_arco: [4.55, 0, -0.45], sala_saida_escada: [-4.55, 0, -2.4],
  varanda_porta: [1.25, 0, -5.9], varanda_fora: [1.25, 0, -9],
  varanda_esq: [-3.15, 0, -8.8], varanda_dir: [3.7, 0, -8.8],
  varanda_fundo: [0, 0, -13.5], piscina_deck: [0, 0, -17],
  cozinha_entrada: [6.75, 0, -0.45], cozinha_bancada_frente: [10.1, 0, -2.1],
  cozinha_bancada_atras: [10.1, 0, 2.1], cozinha_janela: [12.2, 0, -3.6],
  cozinha_fogao: [15.45, 0, -0.1], cozinha_geladeira: [15.2, 0, 3.25],
  cozinha_porta: [7.8, 0, 3.35], cozinha_fundo: [12, 0, 3.3],
  corredor: [-7.5, 0, -2.2], escada_hall: [-10.5, 0, 0.45],
  escada_base: [-11, 0, 2.05], escada_meio_baixo: [-11, 1.1, 4.0],
  escada_meio_cima: [-11, 2.7, 6.6], escada_topo: [-11, 4, 9],
  quarto1_centro: [-9.1, 4, 10.8], quarto1_escrivaninha: [-8.2, 4, 11.55],
  quarto1_cama: [-12.15, 4, 10.3],
  porao_escada_acesso: [-7.55, 0, 1.5],
  porao_escada_entrada: [-7.55, 0, 4.85], porao_escada_meio1: [-7.5, -1.25, 6.25],
  porao_escada_patamar: [-6.9, -2, 7.65], porao_escada_meio2: [-6.3, -3.1, 6.0],
  porao_escada_saida: [-6.3, -4, 4.65],
  porao_porta_aco_fora: [-4, -4, 4.15], porao_porta_aco_dentro: [-4, -4, 5.85],
  porao_centro: [0, -4, 9.8], porao_quadro_luz: [-4.25, -4, 10.4],
  porao_adega: [1.4, -4, 12.7], porao_canto_escuro: [-3.6, -4, 13.3],
  porao_porta_garagem: [4.45, -4, 10], garagem_porta: [6.55, -4, 10],
  garagem_centro: [8.15, -4, 8.5], garagem_frente: [12.8, -4, 7.2],
  garagem_carro: [8.1, -4, 11.8],
  garagem_bancada: [14.8, -4, 11.4], garagem_portao: [13.5, -4, 13.8],
  bunker_escada_topo: [-2, -4, 7.4], bunker_escada_meio: [-2, -6, 7.4],
  bunker_escada_base: [-2, -8, 7.4], bunker_porta: [-1.2, -8, 6.45],
  bunker_centro: [0, -8, 10], bunker_canto_escuro: [2.1, -8, 12.7],
});

// Limites internos, com uma folga para a câmera não atravessar a alvenaria.
export const BOUNDS = Object.freeze({
  sala: {min:[-5.25,0,-4.75],max:[5.25,3.25,4.75]},
  cozinha: {min:[5.75,0,-4.75],max:[17.25,3.25,4.75]},
  corredor: {min:[-10.15,0,-4.75],max:[-5.65,3.25,1.35]},
  escada: {min:[-15.2,0,-4.75],max:[-9.25,7.2,9.75]},
  quarto1: {min:[-15.75,4,8.15],max:[-6.25,7.2,14.75]},
  porao_escada: {min:[-8.75,-4,1.2],max:[-5.75,3.25,8.25]},
  porao_entrada: {min:[-6.45,-4,3.3],max:[-3.05,-0.8,4.85]},
  porao: {min:[-5.25,-4,5.25],max:[5.25,-0.8,14.75]},
  garagem: {min:[5.75,-4,5.25],max:[17.25,-0.8,14.75]},
  bunker: {min:[-2.75,-8,6.25],max:[2.75,-5.55,13.75]},
  varanda: {min:[-6.1,0,-16.5],max:[6.1,3.15,-5.25]},
  piscina: {min:[-8.2,0,-29.3],max:[8.2,4,-16.7]},
});
export function localDoPonto(p, nome='') {
  if (nome.startsWith('porao_escada')) return 'porao_escada';
  if (nome==='porao_porta_aco_fora') return 'porao_entrada';
  for (const prefix of ['quarto1','cozinha','corredor','garagem','bunker','varanda','piscina','sala'])
    if (nome.startsWith(prefix)) return prefix;
  if (nome.startsWith('escada')) return 'escada';
  if (nome.startsWith('porao')) return 'porao';
  const [x,y,z]=p;
  if (y < -5.2) return 'bunker';
  if (y < -0.35) {
    if (x > 5.5) return 'garagem';
    if (x < -5.5) return 'porao_escada';
    if (z < 5.0) return 'porao_entrada';
    return 'porao';
  }
  if (y >= 3.5 && z > 8) return 'quarto1';
  if (x > 5.5) return 'cozinha';
  if (z < -16.7) return 'piscina';
  if (z < -5) return 'varanda';
  if (x < -5.5 && x >= -9.0 && z >= 1.35) return 'porao_escada';
  if (x < -9.0 && z >= 1.35) return 'escada';
  if (x < -5.5) return 'corredor';
  return 'sala';
}

// Arestas bidirecionais. Rotas externas, ilha da cozinha e carro seguem suas laterais.
const LIGACOES = [
  ['sala_centro','sala_frente'], ['sala_frente','sala_vidro'],
  ['sala_centro','sala_sofa'], ['sala_centro','sala_radio'],
  ['sala_centro','sala_lareira'], ['sala_lareira','sala_canto_esq'],
  ['sala_canto_esq','sala_frente'], ['sala_centro','sala_arco'],
  ['sala_canto_esq','sala_saida_escada'], ['sala_saida_escada','corredor'],
  ['sala_vidro','varanda_porta'], ['varanda_porta','varanda_fora'],
  ['varanda_fora','varanda_esq'], ['varanda_fora','varanda_dir'],
  ['varanda_esq','varanda_fundo'], ['varanda_dir','varanda_fundo'],
  ['varanda_fundo','piscina_deck'],
  ['sala_arco','cozinha_entrada'], ['cozinha_entrada','cozinha_bancada_frente'],
  ['cozinha_entrada','cozinha_bancada_atras'], ['cozinha_bancada_frente','cozinha_janela'],
  ['cozinha_janela','cozinha_fogao'], ['cozinha_fogao','cozinha_geladeira'],
  ['cozinha_geladeira','cozinha_fundo'], ['cozinha_fundo','cozinha_bancada_atras'],
  ['cozinha_bancada_atras','cozinha_porta'], ['cozinha_porta','cozinha_fundo'],
  ['corredor','escada_hall'], ['escada_hall','escada_base'],
  ['escada_base','escada_meio_baixo'], ['escada_meio_baixo','escada_meio_cima'],
  ['escada_meio_cima','escada_topo'], ['escada_topo','quarto1_centro'],
  ['quarto1_centro','quarto1_escrivaninha'], ['quarto1_centro','quarto1_cama'],
  ['escada_hall','porao_escada_acesso'],
  ['porao_escada_acesso','porao_escada_entrada'],
  ['porao_escada_entrada','porao_escada_meio1'],
  ['porao_escada_meio1','porao_escada_patamar'],
  ['porao_escada_patamar','porao_escada_meio2'],
  ['porao_escada_meio2','porao_escada_saida'],
  ['porao_escada_saida','porao_porta_aco_fora'],
  ['porao_porta_aco_fora','porao_porta_aco_dentro'],
  ['porao_porta_aco_dentro','porao_centro'], ['porao_centro','porao_quadro_luz'],
  ['porao_centro','porao_adega'], ['porao_adega','porao_canto_escuro'],
  ['porao_centro','porao_porta_garagem'],
  ['porao_porta_garagem','garagem_porta'],
  ['garagem_porta','garagem_centro'], ['garagem_centro','garagem_carro'],
  ['garagem_centro','garagem_frente'], ['garagem_frente','garagem_bancada'],
  ['garagem_bancada','garagem_portao'],
  ['porao_centro','bunker_escada_topo'],
  ['bunker_escada_topo','bunker_escada_meio'],
  ['bunker_escada_meio','bunker_escada_base'],
  ['bunker_escada_base','bunker_porta'], ['bunker_porta','bunker_centro'],
  ['bunker_centro','bunker_canto_escuro'],
];
export const GRAFO = Object.fromEntries(Object.keys(PONTOS).map((k) => [k, []]));
for (const [a, b] of LIGACOES) { GRAFO[a].push(b); GRAFO[b].push(a); }

const distancia = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
export function caminhoMaisCurto(origem, destino, bloqueada = () => false) {
  if (!PONTOS[origem] || !PONTOS[destino]) return null;
  const dist = new Map([[origem, 0]]), ant = new Map(), abertos = new Set([origem]);
  while (abertos.size) {
    const atual = [...abertos].sort((a,b) => dist.get(a)-dist.get(b) || a.localeCompare(b))[0];
    abertos.delete(atual);
    if (atual === destino) {
      const rota = [atual];
      while (ant.has(rota[0])) rota.unshift(ant.get(rota[0]));
      return rota;
    }
    for (const proximo of GRAFO[atual]) {
      if (bloqueada(atual, proximo)) continue;
      const custo = dist.get(atual) + distancia(PONTOS[atual], PONTOS[proximo]);
      if (custo < (dist.get(proximo) ?? Infinity)) {
        dist.set(proximo, custo); ant.set(proximo, atual); abertos.add(proximo);
      }
    }
  }
  return null;
}
