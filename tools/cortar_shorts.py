#!/usr/bin/env python3
"""uso: cortar_shorts.py video.mp4 clips.json pasta_saida "RÓTULO DA SÉRIE"  -> short_NN.mp4 verticais + titulos.txt"""
import sys, json, subprocess, os, textwrap
from concurrent.futures import ThreadPoolExecutor
SRC, J, OUT, LAB = sys.argv[1:5]; os.makedirs(OUT, exist_ok=True)
S = json.load(open(J)); FF = os.environ.get('FFMPEG', os.path.expanduser('~/.local/bin/ffmpeg')); F = os.environ.get('FONTE', '/System/Library/Fonts/Supplemental/Arial Black.ttf')
def dt(txt, size, color, y, border, bc='#0b0b10'):
    p = f'/tmp/sh_{abs(hash((txt, y)))}.txt'; open(p, 'w').write(txt)
    return f"drawtext=fontfile='{F}':textfile={p}:fontsize={size}:fontcolor={color}:borderw={border}:bordercolor={bc}:x=(w-text_w)/2:y={y}"
def run(i, x):
    a = max(0, x['inicio'] - 0.15); d = x['fim'] - a + 0.35
    linhas = textwrap.wrap(x['texto_tela'], 16)
    txt = [dt(f'{LAB} · PARTE {i}', 34, 'white', 220, 6)] + [dt(l, 86, '#ffd84a', 300 + k * 100, 10) for k, l in enumerate(linhas)]
    txt += [dt('VÍDEO COMPLETO', 64, 'white', 1480, 9, '#c62828'), dt('NO CANAL', 64, 'white', 1560, 9, '#c62828')]
    vf = ("[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.18[b];"
          "[fg]scale=1400:-2,crop=1080:ih[f];[b][f]overlay=(W-w)/2:(H-h)/2-40," + ','.join(txt) + f",fade=t=in:d=0.25,fade=t=out:st={d-0.35}:d=0.35[v]")
    out = os.path.join(OUT, f'short_{i:02d}.mp4')
    subprocess.run([FF, '-v', 'error', '-y', '-ss', f'{a:.2f}', '-t', f'{d:.2f}', '-i', SRC, '-filter_complex', vf, '-map', '[v]', '-map', '0:a', '-af', f'afade=t=in:d=0.2,afade=t=out:st={d-0.4}:d=0.4', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], check=True)
with ThreadPoolExecutor(3) as ex: list(ex.map(lambda p: run(*p), enumerate(S, 1)))
with open(os.path.join(OUT, 'titulos.txt'), 'w') as f:
    for i, x in enumerate(S, 1): f.write(f"PARTE {i} — short_{i:02d}.mp4 ({x['fim']-x['inicio']:.0f}s)\nTítulo: {x['titulo']}\nDescrição: {x['descricao']}\n\n")
print('ok', len(S))
