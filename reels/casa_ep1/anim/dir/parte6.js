// Parte 6: A TAÇA E O PORÃO (435.21s — 511.01s)
export const planos = [
  // [CENA: Cozinha] Pausa pós-batidas + Cartela Parte 6 (436.41–438.41) + início fala 107 MAYA
  {
    t0: 435.21,
    t1: 438.41,
    local: 'cozinha',
    cam: { pos: [9.4, 1.66, 0.9], olhar: [8.4, 1.45, 4.5], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [9.1, 0, 2.9], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [7.5, 0, 2.4], pose: 'assustado', rot: 0.3 },
      { nome: 'NINA', pos: [12.2, 0, 2.2], pose: 'em_pe', rot: -1.1 },
      { nome: 'GAEL', pos: [14.2, 0, 1.7], pose: 'em_pe', rot: -1.3 },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
  },
  // Fala 107 MAYA (final): "...alguma coisa bateu aí dentro!"
  {
    t0: 438.41,
    t1: 440.41,
    local: 'cozinha',
    cam: { pos: [10.4, 1.62, 1.6], olhar: [9.1, 1.54, 2.8], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [9.1, 0, 2.8], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [7.6, 0, 2.3], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.3, 0, 2.1], pose: 'em_pe', rot: -1.3 },
      { nome: 'GAEL', pos: [14.3, 0, 1.6], pose: 'em_pe', rot: -1.4 },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // Fala 108 LEO: "Escuta antes. A jarra só tem amora. Não tem amêndoa aqui." — POV cheirando/examinando a jarra de ponche na ilha
  {
    t0: 440.41,
    t1: 444.05,
    local: 'cozinha',
    cam: { pos: [10.8, 1.48, -1.25], olhar: [11.35, 1.18, 0.02], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [12.1, 0, 1.9], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [14.1, 0, 1.5], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [9.3, 0, 2.2], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [8.1, 0, 1.6], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'guardanapo' },
  },
  // Fala 109 NINA: "Eu falei! Não coloquei nada no ponche!"
  {
    t0: 444.05,
    t1: 447.10,
    local: 'cozinha',
    cam: { pos: [11.7, 1.64, -1.35], olhar: [12.1, 1.55, 1.75], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [12.1, 0, 1.75], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [14.0, 0, 1.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [9.4, 0, 2.1], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [8.2, 0, 1.5], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // Fala 110 LEO (pt1): "O veneno tava só na taça dourada. Só você, Nina..."
  {
    t0: 447.10,
    t1: 449.65,
    local: 'cozinha',
    cam: { pos: [11.2, 1.60, -1.45], olhar: [11.95, 1.45, 1.6], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [12.0, 0, 1.7], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [13.8, 0, 1.5], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [9.4, 0, 2.0], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [8.3, 0, 1.4], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
  },
  // Fala 110 LEO (pt2): "...ou você, Gael."
  {
    t0: 449.65,
    t1: 452.40,
    local: 'cozinha',
    cam: { pos: [12.7, 1.65, -1.35], olhar: [13.9, 1.55, 1.5], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [13.9, 0, 1.5], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [11.9, 0, 1.75], pose: 'em_pe', rot: 1.4 },
      { nome: 'MAYA', pos: [9.5, 0, 2.0], pose: 'assustado', rot: 1.3 },
      { nome: 'TINA', pos: [8.4, 0, 1.4], pose: 'em_pe', rot: 1.2 },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 111 GAEL: "Vai ficar acusando a gente enquanto tem alguém trancado aí dentro?"
  {
    t0: 452.40,
    t1: 456.00,
    local: 'cozinha',
    cam: { pos: [11.5, 1.63, 2.5], olhar: [13.8, 1.55, 1.5], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [13.8, 0, 1.5], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [10.5, 0, 2.2], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [9.1, 0, 2.8], pose: 'assustado', rot: 1.2 },
      { nome: 'TINA', pos: [8.5, 0, 1.6], pose: 'em_pe', rot: 1.4 },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
  },

  // [CENA: Porão] Fala 112 LEO: "Não tem ninguém aqui embaixo. Mas tá gelado demais..." — POV descendo e varrendo o porão empoeirado
  {
    t0: 456.00,
    t1: 459.95,
    local: 'porao',
    cam: { pos: [-0.8, -2.35, 6.2], olhar: [-1.5, -2.55, 11.8], movimento: 'andar' },
    atores: [
      { nome: 'TINA', pos: [-2.4, -4, 8.6], pose: 'assustado', rot: 0.4 },
      { nome: 'MAYA', pos: [1.8, -4, 8.9], pose: 'assustado', rot: -0.3 },
      { nome: 'NINA', pos: [0.5, -4, 8.2], pose: 'em_pe', rot: -0.2 },
      { nome: 'GAEL', pos: [2.9, -4, 9.2], pose: 'em_pe', rot: -0.7 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 113 TINA: "Como não tem ninguém se acabou de bater três vezes?!"
  {
    t0: 459.95,
    t1: 463.20,
    local: 'porao',
    cam: { pos: [-0.3, -2.38, 7.6], olhar: [-2.2, -2.44, 9.1], movimento: 'respirar' },
    atores: [
      { nome: 'TINA', pos: [-2.2, -4, 9.1], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [1.7, -4, 10.1], pose: 'assustado', rot: -1.3 },
      { nome: 'NINA', pos: [0.6, -4, 9.4], pose: 'em_pe', rot: -1.4 },
      { nome: 'GAEL', pos: [2.7, -4, 9.3], pose: 'em_pe', rot: -1.5 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 114 MAYA (pt1): "Maravilha... assassino lá em cima, fantasma aqui embaixo."
  {
    t0: 463.20,
    t1: 465.60,
    local: 'porao',
    cam: { pos: [-0.2, -2.36, 8.5], olhar: [1.7, -2.44, 10.2], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [1.7, -4, 10.2], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-2.1, -4, 9.3], pose: 'assustado', rot: 1.2 },
      { nome: 'NINA', pos: [0.5, -4, 11.2], pose: 'em_pe', rot: 2.3 },
      { nome: 'GAEL', pos: [2.9, -4, 9.2], pose: 'em_pe', rot: -0.9 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 114 MAYA (pt2): "Vamos subir, sério!"
  {
    t0: 465.60,
    t1: 467.95,
    local: 'porao',
    cam: { pos: [0.4, -2.42, 8.8], olhar: [1.7, -2.44, 10.2], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [1.7, -4, 10.2], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-2.1, -4, 9.4], pose: 'assustado', rot: 1.2 },
      { nome: 'NINA', pos: [0.4, -4, 11.3], pose: 'em_pe', rot: 2.1 },
      { nome: 'GAEL', pos: [2.9, -4, 9.2], pose: 'em_pe', rot: -1.0 },
    ],
    luz: 'apagao',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
  },
  // Fala 115 LEO: "Espera. Olha o quadro de disjuntores de perto." — POV caminhando até o quadro na parede esquerda
  {
    t0: 467.95,
    t1: 471.20,
    local: 'porao',
    cam: { pos: [-2.4, -2.35, 9.4], olhar: [-5.1, -2.42, 10.4], movimento: 'andar' },
    atores: [
      { nome: 'TINA', pos: [-1.5, -4, 11.1], pose: 'em_pe', rot: -1.3 },
      { nome: 'NINA', pos: [0.2, -4, 10.4], pose: 'em_pe', rot: -1.5 },
      { nome: 'MAYA', pos: [1.6, -4, 11.4], pose: 'assustado', rot: -1.4 },
      { nome: 'GAEL', pos: [2.1, -4, 9.4], pose: 'em_pe', rot: -1.4 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 116 GAEL: "Já falei que a chuva derrubou e eu religuei!"
  {
    t0: 471.20,
    t1: 474.15,
    local: 'porao',
    cam: { pos: [-0.3, -2.36, 9.8], olhar: [2.1, -2.44, 9.4], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [2.1, -4, 9.4], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [0.8, -4, 11.0], pose: 'em_pe', rot: 2.3 },
      { nome: 'MAYA', pos: [1.7, -4, 11.7], pose: 'assustado', rot: 2.8 },
      { nome: 'TINA', pos: [-1.6, -4, 11.2], pose: 'em_pe', rot: 1.9 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 117 LEO (pt1): "Não, Gael. O protetor de raio nem desarmou." — Close fechado no quadro e na chave geral vermelha
  {
    t0: 474.15,
    t1: 476.60,
    local: 'porao',
    cam: { pos: [-3.4, -2.45, 10.1], olhar: [-5.15, -2.55, 10.42], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [2.0, -4, 9.4], pose: 'em_pe', rot: -1.5 },
      { nome: 'NINA', pos: [0.5, -4, 10.8], pose: 'em_pe', rot: -1.5 },
      { nome: 'MAYA', pos: [1.7, -4, 11.8], pose: 'em_pe', rot: -1.4 },
      { nome: 'TINA', pos: [-1.5, -4, 11.2], pose: 'em_pe', rot: -1.3 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 117 LEO (pt2): "A chave foi abaixada na mão." — Lanterna volta para o rosto tenso de Gael
  {
    t0: 476.60,
    t1: 479.15,
    local: 'porao',
    cam: { pos: [0.0, -2.36, 9.2], olhar: [2.0, -2.44, 9.4], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [2.0, -4, 9.4], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'NINA', pos: [0.7, -4, 11.1], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [1.8, -4, 12.1], pose: 'em_pe', rot: 0.1 },
      { nome: 'TINA', pos: [-1.4, -4, 11.1], pose: 'em_pe', rot: 1.8 },
    ],
    luz: 'apagao',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
  },
  // Fala 118 NINA: "Ou seja, o assassino desligou a casa por dez minutos de propósito!"
  {
    t0: 479.15,
    t1: 483.10,
    local: 'porao',
    cam: { pos: [-0.8, -2.36, 9.4], olhar: [0.6, -2.44, 11.0], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [0.6, -4, 11.0], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [2.3, -4, 9.5], pose: 'em_pe', rot: -0.9 },
      { nome: 'MAYA', pos: [1.8, -4, 12.1], pose: 'em_pe', rot: 0.0 },
      { nome: 'TINA', pos: [-1.4, -4, 11.0], pose: 'em_pe', rot: 1.5 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 119 MAYA: "E olha a porta da adega! Poeira grossa intacta no trinco!" — Maya apontando com a adega empoeirada ao fundo
  {
    t0: 483.10,
    t1: 486.95,
    local: 'porao',
    cam: { pos: [-0.3, -2.35, 9.7], olhar: [1.4, -2.50, 12.8], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [0.4, -4, 12.1], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-1.2, -4, 10.6], pose: 'em_pe', rot: 1.1 },
      { nome: 'TINA', pos: [-1.8, -4, 9.6], pose: 'em_pe', rot: 0.9 },
      { nome: 'GAEL', pos: [2.7, -4, 9.7], pose: 'em_pe', rot: -0.8 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 120 TINA: "Você disse que veio buscar espumante, Gael, mas nem encostou na adega!"
  {
    t0: 486.95,
    t1: 490.45,
    local: 'porao',
    cam: { pos: [0.3, -2.36, 9.0], olhar: [-1.7, -2.44, 9.7], movimento: 'respirar' },
    atores: [
      { nome: 'TINA', pos: [-1.7, -4, 9.7], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-1.0, -4, 11.2], pose: 'em_pe', rot: 2.0 },
      { nome: 'MAYA', pos: [0.5, -4, 12.1], pose: 'em_pe', rot: 2.3 },
      { nome: 'GAEL', pos: [2.6, -4, 9.6], pose: 'assustado', rot: -1.5 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 121 GAEL (pt1): "Vocês ouviram as batidas!"
  {
    t0: 490.45,
    t1: 492.75,
    local: 'porao',
    cam: { pos: [0.5, -2.36, 9.7], olhar: [2.6, -2.44, 9.6], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [2.6, -4, 9.6], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-1.6, -4, 9.8], pose: 'em_pe', rot: 1.6 },
      { nome: 'NINA', pos: [-0.8, -4, 11.1], pose: 'em_pe', rot: 1.9 },
      { nome: 'MAYA', pos: [0.6, -4, 12.0], pose: 'assustado', rot: 2.1 },
    ],
    luz: 'apagao',
    fx: ['relampago'],
    maos: { segura: 'lanterna' },
  },
  // Fala 121 GAEL (pt2): "Eu juro, tinha outra pessoa aqui no escuro comigo!"
  {
    t0: 492.75,
    t1: 495.00,
    local: 'porao',
    cam: { pos: [1.3, -2.48, 8.2], olhar: [2.6, -2.42, 9.6], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [2.6, -4, 9.6], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-1.5, -4, 9.8], pose: 'em_pe', rot: 1.6 },
      { nome: 'NINA', pos: [-0.7, -4, 11.0], pose: 'em_pe', rot: 1.8 },
      { nome: 'MAYA', pos: [0.7, -4, 11.9], pose: 'assustado', rot: 2.0 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 122 NINA: "Que conveniente... justo quando o Caio bebia a taça que você levou."
  {
    t0: 495.00,
    t1: 498.90,
    local: 'porao',
    cam: { pos: [1.1, -2.35, 9.6], olhar: [-0.7, -2.44, 11.0], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-0.7, -4, 11.0], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-1.8, -4, 10.1], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [0.8, -4, 12.1], pose: 'em_pe', rot: -1.0 },
      { nome: 'GAEL', pos: [2.8, -4, 9.7], pose: 'em_pe', rot: -1.1 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },

  // [CENA: Porão e passagem da garagem] Fala 123 LEO (pt1): "Quieto todo mundo." — Lanterna baixa no cimento rumo à passagem
  {
    t0: 498.90,
    t1: 501.40,
    local: 'porao',
    cam: { pos: [1.6, -2.55, 9.9], olhar: [5.4, -3.75, 10.0], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [3.4, -4, 8.7], pose: 'em_pe', rot: 0.7 },
      { nome: 'NINA', pos: [0.5, -4, 10.9], pose: 'em_pe', rot: 1.5 },
      { nome: 'MAYA', pos: [2.2, -4, 11.5], pose: 'em_pe', rot: 1.8 },
      { nome: 'TINA', pos: [-0.8, -4, 10.2], pose: 'em_pe', rot: 1.5 },
    ],
    luz: 'apagao',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 123 LEO (pt2): "Olha essas pegadas úmidas indo pra garagem." — Atravessando a porta interna para a garagem
  {
    t0: 501.40,
    t1: 503.85,
    local: 'porao',
    cam: { pos: [4.9, -2.42, 9.45], olhar: [12.5, -3.3, 11.8], movimento: 'andar' },
    atores: [
      { nome: 'MAYA', pos: [7.2, -4, 9.4], pose: 'em_pe', rot: 1.2 },
      { nome: 'GAEL', pos: [3.6, -4, 8.5], pose: 'assustado', rot: 1.2 },
      { nome: 'NINA', pos: [2.5, -4, 10.5], pose: 'em_pe', rot: 1.5 },
      { nome: 'TINA', pos: [1.6, -4, 9.8], pose: 'em_pe', rot: 1.5 },
    ],
    luz: 'piscando',
    fx: [],
    maos: { segura: 'lanterna' },
  },

  // [CENA: Garagem] Fala 124 MAYA (pt1): "Levam direto até aquela caixa de ferramentas..."
  {
    t0: 503.85,
    t1: 506.05,
    local: 'garagem',
    cam: { pos: [12.6, -2.36, 8.6], olhar: [14.1, -2.48, 11.3], movimento: 'andar' },
    atores: [
      { nome: 'MAYA', pos: [13.9, -4, 11.1], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [12.5, -4, 11.7], pose: 'em_pe', rot: 0.8 },
      { nome: 'NINA', pos: [15.8, -4, 10.6], pose: 'em_pe', rot: -0.6 },
      { nome: 'GAEL', pos: [15.6, -4, 9.0], pose: 'assustado', rot: -0.8 },
    ],
    luz: 'piscando',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 124 MAYA (pt2): "...a trava tá forçada!" — Close na caixa de ferramentas vermelha e trava enferrujada na bancada
  {
    t0: 506.05,
    t1: 508.25,
    local: 'garagem',
    cam: { pos: [14.5, -2.52, 11.45], olhar: [15.05, -2.76, 13.15], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [13.4, -4, 11.7], pose: 'assustado', rot: 0.9 },
      { nome: 'TINA', pos: [12.6, -4, 11.9], pose: 'em_pe', rot: 1.0 },
      { nome: 'NINA', pos: [16.1, -4, 11.3], pose: 'em_pe', rot: -0.6 },
      { nome: 'GAEL', pos: [15.9, -4, 9.7], pose: 'assustado', rot: -0.4 },
    ],
    luz: 'piscando',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // Fala 125 LEO: "Gente... a caneta verdadeira do Caio tá aqui dentro!" — POV erguendo a caneta diante do grupo chocado
  {
    t0: 508.25,
    t1: 511.01,
    local: 'garagem',
    cam: { pos: [15.0, -2.42, 12.0], olhar: [13.7, -2.44, 9.8], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [14.1, -4, 9.5], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [13.4, -4, 10.4], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [12.6, -4, 10.7], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'NINA', pos: [15.2, -4, 9.6], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'piscando',
    fx: ['relampago'],
    maos: { segura: 'caneta' },
  },
];
