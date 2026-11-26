const ORANGE = '#f26a1b';
const MONO_FONT = '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Courier New", monospace';
const SANS_FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

const colors = {
  NARRADOR: '#f5f0e6',
  ANTONY: '#f26a1b',
  HELENA: '#d95b7a',
  BRUNO: '#5c95e8',
  CLARA: '#f0be46',
  LARA: '#b28cf2',
};

function roundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function wrapTextLines(ctx, text, maxWidth) {
  const rawParagraphs = String(text).split('\n');
  const lines = [];
  for (const para of rawParagraphs) {
    const tokens = para.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    let cur = tokens[0];
    for (let i = 1; i < tokens.length; i++) {
      const test = `${cur} ${tokens[i]}`;
      if (ctx.measureText(test).width <= maxWidth) {
        cur = test;
      } else {
        lines.push(cur);
        cur = tokens[i];
      }
    }
    lines.push(cur);
  }
  return lines;
}

function drawSimulationFilter(ctx, t, sourceCanvas) {
  ctx.save();
  if (sourceCanvas) {
    ctx.drawImage(sourceCanvas, 0, 0, 1920, 1080);
    // Dessatura o 3D para tom frio de simulação alternativa
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'hsl(212, 22%, 50%)';
    ctx.fillRect(0, 0, 1920, 1080);
    // Camada multiply azul-frio em todo o quadro
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(116, 168, 230, 0.86)';
    ctx.fillRect(0, 0, 1920, 1080);
    // Leve elevação azul-gelo nas sombras
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(14, 40, 74, 0.22)';
    ctx.fillRect(0, 0, 1920, 1080);
  } else {
    ctx.fillStyle = 'rgba(34, 82, 142, 0.42)';
    ctx.fillRect(0, 0, 1920, 1080);
  }
  ctx.restore();

  // Linhas sutis de varredura determinísticas + borda fria
  ctx.save();
  ctx.fillStyle = 'rgba(140, 205, 255, 0.045)';
  const offset = (t * 28) % 8;
  for (let y = offset; y < 1080; y += 8) {
    ctx.fillRect(0, y, 1920, 2);
  }
  ctx.strokeStyle = 'rgba(104, 188, 248, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1914, 1074);
  ctx.restore();
}

function drawSimulationBanner(ctx, t) {
  ctx.save();
  const w = 316;
  const h = 48;
  const x = (1920 - w) / 2;
  const y = 32;

  roundedRectPath(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(7, 20, 38, 0.88)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5ebcf8';
  ctx.stroke();

  // Ponto indicador pulsante determinístico
  const pulse = 0.55 + 0.45 * Math.sin(t * Math.PI * 3);
  ctx.beginPath();
  ctx.arc(x + 34, y + h / 2, 7, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(94, 196, 255, ${pulse.toFixed(3)})`;
  ctx.fill();

  ctx.fillStyle = '#e8f6ff';
  ctx.font = `bold 24px ${MONO_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S I M U L A Ç Ã O', x + w / 2 + 12, y + h / 2 + 1);
  ctx.restore();
}

function drawHudLeftPanel(ctx, t, hud) {
  const rows = [];
  if (hud.dia !== undefined && hud.dia !== null && hud.dia !== '') {
    rows.push({ label: 'DIA', value: String(hud.dia) });
  }
  if (hud.agua !== undefined && hud.agua !== null && hud.agua !== '') {
    rows.push({ label: 'ÁGUA', value: String(hud.agua) });
  }
  if (hud.comida !== undefined && hud.comida !== null && hud.comida !== '') {
    rows.push({ label: 'COMIDA', value: String(hud.comida) });
  }
  if (hud.pessoas !== undefined && hud.pessoas !== null && hud.pessoas !== '') {
    rows.push({ label: 'PESSOAS', value: String(hud.pessoas) });
  }
  const hasExtra = hud.extra !== undefined && hud.extra !== null && String(hud.extra).trim() !== '';
  if (!rows.length && !hasExtra) return;

  ctx.save();
  const x = 44;
  const y = 38;
  const padX = 20;
  const padY = 16;
  const labelColW = 114;
  const rowH = 34;
  const extraH = hasExtra ? 38 : 0;

  // Calcula largura ideal pelo conteúdo
  let maxValW = 120;
  ctx.font = `bold 24px ${MONO_FONT}`;
  for (const r of rows) {
    maxValW = Math.max(maxValW, ctx.measureText(r.value).width);
  }
  let extraW = 0;
  const extraText = hasExtra ? String(hud.extra).toUpperCase() : '';
  if (hasExtra) {
    ctx.font = `bold 18px ${MONO_FONT}`;
    extraW = ctx.measureText(extraText).width + 24;
  }

  const boxW = Math.min(520, Math.max(296, Math.ceil(Math.max(padX * 2 + labelColW + maxValW + 12, padX * 2 + extraW + 14))));
  const boxH = padY * 2 + rows.length * rowH + (rows.length && hasExtra ? 10 : 0) + extraH;

  // Fundo escuro translúcido com cantos suaves
  roundedRectPath(ctx, x, y, boxW, boxH, 10);
  ctx.fillStyle = hud.simulacao ? 'rgba(8, 18, 34, 0.80)' : 'rgba(9, 13, 20, 0.76)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = hud.simulacao ? 'rgba(94, 188, 248, 0.34)' : 'rgba(255, 255, 255, 0.14)';
  ctx.stroke();

  // Filete lateral laranja #f26a1b
  ctx.save();
  roundedRectPath(ctx, x, y, boxW, boxH, 10);
  ctx.clip();
  ctx.fillStyle = ORANGE;
  ctx.fillRect(x, y, 5, boxH);
  ctx.restore();

  // Linhas de dados (rótulo em laranja #f26a1b, valor monoespaçado branco)
  ctx.textBaseline = 'middle';
  let curY = y + padY + rowH * 0.5;
  for (const r of rows) {
    ctx.textAlign = 'left';
    ctx.font = `bold 18px ${MONO_FONT}`;
    ctx.fillStyle = ORANGE;
    ctx.fillText(r.label, x + padX + 4, curY);

    ctx.font = `bold 24px ${MONO_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.value, x + padX + labelColW, curY);
    curY += rowH;
  }

  // Campo extra opcional (ex: PONTE BLOQUEADA)
  if (hasExtra) {
    if (rows.length) {
      const divY = y + padY + rows.length * rowH + 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(x + padX, divY, boxW - padX * 2, 1.5);
    }
    const exY = y + boxH - padY - extraH * 0.42;
    const isAlert = !!hud.alerta;
    const blink = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    ctx.beginPath();
    ctx.arc(x + padX + 9, exY, 5, 0, Math.PI * 2);
    ctx.fillStyle = isAlert ? `rgba(255, 48, 62, ${(0.45 + blink * 0.55).toFixed(3)})` : ORANGE;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = `bold 18px ${MONO_FONT}`;
    ctx.fillStyle = isAlert ? '#ffd4d8' : '#e8eef5';
    ctx.fillText(extraText, x + padX + 24, exY + 1);
  }

  ctx.restore();
}

function drawHudClock(ctx, t, hud) {
  if (hud.relogio === undefined || hud.relogio === null || String(hud.relogio).trim() === '') return;

  ctx.save();
  const text = String(hud.relogio);
  const isAlert = !!hud.alerta;
  const wave = Math.sin(t * Math.PI * 4); // 2 piscadas por segundo, 100% determinístico
  const pulse = 0.5 + 0.5 * wave;
  const flashOn = wave >= 0;

  ctx.font = `bold 66px ${MONO_FONT}`;
  const textW = ctx.measureText(text).width;
  const padX = 28;
  const boxW = Math.max(246, Math.ceil(textW + padX * 2));
  const boxH = 114;
  const x = 1920 - 44 - boxW;
  const y = 38;

  // Caixa do relógio no canto superior direito
  roundedRectPath(ctx, x, y, boxW, boxH, 12);
  if (isAlert) {
    const rBg = Math.round(28 + pulse * 58);
    ctx.fillStyle = `rgba(${rBg}, 8, 12, 0.86)`;
  } else {
    ctx.fillStyle = hud.simulacao ? 'rgba(8, 18, 34, 0.82)' : 'rgba(9, 13, 20, 0.78)';
  }
  ctx.fill();

  ctx.lineWidth = isAlert ? 2.5 : 1.5;
  ctx.strokeStyle = isAlert
    ? `rgba(255, 42, 58, ${(0.55 + pulse * 0.45).toFixed(3)})`
    : 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  // Barra superior de destaque
  ctx.save();
  roundedRectPath(ctx, x, y, boxW, boxH, 12);
  ctx.clip();
  ctx.fillStyle = isAlert ? (flashOn ? '#ff2436' : '#8f121e') : ORANGE;
  ctx.fillRect(x, y, boxW, 5);
  ctx.restore();

  // Rótulo superior
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 17px ${MONO_FONT}`;
  if (isAlert) {
    ctx.fillStyle = flashOn ? '#ff4a58' : '#ffb0b8';
    ctx.fillText('● ALERTA · TEMPO', x + boxW / 2, y + 26);
  } else {
    ctx.fillStyle = ORANGE;
    ctx.fillText('TEMPO', x + boxW / 2, y + 26);
  }

  // Dígitos grandes do relógio
  ctx.font = `bold 66px ${MONO_FONT}`;
  if (isAlert) {
    ctx.shadowColor = '#ff1c30';
    ctx.shadowBlur = 10 + pulse * 18;
    ctx.fillStyle = flashOn ? '#ff2b3a' : '#ff9ca5';
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillText(text, x + boxW / 2, y + 76);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawCartela(ctx, t, plano) {
  const raw = plano?.cartela;
  if (raw === undefined || raw === null || String(raw).trim() === '') return;

  const text = String(raw).trim().toUpperCase();
  const elapsed = Math.max(0, t - Number(plano.t0 ?? 0));
  const u = Math.min(1, elapsed / 0.3); // zoom leve de 0,3 s
  const ease = 1 - Math.pow(1 - u, 3);
  const scale = 0.88 + 0.12 * ease;
  const alpha = Math.min(1, elapsed / 0.10);

  // Escurece o 3D em 50%
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.50)';
  ctx.fillRect(0, 0, 1920, 1080);

  // Aplica zoom suave centralizado em (960, 540)
  ctx.globalAlpha = alpha;
  ctx.translate(960, 540);
  ctx.scale(scale, scale);

  // Ajusta tamanho da fonte para ficar enorme mas nunca vazar das margens
  let fontSize = 106;
  const maxWidth = 1580;
  ctx.font = `900 ${fontSize}px ${SANS_FONT}`;
  let lines = wrapTextLines(ctx, text, maxWidth);
  if (lines.length > 2) {
    fontSize = 86;
    ctx.font = `900 ${fontSize}px ${SANS_FONT}`;
    lines = wrapTextLines(ctx, text, maxWidth);
  }
  if (lines.length > 3) {
    fontSize = 70;
    ctx.font = `900 ${fontSize}px ${SANS_FONT}`;
    lines = wrapTextLines(ctx, text, maxWidth);
  }

  const lineH = fontSize * 1.16;
  const totalH = lines.length * lineH;
  const startY = -totalH / 2 + lineH * 0.5 - 14;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  let maxLineW = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ly = startY + i * lineH;
    maxLineW = Math.max(maxLineW, ctx.measureText(line).width);

    // Contorno preto grosso + preenchimento branco puro
    ctx.lineWidth = Math.max(14, Math.round(fontSize * 0.18));
    ctx.strokeStyle = '#000000';
    ctx.strokeText(line, 0, ly);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, 0, ly);
  }

  // Linha laranja (#f26a1b) embaixo do texto
  const targetBarW = Math.max(300, Math.min(960, maxLineW * 0.72));
  const barW = targetBarW * (0.45 + 0.55 * ease);
  const barH = 10;
  const barY = startY + (lines.length - 1) * lineH + fontSize * 0.66;

  ctx.fillStyle = '#000000';
  ctx.fillRect(-barW / 2 - 3, barY - 3, barW + 6, barH + 6);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(-barW / 2, barY, barW, barH);

  ctx.restore();
}

function drawRotulo(ctx, t, plano) {
  const rotulo = plano?.rotulo;
  if (!rotulo || typeof rotulo !== 'object') return;
  const nome = String(rotulo.nome ?? '').trim();
  const funcao = String(rotulo.funcao ?? '').trim();
  if (!nome && !funcao) return;

  ctx.save();
  ctx.font = `bold 54px ${SANS_FONT}`;
  const nomeW = ctx.measureText(nome).width;
  ctx.font = `32px ${SANS_FONT}`;
  const funcaoW = ctx.measureText(funcao).width;
  const w = Math.min(720, Math.max(300, Math.ceil(Math.max(nomeW, funcaoW) + 72)));
  const h = 90;
  const y = 790;
  const u = Math.max(0, Math.min(1, (t - Number(plano.t0 ?? 0)) / 0.35));
  const ease = 1 - Math.pow(1 - u, 3);
  const x = -w + (56 + w) * ease;

  roundedRectPath(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(x, y, 7, h);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 54px ${SANS_FONT}`;
  ctx.fillText(nome, x + 28, y + 32, w - 48);
  ctx.fillStyle = '#d5d5d5';
  ctx.font = `32px ${SANS_FONT}`;
  ctx.fillText(funcao, x + 28, y + 70, w - 48);
  ctx.restore();
}

function drawCelular(ctx, texto) {
  const x = 700;
  const y = 90;
  const w = 520;
  const h = 900;
  const maxTextW = w - 80;
  const maxTextH = h - 140;

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, 42);
  ctx.fillStyle = '#111820';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#a9b4c0';
  ctx.stroke();

  let fontSize = 64;
  let lines;
  let lineH;
  do {
    ctx.font = `bold ${fontSize}px ${SANS_FONT}`;
    lines = wrapTextLines(ctx, texto, maxTextW);
    lineH = fontSize * 1.2;
    if (lines.length * lineH <= maxTextH || fontSize <= 32) break;
    fontSize -= 2;
  } while (true);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = y + h / 2 - (lines.length - 1) * lineH / 2;
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, startY + i * lineH, maxTextW));
  ctx.restore();
}

export function makeOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  const hideForQA = new URLSearchParams(location.search).has('qa');
  let words = [];
  let parts = [];

  const setData = (w, p) => {
    words = Array.isArray(w) ? w : [];
    parts = Array.isArray(p) ? p : [];
  };

  function draw(t, plano = {}, sourceCanvas = null) {
    ctx.clearRect(0, 0, 1920, 1080);
    if (hideForQA) return;

    const hud = plano?.hud && typeof plano.hud === 'object' ? plano.hud : null;
    const isSim = !!hud?.simulacao;
    const fx = Array.isArray(plano?.fx) ? plano.fx : [];

    // 1) Filtro azul-frio dessaturado em todo o quadro no modo simulação
    if (isSim) {
      drawSimulationFilter(ctx, t, sourceCanvas);
    }

    // 2) Vinheta cinematográfica discreta no topo e na base
    const v = ctx.createLinearGradient(0, 0, 0, 1080);
    v.addColorStop(0, isSim ? 'rgba(6, 18, 34, 0.55)' : '#0008');
    v.addColorStop(0.32, '#0000');
    v.addColorStop(0.78, '#0000');
    v.addColorStop(1, '#000b');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 1920, 1080);

    // 3) Cartela vinda de partes.json (compatibilidade quando não há plano.cartela)
    const hasCartela = plano?.cartela !== undefined && plano?.cartela !== null && String(plano.cartela).trim() !== '';
    if (!hasCartela) {
      const part = parts.find(
        (p) =>
          t >= Number(p.start ?? p.t0 ?? p.inicio) &&
          t < Number(p.start ?? p.t0 ?? p.inicio) + 2
      );
      if (part) {
        ctx.fillStyle = '#000b';
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = '#f4eadd';
        ctx.textAlign = 'center';
        ctx.font = `900 72px ${SANS_FONT}`;
        ctx.fillText(String(part.title ?? part.titulo ?? part.nome ?? '').toUpperCase(), 960, 555);
      }
    }

    // 4) Cartela do plano (texto enorme branco com contorno preto + linha laranja sobre 3D escurecido 50%)
    if (hasCartela) {
      drawCartela(ctx, t, plano);
    }

    // 5) HUD superior (painel esquerdo, relógio direito e tarja "SIMULAÇÃO" no topo)
    if (hud) {
      if (isSim) drawSimulationBanner(ctx, t);
      drawHudLeftPanel(ctx, t, hud);
      drawHudClock(ctx, t, hud);
    }

    // 6) Identificação do personagem acima das legendas
    drawRotulo(ctx, t, plano);

    // 7) Legendas palavra por palavra (mesma posição inferior — sem colisão com o HUD superior!)
    const active = words.filter((w) => t >= Number(w.start) && t <= Number(w.end));
    if (active.length) {
      const i = words.indexOf(active[0]);
      const chunk = words
        .slice(Math.max(0, i - 1), i + 3)
        .filter((w) => w.speaker === active[0].speaker);
      const speaker = String(active[0].speaker ?? '').toUpperCase();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = colors[speaker] ?? '#ddd';
      ctx.font = 'bold 30px Arial';
      ctx.fillText(speaker, 960, 895);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 55px Arial';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 14;
      ctx.fillText(chunk.map((w) => w.word).join(' '), 960, 965);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 8) FX adicionais opcionais
    if (fx.includes('mensagem_celular')) {
      if (typeof plano.celular === 'string') {
        drawCelular(ctx, plano.celular);
      } else {
        ctx.save();
        ctx.fillStyle = '#cceaff';
        ctx.font = '31px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('ALERTA VERMELHO · ISOLAMENTO 30 DIAS', 1240, 900);
        ctx.restore();
      }
    }

    if (plano?.especial === 'seguranca') {
      ctx.save();
      ctx.fillStyle = '#e5f3f6';
      ctx.font = `25px ${MONO_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('● REC  CAM COZINHA · 03:12', 55, hud ? 1035 : 75);
      for (let i = 0; i < 80; i++) {
        const y = (i * 131 + t * 29) % 1080;
        ctx.fillStyle = '#ffffff09';
        ctx.fillRect(0, y, 1920, 1);
      }
      ctx.restore();
    }
  }

  return { setData, draw };
}
