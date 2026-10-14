"""Reconstruit public/index.html à partir de src/ et du moteur.   Usage : python3 src/build.py   (depuis la racine du dépôt)"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
rd = lambda p: open(p, encoding='utf-8').read()
t = rd(f'{here}/template.html').replace('<script>\n/*MULTI*/', '<script src="config.js"></script>\n<script>\n/*MULTI*/', 1)
out = (t.replace('/*MULTI*/', 'window.__MULTI__ = true;').replace('/*ENGINE*/', rd(f'{root}/engine.js'))
        .replace('/*ASSETS*/', rd(f'{here}/assets.js')).replace('/*GAME*/', rd(f'{here}/game.js')))
os.makedirs(f'{root}/public', exist_ok=True)
open(f'{root}/public/index.html', 'w', encoding='utf-8').write(out)
print('public/index.html :', len(out) // 1024, 'Ko')
