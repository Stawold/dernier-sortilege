/* test de bout en bout du protocole : un serveur local, des clients 'ws' qui rejouent le moteur en lockstep */
const assert = require('assert');
process.env.TURN_MS = '1500'; process.env.ANIM_SCALE = '0.02'; process.env.PORT = '0'; process.env.GRACE_MS = '4000';
const WebSocket = require('ws');
const E = require('../engine.js');
const { server, rooms } = require('../server.js');
let pass = 0; const ok = (n, f) => f().then(() => { pass++; console.log('ok  ', n); }, (e) => { console.error('FAIL', n, e); process.exit(1); });

function client(port, name, color, { play = true, dropAt = -1 } = {}) {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
  const c = { ws, name, S: null, room: null, you: null, turns: 0, mismatches: 0, errs: [], over: false, kicked: false, play, dropAt, kickedIds: new Set(), token: null, resumed: 0 };
  const q = []; c.wait = (pred, ms = 8000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const i = q.findIndex(pred); if (i >= 0) return res(q.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error('timeout ' + name)); setTimeout(poll, 10); })(); });
  c.send = (m) => ws.send(JSON.stringify(m));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw); q.push(m);
    if (m.t === 'room') { c.room = m; c.you = m.you; if (m.token) c.token = m.token; }
    if (m.t === 'resume') {   // reprise : on rejoue l'historique d'un coup, comme le fait le navigateur
      c.resumed++; c.you = m.you; c.players = m.players; c.S = E.createGame({ seed: m.seed, players: m.players });
      m.history.forEach((h) => { h.kicks.forEach((id) => E.forfeit(c.S, id)); if (!c.S.over) E.resolveTurn(c.S, h.actions); });
      c.lastResume = m;
      const me = c.S.players.find((p) => p.id === c.you);
      if (m.open && !m.acted && c.play && me && me.alive) { const a = E.botAction(c.S, me); setTimeout(() => c.send({ t: 'act', turn: m.turn, action: a }), 5); }
    }
    if (m.t === 'err') c.errs.push(m.msg);
    if (m.t === 'start') { c.S = E.createGame({ seed: m.seed, players: m.players }); c.players = m.players; }
    if (m.t === 'open' && c.S && c.play && !c.S.over && !c.paused) {
      const me = c.S.players.find((p) => p.id === c.you);
      if (me && me.alive) {
        if (c.dropAt >= 0 && c.S.turn >= c.dropAt) return ws.close();
        const a = E.botAction(c.S, me);
        setTimeout(() => c.send({ t: 'act', turn: m.turn, action: a }), 5);
      }
    }
    if (m.t === 'turn' && c.S) {
      m.kicks.forEach((id) => { c.kickedIds.add(id); if (id === c.you) c.kicked = true; E.forfeit(c.S, id); });
      if (!c.S.over) E.resolveTurn(c.S, m.actions);
      c.turns++;
      let h = 2166136261 >>> 0; const f = (n) => { h ^= n & 0xffff; h = Math.imul(h, 16777619) >>> 0; };
      f(c.S.turn); c.S.players.forEach((p) => { f(p.alive ? 1 : 0); f(p.x); f(p.y); f(p.f); f(p.shield ? 1 : 0); f(p.phase ? 1 : 0); }); f(c.S.zone.x0); f(c.S.zone.x1);
      if (h !== m.hash) c.mismatches++;
      if (c.S.over) c.over = true;
    }
  });
  return new Promise((res) => ws.on('open', () => res(c)));
}

function reconnect(old, port) {   // nouvelle connexion, même joueur : on réutilise le jeton secret
  return client(port, old.name, 0, { play: old.play }).then((n) => {
    n.token = old.token; n.you = old.you; n.S = old.S; n.players = old.players; n.kickedIds = old.kickedIds; n.mismatches = old.mismatches;
    n.send({ t: 'rejoin', code: old.room.code, token: old.token });
    return n;
  });
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  let port = server.address().port;
  // LAG=250 node test-server.js : toutes les connexions passent par un relais qui ajoute ~250 ms (±40 %) dans chaque sens, comme une 4G médiocre
  if (process.env.LAG) {
    const net = require('net'), real = port, LAG = +process.env.LAG;
    const pipe = (from, to) => { let chain = Promise.resolve(); from.on('data', (d) => { const wait = LAG * (0.6 + Math.random() * 0.8); const at = Date.now() + wait; chain = chain.then(() => new Promise((r) => setTimeout(r, Math.max(0, at - Date.now())))).then(() => { if (!to.destroyed) to.write(d); }); }); };
    const px = net.createServer((c) => { const u = net.connect(real, '127.0.0.1'); pipe(c, u); pipe(u, c); c.on('close', () => u.destroy()); u.on('close', () => c.destroy()); c.on('error', () => {}); u.on('error', () => {}); });
    await new Promise((r) => px.listen(0, r)); port = px.address().port; console.log('     (relais réseau : +' + LAG + ' ms par sens)');
  }

  await ok('créer / rejoindre / couleurs uniques / refus code inconnu', async () => {
    const a = await client(port, 'Anna', 2); a.send({ t: 'create', name: 'Anna', color: 2 });
    const r1 = await a.wait((m) => m.t === 'room'); assert.ok(/^[A-Z]{4}$/.test(r1.code)); assert.strictEqual(r1.host, a.you = r1.you);
    const b = await client(port, 'Bob', 2); b.send({ t: 'join', code: r1.code.toLowerCase(), name: 'Bob', color: 2 });
    const r2 = await b.wait((m) => m.t === 'room');
    assert.strictEqual(r2.players.length, 2); assert.notStrictEqual(r2.players[0].color, r2.players[1].color);
    const x = await client(port, 'X', 0); x.send({ t: 'join', code: 'ZZZZ', name: 'X' });
    assert.ok((await x.wait((m) => m.t === 'err')).msg.includes('introuvable'));
    b.send({ t: 'color', color: r1.players[0].color }); assert.ok((await b.wait((m) => m.t === 'err')).msg.includes('prise'));
    a.send({ t: 'start' }); assert.ok((await a.wait((m) => m.t === 'err')).msg.includes('au moins'));
    b.send({ t: 'start' }); // non-hôte : ignoré
    a.send({ t: 'bots', n: 99 }); const r3 = await a.wait((m) => m.t === 'room' && m.bots > 0); assert.strictEqual(r3.bots, 10);
    [a, b, x].forEach((c) => c.ws.close());
  });

  await ok('partie complète : 3 humains (1 inactif, 1 déconnecté) + 3 bots, tous les clients restent synchronisés', async () => {
    const a = await client(port, 'Anna', 0); a.send({ t: 'create', name: 'Anna' });
    const code = (await a.wait((m) => m.t === 'room')).code;
    const b = await client(port, 'Bob', 1); b.send({ t: 'join', code, name: 'Bob' });
    const c = await client(port, 'Cléo', 2, { play: false }); c.send({ t: 'join', code, name: 'Cléo' });
    const d = await client(port, 'Dan', 3, { dropAt: 3 }); d.send({ t: 'join', code, name: 'Dan' });
    await d.wait((m) => m.t === 'room' && m.players.length === 4);
    a.send({ t: 'bots', n: 3 }); await a.wait((m) => m.t === 'room' && m.bots === 3);
    a.send({ t: 'start' });
    const st = await a.wait((m) => m.t === 'start'); assert.strictEqual(st.players.length, 7);
    const colors = st.players.map((p) => p.color); assert.strictEqual(new Set(colors).size, 7);
    const t0 = Date.now();
    while (!a.over && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
    assert.ok(a.over, 'la partie doit se terminer');
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(a.mismatches, 0, 'désynchronisation client A'); assert.strictEqual(b.mismatches, 0, 'désynchronisation client B');
    assert.ok(c.kicked, 'le joueur inactif est éliminé d\'office');
    assert.ok(a.turns > 5);
    console.log('     tours joués', a.turns, ' vainqueur', a.S.winner);
    // retour au salon après la partie
    const back = await a.wait((m) => m.t === 'room' && m.phase === 'lobby'); assert.ok(back.players.length >= 2);
    [a, b, c, d].forEach((x) => x.ws.close());
  });

  await ok('reconnexion au salon : même place, même identité, même hôte', async () => {
    const a = await client(port, 'A', 0); a.send({ t: 'create', name: 'A' }); const r1 = await a.wait((m) => m.t === 'room');
    assert.ok(r1.token && r1.token.length >= 16);
    const b = await client(port, 'B', 1); b.send({ t: 'join', code: r1.code, name: 'B' }); const rb = await b.wait((m) => m.t === 'room');
    a.ws.terminate();                                           // coupure brutale (changement de réseau)
    const mid = await b.wait((m) => m.t === 'room' && m.players.some((p) => !p.connected));
    assert.strictEqual(mid.players.length, 2); assert.strictEqual(mid.host, rb.you);   // l'hôte passe à B, A garde sa place
    const a2 = await client(port, 'A', 0); a2.send({ t: 'rejoin', code: r1.code, token: r1.token });
    const back = await a2.wait((m) => m.t === 'room'); assert.strictEqual(back.you, r1.you); assert.strictEqual(back.players.length, 2);
    assert.ok(back.players.every((p) => p.connected));
    const x = await client(port, 'Intrus', 0); x.send({ t: 'rejoin', code: r1.code, token: 'faux' }); assert.ok(await x.wait((m) => m.t === 'gone'));
    [a2, b, x].forEach((c) => c.ws.close());
  });

  await ok('reconnexion en pleine partie : reprise exacte, 0 désynchronisation, absent trop longtemps = éliminé', async () => {
    const a = await client(port, 'Anna', 0); a.send({ t: 'create', name: 'Anna' });
    const code = (await a.wait((m) => m.t === 'room')).code;
    const mk = async (name, col) => { const c = await client(port, name, col); c.send({ t: 'join', code, name }); await c.wait((m) => m.t === 'room'); return c; };
    let b = await mk('Bob', 1), c = await mk('Cléo', 2), d = await mk('Dan', 3);
    a.send({ t: 'bots', n: 2 }); await a.wait((m) => m.t === 'room' && m.bots === 2);
    a.send({ t: 'start' }); await a.wait((m) => m.t === 'start');
    // Bob : coupure brève au tour 3, il revient en cours de tour ; Cléo : coupure de 2 tours ; Dan : ne revient jamais
    const started = Date.now();
    const waitTurn = (cl, n) => new Promise((res) => { (function p() { if (cl.S && cl.S.turn >= n) return res(); setTimeout(p, 10); })(); });
    await waitTurn(a, 3);
    b.paused = c.paused = d.paused = true;
    const tokB = b.token, tokC = c.token; b.ws.terminate(); c.ws.terminate(); d.ws.terminate();
    const bAlt = b, cAlt = c, dAlt = d;
    await new Promise((r) => setTimeout(r, 600));
    const b2 = await reconnect(bAlt, port); const rb = await b2.wait((m) => m.t === 'resume');
    assert.strictEqual(rb.history.length, rb.turn - 1); assert.strictEqual(b2.S.turn, rb.turn);
    await waitTurn(a, a.S.turn + 2);
    const c2 = await reconnect(cAlt, port); const rc = await c2.wait((m) => m.t === 'resume');
    assert.strictEqual(c2.S.turn, rc.turn); assert.ok(rc.history.length >= 3);
    const t0 = Date.now();
    while (!a.over && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
    assert.ok(a.over, 'la partie doit se terminer'); await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(a.mismatches, 0); assert.strictEqual(b2.mismatches, 0, 'désynchronisation après reprise B'); assert.strictEqual(c2.mismatches, 0, 'désynchronisation après reprise C');
    assert.ok(!b2.kicked && !c2.kicked, 'les joueurs revenus à temps ne sont pas éliminés d\'office');
    const dan = a.S.players.find((p) => p.id === dAlt.you);
    assert.ok(!dan.alive, 'le joueur qui ne revient pas finit éliminé (délai de grâce ou sort)');
    console.log('     Dan (jamais revenu) :', a.kickedIds.has(dAlt.you) ? 'éliminé d\'office après la grâce' : 'tué en attendant sur place', '| Bob/Cléo revenus, tour', b2.S.turn);
    [a, b2, c2].forEach((x) => x.ws.close());
  });

  await ok('salon : une place abandonnée est libérée après le délai de grâce, pas avant', async () => {
    const a = await client(port, 'A', 0); a.send({ t: 'create', name: 'A' }); const r1 = await a.wait((m) => m.t === 'room');
    const b = await client(port, 'B', 1); b.send({ t: 'join', code: r1.code, name: 'B' }); await b.wait((m) => m.t === 'room' && m.players.length === 2);
    b.ws.terminate();
    await a.wait((m) => m.t === 'room' && m.players.some((p) => !p.connected));
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok(rooms.get(r1.code).humans.size === 2, 'la place est encore gardée');
    const gone = await a.wait((m) => m.t === 'room' && m.players.length === 1, 6000);
    assert.strictEqual(gone.players.length, 1); a.ws.close();
  });

  await ok('hôte qui part : un autre humain devient hôte', async () => {
    const a = await client(port, 'A', 0); a.send({ t: 'create', name: 'A' }); const code = (await a.wait((m) => m.t === 'room')).code;
    const b = await client(port, 'B', 1); b.send({ t: 'join', code, name: 'B' }); await b.wait((m) => m.t === 'room');
    a.send({ t: 'leave' }); const r = await b.wait((m) => m.t === 'room' && m.players.length === 1);
    assert.strictEqual(r.host, r.you); b.ws.close();
  });

  await new Promise((r) => setTimeout(r, 200));
  console.log(pass + ' tests serveur passés'); process.exit(0);
})();
