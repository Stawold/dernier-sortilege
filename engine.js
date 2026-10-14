/* Dernier Sortilège : moteur de règles pur (aucun accès au DOM).
   Le même fichier servira côté navigateur et, plus tard, côté serveur. */
(function (root) {
  'use strict';

  const N = 13;                       // impair : une vraie case centrale existe
  const CX = (N - 1) / 2, CY = (N - 1) / 2;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const OPP = (d) => (d + 2) & 3;
  const LEFT = (d) => (d + 3) & 3;
  const RIGHT = (d) => (d + 1) & 3;
  const K = (x, y) => y * N + x;

  /* ---------- hasard reproductible (l'état vit dans S.rs) ---------- */
  function rand(S) {
    S.rs = (S.rs + 0x6D2B79F5) | 0;
    let t = S.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (S, n) => Math.floor(rand(S) * n);
  // flux aléatoire à part pour les bots : seul le serveur les fait jouer, il ne doit pas décaler le hasard de la partie
  function randBot(S) {
    S.rb = ((S.rb === undefined ? S.seed ^ 0x5bd1e995 : S.rb) + 0x6D2B79F5) | 0;
    let t = S.rb;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(S, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(S, i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- labyrinthe ---------- */
  function openWall(open, x, y, d) {
    open[K(x, y)] |= 1 << d;
    open[K(x + DX[d], y + DY[d])] |= 1 << OPP(d);
  }

  function makeMaze(S, braid) {
    const open = new Array(N * N).fill(0);
    const seen = new Array(N * N).fill(false);
    let cx = randInt(S, N), cy = randInt(S, N);
    const stack = [[cx, cy]];
    seen[K(cx, cy)] = true;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const nb = [];
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[K(nx, ny)]) nb.push(d);
      }
      if (!nb.length) { stack.pop(); continue; }
      const d = nb[randInt(S, nb.length)];
      openWall(open, x, y, d);
      seen[K(x + DX[d], y + DY[d])] = true;
      stack.push([x + DX[d], y + DY[d]]);
    }
    // quelques boucles pour que les croisements et les fuites existent
    const walls = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (x < N - 1 && !(open[K(x, y)] & 2)) walls.push([x, y, 1]);
        if (y < N - 1 && !(open[K(x, y)] & 4)) walls.push([x, y, 2]);
      }
    }
    shuffle(S, walls);
    const k = Math.round(walls.length * braid);
    for (let i = 0; i < k; i++) openWall(open, walls[i][0], walls[i][1], walls[i][2]);
    // la case centrale (refuge final) est toujours ouverte sur ses 4 côtés : on l'atteint par les 4 axes orthogonaux
    for (let d = 0; d < 4; d++) if (!((open[K(CX, CY)] >> d) & 1)) openWall(open, CX, CY, d);
    return { open };
  }

  const inZone = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;

  // passage ouvert ET case d'arrivée encore dans la zone (la brume est un mur)
  function hasPassage(S, x, y, d) {
    if (!((S.maze.open[K(x, y)] >> d) & 1)) return false;
    return inZone(S.zone, x + DX[d], y + DY[d]);
  }

  function components(S) {
    const z = S.zone;
    const comp = new Array(N * N).fill(-1);
    let n = 0;
    for (let y = z.y0; y <= z.y1; y++) {
      for (let x = z.x0; x <= z.x1; x++) {
        if (comp[K(x, y)] !== -1) continue;
        const q = [[x, y]];
        comp[K(x, y)] = n;
        for (let i = 0; i < q.length; i++) {
          const [cx, cy] = q[i];
          for (let d = 0; d < 4; d++) {
            if (!hasPassage(S, cx, cy, d)) continue;
            const nx = cx + DX[d], ny = cy + DY[d];
            if (comp[K(nx, ny)] === -1) { comp[K(nx, ny)] = n; q.push([nx, ny]); }
          }
        }
        n++;
      }
    }
    return { comp, n };
  }

  // après un rétrécissement, on abat quelques murs pour que la zone reste d'un seul tenant
  function connectZone(S) {
    const z = S.zone;
    const removed = [];
    for (;;) {
      const { comp, n } = components(S);
      if (n <= 1) break;
      const cands = [];
      for (let y = z.y0; y <= z.y1; y++) {
        for (let x = z.x0; x <= z.x1; x++) {
          for (const d of [1, 2]) {
            const nx = x + DX[d], ny = y + DY[d];
            if (!inZone(z, nx, ny)) continue;
            if ((S.maze.open[K(x, y)] >> d) & 1) continue;
            if (comp[K(x, y)] !== comp[K(nx, ny)]) cands.push([x, y, d]);
          }
        }
      }
      const w = cands[randInt(S, cands.length)];
      openWall(S.maze.open, w[0], w[1], w[2]);
      removed.push({ x: w[0], y: w[1], d: w[2] });
    }
    return removed;
  }

  /* ---------- création de partie ---------- */
  function spawnCells(S, n) {
    const all = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!(x === CX && y === CY)) all.push({ x, y });   // personne n'apparaît au centre
    const chosen = [all[randInt(S, all.length)]];
    while (chosen.length < n) {
      let best = null, bestScore = -1;
      for (const c of all) {
        let m = 99;
        for (const o of chosen) m = Math.min(m, Math.abs(c.x - o.x) + Math.abs(c.y - o.y));
        const s = m + rand(S) * 1.5;
        if (s > bestScore) { bestScore = s; best = c; }
      }
      chosen.push(best);
    }
    return chosen;
  }

  function createGame(opts) {
    const S = { seed: 0, rs: 0 };
    S.seed = (opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 2147483647)) | 0;
    S.rs = S.seed;
    S.maze = makeMaze(S, 0.2);
    S.zone = { x0: 0, y0: 0, x1: N - 1, y1: N - 1 };
    S.turn = 1;
    S.hold = 0;
    S.finalCell = { x: CX, y: CY };   // refuge : la brume ne l'atteint jamais
    S.over = false;
    S.winner = null;
    const cells = spawnCells(S, opts.players.length);
    S.players = opts.players.map((p, i) => {
      const c = cells[i];
      const dirs = [0, 1, 2, 3].filter((d) => (S.maze.open[K(c.x, c.y)] >> d) & 1);
      return {
        id: p.id, name: p.name, color: p.color !== undefined ? p.color : i, bot: !!p.bot,
        x: c.x, y: c.y, f: dirs[randInt(S, dirs.length)],
        alive: true, shield: false, crystal: false, phase: false, banned: null,
        kills: 0, diedTurn: 0, last: null,
        seen: new Array(N * N).fill(0),
      };
    });
    const taken = new Set(cells.map((c) => K(c.x, c.y)));
    const free = [];
    for (let i = 0; i < N * N; i++) if (!taken.has(i) && i !== K(CX, CY)) free.push(i);
    shuffle(S, free);
    const kinds = ['phase', 'shield', 'crystal'];   // 3 bonus par carte : bleu (traverser un mur), vert (bouclier), jaune (révélation)
    S.pickups = kinds.map((kind, i) => ({ kind, x: free[i] % N, y: Math.floor(free[i] / N) }));
    S.players.forEach((p) => reveal(S, p));
    return S;
  }

  /* ---------- vision ---------- */
  // devant : jusqu'au mur ou à la brume ; sur les côtés : seulement la case voisine
  function visibleFrom(S, p) {
    const line = [{ x: p.x, y: p.y }];
    let x = p.x, y = p.y;
    while (hasPassage(S, x, y, p.f)) {
      x += DX[p.f]; y += DY[p.f];
      line.push({ x, y });
    }
    const side = [];
    for (const d of [LEFT(p.f), RIGHT(p.f)]) {
      if (hasPassage(S, p.x, p.y, d)) side.push({ x: p.x + DX[d], y: p.y + DY[d], d });
    }
    return { line, side };
  }

  function reveal(S, p) {
    const v = visibleFrom(S, p);
    v.line.forEach((c) => { p.seen[K(c.x, c.y)] = 1; });
    v.side.forEach((c) => { p.seen[K(c.x, c.y)] = 1; });
  }

  function playerAt(S, x, y, except) {
    for (const q of S.players) if (q.alive && q !== except && q.x === x && q.y === y) return q;
    return null;
  }

  function visiblePlayers(S, p) {
    const v = visibleFrom(S, p);
    const out = [];
    for (const c of v.line.concat(v.side)) {
      const q = playerAt(S, c.x, c.y, p);
      if (q) out.push(q);
    }
    return out;
  }

  /* ---------- sort ---------- */
  // tout droit, portée illimitée, frappe le premier magicien rencontré
  // s'il n'est pas tourné vers le lanceur (de dos ou de profil)
  function spellTarget(S, p, facing) {
    const f = facing === undefined ? p.f : facing;
    let x = p.x, y = p.y;
    while (hasPassage(S, x, y, f)) {
      x += DX[f]; y += DY[f];
      const q = playerAt(S, x, y, p);
      if (q) return q.f === OPP(f) ? null : q;
    }
    return null;
  }

  const dirFor = (p, which) =>
    which === 'F' ? p.f : which === 'B' ? OPP(p.f) : which === 'L' ? LEFT(p.f) : RIGHT(p.f);

  function moveOptions(S, p) {
    const out = {};
    for (const w of ['F', 'B', 'L', 'R']) {
      const d = dirFor(p, w);
      let ok = hasPassage(S, p.x, p.y, d);
      // bonus bleu : avancer ou reculer à travers un mur (une seule fois), sans sortir de la zone
      if (!ok && p.phase && (w === 'F' || w === 'B')) {
        const tx = p.x + DX[d], ty = p.y + DY[d];
        ok = tx >= 0 && ty >= 0 && tx < N && ty < N && inZone(S.zone, tx, ty);
      }
      if (ok && p.banned && p.banned.turn === S.turn && p.banned.x === p.x + DX[d] && p.banned.y === p.y + DY[d]) ok = false;
      out[w] = ok;
    }
    return out;
  }

  /* ---------- zone ---------- */
  const FIRST_SHRINK = 10, SHRINK_EVERY = 5;
  const MAX_HOLD = 10;   // la dernière fermeture attend au plus 10 tours qu'un magicien soit au centre
  const centerHolder = (S) => S.players.find((p) => p.alive && p.x === CX && p.y === CY) || null;
  function turnsToShrink(S) {
    const w = S.zone.x1 - S.zone.x0 + 1;
    if (w <= 1) return -1;
    const t = S.turn < FIRST_SHRINK ? FIRST_SHRINK - S.turn : (SHRINK_EVERY - ((S.turn - FIRST_SHRINK) % SHRINK_EVERY)) % SHRINK_EVERY;
    // dernière fermeture : elle n'a lieu que lorsqu'un magicien tient le centre (-2 : la brume attend qu'on l'occupe)
    if (w === 3 && (t === 0 || S.hold > 0)) return centerHolder(S) ? 0 : -2;
    return t;
  }

  // la zone reste centrée : elle perd une rangée sur chaque bord, jusqu'à la seule case centrale
  function nextZone(S) {
    const z = S.zone;
    if (z.x1 - z.x0 + 1 <= 1) return null;
    return { x0: z.x0 + 1, y0: z.y0 + 1, x1: z.x1 - 1, y1: z.y1 - 1 };
  }

  function shrinkZone(S, ev) {
    const nz = nextZone(S);
    if (!nz) return;
    S.zone = nz;
    const removed = connectZone(S);
    S.pickups = S.pickups.filter((k) => inZone(nz, k.x, k.y));
    const mist = [];
    for (const p of S.players) {
      if (p.alive && !inZone(nz, p.x, p.y)) {
        p.alive = false; p.diedTurn = S.turn;
        mist.push(p.id);
        ev.push({ t: 'death', id: p.id, cause: 'mist', at: { x: p.x, y: p.y } });
      }
    }
    ev.push({ t: 'shrink', zone: nz, finalCell: S.finalCell, removed, mist });
  }

  /* ---------- résolution d'un tour ---------- */
  function resolveTurn(S, actions) {
    const ev = [];
    if (S.over) return { events: ev };
    const turn = S.turn;
    const alive = S.players.filter((p) => p.alive);
    alive.forEach((p) => { p.crystal = false; if (p.banned && p.banned.turn < turn) p.banned = null; });

    const act = {};
    for (const p of alive) {
      const a = actions[p.id] || { type: 'wait' };
      const mo = moveOptions(S, p);
      if (a.type === 'move') {
        if (mo[a.dir]) act[p.id] = a;
        // gauche / droite contre un mur : on pivote sur place
        else if (a.dir === 'L' || a.dir === 'R') act[p.id] = { type: 'turn', side: a.dir };
        else act[p.id] = { type: 'wait', invalid: true };
      } else if (a.type === 'turn') {
        // pivoter sur place : toujours possible (un quart de tour, sans bouger)
        act[p.id] = a.side === 'L' || a.side === 'R' ? a : { type: 'wait', invalid: true };
      } else if (a.type === 'cast') {
        act[p.id] = a;
      } else {
        act[p.id] = { type: 'wait' };
      }
    }

    /* 1. sorts, tous calculés depuis l'état de début de tour */
    const hits = new Map();
    const castList = [];
    for (const p of alive) {
      if (act[p.id].type !== 'cast') continue;
      const q = spellTarget(S, p);
      castList.push({ p, q });
      if (q) hits.set(q.id, (hits.get(q.id) || []).concat(p.id));
    }
    const dead = new Set();
    const result = {};
    for (const [tid, casters] of hits) {
      const q = S.players.find((x) => x.id === tid);
      const shielded = q.shield;
      casters.forEach((cid, i) => { result[cid] = shielded && i === 0 ? 'shield' : 'kill'; });
      if (shielded) { q.shield = false; }
      if (casters.length > (shielded ? 1 : 0)) dead.add(tid);
    }
    for (const { p, q } of castList) {
      ev.push({
        t: 'cast', id: p.id, from: { x: p.x, y: p.y, f: p.f },
        target: q ? q.id : null, to: q ? { x: q.x, y: q.y } : null,
        res: q ? result[p.id] : 'fizzle',
      });
      if (q && result[p.id] === 'kill') p.kills++;
    }
    for (const id of dead) {
      const q = S.players.find((x) => x.id === id);
      q.alive = false; q.diedTurn = turn;
      ev.push({ t: 'death', id, cause: 'spell', by: hits.get(id), at: { x: q.x, y: q.y } });
    }

    /* 2. déplacements des survivants */
    const survivors = alive.filter((p) => p.alive);
    const movers = [];
    for (const p of survivors) {
      const a = act[p.id];
      if (a.type !== 'move') continue;
      const d = dirFor(p, a.dir);
      movers.push({ p, d, nx: p.x + DX[d], ny: p.y + DY[d], side: a.dir === 'L' || a.dir === 'R' });
    }
    const failed = new Set();
    const bumpKind = new Map();
    const byDest = new Map();
    movers.forEach((m) => {
      const k = K(m.nx, m.ny);
      if (!byDest.has(k)) byDest.set(k, []);
      byDest.get(k).push(m);
    });
    for (const g of byDest.values()) {
      if (g.length >= 2) g.forEach((m) => { failed.add(m.p.id); bumpKind.set(m.p.id, m); });
    }
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        if (a.nx === b.p.x && a.ny === b.p.y && b.nx === a.p.x && b.ny === a.p.y) {
          failed.add(a.p.id); failed.add(b.p.id);
          bumpKind.set(a.p.id, a); bumpKind.set(b.p.id, b);
        }
      }
    }
    const bumped = new Set(failed);
    const blockedBy = new Map();
    let changed = true;
    while (changed) {
      changed = false;
      const stays = new Map();
      for (const p of survivors) {
        const m = movers.find((mm) => mm.p === p);
        if (!m || failed.has(p.id)) stays.set(K(p.x, p.y), p);
      }
      for (const m of movers) {
        if (failed.has(m.p.id)) continue;
        const blocker = stays.get(K(m.nx, m.ny));
        if (blocker) { failed.add(m.p.id); blockedBy.set(m.p.id, blocker.id); changed = true; }
      }
    }
    for (const m of movers) {
      const p = m.p;
      if (bumped.has(p.id)) {
        const nf = OPP(m.d);
        ev.push({ t: 'bump', id: p.id, to: { x: m.nx, y: m.ny }, from: { x: p.x, y: p.y }, f0: p.f, f1: nf });
        p.f = nf;
        p.banned = { x: m.nx, y: m.ny, turn: turn + 1 };
      } else if (failed.has(p.id)) {
        ev.push({ t: 'blocked', id: p.id, to: { x: m.nx, y: m.ny }, from: { x: p.x, y: p.y }, by: blockedBy.get(p.id) });
      }
    }
    for (const m of movers) {
      if (failed.has(m.p.id)) continue;
      const f0 = m.p.f, f1 = m.side ? m.d : m.p.f;
      const through = !hasPassage(S, m.p.x, m.p.y, m.d);
      if (through) m.p.phase = false;
      ev.push({ t: 'move', id: m.p.id, from: { x: m.p.x, y: m.p.y }, to: { x: m.nx, y: m.ny }, f0, f1, through });
      m.p.f = f1;
      m.p.last = { x: m.p.x, y: m.p.y };
      m.p.x = m.nx; m.p.y = m.ny;
    }

    /* 3. pivots */
    for (const p of survivors) {
      const a = act[p.id];
      if (a.type !== 'turn') continue;
      const nf = a.side === 'L' ? LEFT(p.f) : RIGHT(p.f);
      ev.push({ t: 'turn', id: p.id, from: p.f, to: nf });
      p.f = nf;
    }

    /* 4. bonus ramassés */
    for (const p of survivors) {
      const i = S.pickups.findIndex((k) => k.x === p.x && k.y === p.y);
      if (i < 0) continue;
      const k = S.pickups.splice(i, 1)[0];
      if (k.kind === 'shield') p.shield = true;
      else if (k.kind === 'phase') p.phase = true;
      else if (k.kind === 'map') p.seen.fill(1);
      else if (k.kind === 'crystal') p.crystal = true;
      ev.push({ t: 'pickup', id: p.id, kind: k.kind, at: { x: p.x, y: p.y } });
    }

    /* 5. la brume avance */
    const due = turn >= FIRST_SHRINK && (turn - FIRST_SHRINK) % SHRINK_EVERY === 0;
    if (S.zone.x1 - S.zone.x0 + 1 === 3) {
      if (due || S.hold > 0) {
        S.hold = (S.hold || 0) + 1;
        if (centerHolder(S) || S.hold > MAX_HOLD) { S.hold = 0; shrinkZone(S, ev); }
      }
    } else if (due) shrinkZone(S, ev);
    S.turn++;

    /* 6. fin de tour */
    S.players.forEach((p) => { if (p.alive) reveal(S, p); });
    const left = S.players.filter((p) => p.alive);
    if (left.length <= 1) {
      S.over = true;
      S.winner = left.length ? left[0].id : null;
      ev.push({ t: 'end', winner: S.winner });
    }
    return { events: ev };
  }

  /* joueur éliminé d'office (temps écoulé) : il perd, la partie continue pour les autres */
  const TURN_SECONDS = 20;
  function forfeit(S, id) {
    const p = S.players.find((q) => q.id === id);
    if (!p || !p.alive || S.over) return [];
    p.alive = false; p.diedTurn = S.turn;
    const ev = [{ t: 'death', id, cause: 'timeout', at: { x: p.x, y: p.y } }];
    const left = S.players.filter((q) => q.alive);
    if (left.length <= 1) { S.over = true; S.winner = left.length ? left[0].id : null; ev.push({ t: 'end', winner: S.winner }); }
    return ev;
  }

  /* ---------- magiciens pilotés par l'ordinateur ---------- */
  function distMap(S, gx, gy) {
    const d = new Array(N * N).fill(999);
    d[K(gx, gy)] = 0;
    const q = [[gx, gy]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (let dir = 0; dir < 4; dir++) {
        if (!hasPassage(S, x, y, dir)) continue;
        const nx = x + DX[dir], ny = y + DY[dir];
        if (d[K(nx, ny)] !== 999) continue;
        d[K(nx, ny)] = d[K(x, y)] + 1;
        q.push([nx, ny]);
      }
    }
    return d;
  }

  // distance (en pas) jusqu'à la prochaine zone, depuis chaque case
  function distToZone(S, nz) {
    const d = new Array(N * N).fill(999);
    const q = [];
    for (let y = nz.y0; y <= nz.y1; y++) for (let x = nz.x0; x <= nz.x1; x++) { d[K(x, y)] = 0; q.push([x, y]); }
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (let dir = 0; dir < 4; dir++) {
        const nx = x + DX[dir], ny = y + DY[dir];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || !inZone(S.zone, nx, ny)) continue;
        if (!((S.maze.open[K(nx, ny)] >> OPP(dir)) & 1)) continue;
        if (d[K(nx, ny)] !== 999) continue;
        d[K(nx, ny)] = d[K(x, y)] + 1;
        q.push([nx, ny]);
      }
    }
    return d;
  }

  function botAction(S, p) {
    const z = S.zone;
    const nzAll = nextZone(S);
    const tts = turnsToShrink(S);                      // 0 : la brume avance à la fin de ce tour
    const dz = nzAll ? distToZone(S, nzAll) : null;
    // en danger de brume : trop loin de la prochaine zone pour avoir une marge
    const tight = !!(dz && tts >= 0 && !inZone(nzAll, p.x, p.y) && tts <= 6 && dz[K(p.x, p.y)] >= tts - 2);
    if (!tight && spellTarget(S, p) && randBot(S) < 0.93) return { type: 'cast' };
    if (tight && dz[K(p.x, p.y)] > tts && spellTarget(S, p) && randBot(S) < 0.5) return { type: 'cast' };
    const enemies = S.players.filter((q) => q.alive && q.id !== p.id);
    const goal = { x: CX, y: CY };
    const dist = distMap(S, goal.x, goal.y);
    const nz = tts === 0 ? nzAll : null;
    const finalStage = z.x1 - z.x0 === 2;
    const enterOK = finalStage ? randBot(S) < 0.45 : true;   // à plusieurs devant le centre, on n'y entre pas tous en même temps
    const endgame = z.x1 - z.x0 < 4;
    const wantCenter = endgame ? 4 : S.turn >= 3 ? 1.3 : 0.2;
    const fear = endgame ? 1.2 : 3.2;

    // un ennemi peut-il me toucher en (x,y) si je regarde dans la direction fa ?
    const danger = (x, y, fa) => {
      let n = 0;
      for (const e of enemies) {
        let cx = e.x, cy = e.y;
        while (hasPassage(S, cx, cy, e.f)) {
          cx += DX[e.f]; cy += DY[e.f];
          if (cx === x && cy === y) { if (fa !== OPP(e.f)) n++; break; }
          const o = playerAt(S, cx, cy, p);
          if (o) break;
        }
      }
      return n;
    };

    const opts = [];
    const aimFrom = (x, y, f) => {
      const ox = p.x, oy = p.y; p.x = x; p.y = y;
      const t = spellTarget(S, p, f); p.x = ox; p.y = oy;
      return t;
    };
    for (const w of ['F', 'B', 'L', 'R']) {
      const d = dirFor(p, w);
      if (!hasPassage(S, p.x, p.y, d)) continue;
      const nx = p.x + DX[d], ny = p.y + DY[d];
      if (p.banned && p.banned.turn === S.turn && p.banned.x === nx && p.banned.y === ny) continue;
      if (playerAt(S, nx, ny, p)) continue;
      const nf = w === 'L' || w === 'R' ? d : p.f;
      let s = (dist[K(p.x, p.y)] - dist[K(nx, ny)]) * wantCenter;
      if (tight) s += (dz[K(p.x, p.y)] - dz[K(nx, ny)]) * 7;
      if (finalStage && nx === CX && ny === CY) s += enterOK ? 4 : -9;   // tenir le centre, c'est gagner
      s -= danger(nx, ny, nf) * fear;
      if (nf !== p.f && aimFrom(nx, ny, nf)) s += 2.2;
      const pk = S.pickups.find((k) => k.x === nx && k.y === ny);
      if (pk) s += pk.kind === 'shield' ? 3 : 2;
      if (p.last && p.last.x === nx && p.last.y === ny) s -= 0.8;
      if (nz && !inZone(nz, nx, ny)) s -= 8;
      s += randBot(S) * 0.9;
      opts.push({ a: { type: 'move', dir: w }, s });
    }
    for (const side of ['L', 'R']) {
      const d = dirFor(p, side);
      const nf = d;
      let s = randBot(S) * 0.6 - 0.2;
      if (spellTarget(S, p, nf)) s += 3;
      s -= danger(p.x, p.y, nf) * fear;
      if (nz && !inZone(nz, p.x, p.y)) s -= 8;
      opts.push({ a: { type: 'turn', side }, s });
    }
    {
      let s = -0.6 - danger(p.x, p.y, p.f) * fear;
      if (nz && !inZone(nz, p.x, p.y)) s -= 8;
      opts.push({ a: { type: 'wait' }, s });
    }
    opts.sort((a, b) => b.s - a.s);
    return opts[0].a;
  }

  const api = {
    N, CX, CY, DX, DY, OPP, LEFT, RIGHT, K,
    createGame, resolveTurn, forfeit, TURN_SECONDS, spellTarget, visibleFrom, visiblePlayers, botAction,
    hasPassage, inZone, moveOptions, turnsToShrink, nextZone, dirFor, playerAt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DSEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
