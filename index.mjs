// 零依赖服务器：静态文件 + JSON API + SSE 推送
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, applyCommand, view, currentNation, RuleError } from './engine/game.mjs';
import { ROLE_ORDER, NATIONS } from './engine/map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 8712);

const rooms = new Map();

function rid(n) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function makeRoom() {
  let code = rid(4);
  while (rooms.has(code)) code = rid(4);
  const room = { code: code, hostId: null, seats: [], game: null, clients: new Map(), botTimer: null, awaitTimer: null };
  rooms.set(code, room);
  return room;
}

function takenNations(room) {
  return room.seats.map(function (s) { return s.nation; });
}

function freeNations(room) {
  const used = takenNations(room);
  return ROLE_ORDER.filter(function (n) { return used.indexOf(n) < 0; });
}

function addSeat(room, name, want) {
  if (room.seats.length >= ROLE_ORDER.length) throw new Error('房间已满（6 人）');
  if (room.game) throw new Error('对局已经开始');
  const free = freeNations(room);
  if (!free.length) throw new Error('没有空余国家了');
  const nation = (want && free.indexOf(want) >= 0) ? want : free[0];
  const seat = { playerId: rid(8), name: name || NATIONS[nation].name, nation: nation, bot: false };
  room.seats.push(seat);
  if (!room.hostId) room.hostId = seat.playerId;
  return seat;
}

// 开局前换国家
function pickNation(room, playerId, want) {
  if (room.game) throw new Error('对局已经开始');
  if (ROLE_ORDER.indexOf(want) < 0) throw new Error('没有这个国家');
  const seat = room.seats.find(function (s) { return s.playerId === playerId; });
  if (!seat) throw new Error('你不在这个房间');
  if (seat.nation === want) return seat;
  const holder = room.seats.find(function (s) { return s.nation === want && s.playerId !== playerId; });
  if (holder) throw new Error('这个国家已经有人了');
  seat.nation = want;
  return seat;
}

function findSeat(room, playerId) {
  return room.seats.find(function (s) { return s.playerId === playerId; });
}

function lobbyView(room, playerId) {
  return {
    lobby: true,
    code: room.code,
    hostId: room.hostId,
    you: playerId,
    seats: ROLE_ORDER.map(function (n) {
      const s = room.seats.find(function (x) { return x.nation === n; });
      return {
        nation: n,
        nationName: NATIONS[n].name,
        color: NATIONS[n].color,
        team: NATIONS[n].team,
        armies: NATIONS[n].armies,
        fleets: NATIONS[n].fleets,
        name: s ? s.name : null,
        bot: s ? s.bot : false,
        isHost: !!s && s.playerId === room.hostId,
        isMe: !!s && s.playerId === playerId,
        free: !s,
      };
    }),
  };
}

function roomViewFor(room, seat) {
  if (!room.game) return lobbyView(room, seat.playerId);
  return view(room.game, seat.nation);
}

function send(res, obj) {
  res.write('data: ' + JSON.stringify(obj) + '\n\n');
}

function broadcast(room) {
  for (const [pid, res] of room.clients.entries()) {
    const seat = findSeat(room, pid);
    if (!seat) continue;
    try { send(res, roomViewFor(room, seat)); } catch (e) { room.clients.delete(pid); }
  }
  scheduleBot(room);
}

/* ---------- 机器人 ---------- */
function scheduleBot(room) {
  const g = room.game;
  if (!g || g.result) return;
  const nation = g.awaiting ? g.awaiting.nation : (g.stack.length === 0 ? currentNation(g) : null);
  if (!nation) return;
  let seat = room.seats.find(function (s) { return s.nation === nation; });
  if (!seat) {
    // 自愈：缺座位的国家直接补一个电脑座，避免回合卡死
    seat = { playerId: 'bot_' + rid(6), name: '电脑·' + NATIONS[nation].name, nation: nation, bot: true };
    room.seats.push(seat);
  }
  if (!seat.bot) { armTimeout(room, g); return; }
  if (room.botTimer) return;
  room.botTimer = setTimeout(function () {
    room.botTimer = null;
    try { botAct(room, nation); } catch (e) { console.error('bot error', e); }
    broadcast(room);
  }, 600);
}

// 出牌 / 应对没有时间限制：设为 0 表示永不自动放弃
const AUTO_PASS_MS = 0;

function armTimeout(room, g) {
  if (!AUTO_PASS_MS) return;          // 计时已关闭
  if (!g.awaiting) return;
  const token = g.awaiting.windowId;
  if (room.awaitTimer && room.awaitTimer.token === token) return;
  if (room.awaitTimer) clearTimeout(room.awaitTimer.handle);
  const handle = setTimeout(function () {
    if (!room.game || !room.game.awaiting || room.game.awaiting.windowId !== token) return;
    try {
      applyCommand(room.game, room.game.awaiting.nation, { type: 'pass' });
      broadcast(room);
    } catch (e) { console.error('timeout pass failed', e); }
  }, AUTO_PASS_MS);
  room.awaitTimer = { token: token, handle: handle };
}

function botAct(room, nation) {
  const g = room.game;
  if (g.awaiting) {
    const opts = g.awaiting.options || [];
    if (opts.length && Math.random() < 0.85) {
      applyCommand(g, nation, { type: 'react', cardId: opts[0].cardId });
    } else {
      applyCommand(g, nation, { type: 'pass' });
    }
    return;
  }
  const v = view(g, nation);
  const moves = v.legal.filter(function (m) { return m.targets.length > 0 || (m.targets.length === 1 && m.targets[0] === null); });
  if (moves.length === 0) {
    const card = g.nations[nation].hand[0];
    if (card) applyCommand(g, nation, { type: 'discard', cardId: card.id });
    return;
  }
  const m = moves[Math.floor(Math.random() * moves.length)];
  const target = m.targets[Math.floor(Math.random() * m.targets.length)];
  applyCommand(g, nation, { type: 'play', cardId: m.cardId, target: target });
}

/* ---------- HTTP ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) { data += c; if (data.length > 1e6) reject(new Error('body too large')); });
    req.on('end', function () {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    if (p === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok rooms=' + rooms.size);
      return;
    }

    if (p.startsWith('/api/')) {
      if (req.method === 'POST') {
        const body = await readBody(req);

        if (p === '/api/create') {
          const room = makeRoom();
          const seat = addSeat(room, body.name);
          json(res, 200, { code: room.code, playerId: seat.playerId, nation: seat.nation });
          return;
        }

        if (p === '/api/pick') {
          const room = rooms.get(String(body.code || '').toUpperCase());
          if (!room) return json(res, 404, { error: '房间不存在' });
          try {
            pickNation(room, body.playerId, body.nation);
          } catch (e) {
            return json(res, 400, { error: e.message });
          }
          broadcast(room);
          return json(res, 200, { ok: true });
        }

        if (p === '/api/join') {
          const room = rooms.get(String(body.code || '').toUpperCase());
          if (!room) return json(res, 404, { error: '房间不存在' });
          let seat;
          try {
            seat = addSeat(room, body.name, body.nation);
          } catch (e) {
            return json(res, 400, { error: e.message });
          }
          broadcast(room);
          json(res, 200, { code: room.code, playerId: seat.playerId, nation: seat.nation });
          return;
        }

        if (p === '/api/start') {
          const room = rooms.get(String(body.code || '').toUpperCase());
          if (!room) return json(res, 404, { error: '房间不存在' });
          if (room.hostId !== body.playerId) return json(res, 403, { error: '只有房主可以开始' });
          if (room.game) return json(res, 400, { error: '已经开始了' });
          // 按"还空着的国家"补电脑，不能拿 seats.length 当索引，
          // 否则玩家自选国家后会补出重复国家、漏掉某个国家，导致该回合没人行动、整局卡住
          while (room.seats.length < ROLE_ORDER.length) {
            const free = freeNations(room);
            if (!free.length) break;
            const nation = free[0];
            room.seats.push({ playerId: 'bot_' + rid(6), name: '电脑·' + NATIONS[nation].name, nation: nation, bot: true });
          }
          room.game = newGame(Date.now() % 100000);
          broadcast(room);
          json(res, 200, { ok: true });
          return;
        }

        if (p === '/api/cmd') {
          const room = rooms.get(String(body.code || '').toUpperCase());
          if (!room || !room.game) return json(res, 404, { error: '对局不存在' });
          const seat = findSeat(room, body.playerId);
          if (!seat) return json(res, 403, { error: '你不在这个房间' });
          try {
            applyCommand(room.game, seat.nation, body.cmd || {});
            broadcast(room);
            json(res, 200, { ok: true });
          } catch (e) {
            if (e instanceof RuleError) return json(res, 400, { error: e.message });
            throw e;
          }
          return;
        }

        return json(res, 404, { error: 'no such api' });
      }

      if (p === '/api/state') {
        const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase());
        if (!room) return json(res, 404, { error: '房间不存在' });
        const seat = findSeat(room, url.searchParams.get('playerId'));
        if (!seat) return json(res, 403, { error: '你不在这个房间' });
        return json(res, 200, roomViewFor(room, seat));
      }

      if (p === '/api/events') {
        const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase());
        if (!room) return json(res, 404, { error: '房间不存在' });
        const pid = url.searchParams.get('playerId');
        const seat = findSeat(room, pid);
        if (!seat) return json(res, 403, { error: '你不在这个房间' });
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write('retry: 2000\n\n');
        room.clients.set(pid, res);
        send(res, roomViewFor(room, seat));
        const hb = setInterval(function () { try { res.write(': ping\n\n'); } catch (e) { } }, 15000);
        req.on('close', function () { clearInterval(hb); room.clients.delete(pid); });
        return;
      }

      return json(res, 404, { error: 'no such api' });
    }

    // 静态文件
    let filePath = p === '/' ? '/index.html' : p;
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(PUBLIC_DIR, filePath);
    if (!full.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'forbidden' });
    fs.readFile(full, function (err, data) {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: '服务器错误：' + e.message });
  }
});

server.listen(PORT, function () {
  console.log('二战风云 P1 已启动: http://127.0.0.1:' + PORT);
});
