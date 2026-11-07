// 版图数据：按实体版棋盘分区（46 个区域，直边分区 + 真实海岸线裁剪）
// type: land | sea ; supply: 可作补给源 ; star: 得分点 ; home: 该国本土
// geo: 经纬度多边形（渲染时裁剪到陆地）

const R = function (w, s, e, n) { return [[w, s], [e, s], [e, n], [w, n]]; };

export const AREAS = [
  /* ---------------- 北美 / 大西洋 ---------------- */
  { id: 'canada', name: '加拿大', type: 'land', supply: false, star: false,
    label: [-100, 58], geo: [R(-140, 50, -62, 72)], adj: ['us_east', 'greenland', 'north_atlantic', 'pacific_north'] },
  { id: 'us_east', name: '美国东部', type: 'land', home: 'usa', supply: true, star: true,
    label: [-82, 38], geo: [R(-100, 25, -62, 50)], adj: ['canada', 'us_west', 'latin_america', 'north_atlantic'] },
  { id: 'us_west', name: '美国西部', type: 'land', supply: true, star: true,
    label: [-115, 38], geo: [R(-125, 25, -100, 50)], adj: ['us_east', 'canada', 'latin_america', 'pacific_north', 'pacific_central'] },
  { id: 'latin_america', name: '拉丁美洲', type: 'land', supply: false, star: false,
    label: [-62, -12], geo: [R(-85, -38, -35, 14)], adj: ['us_east', 'us_west', 'south_atlantic', 'pacific_central', 'pacific_south'] },
  { id: 'greenland', name: '格陵兰', type: 'land', supply: false, star: false,
    label: [-40, 72], geo: [R(-56, 60, -20, 82)], adj: ['canada', 'north_atlantic'] },
  { id: 'iceland', name: '冰岛', type: 'land', supply: false, star: false,
    label: [-19, 65], geo: [R(-25, 62, -13, 68)], adj: ['north_atlantic', 'greenland'] },
  { id: 'hawaii', name: '夏威夷', type: 'land', islet: true, supply: false, star: false,
    label: [-157.9, 21.3], geo: [R(-163, 17, -152, 26)], adj: ['pacific_central', 'pacific_east'] },
  { id: 'midway', name: '中途岛', type: 'land', islet: true, supply: false, star: false,
    label: [-177.4, 28.2], geo: [R(-180, 24, -172, 33)], adj: ['pacific_north', 'pacific_central'] },
  { id: 'iwo_jima', name: '硫磺岛', type: 'land', islet: true, supply: false, star: false,
    label: [141.3, 24.8], geo: [R(137, 21, 146, 29)], adj: ['pacific_north', 'pacific_central', 'sea_of_japan'] },
  { id: 'guam', name: '关岛', type: 'land', islet: true, supply: false, star: false,
    label: [144.8, 13.4], geo: [R(140, 9, 149, 18)], adj: ['pacific_central', 'south_china_sea'] },

  { id: 'north_atlantic', name: '大西洋北部', type: 'sea', label: [-30, 52],
    geo: [R(-75, 30, -8, 70)], adj: ['canada', 'us_east', 'greenland', 'britain', 'western_europe', 'south_atlantic', 'north_sea'] },
  { id: 'south_atlantic', name: '大西洋南部', type: 'sea', label: [-20, -20],
    geo: [R(-60, -50, 12, 8)], adj: ['north_atlantic', 'latin_america', 'north_africa', 'central_africa'] },

  /* ---------------- 欧洲 ---------------- */
  { id: 'britain', name: '英国', type: 'land', home: 'uk', supply: true, star: true,
    label: [-3, 54], geo: [R(-11, 50, 2, 59)], adj: ['north_atlantic', 'north_sea'] },
  { id: 'western_europe', name: '西欧', type: 'land', supply: true, star: true,
    label: [0, 45], geo: [R(-10, 42, 8, 51)], adj: ['germany', 'italy', 'north_atlantic', 'north_sea', 'mediterranean'] },
  { id: 'germany', name: '德国', type: 'land', home: 'germany', supply: true, star: true,
    label: [10.5, 52.5], geo: [R(6, 46, 24, 56)], adj: ['western_europe', 'italy', 'balkans', 'east_europe', 'scandinavia', 'north_sea', 'baltic_sea'] },
  { id: 'italy', name: '意大利', type: 'land', home: 'italy', supply: true, star: true,
    label: [13.5, 42], seed: [12, 40], geo: [R(8, 36, 20, 47)], adj: ['western_europe', 'germany', 'balkans', 'mediterranean', 'north_africa'] },
  { id: 'balkans', name: '巴尔干半岛', type: 'land', supply: false, star: false,
    label: [22, 42], geo: [R(14, 35, 30, 48)], adj: ['germany', 'italy', 'east_europe', 'ukraine', 'mediterranean', 'black_sea'] },
  { id: 'scandinavia', name: '斯堪的纳维亚', type: 'land', supply: false, star: false,
    label: [16, 64], geo: [R(4, 55, 32, 71)], adj: ['germany', 'east_europe', 'nw_russia', 'north_sea', 'baltic_sea'] },
  { id: 'east_europe', name: '东欧', type: 'land', supply: false, star: false,
    label: [23, 52], geo: [R(15, 45, 32, 57)], adj: ['germany', 'balkans', 'ukraine', 'nw_russia', 'scandinavia', 'baltic_sea'] },
  { id: 'nw_russia', name: '俄罗斯西北部', type: 'land', supply: false, star: false,
    label: [40, 62], geo: [R(28, 56, 50, 70)], adj: ['scandinavia', 'east_europe', 'moscow', 'siberia', 'baltic_sea'] },
  { id: 'ukraine', name: '乌克兰', type: 'land', supply: true, star: true,
    label: [32, 48], geo: [R(22, 43, 42, 52)], adj: ['east_europe', 'balkans', 'moscow', 'caucasus', 'black_sea'] },
  { id: 'moscow', name: '莫斯科', type: 'land', home: 'ussr', supply: true, star: true,
    label: [40, 56], geo: [R(32, 50, 56, 62)], adj: ['nw_russia', 'ukraine', 'caucasus', 'siberia', 'kazakhstan'] },
  { id: 'caucasus', name: '高加索', type: 'land', supply: false, star: false,
    label: [44, 42], geo: [R(38, 38, 52, 47)], adj: ['ukraine', 'moscow', 'middle_east', 'black_sea'] },

  { id: 'north_sea', name: '北海', type: 'sea', label: [4, 54],
    geo: [R(-5, 50, 12, 62)], adj: ['britain', 'western_europe', 'germany', 'scandinavia', 'north_atlantic', 'baltic_sea'] },
  { id: 'baltic_sea', name: '波罗的海', type: 'sea', label: [19, 58],
    geo: [R(10, 53, 27, 65)], adj: ['scandinavia', 'germany', 'east_europe', 'nw_russia', 'north_sea'] },
  { id: 'mediterranean', name: '地中海', type: 'sea', label: [16, 36],
    geo: [R(-6, 30, 36, 45)], adj: ['western_europe', 'italy', 'balkans', 'north_africa', 'black_sea'] },
  { id: 'black_sea', name: '黑海', type: 'sea', label: [34, 43],
    geo: [R(27, 40, 42, 48)], adj: ['balkans', 'ukraine', 'caucasus', 'mediterranean', 'caspian'] },
  { id: 'caspian', name: '里海', type: 'sea', label: [51, 42],
    geo: [R(46, 36, 56, 47)], adj: ['caucasus', 'moscow', 'central_asia', 'middle_east'] },
  { id: 'sea_of_japan', name: '日本海', type: 'sea', label: [134, 40],
    geo: [R(127, 33, 142, 46)], adj: ['japan', 'manchuria', 'pacific_north', 'pacific_nw'] },

  /* ---------------- 非洲 / 中东 ---------------- */
  { id: 'north_africa', name: '非洲北部', type: 'land', supply: false, star: false,
    label: [8, 26], geo: [R(-17, 18, 35, 37)], adj: ['italy', 'mediterranean', 'middle_east', 'central_africa', 'south_atlantic'] },
  { id: 'central_africa', name: '非洲中南部', type: 'land', supply: false, star: false,
    label: [22, -6], geo: [R(8, -35, 50, 18)], adj: ['north_africa', 'middle_east', 'south_atlantic', 'indian_ocean'] },
  { id: 'middle_east', name: '中东', type: 'land', supply: false, star: false,
    label: [45, 30], geo: [R(34, 12, 62, 40)], adj: ['caucasus', 'north_africa', 'central_africa', 'central_asia', 'india', 'indian_ocean'] },

  /* ---------------- 亚洲 ---------------- */
  { id: 'siberia', name: '西伯利亚', type: 'land', supply: false, star: false,
    label: [110, 62], geo: [R(60, 50, 180, 73)], adj: ['nw_russia', 'moscow', 'kazakhstan', 'mongolia', 'manchuria', 'pacific_north'] },
  { id: 'kazakhstan', name: '哈萨克', type: 'land', supply: false, star: false,
    label: [68, 48], geo: [R(48, 40, 90, 55)], adj: ['moscow', 'siberia', 'central_asia'] },
  { id: 'central_asia', name: '中亚', type: 'land', supply: false, star: false,
    label: [70, 35], geo: [R(48, 28, 90, 40)], adj: ['kazakhstan', 'middle_east', 'west_china'] },
  { id: 'mongolia', name: '蒙古', type: 'land', supply: false, star: false,
    label: [105, 46], geo: [R(88, 40, 125, 52)], adj: ['siberia', 'manchuria', 'west_china', 'east_china'] },
  { id: 'india', name: '印度', type: 'land', supply: true, star: true,
    label: [78, 20], geo: [R(66, 6, 92, 32)], adj: ['middle_east', 'west_china', 'southeast_asia', 'indian_ocean', 'bay_of_bengal'] },
  { id: 'west_china', name: '中国西部', type: 'land', supply: false, star: false,
    label: [88, 34], geo: [R(73, 25, 100, 45)], adj: ['central_asia', 'mongolia', 'east_china', 'india'] },
  { id: 'east_china', name: '中国东部', type: 'land', supply: true, star: true,
    label: [113, 32], geo: [R(100, 20, 125, 42)], adj: ['west_china', 'mongolia', 'manchuria', 'southeast_asia', 'south_china_sea'] },
  { id: 'manchuria', name: '满洲', type: 'land', supply: false, star: false,
    label: [127, 46], geo: [R(120, 40, 135, 52)], adj: ['siberia', 'mongolia', 'east_china', 'japan', 'pacific_north'] },
  { id: 'japan', name: '日本', type: 'land', home: 'japan', supply: true, star: true,
    label: [137, 37], geo: [R(128, 30, 146, 46)], adj: ['manchuria', 'pacific_north', 'pacific_central'] },
  { id: 'southeast_asia', name: '东南亚', type: 'land', supply: false, star: false,
    label: [102, 14], geo: [R(92, 0, 112, 28)], adj: ['india', 'east_china', 'indonesia', 'south_china_sea', 'bay_of_bengal'] },
  { id: 'indonesia', name: '印度尼西亚', type: 'land', supply: false, star: false,
    label: [112, -3], geo: [R(95, -10, 140, 8)], adj: ['southeast_asia', 'philippines', 'new_guinea', 'indian_ocean', 'south_china_sea', 'pacific_central'] },
  { id: 'philippines', name: '菲律宾', type: 'land', supply: false, star: false,
    label: [122, 12], geo: [R(118, 5, 128, 20)], adj: ['south_china_sea', 'pacific_central', 'indonesia'] },
  { id: 'new_guinea', name: '新几内亚', type: 'land', supply: false, star: false,
    label: [142, -5], geo: [R(130, -11, 155, 0)], adj: ['indonesia', 'australia', 'pacific_central', 'pacific_south'] },
  { id: 'australia', name: '澳大利亚', type: 'land', supply: true, star: true,
    label: [134, -25], geo: [R(112, -40, 155, -10)], adj: ['new_guinea', 'indian_ocean', 'pacific_south'] },
  { id: 'new_zealand', name: '新西兰', type: 'land', supply: false, star: false,
    label: [172, -42], geo: [R(165, -48, 180, -33)], adj: ['australia', 'pacific_south'] },
  { id: 'madagascar', name: '马达加斯加', type: 'land', supply: false, star: false,
    label: [47, -19], geo: [R(43, -26, 51, -12)], adj: ['indian_ocean'] },

  /* ---------------- 印度洋 / 太平洋 ---------------- */
  { id: 'indian_ocean', name: '印度洋', type: 'sea', label: [70, -20],
    geo: [R(40, -45, 100, 8)], adj: ['central_africa', 'middle_east', 'india', 'indonesia', 'australia', 'bay_of_bengal', 'south_china_sea'] },
  { id: 'bay_of_bengal', name: '孟加拉湾', type: 'sea', label: [88, 14],
    geo: [R(80, 5, 100, 22)], adj: ['india', 'southeast_asia', 'indian_ocean'] },
  { id: 'south_china_sea', name: '南中国海', type: 'sea', label: [113, 8],
    geo: [R(105, -5, 122, 22)], adj: ['southeast_asia', 'east_china', 'philippines', 'indonesia', 'indian_ocean'] },
  { id: 'pacific_nw', name: '太平洋西北地区', type: 'sea', label: [163, 50],
    geo: [R(142, 44, 180, 60)], adj: ['siberia', 'manchuria', 'japan', 'pacific_north', 'sea_of_japan'] },
  { id: 'pacific_north', name: '太平洋北部', type: 'sea', label: [-165, 42],
    geo: [R(140, 30, 180, 58), R(-180, 30, -125, 58)], adj: ['canada', 'us_west', 'siberia', 'manchuria', 'japan', 'pacific_central', 'pacific_nw', 'pacific_east'] },
  { id: 'pacific_central', name: '太平洋中部', type: 'sea', label: [-176, 20],
    geo: [R(140, -10, 180, 30), R(-180, -10, -100, 30)], adj: ['us_west', 'latin_america', 'japan', 'philippines', 'indonesia', 'new_guinea', 'pacific_north', 'pacific_south'] },
  { id: 'pacific_east', name: '太平洋东部', type: 'sea', label: [-102, 6],
    geo: [R(-180, -5, -95, 30)], adj: ['us_west', 'latin_america', 'pacific_north', 'pacific_central', 'pacific_se'] },
  { id: 'pacific_se', name: '太平洋东南部', type: 'sea', label: [-96, -38],
    geo: [R(-180, -50, -85, -5)], adj: ['latin_america', 'pacific_east', 'pacific_south', 'antarctic'] },
  { id: 'antarctic', name: '南极海', type: 'sea', label: [-20, -55],
    geo: [R(-180, -56, 180, -46)], adj: ['south_atlantic', 'indian_ocean', 'pacific_south', 'pacific_se'] },
  { id: 'pacific_south', name: '太平洋南部', type: 'sea', label: [-155, -20],
    geo: [R(140, -50, 180, -10), R(-180, -50, -70, -10)], adj: ['latin_america', 'new_guinea', 'australia', 'new_zealand', 'pacific_central', 'pacific_se', 'antarctic'] },
];

export const AREA_MAP = Object.fromEntries(AREAS.map(function (a) { return [a.id, a]; }));

for (const a of AREAS) {
  for (const n of a.adj) {
    const other = AREA_MAP[n];
    if (other && !other.adj.includes(a.id)) other.adj.push(a.id);
  }
}

// 海峡：control 地块上有轴心陆军 → 对轴心开放；否则对同盟开放
export const STRAITS = [
  { id: 'port_africa', name: '北非码头', a: 'mediterranean', b: 'north_sea', control: 'north_africa' },
  { id: 'port_scandi', name: '北欧码头', a: 'baltic_sea', b: 'north_sea', control: 'scandinavia' },
  { id: 'port_latin', name: '拉美码头', a: 'north_atlantic', b: 'pacific_east', control: 'latin_america' },
  { id: 'port_sea', name: '东南亚码头', a: 'south_china_sea', b: 'bay_of_bengal', control: 'southeast_asia' },
  { id: 'port_mideast', name: '中东码头', a: 'bay_of_bengal', b: 'mediterranean', control: 'middle_east' },
];

export const ROLE_ORDER = ['germany', 'italy', 'japan', 'uk', 'ussr', 'usa'];

export const NATIONS = {
  germany: { id: 'germany', name: '德国',   team: 'axis',   home: 'germany',   color: '#232323', armies: 8, fleets: 5, flag: 'DE' },
  italy:   { id: 'italy',   name: '意大利', team: 'axis',   home: 'italy',     color: '#3b86e8', armies: 5, fleets: 5, flag: 'IT' },
  japan:   { id: 'japan',   name: '日本',   team: 'axis',   home: 'japan',     color: '#7b4fa8', armies: 7, fleets: 7, flag: 'JP' },
  uk:      { id: 'uk',      name: '英国',   team: 'allies', home: 'britain',   color: '#e0b32a', armies: 7, fleets: 7, flag: 'UK' },
  ussr:    { id: 'ussr',    name: '苏联',   team: 'allies', home: 'moscow',    color: '#c0392b', armies: 9, fleets: 3, flag: 'SU' },
  usa:     { id: 'usa',     name: '美国',   team: 'allies', home: 'us_east',   color: '#3f9a5a', armies: 7, fleets: 8, flag: 'US' },
};

export function sameTeam(a, b) {
  if (!NATIONS[a] || !NATIONS[b]) return false;
  return NATIONS[a].team === NATIONS[b].team;
}