// Parte 4: A CHAVE E A SÉTIMA PESSOA (t = 251.60 até 358.95)
export const planos = [
  // === CENA 1: SALA COM LAREIRA — Silêncio tenso ao redor do corpo e a caneta azul ===
  // 251.60-254.00: pausa após descoberta da caneta de treino + cartela Parte 4 (252.8) + início fala 60 (GAEL)
  {
    t0: 251.6,
    t1: 254.0,
    local: 'sala',
    cam: { pos: [-0.35, 1.28, -1.55], olhar: [-2.15, 0.55, 1.45], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'guardanapo' },
  },
  // 254.00-256.60: GAEL (fala 60: "Sério? Ele apertou isso no escuro achando que ia se salvar?")
  {
    t0: 254.0,
    t1: 256.6,
    local: 'sala',
    cam: { pos: [-1.1, 1.62, -1.65], olhar: [-2.85, 1.52, -0.55], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 256.60-259.65: NINA (fala 61: "Como teve crise se não tinha amêndoa no ponche?")
  {
    t0: 256.6,
    t1: 259.65,
    local: 'sala',
    cam: { pos: [-0.15, 1.62, -1.05], olhar: [1.25, 1.52, 0.55], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 259.65-263.40: LEO (fala 62: "Alguém trocou a caneta e envenenou ele. Não foi acidente.") — caneta azul na mão POV
  {
    t0: 259.65,
    t1: 263.4,
    local: 'sala',
    cam: { pos: [-0.65, 1.52, -1.15], olhar: [-2.15, 0.95, 1.15], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'caneta' },
  },
  // 263.40-267.35: MAYA (fala 63: "E a vitrola parou bem nessa hora... que ótimo, festa inesquecível.") — vitrola ao fundo
  {
    t0: 263.4,
    t1: 267.35,
    local: 'sala',
    cam: { pos: [0.65, 1.6, -1.65], olhar: [2.85, 1.45, -0.8], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'apontando', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 267.35-271.00: LEO (fala 64: "Respira, Maya. Tenta ligar pra emergência. Alguém tem sinal?") — celular na mão POV
  {
    t0: 267.35,
    t1: 271.0,
    local: 'sala',
    cam: { pos: [0.25, 1.62, -2.35], olhar: [1.95, 1.48, -0.25], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'celular' },
  },
  // 271.00-273.85: MAYA (fala 65: "Zero barra. E o fixo da sala tá mudo.")
  {
    t0: 271.0,
    t1: 273.85,
    local: 'sala',
    cam: { pos: [1.35, 1.6, -1.95], olhar: [2.55, 1.52, -0.85], movimento: 'respirar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'ajoelhado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.9, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'nada' },
  },
  // 273.85-277.60: GAEL (fala 66: "Então vamos pegar o carro do Caio e descer pra estrada agora!")
  {
    t0: 273.85,
    t1: 277.6,
    local: 'sala',
    cam: { pos: [-0.45, 1.65, -2.25], olhar: [-2.45, 1.5, -0.65], movimento: 'andar' },
    atores: [
      { nome: 'CAIO', pos: [-1.25, 0, 1.75], pose: 'caido' },
      { nome: 'TINA', pos: [-1.85, 0, 0.75], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-2.5, 0, -0.65], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [1.25, 0, 0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [2.55, 0, -0.85], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },

  // === CENA 2: GARAGEM — Quadro de chaves vazio e a jaqueta encharcada de Maya ===
  // 277.60-281.45: GAEL (fala 67: "Cadê a chave?! Ele sempre pendura nesse gancho!") — quadro de chaves vazio na parede direita
  {
    t0: 277.6,
    t1: 281.45,
    local: 'garagem',
    cam: { pos: [13.85, -2.35, 7.25], olhar: [16.35, -2.42, 9.6], movimento: 'andar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 281.45-285.15: TINA (fala 68: "Sumiu... tiraram antes do apagão. A gente tá preso aqui.")
  {
    t0: 281.45,
    t1: 285.15,
    local: 'garagem',
    cam: { pos: [14.35, -2.38, 9.25], olhar: [14.75, -2.48, 11.45], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'piscando',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 285.15-288.85: NINA (fala 69: "Gritar não ajuda. Quem queria impedir a gente de sair?")
  {
    t0: 285.15,
    t1: 288.85,
    local: 'garagem',
    cam: { pos: [14.15, -2.36, 9.35], olhar: [12.65, -2.46, 10.95], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 288.85-291.70: LEO (fala 70: "Maya, para um segundo. Olha sua jaqueta amarela.") — lanterna ilumina jaqueta
  {
    t0: 288.85,
    t1: 291.7,
    local: 'garagem',
    cam: { pos: [14.35, -2.38, 8.95], olhar: [12.35, -2.62, 8.55], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // 291.70-293.80: MAYA (fala 71: "O que tem minha jaqueta?")
  {
    t0: 291.7,
    t1: 293.8,
    local: 'garagem',
    cam: { pos: [13.75, -2.38, 7.85], olhar: [12.35, -2.44, 8.55], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 293.80-296.20: LEO (fala 72 pt 1: "Tá encharcada. Por que você saiu na chuva...")
  {
    t0: 293.8,
    t1: 296.2,
    local: 'garagem',
    cam: { pos: [13.95, -2.36, 7.65], olhar: [12.35, -2.5, 8.55], movimento: 'andar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'lanterna' },
  },
  // 296.20-298.50: LEO (fala 72 pt 2: "...durante o apagão?") — reação dura de Tina e Gael
  {
    t0: 296.2,
    t1: 298.5,
    local: 'garagem',
    cam: { pos: [13.15, -2.38, 9.25], olhar: [15.1, -2.45, 10.6], movimento: 'respirar' },
    atores: [
      { nome: 'GAEL', pos: [15.85, -4, 9.65], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [14.75, -4, 11.45], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [12.65, -4, 10.95], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [12.35, -4, 8.55], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },

  // === CENA 3: CORREDOR E ESCADA — Maya pressionada e a revelação da foto ===
  // 298.50-302.45: MAYA (fala 73: "Fui até a piscina chorar! O Caio tava me sufocando lá dentro!")
  {
    t0: 298.5,
    t1: 302.45,
    local: 'escada',
    cam: { pos: [-11.3, 1.6, -0.85], olhar: [-12.1, 1.48, 1.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-10.4, 0, 1.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'nada' },
  },
  // 302.45-305.25: TINA (fala 74: "Conta logo que ele descobriu seu perfil anônimo, Maya!")
  {
    t0: 302.45,
    t1: 305.25,
    local: 'escada',
    cam: { pos: [-10.9, 1.6, -1.05], olhar: [-9.2, 1.5, 0.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-10.4, 0, 1.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 305.25-307.60: LEO (fala 75: "Que perfil anônimo? Do que vocês tão falando?")
  {
    t0: 305.25,
    t1: 307.6,
    local: 'escada',
    cam: { pos: [-11.0, 1.62, -2.55], olhar: [-10.65, 1.48, 0.95], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-10.4, 0, 1.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'celular' },
  },
  // 307.60-310.00: TINA (fala 76 pt 1: "A conta que vazou o escândalo dos meus pais.")
  {
    t0: 307.6,
    t1: 310.0,
    local: 'escada',
    cam: { pos: [-10.45, 1.58, -0.85], olhar: [-9.2, 1.52, 0.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-10.4, 0, 1.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 310.00-312.45: TINA (fala 76 pt 2: "Ele rastreou até o notebook dela.")
  {
    t0: 310.0,
    t1: 312.45,
    local: 'escada',
    cam: { pos: [-10.0, 1.58, -1.25], olhar: [-9.2, 1.5, 0.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-10.4, 0, 1.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 312.45-315.80: MAYA (fala 77: "Eu só expus o que eles escondiam! Mas não matei ninguém!")
  {
    t0: 312.45,
    t1: 315.8,
    local: 'escada',
    cam: { pos: [-11.55, 1.58, -0.35], olhar: [-12.1, 1.5, 1.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-10.4, 0, 1.55], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'nada' },
  },
  // 315.80-319.05: GAEL (fala 78: "Mesmo assim, você sumiu no escuro por dez minutos!")
  {
    t0: 315.8,
    t1: 319.05,
    local: 'escada',
    cam: { pos: [-11.35, 1.62, -1.65], olhar: [-13.4, 1.52, -0.55], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-11.0, 0.9, 3.5], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 319.05-322.90: MAYA (fala 79: "Quando voltei pro corredor, disparei o flash da câmera pra escada!")
  {
    t0: 319.05,
    t1: 322.9,
    local: 'escada',
    cam: { pos: [-10.75, 1.6, -0.45], olhar: [-12.1, 1.5, 1.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-11.0, 0.9, 3.5], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 322.90-325.00: LEO (fala 80: "Mostra essa foto agora.") — mão POV segurando a foto instantânea
  {
    t0: 322.9,
    t1: 325.0,
    local: 'escada',
    cam: { pos: [-11.2, 1.6, -0.65], olhar: [-12.1, 1.48, 1.35], movimento: 'andar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'guardanapo' },
  },
  // 325.00-327.30: MAYA (fala 81: "Tá revelando... olha ali nos degraus!")
  {
    t0: 325.0,
    t1: 327.3,
    local: 'escada',
    cam: { pos: [-11.15, 1.56, 0.1], olhar: [-12.1, 1.5, 1.35], movimento: 'respirar' },
    atores: [
      { nome: 'MAYA', pos: [-12.1, 0, 1.35], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.2, 0, 0.35], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.4, 0, -0.55], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'guardanapo' },
  },
  // 327.30-331.25: LEO (fala 82: "Alguém de suéter vinho subindo com um celular aceso... Nina!") — FLASH DA FOTO NA ESCADA
  {
    t0: 327.3,
    t1: 331.25,
    local: 'escada',
    cam: { pos: [-11.0, 2.15, 2.55], olhar: [-11.0, 2.65, 5.0], movimento: 'geral' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'SOFIA', pos: [-11.6, 4.0, 9.2], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'apagao',
    fx: ['flash'],
    maos: { segura: 'nada' },
    especial: 'geral',
  },

  // === CENA 4: ESCADA — Confronto com Nina e a revelação da SÉTIMA PESSOA ===
  // 331.25-333.65: Todos se viram para Nina nos degraus + início fala 83 (GAEL)
  {
    t0: 331.25,
    t1: 333.65,
    local: 'escada',
    cam: { pos: [-11.0, 1.65, -1.65], olhar: [-11.0, 2.35, 3.6], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-12.6, 0, 0.8], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, -0.8], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'guardanapo' },
  },
  // 333.65-336.05: GAEL (fala 83: "Era você lá em cima! Por que mentiu, Nina?")
  {
    t0: 333.65,
    t1: 336.05,
    local: 'escada',
    cam: { pos: [-11.1, 1.6, -0.75], olhar: [-12.6, 1.5, 0.8], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-12.6, 0, 0.8], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, -0.8], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 336.05-339.10: NINA (fala 84: "Peguei o celular do Caio porque vi a Tina subir antes!")
  {
    t0: 336.05,
    t1: 339.1,
    local: 'escada',
    cam: { pos: [-11.0, 1.75, 2.55], olhar: [-11.0, 2.85, 5.0], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-12.6, 0, 0.8], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, -0.8], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 339.10-341.15: TINA (fala 85: "Mentira sua!")
  {
    t0: 339.1,
    t1: 341.15,
    local: 'escada',
    cam: { pos: [-10.85, 1.58, -0.15], olhar: [-9.6, 1.5, 1.1], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-12.6, 0, 0.8], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'apontando', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, -0.8], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'nada' },
  },
  // 341.15-345.05: NINA (fala 86: "Olha o quarto revirado! E Leo... tinha um áudio seu aberto na tela.")
  {
    t0: 341.15,
    t1: 345.05,
    local: 'escada',
    cam: { pos: [-10.35, 1.95, 2.95], olhar: [-11.0, 2.9, 5.0], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-12.6, 0, 0.8], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, -0.8], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'nada' },
  },
  // 345.05-348.95: LEO (fala 87: "Espera... esquece o quarto! Olha o canto superior dessa foto!") — aproxima foto na luz
  {
    t0: 345.05,
    t1: 348.95,
    local: 'escada',
    cam: { pos: [-10.85, 1.58, -2.15], olhar: [-11.85, 1.48, -0.45], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'em_pe', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-12.6, 0, 0.8], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, -0.8], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: [],
    maos: { segura: 'guardanapo' },
  },
  // 348.95-352.00: MAYA (fala 88 pt 1: "Meu Deus... tem outra pessoa atrás de você, Nina!") — IMPACTO: FLASH DA FOTO COM SOFIA NO TOPO
  {
    t0: 348.95,
    t1: 352.0,
    local: 'escada',
    cam: { pos: [-11.0, 1.75, 1.25], olhar: [-11.0, 3.65, 6.8], movimento: 'geral' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'SOFIA', pos: [-11.35, 4.0, 9.0], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'apagao',
    fx: ['flash'],
    maos: { segura: 'nada' },
    especial: 'geral',
  },
  // 352.00-355.00: MAYA (fala 88 pt 2: "Uma garota de vestido branco!") — CLOSE DE IMPACTO NA SÉTIMA PESSOA
  {
    t0: 352.0,
    t1: 355.0,
    local: 'escada',
    cam: { pos: [-10.95, 5.25, 6.45], olhar: [-11.2, 5.3, 9.0], movimento: 'geral' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'SOFIA', pos: [-11.2, 4.0, 9.0], pose: 'em_pe', olhaPara: 'camera' },
    ],
    luz: 'apagao',
    fx: ['flash', 'relampago'],
    maos: { segura: 'nada' },
    especial: 'geral',
  },
  // 355.00-358.95: TINA (fala 89: "Eu tô de roxo... a gente só trouxe seis pessoas pra essa casa!") — gancho final da Parte 4
  {
    t0: 355.0,
    t1: 358.95,
    local: 'escada',
    cam: { pos: [-10.65, 1.58, -0.75], olhar: [-9.75, 1.5, 1.1], movimento: 'respirar' },
    atores: [
      { nome: 'NINA', pos: [-11.0, 1.4, 5.0], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'GAEL', pos: [-13.0, 0, 1.4], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'TINA', pos: [-9.6, 0, 1.1], pose: 'assustado', olhaPara: 'camera' },
      { nome: 'MAYA', pos: [-12.1, 0, 1.5], pose: 'assustado', olhaPara: 'camera' },
    ],
    luz: 'normal',
    fx: ['relampago'],
    maos: { segura: 'nada' },
  },
];
