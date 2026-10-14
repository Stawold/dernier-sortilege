(function () {
  'use strict';
  const E = window.DSEngine, T = window.THREE;
  const N = E.N, K = E.K;
  const C = 4, WH = 3.8, WT = 0.3, WW = C + WT, EYE = 1.62;
  const TAU = Math.PI * 2;
  const $ = (s) => document.querySelector(s);
  const ROBES = ['#d9b24c', '#c0314a', '#2f66c8', '#2f9a68', '#8a45c4', '#e0782a', '#27a2aa', '#b9b9cc', '#e56aa0', '#9ccc3c', '#a8643c', '#5fb4e8'];
  const ROBE_NAMES = ['Or', 'Rubis', 'Saphir', 'Émeraude', 'Améthyste', 'Ambre', 'Turquoise', 'Argent', 'Quartz rose', 'Péridot', 'Cuivre', 'Azur'];
  const NAMES = ['Aldéric', 'Morwenna', 'Balthazar', 'Isolde', 'Octavius', 'Séraphine', 'Thaddée', 'Gwendoline', 'Mérovée', 'Ysolde', 'Bastien'];
  const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp01 = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const cc = (x, y) => ({ x: x * C + C / 2, z: y * C + C / 2 });
  const deltaF = (f0, f1) => ((f1 - f0 + 5) % 4) - 1;
  const yawFor = (f, cur) => YAW[f] + Math.round((cur - YAW[f]) / TAU) * TAU;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ================= textures dessinées au canvas ================= */
  /* images intégrées (tableaux, pierre, marbre, bois, tapis) : décodées avant la construction des textures */
  const IMGS = {};
  function loadImages() {
    return Promise.all(Object.keys(IMG_B64).map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IMGS[k] = im; res(); };
      im.onerror = () => res();
      im.src = 'data:image/jpeg;base64,' + IMG_B64[k];
    })));
  }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }
  function grain(g, w, h, amt) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }
  function starPath(g, cx, cy, R, r, n) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r : R;
      g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }
  function goldGrad(g, x0, y0, x1, y1) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#f6dc8e'); gr.addColorStop(0.35, '#b88a2e'); gr.addColorStop(0.7, '#f1d07a'); gr.addColorStop(1, '#8a6420');
    return gr;
  }
  function drawStone(g, x0, y0, w, h) {
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.fillStyle = '#1a1310'; g.fillRect(x0, y0, w, h);
    const rowH = 45; let row = 0;
    for (let y = y0; y < y0 + h; y += rowH, row++) {
      let xx = x0 - (row % 2 ? 55 : 0) - rnd(0, 20);
      while (xx < x0 + w) {
        const bw = rnd(72, 124), hue = rnd(22, 36), l = rnd(33, 43);
        const gr = g.createLinearGradient(xx, y, xx, y + rowH);
        gr.addColorStop(0, 'hsl(' + hue + ',10%,' + (l + 6) + '%)');
        gr.addColorStop(1, 'hsl(' + hue + ',11%,' + (l - 7) + '%)');
        g.fillStyle = gr; g.fillRect(xx + 1.5, y + 1.5, bw - 3, rowH - 3);
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,' + rnd(0.05, 0.16) + ')'; g.fillRect(xx + rnd(2, bw - 8), y + rnd(2, rowH - 6), rnd(2, 7), rnd(1, 3)); }
        xx += bw;
      }
    }
    g.restore();
  }
  function stoneBase(g, x0, y0, w, h) {
    const im = IMGS.stone;
    if (!im) { drawStone(g, x0, y0, w, h); return; }
    const sw = Math.round(w * 0.88), sh = Math.round(h * 0.88), sx = rnd(0, im.width - sw), sy = rnd(0, im.height - sh);
    g.drawImage(im, sx, sy, sw, sh, x0, y0, w, h);
    g.fillStyle = 'rgba(26,12,38,.34)'; g.fillRect(x0, y0, w, h);   // ton un peu plus sombre et froid, pour garder l'ambiance
  }
  function drawCrown(g, W) {
    const gr = g.createLinearGradient(0, 0, 0, 28); gr.addColorStop(0, '#120b08'); gr.addColorStop(1, '#2b1a10');
    g.fillStyle = gr; g.fillRect(0, 0, W, 28);
    g.fillStyle = goldGrad(g, 0, 0, W, 0); g.fillRect(0, 24, W, 4);
  }
  function drawWainscot(g, W, top, h) {
    if (IMGS.wood) {
      const im = IMGS.wood, sy = rnd(0, im.height - h);
      g.drawImage(im, 0, sy, im.width, h, 0, top, W, h);
      g.fillStyle = 'rgba(20,8,6,.22)'; g.fillRect(0, top, W, h);
      g.fillStyle = '#1c0f08'; g.fillRect(0, top + h - 24, W, 24);
      g.fillStyle = goldGrad(g, 0, 0, W, 0); g.fillRect(0, top + h - 26, W, 2.5);
      g.fillStyle = goldGrad(g, 0, 0, W, 0); g.fillRect(0, top - 13, W, 13);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, top, W, 5);
      return;
    }
    const gr = g.createLinearGradient(0, top, 0, top + h); gr.addColorStop(0, '#46291a'); gr.addColorStop(1, '#2a160c');
    g.fillStyle = gr; g.fillRect(0, top, W, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,200,140') + ',' + rnd(0.03, 0.09) + ')'; g.fillRect(rnd(0, W), top, rnd(0.6, 1.6), h); }
    const n = 4, gap = 12, pw = (W - gap * (n + 1)) / n, py = top + 22, ph = h - 56;
    for (let i = 0; i < n; i++) {
      const px = gap + i * (pw + gap);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(px - 3, py - 3, pw + 6, ph + 6);
      const pg = g.createLinearGradient(px, py, px + pw, py + ph); pg.addColorStop(0, '#5a3623'); pg.addColorStop(1, '#3a2012');
      g.fillStyle = pg; g.fillRect(px, py, pw, ph);
      g.strokeStyle = 'rgba(224,176,74,.6)'; g.lineWidth = 1.6; g.strokeRect(px + 9.5, py + 9.5, pw - 19, ph - 19);
    }
    g.fillStyle = '#1c0f08'; g.fillRect(0, top + h - 24, W, 24);
    g.fillStyle = goldGrad(g, 0, 0, W, 0); g.fillRect(0, top + h - 26, W, 2.5);
    g.fillStyle = goldGrad(g, 0, 0, W, 0); g.fillRect(0, top - 13, W, 13);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, top, W, 5);
  }
  function drawFrame(g, x, y, w, h, t) {
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 4, y - 2, w + 8, h + 10);
    g.fillStyle = goldGrad(g, x, y, x + w, y + h); g.fillRect(x, y, w, h);
    g.fillStyle = '#2a1a0c'; g.fillRect(x + t * 0.5, y + t * 0.5, w - t, h - t);
    g.strokeStyle = '#f7dd8e'; g.lineWidth = 1.5; g.strokeRect(x + t * 0.5 + 0.5, y + t * 0.5 + 0.5, w - t - 1, h - t - 1);
    g.fillStyle = '#f7dd8e';
    [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]].forEach((p) => { g.beginPath(); g.arc(p[0], p[1], 3.2, 0, TAU); g.fill(); });
    return [x + t, y + t, w - 2 * t, h - 2 * t];
  }
  // tableau : l'image fournie est recadrée pour remplir l'intérieur du cadre doré ; repli sur les peintures dessinées
  function artFrame(g, x, y, w, h, idx) {
    const f = drawFrame(g, x, y, w, h, 14), im = IMGS['art' + idx];
    if (!im) { paint(g, idx % 4, f[0], f[1], f[2], f[3]); return; }
    const ar = f[2] / f[3], sar = im.width / im.height;
    let sw = im.width, sh = im.height;
    if (sar > ar) sw = im.height * ar; else sh = im.width / ar;
    g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, f[0], f[1], f[2], f[3]);
    const vg = g.createRadialGradient(f[0] + f[2] / 2, f[1] + f[3] / 2, f[3] * 0.35, f[0] + f[2] / 2, f[1] + f[3] / 2, f[3] * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.38)');
    g.fillStyle = vg; g.fillRect(f[0], f[1], f[2], f[3]);
  }
  function paint(g, kind, ix, iy, iw, ih) {
    g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
    if (kind === 0) {
      let gr = g.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, '#0b1034'); gr.addColorStop(0.62, '#3a2a6a'); gr.addColorStop(1, '#c9794a');
      g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
      for (let i = 0; i < 46; i++) { g.fillStyle = 'rgba(255,240,200,' + rnd(0.4, 1) + ')'; g.fillRect(ix + rnd(0, iw), iy + rnd(0, ih * 0.6), 1.6, 1.6); }
      const mx = ix + iw * 0.76, my = iy + ih * 0.24, mr = ih * 0.1;
      gr = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2); gr.addColorStop(0, 'rgba(255,244,200,.55)'); gr.addColorStop(1, 'rgba(255,244,200,0)');
      g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
      g.fillStyle = '#f6ecc4'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
      g.fillStyle = '#150c20'; g.beginPath(); g.moveTo(ix, iy + ih);
      for (let i = 0; i <= iw; i += 8) g.lineTo(ix + i, iy + ih * 0.8 + Math.sin(i * 0.03) * ih * 0.05);
      g.lineTo(ix + iw, iy + ih); g.fill();
      const cx = ix + iw * 0.3, by = iy + ih * 0.82;
      g.fillStyle = '#0d0716';
      g.fillRect(cx - 26, by - 50, 52, 54); g.fillRect(cx - 40, by - 70, 16, 74); g.fillRect(cx + 24, by - 86, 16, 90);
      [[cx - 40, by - 70, 16], [cx + 24, by - 86, 16]].forEach((t) => { g.beginPath(); g.moveTo(t[0] - 3, t[1]); g.lineTo(t[0] + t[2] / 2, t[1] - 24); g.lineTo(t[0] + t[2] + 3, t[1]); g.fill(); });
      g.fillStyle = '#ffd27a';
      [[cx - 8, by - 36], [cx + 28, by - 66], [cx - 36, by - 52], [cx + 30, by - 40]].forEach((p) => g.fillRect(p[0], p[1], 5, 8));
    } else if (kind === 1) {
      let gr = g.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, '#f0b36a'); gr.addColorStop(0.55, '#f6dba0'); gr.addColorStop(0.56, '#2a6a76'); gr.addColorStop(1, '#0f3a48');
      g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
      const hy = iy + ih * 0.56;
      [['#5a4670', 0.34, 0.22], ['#3a2c52', 0.5, 0.3], ['#241a36', 0.7, 0.2]].forEach((m, k) => {
        g.fillStyle = m[0]; g.beginPath(); g.moveTo(ix, hy);
        for (let i = 0; i <= 5; i++) { g.lineTo(ix + iw * (i / 5 + (k - 1) * 0.04), hy - ih * (i % 2 ? m[2] : m[1] * 0.32)); }
        g.lineTo(ix + iw, hy); g.fill();
      });
      for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(255,230,170,' + rnd(0.1, 0.35) + ')'; g.fillRect(ix + rnd(0, iw), hy + rnd(2, ih * 0.4), rnd(8, 36), 1.5); }
    } else if (kind === 2) {
      g.fillStyle = '#16342f'; g.fillRect(ix, iy, iw, ih);
      const gr = g.createRadialGradient(ix + iw / 2, iy + ih * 0.4, 4, ix + iw / 2, iy + ih * 0.4, ih * 0.8); gr.addColorStop(0, 'rgba(255,214,140,.38)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
      g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
      const cx = ix + iw / 2, cy = iy + ih * 0.5;
      g.fillStyle = '#5a2a78'; g.beginPath(); g.moveTo(cx - iw * 0.34, iy + ih); g.lineTo(cx - iw * 0.16, cy + ih * 0.1); g.lineTo(cx + iw * 0.16, cy + ih * 0.1); g.lineTo(cx + iw * 0.34, iy + ih); g.fill();
      g.fillStyle = '#e7c9a0'; g.beginPath(); g.arc(cx, cy - ih * 0.02, iw * 0.15, 0, TAU); g.fill();
      g.fillStyle = '#ece8dc'; g.beginPath(); g.moveTo(cx - iw * 0.14, cy + ih * 0.02); g.lineTo(cx, cy + ih * 0.36); g.lineTo(cx + iw * 0.14, cy + ih * 0.02); g.fill();
      g.fillStyle = '#3a1c52'; g.beginPath(); g.moveTo(cx - iw * 0.26, cy - ih * 0.1); g.lineTo(cx - iw * 0.02, cy - ih * 0.46); g.lineTo(cx + iw * 0.06, cy - ih * 0.5); g.lineTo(cx + iw * 0.26, cy - ih * 0.1); g.closePath(); g.fill();
      g.fillStyle = '#d9b24c'; g.fillRect(cx - iw * 0.26, cy - ih * 0.13, iw * 0.52, ih * 0.03);
      g.fillStyle = '#2a2018'; g.fillRect(cx - iw * 0.08, cy - ih * 0.04, 4, 4); g.fillRect(cx + iw * 0.04, cy - ih * 0.04, 4, 4);
    } else {
      g.fillStyle = '#241418'; g.fillRect(ix, iy, iw, ih);
      g.fillStyle = '#4a2a1a'; g.fillRect(ix, iy + ih * 0.72, iw, ih * 0.28);
      const gr = g.createRadialGradient(ix + iw * 0.62, iy + ih * 0.5, 4, ix + iw * 0.62, iy + ih * 0.5, ih * 0.7); gr.addColorStop(0, 'rgba(255,190,90,.5)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
      g.fillStyle = '#6fe0c0'; g.beginPath(); g.arc(ix + iw * 0.3, iy + ih * 0.62, iw * 0.1, 0, TAU); g.fill();
      g.fillStyle = '#c8b6a0'; g.fillRect(ix + iw * 0.3 - 5, iy + ih * 0.32, 10, ih * 0.2);
      g.fillStyle = '#8a1d2a'; g.fillRect(ix + iw * 0.5, iy + ih * 0.6, iw * 0.3, ih * 0.1); g.fillStyle = '#d9b24c'; g.fillRect(ix + iw * 0.5, iy + ih * 0.64, iw * 0.3, 2);
      g.fillStyle = '#efe3c4'; g.fillRect(ix + iw * 0.7, iy + ih * 0.32, 9, ih * 0.28);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.ellipse(ix + iw * 0.7 + 4.5, iy + ih * 0.28, 4, 9, 0, 0, TAU); g.fill();
    }
    g.restore();
  }
  function drawWindow(g, ge) {
    const cx = 256, top = 38, bottom = 290, hw = 84;
    const arch = (c, r, t, b) => { c.beginPath(); c.moveTo(cx - r, b); c.lineTo(cx - r, t + r); c.arc(cx, t + r, r, Math.PI, 0); c.lineTo(cx + r, b); c.closePath(); };
    g.fillStyle = '#a89c8a'; arch(g, hw + 16, top - 16, bottom + 4); g.fill();
    g.fillStyle = '#2a2018'; arch(g, hw + 5, top - 5, bottom + 4); g.fill();
    g.save(); arch(g, hw, top, bottom); g.clip();
    ge.save(); arch(ge, hw, top, bottom); ge.clip();
    const cols = 3, cw = (hw * 2) / cols, rows = 10, rh = (bottom - top) / rows;
    const hues = [212, 282, 42, 352, 162, 28];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const hue = hues[Math.floor(rnd(0, hues.length))], l = rnd(40, 56);
      g.fillStyle = 'hsl(' + hue + ',72%,' + l + '%)'; g.fillRect(cx - hw + i * cw, top + j * rh, cw, rh);
      ge.fillStyle = 'hsl(' + hue + ',85%,' + (l + 6) + '%)'; ge.fillRect(cx - hw + i * cw, top + j * rh, cw, rh);
    }
    [g, ge].forEach((c, k) => {
      c.strokeStyle = k ? '#000' : '#14100c'; c.lineWidth = 3.2; c.beginPath();
      for (let i = 0; i <= cols; i++) { c.moveTo(cx - hw + i * cw, top); c.lineTo(cx - hw + i * cw, bottom); }
      for (let j = 0; j <= rows; j++) { c.moveTo(cx - hw, top + j * rh); c.lineTo(cx + hw, top + j * rh); }
      c.stroke();
    });
    g.restore(); ge.restore();
  }
  function drawTapestry(g, base) {
    const x0 = 172, x1 = 340, y0 = 24, y1 = 284, xm = (x0 + x1) / 2;
    g.fillStyle = goldGrad(g, x0 - 12, 0, x1 + 12, 0); g.fillRect(x0 - 12, y0 - 9, x1 - x0 + 24, 8);
    g.fillStyle = '#f7dd8e'; g.beginPath(); g.arc(x0 - 14, y0 - 5, 6, 0, TAU); g.arc(x1 + 14, y0 - 5, 6, 0, TAU); g.fill();
    const poly = (c, ins) => { c.beginPath(); c.moveTo(x0 + ins, y0 + ins); c.lineTo(x1 - ins, y0 + ins); c.lineTo(x1 - ins, y1 - ins); c.lineTo(xm, y1 - 40 - ins); c.lineTo(x0 + ins, y1 - ins); c.closePath(); };
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.save(); g.translate(5, 4); poly(g, 0); g.fill(); g.restore();
    g.fillStyle = gr; poly(g, 0); g.fill();
    g.strokeStyle = '#d9b24c'; g.lineWidth = 4; poly(g, 10); g.stroke();
    g.lineWidth = 1.2; poly(g, 18); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(xm, 126, 46, 0, TAU); g.fill();
    g.strokeStyle = '#f7dd8e'; g.lineWidth = 3; g.beginPath(); g.arc(xm, 126, 46, 0, TAU); g.stroke();
    g.fillStyle = '#f2cf6e'; starPath(g, xm, 126, 34, 14, 5); g.fill();
    g.fillStyle = '#d9b24c'; g.fillRect(xm - 22, 196, 44, 4); g.fillRect(xm - 14, 206, 28, 4);
  }
  function drawBooks(g) {
    const x0 = 38, x1 = 474, y0 = 40, y1 = 292, cols = ['#7a1d2a', '#1f3f7a', '#245c3f', '#6b3a8a', '#a8742a', '#3a2a1a', '#8a3a2a', '#2a5a6a'];
    g.fillStyle = '#2d190e'; g.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
    g.fillStyle = '#100906'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const sh = (y1 - y0) / 3;
    for (let s = 0; s < 3; s++) {
      const by = y0 + (s + 1) * sh - 10;
      let bx = x0 + 4;
      while (bx < x1 - 16) {
        const bw = rnd(10, 22), bh = sh * rnd(0.6, 0.86);
        g.fillStyle = cols[Math.floor(rnd(0, cols.length))]; g.fillRect(bx, by - bh, bw - 1.5, bh);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx, by - bh, 2, bh);
        g.fillStyle = '#d9b24c'; g.fillRect(bx, by - bh * 0.8, bw - 1.5, 2); g.fillRect(bx, by - bh * 0.22, bw - 1.5, 2);
        bx += bw;
        if (Math.random() < 0.07) bx += rnd(10, 26);
      }
      g.fillStyle = '#3d2314'; g.fillRect(x0, by, x1 - x0, 12);
      g.fillStyle = 'rgba(224,176,74,.5)'; g.fillRect(x0, by, x1 - x0, 1.5);
    }
  }
  function drawSconce(g, ge, cx, cy) {
    const gl = g.createRadialGradient(cx, cy - 10, 4, cx, cy - 10, 160); gl.addColorStop(0, 'rgba(255,190,90,.5)'); gl.addColorStop(1, 'rgba(255,150,40,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(cx - 160, cy - 170, 320, 340); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#17120f'; g.fillRect(cx - 4, cy + 4, 8, 44);
    g.beginPath(); g.moveTo(cx - 20, cy + 2); g.lineTo(cx + 20, cy + 2); g.lineTo(cx + 11, cy + 22); g.lineTo(cx - 11, cy + 22); g.closePath(); g.fill();
    g.fillStyle = '#3a2a1a'; g.fillRect(cx - 3, cy - 8, 6, 12);
    const flame = (c, a, b) => {
      c.fillStyle = a; c.beginPath(); c.moveTo(cx, cy - 46); c.quadraticCurveTo(cx + 17, cy - 14, cx, cy - 4); c.quadraticCurveTo(cx - 17, cy - 14, cx, cy - 46); c.fill();
      c.fillStyle = b; c.beginPath(); c.moveTo(cx, cy - 30); c.quadraticCurveTo(cx + 8, cy - 14, cx, cy - 7); c.quadraticCurveTo(cx - 8, cy - 14, cx, cy - 30); c.fill();
    };
    flame(g, '#ff9a2a', '#ffe08a'); flame(ge, '#ff9a2a', '#fff0b0');
  }
  const WALL_KINDS = [
    { k: 'art1', a: 0, w: 2 }, { k: 'art1', a: 1, w: 2 }, { k: 'art1', a: 3, w: 2 }, { k: 'art1', a: 6, w: 2 },
    { k: 'art2', a: [2, 4], w: 3 }, { k: 'art2', a: [5, 7], w: 3 },
    { k: 'window', a: 0, w: 2 }, { k: 'window', a: 1, w: 2 },
    { k: 'tapestry', a: ['#5c0f20', '#8c1b30'], w: 2 }, { k: 'tapestry', a: ['#10285a', '#1d4684'], w: 1 },
    { k: 'books', a: 0, w: 2 }, { k: 'books', a: 1, w: 1 },
    { k: 'sconce', a: 0, w: 4 },
  ];
  function wallTexture(def) {
    const W = 512, H = 452, K = IMGS.stone ? 1.25 : 1;   // un peu plus de définition quand de vraies images sont affichées
    const [c, g] = cv(Math.round(W * K), Math.round(H * K));
    g.scale(K, K);
    let ce = null, ge = null;
    if (def.k === 'window' || def.k === 'sconce') { [ce, ge] = cv(Math.round(W * K), Math.round(H * K)); ge.scale(K, K); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H); }
    stoneBase(g, 0, 26, W, 270);
    drawCrown(g, W);
    drawWainscot(g, W, 296, H - 296);
    if (def.k === 'art1') artFrame(g, 172, 38, 168, 228, def.a);
    else if (def.k === 'art2') { artFrame(g, 70, 64, 150, 196, def.a[0]); artFrame(g, 292, 64, 150, 196, def.a[1]); }
    else if (def.k === 'window') drawWindow(g, ge);
    else if (def.k === 'tapestry') drawTapestry(g, def.a);
    else if (def.k === 'books') drawBooks(g);
    else if (def.k === 'sconce') { drawSconce(g, ge, 112, 168); drawSconce(g, ge, 400, 168); }
    grain(g, W, H, 12);
    return { c, ce };
  }
  function floorTexture(mask) {
    const S = 256, [c, g] = cv(S, S);
    if (IMGS.marble) {
      g.save(); g.translate(mask & 1 ? S : 0, mask & 2 ? S : 0); g.scale(mask & 1 ? -1 : 1, mask & 2 ? -1 : 1);
      g.drawImage(IMGS.marble, 0, 0, S, S); g.restore();
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { g.fillStyle = (i + j) % 2 ? 'rgba(14,8,22,.5)' : 'rgba(30,18,36,.22)'; g.fillRect(i * 128, j * 128, 128, 128); }
    } else for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { g.fillStyle = (i + j) % 2 ? '#2d2431' : '#40343f'; g.fillRect(i * 128, j * 128, 128, 128); }
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(rnd(0, S), rnd(0, S)); g.bezierCurveTo(rnd(0, S), rnd(0, S), rnd(0, S), rnd(0, S), rnd(0, S), rnd(0, S)); g.stroke(); }
    g.strokeStyle = 'rgba(10,6,12,.85)'; g.lineWidth = 3; g.strokeRect(0, 0, S, S);
    g.beginPath(); g.moveTo(128, 0); g.lineTo(128, S); g.moveTo(0, 128); g.lineTo(S, 128); g.stroke();
    const R = [[80, 80, 96, 96]];
    if (mask & 1) R.push([80, 0, 96, 80]); if (mask & 2) R.push([176, 80, 80, 96]);
    if (mask & 4) R.push([80, 176, 96, 80]); if (mask & 8) R.push([0, 80, 80, 96]);
    g.fillStyle = '#c79a3d'; R.forEach((r) => g.fillRect(r[0] - 8, r[1] - 8, r[2] + 16, r[3] + 16));
    g.fillStyle = '#4a0c18'; R.forEach((r) => g.fillRect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8));
    g.fillStyle = IMGS.carpet ? g.createPattern(IMGS.carpet, 'repeat') : '#7e1a2b'; R.forEach((r) => g.fillRect(r[0], r[1], r[2], r[3]));
    g.save(); g.beginPath(); R.forEach((r) => g.rect(r[0], r[1], r[2], r[3])); g.clip();
    if (!IMGS.carpet) {
      g.strokeStyle = 'rgba(224,176,74,.38)'; g.lineWidth = 1.6;
      for (let k = -S; k < S * 2; k += 24) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.moveTo(k, S); g.lineTo(k + S, 0); g.stroke(); }
    } else { g.fillStyle = 'rgba(20,4,10,.18)'; g.fillRect(0, 0, S, S); }
    g.strokeStyle = '#e8c466'; g.lineWidth = 2.5; g.beginPath(); g.arc(128, 128, 24, 0, TAU); g.stroke();
    g.fillStyle = '#e8c466'; starPath(g, 128, 128, 15, 6, 4); g.fill();
    g.restore();
    grain(g, S, S, 9);
    return c;
  }
  function ceilingTexture() {
    const S = 256, [c, g] = cv(S, S);
    g.fillStyle = '#1d1411'; g.fillRect(0, 0, S, S);
    const b = g.createLinearGradient(0, 0, S, S); b.addColorStop(0, '#3a241b'); b.addColorStop(1, '#27170f');
    g.fillStyle = b; g.fillRect(0, 0, S, 30); g.fillRect(0, S - 30, S, 30); g.fillRect(0, 0, 30, S); g.fillRect(S - 30, 0, 30, S);
    g.fillStyle = '#17100d'; g.fillRect(30, 30, S - 60, S - 60);
    g.strokeStyle = 'rgba(224,176,74,.55)'; g.lineWidth = 2; g.strokeRect(36, 36, S - 72, S - 72);
    g.strokeStyle = 'rgba(224,176,74,.35)'; g.beginPath(); g.arc(S / 2, S / 2, 40, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(224,176,74,.5)'; starPath(g, S / 2, S / 2, 22, 9, 8); g.fill();
    grain(g, S, S, 8);
    return c;
  }
  function capeTexture(hex) {
    const [c, g] = cv(128, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, hex); gr.addColorStop(1, '#10091a');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 128, 256);
    g.fillStyle = gr; g.globalAlpha = 0.75; g.fillRect(0, 0, 128, 256); g.globalAlpha = 1;
    g.strokeStyle = '#f2cf6e'; g.lineWidth = 5; g.strokeRect(6, 6, 116, 244);
    g.fillStyle = '#f7dd8e'; starPath(g, 64, 118, 40, 17, 5); g.fill();
    g.fillStyle = '#f2cf6e'; g.beginPath(); g.arc(64, 192, 17, 0, TAU); g.fill(); g.fillStyle = hex; g.beginPath(); g.arc(71, 188, 15, 0, TAU); g.fill();
    return c;
  }
  function glowTexture(inner) {
    const [c, g] = cv(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner || 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }

  /* ================= scène ================= */
  const canvas = $('#gl'), stage = $('#stage');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x0d0711, 1);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x0d0711, 0.024);
  const camMain = new T.PerspectiveCamera(80, 1, 0.06, 260);
  const hemi = new T.HemisphereLight(0x9a86b4, 0x3a2418, 0.72); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe6c0, 0); sun.position.set(N * C * 0.3, 60, N * C * 0.9); scene.add(sun);
  sun.target.position.set(N * C / 2, 0, N * C / 2); scene.add(sun.target);
  const wandLight = new T.PointLight(0xffdcaa, 0.75, 11, 1.4); scene.add(wandLight);
  const pool = [];
  for (let i = 0; i < 4; i++) { const l = new T.PointLight(0xffb464, 1.15, 14, 1.4); l.position.set(0, -50, 0); scene.add(l); pool.push(l); }
  const world = new T.Group(); scene.add(world);
  // relief : la carte de hauteur est déduite de la luminosité de la texture (pierre, bois, dorures)
  function bumpFrom(c, gain) {
    const f = c.width > 400 ? 0.6 : 1, w = Math.round(c.width * f), h = Math.round(c.height * f), [bc, bg] = cv(w, h);
    bg.drawImage(c, 0, 0, w, h);
    const img = bg.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, v = Math.max(0, Math.min(255, ((l - 0.45) * gain + 0.5) * 255));
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    bg.putImageData(img, 0, 0); return bc;
  }
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const mkTex = (c, repeat) => {
    const t = new T.CanvasTexture(c); t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  };

  const assets = { wallMats: [], floorMats: [], ceilMat: null, glow: null, glowWarm: null, capes: {} };
  function initAssets() {
    WALL_KINDS.forEach((def) => {
      const t = wallTexture(def);
      assets.wallMats.push(new T.MeshStandardMaterial({
        map: mkTex(t.c), roughness: 0.9, metalness: 0.04, bumpMap: mkTex(bumpFrom(t.c, 1.3)), bumpScale: 0.5,
        emissiveMap: t.ce ? mkTex(t.ce) : null, emissive: t.ce ? 0xffffff : 0x000000, emissiveIntensity: t.ce ? 0.85 : 0,
      }));
    });
    for (let m = 0; m < 16; m++) { const fc = floorTexture(m); assets.floorMats.push(new T.MeshStandardMaterial({ map: mkTex(fc), bumpMap: mkTex(bumpFrom(fc, 1.2)), bumpScale: 0.45, roughness: 0.62, metalness: 0.12 })); }
    assets.ceilMat = new T.MeshStandardMaterial({ map: mkTex(ceilingTexture(), N), roughness: 0.9 });
    assets.glow = new T.CanvasTexture(glowTexture());
    ROBES.forEach((hex) => { assets.capes[hex] = new T.CanvasTexture(capeTexture(hex)); });
    { const [sc, sg] = cv(128, 128), gr = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,236,160,.55)'); gr.addColorStop(1, 'rgba(255,236,160,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
      sg.fillStyle = '#f6d878'; starPath(sg, 64, 64, 44, 17, 5); sg.fill(); sg.strokeStyle = '#fff4c4'; sg.lineWidth = 2; sg.stroke();
      assets.star = new T.CanvasTexture(sc); }
    points.material.uniforms.map.value = assets.glow; dustMat.uniforms.map.value = assets.glow;
  }

  const wallGeo = new T.BoxGeometry(WW, WH, WT);
  const floorGeo = new T.PlaneGeometry(C, C); floorGeo.rotateX(-Math.PI / 2);
  const dummy = new T.Object3D();
  let mazeGroup = null, S = null;
  const hsh = (a, b, c) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647 + (S ? S.seed : 0)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const kindTable = [];
  WALL_KINDS.forEach((d, i) => { for (let k = 0; k < d.w; k++) kindTable.push(i); });

  /* rayons de lumière colorés qui tombent des vitraux (de chaque côté du mur) */
  let shafts = null;
  const shaftMat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const SHAFT_COL = [[1, 0.78, 0.4], [1, 0.36, 0.42], [0.42, 0.62, 1], [0.72, 0.44, 1]];
  function addShafts(w, seed, P, Cc) {
    const [px, pz, rot] = w, col = SHAFT_COL[Math.floor(hsh(seed, 7, 3) * SHAFT_COL.length)];
    const tx = rot ? 0 : 1, tz = rot ? 1 : 0;
    const vtx = (p, k) => { P.push(p[0], p[1], p[2]); Cc.push(col[0] * k, col[1] * k, col[2] * k); };
    // bandeau doux : bords à zéro, centre lumineux, aucune arête dure
    const ribbon = (a, b, wa, wb, ia, ib) => {
      const row = (c, wv, k) => [-1, 0, 1].map((j) => ({ p: [c[0] + wv[0] * j, c[1] + wv[1] * j, c[2] + wv[2] * j], k: j === 0 ? k : 0 }));
      const r0 = row(a, wa, ia), r1 = row(b, wb, ib);
      for (let j = 0; j < 2; j++) [r0[j], r0[j + 1], r1[j + 1], r0[j], r1[j + 1], r1[j]].forEach((v) => vtx(v.p, v.k));
    };
    // tache de lumière au sol : pyramide douce
    const glow = (c, u, v, k) => {
      const g = (i, j) => ({ p: [c[0] + u[0] * i + v[0] * j, c[1], c[2] + u[2] * i + v[2] * j], k: i === 0 && j === 0 ? k : 0 });
      for (const [i, j] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const q = [g(i, j), g(i + 1, j), g(i + 1, j + 1), g(i, j + 1)];
        [q[0], q[1], q[2], q[0], q[2], q[3]].forEach((t) => vtx(t.p, t.k));
      }
    };
    for (const sgn of [1, -1]) {
      const nx = rot ? sgn : 0, nz = rot ? 0 : sgn;
      const ox = px + nx * (WT / 2 + 0.03), oz = pz + nz * (WT / 2 + 0.03);
      if (ox < 0.5 || oz < 0.5 || ox > N * C - 0.5 || oz > N * C - 0.5) continue;
      const A = [ox, 2.35, oz], D = 2.3, B = [ox + nx * D, 0.04, oz + nz * D];
      const L = Math.hypot(D, A[1] - B[1]), pn = (A[1] - B[1]) / L, py = D / L;   // perpendiculaire à l'axe, dans le plan (normale, hauteur)
      const wt = (k) => [tx * k, 0, tz * k], wp = (k) => [nx * pn * k, py * k, nz * pn * k];
      ribbon(A, B, wt(0.62), wt(1.0), 0.34, 0.08);
      ribbon(A, B, wp(0.9), wp(1.05), 0.34, 0.08);
      glow(B, [nx * 1.3, 0, nz * 1.3], wt(1.0), 0.55);
    }
  }
  function buildMaze() {
    if (mazeGroup) world.remove(mazeGroup);
    mazeGroup = new T.Group(); world.add(mazeGroup);
    const lists = WALL_KINDS.map(() => []);
    const add = (px, pz, rot, a, b, c) => lists[kindTable[Math.floor(hsh(a, b, c) * kindTable.length)]].push([px, pz, rot]);
    const op = S.maze.open;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (x === N - 1 || !(op[K(x, y)] & 2)) add((x + 1) * C, y * C + C / 2, Math.PI / 2, x, y, 1);
        if (y === N - 1 || !(op[K(x, y)] & 4)) add(x * C + C / 2, (y + 1) * C, 0, x, y, 2);
        if (x === 0) add(0, y * C + C / 2, Math.PI / 2, x, y, 3);
        if (y === 0) add(x * C + C / 2, 0, 0, x, y, 4);
      }
    }
    shafts = null;
    const sp = [], sc = [];
    lists.forEach((arr, i) => { if (WALL_KINDS[i].k === 'window') arr.forEach((w, j) => addShafts(w, i * 31 + j, sp, sc)); });
    if (sp.length) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(sp), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(sc), 3));
      shafts = new T.Mesh(g, shaftMat); shafts.frustumCulled = false; mazeGroup.add(shafts);
    }
    lists.forEach((arr, i) => {
      if (!arr.length) return;
      const im = new T.InstancedMesh(wallGeo, assets.wallMats[i], arr.length);
      arr.forEach((w, j) => { dummy.position.set(w[0], WH / 2, w[1]); dummy.rotation.set(0, w[2], 0); dummy.updateMatrix(); im.setMatrixAt(j, dummy.matrix); });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
      mazeGroup.add(im);
    });
    const fl = Array.from({ length: 16 }, () => []);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fl[op[K(x, y)] & 15].push([x, y]);
    fl.forEach((arr, m) => {
      if (!arr.length) return;
      const im = new T.InstancedMesh(floorGeo, assets.floorMats[m], arr.length);
      arr.forEach((p, j) => { dummy.position.set(p[0] * C + C / 2, 0, p[1] * C + C / 2); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); im.setMatrixAt(j, dummy.matrix); });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
      mazeGroup.add(im);
    });
  }

  let ceiling = null, candleMesh = null, flames = null, candles = [], clusters = [];
  function buildCeiling() {
    const g = new T.PlaneGeometry(N * C, N * C); g.rotateX(Math.PI / 2);
    ceiling = new T.Mesh(g, assets.ceilMat); ceiling.position.set(N * C / 2, WH, N * C / 2); world.add(ceiling);
  }
  function buildCandles() {
    candles = []; clusters = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (hsh(x, y, 99) > 0.4) continue;
      const p = cc(x, y);
      clusters.push({ x: p.x, z: p.z, y: WH - 1.2 });
      for (let i = 0; i < 4; i++) candles.push({ x: p.x + (hsh(x, y, i * 3 + 1) - 0.5) * 2, z: p.z + (hsh(x, y, i * 3 + 2) - 0.5) * 2, y: WH - 0.7 - hsh(x, y, i * 3 + 3) * 1.1, ph: hsh(x, y, i) * TAU });
    }
    const geo = new T.CylinderGeometry(0.045, 0.05, 0.38, 6);
    candleMesh = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xf0e4c4, emissive: 0x5a4220, roughness: 0.7 }), candles.length);
    candleMesh.frustumCulled = false; world.add(candleMesh);
    const fg = new T.BufferGeometry();
    fg.setAttribute('position', new T.BufferAttribute(new Float32Array(candles.length * 3), 3));
    const fc = new Float32Array(candles.length * 3);
    for (let i = 0; i < candles.length; i++) { fc[i * 3] = 1.0; fc[i * 3 + 1] = 0.6; fc[i * 3 + 2] = 0.25; }
    fg.setAttribute('aColor', new T.BufferAttribute(fc, 3));
    const fm = pointMat(0.62); fm.uniforms.map.value = assets.glow;
    flames = new T.Points(fg, fm);
    flames.frustumCulled = false; world.add(flames);
  }
  function animateCandles(t) {
    if (!candleMesh) return;
    const pos = flames.geometry.attributes.position.array;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const y = c.y + Math.sin(t * 1.2 + c.ph) * 0.09, x = c.x + Math.sin(t * 0.7 + c.ph * 2) * 0.05;
      dummy.position.set(x, y, c.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); candleMesh.setMatrixAt(i, dummy.matrix);
      pos[i * 3] = x; pos[i * 3 + 1] = y + 0.26; pos[i * 3 + 2] = c.z;
    }
    candleMesh.instanceMatrix.needsUpdate = true; flames.geometry.attributes.position.needsUpdate = true;
    flames.material.uniforms.opacity.value = 0.85 + Math.sin(t * 9) * 0.08;
  }
  function updateLightPool(t) {
    const cx = camMain.position.x, cz = camMain.position.z;
    const near = clusters.map((c) => ({ c, d: (c.x - cx) ** 2 + (c.z - cz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, pool.length);
    pool.forEach((l, i) => {
      if (near[i]) { l.position.set(near[i].c.x, near[i].c.y, near[i].c.z); l.intensity = 1.1 + Math.sin(t * 7 + i * 2.1) * 0.08 + Math.sin(t * 13 + i) * 0.04; }
      else l.intensity = 0;
    });
    wandLight.position.copy(camMain.position);
  }

  /* brume dorée et anneau d'avertissement */
  const mistMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, side: T.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: [
      'uniform float uTime; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
      'float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }',
      'float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }',
      'void main(){',
      '  vec2 p = vUv*vec2(3.0,2.4);',
      '  float a = fbm(p + vec2(uTime*0.12, -uTime*0.07));',
      '  float b = fbm(p*1.7 - vec2(uTime*0.09, uTime*0.11));',
      '  float m = smoothstep(0.25, 0.85, a*0.6 + b*0.5);',
      '  vec3 col = mix(vec3(0.26,0.09,0.44), vec3(0.98,0.72,0.26), m);',
      '  col += vec3(0.22,0.1,0.34) * smoothstep(0.6, 1.0, b);',
      '  gl_FragColor = vec4(col, 0.93 + 0.07*m);',
      '}',
    ].join('\n'),
  });
  const mistGeo = new T.PlaneGeometry(C, WH);
  // voile de brume vu d'en haut sur les cases éliminées (même animation, plus transparent)
  const mistLidMat = new T.ShaderMaterial({
    uniforms: mistMat.uniforms, transparent: true, side: T.DoubleSide, depthWrite: false,
    vertexShader: mistMat.vertexShader, fragmentShader: mistMat.fragmentShader.replace('0.93 + 0.07*m', '0.5 + 0.3*m'),
  });
  const lidGeo = new T.PlaneGeometry(C, C); lidGeo.rotateX(-Math.PI / 2);
  let mistGroup = null, mistLid = null;
  function buildMist() {
    if (mistGroup) world.remove(mistGroup);
    if (mistLid) world.remove(mistLid);
    mistLid = new T.Group(); world.add(mistLid);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (E.inZone(S.zone, x, y)) continue;
      const p = cc(x, y), m = new T.Mesh(lidGeo, mistLidMat); m.position.set(p.x, WH + 0.4, p.z); mistLid.add(m);
    }
    mistGroup = new T.Group(); world.add(mistGroup);
    for (let y = S.zone.y0; y <= S.zone.y1; y++) for (let x = S.zone.x0; x <= S.zone.x1; x++) {
      for (let d = 0; d < 4; d++) {
        if (!((S.maze.open[K(x, y)] >> d) & 1)) continue;
        if (E.inZone(S.zone, x + E.DX[d], y + E.DY[d])) continue;
        const p = cc(x, y), m = new T.Mesh(mistGeo, mistMat);
        m.position.set(p.x + E.DX[d] * C / 2, WH / 2, p.z + E.DY[d] * C / 2);
        m.rotation.y = d % 2 ? Math.PI / 2 : 0;
        mistGroup.add(m);
      }
    }
  }
  const ringMat = new T.MeshBasicMaterial({ color: 0xa074e6, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  const ringGeo = new T.PlaneGeometry(C - 0.3, C - 0.3); ringGeo.rotateX(-Math.PI / 2);
  let ringGroup = null, ringStrength = 0;
  function updateRing() {
    if (ringGroup) world.remove(ringGroup);
    ringGroup = new T.Group(); world.add(ringGroup);
    const nz = E.nextZone(S), tts = E.turnsToShrink(S);
    ringStrength = !nz ? 0 : tts === 0 ? 1 : tts === -2 ? 0.3 : tts <= 2 ? 0.4 : 0;
    if (!nz) return;
    for (let y = S.zone.y0; y <= S.zone.y1; y++) for (let x = S.zone.x0; x <= S.zone.x1; x++) {
      if (E.inZone(nz, x, y)) continue;
      const p = cc(x, y), m = new T.Mesh(ringGeo, ringMat); m.position.set(p.x, 0.03, p.z); ringGroup.add(m);
    }
  }

  /* rune dorée : la case centrale, refuge final que la brume n'atteint jamais */
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.strokeStyle = '#ffe9a6'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 48, 0, TAU); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 33, 0, TAU); g.stroke();
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.3927, r = i % 2 ? 22 : 40; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.stroke();
    const tex = new T.CanvasTexture(cv);
    const geo = new T.PlaneGeometry(C * 0.9, C * 0.9); geo.rotateX(-Math.PI / 2);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    const p = cc(E.CX, E.CY); m.position.set(p.x, 0.04, p.z); world.add(m);
  }

  /* bonus au sol */
  let pickupGroup = null;
  const pickupMeshes = new Map();
  const PK_COL = { phase: 0x62b6ff, shield: 0x4fe08a, map: 0xf2d68a, crystal: 0xffd84a };
  function buildPickups() {
    if (pickupGroup) world.remove(pickupGroup);
    pickupGroup = new T.Group(); world.add(pickupGroup); pickupMeshes.clear();
    S.pickups.forEach((k) => {
      const g = new T.Group(), col = PK_COL[k.kind];
      let m;
      if (k.kind === 'shield') {
        m = new T.Mesh(new T.OctahedronGeometry(0.3), new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.25, transparent: true, opacity: 0.92 }));
        m.scale.y = 1.35;
        const ring = new T.Mesh(new T.TorusGeometry(0.42, 0.025, 8, 24), new T.MeshBasicMaterial({ color: col })); ring.rotation.x = Math.PI / 2; g.add(ring);
      } else if (k.kind === 'phase') {
        m = new T.Group();
        const arch = new T.Mesh(new T.TorusGeometry(0.3, 0.045, 10, 28), new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.3 })); m.add(arch);
        const disc = new T.Mesh(new T.CircleGeometry(0.27, 24), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); m.add(disc);
      } else if (k.kind === 'map') {
        m = new T.Group();
        const roll = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.55, 12), new T.MeshStandardMaterial({ color: 0xefe0b8, emissive: 0x6a5320, roughness: 0.8 })); roll.rotation.z = Math.PI / 2; m.add(roll);
        [-0.29, 0.29].forEach((x) => { const cap = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.05, 12), new T.MeshStandardMaterial({ color: 0xd9b24c, emissive: 0x6a5018, metalness: 0.15, roughness: 0.4 })); cap.rotation.z = Math.PI / 2; cap.position.x = x; m.add(cap); });
      } else {
        m = new T.Mesh(new T.OctahedronGeometry(0.26), new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.9 }));
        m.scale.y = 1.7;
      }
      g.add(m);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: assets.glow, color: col, opacity: 0.38, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      sp.scale.set(1.5, 1.5, 1); g.add(sp);
      const p = cc(k.x, k.y); g.position.set(p.x, 0.95, p.z);
      g.userData = { m, ph: Math.random() * TAU, base: 0.95 };
      pickupGroup.add(g); pickupMeshes.set(k.x + ',' + k.y, g);
    });
  }
  function animatePickups(t) {
    pickupMeshes.forEach((g) => { g.position.y = g.userData.base + Math.sin(t * 1.6 + g.userData.ph) * 0.1; g.userData.m.rotation.y = t * 1.1 + g.userData.ph; });
  }

  /* magiciens */
  const actors = {};
  /* magicien : modèle intégré (fichier Blender fourni, figé en pose debout, un seul maillage coloré par sommets) */
  const WSCALE = 1.16;
  const wizBase = (() => {
    const dec = (b64, Ctor) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Ctor(u.buffer); };
    const p16 = dec(WIZ.P, Int16Array), n8 = dec(WIZ.N, Int8Array), idx = dec(WIZ.I, Uint16Array), cls = dec(WIZ.C, Uint8Array);
    const pos = new Float32Array(p16.length), nrm = new Float32Array(n8.length);
    for (let i = 0; i < p16.length; i++) { pos[i] = p16[i] * WIZ.s * WSCALE; nrm[i] = n8[i] / 127; }
    return { pos: new T.BufferAttribute(pos, 3), nrm: new T.BufferAttribute(nrm, 3), idx: new T.BufferAttribute(idx, 1), cls, n: cls.length };
  })();
  const wizMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 });
  function wizColors(hex) {
    // palette d'origine du modèle (56x56) : robe/chapeau = couleur du joueur, le reste fidèle à la texture
    const robe = new T.Color(hex), trim = robe.clone().lerp(new T.Color(0xffffff), 0.28), inner = robe.clone().multiplyScalar(0.38).lerp(new T.Color(0x1a1218), 0.3);
    const rgb = (r, g, b) => new T.Color().setRGB(r / 255, g / 255, b / 255);
    return [robe, inner, trim, rgb(241, 194, 125), rgb(205, 205, 205), rgb(90, 90, 96), rgb(70, 58, 56), rgb(110, 70, 40), rgb(20, 50, 16)];
  }
  function buildWizard(hex, bodyIdx) {
    const g = new T.Group();
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', wizBase.pos); geo.setAttribute('normal', wizBase.nrm); geo.setIndex(wizBase.idx);
    const cols = wizColors(hex), arr = new Float32Array(wizBase.n * 3);
    for (let i = 0; i < wizBase.n; i++) { const c = cols[wizBase.cls[i]]; arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new T.BufferAttribute(arr, 3));
    geo.boundingSphere = new T.Sphere(new T.Vector3(0, 1, 0), 2.6);
    const body = new T.Mesh(geo, wizMat); body.frustumCulled = false; g.add(body);
    // étoile dorée dans le dos : on reconnaît d'un coup d'oeil un magicien qui nous tourne le dos
    const star = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ map: assets.star, color: 0x8a7a55, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    star.position.set(0, 1.12, WIZ.back * WSCALE - 0.02); star.rotation.y = Math.PI; g.add(star);
    const tip = new T.Vector3(WIZ.top[0] * WSCALE, WIZ.top[1] * WSCALE + 0.07, WIZ.top[2] * WSCALE);
    const orb = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), new T.MeshBasicMaterial({ color: 0xfff2c0 })); orb.position.copy(tip); g.add(orb);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: assets.glow, color: 0xffd36a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(0.95, 0.95, 1); halo.position.copy(tip); g.add(halo);
    const bubble = new T.Mesh(new T.SphereGeometry(1.05, 20, 14), new T.MeshBasicMaterial({ color: 0x4fe08a, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    bubble.position.y = 1.0; bubble.scale.y = 1.12; bubble.visible = false; g.add(bubble);
    g.userData = { orb, halo, bubble, bodyIdx, tip };
    return g;
  }
  let wizGroup = null;
  function buildActors() {
    if (wizGroup) world.remove(wizGroup);
    wizGroup = new T.Group(); world.add(wizGroup);
    Object.keys(actors).forEach((k) => delete actors[k]);
    S.players.forEach((p) => {
      const g = buildWizard(ROBES[p.color], p.color), pos = cc(p.x, p.y);
      const a = { id: p.id, x: pos.x, z: pos.z, yaw: YAW[p.f], g, bob: 0, dead: false };
      g.position.set(a.x, 0, a.z); g.rotation.y = a.yaw + Math.PI;
      g.userData.bubble.visible = p.shield;
      wizGroup.add(g); actors[p.id] = a;
    });
  }
  function syncActors() {
    S.players.forEach((p) => {
      const a = actors[p.id]; if (!a || a.dead) return;
      const pos = cc(p.x, p.y); a.x = pos.x; a.z = pos.z; a.yaw = yawFor(p.f, a.yaw); a.bob = 0;
      a.g.userData.bubble.visible = p.shield;
    });
  }

  /* particules */
  const uPx = { value: 800 }, uMax = { value: 60 };
  function pointMat(size) {
    return new T.ShaderMaterial({
      uniforms: { map: { value: null }, size: { value: size }, uPx, uMax, opacity: { value: 1 } },
      vertexShader: 'uniform float size; uniform float uPx; uniform float uMax; attribute vec3 aColor; varying vec3 vColor;\n' +
        'void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;\n' +
        '  gl_PointSize = clamp(size * projectionMatrix[1][1] * uPx * 0.5 / max(0.1, -mv.z), 1.0, uMax); }',
      fragmentShader: 'uniform sampler2D map; uniform float opacity; varying vec3 vColor;\n' +
        'void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor * t.rgb * t.a * opacity, 1.0); }',
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: true,
    });
  }
  const MAXP = 600, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
  const pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP), pBase = new Float32Array(MAXP * 3);
  for (let i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -100;
  const pGeo = new T.BufferGeometry();
  pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('aColor', new T.BufferAttribute(pCol, 3));
  const points = new T.Points(pGeo, pointMat(0.3));
  points.frustumCulled = false; scene.add(points);
  /* poussière dorée en suspension autour du magicien */
  const DN = 110, dPos = new Float32Array(DN * 3), dCol = new Float32Array(DN * 3), dPh = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dPos[i * 3] = (Math.random() - 0.5) * 14; dPos[i * 3 + 1] = 0.2 + Math.random() * 3.4; dPos[i * 3 + 2] = (Math.random() - 0.5) * 14; dPh[i] = Math.random() * TAU; }
  const dGeo = new T.BufferGeometry();
  dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3)); dGeo.setAttribute('aColor', new T.BufferAttribute(dCol, 3));
  const dustMat = pointMat(0.075);
  const dust = new T.Points(dGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
  function updateDust(t, dt, cam) {
    for (let i = 0; i < DN; i++) {
      const j = i * 3;
      dPos[j] += Math.sin(t * 0.3 + dPh[i]) * 0.12 * dt; dPos[j + 1] += (0.05 + 0.04 * Math.sin(t * 0.5 + dPh[i])) * dt; dPos[j + 2] += Math.cos(t * 0.27 + dPh[i]) * 0.12 * dt;
      if (dPos[j + 1] > 3.7) dPos[j + 1] = 0.2;
      const rx = ((dPos[j] - cam.x + 7) % 14 + 14) % 14 - 7, rz = ((dPos[j + 2] - cam.z + 7) % 14 + 14) % 14 - 7;
      dPos[j] = cam.x + rx; dPos[j + 2] = cam.z + rz;
      const tw = 0.5 + 0.5 * Math.sin(t * 1.7 + dPh[i] * 3), edge = 1 - Math.min(1, Math.hypot(rx, rz) / 7);
      const b = 0.55 * tw * edge;
      dCol[j] = 1.0 * b; dCol[j + 1] = 0.78 * b; dCol[j + 2] = 0.42 * b;
    }
    dGeo.attributes.position.needsUpdate = true; dGeo.attributes.aColor.needsUpdate = true;
  }
  let pCursor = 0;
  function burst(x, y, z, n, hex, speed, grav) {
    const col = new T.Color(hex);
    for (let k = 0; k < n; k++) {
      const i = pCursor++ % MAXP, a = Math.random() * TAU, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), s = speed * (0.4 + Math.random() * 0.9);
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      pVel[i * 3] = Math.cos(a) * r * s; pVel[i * 3 + 1] = u * s + (grav ? 0.6 : 0.3); pVel[i * 3 + 2] = Math.sin(a) * r * s;
      pBase[i * 3] = col.r; pBase[i * 3 + 1] = col.g; pBase[i * 3 + 2] = col.b;
      pLife[i] = pMax[i] = 0.7 + Math.random() * 0.8;
    }
  }
  function updateParticles(dt) {
    for (let i = 0; i < MAXP; i++) {
      if (pLife[i] <= 0) { pPos[i * 3 + 1] = -100; continue; }
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= 1.6 * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      const f = Math.max(0, pLife[i] / pMax[i]);
      pCol[i * 3] = pBase[i * 3] * f; pCol[i * 3 + 1] = pBase[i * 3 + 1] * f; pCol[i * 3 + 2] = pBase[i * 3 + 2] * f;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aColor.needsUpdate = true;
  }
  const beamGeo = new T.CylinderGeometry(1, 1, 1, 8, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
  const beams = [];
  const tmpV = new T.Vector3(), fwV = new T.Vector3(), upV = new T.Vector3(0, 1, 0);
  function spawnBeam(e, hex) {
    const a0 = cc(e.from.x, e.from.y), dv = DIRV[e.from.f], a = actors[e.id], mine = e.id === G.follow;
    let start;
    if (mine) {
      camMain.getWorldDirection(fwV); tmpV.crossVectors(fwV, upV).normalize();
      start = camMain.position.clone().addScaledVector(fwV, 0.7).addScaledVector(tmpV, 0.34); start.y -= 0.34;
    } else if (a) { start = a.g.userData.tip.clone(); a.g.localToWorld(start); start.x += dv[0] * 0.25; start.z += dv[1] * 0.25; }
    else start = new T.Vector3(a0.x + dv[0] * 0.5, 1.5, a0.z + dv[1] * 0.5);
    let end;
    if (e.to) { const b = cc(e.to.x, e.to.y); end = new T.Vector3(b.x, 1.15, b.z); } else end = start.clone().add(new T.Vector3(dv[0] * 2.6, -0.2, dv[1] * 2.6));
    const len = start.distanceTo(end);
    const mk = (rad, color, op) => {
      const m = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      m.position.copy(start); m.lookAt(end); m.scale.set(rad, rad, len); scene.add(m); return m;
    };
    const rs = mine ? 0.5 : 1;
    beams.push({ outer: mk(0.1 * rs, hex, 0.6), inner: mk(0.035 * rs, 0xffffff, 0.95), t0: performance.now(), rs });
    burst(start.x, start.y, start.z, mine ? 6 : 14, 0xfff0b0, 2.4, false);
    if (e.to) burst(end.x, end.y, end.z, 26, hex, 3.2, false);
  }
  function updateBeams(now) {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i], u = (now - b.t0) / 560;
      if (u >= 1) { scene.remove(b.outer); scene.remove(b.inner); b.outer.material.dispose(); b.inner.material.dispose(); beams.splice(i, 1); continue; }
      const f = Math.pow(1 - u, 1.4), w = 1 + Math.sin(u * 30) * 0.15;
      b.outer.material.opacity = 0.6 * f; b.inner.material.opacity = 0.95 * f;
      b.outer.scale.x = b.outer.scale.y = 0.1 * b.rs * w * (1 + u * 0.8); b.inner.scale.x = b.inner.scale.y = 0.035 * b.rs * w;
    }
  }

  /* ================= partie ================= */
  const G = { online: false, open: false, sent: false, prog: null, color: 0, busy: false, spectating: false, follow: 'p0', gen: 0, bots: 5, sound: true, topU: 0, baseFov: 80 };
  const tweens = [];
  function tween(ms, fn) { return new Promise((res) => { tweens.push({ t0: performance.now(), ms, fn, res }); }); }
  const P0 = () => S.players.find((p) => p.id === 'p0');
  const nameOf = (id) => (id === 'p0' ? 'Vous' : S.players.find((p) => p.id === id).name);

  function setFollow(id) {
    if (actors[G.follow]) actors[G.follow].g.visible = !actors[G.follow].dead;
    G.follow = id;
    if (actors[id]) actors[id].g.visible = false;
  }

  let audio = null;
  function sfx(kind) {
    if (!G.sound) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime;
      const tone = (type, f0, f1, dur, vol, delay) => {
        const o = audio.createOscillator(), g = audio.createGain(), s = t + (delay || 0);
        o.type = type; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), s + dur);
        g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
        o.connect(g); g.connect(audio.destination); o.start(s); o.stop(s + dur + 0.02);
      };
      if (kind === 'zap') { tone('sawtooth', 1100, 90, 0.4, 0.07); tone('square', 520, 60, 0.3, 0.03); }
      else if (kind === 'bump') tone('square', 110, 45, 0.18, 0.06);
      else if (kind === 'pick') { tone('sine', 620, 940, 0.16, 0.07); tone('sine', 930, 1400, 0.2, 0.05, 0.1); }
      else if (kind === 'death') tone('sawtooth', 320, 40, 0.7, 0.06);
      else if (kind === 'mist') tone('sine', 140, 70, 1.0, 0.07);
      else if (kind === 'step') tone('triangle', 150, 90, 0.08, 0.035);
      else if (kind === 'win') { tone('sine', 523, 523, 0.3, 0.06); tone('sine', 659, 659, 0.3, 0.06, 0.18); tone('sine', 784, 784, 0.5, 0.06, 0.36); }
    } catch (e) { /* le son est facultatif */ }
  }

  function toast(msg, kind) {
    const box = $('#toasts'), d = document.createElement('div');
    d.className = 'toast' + (kind ? ' ' + kind : ''); d.textContent = msg; box.appendChild(d);
    requestAnimationFrame(() => d.classList.add('in'));
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { d.classList.remove('in'); setTimeout(() => d.remove(), 300); }, 3600);
  }

  function buildWorld() {
    while (world.children.length) world.remove(world.children[0]);
    mazeGroup = ceiling = candleMesh = flames = mistGroup = mistLid = ringGroup = pickupGroup = wizGroup = null;
    buildMaze(); buildCeiling(); buildCandles(); buildMist(); updateRing(); buildPickups(); buildActors();
  }

  function startGame() {
    G.gen++; G.busy = false; G.spectating = false; G.follow = 'p0'; G.topU = 0; clearTags();
    document.body.classList.remove('spectating');
    $('#toasts').innerHTML = '';
    const players = [{ id: 'p0', name: 'Vous', color: G.color }];
    const rest = ROBES.map((_, i) => i).filter((i) => i !== G.color);
    for (let i = 0; i < G.bots; i++) players.push({ id: 'p' + (i + 1), name: NAMES[i], bot: true, color: rest[i] });
    S = E.createGame({ players });
    buildWorld(); setFollow('p0');
    $('#intro').hidden = true; $('#end').hidden = true;
    refreshHUD();
    toast('Le château s\'éveille. Tour 1.', '');
  }

  /* ----- HUD ----- */
  const radar = $('#radar'), rctx = radar.getContext('2d', { willReadFrequently: true });
  let radarSize = 116;
  function viewer() { return S.players.find((p) => p.id === G.follow) || P0(); }
  function drawRadar(t) {
    if (!S) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), size = radarSize;
    if (radar.width !== size * dpr) { radar.width = size * dpr; radar.height = size * dpr; }
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0); rctx.clearRect(0, 0, size, size);
    const me = viewer(), all = G.spectating, pad = 4, cs = (size - pad * 2) / N;
    const nz = E.nextZone(S), tts = E.turnsToShrink(S), pulse = 0.5 + 0.5 * Math.sin(t * 5);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const seen = all || me.seen[K(x, y)], inz = E.inZone(S.zone, x, y), px = pad + x * cs, py = pad + y * cs;
      if (!inz) { rctx.fillStyle = seen ? '#40285f' : 'rgba(80,40,120,.3)'; rctx.fillRect(px, py, cs, cs); continue; }
      if (seen) { rctx.fillStyle = (x + y) % 2 ? '#3a2c40' : '#42324a'; rctx.fillRect(px, py, cs, cs); }
      else { rctx.fillStyle = '#150d1a'; rctx.fillRect(px, py, cs, cs); }
      if (nz && !E.inZone(nz, x, y) && tts <= 2) { rctx.fillStyle = 'rgba(160,116,230,' + (tts === 0 ? 0.3 + pulse * 0.3 : 0.2) + ')'; rctx.fillRect(px, py, cs, cs); }
    }
    rctx.strokeStyle = '#e0b04a'; rctx.lineWidth = 1.3; rctx.lineCap = 'round'; rctx.beginPath();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!(all || me.seen[K(x, y)])) continue;
      const px = pad + x * cs, py = pad + y * cs, op = S.maze.open[K(x, y)];
      if (!(op & 1)) { rctx.moveTo(px, py); rctx.lineTo(px + cs, py); }
      if (!(op & 4)) { rctx.moveTo(px, py + cs); rctx.lineTo(px + cs, py + cs); }
      if (!(op & 8)) { rctx.moveTo(px, py); rctx.lineTo(px, py + cs); }
      if (!(op & 2)) { rctx.moveTo(px + cs, py); rctx.lineTo(px + cs, py + cs); }
    }
    rctx.stroke();
    S.pickups.forEach((k) => {
      if (!(all || me.seen[K(k.x, k.y)])) return;
      const cx = pad + (k.x + 0.5) * cs, cy = pad + (k.y + 0.5) * cs, r = cs * 0.22;
      rctx.fillStyle = '#' + PK_COL[k.kind].toString(16).padStart(6, '0');
      rctx.beginPath(); rctx.moveTo(cx, cy - r); rctx.lineTo(cx + r, cy); rctx.lineTo(cx, cy + r); rctx.lineTo(cx - r, cy); rctx.closePath(); rctx.fill();
    });
    if (S.finalCell) {
      const cx = pad + (S.finalCell.x + 0.5) * cs, cy = pad + (S.finalCell.y + 0.5) * cs;
      rctx.strokeStyle = '#f7dd8e'; rctx.lineWidth = 1.6; rctx.strokeRect(pad + S.finalCell.x * cs + 1, pad + S.finalCell.y * cs + 1, cs - 2, cs - 2);
      rctx.fillStyle = '#f7dd8e'; rctx.beginPath(); rctx.arc(cx, cy, cs * 0.12, 0, TAU); rctx.fill();
    }
    const vis = new Set(E.visiblePlayers(S, me).map((p) => p.id));
    S.players.forEach((p) => {
      if (!p.alive) return;
      const self = p.id === me.id;
      if (!(self || all || me.crystal || vis.has(p.id))) return;
      const cx = pad + (p.x + 0.5) * cs, cy = pad + (p.y + 0.5) * cs, dv = DIRV[p.f];
      if (self && !all) {
        rctx.fillStyle = '#fff2c0'; rctx.strokeStyle = '#2a1a08'; rctx.lineWidth = 1;
        const r = cs * 0.42, a = Math.atan2(dv[1], dv[0]);
        rctx.beginPath(); rctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); rctx.lineTo(cx + Math.cos(a + 2.5) * r, cy + Math.sin(a + 2.5) * r); rctx.lineTo(cx + Math.cos(a - 2.5) * r, cy + Math.sin(a - 2.5) * r); rctx.closePath(); rctx.fill(); rctx.stroke();
      } else {
        rctx.fillStyle = ROBES[p.color]; rctx.strokeStyle = '#120a18'; rctx.lineWidth = 1;
        rctx.beginPath(); rctx.arc(cx, cy, cs * 0.3, 0, TAU); rctx.fill(); rctx.stroke();
        rctx.strokeStyle = '#fff'; rctx.lineWidth = 1.4; rctx.beginPath(); rctx.moveTo(cx, cy); rctx.lineTo(cx + dv[0] * cs * 0.46, cy + dv[1] * cs * 0.46); rctx.stroke();
      }
    });
  }

  /* ----- minuteur de tour ----- */
  const timerEl = $('#timer'), timerBar = timerEl.querySelector('i'), timerNum = timerEl.querySelector('b');
  const TURN_MS = E.TURN_SECONDS * 1000;
  let tLeft = TURN_MS, tLast = 0, tRun = false;
  function timerStart(ms) { tLeft = ms === undefined ? TURN_MS : ms; tLast = performance.now(); tRun = true; timerEl.hidden = false; timerPaint(); }
  function timerStop() { tRun = false; timerEl.hidden = true; }
  function timerPaint() {
    const s = Math.max(0, Math.ceil(tLeft / 1000));
    timerNum.textContent = s + ' s' + (G.online && G.prog && G.prog.total > 1 ? '  ·  ' + G.prog.done + '/' + G.prog.total : ''); timerBar.style.transform = 'scaleX(' + Math.max(0, tLeft / TURN_MS) + ')';
    timerEl.classList.toggle('hot', s <= 5);
  }
  let lastSec = -1;
  setInterval(() => {
    if (!tRun) return;
    const now = performance.now(), dt = now - tLast; tLast = now;
    if (G.online) {   // en ligne : le serveur décide, on ne fait qu'afficher le compte à rebours
      if (!S || S.over || G.spectating || !P0().alive || !G.open) { timerStop(); return; }
      tLeft = Math.max(0, tLeft - dt); timerPaint();
      const s = Math.ceil(tLeft / 1000);
      if (s <= 5 && s > 0 && s !== lastSec && !G.sent) { lastSec = s; sfx('step'); }
      return;
    }
    if (!S || S.over || G.spectating || G.busy || !P0().alive) { timerStop(); return; }
    if (!$('#intro').hidden || !$('#lobby').hidden || !$('#pick').hidden || !$('#book').hidden || !$('#end').hidden) return;   // pause pendant les règles (solo)
    tLeft -= dt; timerPaint();
    const s = Math.ceil(tLeft / 1000);
    if (s <= 5 && s > 0 && s !== lastSec) { lastSec = s; sfx('step'); }
    if (tLeft <= 0) { timerStop(); timeUp(); }
  }, 100);
  async function timeUp() {
    const gen = G.gen; G.busy = true; refreshControls();
    const evs = E.forfeit(S, 'p0');
    killActor('p0', 'timeout');
    await sleep(900);
    if (gen !== G.gen) return;
    refreshHUD();
    if (S.over) { showEnd(); return; }
    startSpectating(gen);
  }

  function refreshControls() {
    const me = P0(), can = !G.busy && me.alive && !S.over && !G.spectating && (!G.online || (G.open && !G.sent));
    const mo = me.alive ? E.moveOptions(S, me) : {};
    document.querySelectorAll('.key').forEach((b) => {
      const a = b.dataset.act;
      let en = can;
      if (a === 'F' || a === 'B') en = can && !!mo[a];
      else if (a === 'L' || a === 'R') en = can && !!mo[a];   // grisé face à un mur ou à la brume ; pivoter reste toujours possible
      else en = can;
      b.disabled = !en;
    });
    const tgt = me.alive ? E.spellTarget(S, me) : null, cast = $('#cast');
    cast.disabled = !(can && tgt); cast.classList.toggle('ready', !!(can && tgt));
    $('#castLabel').textContent = can && tgt ? 'Lancer' : 'Sort';
    if (!G.online) { if (can && !tRun) timerStart(); else if (!can && tRun) timerStop(); }
  }

  function refreshHUD() {
    const tts = E.turnsToShrink(S);
    $('#turnN').textContent = S.turn;
    $('#aliveN').textContent = S.players.filter((p) => p.alive).length;
    const mb = $('#mistN'), pill = $('#mistPill');
    if (tts === -2) { mb.textContent = 'Le centre !'; pill.classList.add('hot'); }
    else if (tts < 0) { mb.textContent = 'Final'; pill.classList.add('hot'); }
    else if (tts === 0) { mb.textContent = 'Ce tour'; pill.classList.add('hot'); }
    else { mb.textContent = tts + (tts > 1 ? ' tours' : ' tour'); pill.classList.remove('hot'); }
    const chips = $('#chips'); chips.innerHTML = '';
    const me = viewer();
    const chip = (txt, hex) => { const c = document.createElement('div'); c.className = 'chip'; c.innerHTML = '<i style="background:' + hex + '"></i>'; c.appendChild(document.createTextNode(txt)); chips.appendChild(c); };
    if (G.spectating) chip('Spectateur : vue du dessus', '#e0b04a');
    else {
      if (G.online && G.sent) chip('Action envoyée · en attente des autres', '#e0b04a');
      if (me.shield) chip('Bouclier actif', '#4fe08a');
      if (me.phase) chip('Traversée de mur prête', '#62b6ff');
      if (me.crystal) chip('Révélation : tous visibles', '#ffd84a');
    }
    refreshControls();
    updateRing();
  }

  /* ----- déroulement d'un tour ----- */
  async function playTurn(events) {
    const me = P0();
    const casts = events.filter((e) => e.t === 'cast');
    if (casts.length) {
      sfx('zap');
      casts.forEach((e) => spawnBeam(e, new T.Color(ROBES[S.players.find((p) => p.id === e.id).color]).lerp(new T.Color(0xffffff), 0.35).getHex()));
      if (casts.some((e) => e.id === 'p0')) { const w = $('#wand'); w.classList.remove('zap'); void w.offsetWidth; w.classList.add('zap'); }
      await sleep(260);
      events.filter((e) => e.t === 'death' && e.cause === 'spell').forEach((e) => killActor(e.id, 'spell', e.by));
      casts.filter((e) => e.res === 'shield').forEach((e) => {
        const a = actors[e.target]; if (!a) return;
        a.g.userData.bubble.visible = false; burst(a.x, 1.1, a.z, 40, 0x4fe08a, 3.4, false);
        toast(e.target === 'p0' ? 'Votre bouclier absorbe un sort.' : nameOf(e.target) + ' est protégé par un bouclier.', '');
      });
      await sleep(520);
    }
    const motion = events.filter((e) => e.t === 'move' || e.t === 'bump' || e.t === 'blocked' || e.t === 'turn');
    if (motion.length) {
      if (events.some((e) => e.t === 'bump')) sfx('bump'); else sfx('step');
      await animateMotion(motion, 680);
      if (events.some((e) => e.t === 'bump' && e.id === 'p0')) toast('Collision ! Vous êtes dos à dos. Cette case vous est fermée au prochain tour.', 'bad');
      else if (events.some((e) => e.t === 'blocked' && e.id === 'p0')) toast('Un magicien vous bloque le passage.', '');
    }
    for (const e of events.filter((x) => x.t === 'pickup')) {
      const g = pickupMeshes.get(e.at.x + ',' + e.at.y);
      if (g) { pickupGroup.remove(g); pickupMeshes.delete(e.at.x + ',' + e.at.y); }
      const p = cc(e.at.x, e.at.y); burst(p.x, 1.0, p.z, 34, PK_COL[e.kind], 2.8, false);
      const a = actors[e.id]; if (a) a.g.userData.bubble.visible = S.players.find((q) => q.id === e.id).shield;
      if (e.id === 'p0') { sfx('pick'); toast(e.kind === 'shield' ? 'Bouclier vert : le prochain sort est annulé.' : e.kind === 'phase' ? 'Bleu : vous pouvez traverser un mur, une fois.' : 'Jaune : tous les magiciens sont visibles ce tour.', ''); }
    }
    const shrink = events.find((e) => e.t === 'shrink');
    if (shrink) {
      sfx('mist');
      shrink.removed.forEach((w) => { const p = cc(w.x, w.y); burst(p.x + E.DX[w.d] * C / 2, 1.6, p.z + E.DY[w.d] * C / 2, 30, 0xb59a7a, 2.2, true); });
      const w = shrink.zone.x1 - shrink.zone.x0 + 1;
      toast(w > 1 ? 'La brume avance : zone de ' + w + ' sur ' + w + '.' : 'La brume se referme : seul le centre est épargné.', 'mist');
      events.filter((e) => e.t === 'death' && e.cause === 'mist').forEach((e) => killActor(e.id, 'mist'));
      buildMaze(); buildMist(); buildPickups();
      await sleep(700);
    }
    syncActors();
  }

  function killActor(id, cause, by) {
    const a = actors[id]; if (!a || a.dead) return;
    a.dead = true;
    const col = cause === 'mist' ? 0xa074e6 : ROBES[S.players.find((p) => p.id === id).color];
    burst(a.x, 1.2, a.z, 70, col, 3.6, true); burst(a.x, 1.5, a.z, 30, 0xf7dd8e, 3, true);
    sfx(id === 'p0' ? 'death' : 'zap');
    const g = a.g, s0 = g.scale.x;
    tween(420, (u) => { const s = s0 * (1 - ease(u)); g.scale.set(s, s * (1 + u * 0.3), s); if (u >= 1) g.visible = false; });
    if (id === 'p0') {
      const v = $('#vignette'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 1400);
      toast(cause === 'timeout' ? 'Temps écoulé : vous êtes éliminé.' : cause === 'mist' ? 'La brume vous a englouti.' : 'Vous avez été foudroyé par ' + (by && by.length ? nameOf(by[0]) : 'un magicien') + '.', 'bad');
    } else if (cause === 'mist') toast(nameOf(id) + ' a été englouti par la brume.', 'mist');
    else if (cause === 'timeout') toast(nameOf(id) + ' a été éliminé (temps écoulé).', '');
    else toast(nameOf(id) + ' a été éliminé' + (by && by.length ? ' par ' + (by[0] === 'p0' ? 'vous' : nameOf(by[0])) : '') + '.', by && by[0] === 'p0' ? '' : '');
  }

  async function animateMotion(evs, ms) {
    const tracks = [];
    evs.forEach((e) => {
      const a = actors[e.id]; if (!a) return;
      if (e.t === 'move' && e.through) { const m = cc((e.from.x + e.to.x) / 2, (e.from.y + e.to.y) / 2); burst(m.x, 1.3, m.z, 46, 0x62b6ff, 2.6, false); sfx('pick'); }
      if (e.t === 'move') tracks.push({ a, k: 'move', p0: cc(e.from.x, e.from.y), p1: cc(e.to.x, e.to.y), y0: a.yaw, y1: a.yaw - deltaF(e.f0, e.f1) * Math.PI / 2 });
      else if (e.t === 'bump') tracks.push({ a, k: 'bump', p0: cc(e.from.x, e.from.y), p1: cc(e.to.x, e.to.y), y0: a.yaw, y1: a.yaw - deltaF(e.f0, e.f1) * Math.PI / 2 });
      else if (e.t === 'blocked') tracks.push({ a, k: 'blocked', p0: cc(e.from.x, e.from.y), p1: cc(e.to.x, e.to.y) });
      else if (e.t === 'turn') tracks.push({ a, k: 'turn', y0: a.yaw, y1: a.yaw - deltaF(e.from, e.to) * Math.PI / 2 });
    });
    await tween(ms, (u) => {
      tracks.forEach((t) => {
        const a = t.a;
        if (t.k === 'move') { const s = ease(u); a.x = lerp(t.p0.x, t.p1.x, s); a.z = lerp(t.p0.z, t.p1.z, s); a.bob = Math.sin(u * TAU * 2) * 0.05; a.yaw = lerp(t.y0, t.y1, s); }
        else if (t.k === 'bump') {
          const s = u < 0.45 ? ease(u / 0.45) * 0.36 : 0.36 * (1 - ease((u - 0.45) / 0.55));
          a.x = lerp(t.p0.x, t.p1.x, s); a.z = lerp(t.p0.z, t.p1.z, s);
          a.yaw = lerp(t.y0, t.y1, ease(clamp01((u - 0.4) / 0.6)));
          a.bob = u > 0.38 && u < 0.7 ? Math.sin(u * 90) * 0.035 : 0;
        } else if (t.k === 'blocked') { const s = Math.sin(u * Math.PI) * 0.16; a.x = lerp(t.p0.x, t.p1.x, s); a.z = lerp(t.p0.z, t.p1.z, s); }
        else if (t.k === 'turn') a.yaw = lerp(t.y0, t.y1, ease(u));
      });
    });
    tracks.forEach((t) => {
      if (t.k === 'move') { t.a.x = t.p1.x; t.a.z = t.p1.z; t.a.yaw = t.y1; }
      else if (t.k === 'bump') { t.a.x = t.p0.x; t.a.z = t.p0.z; t.a.yaw = t.y1; }
      else if (t.k === 'blocked') { t.a.x = t.p0.x; t.a.z = t.p0.z; }
      else if (t.k === 'turn') t.a.yaw = t.y1;
      t.a.bob = 0;
    });
  }

  async function runTurn(humanActions, gen) {
    const actions = Object.assign({}, humanActions);
    S.players.forEach((p) => { if (p.alive && p.bot) actions[p.id] = E.botAction(S, p); });
    const res = E.resolveTurn(S, actions);
    await playTurn(res.events);
    if (gen !== G.gen) return;
    refreshHUD();
    if (S.over) { showEnd(); return; }
    if (!P0().alive && !G.spectating) startSpectating(gen);
  }

  async function submit(key) {
    if (G.busy || !S || S.over || G.spectating) return;
    const me = P0(); if (!me.alive) return;
    const mo = E.moveOptions(S, me);
    const map = { F: { type: 'move', dir: 'F' }, B: { type: 'move', dir: 'B' }, L: { type: 'move', dir: 'L' }, R: { type: 'move', dir: 'R' }, PL: { type: 'turn', side: 'L' }, PR: { type: 'turn', side: 'R' }, CAST: { type: 'cast' } };
    const a = map[key]; if (!a) return;
    if (a.type === 'move' && !mo[a.dir]) return;
    if (a.type === 'cast' && !E.spellTarget(S, me)) return;
    if (G.online) {
      if (!G.open || G.sent) return;
      G.sent = true; NET.send({ t: 'act', turn: S.turn, action: a }); refreshHUD();
      return;
    }
    G.busy = true; refreshControls();
    const gen = G.gen;
    await runTurn({ p0: a }, gen);
    if (gen !== G.gen) return;
    G.busy = false; if (!S.over) refreshControls();
  }

  async function startSpectating(gen) {
    G.spectating = true; document.body.classList.add('spectating'); G.busy = true;
    refreshHUD();
    toast('Le brouillard se lève : vous voyez tout le château.', '');
    makeTags();
    tween(2000, (u) => { G.topU = ease(u); });
    await sleep(1500);
    while (!G.online && !S.over && gen === G.gen) {
      await sleep(550);
      if (gen !== G.gen) return;
      await runTurn({}, gen);
    }
  }

  /* étiquettes de noms en vue du dessus */
  const tagBox = $('#tags'), tags = {};
  function clearTags() { tagBox.innerHTML = ''; Object.keys(tags).forEach((k) => delete tags[k]); }
  function makeTags() {
    clearTags();
    S.players.forEach((p) => {
      const d = document.createElement('div'); d.className = 'tag'; d.textContent = p.id === 'p0' ? 'Vous' : p.name;
      d.style.setProperty('--c', ROBES[p.color]); tagBox.appendChild(d); tags[p.id] = d;
    });
  }

  function showEnd() {
    const gen = G.gen;
    setTimeout(() => {
      if (gen !== G.gen) return;
      const win = S.winner, me = P0();
      $('#endTitle').textContent = win === 'p0' ? 'Dernier sortilège' : win ? nameOf(win) + ' l\'emporte' : 'Égalité';
      $('#endSub').textContent = win === 'p0' ? 'Vous êtes le dernier magicien debout.' : win ? 'Le château a un nouveau maître.' : 'La brume n\'a laissé personne.';
      $('#stTurns').textContent = S.turn - 1; $('#stKills').textContent = me.kills;
      $('#btnAgain').textContent = G.online ? 'Retour au salon' : 'Nouvelle partie';
      $('#end').hidden = false; if (win === 'p0') sfx('win');
    }, 1300);
  }

  /* ----- caméras et rendu ----- */
  let W = 300, H = 300;
  function resize() {
    const r = stage.getBoundingClientRect(); W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    renderer.setSize(W, H, false);
    uMax.value = 64 * renderer.getPixelRatio();
    if (post) post.setSize(Math.floor(W * renderer.getPixelRatio()), Math.floor(H * renderer.getPixelRatio()));
    const aspect = W / H;
    camMain.aspect = aspect;
    G.baseFov = Math.max(62, Math.min(96, (2 * Math.atan(Math.tan(39 * Math.PI / 180) / aspect) * 180) / Math.PI));
    camMain.fov = G.baseFov; camMain.aspect = aspect; camMain.updateProjectionMatrix();
    radarSize = Math.round(Math.max(96, Math.min(132, W * 0.3)));
    $('#app').style.setProperty('--radar', radarSize + 'px');
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  /* ----- lueur (bloom) maison : pas de bibliothèque externe, repli propre si le téléphone ne suit pas ----- */
  const post = (() => {
    try {
      if (!renderer.capabilities.isWebGL2) return null;
      const half = renderer.extensions.has('EXT_color_buffer_float');
      const o = { type: half ? T.HalfFloatType : T.UnsignedByteType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };
      const rtScene = new T.WebGLMultisampleRenderTarget(4, 4, Object.assign({}, o, { depthBuffer: true })); rtScene.samples = 4;
      const mk = () => new T.WebGLRenderTarget(4, 4, o);
      const rt = { s: rtScene, a: mk(), b: mk(), c: mk(), d: mk() };
      const quad = new T.Mesh(new T.PlaneGeometry(2, 2)), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new T.Scene(); sc.add(quad);
      const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      const M = (fs, u) => new T.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false });
      const bright = M('uniform sampler2D tex; uniform vec2 px; varying vec2 vUv;\n' +
        'vec3 f(vec2 o){ vec3 c = texture2D(tex, vUv + o).rgb; float m = max(max(c.r, c.g), c.b); return c * clamp((m - 0.72) / 0.55, 0.0, 1.6); }\n' +
        'void main(){ vec3 c = f(px * vec2(-1.5, -1.5)) + f(px * vec2(1.5, -1.5)) + f(px * vec2(-1.5, 1.5)) + f(px * vec2(1.5, 1.5)); gl_FragColor = vec4(c * 0.25, 1.0); }',
        { tex: { value: null }, px: { value: new T.Vector2() } });
      const blur = M('uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;\n' +
        'void main(){ vec3 c = texture2D(tex, vUv).rgb * 0.227027; vec2 o1 = dir * 1.3846153846, o2 = dir * 3.2307692308;\n' +
        '  c += (texture2D(tex, vUv + o1).rgb + texture2D(tex, vUv - o1).rgb) * 0.3162162162; c += (texture2D(tex, vUv + o2).rgb + texture2D(tex, vUv - o2).rgb) * 0.0702702703;\n' +
        '  gl_FragColor = vec4(c, 1.0); }', { tex: { value: null }, dir: { value: new T.Vector2() } });
      const comp = M('uniform sampler2D tScene; uniform sampler2D tA; uniform sampler2D tC; uniform float k1; uniform float k2; varying vec2 vUv;\n' +
        'void main(){ vec3 c = texture2D(tScene, vUv).rgb + texture2D(tA, vUv).rgb * k1 + texture2D(tC, vUv).rgb * k2; gl_FragColor = vec4(c, 1.0); }',
        { tScene: { value: null }, tA: { value: null }, tC: { value: null }, k1: { value: 0.55 }, k2: { value: 0.42 } });
      const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); };
      const dims = {};
      return {
        setSize(w, h) {
          rt.s.setSize(w, h);
          const qa = [Math.max(2, w >> 2), Math.max(2, h >> 2)], qc = [Math.max(2, w >> 3), Math.max(2, h >> 3)];
          rt.a.setSize(qa[0], qa[1]); rt.b.setSize(qa[0], qa[1]); rt.c.setSize(qc[0], qc[1]); rt.d.setSize(qc[0], qc[1]);
          dims.w = w; dims.h = h; dims.qa = qa; dims.qc = qc;
        },
        render(scn, camera) {
          renderer.setRenderTarget(rt.s); renderer.render(scn, camera);
          bright.uniforms.tex.value = rt.s.texture; bright.uniforms.px.value.set(1 / dims.w, 1 / dims.h); pass(bright, rt.a);
          blur.uniforms.tex.value = rt.a.texture; blur.uniforms.dir.value.set(1 / dims.qa[0], 0); pass(blur, rt.b);
          blur.uniforms.tex.value = rt.b.texture; blur.uniforms.dir.value.set(0, 1 / dims.qa[1]); pass(blur, rt.a);
          blur.uniforms.tex.value = rt.a.texture; blur.uniforms.dir.value.set(1 / dims.qc[0], 0); pass(blur, rt.c);
          blur.uniforms.tex.value = rt.c.texture; blur.uniforms.dir.value.set(0, 1 / dims.qc[1]); pass(blur, rt.d);
          blur.uniforms.tex.value = rt.d.texture; blur.uniforms.dir.value.set(1 / dims.qc[0], 0); pass(blur, rt.c);
          blur.uniforms.tex.value = rt.c.texture; blur.uniforms.dir.value.set(0, 1 / dims.qc[1]); pass(blur, rt.d);
          comp.uniforms.tScene.value = rt.s.texture; comp.uniforms.tA.value = rt.a.texture; comp.uniforms.tC.value = rt.d.texture;
          pass(comp, null);
        },
      };
    } catch (e) { return null; }
  })();

  /* qualité : haute (lueur, rayons, poussière) ou éco (plus léger pour les téléphones modestes) */
  G.hq = !!post;
  try { if (localStorage.getItem('ds-q') === 'eco') G.hq = false; } catch (e) { /* facultatif */ }
  function applyQuality() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.hq ? 1.75 : 1.25));
    document.querySelectorAll('.qLabel').forEach((e) => { e.textContent = post ? (G.hq ? 'Haute' : 'Éco') : 'Éco'; });
    resize();
  }

  /* vue du dessus : on passe de l'oeil du magicien à une caméra qui surplombe tout le château */
  const topPos = new T.Vector3(), topQuat = new T.Quaternion(), eyeQuat = new T.Quaternion(), eyePos = new T.Vector3(), tagV = new T.Vector3();
  function applyTopView(u) {
    const TILT = 0.2, fov = 42, half = (N * C) / 2 + 3;
    const tv = Math.tan((fov * Math.PI) / 360), asp = camMain.aspect;
    const h = Math.max(half / tv, half / (tv * asp)) * 1.04;
    topPos.set(N * C / 2, h * Math.cos(TILT), N * C / 2 + h * Math.sin(TILT));
    topQuat.setFromEuler(new T.Euler(-(Math.PI / 2 - TILT), 0, 0, 'YXZ'));
    eyePos.copy(camMain.position); eyeQuat.copy(camMain.quaternion);
    const s = ease(clamp01(u));
    camMain.position.lerpVectors(eyePos, topPos, s);
    camMain.quaternion.copy(eyeQuat).slerp(topQuat, s);
    camMain.fov = lerp(G.baseFov, fov, s); camMain.updateProjectionMatrix();
  }
  function updateTags() {
    tagBox.style.opacity = 1;
    camMain.updateMatrixWorld();
    const placed = [];
    S.players.forEach((p) => {
      const d = tags[p.id], a = actors[p.id]; if (!d || !a) return;
      if (!p.alive) { d.style.display = 'none'; return; }
      tagV.set(a.x, 4.2, a.z).project(camMain);
      let x = (tagV.x * 0.5 + 0.5) * W, y = (-tagV.y * 0.5 + 0.5) * H;
      for (let k = 0; k < 4; k++) if (placed.some((q) => Math.abs(q.x - x) < 74 && Math.abs(q.y - y) < 17)) y -= 18;
      placed.push({ x, y });
      d.style.display = '';
      d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-100%)';
    });
  }

  let tPrev = performance.now(), radarAcc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; const t = now / 1000;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], u = clamp01((now - tw.t0) / tw.ms);
      tw.fn(u); if (u >= 1) { tweens.splice(i, 1); tw.res(); }
    }
    if (!S) return;
    Object.keys(actors).forEach((id) => {
      const a = actors[id]; a.g.position.set(a.x, 0, a.z); a.g.rotation.y = a.yaw + Math.PI;
      const d = a.g.userData; d.halo.scale.setScalar(0.9 + Math.sin(t * 3 + d.bodyIdx) * 0.12); d.bubble.material.opacity = 0.16 + Math.sin(t * 2.4) * 0.05;
    });
    const f = actors[G.follow];
    const top = G.topU;
    if (f) {
      camMain.position.set(f.x, EYE + f.bob + Math.sin(t * 1.3) * 0.012, f.z);
      camMain.rotation.set(0, f.yaw, 0, 'YXZ');
    }
    if (top > 0) applyTopView(top);
    else if (camMain.fov !== G.baseFov) { camMain.fov = G.baseFov; camMain.updateProjectionMatrix(); }
    scene.fog.density = 0.024 * (1 - top); hemi.intensity = 0.72 + 0.6 * top; sun.intensity = 0.95 * top;
    if (ceiling) ceiling.visible = top < 0.35;
    if (mistLid) mistLid.visible = top > 0.5;
    if (shafts) shafts.visible = G.hq && top < 0.3;
    dust.visible = G.hq && top < 0.3; if (dust.visible) updateDust(t, dt, camMain.position);
    Object.keys(actors).forEach((id) => { const a = actors[id]; if (!a.dead) a.g.scale.setScalar(1 + 1.0 * top); });
    animateCandles(t); animatePickups(t); updateLightPool(t); updateParticles(dt); updateBeams(now);
    mistMat.uniforms.uTime.value = t;
    ringMat.opacity = ringStrength * (0.22 + 0.2 * Math.sin(t * 5));
    radarAcc += dt; if (radarAcc > 0.1) { radarAcc = 0; drawRadar(t); }
    const pr = renderer.getPixelRatio();
    uPx.value = H * pr;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    if (post && G.hq) post.render(scene, camMain); else { renderer.setRenderTarget(null); renderer.render(scene, camMain); }
    if (top > 0.5) updateTags();
    else if (tagBox.firstChild) tagBox.style.opacity = 0;
  }

  /* ----- commandes ----- */
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { sfx('step'); submit(b.dataset.act); }));
  const KEYS = { ArrowUp: 'F', ArrowDown: 'B', ArrowLeft: 'L', ArrowRight: 'R', z: 'F', w: 'F', s: 'B', q: 'L', d: 'R', a: 'PL', e: 'PR', ' ': 'CAST' };
  window.addEventListener('keydown', (ev) => {
    if (!$('#intro').hidden || !$('#lobby').hidden || !$('#pick').hidden || !$('#book').hidden || !$('#end').hidden) return;
    const k = KEYS[ev.key] || KEYS[(ev.key || '').toLowerCase()];
    if (!k) return; ev.preventDefault();
    const btn = document.querySelector('[data-act="' + k + '"]'); if (btn && !btn.disabled) submit(k);
  });
  const setPlayers = (n) => { n = Math.max(4, Math.min(12, n)); G.bots = n - 1; $('#nPlayers').textContent = n; $('#nMinus').disabled = n <= 4; $('#nPlus').disabled = n >= 12; };
  $('#nMinus').addEventListener('click', () => setPlayers(G.bots + 1 - 1));
  $('#nPlus').addEventListener('click', () => setPlayers(G.bots + 1 + 1));
  setPlayers(G.bots + 1);
  /* ----- multijoueur : salle + parties en ligne ----- */
  const MULTI = !!window.__MULTI__;
  const NET = {
    ws: null, room: null, you: null, chain: Promise.resolve(), toLocal: {}, toServer: {},
    session: null, seed: null, lastRx: 0, retry: 0, retryT: 0, reconnecting: false, since: 0,
    send(m) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(m)); },
  };
  const wsUrl = () => window.WS_URL || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const netHash = (s) => {
    let h = 2166136261 >>> 0; const f = (n) => { h ^= n & 0xffff; h = Math.imul(h, 16777619) >>> 0; };
    f(s.turn); s.players.forEach((p) => { f(p.alive ? 1 : 0); f(p.x); f(p.y); f(p.f); f(p.shield ? 1 : 0); f(p.phase ? 1 : 0); }); f(s.zone.x0); f(s.zone.x1);
    return h;
  };
  let lbErrT = 0;
  function lbError(msg) {
    const el = $('#lbRoom').hidden ? $('#lbErr') : $('#lbErr2'); el.textContent = msg;
    clearTimeout(lbErrT); lbErrT = setTimeout(() => { el.textContent = ''; }, 5000);
  }
  function netConnect() {
    if (NET.ws && NET.ws.readyState <= 1) return Promise.resolve();
    return new Promise((res, rej) => {
      let ws; try { ws = new WebSocket(wsUrl()); } catch (e) { return rej(e); }
      NET.ws = ws; const to = setTimeout(() => { try { ws.close(); } catch (e) { /* rien */ } rej(new Error('délai')); }, 8000);
      ws.onopen = () => { clearTimeout(to); NET.lastRx = Date.now(); res(); };
      ws.onerror = () => { clearTimeout(to); rej(new Error('connexion')); };
      ws.onmessage = (ev) => { NET.lastRx = Date.now(); let m; try { m = JSON.parse(ev.data); } catch (e) { return; } NET.chain = NET.chain.then(() => netHandle(m)).catch((e) => console.error(e)); };
      ws.onclose = () => { clearTimeout(to); if (NET.ws === ws) netClosed(); };
    });
  }
  setInterval(() => NET.send({ t: 'ping' }), 15000);

  /* ----- reprise de session : coupure réseau, changement wifi <-> 4G, écran verrouillé ----- */
  const SESSION_KEY = 'ds_session', RECONNECT_MAX_MS = 75000;
  function sessionSave(code, token) {
    NET.session = { code, token, t: Date.now() };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(NET.session)); } catch (e) { /* facultatif */ }
  }
  function sessionClear() {
    NET.session = null; NET.reconnecting = false; clearTimeout(NET.retryT); banner(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* facultatif */ }
  }
  function sessionLoad() {
    try { const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); if (s && s.code && s.token && Date.now() - s.t < 15 * 60000) return s; } catch (e) { /* rien */ }
    return null;
  }
  function banner(txt) { const el = $('#netBanner'); if (!el) return; el.hidden = !txt; if (txt) $('#netBannerTxt').textContent = txt; }
  function netClosed() {
    NET.ws = null;
    if (NET.session) { startReconnect(); return; }       // on était dans une salle : on tente de reprendre sa place
    NET.room = null;
    if (G.online) { G.online = false; G.open = false; timerStop(); toast('Connexion perdue.', 'bad'); showLobbyEntry('Connexion perdue.'); $('#end').hidden = true; }
    else if (!$('#lobby').hidden) showLobbyEntry('Connexion perdue.');
  }
  function startReconnect() {
    if (!NET.session) return;
    if (!NET.reconnecting) { NET.reconnecting = true; NET.since = Date.now(); NET.retry = 0; G.open = false; timerStop(); if (typeof refreshControls === 'function') refreshControls(); }
    banner('Connexion perdue · reconnexion…');
    clearTimeout(NET.retryT);
    const wait = Math.min(300 + NET.retry * 700, 3000);
    NET.retryT = setTimeout(tryReconnect, wait);
  }
  async function tryReconnect() {
    if (!NET.session || !NET.reconnecting) return;
    if (Date.now() - NET.since > RECONNECT_MAX_MS) return giveUp('Reconnexion impossible : vous avez quitté la partie.');
    NET.retry++;
    try { await netConnect(); } catch (e) { NET.ws = null; return startReconnect(); }
    NET.send({ t: 'rejoin', code: NET.session.code, token: NET.session.token });
  }
  function giveUp(msg) {
    const wasOnline = G.online;
    sessionClear(); NET.room = null; const w = NET.ws; NET.ws = null; try { if (w) w.close(); } catch (e) { /* rien */ }
    G.online = false; G.open = false; timerStop(); $('#end').hidden = true;
    if (wasOnline) toast(msg, 'bad');
    showLobbyEntry(msg);
  }
  // l'application revient au premier plan ou le réseau revient : on vérifie la ligne tout de suite
  function checkLine() {
    if (!NET.session) return;
    if (!NET.ws || NET.ws.readyState > 1) { if (!NET.reconnecting) NET.reconnecting = true, NET.since = Date.now(); startReconnect(); NET.retry = 0; clearTimeout(NET.retryT); NET.retryT = setTimeout(tryReconnect, 50); return; }
    const before = NET.lastRx; NET.send({ t: 'ping' });
    setTimeout(() => { if (NET.session && NET.lastRx === before && NET.ws) { const w = NET.ws; try { w.close(); } catch (e) { /* rien */ } if (NET.ws === w) { NET.ws = null; netClosed(); } } }, 3500);
  }
  window.addEventListener('online', checkLine);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkLine(); });
  setInterval(() => {   // ligne morte sans fermeture visible (coupure silencieuse) : aucun message depuis 40 s
    if (NET.session && NET.ws && NET.ws.readyState === 1 && Date.now() - NET.lastRx > 40000) { const w = NET.ws; try { w.close(); } catch (e) { /* rien */ } if (NET.ws === w) { NET.ws = null; netClosed(); } }
  }, 5000);
  function showLobbyEntry(msg) {
    $('#intro').hidden = true; $('#pick').hidden = true; $('#lobby').hidden = false;
    $('#lbEntry').hidden = false; $('#lbRoom').hidden = true; $('#lbErr').textContent = msg || '';
    $('#lbName').value = ($('#lbName').value || localStorage_get('ds_name') || '');
  }
  function localStorage_get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function localStorage_set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } }
  const myName = () => { const n = ($('#lbName').value || '').trim().slice(0, 14) || 'Magicien'; localStorage_set('ds_name', n); return n; };

  /* grille de couleurs (miniatures 3D) : pastilles déjà prises grisées */
  function renderColors(grid, selected, takenBy, onPick) {
    const th = makeThumbs(); grid.innerHTML = '';
    ROBES.forEach((hex, i) => {
      const b = document.createElement('button'); b.className = 'wz'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === selected ? 'true' : 'false');
      b.style.setProperty('--c', hex); b.title = ROBE_NAMES[i] + (takenBy[i] ? ' (pris par ' + takenBy[i] + ')' : '');
      if (takenBy[i] && i !== selected) b.disabled = true;
      const c2 = document.createElement('canvas'); c2.width = th[i].width; c2.height = th[i].height; c2.getContext('2d').drawImage(th[i], 0, 0); b.appendChild(c2);
      b.addEventListener('click', () => { if (!b.disabled) onPick(i); });
      grid.appendChild(b);
    });
  }
  function renderRoom() {
    const r = NET.room; if (!r) return;
    $('#lbEntry').hidden = true; $('#lbRoom').hidden = false; $('#lobby').hidden = false;
    $('#intro').hidden = true; $('#pick').hidden = true;
    $('#lbCodeShow').textContent = r.code;
    const ul = $('#lbPlayers'); ul.innerHTML = '';
    const taken = {};
    r.players.forEach((p) => {
      taken[p.color] = p.id === r.you ? null : p.name;
      const li = document.createElement('li'); if (!p.connected) li.className = 'off'; li.style.setProperty('--c', ROBES[p.color]);
      li.innerHTML = '<i></i><span></span>'; li.querySelector('span').textContent = p.name + (p.id === r.you ? ' (vous)' : '');
      if (p.id === r.host) { const e = document.createElement('em'); e.textContent = 'hôte'; li.appendChild(e); }
      ul.appendChild(li);
    });
    for (let i = 0; i < r.bots; i++) { const li = document.createElement('li'); li.style.setProperty('--c', '#7a6a86'); li.innerHTML = '<i></i><span></span><em>bot</em>'; li.querySelector('span').textContent = NAMES[i]; ul.appendChild(li); }
    const me = r.players.find((p) => p.id === r.you);
    renderColors($('#lbGrid'), me ? me.color : 0, taken, (i) => { G.color = i; localStorage_set('ds_color', String(i)); NET.send({ t: 'color', color: i }); });
    const isHost = r.host === r.you, total = r.players.length + r.bots;
    $('#lbHost').hidden = !isHost; $('#lbWait').hidden = isHost;
    $('#lbBots').textContent = r.bots; $('#lbBotMinus').disabled = r.bots <= 0; $('#lbBotPlus').disabled = total >= r.max;
    $('#lbStart').disabled = total < r.min;
    $('#lbTotal').textContent = total + (total > 1 ? ' magiciens' : ' magicien') + (total < r.min ? ' · il en faut au moins ' + r.min + ' (ajoutez des bots)' : '') ;
  }

  function startOnline(m, history) {
    G.gen++; G.online = true; G.busy = false; G.open = false; G.sent = false; G.prog = null; G.spectating = false; G.follow = 'p0'; G.topU = 0; clearTags(); timerStop();
    document.body.classList.remove('spectating'); $('#toasts').innerHTML = '';
    const myIdx = m.players.findIndex((p) => p.id === m.you);
    NET.toLocal = {}; NET.toServer = {};
    const players = m.players.map((p, i) => { const lid = i === myIdx ? 'p0' : 'q' + i; NET.toLocal[p.id] = lid; NET.toServer[lid] = p.id; return { id: lid, name: p.name, color: p.color, bot: p.bot }; });
    S = E.createGame({ seed: m.seed, players });
    NET.seed = m.seed;
    // reprise : on rejoue d'un coup les tours déjà joués (sans animation) pour retrouver l'état exact du serveur
    (history || []).forEach((h) => {
      (h.kicks || []).forEach((id) => E.forfeit(S, NET.toLocal[id]));
      if (!S.over) { const actions = {}; Object.keys(h.actions).forEach((sid) => { actions[NET.toLocal[sid]] = h.actions[sid]; }); E.resolveTurn(S, actions); }
    });
    buildWorld(); setFollow('p0');
    ['#lobby', '#intro', '#pick', '#end'].forEach((s) => { $(s).hidden = true; });
    refreshHUD();
    if (!history) toast('Le château s\'éveille. Tour 1.', '');
  }

  async function netHandle(m) {
    if (m.t === 'gone') { giveUp('Cette partie n\'existe plus (ou vous en avez été retiré).'); return; }
    if (m.t === 'resume') {
      NET.reconnecting = false; clearTimeout(NET.retryT); banner(null);
      const same = G.online && S && NET.seed === m.seed && S.turn === m.turn;
      if (!same) startOnline(m, m.history);
      G.open = false; G.sent = false; G.prog = null;
      if (S.players.find((p) => p.id === 'p0') && !P0().alive && !G.spectating && !S.over) startSpectating(G.gen);
      if (m.open) { G.open = true; G.sent = !!m.acted; if (P0().alive && !G.spectating && !m.acted) { lastSec = -1; timerStart(m.ms); } }
      refreshHUD(); refreshControls();
      toast('Reconnecté.', '');
      return;
    }
    if (m.t === 'room') {
      if (m.token) sessionSave(m.code, m.token);
      if (NET.reconnecting) { NET.reconnecting = false; clearTimeout(NET.retryT); banner(null); toast('Reconnecté.', ''); }
      NET.room = m; NET.you = m.you;
      if (G.online) return;          // pendant la partie (et son écran de fin) : on garde simplement l'état du salon
      renderRoom();
      return;
    }
    if (m.t === 'err') { lbError(m.msg); return; }
    if (m.t === 'start') { startOnline(m); return; }
    if (!G.online || !S) return;
    if (m.t === 'progress') { G.prog = { done: m.done, total: m.total }; timerPaint(); return; }
    if (m.t === 'open') {
      G.open = true; G.sent = false; G.prog = null;
      if (P0().alive && !G.spectating) { lastSec = -1; timerStart(m.ms); }
      refreshHUD();
      return;
    }
    if (m.t === 'turn') {
      const gen = G.gen;
      G.open = false; G.sent = false; timerStop(); refreshControls();
      const kicked = (m.kicks || []).map((id) => NET.toLocal[id]);
      kicked.forEach((lid) => { E.forfeit(S, lid); killActor(lid, 'timeout'); });
      if (!S.over) {
        const actions = {}; Object.keys(m.actions).forEach((sid) => { actions[NET.toLocal[sid]] = m.actions[sid]; });
        const res = E.resolveTurn(S, actions);
        await playTurn(res.events);
      } else await sleep(900);
      if (gen !== G.gen) return;
      if (netHash(S) !== m.hash) { console.warn('désynchronisation avec le serveur au tour', m.turn); toast('Désynchronisation détectée : relancez la partie.', 'bad'); }
      refreshHUD();
      if (S.over) { showEnd(); return; }
      if (!P0().alive && !G.spectating) startSpectating(gen);
    }
  }

  if (MULTI) {
    $('#btnMulti').hidden = false;
    $('#btnMulti').addEventListener('click', () => { sfx('step'); showLobbyEntry(); });
    $('#lbBack').addEventListener('click', () => { $('#lobby').hidden = true; $('#intro').hidden = false; });
    const enter = async (msg) => {
      $('#lbErr').textContent = '';
      try { await netConnect(); } catch (e) { return lbError('Impossible de joindre le serveur.'); }
      NET.send(Object.assign({ name: myName(), color: G.color }, msg));
    };
    $('#lbCreate').addEventListener('click', () => { sfx('step'); enter({ t: 'create' }); });
    $('#lbJoin').addEventListener('click', () => {
      sfx('step'); const code = ($('#lbCode').value || '').toUpperCase().trim();
      if (code.length !== 4) return lbError('Le code comporte 4 lettres.');
      enter({ t: 'join', code });
    });
    $('#lbCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $('#lbCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#lbJoin').click(); });
    $('#lbBotMinus').addEventListener('click', () => NET.send({ t: 'bots', n: NET.room.bots - 1 }));
    $('#lbBotPlus').addEventListener('click', () => NET.send({ t: 'bots', n: NET.room.bots + 1 }));
    $('#lbStart').addEventListener('click', () => { sfx('step'); NET.send({ t: 'start' }); });
    $('#lbLeave').addEventListener('click', () => { NET.send({ t: 'leave' }); sessionClear(); NET.room = null; $('#lobby').hidden = true; $('#intro').hidden = false; });
    $('#lbShare').addEventListener('click', async () => {
      const url = location.href.split('#')[0] + '#' + NET.room.code, b = $('#lbShare');
      try { await navigator.clipboard.writeText(url); b.textContent = 'Lien copié !'; } catch (e) { b.textContent = url; }
      setTimeout(() => { b.textContent = 'Copier le lien d\'invitation'; }, 2500);
    });
    // lien d'invitation : #CODE
    const fromHash = () => { const m = /^#([A-Za-z]{4})$/.exec(location.hash); if (m) { $('#lbCode').value = m[1].toUpperCase(); showLobbyEntry(); } };
    window.addEventListener('hashchange', fromHash);
    window.__lobbyFromHash = fromHash;
  }

  /* ----- sélection du magicien ----- */
  try { const c = parseInt(localStorage.getItem('ds_color'), 10); if (c >= 0 && c < ROBES.length) G.color = c; } catch (e) { /* stockage indisponible */ }
  let thumbs = null;
  function makeThumbs() {
    if (thumbs) return thumbs;
    thumbs = [];
    const W = 144, H = 200, r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(W, H, false); r.setPixelRatio(1);
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(26, W / H, 0.1, 30);
    sc.add(new T.HemisphereLight(0xffe2b8, 0x2a1838, 0.95));
    const key = new T.DirectionalLight(0xfff0d0, 1.05); key.position.set(2, 3, 4); sc.add(key);
    const rim = new T.DirectionalLight(0x9c7cff, 0.5); rim.position.set(-3, 2, -2); sc.add(rim);
    cam.position.set(0, 1.12, 5.9); cam.lookAt(0, 1.02, 0);
    ROBES.forEach((hex, i) => {
      const w = buildWizard(hex, i); w.userData.bubble.visible = false; w.rotation.y = 0.45;
      w.children.forEach((c) => { if (c.material && c.material.map === assets.star) c.visible = false; });
      sc.add(w); r.setClearColor(0x000000, 0); r.render(sc, cam);
      const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H;
      cv2.getContext('2d').drawImage(r.domElement, 0, 0, W, H);
      thumbs.push(cv2); sc.remove(w);
    });
    r.dispose(); try { r.forceContextLoss(); } catch (e) { /* rien */ }
    return thumbs;
  }
  function buildPick() {
    const grid = $('#wgrid'); grid.innerHTML = '';
    const th = makeThumbs();
    ROBES.forEach((hex, i) => {
      const b = document.createElement('button'); b.className = 'wz'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === G.color ? 'true' : 'false');
      b.style.setProperty('--c', hex); b.dataset.i = i;
      const sw = document.createElement('i'); sw.className = 'sw'; b.appendChild(sw);
      b.appendChild(th[i]); b.appendChild(document.createTextNode(ROBE_NAMES[i]));
      grid.appendChild(b);
    });
  }
  $('#wgrid').addEventListener('click', (ev) => {
    const b = ev.target.closest('.wz'); if (!b || b.disabled) return;
    G.color = +b.dataset.i; sfx('step');
    document.querySelectorAll('.wz').forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
    try { localStorage.setItem('ds_color', String(G.color)); } catch (e) { /* stockage indisponible */ }
  });
  $('#btnStart').addEventListener('click', () => { sfx('step'); buildPick(); $('#intro').hidden = true; $('#pick').hidden = false; });
  $('#btnPickBack').addEventListener('click', () => { $('#pick').hidden = true; $('#intro').hidden = false; });
  $('#btnGo').addEventListener('click', () => { sfx('step'); $('#pick').hidden = true; startGame(); });
  $('#btnHome').addEventListener('click', () => {
    sfx('step'); $('#end').hidden = true;
    if (NET.room || G.online) {                       // en ligne : on quitte la salle et la connexion
      NET.send({ t: 'leave' }); sessionClear(); const w = NET.ws; NET.ws = null; NET.room = null; try { if (w) w.close(); } catch (e) { /* rien */ }
    }
    G.gen++; G.online = false; G.open = false; G.sent = false; G.busy = false; G.spectating = false; G.topU = 0; G.follow = 'p0';
    document.body.classList.remove('spectating'); clearTags(); timerStop(); $('#toasts').innerHTML = '';
    S = E.createGame({ seed: 20261013, players: [{ id: 'p0', name: 'Vous' }, { id: 'p1', name: NAMES[0], bot: true }, { id: 'p2', name: NAMES[1], bot: true }] });
    buildWorld(); setFollow('p0'); refreshHUD();
    ['#lobby', '#pick'].forEach((s) => { $(s).hidden = true; });
    $('#intro').hidden = false;
  });
  $('#btnAgain').addEventListener('click', () => {
    sfx('step'); $('#end').hidden = true;
    if (G.online || NET.room) { G.online = false; if (NET.room) renderRoom(); else showLobbyEntry(); } else startGame();
  });
  const openBook = () => { $('#book').hidden = false; };
  $('#btnBook').addEventListener('click', openBook); $('#btnBook2').addEventListener('click', openBook);
  $('#btnBookClose').addEventListener('click', () => { $('#book').hidden = true; });
  document.querySelectorAll('.btnQ').forEach((b) => b.addEventListener('click', () => {
    if (!post) return;
    G.hq = !G.hq; try { localStorage.setItem('ds-q', G.hq ? 'high' : 'eco'); } catch (e) { /* facultatif */ }
    applyQuality(); toast(G.hq ? 'Qualité haute : lueurs, rayons de vitraux, poussière.' : 'Mode éco : rendu allégé.', '');
  }));
  $('#btnSound').addEventListener('click', () => {
    G.sound = !G.sound; const b = $('#btnSound'); b.setAttribute('aria-pressed', G.sound ? 'false' : 'true');
    b.setAttribute('aria-label', G.sound ? 'Couper le son' : 'Activer le son');
    $('#sndWaves').style.display = G.sound ? '' : 'none';
  });

  /* ----- démarrage (on attend le décodage des images, avec une limite de temps) ----- */
  Promise.race([loadImages(), sleep(6000)]).then(() => {
    initAssets();
    applyQuality();
    S = E.createGame({ seed: 20261013, players: [{ id: 'p0', name: 'Vous' }, { id: 'p1', name: NAMES[0], bot: true }, { id: 'p2', name: NAMES[1], bot: true }] });
    buildWorld(); setFollow('p0'); refreshHUD();
    requestAnimationFrame(frame);
    $('#loading').remove();
    $('#intro').hidden = false;
    if (window.__lobbyFromHash) window.__lobbyFromHash();
    // page rechargée (ou onglet restauré) en pleine partie : on reprend sa place
    if (MULTI) { const sv = sessionLoad(); if (sv) { NET.session = sv; NET.reconnecting = true; NET.since = Date.now(); NET.retry = 0; $('#intro').hidden = true; banner('Reprise de la partie…'); tryReconnect(); } }
    window.__ds = { G, E, NET, actors, camMain, scene, rebuild() { buildWorld(); setFollow('p0'); refreshHUD(); }, get S() { return S; }, submit, startGame, sync() { syncActors(); refreshHUD(); } };
  });
})();
