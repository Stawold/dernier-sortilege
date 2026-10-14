/* Dernier Sortilège : serveur multijoueur.
   - sert la page (dossier public/) et une WebSocket sur /ws
   - salles à code de 4 lettres, 4 à 12 magiciens (humains + bots de remplissage)
   - le serveur fait tourner le moteur de règles (engine.js) : il fait jouer les bots, applique le délai de 20 s
     (pas de choix à temps = éliminé) et diffuse à chaque tour les actions de tous. Les clients rejouent le même
     moteur avec le même tirage (graine) et obtiennent exactement la même partie. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const E = require('./engine.js');

const PORT = +process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TURN_MS = +process.env.TURN_MS || E.TURN_SECONDS * 1000;
const ANIM = +process.env.ANIM_SCALE || 1;   // (tests : accélère les pauses d'animation)
const MIN_PLAYERS = 4, MAX_PLAYERS = 12, N_COLORS = 12;
const BOT_NAMES = ['Aldéric', 'Morwenna', 'Balthazar', 'Isolde', 'Octavius', 'Séraphine', 'Thaddée', 'Gwendoline', 'Mérovée', 'Ysolde', 'Bastien'];
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_ROOMS = 300;
const GRACE_MS = +process.env.GRACE_MS || 60000;   // un joueur qui perd la connexion a 60 s pour revenir (changement wifi / 4G, écran verrouillé…)
const crypto = require('crypto');

/* ---------- utilitaires ---------- */
const rooms = new Map();
let humanSeq = 0;
const now = () => Date.now();
function newCode() {
  for (let k = 0; k < 200; k++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, 14) || 'Magicien';
const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function hashState(S) {
  let h = 2166136261 >>> 0;
  const feed = (n) => { h ^= n & 0xffff; h = Math.imul(h, 16777619) >>> 0; };
  feed(S.turn);
  S.players.forEach((p) => { feed(p.alive ? 1 : 0); feed(p.x); feed(p.y); feed(p.f); feed(p.shield ? 1 : 0); feed(p.phase ? 1 : 0); });
  feed(S.zone.x0); feed(S.zone.x1);
  return h;
}

/* ---------- salles ---------- */
function freeColor(room, wanted) {
  const used = new Set([...room.humans.values()].map((h) => h.color));
  if (Number.isInteger(wanted) && wanted >= 0 && wanted < N_COLORS && !used.has(wanted)) return wanted;
  for (let c = 0; c < N_COLORS; c++) if (!used.has(c)) return c;
  return 0;
}
function roomInfo(room, you) {
  return {
    t: 'room', code: room.code, you, host: room.host, phase: room.phase, bots: room.bots, min: MIN_PLAYERS, max: MAX_PLAYERS,
    players: [...room.humans.values()].map((h) => ({ id: h.id, name: h.name, color: h.color, connected: h.connected })),
    token: (room.humans.get(you) || {}).token,   // secret personnel : sert à reprendre sa place après une coupure
  };
}
function broadcastRoom(room) {
  room.humans.forEach((h) => send(h.ws, roomInfo(room, h.id)));
}
function totalPlayers(room) { return room.humans.size + room.bots; }

const anyConnected = (room) => [...room.humans.values()].some((h) => h.connected);
const inGrace = (h) => !h.connected && !h.left && now() - h.droppedAt <= GRACE_MS;

function migrateHost(room) {
  if (room.humans.has(room.host) && room.humans.get(room.host).connected) return;
  const n = [...room.humans.values()].find((x) => x.connected);
  if (n) room.host = n.id;
}
function scheduleRoomCleanup(room) {
  clearTimeout(room.cleanup);
  room.cleanup = setTimeout(() => { if (!anyConnected(room) && !(room.phase === 'play' && [...room.humans.values()].some(inGrace))) { clearTimeout(room.timer); rooms.delete(room.code); } }, GRACE_MS + 1000);
}

// départ volontaire (bouton) : on libère la place tout de suite
function leaveHuman(room, h) {
  h.left = true; h.connected = false; h.droppedAt = 0; clearTimeout(h.dropTimer);
  if (room.phase === 'lobby') {
    room.humans.delete(h.id);
    migrateHost(room);
    if (!room.humans.size) { rooms.delete(room.code); return; }
    broadcastRoom(room);
  } else {
    if (!anyConnected(room) && ![...room.humans.values()].some(inGrace)) { clearTimeout(room.timer); rooms.delete(room.code); return; }
    checkAllIn(room);
  }
}

// connexion perdue : on garde la place pendant GRACE_MS pour permettre la reconnexion
function dropHuman(room, h) {
  h.ws = null; h.connected = false; h.droppedAt = now();
  if (room.phase === 'lobby') {
    migrateHost(room);
    broadcastRoom(room);
    clearTimeout(h.dropTimer);
    h.dropTimer = setTimeout(() => {
      if (h.connected || room.phase !== 'lobby' || !room.humans.has(h.id)) return;
      room.humans.delete(h.id); migrateHost(room);
      if (!room.humans.size) { rooms.delete(room.code); return; }
      broadcastRoom(room);
    }, GRACE_MS);
  } else {
    checkAllIn(room);
  }
  scheduleRoomCleanup(room);
}

/* ---------- déroulement d'une partie ---------- */
function startGame(room) {
  const humans = [...room.humans.values()];
  const takenColors = new Set(humans.map((h) => h.color));
  const rest = []; for (let c = 0; c < N_COLORS; c++) if (!takenColors.has(c)) rest.push(c);
  const players = humans.map((h) => ({ id: h.id, name: h.name, color: h.color, bot: false }));
  for (let i = 0; i < room.bots; i++) players.push({ id: 'b' + (i + 1), name: BOT_NAMES[i], color: rest[i], bot: true });
  // petit mélange de l'ordre de départ pour que les cases de départ ne favorisent pas l'hôte
  const seed = Math.floor(Math.random() * 2147483647);
  room.S = E.createGame({ seed, players });
  room.seed = seed; room.startPlayers = players; room.history = [];
  room.phase = 'play';
  room.acts = new Map();
  humans.forEach((h) => { h.connected = !!(h.ws && h.ws.readyState === 1); if (!h.connected) h.droppedAt = h.droppedAt || now(); clearTimeout(h.dropTimer); });
  room.humans.forEach((h) => send(h.ws, { t: 'start', seed, players, you: h.id }));
  room.timer = setTimeout(() => openTurn(room), 3500 * ANIM);
}

function openTurn(room) {
  if (room.phase !== 'play' || room.S.over) return;
  room.acts = new Map();
  room.openedAt = now();
  room.humans.forEach((h) => send(h.ws, { t: 'open', turn: room.S.turn, ms: TURN_MS }));
  sendProgress(room);
  clearTimeout(room.timer);
  // plus aucun humain en vie : les spectateurs regardent la fin entre bots, sans attendre
  if (!aliveHumans(room).some((h) => h.connected || inGrace(h))) return resolveTurn(room);
  room.timer = setTimeout(() => resolveTurn(room), TURN_MS + 400);   // petite marge réseau
}
function aliveHumans(room) {
  return room.S.players.filter((p) => p.alive && !p.bot).map((p) => room.humans.get(p.id)).filter(Boolean);
}
function sendProgress(room) {
  const hs = aliveHumans(room).filter((h) => h.connected);
  const msg = { t: 'progress', turn: room.S.turn, done: hs.filter((h) => room.acts.has(h.id)).length, total: hs.length };
  room.humans.forEach((h) => send(h.ws, msg));
}
function checkAllIn(room) {
  if (room.phase !== 'play' || !room.openedAt) return;
  const hs = aliveHumans(room).filter((h) => h.connected);
  if (hs.every((h) => room.acts.has(h.id))) resolveTurn(room);
}

function resolveTurn(room) {
  if (room.phase !== 'play' || !room.openedAt) return;
  clearTimeout(room.timer);
  room.openedAt = 0;
  const S = room.S;
  const turn = S.turn;
  const alive = S.players.filter((p) => p.alive);
  // pas d'action à temps : éliminé d'office. Exception : un joueur déconnecté depuis moins de GRACE_MS attend sur place.
  const waiting = new Set();
  const kicks = alive.filter((p) => {
    if (p.bot || room.acts.has(p.id)) return false;
    const h = room.humans.get(p.id);
    if (h && inGrace(h)) { waiting.add(p.id); return false; }
    return true;
  }).map((p) => p.id);
  const actions = {};
  alive.forEach((p) => {
    if (kicks.includes(p.id)) return;
    actions[p.id] = p.bot ? E.botAction(S, p) : waiting.has(p.id) ? { type: 'wait' } : room.acts.get(p.id);
  });
  kicks.forEach((id) => E.forfeit(S, id));
  let events = [];
  if (!S.over) events = E.resolveTurn(S, actions).events;
  room.history.push({ actions, kicks });
  const msg = { t: 'turn', turn, actions, kicks, hash: hashState(S) };
  room.humans.forEach((h) => send(h.ws, msg));
  if (S.over) {
    room.phase = 'lobby'; room.S = null;
    room.timer = setTimeout(() => { room.humans.forEach((h) => { if (!h.connected) room.humans.delete(h.id); }); if (!room.humans.size) { rooms.delete(room.code); return; } if (!room.humans.has(room.host)) room.host = room.humans.keys().next().value; broadcastRoom(room); }, 1500);
    return;
  }
  // laisse aux clients le temps de jouer les animations avant d'ouvrir le tour suivant
  const hasShrink = events.some((e) => e.t === 'shrink'), hasCast = events.some((e) => e.t === 'cast' || e.t === 'death');
  const wait = (2900 + (hasCast ? 900 : 0) + (hasShrink ? 1500 : 0)) * ANIM;
  room.timer = setTimeout(() => openTurn(room), wait);
}

/* ---------- messages des clients ---------- */
function onMessage(ws, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;
  const ctx = ws.ctx;

  if (m.t === 'ping') return send(ws, { t: 'pong' });

  if (m.t === 'rejoin') {
    if (ctx.room) return;
    const room = rooms.get(String(m.code || '').toUpperCase().trim());
    const h = room && [...room.humans.values()].find((x) => x.token && x.token === m.token && !x.left);
    if (!room || !h) return send(ws, { t: 'gone' });
    if (h.ws && h.ws !== ws) { const old = h.ws; h.ws = null; if (old.ctx) old.ctx.room = null; try { old.terminate(); } catch (e) { /* rien */ } }
    h.ws = ws; h.connected = true; clearTimeout(h.dropTimer);
    ctx.room = room; ctx.id = h.id;
    if (room.phase === 'play' && room.S) {
      const remain = room.openedAt ? Math.max(1000, TURN_MS - (now() - room.openedAt)) : 0;
      send(ws, { t: 'resume', seed: room.seed, players: room.startPlayers, you: h.id, history: room.history, turn: room.S.turn, open: !!room.openedAt, ms: remain, acted: room.acts.has(h.id) });
      broadcastRoom(room); sendProgress(room);
    } else broadcastRoom(room);
    return;
  }

  if (m.t === 'create' || m.t === 'join') {
    if (ctx.room) return;
    let room;
    if (m.t === 'create') {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'Le serveur est plein, réessayez plus tard.' });
      const code = newCode(); if (!code) return send(ws, { t: 'err', msg: 'Impossible de créer une salle.' });
      room = { code, host: null, humans: new Map(), bots: 0, phase: 'lobby', S: null, timer: null, acts: new Map(), openedAt: 0 };
      rooms.set(code, room);
    } else {
      room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return send(ws, { t: 'err', msg: 'Salle introuvable. Vérifiez le code.' });
      if (room.phase !== 'lobby') return send(ws, { t: 'err', msg: 'La partie a déjà commencé.' });
      if (totalPlayers(room) >= MAX_PLAYERS) return send(ws, { t: 'err', msg: 'La salle est pleine (12 magiciens).' });
    }
    const h = { id: 'h' + (++humanSeq), name: cleanName(m.name), color: freeColor(room, m.color), ws, connected: true, token: crypto.randomBytes(12).toString('hex'), droppedAt: 0, left: false };
    room.humans.set(h.id, h);
    if (!room.host) room.host = h.id;
    ctx.room = room; ctx.id = h.id;
    broadcastRoom(room);
    return;
  }

  const room = ctx.room; if (!room) return;
  const me = room.humans.get(ctx.id); if (!me) return;

  if (m.t === 'leave') { ctx.room = null; ctx.id = null; leaveHuman(room, me); return; }

  if (m.t === 'name' && room.phase === 'lobby') { me.name = cleanName(m.name); return broadcastRoom(room); }

  if (m.t === 'color' && room.phase === 'lobby') {
    const c = m.color;
    if (!Number.isInteger(c) || c < 0 || c >= N_COLORS) return;
    if ([...room.humans.values()].some((x) => x !== me && x.color === c)) return send(ws, { t: 'err', msg: 'Cette couleur est déjà prise.' });
    me.color = c; return broadcastRoom(room);
  }

  if (m.t === 'bots' && room.phase === 'lobby' && room.host === me.id) {
    const n = Math.max(0, Math.min(MAX_PLAYERS - room.humans.size, Math.floor(+m.n || 0)));
    room.bots = n; return broadcastRoom(room);
  }

  if (m.t === 'start' && room.phase === 'lobby' && room.host === me.id) {
    if (totalPlayers(room) < MIN_PLAYERS) return send(ws, { t: 'err', msg: 'Il faut au moins ' + MIN_PLAYERS + ' magiciens : ajoutez des bots.' });
    if (totalPlayers(room) > MAX_PLAYERS) return;
    return startGame(room);
  }

  if (m.t === 'act' && room.phase === 'play' && room.openedAt) {
    if (m.turn !== room.S.turn || room.acts.has(me.id)) return;
    const p = room.S.players.find((x) => x.id === me.id);
    if (!p || !p.alive) return;
    const a = m.action || {};
    let act = { type: 'wait' };
    if (a.type === 'move' && ['F', 'B', 'L', 'R'].includes(a.dir)) act = { type: 'move', dir: a.dir };
    else if (a.type === 'turn' && ['L', 'R'].includes(a.side)) act = { type: 'turn', side: a.side };
    else if (a.type === 'cast') act = { type: 'cast' };
    room.acts.set(me.id, act);
    sendProgress(room);
    checkAllIn(room);
  }
}

/* ---------- HTTP + WebSocket ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok ' + rooms.size + ' salles'); }
  let f = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Introuvable'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});
const ORIGINS = (process.env.ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);   // ex. ORIGINS=https://mon-site.netlify.app (vide = tout accepter)
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048, verifyClient: (info) => !ORIGINS.length || ORIGINS.includes(info.origin) || !info.origin });
wss.on('connection', (ws) => {
  ws.ctx = { room: null, id: null }; ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  let last = 0, burst = 0;
  ws.on('message', (raw) => {
    const t = now(); burst = t - last > 1000 ? 0 : burst + 1; last = t;
    if (burst > 30) return;                 // anti-spam
    onMessage(ws, raw.toString());
  });
  ws.on('close', () => {
    const { room, id } = ws.ctx;
    if (room && id) { const h = room.humans.get(id); if (h && h.ws === ws) dropHuman(room, h); }
  });
  ws.on('error', () => {});
});
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) { /* rien */ } });
}, 25000);

if (require.main === module) server.listen(PORT, () => console.log('Dernier Sortilège : http://localhost:' + PORT));
module.exports = { server, rooms, TURN_MS };
