// 规则引擎（P1）：五步回合 / 补给 / 战斗 / 得分 / 响应与状态牌 / 反应栈 / 海峡
import { AREAS, AREA_MAP, ROLE_ORDER, NATIONS, STRAITS, sameTeam } from './map.mjs';
import { buildDeck, buildSpecialCards, KIND_INFO, SPECIAL_DEFS } from './cards.mjs';

const HAND_SIZE = 7;
const MAX_ROUND = 20;
const SUDDEN_DEATH = 30;
const TEAM_OF = { germany: 'axis', italy: 'axis', japan: 'axis', uk: 'allies', ussr: 'allies', usa: 'allies' };
const BUILD_KINDS = ['build_army', 'build_navy', 'land_battle', 'sea_battle'];

export class RuleError extends Error {}

/* ---------- 随机 ---------- */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/* ---------- 初始化 ---------- */
export function newGame(seed) {
  const rng = mulberry32(seed || 1);
  const state = {
    seed: seed || 1,
    round: 1,
    turn: 0,
    board: {},
    nations: {},
    table: {},
    teamVP: { axis: 0, allies: 0 },
    stack: [],
    awaiting: null,
    seq: 0,
    log: [],
    result: null,
  };

  for (const id of ROLE_ORDER) {
    const meta = NATIONS[id];
    state.board[meta.home] = state.board[meta.home] || {};
    state.board[meta.home][id] = 'army';
    const deck = shuffle(buildDeck(id).concat(buildSpecialCards(id)), rng);
    const hand = deck.splice(0, 10);
    state.nations[id] = {
      hand: hand.slice(0, HAND_SIZE),
      deck: deck,
      discard: hand.slice(HAND_SIZE),
      pool: { army: meta.armies - 1, fleet: meta.fleets },
    };
    state.table[id] = { responses: [], statuses: [] };
  }

  log(state, null, '战争爆发：' + ROLE_ORDER.map(function (n) { return NATIONS[n].name; }).join('、') + ' 各自在本土集结 1 支陆军。');
  log(state, null, '第 1 回合开始，当前行动：德国。');
  return state;
}

function log(state, nation, text, extra) {
  const entry = { r: state.round, t: state.turn, n: nation, text: text };
  if (extra) for (const k in extra) entry[k] = extra[k];
  state.log.push(entry);
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}
// 出牌的富信息，供客户端做「敌方出牌说明」浮层
function playInfo(card, nation, target) {
  return {
    by: nation,
    play: {
      name: card.name,
      kind: card.kind,
      text: card.text,
      target: target || null,
      targetName: target && AREA_MAP[target] ? AREA_MAP[target].name : null,
    },
  };
}

export { log };

export function currentNation(state) {
  return ROLE_ORDER[state.turn];
}
function turnKey(state) {
  return state.round * 100 + state.turn;
}
function teamName(nation) {
  return TEAM_OF[nation] === 'axis' ? '轴心' : '同盟';
}

/* ---------- 棋子 ---------- */
export function pieceAt(state, area, nation) {
  const occ = state.board[area];
  return occ ? occ[nation] || null : null;
}
function placePiece(state, area, nation, type) {
  state.board[area] = state.board[area] || {};
  state.board[area][nation] = type;
  state.nations[nation].pool[type] -= 1;
}
function removePiece(state, area, nation) {
  const occ = state.board[area];
  if (!occ || !occ[nation]) return null;
  const type = occ[nation];
  delete occ[nation];
  if (Object.keys(occ).length === 0) delete state.board[area];
  state.nations[nation].pool[type] += 1;
  return type;
}
function hasEnemyPiece(state, area, nation) {
  const occ = state.board[area] || {};
  return Object.keys(occ).some(function (o) { return !sameTeam(o, nation); });
}
function friendlyPieceOfType(state, area, nation, type) {
  const occ = state.board[area] || {};
  return Object.keys(occ).some(function (o) { return sameTeam(o, nation) && occ[o] === type; });
}
function enemyAt(state, area, nation, type) {
  const occ = state.board[area] || {};
  for (const other of Object.keys(occ)) {
    if (!sameTeam(other, nation) && occ[other] === type) return other;
  }
  return null;
}

/* ---------- 海峡与相邻 ---------- */
const STRAIT_PAIR = new Map();
for (const s of STRAITS) {
  STRAIT_PAIR.set(s.a + '|' + s.b, s);
  STRAIT_PAIR.set(s.b + '|' + s.a, s);
}
export function straitOpen(state, strait, team) {
  const occ = state.board[strait.control] || {};
  const axisArmy = Object.keys(occ).some(function (n) { return NATIONS[n].team === 'axis' && occ[n] === 'army'; });
  return team === 'axis' ? axisArmy : !axisArmy;
}
export function adjacentAreas(state, area, nation) {
  const team = NATIONS[nation].team;
  const out = [];
  for (const nb of AREA_MAP[area].adj) {
    const s = STRAIT_PAIR.get(area + '|' + nb);
    if (!s || straitOpen(state, s, team)) out.push(nb);
  }
  // 海峡把两块本来不相邻的海域接起来（开放时才算相邻）
  for (const s of STRAITS) {
    if (s.a !== area && s.b !== area) continue;
    const other = s.a === area ? s.b : s.a;
    if (!straitOpen(state, s, team)) continue;
    if (!out.includes(other)) out.push(other);
  }
  return out;
}
function hasPort(state, seaArea, nation) {
  for (const nb of AREA_MAP[seaArea].adj) {
    if (AREA_MAP[nb].type !== 'land') continue;
    const occ = state.board[nb] || {};
    for (const other of Object.keys(occ)) {
      if (sameTeam(other, nation) && occ[other] === 'army') return true;
    }
  }
  return false;
}

/* ---------- 补给 ---------- */
export function suppliedAreas(state, nation) {
  const own = new Set();
  for (const area of Object.keys(state.board)) {
    if (state.board[area][nation]) own.add(area);
  }
  const supplied = new Set();
  const queue = [];
  for (const area of own) {
    if (AREA_MAP[area].supply && state.board[area][nation] === 'army') { supplied.add(area); queue.push(area); }
  }
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of adjacentAreas(state, cur, nation)) {
      if (own.has(nb) && !supplied.has(nb)) { supplied.add(nb); queue.push(nb); }
    }
  }
  const out = new Set();
  for (const area of supplied) {
    if (state.board[area][nation] === 'fleet') { if (hasPort(state, area, nation)) out.add(area); }
    else out.add(area);
  }
  return out;
}

/* ---------- 合法行动 ---------- */
export function legalMoves(state, nation) {
  if (state.result || state.awaiting || state.stack.length) return [];
  if (currentNation(state) !== nation) return [];
  const n = state.nations[nation];
  const supplied = suppliedAreas(state, nation);
  const ownAreas = Object.keys(state.board).filter(function (a) { return state.board[a][nation]; });

  const nearOwn = new Set();
  for (const a of ownAreas) for (const nb of adjacentAreas(state, a, nation)) nearOwn.add(nb);
  const nearSupplied = new Set();
  for (const a of supplied) for (const nb of adjacentAreas(state, a, nation)) nearSupplied.add(nb);

  const landBuild = [];
  const seaBuild = [];
  for (const a of AREAS) {
    if (state.board[a.id] && state.board[a.id][nation]) continue;
    if (hasEnemyPiece(state, a.id, nation)) continue;
    if (a.type === 'land') {
      if (NATIONS[nation].home === a.id || nearSupplied.has(a.id)) landBuild.push(a.id);
    } else if (nearSupplied.has(a.id)) seaBuild.push(a.id);
  }

  const landBattle = [];
  const seaBattle = [];
  for (const a of AREAS) {
    if (a.type === 'land') {
      if (nearOwn.has(a.id) && !friendlyPieceOfType(state, a.id, nation, 'army')) landBattle.push(a.id);
    } else {
      if (nearSupplied.has(a.id) && !friendlyPieceOfType(state, a.id, nation, 'fleet')) seaBattle.push(a.id);
    }
  }

  const out = [];
  for (const card of n.hand) {
    if (card.kind === 'build_army') { if (n.pool.army > 0) out.push({ cardId: card.id, kind: card.kind, targets: landBuild }); }
    else if (card.kind === 'build_navy') { if (n.pool.fleet > 0) out.push({ cardId: card.id, kind: card.kind, targets: seaBuild }); }
    else if (card.kind === 'land_battle') out.push({ cardId: card.id, kind: card.kind, targets: landBattle });
    else if (card.kind === 'sea_battle') out.push({ cardId: card.id, kind: card.kind, targets: seaBattle });
    else out.push({ cardId: card.id, kind: card.kind, targets: [null] });
  }
  return out;
}

export function canResearch(state, nation) {
  if (state.result || state.awaiting || state.stack.length) return false;
  if (currentNation(state) !== nation) return false;
  return state.nations[nation].hand.length >= 4;
}

/* ---------- 反应：谁的牌能在什么时机用 ---------- */
function sideOk(side, nation, ctx) {
  if (side === 'self') return nation === ctx.owner;
  if (side === 'attacker') return nation === ctx.owner;
  if (side === 'defender') return nation === ctx.defender;
  if (side === 'defender_home') return nation === ctx.defender && ctx.area === NATIONS[ctx.defender].home;
  if (side === 'opponent') return !sameTeam(nation, ctx.owner);
  return false;
}

function eligibleCards(state, nation, trigger, ctx) {
  const t = state.table[nation];
  const out = [];
  for (const c of t.responses.concat(t.statuses)) {
    if (c.trigger !== trigger) continue;
    if (!sideOk(c.side, nation, ctx)) continue;
    if (c.kind === 'status' && c.usedTurn === turnKey(state)) continue;
    out.push(c);
  }
  return out;
}

function windowOrder(state, ctx) {
  const ownerTeam = TEAM_OF[ctx.owner];
  const foes = ROLE_ORDER.filter(function (n) { return TEAM_OF[n] !== ownerTeam; });
  const own = ROLE_ORDER.filter(function (n) { return TEAM_OF[n] === ownerTeam; });
  const order = [];
  for (let i = 0; i < 3; i++) {
    if (foes[i]) order.push(foes[i]);
    if (own[i]) order.push(own[i]);
  }
  return order;
}

function pushWindow(state, trigger, ctx) {
  const order = windowOrder(state, ctx);
  const any = order.some(function (n) { return eligibleCards(state, n, trigger, ctx).length > 0; });
  if (!any) return;
  state.stack.push({ type: 'window', id: ++state.seq, trigger: trigger, ctx: ctx, passed: new Set(), order: order });
}

function nextResponder(state, w) {
  for (const n of w.order) {
    if (w.passed.has(n)) continue;
    const cards = eligibleCards(state, n, w.trigger, w.ctx);
    if (!cards.length) { w.passed.add(n); continue; }
    return { nation: n, cards: cards };
  }
  return null;
}

const TRIGGER_TEXT = {
  battle: '战斗宣言',
  build: '敌军建造',
  score: '敌军得分',
};

/* ---------- 执行栈 ---------- */
function pump(state) {
  let guard = 0;
  while (!state.awaiting && state.stack.length) {
    if (++guard > 400) { state.stack.length = 0; throw new Error('反应链过深'); }
    const f = state.stack[state.stack.length - 1];
    if (f.type === 'ops') {
      if (f.i >= f.ops.length) { state.stack.pop(); continue; }
      const op = f.ops[f.i++];
      execOp(state, op);
    } else if (f.type === 'window') {
      const r = nextResponder(state, f);
      if (!r) { state.stack.pop(); continue; }
      state.awaiting = {
        kind: 'reaction',
        nation: r.nation,
        trigger: f.trigger,
        windowId: f.id,
        text: (TRIGGER_TEXT[f.trigger] || f.trigger) + '：' + describeCtx(f.ctx),
        options: r.cards.map(function (c) { return { cardId: c.id, name: c.name, text: c.text, kind: c.kind }; }),
      };
    }
  }
}

function describeCtx(ctx) {
  const parts = [];
  if (ctx.owner) parts.push(NATIONS[ctx.owner].name);
  if (ctx.area) parts.push(AREA_MAP[ctx.area].name);
  if (ctx.type) parts.push(ctx.type === 'army' ? '陆军' : '舰队');
  if (ctx.defender) parts.push('→ ' + NATIONS[ctx.defender].name);
  if (ctx.vp) parts.push('+' + ctx.vp + ' 分');
  return parts.join(' ');
}

function execOp(state, op) {
  switch (op.op) {
    case 'place': {
      const pool = state.nations[op.nation].pool[op.type];
      if (pool <= 0) return;
      if (state.board[op.area] && state.board[op.area][op.nation]) return;
      placePiece(state, op.area, op.nation, op.type);
      log(state, op.nation, NATIONS[op.nation].name + ' 在' + AREA_MAP[op.area].name + '部署 1 支' + (op.type === 'army' ? '陆军' : '舰队') + '。');
      break;
    }
    case 'window':
      pushWindow(state, op.trigger, op.ctx);
      break;
    case 'cancelPlace': {
      if (!op.ctx.cancelled) return;
      const t = removePiece(state, op.ctx.area, op.ctx.owner);
      if (t) log(state, op.ctx.owner, NATIONS[op.ctx.owner].name + ' 在' + AREA_MAP[op.ctx.area].name + '的部署被截击取消。');
      break;
    }
    case 'battle': {
      const ctx = op.ctx;
      if (ctx.cancelled) {
        log(state, ctx.owner, '对' + AREA_MAP[ctx.area].name + '的攻击被取消。');
        return;
      }
      const target = ctx.defender;
      if (target) {
        const removed = removePiece(state, ctx.area, target);
        if (removed) {
          log(state, ctx.owner, NATIONS[ctx.owner].name + ' 在' + AREA_MAP[ctx.area].name + '歼灭 ' + NATIONS[target].name + (removed === 'army' ? ' 陆军 1 支！' : ' 舰队 1 支！'));
        }
      } else {
        log(state, ctx.owner, NATIONS[ctx.owner].name + ' 对' + AREA_MAP[ctx.area].name + '发起攻击，但那里没有敌军。');
      }
      break;
    }
    case 'vp': {
      if (op.ctx.cancelled) { log(state, op.ctx.owner, '得分被情报封锁取消。'); return; }
      state.teamVP[TEAM_OF[op.ctx.owner]] += op.ctx.vp;
      log(state, op.ctx.owner, NATIONS[op.ctx.owner].name + ' 获得 ' + op.ctx.vp + ' 胜利点。');
      break;
    }
    case 'draw': {
      const got = drawCards(state, op.nation, op.n);
      log(state, op.nation, NATIONS[op.nation].name + ' 抽了 ' + got + ' 张牌。');
      break;
    }
    case 'strike': {
      const enemies = ROLE_ORDER.filter(function (x) { return !sameTeam(x, op.nation); });
      const parts = [];
      for (const e of enemies) {
        const ok = discardOne(state, e);
        if (ok) parts.push(NATIONS[e].name);
        else { state.teamVP[TEAM_OF[e]] -= 1; parts.push(NATIONS[e].name + '(扣1分)'); }
      }
      log(state, op.nation, NATIONS[op.nation].name + ' 发动经济战：' + parts.join('、') + ' 各弃 1 张牌。');
      break;
    }
    case 'endTurn':
      endTurn(state);
      break;
    default:
      throw new Error('unknown op ' + op.op);
  }
}

/* ---------- 使用响应 / 状态牌 ---------- */
function useTableCard(state, w, nation, card) {
  const t = state.table[nation];
  if (card.kind === 'response') {
    const i = t.responses.indexOf(card);
    if (i >= 0) t.responses.splice(i, 1);
    state.nations[nation].discard.push(card);
  } else {
    card.usedTurn = turnKey(state);
  }

  const ctx = w.ctx;
  const name = NATIONS[nation].name;
  switch (card.key) {
    case 'ambush':
    case 'home_guard':
    case 'denial':
      ctx.cancelled = true;
      log(state, nation, name + ' 使用「' + card.name + '」：' + TRIGGER_TEXT[w.trigger] + '被取消。');
      break;
    case 'intercept': {
      const type = removePiece(state, ctx.area, ctx.owner);
      if (type) log(state, nation, name + ' 使用「截击」：' + NATIONS[ctx.owner].name + ' 在' + AREA_MAP[ctx.area].name + '的棋子被移除。');
      else log(state, nation, name + ' 使用「截击」，但目标已不在。');
      break;
    }
    case 'fortress': {
      const occ = state.board[ctx.area] || {};
      const foe = Object.keys(occ).find(function (o) { return !sameTeam(o, nation) && o !== ctx.owner && o !== ctx.defender; });
      if (foe) {
        removePiece(state, ctx.area, foe);
        log(state, nation, name + ' 使用「要塞化」：额外歼灭 ' + NATIONS[foe].name + ' 在' + AREA_MAP[ctx.area].name + '的棋子。');
      } else {
        log(state, nation, name + ' 使用「要塞化」，但目标地块没有其他敌军。');
      }
      break;
    }
  }
}

/* ---------- 命令 ---------- */
export function applyCommand(state, nation, cmd) {
  if (state.result) throw new RuleError('对局已结束');

  if (state.awaiting) {
    if (state.awaiting.nation !== nation) {
      throw new RuleError('现在等待 ' + NATIONS[state.awaiting.nation].name + ' 回应');
    }
    const w = state.stack[state.stack.length - 1];
    if (cmd.type === 'pass') {
      w.passed.add(nation);
      state.awaiting = null;
      log(state, nation, NATIONS[nation].name + ' 放弃反应。');
      pump(state);
      return state;
    }
    if (cmd.type === 'react') {
      const opt = state.awaiting.options.find(function (o) { return o.cardId === cmd.cardId; });
      if (!opt) throw new RuleError('这张牌不能在此刻使用');
      const t = state.table[nation];
      const card = t.responses.concat(t.statuses).find(function (c) { return c.id === cmd.cardId; });
      if (!card) throw new RuleError('牌不在桌面上');
      useTableCard(state, w, nation, card);
      w.passed.add(nation);
      state.awaiting = null;
      pump(state);
      return state;
    }
    throw new RuleError('现在只能选择响应或放弃');
  }

  if (currentNation(state) !== nation) {
    throw new RuleError('还没轮到你，当前行动：' + NATIONS[currentNation(state)].name);
  }

  if (cmd.type === 'research') return doResearch(state, nation, cmd);

  const n = state.nations[nation];
  const idx = n.hand.findIndex(function (c) { return c.id === cmd.cardId; });
  if (idx < 0) throw new RuleError('这张牌不在你手上');
  const card = n.hand[idx];

  if (cmd.type === 'discard') {
    n.hand.splice(idx, 1);
    n.discard.push(card);
    log(state, nation, NATIONS[nation].name + ' 弃掉了「' + card.name + '」。');
    state.stack.push({ type: 'ops', ops: [{ op: 'endTurn' }], i: 0 });
    pump(state);
    return state;
  }

  if (cmd.type !== 'play') throw new RuleError('未知操作');

  const legal = legalMoves(state, nation).find(function (m) { return m.cardId === card.id; });
  if (!legal) throw new RuleError('这张牌当前无法使用');
  if (KIND_INFO[card.kind] && KIND_INFO[card.kind].target && legal.targets.length === 0) {
    throw new RuleError('这张牌没有合法目标，可以改为弃牌');
  }
  if (KIND_INFO[card.kind] && KIND_INFO[card.kind].target && (!cmd.target || !legal.targets.includes(cmd.target))) {
    throw new RuleError('目标不合法');
  }

  n.hand.splice(idx, 1);

  // 响应牌 / 状态牌：扣置 / 翻开，本回合出牌动作结束
  if (card.kind === 'response' || card.kind === 'status') {
    if (card.kind === 'response') state.table[nation].responses.push(card);
    else state.table[nation].statuses.push(card);
    log(state, nation, NATIONS[nation].name + (card.kind === 'response' ? ' 扣置响应牌「' : ' 展开状态牌「') + card.name + '」。');
    state.stack.push({ type: 'ops', ops: [{ op: 'endTurn' }], i: 0 });
    pump(state);
    return state;
  }

  n.discard.push(card);
  const ops = [];
  const tgt = cmd.target;

  switch (card.kind) {
    case 'build_army':
    case 'build_navy': {
      const type = card.kind === 'build_army' ? 'army' : 'fleet';
      const ctx = { owner: nation, area: tgt, type: type, cancelled: false };
      ops.push({ op: 'place', nation: nation, area: tgt, type: type });
      ops.push({ op: 'window', trigger: 'build', ctx: ctx });
      ops.push({ op: 'cancelPlace', ctx: ctx });
      log(state, nation, NATIONS[nation].name + ' 打出「' + card.name + '」，目标：' + AREA_MAP[tgt].name + '。', playInfo(card, nation, tgt));
      break;
    }
    case 'land_battle':
    case 'sea_battle': {
      const type = card.kind === 'land_battle' ? 'army' : 'fleet';
      const defender = enemyAt(state, tgt, nation, type);
      const ctx = { owner: nation, defender: defender, area: tgt, type: type, cancelled: false };
      ops.push({ op: 'window', trigger: 'battle', ctx: ctx });
      ops.push({ op: 'battle', ctx: ctx });
      log(state, nation, NATIONS[nation].name + ' 打出「' + card.name + '」，攻击 ' + AREA_MAP[tgt].name + '。', playInfo(card, nation, tgt));
      break;
    }
    case 'event_score': {
      const ctx = { owner: nation, vp: 2, cancelled: false, area: null };
      ops.push({ op: 'window', trigger: 'score', ctx: ctx });
      ops.push({ op: 'vp', ctx: ctx });
      log(state, nation, NATIONS[nation].name + ' 打出「' + card.name + '」（+2 分）。', playInfo(card, nation, null));
      break;
    }
    case 'event_draw':
      ops.push({ op: 'draw', nation: nation, n: 2 });
      log(state, nation, NATIONS[nation].name + ' 打出「' + card.name + '」。', playInfo(card, nation, null));
      break;
    case 'event_strike':
      ops.push({ op: 'strike', nation: nation });
      log(state, nation, NATIONS[nation].name + ' 打出「' + card.name + '」。', playInfo(card, nation, null));
      break;
    default:
      throw new RuleError('未知卡牌类型');
  }

  ops.push({ op: 'endTurn' });
  state.stack.push({ type: 'ops', ops: ops, i: 0 });
  pump(state);
  return state;
}

function doResearch(state, nation, cmd) {
  const n = state.nations[nation];
  if (n.hand.length < 4) throw new RuleError('手牌不足 4 张，无法重新调配');
  const ids = Array.isArray(cmd.discard) ? cmd.discard : [];
  if (ids.length !== 4 || new Set(ids).size !== 4) throw new RuleError('需要选中 4 张要弃掉的牌');
  const kind = cmd.take;
  if (!BUILD_KINDS.includes(kind)) throw new RuleError('只能检索建造或战斗牌');
  for (const id of ids) {
    if (!n.hand.some(function (c) { return c.id === id; })) throw new RuleError('选中的牌不在手上');
  }
  const pickIdx = n.deck.findIndex(function (c) { return c.kind === kind; });
  if (pickIdx < 0) throw new RuleError('牌库里已经没有这类牌');

  for (const id of ids) {
    const i = n.hand.findIndex(function (c) { return c.id === id; });
    n.discard.push(n.hand.splice(i, 1)[0]);
  }
  const picked = n.deck.splice(pickIdx, 1)[0];
  n.hand.push(picked);
  const rng = mulberry32(state.seed + state.round * 31 + state.turn);
  shuffle(n.deck, rng);
  log(state, nation, NATIONS[nation].name + ' 重新调配资源：弃 4 张，检索到「' + picked.name + '」。');
  return state;
}

/* ---------- 回合推进 ---------- */
function drawCards(state, nation, count) {
  const n = state.nations[nation];
  let got = 0;
  for (let i = 0; i < count; i++) {
    if (n.deck.length === 0) break;
    n.hand.push(n.deck.shift());
    got++;
  }
  return got;
}
function discardOne(state, nation) {
  const n = state.nations[nation];
  if (n.hand.length > 0) { n.discard.push(n.hand.pop()); return true; }
  if (n.deck.length > 0) { n.discard.push(n.deck.shift()); return true; }
  return false;
}

function endTurn(state) {
  const nation = currentNation(state);
  supplyStep(state, nation);
  scoreStep(state, nation);
  drawStep(state, nation);
  advance(state);
}

function supplyStep(state, nation) {
  const supplied = suppliedAreas(state, nation);
  const lost = [];
  for (const area of Object.keys(state.board)) {
    if (!state.board[area][nation]) continue;
    if (!supplied.has(area)) {
      const type = state.board[area][nation];
      removePiece(state, area, nation);
      lost.push(AREA_MAP[area].name + (type === 'army' ? '陆军' : '舰队'));
    }
  }
  if (lost.length) log(state, nation, NATIONS[nation].name + ' 补给中断，失去：' + lost.join('、') + '。');
}

export function forecastScore(state, nation) {
  const home = NATIONS[nation].home;
  const occ = state.board[home] || {};
  const lost = Object.keys(occ).some(function (o) { return !sameTeam(o, nation) && occ[o] === 'army'; });
  if (lost) return 0;
  let vp = 0;
  for (const area of AREAS) {
    if (!area.star) continue;
    const o = state.board[area.id] || {};
    if (o[nation] !== 'army') continue;
    const allies = Object.keys(o).filter(function (x) { return x !== nation && sameTeam(x, nation); });
    vp += allies.length > 0 ? 1 : 2;
  }
  const bonus = state.table[nation].statuses.filter(function (c) { return c.key === 'war_economy'; }).length;
  return vp + bonus;
}

function scoreStep(state, nation) {
  const home = NATIONS[nation].home;
  const occ = state.board[home] || {};
  const occupiedByEnemy = Object.keys(occ).some(function (o) { return !sameTeam(o, nation) && occ[o] === 'army'; });
  if (occupiedByEnemy) {
    log(state, nation, NATIONS[nation].name + ' 本土沦陷，跳过得分阶段。');
    return;
  }
  let vp = 0;
  const detail = [];
  for (const area of AREAS) {
    if (!area.star) continue;
    const o = state.board[area.id] || {};
    if (o[nation] !== 'army') continue;
    const allies = Object.keys(o).filter(function (x) { return x !== nation && sameTeam(x, nation); });
    const gain = allies.length > 0 ? 1 : 2;
    vp += gain;
    detail.push(area.name + '+' + gain);
  }
  const bonus = state.table[nation].statuses.filter(function (c) { return c.key === 'war_economy'; }).length;
  if (bonus) { vp += bonus; detail.push('战时经济+' + bonus); }
  if (vp > 0) {
    state.teamVP[TEAM_OF[nation]] += vp;
    log(state, nation, NATIONS[nation].name + ' 得分 +' + vp + '（' + detail.join('，') + '）。');
  } else {
    log(state, nation, NATIONS[nation].name + ' 没有占据★补给点，本轮 0 分。');
  }
}

function drawStep(state, nation) {
  const n = state.nations[nation];
  while (n.hand.length < HAND_SIZE && n.deck.length > 0) n.hand.push(n.deck.shift());
  if (n.hand.length < HAND_SIZE && n.deck.length === 0) {
    log(state, nation, NATIONS[nation].name + ' 牌库见底，只能以现有手牌继续作战。');
  }
}

function advance(state) {
  state.turn += 1;
  if (state.turn >= ROLE_ORDER.length) {
    state.turn = 0;
    state.round += 1;
    checkVictory(state);
  }
  if (!state.result) log(state, null, '第 ' + state.round + ' 回合，当前行动：' + NATIONS[currentNation(state)].name + '。');
}

function checkVictory(state) {
  const diff = state.teamVP.axis - state.teamVP.allies;
  if (Math.abs(diff) >= SUDDEN_DEATH) {
    state.result = { winner: diff > 0 ? 'axis' : 'allies', reason: '分差达到 ' + SUDDEN_DEATH + '，提前结束', score: { axis: state.teamVP.axis, allies: state.teamVP.allies } };
  } else if (state.round > MAX_ROUND) {
    let winner = 'axis';
    if (state.teamVP.allies > state.teamVP.axis) winner = 'allies';
    state.result = { winner: winner, reason: '20 回合结束，比分定胜负' + (state.teamVP.axis === state.teamVP.allies ? '（平局，轴心胜）' : ''), score: { axis: state.teamVP.axis, allies: state.teamVP.allies } };
  }
  if (state.result) log(state, null, '对局结束：' + (state.result.winner === 'axis' ? '轴心' : '同盟') + '获胜 —— ' + state.result.reason + '。');
}

/* ---------- 视图 ---------- */
export function view(state, viewer) {
  const nations = {};
  const table = {};
  const forecast = {};
  for (const id of ROLE_ORDER) {
    forecast[id] = forecastScore(state, id);
    const n = state.nations[id];
    nations[id] = { handCount: n.hand.length, deckCount: n.deck.length, discardCount: n.discard.length, pool: n.pool };
    table[id] = {
      statuses: state.table[id].statuses.map(function (c) { return { id: c.id, name: c.name, text: c.text, key: c.key }; }),
      responseCount: state.table[id].responses.length,
    };
  }
  const mine = state.nations[viewer];
  const strip = function (c) { return { id: c.id, name: c.name, kind: c.kind, text: c.text }; };
  const awaiting = state.awaiting
    ? {
        nation: state.awaiting.nation,
        text: state.awaiting.text,
        options: state.awaiting.nation === viewer ? state.awaiting.options : null,
      }
    : null;

  return {
    round: state.round,
    turn: state.turn,
    current: currentNation(state),
    result: state.result,
    teamVP: state.teamVP,
    forecast: forecast,
    board: state.board,
    nations: nations,
    table: table,
    myTable: state.table[viewer],
    hand: mine.hand,
    piles: {
      deck: mine.deck.map(strip),
      discard: mine.discard.map(strip),
    },
    legal: legalMoves(state, viewer),
    canResearch: canResearch(state, viewer),
    canResearchNow: canResearch(state, viewer),
    awaiting: awaiting,
    log: state.log.slice(-40),
    map: AREAS.map(function (a) {
      return { id: a.id, name: a.name, type: a.type, islet: !!a.islet, geo: a.geo, label: a.label, supply: !!a.supply, star: !!a.star, home: a.home || null, adj: a.adj };
    }),
    straits: STRAITS.map(function (s) {
      return { id: s.id, name: s.name, a: s.a, b: s.b, control: s.control, openAxis: straitOpen(state, s, 'axis'), openAllies: straitOpen(state, s, 'allies') };
    }),
    nationsMeta: NATIONS,
    order: ROLE_ORDER,
    me: viewer,
  };
}
