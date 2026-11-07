// 简化牌库（P0）：每国 30 张，只保留 建造 / 战斗 / 事件 三类
// 卡名与卡面文本均为本项目自创，不复制原版卡牌文字

const KIND_INFO = {
  build_army:  { label: '建造陆军', target: 'land' },
  build_navy:  { label: '建造海军', target: 'sea' },
  land_battle: { label: '陆战',     target: 'land' },
  sea_battle:  { label: '海战',     target: 'sea' },
  event_score: { label: '事件',     target: null },
  event_draw:  { label: '事件',     target: null },
  event_strike:{ label: '事件',     target: null },
};

export { KIND_INFO };

const NAMES = {
  germany: {
    build_army: ['装甲集群', '步兵军', '预备役动员', '东线增援', '虎式重装营'],
    build_navy: ['潜艇支队', '水面舰队'],
    land_battle: ['闪电战', '钳形攻势', '炮火准备'],
    sea_battle: ['狼群战术'],
    event_score: ['战争经济', '宣传攻势'],
    event_draw: ['总参谋部', '情报截获'],
    event_strike: ['战略轰炸'],
  },
  italy: {
    build_army: ['步兵师', '殖民地征召', '山地兵团'],
    build_navy: ['地中海舰队', '护航编队', '鱼雷艇队'],
    land_battle: ['沙漠攻势', '步兵突击'],
    sea_battle: ['舰队决战', '破交作战'],
    event_score: ['殖民地税收', '外交斡旋'],
    event_draw: ['情报处', '后勤重整'],
    event_strike: ['经济封锁'],
  },
  japan: {
    build_army: ['步兵联队', '关东军增援', '登陆部队'],
    build_navy: ['机动舰队', '航母编队', '驱逐舰队'],
    land_battle: ['夜袭', '丛林突击', '登陆作战'],
    sea_battle: ['航空攻击', '水雷战'],
    event_score: ['资源掠夺', '南洋占领'],
    event_draw: ['大本营', '侦察机队'],
    event_strike: ['海上封锁'],
  },
  uk: {
    build_army: ['本土防卫', '殖民地部队', '远征军'],
    build_navy: ['皇家海军', '护航舰队', '驱逐舰支队'],
    land_battle: ['反攻', '突击队袭击'],
    sea_battle: ['猎潜作战', '舰队交锋'],
    event_score: ['帝国资源', '租借物资'],
    event_draw: ['情报网', '战时内阁'],
    event_strike: ['封锁线'],
  },
  ussr: {
    build_army: ['步兵集团军', '坦克军', '民兵师', '西伯利亚师'],
    build_navy: ['波罗的海舰队'],
    land_battle: ['纵深防御', '大纵深突击', '炮火覆盖'],
    sea_battle: ['海岸炮击'],
    event_score: ['战时工业', '国土动员'],
    event_draw: ['总参谋部', '游击战'],
    event_strike: ['焦土政策'],
  },
  usa: {
    build_army: ['远征军', '海军陆战队', '工业动员'],
    build_navy: ['太平洋舰队', '航母特混舰队', '登陆舰队'],
    land_battle: ['两栖登陆', '空中支援'],
    sea_battle: ['舰队决战', '反潜巡逻'],
    event_score: ['租借法案', '战争债券'],
    event_draw: ['战略情报局', '工业转产'],
    event_strike: ['战略轰炸'],
  },
};

const DECKS = {
  // 组建陆军 / 组建海军 / 陆地攻击 / 海洋攻击 / 经济打击 / 事件得分 / 事件抽牌
  germany: { build_army: 6, build_navy: 2, land_battle: 7, sea_battle: 2, event_strike: 6, event_score: 4, event_draw: 2 },
  japan:   { build_army: 4, build_navy: 6, land_battle: 3, sea_battle: 4, event_strike: 2, event_score: 0, event_draw: 0 },
  italy:   { build_army: 5, build_navy: 4, land_battle: 4, sea_battle: 3, event_strike: 2, event_score: 2, event_draw: 2 },
  uk:      { build_army: 5, build_navy: 5, land_battle: 4, sea_battle: 5, event_strike: 2, event_score: 4, event_draw: 2 },
  ussr:    { build_army: 8, build_navy: 1, land_battle: 6, sea_battle: 2, event_strike: 0, event_score: 4, event_draw: 2 },
  usa:     { build_army: 6, build_navy: 8, land_battle: 4, sea_battle: 6, event_strike: 2, event_score: 3, event_draw: 2 },
};

export function cardText(kind) {
  switch (kind) {
    case 'build_army':  return '部署 1 支陆军：本国本土，或与本国已补给棋子相邻的陆地。';
    case 'build_navy':  return '部署 1 支舰队：与本国已补给棋子相邻的海域。';
    case 'land_battle': return '选一块与本国陆军或舰队相邻的陆地：移除该地 1 支敌军陆军（可打空地）。';
    case 'sea_battle':  return '选一块与本国已补给棋子相邻的海域：移除该地 1 支敌军舰队。';
    case 'event_score': return '立即为阵营 +2 胜利点。';
    case 'event_draw':  return '立即抽 2 张牌。';
    case 'event_strike':return '所有敌国各弃 1 张牌；弃不出则其阵营 -1 胜利点。';
    default: return '';
  }
}

// 特殊牌：响应（扣置，用后进弃牌堆）与 状态（翻开，留在桌面）
export const SPECIAL_DEFS = {
  ambush:    { kind: 'response', trigger: 'battle', side: 'defender', text: '敌国向我方发起战斗时：取消这次攻击（敌军白打一张牌）。' },
  intercept: { kind: 'response', trigger: 'build',  side: 'opponent', text: '敌国建造棋子时：立刻移除刚建造的那枚棋子。' },
  denial:    { kind: 'response', trigger: 'score',  side: 'opponent', text: '敌国用事件牌得分时：取消这次得分。' },
  fortress:  { kind: 'status',   trigger: 'battle', side: 'attacker', text: '我方发起战斗时：额外移除目标地块的另 1 枚敌军棋子（每回合 1 次）。' },
  home_guard:{ kind: 'status',   trigger: 'battle', side: 'defender_home', text: '敌军进攻我方本土时：取消这次攻击（每次触发 1 次）。' },
  war_economy:{ kind: 'status',  trigger: null,     side: 'self',     text: '我方得分阶段额外 +1 胜利点。' },
};

const SPECIAL_NAMES = {
  ambush: '伏击', intercept: '截击', denial: '情报封锁',
  fortress: '要塞化', home_guard: '本土防卫', war_economy: '战时经济',
};

// 每国：2 张伏击 + 1 张截击 + 1 张专属状态/响应
const SPECIALS = {
  // 德国：0 对策 + 12 局势
  germany: ['fortress','fortress','fortress','fortress','fortress','fortress','war_economy','war_economy','war_economy','home_guard','home_guard','war_economy'],
  // 日本：11 对策 + 4 局势
  japan:   ['ambush','ambush','ambush','ambush','ambush','ambush','intercept','intercept','intercept','intercept','denial','fortress','fortress','war_economy','war_economy'],
  // 英国：7 对策 + 6 局势
  uk:      ['ambush','ambush','ambush','ambush','denial','denial','intercept','home_guard','home_guard','home_guard','war_economy','war_economy','fortress'],
  // 苏联：5 对策 + 6 局势
  ussr:    ['ambush','ambush','ambush','intercept','intercept','home_guard','home_guard','home_guard','fortress','fortress','war_economy'],
  // 意大利：4 对策 + 4 局势
  italy:   ['ambush','ambush','intercept','denial','war_economy','war_economy','home_guard','fortress'],
  // 美国：5 对策 + 5 局势
  usa:     ['ambush','ambush','denial','denial','intercept','war_economy','war_economy','fortress','fortress','home_guard'],
};

export function buildSpecialCards(nationId) {
  return (SPECIALS[nationId] || []).map(function (key, i) {
    const def = SPECIAL_DEFS[key];
    return {
      id: nationId + '_s' + i,
      nation: nationId,
      kind: def.kind,
      key: key,
      name: SPECIAL_NAMES[key],
      text: def.text,
      trigger: def.trigger,
      side: def.side,
      special: true,
    };
  });
}

export function buildDeck(nationId) {
  const counts = DECKS[nationId];
  const names = NAMES[nationId];
  const deck = [];
  let n = 0;
  for (const kind of Object.keys(counts)) {
    const list = names[kind];
    for (let i = 0; i < counts[kind]; i++) {
      const nm = list[i % list.length];
      deck.push({
        id: nationId + '_' + (n++),
        nation: nationId,
        kind: kind,
        name: nm,
        text: cardText(kind),
      });
    }
  }
  return deck;
}