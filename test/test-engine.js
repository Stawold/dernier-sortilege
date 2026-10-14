const E = require('./engine.js');
const assert = require('assert');
const { N, K } = E;
let pass = 0;
function ok(name, fn) { try { fn(); pass++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n    ', e.message); process.exitCode = 1; } }

// arène vide : tout est ouvert
function arena(specs) {
  const S = E.createGame({ seed: 1, players: specs.map((s, i) => ({ id: s.id, name: s.id })) });
  const open = new Array(N * N).fill(0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = 0;
    if (y > 0) m |= 1; if (x < N - 1) m |= 2; if (y < N - 1) m |= 4; if (x > 0) m |= 8;
    open[K(x, y)] = m;
  }
  S.maze.open = open;
  S.pickups = [];
  S.players.forEach((p, i) => { Object.assign(p, specs[i]); p.seen.fill(0); p.alive = true; p.shield = !!specs[i].shield; p.banned = null; });
  return S;
}
const P = (S, id) => S.players.find((p) => p.id === id);
const MV = (dir) => ({ type: 'move', dir });
const N_ = 0, E_ = 1, S_ = 2, W_ = 3;

ok('collision : deux joueurs visent la même case', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: N_ }, { id: 'B', x: 5, y: 3, f: N_ }]);
  const r = E.resolveTurn(S, { A: MV('R'), B: MV('L') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'B').x], [3, 5]);
  assert.strictEqual(P(S, 'A').f, W_);
  assert.strictEqual(P(S, 'B').f, E_);
  assert.strictEqual(r.events.filter((e) => e.t === 'bump').length, 2);
  // pas de retour sur la case de collision au tour suivant
  assert.strictEqual(E.moveOptions(S, P(S, 'A')).B, false); // A regarde l'ouest, reculer = est = case (4,3)
  assert.strictEqual(E.moveOptions(S, P(S, 'A')).F, true);
});
ok('collision : échange de places', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: N_ }, { id: 'B', x: 4, y: 3, f: N_ }]);
  E.resolveTurn(S, { A: MV('R'), B: MV('L') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'B').x], [3, 4]);
  assert.strictEqual(P(S, 'A').f, W_); assert.strictEqual(P(S, 'B').f, E_);
});
ok('collision à trois', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: N_ }, { id: 'B', x: 5, y: 3, f: N_ }, { id: 'C', x: 4, y: 4, f: N_ }]);
  E.resolveTurn(S, { A: MV('R'), B: MV('L'), C: MV('F') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'B').x, P(S, 'C').y], [3, 5, 4]);
});
ok('un joueur immobile bloque celui qui arrive', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 4, y: 3, f: N_ }]);
  const r = E.resolveTurn(S, { A: MV('F'), B: { type: 'wait' } });
  assert.strictEqual(P(S, 'A').x, 3);
  assert.ok(r.events.some((e) => e.t === 'blocked' && e.id === 'A'));
});
ok('suivre quelqu\'un qui s\'éloigne est possible', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 4, y: 3, f: E_ }]);
  E.resolveTurn(S, { A: MV('F'), B: MV('F') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'B').x], [4, 5]);
});
ok('sort : cible de dos touchée', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 8, y: 3, f: E_ }]);
  E.resolveTurn(S, { A: { type: 'cast' }, B: { type: 'wait' } });
  assert.strictEqual(P(S, 'B').alive, false);
  assert.ok(S.over); assert.strictEqual(S.winner, 'A');
});
ok('sort : cible de profil touchée', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 8, y: 3, f: N_ }, { id: 'C', x: 0, y: 0, f: E_ }]);
  E.resolveTurn(S, { A: { type: 'cast' } });
  assert.strictEqual(P(S, 'B').alive, false);
});
ok('sort : face à face impossible', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 8, y: 3, f: W_ }]);
  assert.strictEqual(E.spellTarget(S, P(S, 'A')), null);
  assert.strictEqual(E.spellTarget(S, P(S, 'B')), null);
});
ok('sort : le premier magicien protège celui de derrière', () => {
  const S = arena([{ id: 'A', x: 1, y: 3, f: E_ }, { id: 'C', x: 4, y: 3, f: W_ }, { id: 'B', x: 8, y: 3, f: E_ }]);
  assert.strictEqual(E.spellTarget(S, P(S, 'A')), null);
});
ok('sort : on ne vise pas sur les côtés', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 3, y: 4, f: E_ }]);
  assert.strictEqual(E.spellTarget(S, P(S, 'A')), null);
});
ok('gauche/droite : on avance d\'une case ET on se tourne (1 action)', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: N_ }, { id: 'B', x: 9, y: 9, f: N_ }]);
  E.resolveTurn(S, { A: MV('R') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'A').y, P(S, 'A').f], [4, 3, E_]);
  E.resolveTurn(S, { A: MV('L') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'A').y, P(S, 'A').f], [4, 2, N_]);
  E.resolveTurn(S, { A: MV('F') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'A').y, P(S, 'A').f], [4, 1, N_]);
  E.resolveTurn(S, { A: MV('B') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'A').y, P(S, 'A').f], [4, 2, N_]); // reculer garde l'orientation
});
ok('gauche/droite contre un mur : pivot sur place', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: N_ }, { id: 'B', x: 9, y: 9, f: N_ }]);
  S.maze.open[K(3, 3)] &= ~2; S.maze.open[K(4, 3)] &= ~8; // mur à l'est de A
  E.resolveTurn(S, { A: MV('R') });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'A').y, P(S, 'A').f], [3, 3, E_]);
});
ok('pivot libre : un quart de tour sur place, même case libre à côté', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: N_ }, { id: 'B', x: 9, y: 9, f: N_ }]);
  E.resolveTurn(S, { A: { type: 'turn', side: 'R' } });
  assert.deepStrictEqual([P(S, 'A').x, P(S, 'A').y, P(S, 'A').f], [3, 3, E_]);
  E.resolveTurn(S, { A: { type: 'turn', side: 'L' } }); E.resolveTurn(S, { A: { type: 'turn', side: 'L' } });
  assert.strictEqual(P(S, 'A').f, W_);
});
ok('pivot : ne protège pas du sort du même tour (tirs résolus avant)', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 6, y: 3, f: E_ }]);
  E.resolveTurn(S, { A: { type: 'cast' }, B: { type: 'turn', side: 'L' } });   // B se tourne vers A, trop tard
  assert.strictEqual(P(S, 'B').alive, false);
});
ok('pivot : face à face créé, plus de sort possible dans les deux sens', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 6, y: 3, f: E_ }]);
  E.resolveTurn(S, { B: { type: 'turn', side: 'L' } });   // B tourne vers le nord : encore touchable de profil
  assert.strictEqual(E.spellTarget(S, P(S, 'A')), P(S, 'B'));
  E.resolveTurn(S, { B: { type: 'turn', side: 'L' } });   // B regarde A en face
  assert.strictEqual(P(S, 'B').f, W_);
  assert.strictEqual(E.spellTarget(S, P(S, 'A')), null); assert.strictEqual(E.spellTarget(S, P(S, 'B')), null);
});
ok('pas de côté puis tir sur le voisin (deux tours)', () => {
  const S = arena([{ id: 'A', x: 3, y: 2, f: E_ }, { id: 'B', x: 3, y: 4, f: E_ }, { id: 'C', x: 12, y: 0, f: S_ }]);
  E.resolveTurn(S, { A: MV('R'), B: { type: 'wait' } });
  assert.strictEqual(P(S, 'A').f, S_);
  assert.strictEqual(E.spellTarget(S, P(S, 'A')).id, 'B');
});
ok('morts en chaîne : A tue B pendant que C tue A', () => {
  const S = arena([
    { id: 'C', x: 0, y: 0, f: E_ }, { id: 'A', x: 3, y: 0, f: S_ }, { id: 'B', x: 3, y: 3, f: S_ }, { id: 'D', x: 12, y: 12, f: N_ },
  ]);
  E.resolveTurn(S, { C: { type: 'cast' }, A: { type: 'cast' } });
  assert.strictEqual(P(S, 'A').alive, false);
  assert.strictEqual(P(S, 'B').alive, false);
  assert.strictEqual(P(S, 'C').alive, true);
});
ok('la cible touchée meurt même si elle a bougé', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 8, y: 3, f: E_ }, { id: 'C', x: 12, y: 12, f: N_ }]);
  E.resolveTurn(S, { A: { type: 'cast' }, B: MV('F') });
  assert.strictEqual(P(S, 'B').alive, false);
});
ok('bouclier : absorbe un sort puis disparaît', () => {
  const S = arena([{ id: 'A', x: 3, y: 3, f: E_ }, { id: 'B', x: 8, y: 3, f: E_, shield: true }, { id: 'C', x: 12, y: 12, f: N_ }]);
  E.resolveTurn(S, { A: { type: 'cast' } });
  assert.strictEqual(P(S, 'B').alive, true);
  assert.strictEqual(P(S, 'B').shield, false);
});
ok('vision : devant jusqu\'au mur, voisins latéraux', () => {
  const S = arena([{ id: 'A', x: 3, y: 0, f: E_ }, { id: 'B', x: 12, y: 12, f: N_ }]);
  const v = E.visibleFrom(S, P(S, 'A'));
  assert.strictEqual(v.line.length, 10);         // x = 3..12
  assert.strictEqual(v.side.length, 1);          // seulement le sud, le nord est un mur
});
ok('la brume : zone, mort hors zone, connexité', () => {
  const S = arena([{ id: 'A', x: 0, y: 0, f: E_ }, { id: 'B', x: 6, y: 6, f: N_ }]);
  S.turn = 10;
  const r = E.resolveTurn(S, {});
  assert.strictEqual(S.zone.x0, 1); assert.strictEqual(S.zone.x1, 11);
  assert.strictEqual(P(S, 'A').alive, false);
  assert.ok(r.events.some((e) => e.t === 'shrink'));
  assert.strictEqual(E.turnsToShrink(S), 4); // tour 11 -> prochain au tour 15
});
ok('13×13 : une vraie case centrale, ouverte sur ses 4 côtés (200 cartes)', () => {
  assert.strictEqual(N, 13); assert.strictEqual(E.CX, 6); assert.strictEqual(E.CY, 6);
  for (let g = 0; g < 200; g++) {
    const S = E.createGame({ seed: g * 7 + 3, players: Array.from({ length: 4 + (g % 9) }, (_, i) => ({ id: 'p' + i })) });
    for (let d = 0; d < 4; d++) {
      assert.ok((S.maze.open[K(6, 6)] >> d) & 1, 'centre fermé côté ' + d + ' seed ' + g);
      const nx = 6 + E.DX[d], ny = 6 + E.DY[d];
      assert.ok((S.maze.open[K(nx, ny)] >> E.OPP(d)) & 1, 'voisin non ouvert vers le centre');
    }
    // tout le labyrinthe est relié au centre
    const seen = new Set([K(6, 6)]); const q = [[6, 6]];
    for (let i = 0; i < q.length; i++) for (let d = 0; d < 4; d++) {
      if (!E.hasPassage(S, q[i][0], q[i][1], d)) continue;
      const nx = q[i][0] + E.DX[d], ny = q[i][1] + E.DY[d];
      if (!seen.has(K(nx, ny))) { seen.add(K(nx, ny)); q.push([nx, ny]); }
    }
    assert.strictEqual(seen.size, N * N);
    assert.ok(!S.players.some((p) => p.x === 6 && p.y === 6), 'apparition au centre');
    assert.ok(!S.pickups.some((k) => k.x === 6 && k.y === 6), 'bonus au centre');
  }
});
ok('la brume converge vers le centre : 13 → 11 → 9 → 7 → 5 → 3 → 1', () => {
  const S = arena([{ id: 'A', x: 6, y: 6, f: N_ }, { id: 'B', x: 6, y: 5, f: N_ }]);
  const widths = [];
  for (let t = 1; t <= 40 && widths.length < 6; t++) { const r = E.resolveTurn(S, { A: { type: 'wait' }, B: { type: 'wait' } }); if (r.events.some((e) => e.t === 'shrink')) widths.push(S.zone.x1 - S.zone.x0 + 1); }
  assert.deepStrictEqual(widths, [11, 9, 7, 5, 3, 1]);
  assert.ok(E.inZone(S.zone, 6, 6));
  assert.ok(S.over); assert.strictEqual(S.winner, 'A');   // celui du centre survit, l'autre est happé
  assert.strictEqual(P(S, 'B').alive, false);
});
ok('dernière fermeture : la brume attend qu\'un magicien tienne le centre', () => {
  const S = arena([{ id: 'A', x: 5, y: 6, f: S_ }, { id: 'B', x: 7, y: 6, f: S_ }]);
  S.zone = { x0: 5, y0: 5, x1: 7, y1: 7 }; S.turn = 30;
  const wait = { A: { type: 'wait' }, B: { type: 'wait' } };
  for (let i = 0; i < 6; i++) { E.resolveTurn(S, wait); assert.ok(!S.over, 'fermeture sans occupant'); assert.strictEqual(S.zone.x1 - S.zone.x0, 2); }
  assert.strictEqual(E.turnsToShrink(S), -2);
  const S2 = arena([{ id: 'A', x: 5, y: 6, f: E_ }, { id: 'B', x: 7, y: 6, f: S_ }]);
  S2.zone = { x0: 5, y0: 5, x1: 7, y1: 7 }; S2.turn = 30;
  const r = E.resolveTurn(S2, { A: MV('F'), B: { type: 'wait' } });
  assert.ok(r.events.some((e) => e.t === 'shrink')); assert.ok(S2.over); assert.strictEqual(S2.winner, 'A');
});
ok('calendrier de la brume : tours 10, 15, 20…', () => {
  const S = arena([{ id: 'A', x: 6, y: 6, f: N_ }, { id: 'B', x: 5, y: 5, f: N_ }]);
  const shrinks = [];
  for (let t = 1; t <= 21; t++) { const r = E.resolveTurn(S, {}); if (r.events.some((e) => e.t === 'shrink')) shrinks.push(t); }
  assert.deepStrictEqual(shrinks, [10, 15, 20]);
});
ok('tir mutuel impossible (échantillon aléatoire)', () => {
  let tested = 0;
  for (let g = 0; g < 400; g++) {
    const S = E.createGame({ seed: g, players: Array.from({ length: 4 + (g % 9) }, (_, i) => i).map((i) => ({ id: 'p' + i, name: 'x' })) });
    for (let t = 0; t < 12 && !S.over; t++) {
      const alive = S.players.filter((p) => p.alive);
      for (const a of alive) for (const b of alive) if (a !== b) {
        const ta = E.spellTarget(S, a), tb = E.spellTarget(S, b);
        if (ta === b && tb === a) throw new Error('tir mutuel seed ' + g);
        if (ta === b) tested++;
      }
      const acts = {}; alive.forEach((p) => { acts[p.id] = E.botAction(S, p); });
      E.resolveTurn(S, acts);
    }
  }
  console.log('     cibles valides vues :', tested);
});

ok('temps écoulé : le joueur est éliminé, la partie continue ou se termine', () => {
  const S = arena([{ id: 'A', x: 0, y: 0, f: E_ }, { id: 'B', x: 6, y: 6, f: N_ }, { id: 'C', x: 3, y: 3, f: N_ }]);
  let ev = E.forfeit(S, 'A');
  assert.strictEqual(P(S, 'A').alive, false); assert.strictEqual(ev[0].cause, 'timeout'); assert.ok(!S.over);
  ev = E.forfeit(S, 'B');
  assert.ok(S.over); assert.strictEqual(S.winner, 'C'); assert.deepStrictEqual(E.forfeit(S, 'C'), []);
  assert.strictEqual(E.TURN_SECONDS, 20);
});
ok('bonus bleu : traverser un mur une seule fois', () => {
  const S = arena([{ id: 'A', x: 6, y: 6, f: N_ }, { id: 'B', x: 0, y: 0, f: N_ }]);
  // trouve une direction murée depuis A
  let d = [0, 1, 2, 3].find((k) => !E.hasPassage(S, 6, 6, k));
  if (d === undefined) { S.maze.open[6 + 6 * N] &= ~1; d = 0; const nb = 6 + 5 * N; S.maze.open[nb] &= ~4; }
  P(S, 'A').f = d; P(S, 'A').phase = false;
  assert.strictEqual(E.moveOptions(S, P(S, 'A')).F, false);
  P(S, 'A').phase = true;
  assert.strictEqual(E.moveOptions(S, P(S, 'A')).F, true);
  assert.strictEqual(E.moveOptions(S, P(S, 'A')).L === E.hasPassage(S, 6, 6, E.dirFor(P(S, 'A'), 'L')), true); // gauche/droite inchangés
  const r = E.resolveTurn(S, { A: { type: 'move', dir: 'F' } });
  assert.ok(r.events.some((e) => e.t === 'move' && e.id === 'A' && e.through));
  assert.strictEqual(P(S, 'A').phase, false);
  assert.strictEqual(E.moveOptions(S, P(S, 'A')).B, false); // le mur est derrière, bonus consommé
});
ok('3 bonus par carte : un de chaque', () => {
  const S = E.createGame({ seed: 7, players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', color: 9 }] });
  assert.deepStrictEqual(S.pickups.map((k) => k.kind).sort(), ['crystal', 'phase', 'shield']);
  assert.strictEqual(S.players[3].color, 9); assert.strictEqual(S.players[0].color, 0);
});
// parties complètes de bots + invariants
ok('800 parties de bots : invariants et durée', () => {
  const st = { games: 0, turns: [], spell: 0, mist: 0, draws: 0, byId: {}, humanLike: 0 };
  for (let g = 0; g < 800; g++) {
    const S = E.createGame({ seed: 1000 + g, players: Array.from({ length: 4 + (g % 9) }, (_, i) => i).map((i) => ({ id: 'p' + i, name: 'x', bot: true })) });
    let guard = 0;
    while (!S.over && guard++ < 150) {
      const acts = {};
      S.players.filter((p) => p.alive).forEach((p) => { acts[p.id] = E.botAction(S, p); });
      const r = E.resolveTurn(S, acts);
      const seen = new Set();
      S.players.filter((p) => p.alive).forEach((p) => {
        assert.ok(E.inZone(S.zone, p.x, p.y), 'hors zone');
        const k = K(p.x, p.y); assert.ok(!seen.has(k), 'deux joueurs sur la même case'); seen.add(k);
      });
      r.events.filter((e) => e.t === 'death').forEach((e) => { if (e.cause === 'spell') st.spell++; else st.mist++; });
    }
    assert.ok(S.over, 'partie non terminée seed ' + g);
    st.games++; st.turns.push(S.turn - 1);
    if (S.winner) st.byId[S.winner] = (st.byId[S.winner] || 0) + 1; else st.draws++;
  }
  const avg = st.turns.reduce((a, b) => a + b, 0) / st.turns.length;
  console.log('     tours moyens', avg.toFixed(1), 'min', Math.min(...st.turns), 'max', Math.max(...st.turns));
  console.log('     morts par sort', st.spell, 'par brume', st.mist, 'nuls', st.draws);
  console.log('     victoires', JSON.stringify(st.byId));
});
console.log(pass + ' tests passés');
