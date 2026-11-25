const colors = {
  LEO: '#8da876',
  CAIO: '#e4d8a1',
  NINA: '#dc8798',
  MAYA: '#e8bc48',
  GAEL: '#82a9ed',
  TINA: '#c7a3e2',
  SOFIA: '#c5f5ff',
};

export function makeOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  const hideForQA = new URLSearchParams(location.search).has('qa');
  let words = [];
  let parts = [];

  const setData = (w, p) => {
    words = Array.isArray(w) ? w : [];
    parts = Array.isArray(p) ? p : [];
  };

  function draw(t, plano) {
    ctx.clearRect(0, 0, 1920, 1080);
    if (hideForQA) return;

    const v = ctx.createLinearGradient(0, 0, 0, 1080);
    v.addColorStop(0, '#0008');
    v.addColorStop(0.35, '#0000');
    v.addColorStop(0.78, '#0000');
    v.addColorStop(1, '#000b');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 1920, 1080);

    if (t < 3) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f1e7d3';
      ctx.font = 'small-caps 68px Georgia';
      ctx.fillText('A CASA DA FALÉSIA · EP 1', 960, 150);
      ctx.fillStyle = '#e9c588';
      ctx.fillRect(830, 177, 260, 2);
    }

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
      ctx.font = '68px Georgia';
      ctx.fillText(String(part.title ?? part.titulo ?? part.nome ?? '').toUpperCase(), 960, 555);
    }

    const active = words.filter((w) => t >= Number(w.start) && t <= Number(w.end));
    if (active.length) {
      const i = words.indexOf(active[0]);
      const chunk = words
        .slice(Math.max(0, i - 1), i + 3)
        .filter((w) => w.speaker === active[0].speaker);
      const speaker = String(active[0].speaker ?? '').toUpperCase();
      ctx.textAlign = 'center';
      ctx.fillStyle = colors[speaker] ?? '#ddd';
      ctx.font = 'bold 30px Arial';
      ctx.fillText(speaker, 960, 895);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 55px Arial';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 14;
      ctx.fillText(chunk.map((w) => w.word).join(' '), 960, 965);
      ctx.shadowBlur = 0;
    }

    if (plano.fx.includes('mensagem_celular')) {
      ctx.fillStyle = '#cceaff';
      ctx.font = '31px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('A mesma taça. O mesmo dia. Desce no porão.', 1300, 900);
    }

    if (plano.especial === 'seguranca') {
      ctx.fillStyle = '#e5f3f6';
      ctx.font = '25px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('● REC  ARQUIVO 20', 55, 75);
      for (let i = 0; i < 80; i++) {
        const y = (i * 131 + t * 29) % 1080;
        ctx.fillStyle = '#ffffff09';
        ctx.fillRect(0, y, 1920, 1);
      }
    }
  }

  return { setData, draw };
}
