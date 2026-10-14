"""Reconstruit public/index.html à partir de src/ et du moteur.   Usage : python3 src/build.py   (depuis la racine du dépôt)"""
import os, re, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
rd = lambda p: open(p, encoding='utf-8').read()
t = rd(f'{here}/template.html').replace('<script>\n/*MULTI*/', '<script src="config.js"></script>\n<script>\n/*MULTI*/', 1)
out = (t.replace('/*MULTI*/', 'window.__MULTI__ = true;').replace('/*ENGINE*/', rd(f'{root}/engine.js'))
        .replace('/*ASSETS*/', rd(f'{here}/assets.js')).replace('/*GAME*/', rd(f'{here}/game.js')))
os.makedirs(f'{root}/public', exist_ok=True)
# page autonome : il faut un vrai document (doctype + viewport), sinon le téléphone affiche une page de ~980 px de large, rétrécie
head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'
        '<meta name="theme-color" content="#0e0813"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}[hidden]{display:none!important}img{max-width:100%}@supports(height:100dvh){html,body{height:100dvh}}</style></head><body>')
m = re.search(r'<title>.*?</title>', out); ttl = m.group(0) if m else '<title>Dernier Sortilège</title>'
out = head.replace('</head>', ttl + '</head>') + out.replace(ttl, '', 1) + '</body></html>'
open(f'{root}/public/index.html', 'w', encoding='utf-8').write(out)
print('public/index.html :', len(out) // 1024, 'Ko')
