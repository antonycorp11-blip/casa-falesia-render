// Demo visual de 20 s — "E SE VOCÊ…" EP 1
// Mostra os 5 personagens (ANTONY, HELENA, BRUNO, CLARA, LARA), mãos POV do ANTONY,
// HUD com relógio em alerta, cartela de impacto e plano em modo simulação.
export const planos = [
  {
    t0: 0,
    t1: 4,
    local: 'sala',
    cam: { pos: [0, 1.58, -3.55], olhar: [0, 1.32, 0.6], movimento: 'respirar' },
    atores: [
      { nome: 'ANTONY', pos: [-0.1, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'HELENA', pos: [-1.55, 0, 0.85], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'BRUNO', pos: [1.45, 0, 0.85], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'CLARA', pos: [-2.65, 0, -0.1], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'LARA', pos: [2.6, 0, -0.1], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
    hud: {
      dia: '01/30',
      agua: '240 L',
      comida: '30 DIAS',
      pessoas: 4,
      extra: 'PONTE BLOQUEADA',
      simulacao: false,
    },
  },
  {
    t0: 4,
    t1: 8,
    local: 'varanda',
    cam: { pos: [0, 1.62, -10.8], olhar: [0, 1.38, -13.2], movimento: 'respirar' },
    atores: [
      { nome: 'CLARA', pos: [0, 0, -13.2], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
    hud: {
      dia: '01/30',
      agua: '240 L',
      comida: '30 DIAS',
      pessoas: 4,
      relogio: '00:30',
      alerta: true,
      extra: '5ª PESSOA NA PORTA',
      simulacao: false,
    },
  },
  {
    t0: 8,
    t1: 11,
    local: 'sala',
    cam: { pos: [0, 1.56, -2.1], olhar: [0, 1.46, 0.35], movimento: 'respirar' },
    atores: [
      { nome: 'ANTONY', pos: [0, 0, 0.25], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'HELENA', pos: [-1.35, 0, 0.75], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'nada' },
    cartela: 'E SE VOCÊ NÃO TIVESSE ABERTO?',
  },
  {
    t0: 11,
    t1: 16,
    local: 'garagem',
    cam: { pos: [13.8, -2.35, 6.2], olhar: [13.6, -2.95, 10.2], movimento: 'respirar' },
    atores: [
      { nome: 'BRUNO', pos: [13.5, -4, 10.6], pose: 'caido' },
      { nome: 'ANTONY', pos: [14.8, -4, 9.6], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'HELENA', pos: [12.3, -4, 9.2], pose: 'ajoelhado', olhaPara: 'camera' },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'nada' },
    hud: {
      dia: '09/30',
      agua: '168 L',
      comida: '21 DIAS',
      pessoas: 5,
      relogio: '00:15',
      alerta: true,
      extra: 'MONÓXIDO DE CARBONO',
      simulacao: true,
    },
  },
  {
    t0: 16,
    t1: 20,
    local: 'sala',
    cam: { pos: [0, 1.54, -2.25], olhar: [0, 1.42, 0.35], movimento: 'respirar' },
    atores: [
      { nome: 'ANTONY', pos: [0, 0, 0.2], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'CLARA', pos: [-1.05, 0, 0.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'LARA', pos: [1.05, 0, 0.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'HELENA', pos: [-1.95, 0, 1.05], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'BRUNO', pos: [1.95, 0, 1.05], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
    hud: {
      dia: '22/30',
      agua: '45 L',
      comida: '08 DIAS',
      pessoas: 5,
      relogio: '04:00',
      alerta: false,
      extra: 'POÇO ARTESIANO',
    },
  },
];

export const DURACAO = planos.at(-1).t1;
export function planoEm(t) {
  return planos.find((p) => t >= p.t0 && t < p.t1) || planos.at(-1);
}
