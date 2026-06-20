const state = {
  data: null,
  players: [],
  filtered: [],
  team: [],
  selectedNo: null,
  selectedTeamId: null,
  editingMode: "none",
  generationRun: 0,
  booting: true,
};

const TEAM_STORAGE_KEY = "toukenGeneratorTeamV1";

const baseColumns = [
  ["no", "No"],
  ["fullName", "氏名"],
  ["gender", "性別"],
  ["age", "年齢"],
  ["nationality", "国籍"],
  ["height", "身長"],
  ["hand", "手"],
  ["roleType", "型"],
  ["bestPosition", "適性"],
  ["rating", "適性値"],
  ["topStats", "強み"],
];

const secretColumns = [
  ["odor", "臭い"],
  ["gas", "ガス"],
  ["days", "日数"],
  ["condition", "特能"],
];

const ageThresholds = [
  0, 0.001475, 0.004875, 0.012175, 0.0268, 0.048725, 0.105825, 0.170525,
  0.239025, 0.331825, 0.4195, 0.49685, 0.583625, 0.665575, 0.7379,
  0.800775, 0.8532, 0.89515, 0.9292, 0.9554, 0.973775, 0.9869, 0.99475,
  0.99875, 1,
];

const roleLabels = {
  1: "CG",
  2: "右SG",
  3: "左SG",
  4: "PM",
  5: "右WG",
  6: "左WG",
  7: "ST",
  10: "Free CT",
  11: "Libero",
  12: "右WB",
  13: "左WB",
  14: "Anchor",
  15: "右IW",
  16: "左IW",
  17: "Shadow",
  20: "万能",
};

const sidePositionPairs = [
  { right: "2", left: "3" },
  { right: "5", left: "6" },
  { right: "12", left: "13" },
  { right: "15", left: "16" },
];

const positionNeighbors = {
  1: ["11", "2", "3", "14", "4"],
  2: ["12", "1", "11", "3", "5"],
  3: ["13", "1", "11", "2", "6"],
  4: ["10", "14", "11", "12", "13", "15", "16"],
  5: ["15", "7", "17", "2", "12", "6"],
  6: ["16", "7", "17", "3", "13", "5"],
  7: ["17", "5", "6", "15", "16", "10"],
  10: ["4", "14", "17", "11", "15", "16"],
  11: ["1", "14", "4", "2", "3", "10"],
  12: ["2", "13", "4", "14", "5", "15"],
  13: ["3", "12", "4", "14", "6", "16"],
  14: ["4", "10", "11", "12", "13", "1"],
  15: ["5", "16", "17", "10", "4", "12"],
  16: ["6", "15", "17", "10", "4", "13"],
  17: ["7", "10", "15", "16", "5", "6"],
  20: ["10", "14", "17", "4", "11", "1"],
};

const familiarityLevels = [
  { label: "熟達", min: 0.9, max: 0.98 },
  { label: "達者", min: 0.78, max: 0.9 },
  { label: "能力あり", min: 0.62, max: 0.78 },
  { label: "不安あり", min: 0.46, max: 0.62 },
  { label: "不慣れ", min: 0.32, max: 0.46 },
  { label: "急造", min: 0.2, max: 0.32 },
  { label: "能力不足", min: 0.1, max: 0.2 },
];

const legacyFamiliarityLabels = {
  主級: "熟達",
  副A: "達者",
  副B: "能力あり",
  副C: "不安あり",
  副D: "不慣れ",
  薄: "急造",
  未習熟: "能力不足",
};

const optionPositionPairs = [
  ["1", "11"],
  ["4", "10"],
  ["4", "14"],
  ["5", "15"],
  ["6", "16"],
  ["7", "17"],
];

const formations = {
  f313: {
    label: "3-1-3",
    trait: "攻守均等 / 初期配置向き",
    op: ["11", "14", "10", "15", "16", "17"],
    slots: [
      { key: "back_right", label: "後方右", allowed: ["2"] },
      { key: "back_center", label: "後方中央", allowed: ["1", "11"] },
      { key: "back_left", label: "後方左", allowed: ["3"] },
      { key: "midfield_center", label: "中盤中央", allowed: ["4", "10", "14"] },
      { key: "front_right", label: "前方右", allowed: ["5"] },
      { key: "front_left", label: "前方左", allowed: ["6"] },
      { key: "front_center", label: "前方中央", allowed: ["7", "17"] },
    ],
  },
  f223: {
    label: "2-2-3",
    trait: "中盤増強 / 攻撃志向",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_center_right", label: "後方中央右", allowed: ["1", "11"] },
      { key: "back_center_left", label: "後方中央左", allowed: ["1", "11"] },
      { key: "midfield_right", label: "中盤右", allowed: ["4", "10", "14"] },
      { key: "midfield_left", label: "中盤左", allowed: ["4", "10", "14"] },
      { key: "front_right", label: "前方右", allowed: ["5"] },
      { key: "front_left", label: "前方左", allowed: ["6"] },
      { key: "front_center", label: "前方中央", allowed: ["7", "17"] },
    ],
  },
  f232: {
    label: "2-3-2",
    trait: "中盤圧殺 / 中央制圧",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_center_right", label: "後方中央右", allowed: ["1", "11"] },
      { key: "back_center_left", label: "後方中央左", allowed: ["1", "11"] },
      { key: "midfield_right", label: "中盤右", allowed: ["12"] },
      { key: "midfield_center", label: "中盤中央", allowed: ["4", "10", "14"] },
      { key: "midfield_left", label: "中盤左", allowed: ["13"] },
      { key: "front_right", label: "前方右", allowed: ["7", "17", "5", "6"] },
      { key: "front_left", label: "前方左", allowed: ["7", "17", "5", "6"] },
    ],
  },
  f331: {
    label: "3-3-1",
    trait: "中盤厚型 / 守備安定",
    op: ["11", "14", "10"],
    slots: [
      { key: "back_right", label: "後方右", allowed: ["2"] },
      { key: "back_center", label: "後方中央", allowed: ["1", "11"] },
      { key: "back_left", label: "後方左", allowed: ["3"] },
      { key: "midfield_right", label: "中盤右", allowed: ["12"] },
      { key: "midfield_center", label: "中盤中央", allowed: ["4", "10", "14"] },
      { key: "midfield_left", label: "中盤左", allowed: ["13"] },
      { key: "front_center", label: "前方中央", allowed: ["7"] },
    ],
  },
  f241: {
    label: "2-4-1",
    trait: "中盤過密 / 支配重視",
    op: ["11", "14", "10"],
    slots: [
      { key: "back_center_right", label: "後方中央右", allowed: ["1", "11"] },
      { key: "back_center_left", label: "後方中央左", allowed: ["1", "11"] },
      { key: "midfield_wide_right", label: "中盤ワイド右", allowed: ["12"] },
      { key: "midfield_center_right", label: "中盤中央右", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_center_left", label: "中盤中央左", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_wide_left", label: "中盤ワイド左", allowed: ["13"] },
      { key: "front_center", label: "前方中央", allowed: ["7"] },
    ],
  },
  f322: {
    label: "3-2-2",
    trait: "均衡厚型 / 調整しやすい",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_right", label: "後方右", allowed: ["2"] },
      { key: "back_center", label: "後方中央", allowed: ["1", "11"] },
      { key: "back_left", label: "後方左", allowed: ["3"] },
      { key: "midfield_right", label: "中盤右", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_left", label: "中盤左", allowed: ["4", "15", "16", "10", "14"] },
      { key: "front_right", label: "前方右", allowed: ["7", "17", "5", "6"] },
      { key: "front_left", label: "前方左", allowed: ["7", "17", "5", "6"] },
    ],
  },
  f421: {
    label: "4-2-1",
    trait: "堅守速攻 / 守備重視",
    op: ["11", "14", "10"],
    slots: [
      { key: "back_wide_right", label: "後方ワイド右", allowed: ["2"] },
      { key: "back_center_right", label: "後方中央右", allowed: ["1", "11"] },
      { key: "back_center_left", label: "後方中央左", allowed: ["1", "11"] },
      { key: "back_wide_left", label: "後方ワイド左", allowed: ["3"] },
      { key: "midfield_right", label: "中盤右", allowed: ["4", "15", "16", "10", "14"] },
      { key: "midfield_left", label: "中盤左", allowed: ["4", "15", "16", "10", "14"] },
      { key: "front_center", label: "前方中央", allowed: ["7"] },
    ],
  },
  f412: {
    label: "4-1-2",
    trait: "堅守2トップ / カウンター",
    op: ["11", "14", "10", "17"],
    slots: [
      { key: "back_wide_right", label: "後方ワイド右", allowed: ["2"] },
      { key: "back_center_right", label: "後方中央右", allowed: ["1", "11"] },
      { key: "back_center_left", label: "後方中央左", allowed: ["1", "11"] },
      { key: "back_wide_left", label: "後方ワイド左", allowed: ["3"] },
      { key: "midfield_center", label: "中盤中央", allowed: ["4", "10", "14"] },
      { key: "front_right", label: "前方右", allowed: ["7", "17", "5", "6"] },
      { key: "front_left", label: "前方左", allowed: ["7", "17", "5", "6"] },
    ],
  },
};

const teamStrengthProfiles = {
  weak: { label: "弱小", center: 48, defaultStars: 0 },
  lower: { label: "下位", center: 55, defaultStars: 0 },
  middle: { label: "中堅", center: 63, defaultStars: 1 },
  upper: { label: "上位", center: 70, defaultStars: 1 },
  strong: { label: "強豪", center: 77, defaultStars: 1 },
  contender: { label: "優勝候補", center: 84, defaultStars: 2 },
  world: { label: "世界トップ", center: 89, defaultStars: 3 },
};

const teamVarianceProfiles = {
  tight: { label: "小", range: 4, spread: 0.72 },
  standard: { label: "標準", range: 7, spread: 1 },
  wide: { label: "大", range: 11, spread: 1.24 },
};

const teamDepthProfiles = {
  thin: { label: "薄い", rotation: -1.5, bench: -4, prospect: -3 },
  standard: { label: "標準", rotation: 0, bench: 0, prospect: 0 },
  deep: { label: "厚い", rotation: 2, bench: 4, prospect: 3 },
};

const teamTierOffsets = {
  star: 5,
  starter: 3,
  rotation: -5,
  bench: -13,
  prospect: -20,
};

const teamTargetBands = {
  world: {
    star: [90, 91.4],
    starter: [83, 89],
    rotation: [78, 84],
    bench: [70, 78],
    prospect: [62, 72],
  },
  contender: {
    star: [87, 89],
    starter: [81, 87],
    rotation: [76, 82],
    bench: [68, 76],
    prospect: [60, 70],
  },
  strong: {
    star: [83, 86],
    starter: [76, 82],
    rotation: [71, 77],
    bench: [63, 71],
    prospect: [56, 66],
  },
};

const teamHighStatLimits = {
  star: 8,
  starter: 5,
  rotation: 3,
  bench: 2,
  prospect: 1,
};

const teamStatHardCaps = {
  star: 30,
  starter: 29,
  rotation: 28,
  bench: 27,
  prospect: 26,
};

const ratingScaleTuning = {
  eliteCurveStart: 88,
  eliteCurveGain: 7,
  eliteCurveWidth: 6,
  hardMax: 94.8,
};

const teamTierLabels = {
  star: "エース級",
  starter: "主力級",
  rotation: "ローテ級",
  bench: "控え級",
  prospect: "育成枠",
};

const homegrownSettings = {
  domesticShare: 0.8,
  reductions: { star: 17, starter: 14, rotation: 9, bench: 5, prospect: 1 },
  caps: { star: 72, starter: 68, rotation: 62, bench: 56, prospect: 52 },
};

const rareNationalityWeight = 0.1;

const teamStyleRoleTemplates = {
  balanced: ["1", "2", "3", "4", "5", "6", "7", "10", "11", "12", "13", "14", "15", "16", "17"],
  defense: ["1", "2", "3", "11", "14", "12", "13", "4", "7", "5", "6", "10", "17", "15", "16"],
  midfield: ["4", "10", "14", "12", "13", "15", "16", "1", "11", "5", "6", "7", "2", "3", "17"],
  attack: ["7", "5", "6", "17", "15", "16", "10", "4", "12", "13", "1", "2", "3", "11", "14"],
  counter: ["1", "2", "3", "14", "7", "17", "5", "6", "11", "12", "13", "4", "15", "16", "10"],
};

const leagueNationalityWeights = {
  全世界: [
    ["アメリカ", 13], ["ドイツ", 10], ["日本", 9], ["イギリス", 8], ["中国", 7], ["フランス", 6],
    ["イタリア", 5], ["ロシア", 5], ["ブラジル", 4], ["インド", 4], ["カナダ", 3], ["オーストラリア", 3],
    ["メキシコ", 3], ["スペイン", 3], ["韓国", 3], ["トルコ", 2], ["インドネシア", 2], ["オランダ", 2],
    ["スイス", 1.5], ["アイルランド", 1], ["ベルギー", 1], ["スウェーデン", 1], ["アルゼンチン", 1],
  ],
  日本: [
    ["日本", 42], ["韓国", 6], ["アメリカ", 5], ["フランス", 4], ["イギリス", 3.5], ["中国", 3],
    ["オーストラリア", 2.5], ["ドイツ", 2.3], ["イタリア", 2], ["インドネシア", 2], ["台湾", 1.8],
    ["インド", 1.8], ["ブラジル", 1.6], ["カナダ", 1.5], ["スペイン", 1.4], ["フィリピン", 1.2],
    ["マレーシア", 1.2], ["タイ", 1.2], ["オランダ", 1], ["ロシア", 1], ["メキシコ", 1],
    ["アルゼンチン", 1], ["サウジアラビア", 1], ["香港", 1], ["ポーランド", 0.8], ["ベルギー", 0.8],
    ["アイルランド", 0.8], ["スウェーデン", 0.6], ["イスラエル", 0.6], ["バングラデシュ", 0.6],
  ],
  ドイツ: [
    ["ドイツ", 30], ["アメリカ", 6.5], ["日本", 6], ["イギリス", 6], ["フランス", 4], ["イタリア", 3],
    ["スペイン", 2.8], ["オランダ", 2.6], ["スイス", 2.4], ["ブラジル", 2.2], ["カナダ", 2.1],
    ["中国", 2], ["ロシア", 2], ["インド", 2], ["トルコ", 2], ["オーストリア", 1.7], ["メキシコ", 1.5],
    ["ポーランド", 1.5], ["ベルギー", 1.3], ["韓国", 1.1], ["オーストラリア", 1.1], ["スウェーデン", 0.9],
    ["イスラエル", 0.9], ["インドネシア", 0.8], ["台湾", 0.8], ["ノルウェー", 0.8], ["コロンビア", 0.7],
    ["アルゼンチン", 0.7], ["アイルランド", 0.6], ["ルーマニア", 0.6], ["フィンランド", 0.6],
    ["ポルトガル", 0.6], ["ハンガリー", 0.6],
  ],
  アメリカ: [
    ["アメリカ", 55], ["カナダ", 6], ["メキシコ", 5], ["ブラジル", 4], ["日本", 3], ["ドイツ", 3],
    ["イギリス", 2.8], ["フランス", 2.4], ["韓国", 2], ["中国", 2], ["オーストラリア", 1.8],
    ["スペイン", 1.6], ["イタリア", 1.5], ["アルゼンチン", 1.4], ["コロンビア", 1.2], ["インド", 1.1],
    ["アイルランド", 0.9], ["オランダ", 0.8], ["スウェーデン", 0.7], ["イスラエル", 0.7],
  ],
  イギリス: [
    ["イギリス", 32], ["アイルランド", 6], ["アメリカ", 5], ["フランス", 4.5], ["ドイツ", 4], ["オランダ", 3.5],
    ["スペイン", 3.2], ["イタリア", 3], ["カナダ", 2.8], ["オーストラリア", 2.6], ["スウェーデン", 2.2],
    ["ベルギー", 2], ["ブラジル", 1.8], ["日本", 1.8], ["韓国", 1.5], ["中国", 1.5], ["インド", 1.4],
    ["ポルトガル", 1.3], ["メキシコ", 1.2], ["アルゼンチン", 1.1], ["南アフリカ", 1],
  ],
  フランス: [
    ["フランス", 38], ["ベルギー", 6], ["スイス", 4.5], ["イタリア", 4], ["スペイン", 3.5], ["ドイツ", 3],
    ["イギリス", 2.8], ["オランダ", 2.5], ["ポルトガル", 2.4], ["アメリカ", 2.2], ["ブラジル", 2],
    ["カナダ", 1.8], ["日本", 1.6], ["韓国", 1.4], ["中国", 1.2], ["エジプト", 1.1], ["南アフリカ", 1],
    ["ケニア", 0.9], ["エチオピア", 0.8], ["コンゴ民主", 0.8],
  ],
  スペイン: [
    ["スペイン", 31], ["メキシコ", 10], ["ブラジル", 8], ["アルゼンチン", 7], ["ポルトガル", 5], ["フランス", 4],
    ["イタリア", 3.5], ["ドイツ", 3], ["イギリス", 2.5], ["アメリカ", 2.5], ["オランダ", 2], ["ベルギー", 1.8],
    ["コロンビア", 1.6], ["日本", 1.4], ["韓国", 1.2], ["中国", 1], ["カナダ", 1], ["トルコ", 0.9],
  ],
  イタリア: [
    ["イタリア", 52], ["フランス", 4], ["ドイツ", 3.5], ["スペイン", 3.2], ["スイス", 3], ["オーストリア", 2.6],
    ["ブラジル", 2.5], ["アルゼンチン", 2.2], ["オランダ", 2], ["ベルギー", 1.8], ["イギリス", 1.6],
    ["アメリカ", 1.5], ["日本", 1.3], ["韓国", 1.1], ["中国", 1], ["ポルトガル", 1], ["トルコ", 0.9],
  ],
  韓国: [
    ["韓国", 39], ["日本", 9], ["中国", 5], ["アメリカ", 4.5], ["ドイツ", 3], ["オーストラリア", 3],
    ["インドネシア", 2.6], ["タイ", 2.2], ["フィリピン", 1.8], ["マレーシア", 1.8], ["インド", 1.6],
    ["カナダ", 1.5], ["イギリス", 1.3], ["フランス", 1.3], ["ブラジル", 1.2], ["スペイン", 1.1],
    ["イタリア", 1.1], ["ロシア", 1],
  ],
  中国: [
    ["中国", 76], ["インド", 7], ["ロシア", 2.5], ["韓国", 2], ["日本", 1.8], ["ミャンマー", 1.2],
    ["バングラデシュ", 1], ["パキスタン", 1], ["インドネシア", 0.9], ["タイ", 0.8], ["フィリピン", 0.7],
    ["マレーシア", 0.7], ["アメリカ", 0.6], ["ドイツ", 0.5],
  ],
  ロシア: [
    ["ロシア", 86], ["中国", 2], ["ドイツ", 1.5], ["韓国", 1.2], ["トルコ", 1.2], ["イラン", 1],
    ["日本", 0.8], ["インド", 0.8], ["アメリカ", 0.7], ["フランス", 0.7], ["イタリア", 0.6], ["スペイン", 0.6],
  ],
  カナダ: [
    ["カナダ", 52], ["アメリカ", 14], ["イギリス", 5], ["フランス", 5], ["ドイツ", 3], ["中国", 3],
    ["インド", 3], ["メキシコ", 2], ["日本", 2], ["韓国", 1.5], ["ブラジル", 1.5], ["アイルランド", 1.2],
    ["オーストラリア", 1], ["オランダ", 0.8],
  ],
  インド: [
    ["インド", 66], ["バングラデシュ", 5], ["パキスタン", 5], ["中国", 4], ["イギリス", 3], ["アメリカ", 3],
    ["日本", 2], ["韓国", 1.5], ["カナダ", 1.5], ["オーストラリア", 1.4], ["タイ", 1], ["ミャンマー", 1],
    ["マレーシア", 0.9], ["フィリピン", 0.8], ["ドイツ", 0.8],
  ],
};

const categoryRules = [
  { name: "physical", stats: ["スピード", "加速", "ジャンプ", "スタミナ", "アジリティ", "バランス", "運動量", "勇敢さ"] },
  { name: "technical", stats: ["テクニック", "ショット", "パス", "シュート", "ロングシュート", "キャリー", "クロス", "ファーストタッチ", "スラッシュ", "剣さばき"] },
  { name: "mental", stats: ["ポジショニング", "チームワーク", "リーダーシップ", "ひらめき", "視野", "集中力", "勝利意欲", "積極性", "予測力", "判断力", "冷静さ"] },
  { name: "defense", stats: ["マーキング", "剣さばき", "ポジショニング", "予測力", "判断力"] },
  { name: "attack", stats: ["ショット", "シュート", "ロングシュート", "キャリー", "クロス", "スラッシュ", "ひらめき"] },
];

const statGenerationTuning = {
  talentMean: 19.6,
  talentSd: 3.3,
  talentMin: 11,
  talentMax: 27.5,
  factorSds: {
    physical: 1.7,
    technical: 1.7,
    mental: 1.5,
    defense: 1.4,
    attack: 1.4,
    general: 1.0,
  },
  roleScale: 5.9,
  roleOffset: -1.7,
  lowRoleCutoff: 0.18,
  lowRolePenalty: -1.9,
  noiseSd: 1.2,
  eliteSoftCapStart: 26.5,
  eliteSoftCapStrength: 0.68,
};

const $ = (id) => document.getElementById(id);

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, rng) {
  if (!items.length) return "";
  return items[Math.floor(rng() * items.length)];
}

function hasNameData(data, nationality, gender) {
  return Boolean(namePoolForGender(data, nationality, gender) || data.namesByKey?.[`${nationality}|${gender}`]);
}

function supportedNationalitiesForGender(data, gender) {
  const countries = new Set(Object.keys(data.namePoolsByCountry || {}));
  Object.keys(data.namesByKey || {}).forEach((key) => {
    const [nationality, keyGender] = key.split("|");
    if (nationality && keyGender === gender) countries.add(nationality);
  });
  return [...countries].filter((nationality) => hasNameData(data, nationality, gender));
}

function weightedPick(entries, rng) {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  if (total <= 0) return entries[0]?.[0] || "";
  let roll = rng() * total;
  for (const [nationality, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return nationality;
  }
  return entries.at(-1)?.[0] || "";
}

function nationalityEntriesForGroup(data, groupName, gender) {
  const weighted = leagueNationalityWeights[groupName] || [];
  const weightedEntries = weighted.filter(([nationality, weight]) => weight > 0 && hasNameData(data, nationality, gender));
  if (weightedEntries.length) {
    const included = new Set(weightedEntries.map(([nationality]) => nationality));
    const rareEntries = supportedNationalitiesForGender(data, gender)
      .filter((nationality) => !included.has(nationality))
      .map((nationality) => [nationality, rareNationalityWeight]);
    return [...weightedEntries, ...rareEntries];
  }

  const nationalities = data.nationalityGroups[groupName] || data.nationalityGroups["全世界"] || [];
  const fallbackEntries = [...new Set(nationalities)]
    .filter((nationality) => hasNameData(data, nationality, gender))
    .map((nationality) => [nationality, 1]);
  if (fallbackEntries.length) return fallbackEntries;
  return supportedNationalitiesForGender(data, gender).map((nationality) => [nationality, rareNationalityWeight]);
}

function pickLeagueNationality(data, groupName, gender, rng) {
  const entries = nationalityEntriesForGroup(data, groupName, gender);
  return weightedPick(entries, rng) || "日本";
}

function countAvailableNationalities(data, groupName) {
  const names = new Set([
    ...nationalityEntriesForGroup(data, groupName, "男").map(([nationality]) => nationality),
    ...nationalityEntriesForGroup(data, groupName, "女").map(([nationality]) => nationality),
  ]);
  return names.size;
}

function namePoolForGender(data, nationality, gender) {
  const pool = data.namePoolsByCountry?.[nationality];
  if (!pool?.surnames?.length) return null;
  const givenKey = gender === "女" ? "femaleGivenNames" : "maleGivenNames";
  const givenNames = pool[givenKey] || [];
  if (!givenNames.length) return null;
  return { ...pool, givenNames };
}

function entryName(entry, gender) {
  if (!entry) return "";
  return gender === "女" && entry.alternativeForm ? entry.alternativeForm : entry.name;
}

function entriesForSubgroup(entries, subgroup) {
  const exact = entries.filter((entry) => entry.subgroup && entry.subgroup === subgroup);
  return exact.length ? exact : entries;
}

function chooseNameSubgroup(pool, rng) {
  const surnameSubgroups = new Set(pool.surnames.map((entry) => entry.subgroup).filter(Boolean));
  const matching = [...new Set(pool.givenNames.map((entry) => entry.subgroup).filter((subgroup) => surnameSubgroups.has(subgroup)))];
  return pick(matching, rng) || pick([...surnameSubgroups], rng) || "";
}

function formatNameParts(nationality, surname, givenName, order, subgroup, rng, pool) {
  if (order === "single-personal-name") {
    return {
      surname: "",
      givenName,
      fullName: givenName || surname,
    };
  }

  if (order === "given-surname-postname") {
    const postnameEntry = pick(pool.surnames.filter((entry) => entry.name !== surname), rng) || null;
    const postname = entryName(postnameEntry, "男");
    const combinedSurname = [surname, postname].filter(Boolean).join(" ");
    return {
      surname: combinedSurname,
      givenName,
      fullName: [givenName, combinedSurname].filter(Boolean).join(" "),
    };
  }

  if (order === "family-first" || (order === "subgroup-dependent" && subgroup === "Chinese Malaysian")) {
    return {
      surname,
      givenName,
      fullName: [surname, givenName].filter(Boolean).join(" "),
    };
  }

  return {
    surname,
    givenName,
    fullName: [givenName, surname].filter(Boolean).join(" "),
  };
}

function buildName(data, nationality, gender, rng) {
  const pool = namePoolForGender(data, nationality, gender);
  if (pool) {
    const subgroup = chooseNameSubgroup(pool, rng);
    const surnameEntry = pick(entriesForSubgroup(pool.surnames, subgroup), rng);
    const givenEntry = pick(entriesForSubgroup(pool.givenNames, subgroup), rng);
    const surname = entryName(surnameEntry, gender);
    const givenName = entryName(givenEntry, gender);
    return {
      ...formatNameParts(nationality, surname, givenName, pool.nameOrder, subgroup, rng, pool),
      nameOrder: pool.nameOrder,
      nameSubgroup: subgroup,
      surnameNote: pool.surnameNote || "",
    };
  }

  const nameData = data.namesByKey[`${nationality}|${gender}`] || data.namesByKey[`日本|${gender}`] || {
    surnames: ["無名"],
    givenNames: ["選手"],
  };
  const surname = pick(nameData.surnames, rng);
  const givenName = pick(nameData.givenNames, rng);
  return {
    surname,
    givenName,
    fullName: [surname, givenName].filter(Boolean).join(" "),
    nameOrder: "family-first",
    nameSubgroup: "",
    surnameNote: "",
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalRandom(mean, sd, rng) {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = Math.max(rng(), Number.EPSILON);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

function boundedNormal(mean, sd, min, max, rng) {
  return clamp(Math.round(normalRandom(mean, sd, rng)), min, max);
}

function softenEliteStat(value) {
  if (value <= statGenerationTuning.eliteSoftCapStart) return value;
  return (
    statGenerationTuning.eliteSoftCapStart +
    (value - statGenerationTuning.eliteSoftCapStart) * statGenerationTuning.eliteSoftCapStrength
  );
}

function fifaOverallRating(rawRating) {
  const value = Number(rawRating) || 0;
  if (value <= ratingScaleTuning.eliteCurveStart) return value;
  const over = value - ratingScaleTuning.eliteCurveStart;
  const curved =
    ratingScaleTuning.eliteCurveStart +
    (1 - Math.exp(-over / ratingScaleTuning.eliteCurveWidth)) * ratingScaleTuning.eliteCurveGain;
  return clamp(curved, 1, ratingScaleTuning.hardMax);
}

function generateAge(rng) {
  const roll = rng();
  const index = ageThresholds.findIndex((threshold, i) => roll >= threshold && roll < ageThresholds[i + 1]);
  return 16 + Math.max(0, index);
}

function generateTargetAge(ageBand, rng) {
  if (ageBand === "young") return boundedNormal(19, 2, 16, 21, rng);
  if (ageBand === "prime") return boundedNormal(25, 3, 22, 29, rng);
  if (ageBand === "veteran") return boundedNormal(33, 3, 30, 38, rng);
  return generateAge(rng);
}

function categoryForStat(statName) {
  const matches = categoryRules.filter((rule) => rule.stats.includes(statName)).map((rule) => rule.name);
  return matches.length ? matches : ["general"];
}

function ageCurve(age, categories) {
  let value = 0;
  if (age <= 18) value -= 2.4;
  else if (age <= 21) value -= 1.2;
  else if (age <= 27) value += 1.0;
  else if (age <= 31) value += 0.6;
  else if (age <= 35) value -= 0.8;
  else value -= 2.0;

  if (categories.includes("mental") && age >= 27) value += 1.4;
  if (categories.includes("mental") && age <= 20) value -= 0.8;
  if (categories.includes("physical") && age >= 31) value -= 1.8;
  if (categories.includes("physical") && age <= 20) value += 0.5;
  return value;
}

function heightEffect(statName, height, gender) {
  const baseline = gender === "男" ? 172 : 159;
  const delta = (height - baseline) / 7;
  if (["ジャンプ", "バランス", "勇敢さ"].includes(statName)) return clamp(delta, -1.4, 1.8);
  if (["加速", "アジリティ"].includes(statName)) return clamp(-delta * 0.45, -1.2, 1.0);
  return 0;
}

function chooseRole(data, rng) {
  const codes = data.positionCodes;
  return pick(codes.filter((code) => code !== "20"), rng);
}

function importanceFor(roleWeights, index) {
  const maxWeight = Math.max(...roleWeights, 0.01);
  return (roleWeights[index] || 0) / maxWeight;
}

function generateStats(data, roleCode, age, height, gender, rng, target = {}) {
  const roleWeights = data.positionWeights[roleCode] || data.positionWeights[data.positionCodes[0]];
  const strengthTalent = { prospect: -1.2, normal: 0, strong: 2.2, elite: 4.0 }[target.strength || "normal"] || 0;
  const talentShift = Number(target.talentShift || 0);
  const talentSpreadScale = Number(target.talentSpreadScale || 1);
  const factorSpreadScale = Number(target.factorSpreadScale || 1);
  const statNoiseScale = Number(target.statNoiseScale || 1);
  const talentMax = target.talentMax ?? (target.strength === "elite" ? 29 : statGenerationTuning.talentMax);
  const talent = clamp(
    normalRandom(statGenerationTuning.talentMean + strengthTalent + talentShift, statGenerationTuning.talentSd * talentSpreadScale, rng),
    statGenerationTuning.talentMin,
    talentMax,
  );
  const archetype = target.archetype || "";
  const archetypeBoosts = {
    physical: { physical: 2.1 },
    technical: { technical: 2.1 },
    mental: { mental: 2.0 },
    attack: { attack: 2.0, technical: 0.8 },
    defense: { defense: 2.0, mental: 0.7 },
    balanced: { physical: 0.6, technical: 0.6, mental: 0.6, attack: 0.4, defense: 0.4 },
  }[archetype] || {};
  const factors = {
    physical: normalRandom(archetypeBoosts.physical || 0, statGenerationTuning.factorSds.physical * factorSpreadScale, rng),
    technical: normalRandom(archetypeBoosts.technical || 0, statGenerationTuning.factorSds.technical * factorSpreadScale, rng),
    mental: normalRandom(archetypeBoosts.mental || 0, statGenerationTuning.factorSds.mental * factorSpreadScale, rng),
    defense: normalRandom(archetypeBoosts.defense || 0, statGenerationTuning.factorSds.defense * factorSpreadScale, rng),
    attack: normalRandom(archetypeBoosts.attack || 0, statGenerationTuning.factorSds.attack * factorSpreadScale, rng),
    general: normalRandom(0, statGenerationTuning.factorSds.general * factorSpreadScale, rng),
  };

  const stats = data.statNames.map((statName, index) => {
    const categories = categoryForStat(statName);
    const categoryBoost = categories.reduce((sum, category) => sum + (factors[category] || 0), 0) / categories.length;
    const importance = importanceFor(roleWeights, index);
    const roleBoost = importance * statGenerationTuning.roleScale + statGenerationTuning.roleOffset;
    const lowRolePenalty = importance < statGenerationTuning.lowRoleCutoff ? statGenerationTuning.lowRolePenalty : 0;
    const value = softenEliteStat(
      talent +
        categoryBoost +
        roleBoost +
        lowRolePenalty +
        ageCurve(age, categories) +
        heightEffect(statName, height, gender) +
        normalRandom(0, statGenerationTuning.noiseSd * statNoiseScale, rng),
    );
    return clamp(Math.min(Math.round(value), Number(target.statHardCap) || 30), 1, 30);
  });
  const highStatLimit = target.highStatLimit;
  if (Number.isFinite(highStatLimit)) {
    const highIndexes = stats
      .map((value, index) => ({ value, index }))
      .filter((item) => item.value >= 27)
      .sort((a, b) => b.value - a.value);
    highIndexes.slice(highStatLimit).forEach(({ index }) => {
      stats[index] = Math.min(stats[index], 26);
    });
  }
  return stats;
}

function sameSidePenaltyCode(hand, code) {
  if (hand === "両") return false;
  return sidePositionPairs.some((pair) => (hand === "右" ? pair.right === code : pair.left === code));
}

function computePositions(stats, data, hand, sidePenaltyRate) {
  const result = data.positionCodes.map((code) => {
    const weights = data.positionWeights[code];
    const weightedTotal = stats.reduce((sum, value, i) => sum + value * (weights[i] || 0), 0);
    const weightTotal = weights.reduce((sum, value) => sum + (value || 0), 0) || 1;
    const rawBaseRating = (weightedTotal / weightTotal / 30) * 100;
    const baseRating = fifaOverallRating(rawBaseRating);
    const penalty = sameSidePenaltyCode(hand, code) ? sidePenaltyRate : 0;
    const rating = baseRating * (1 - penalty);
    return { code, rating, baseRating, rawBaseRating, penalty };
  });
  result.sort((a, b) => b.rating - a.rating);
  return result;
}

function uniqueCodes(codes, data) {
  return [...new Set(codes.map(String))].filter((code) => data.positionCodes.includes(code));
}

function nearbyCodes(primaryCode, data) {
  const direct = positionNeighbors[primaryCode] || [];
  const secondRing = direct.flatMap((code) => positionNeighbors[code] || []);
  const pairMate = sidePositionPairs
    .flatMap((pair) => (pair.right === primaryCode ? [pair.left] : pair.left === primaryCode ? [pair.right] : []));
  return uniqueCodes([...direct, ...pairMate, ...secondRing], data).filter((code) => code !== primaryCode);
}

function sameSideAdjusted(value, hand, code, sidePenaltyRate) {
  return sameSidePenaltyCode(hand, code) ? value * (1 - sidePenaltyRate) : value;
}

function optionCodesFor(primaryCode, data) {
  return uniqueCodes(
    optionPositionPairs.flatMap(([base, option]) => {
      if (base === primaryCode) return [option];
      if (option === primaryCode) return [base];
      return [];
    }),
    data,
  );
}

function positionRelation(primaryCode, code) {
  if (optionPositionPairs.some(([base, option]) => (base === primaryCode && option === code) || (option === primaryCode && base === code))) {
    return "option";
  }
  if (sidePositionPairs.some((pair) => (pair.right === primaryCode && pair.left === code) || (pair.left === primaryCode && pair.right === code))) {
    return "sideMate";
  }
  const direct = positionNeighbors[primaryCode] || [];
  if (direct.includes(code)) return "direct";
  const secondRing = direct.flatMap((neighbor) => positionNeighbors[neighbor] || []);
  if (secondRing.includes(code)) return "secondRing";
  return "remote";
}

function weightedFamiliarity(options, rng) {
  const totalWeight = options.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * totalWeight;
  const found = options.find((item) => {
    roll -= item.weight;
    return roll <= 0;
  });
  return familiarityLevels.find((level) => level.label === (found || options[options.length - 1]).label) || familiarityLevels.at(-1);
}

function randomFamiliarityLevel(relation, rng) {
  const optionsByRelation = {
    option: [
      { label: "熟達", weight: 1.2 },
      { label: "達者", weight: 2.6 },
      { label: "能力あり", weight: 3.4 },
    ],
    direct: [
      { label: "熟達", weight: 0.5 },
      { label: "達者", weight: 1.7 },
      { label: "能力あり", weight: 3.2 },
      { label: "不安あり", weight: 2.2 },
      { label: "不慣れ", weight: 1.0 },
    ],
    sideMate: [
      { label: "達者", weight: 0.8 },
      { label: "能力あり", weight: 2.4 },
      { label: "不安あり", weight: 2.8 },
      { label: "不慣れ", weight: 1.4 },
    ],
    secondRing: [
      { label: "能力あり", weight: 1.0 },
      { label: "不安あり", weight: 2.4 },
      { label: "不慣れ", weight: 2.4 },
      { label: "急造", weight: 1.0 },
    ],
    remote: [
      { label: "不安あり", weight: 0.4 },
      { label: "不慣れ", weight: 2.2 },
      { label: "急造", weight: 3.0 },
      { label: "能力不足", weight: 2.4 },
    ],
  };
  return weightedFamiliarity(optionsByRelation[relation] || optionsByRelation.remote, rng);
}

function createPositionAptitudes(primaryCode, positionScores, data, hand, sidePenaltyRate, rng) {
  const fitScores = Object.fromEntries(positionScores.map((item) => [item.code, item.rating]));
  const primaryRating = fitScores[primaryCode] || 0;
  const aptitudes = Object.fromEntries(data.positionCodes.map((code) => [code, Number(((fitScores[code] || 0) * 0.14).toFixed(2))]));
  const labels = Object.fromEntries(data.positionCodes.map((code) => [code, "能力不足"]));
  const multipliers = Object.fromEntries(data.positionCodes.map((code) => [code, 0.14]));
  aptitudes[primaryCode] = Number(primaryRating.toFixed(2));
  labels[primaryCode] = "主";
  multipliers[primaryCode] = 1;

  const guaranteedOptions = optionCodesFor(primaryCode, data);
  const relationWeight = { option: 6, direct: 3.2, sideMate: 2.2, secondRing: 1.25, remote: 0.08 };
  const candidatePool = data.positionCodes
    .filter((code) => code !== primaryCode && !guaranteedOptions.includes(code))
    .map((code) => {
      const relation = positionRelation(primaryCode, code);
      return { code, relation, weight: relationWeight[relation] || 0.08 };
    });
  const naturalCount = rng() < 0.15 ? 0 : clamp(Math.round(normalRandom(2.0, 1.25, rng)), 1, 5);
  const targetCount = clamp(guaranteedOptions.length + naturalCount, guaranteedOptions.length, Math.min(7, candidatePool.length + guaranteedOptions.length));

  const selected = guaranteedOptions.map((code) => ({ code, relation: "option", guaranteed: true }));
  while (selected.length < targetCount && candidatePool.length) {
    const totalWeight = candidatePool.reduce((sum, item) => sum + item.weight, 0);
    let roll = rng() * totalWeight;
    const index = candidatePool.findIndex((item) => {
      roll -= item.weight;
      return roll <= 0;
    });
    const [item] = candidatePool.splice(Math.max(0, index), 1);
    selected.push(item);
  }

  selected.forEach(({ code, relation }) => {
    const level = randomFamiliarityLevel(relation, rng);
    const multiplier = level.min + rng() * (level.max - level.min);
    multipliers[code] = multiplier;
    const capped = Math.min((fitScores[code] || 0) * multiplier, primaryRating * 0.98);
    aptitudes[code] = Number(capped.toFixed(2));
    labels[code] = level.label;
  });

  nearbyCodes(primaryCode, data)
    .filter((code) => labels[code] === "能力不足")
    .forEach((code) => {
      if (rng() < 0.12) {
        const multiplier = 0.2 + rng() * 0.12;
        multipliers[code] = multiplier;
        aptitudes[code] = Number(((fitScores[code] || 0) * multiplier).toFixed(2));
        labels[code] = "急造";
      }
    });

  data.positionCodes.forEach((code) => {
    if (code !== primaryCode) {
      aptitudes[code] = Number(sameSideAdjusted(aptitudes[code], hand, code, sidePenaltyRate).toFixed(2));
    }
  });

  const sorted = data.positionCodes
    .map((code) => ({ code, rating: aptitudes[code], label: labels[code] }))
    .sort((a, b) => b.rating - a.rating);
  return {
    sorted,
    ratings: Object.fromEntries(sorted.map((item) => [item.code, Number(item.rating.toFixed(2))])),
    labels,
    multipliers: Object.fromEntries(Object.entries(multipliers).map(([code, value]) => [code, Number((value * 100).toFixed(0))])),
  };
}

function buildPlayer(index, data, rng, groupName, includeSecret, target = {}) {
  const gender = target.gender || (rng() < 0.54 ? "男" : "女");
  const age = generateTargetAge(target.ageBand, rng);
  const nationality = target.nationality || pickLeagueNationality(data, groupName, gender, rng);
  const name = buildName(data, nationality, gender, rng);
  const height = boundedNormal(gender === "男" ? 172 : 159, gender === "男" ? 6.5 : 5.5, gender === "男" ? 150 : 140, gender === "男" ? 200 : 185, rng);
  const roleCode = target.position || chooseRole(data, rng);
  const stats = generateStats(data, roleCode, age, height, gender, rng, target);
  const hand = target.hand || pick(["右", "右", "右", "右", "右", "右", "右", "右", "左", "左", "左", "両"], rng);
  const sidePenaltyRate = hand === "両" ? 0 : clamp(normalRandom(0.12, 0.035, rng), 0.05, 0.2);
  const positionScores = computePositions(stats, data, hand, sidePenaltyRate);
  const primaryCode = positionScores[0].code;
  const aptitudes = createPositionAptitudes(primaryCode, positionScores, data, hand, sidePenaltyRate, rng);
  const topStats = data.statNames
    .map((name, i) => ({ name, value: stats[i] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((item) => `${item.name}${item.value}`)
    .join(" / ");

  const player = {
    no: index + 1,
    surname: name.surname,
    givenName: name.givenName,
    fullName: name.fullName,
    nameOrder: name.nameOrder,
    nameSubgroup: name.nameSubgroup,
    surnameNote: name.surnameNote,
    gender,
    age,
    nationality,
    height,
    hand,
    roleType: `${roleCode} ${roleLabels[roleCode] || ""}`.trim(),
    bestPosition: primaryCode,
    rating: Number(aptitudes.ratings[primaryCode].toFixed(2)),
    stats: Object.fromEntries(data.statNames.map((name, i) => [name, stats[i]])),
    positionRatings: aptitudes.ratings,
    positionLabels: aptitudes.labels,
    positionMultipliers: aptitudes.multipliers,
    positionBaseRatings: Object.fromEntries(positionScores.map((item) => [item.code, Number(item.baseRating.toFixed(2))])),
    positionFitScores: Object.fromEntries(positionScores.map((item) => [item.code, Number(item.rating.toFixed(2))])),
    sidePenaltyRate: Number((sidePenaltyRate * 100).toFixed(1)),
    sidePenaltyPositions: sidePositionPairs
      .map((pair) => (hand === "右" ? pair.right : pair.left))
      .filter((code) => hand !== "両" && code !== primaryCode && data.positionCodes.includes(code)),
    topStats,
  };

  if (includeSecret) {
    const days = clamp(Math.round(normalRandom(2, 3, rng)), 0, 10);
    player.days = days;
    player.odor = clamp(Math.round(normalRandom(days * 7 + 10, 10, rng)), 0, 100);
    player.gas = clamp(Math.round(normalRandom(days * 7 + 10, 10, rng)), 0, 100);
    player.condition = gender === "女" && days > 4 ? "便秘" : "";
  }

  return player;
}

function renderGroups(data) {
  const select = $("groupSelect");
  select.innerHTML = "";
  Object.keys(data.nationalityGroups).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  });
  select.value = data.nationalityGroups["イギリス"] ? "イギリス" : Object.keys(data.nationalityGroups)[0];

  const targetPosition = $("targetPositionSelect");
  if (targetPosition) {
    targetPosition.innerHTML = `<option value="">おまかせ</option>`;
    data.positionCodes
      .filter((code) => code !== "20")
      .forEach((code) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = `#${code} ${roleLabels[code] || ""}`;
        targetPosition.append(option);
      });
  }

  const teamFormationSelect = $("teamFormationSelect");
  if (teamFormationSelect) {
    teamFormationSelect.innerHTML = "";
    Object.entries(formations).forEach(([key, formation]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = formation.label;
      teamFormationSelect.append(option);
    });
    teamFormationSelect.value = "f313";
  }
}

function readTargetOptions() {
  return {
    position: $("targetPositionSelect")?.value || "",
    archetype: $("targetArchetypeSelect")?.value || "",
    strength: $("targetStrengthSelect")?.value || "normal",
    ageBand: $("targetAgeSelect")?.value || "",
    gender: $("targetGenderSelect")?.value || "",
    hand: $("targetHandSelect")?.value || "",
  };
}

function readGenerationStrengthAdjust() {
  const input = $("strengthAdjustInput");
  const value = clamp(Number(input?.value) || 0, -12, 12);
  if (input) input.value = String(value);
  return value;
}

function applyGenerationStrength(target = {}) {
  const strengthAdjust = readGenerationStrengthAdjust();
  return {
    ...target,
    talentShift: Number(target.talentShift || 0) + strengthAdjust * 0.45,
  };
}

function readTeamGenerationOptions() {
  const strengthRank = $("teamStrengthRank")?.value || "middle";
  const profile = teamStrengthProfiles[strengthRank] || teamStrengthProfiles.middle;
  const count = clamp(Number($("teamRosterSize")?.value) || 20, 7, 20);
  const starValue = $("teamStarCount")?.value || "auto";
  const stars = starValue === "auto" ? profile.defaultStars : Number(starValue) || 0;
  return {
    count,
    strengthRank,
    strengthAdjust: clamp(Number($("teamStrengthAdjust")?.value) || 0, -10, 10),
    variance: $("teamVarianceSelect")?.value || "standard",
    stars: clamp(stars, 0, Math.min(3, count)),
    depth: $("teamDepthSelect")?.value || "standard",
    formationKey: $("teamFormationSelect")?.value || "f313",
    style: $("teamStyleSelect")?.value || "balanced",
    ageMix: $("teamAgeMixSelect")?.value || "standard",
    outputMode: $("teamOutputMode")?.value || "replace",
  };
}

function slotPriority(slot) {
  if (slot.key === "midfield_center") return 8;
  if (slot.key === "front_center") return 7;
  if (slot.key === "back_center") return 6;
  if (slot.key.includes("center")) return 5;
  if (slot.key.includes("wide")) return 3;
  return 4;
}

function rosterTierSequence(count, starCount) {
  const starters = Math.max(0, Math.min(7, count) - starCount);
  const sequence = [...Array(starCount).fill("star"), ...Array(starters).fill("starter")];
  let remaining = count - sequence.length;
  const rotationCount = Math.min(remaining, count >= 20 ? 6 : 5);
  sequence.push(...Array(rotationCount).fill("rotation"));
  remaining -= rotationCount;
  const benchCount = Math.min(remaining, count >= 20 ? 4 : 3);
  sequence.push(...Array(benchCount).fill("bench"));
  remaining -= benchCount;
  sequence.push(...Array(Math.max(0, remaining)).fill("prospect"));
  return sequence.slice(0, count);
}

function chooseExtraPosition(index, formation, style, rng) {
  const template = teamStyleRoleTemplates[style] || teamStyleRoleTemplates.balanced;
  const formationRoles = formation.slots.map((slot) => slot.allowed[0]);
  const roll = rng();
  if (roll < 0.45) return template[index % template.length];
  if (roll < 0.75) return pick(formationRoles, rng);
  return weightedPick(template.map((code, i) => [code, template.length - i]), rng);
}

function chooseAgeBandForTier(tier, ageMix, rng) {
  const roll = rng();
  if (ageMix === "young") return roll < 0.68 || tier === "prospect" ? "young" : "prime";
  if (ageMix === "veteran") return roll < 0.45 && tier !== "prospect" ? "veteran" : "prime";
  if (ageMix === "mixed") return roll < 0.28 ? "young" : roll < 0.76 ? "prime" : "veteran";
  if (tier === "prospect") return roll < 0.78 ? "young" : "prime";
  if (tier === "bench") return roll < 0.22 ? "young" : roll < 0.72 ? "prime" : "veteran";
  return roll < 0.12 ? "young" : roll < 0.86 ? "prime" : "veteran";
}

function archetypeForTeamStyle(style, position, rng) {
  const defensive = ["1", "2", "3", "11", "12", "13", "14"].includes(position);
  const central = ["4", "10", "12", "13", "14"].includes(position);
  const attacking = ["5", "6", "7", "15", "16", "17"].includes(position);
  if (style === "defense") return defensive ? "defense" : pick(["physical", "mental", "balanced"], rng);
  if (style === "midfield") return central ? pick(["mental", "technical"], rng) : "balanced";
  if (style === "attack") return attacking ? "attack" : pick(["technical", "balanced"], rng);
  if (style === "counter") return attacking ? pick(["physical", "attack"], rng) : pick(["defense", "physical"], rng);
  if (defensive) return pick(["defense", "mental", "balanced"], rng);
  if (central) return pick(["mental", "technical", "balanced"], rng);
  return pick(["attack", "physical", "technical", "balanced"], rng);
}

function teamAdjustedBandRange(tier, options) {
  const bands = teamTargetBands[options.strengthRank];
  const band = bands?.[tier];
  if (!band) return null;
  const depth = teamDepthProfiles[options.depth] || teamDepthProfiles.standard;
  const depthOffset = tier === "rotation" ? depth.rotation : tier === "bench" ? depth.bench : tier === "prospect" ? depth.prospect : 0;
  const adjust = Number(options.strengthAdjust || 0) * 0.35;
  const low = band[0] + adjust + depthOffset * 0.35;
  const high = band[1] + adjust + depthOffset * 0.35;
  return [clamp(low, 30, ratingScaleTuning.hardMax), clamp(high, 30, ratingScaleTuning.hardMax)];
}

function teamBandTargetCenter(tier, options, rng) {
  const band = teamAdjustedBandRange(tier, options);
  if (!band) return null;
  const low = Math.min(band[0], band[1]);
  const high = Math.max(band[0], band[1]);
  return clamp(low + rng() * Math.max(0.1, high - low), 30, ratingScaleTuning.hardMax);
}

function tierTargetCenter(tier, options, rng) {
  const bandTarget = teamBandTargetCenter(tier, options, rng);
  if (bandTarget !== null) return bandTarget;
  const profile = teamStrengthProfiles[options.strengthRank] || teamStrengthProfiles.middle;
  const depth = teamDepthProfiles[options.depth] || teamDepthProfiles.standard;
  const depthOffset = tier === "rotation" ? depth.rotation : tier === "bench" ? depth.bench : tier === "prospect" ? depth.prospect : 0;
  const jitter = normalRandom(0, 1.3, rng);
  return clamp(profile.center + options.strengthAdjust + teamTierOffsets[tier] + depthOffset + jitter, 30, 94.5);
}

function isDomesticLeagueNationality(data, groupName, nationality, gender) {
  if (!groupName || groupName === "全世界" || nationality !== groupName) return false;
  return Boolean(hasNameData(data, nationality, gender) && leagueNationalityWeights[groupName]?.some(([country]) => country === nationality));
}

function chooseTeamIdentity(data, groupName, rng) {
  const gender = rng() < 0.54 ? "男" : "女";
  return {
    gender,
    nationality: pickLeagueNationality(data, groupName, gender, rng),
  };
}

function applyHomegrownAdjustment(blueprint, rng) {
  const reduction = homegrownSettings.reductions[blueprint.tier] || 8;
  const cap = homegrownSettings.caps[blueprint.tier] || 60;
  const targetCenter = clamp(
    Math.min(blueprint.targetCenter - reduction + normalRandom(0, 1.8, rng), cap + normalRandom(0, 1.1, rng)),
    32,
    74,
  );
  const rangeWidth = Math.max(5, (blueprint.maxRating - blueprint.minRating) * 0.72);
  return {
    ...blueprint,
    homegrown: true,
    tierLabel: teamTierLabelForTarget(targetCenter),
    targetCenter,
    minRating: clamp(targetCenter - rangeWidth, 1, ratingScaleTuning.hardMax),
    maxRating: clamp(targetCenter + rangeWidth, 1, ratingScaleTuning.hardMax),
    talentSpreadScale: Math.max(0.8, blueprint.talentSpreadScale * 0.88),
    factorSpreadScale: Math.max(0.82, blueprint.factorSpreadScale * 0.9),
  };
}

function teamTierLabelForTarget(targetCenter) {
  if (targetCenter >= 76) return "主力級";
  if (targetCenter >= 66) return "ローテ級";
  if (targetCenter >= 54) return "控え級";
  return "育成枠";
}

function buildTeamBlueprints(options, rng) {
  const formation = formations[options.formationKey] || formations.f313;
  const variance = teamVarianceProfiles[options.variance] || teamVarianceProfiles.standard;
  const tierSequence = rosterTierSequence(options.count, options.stars);
  const starSlotIndexes = new Set(
    formation.slots
      .map((slot, index) => ({ index, priority: slotPriority(slot) }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, options.stars)
      .map((item) => item.index),
  );

  const startingBlueprints = formation.slots.map((slot, index) => ({
    position: slot.allowed[0],
    slotLabel: slot.label,
    tier: starSlotIndexes.has(index) ? "star" : "starter",
  }));

  const extraTiers = tierSequence.slice(startingBlueprints.length);
  const extraBlueprints = extraTiers.map((tier, index) => ({
    position: chooseExtraPosition(index, formation, options.style, rng),
    slotLabel: "登録枠",
    tier,
  }));

  return [...startingBlueprints, ...extraBlueprints].slice(0, options.count).map((blueprint) => {
    const center = tierTargetCenter(blueprint.tier, options, rng);
    const range = variance.range * (blueprint.tier === "prospect" ? 1.18 : 1);
    const band = teamAdjustedBandRange(blueprint.tier, options);
    return {
      ...blueprint,
      tierLabel: teamTierLabels[blueprint.tier],
      targetCenter: center,
      minRating: band ? Math.min(...band) : clamp(center - range, 1, ratingScaleTuning.hardMax),
      maxRating: band ? Math.max(...band) : clamp(center + range, 1, ratingScaleTuning.hardMax),
      ageBand: chooseAgeBandForTier(blueprint.tier, options.ageMix, rng),
      archetype: archetypeForTeamStyle(options.style, blueprint.position, rng),
      talentSpreadScale: variance.spread,
      factorSpreadScale: variance.spread,
      statNoiseScale: variance.spread,
      highStatLimit: teamHighStatLimits[blueprint.tier] ?? 3,
      statHardCap: teamStatHardCaps[blueprint.tier] ?? 29,
    };
  });
}

function teamPlayerAttemptScore(player, blueprint) {
  const positionRating = player.positionRatings[blueprint.position] || 0;
  const distance = Math.abs(positionRating - blueprint.targetCenter);
  const positionPenalty = player.bestPosition === blueprint.position ? 0 : 5.5;
  const lowerMiss = Math.max(0, blueprint.minRating - positionRating);
  const upperMiss = Math.max(0, positionRating - blueprint.maxRating);
  const rangePenalty = lowerMiss || upperMiss ? 4 + (lowerMiss + upperMiss) * 2.5 : 0;
  return distance + positionPenalty + rangePenalty;
}

function buildTeamPlayer(index, data, rng, groupName, includeSecret, blueprint, identity = null, forceHomegrown = false) {
  const resolvedIdentity = identity || chooseTeamIdentity(data, groupName, rng);
  const shouldUseHomegrown =
    forceHomegrown &&
    isDomesticLeagueNationality(data, groupName, resolvedIdentity.nationality, resolvedIdentity.gender);
  const effectiveBlueprint = shouldUseHomegrown ? applyHomegrownAdjustment(blueprint, rng) : blueprint;
  const target = {
    position: effectiveBlueprint.position,
    archetype: effectiveBlueprint.archetype,
    strength: "normal",
    ageBand: effectiveBlueprint.ageBand,
    gender: resolvedIdentity.gender,
    nationality: resolvedIdentity.nationality,
    talentShift: (effectiveBlueprint.targetCenter - 66) * 0.31,
    talentMax:
      effectiveBlueprint.tier === "star" && effectiveBlueprint.targetCenter >= 90
        ? 28.5
        : effectiveBlueprint.targetCenter >= 82
          ? 27.5
          : 26.5,
    talentSpreadScale: effectiveBlueprint.talentSpreadScale,
    factorSpreadScale: effectiveBlueprint.factorSpreadScale,
    statNoiseScale: effectiveBlueprint.statNoiseScale,
    highStatLimit: effectiveBlueprint.highStatLimit,
    statHardCap: effectiveBlueprint.statHardCap,
  };

  let bestPlayer = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 34; attempt += 1) {
    const player = buildPlayer(index, data, rng, groupName, includeSecret, target);
    const score = teamPlayerAttemptScore(player, effectiveBlueprint);
    if (score < bestScore) {
      bestScore = score;
      bestPlayer = player;
    }
    const positionRating = player.positionRatings[effectiveBlueprint.position] || 0;
    if (
      score <= 2.6 ||
      (player.bestPosition === effectiveBlueprint.position &&
        positionRating >= effectiveBlueprint.minRating &&
        positionRating <= effectiveBlueprint.maxRating)
    ) {
      bestPlayer = player;
      break;
    }
  }

  bestPlayer.no = index + 1;
  bestPlayer.teamTier = effectiveBlueprint.tierLabel;
  bestPlayer.originalTeamTier = blueprint.tierLabel;
  bestPlayer.homegrownSlot = shouldUseHomegrown;
  bestPlayer.plannedPosition = effectiveBlueprint.position;
  bestPlayer.plannedSlot = effectiveBlueprint.slotLabel;
  bestPlayer.teamTargetRating = Number(effectiveBlueprint.targetCenter.toFixed(1));
  bestPlayer.teamTargetRange = `${effectiveBlueprint.minRating.toFixed(0)}-${effectiveBlueprint.maxRating.toFixed(0)}`;
  return bestPlayer;
}

function selectHomegrownIndexes(data, groupName, blueprints, identities, rng) {
  const domestic = identities
    .map((identity, index) => ({ identity, index, tier: blueprints[index].tier }))
    .filter((item) => isDomesticLeagueNationality(data, groupName, item.identity.nationality, item.identity.gender));
  const targetCount = Math.round(domestic.length * homegrownSettings.domesticShare);
  const selected = new Set();
  const weights = { star: 0.35, starter: 1, rotation: 1.25, bench: 1.35, prospect: 1.45 };
  const pool = domestic.map((item) => ({ ...item, weight: weights[item.tier] || 1 }));
  while (selected.size < targetCount && pool.length) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = rng() * total;
    const pickedIndex = pool.findIndex((item) => {
      roll -= item.weight;
      return roll <= 0;
    });
    const [picked] = pool.splice(Math.max(0, pickedIndex), 1);
    selected.add(picked.index);
  }
  return selected;
}

function buildGeneratedTeam(data, rng, groupName, includeSecret, options) {
  const blueprints = buildTeamBlueprints(options, rng);
  const identities = blueprints.map(() => chooseTeamIdentity(data, groupName, rng));
  const homegrownIndexes = selectHomegrownIndexes(data, groupName, blueprints, identities, rng);
  return blueprints.map((blueprint, index) =>
    buildTeamPlayer(index, data, rng, groupName, includeSecret, blueprint, identities[index], homegrownIndexes.has(index)),
  );
}

function activeColumns() {
  const statColumns = $("statsInput").checked ? state.data.statNames.map((name) => [`stat:${name}`, name]) : [];
  return $("secretInput").checked ? [...baseColumns, ...statColumns, ...secretColumns] : [...baseColumns, ...statColumns];
}

function valueForColumn(player, key) {
  if (key.startsWith("stat:")) return player.stats[key.slice(5)];
  return player[key] ?? "";
}

function heatStyle(value, maxValue = 30) {
  const normalized = clamp(Number(value) || 0, 0, maxValue) / maxValue;
  const hue = Math.round(6 + normalized * 128);
  const fillAlpha = 0.16 + normalized * 0.18;
  return `--heat:${(normalized * 100).toFixed(1)}%;--heat-color:hsla(${hue}, 68%, 43%, ${fillAlpha.toFixed(3)});--heat-line:hsl(${hue}, 58%, 34%);`;
}

function labelForFamiliarity(percent) {
  const value = Number(percent) || 0;
  if (value >= 90) return "熟達";
  if (value >= 78) return "達者";
  if (value >= 62) return "能力あり";
  if (value >= 46) return "不安あり";
  if (value >= 32) return "不慣れ";
  if (value >= 20) return "急造";
  return "能力不足";
}

function sidePenaltyRateForPlayer(player) {
  if ((player.hand || "右") === "両") return 0;
  return clamp((Number(player.sidePenaltyRate) || 0) / 100, 0, 0.3);
}

function recomputePositionRatingsFromStats(player) {
  const stats = state.data.statNames.map((name) => clamp(Number(player.stats?.[name]) || 0, 1, 30));
  const hand = player.hand || "右";
  const sidePenaltyRate = sidePenaltyRateForPlayer(player);
  const scores = computePositions(stats, state.data, hand, sidePenaltyRate);
  const scoreByCode = Object.fromEntries(scores.map((score) => [score.code, score]));

  player.positionRatings = player.positionRatings || {};
  player.positionLabels = player.positionLabels || {};
  player.positionMultipliers = player.positionMultipliers || {};
  player.positionBaseRatings = {};
  player.positionFitScores = {};
  player.sidePenaltyPositions = [];

  state.data.positionCodes.forEach((code) => {
    const score = scoreByCode[code] || { baseRating: 0, rating: 0 };
    const multiplier = clamp(Number(player.positionMultipliers[code]) || 0, 0, 100);
    player.positionMultipliers[code] = Number(multiplier.toFixed(1));
    player.positionBaseRatings[code] = Number(score.baseRating.toFixed(2));
    player.positionFitScores[code] = Number(score.rating.toFixed(2));
    player.positionRatings[code] = Number((score.rating * (multiplier / 100)).toFixed(2));
    player.positionLabels[code] = labelForFamiliarity(multiplier);
  });

  recomputePlayerSummary(player);
  player.positionLabels[player.bestPosition] = "主";
  player.sidePenaltyPositions = state.data.positionCodes.filter(
    (code) => hand !== "両" && code !== player.bestPosition && sameSidePenaltyCode(hand, code),
  );
}

function saveTeam() {
  localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(state.team));
}

function loadTeam() {
  try {
    const raw = localStorage.getItem(TEAM_STORAGE_KEY);
    state.team = raw ? JSON.parse(raw).map(normalizeTeamPlayer) : [];
  } catch {
    state.team = [];
  }
}

function normalizeTeamPlayer(player) {
  const normalized = {
    ...player,
    teamId: player.teamId || nextTeamId(),
    positionRatings: player.positionRatings || {},
    positionLabels: player.positionLabels || {},
    positionMultipliers: player.positionMultipliers || {},
    positionBaseRatings: player.positionBaseRatings || {},
    positionFitScores: player.positionFitScores || {},
    stats: player.stats || {},
    sidePenaltyPositions: player.sidePenaltyPositions || [],
    nameOrder: player.nameOrder || "family-first",
    nameSubgroup: player.nameSubgroup || "",
    surnameNote: player.surnameNote || "",
  };
  if (normalized.teamTier === ["H", "G", "枠"].join("")) {
    normalized.teamTier = teamTierLabelForTarget(Number(normalized.rating || normalized.teamTargetRating || 55));
  }
  state.data.positionCodes.forEach((code) => {
    normalized.positionRatings[code] = Number(normalized.positionRatings[code] || 0);
    normalized.positionLabels[code] = legacyFamiliarityLabels[normalized.positionLabels[code]] || normalized.positionLabels[code] || "能力不足";
    const multiplier = normalized.positionMultipliers[code];
    normalized.positionMultipliers[code] =
      multiplier === undefined || multiplier === null || multiplier === ""
        ? code === normalized.bestPosition
          ? 100
          : 18
        : Number(multiplier);
    normalized.positionBaseRatings[code] = Number(normalized.positionBaseRatings[code] || normalized.positionRatings[code] || 0);
    normalized.positionFitScores[code] = Number(normalized.positionFitScores[code] || normalized.positionRatings[code] || 0);
  });
  state.data.statNames.forEach((name) => {
    normalized.stats[name] = clamp(Number(normalized.stats[name]) || 15, 1, 30);
  });
  recomputePositionRatingsFromStats(normalized);
  return normalized;
}

function setTeamImportStatus(message, isError = false) {
  const status = $("teamImportStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function extractImportedPlayers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.players)) return data.players;
  if (Array.isArray(data?.team)) return data.team;
  if (data?.player && typeof data.player === "object") return [data.player];
  return [];
}

function parseImportedPlayers(text, fileName = "") {
  const source = String(text || "").replace(/^\ufeff/, "").trim();
  if (!source) return [];
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".json") || source.startsWith("[") || source.startsWith("{")) {
    return extractImportedPlayers(JSON.parse(source));
  }
  throw new Error("JSONファイルを選択してください");
}

function normalizeImportedPlayer(player) {
  const copy = structuredClone(player);
  copy.teamId = nextTeamId();
  return normalizeTeamPlayer(copy);
}

async function importTeamFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    setTeamImportStatus("読み込み中...");
    const rawPlayers = parseImportedPlayers(await file.text(), file.name);
    const imported = rawPlayers
      .filter((player) => player && typeof player === "object")
      .map(normalizeImportedPlayer);
    if (!imported.length) throw new Error("選手情報が見つかりませんでした");

    const limited = imported.slice(0, 20);
    state.team = limited;
    state.selectedTeamId = limited[0]?.teamId || null;
    state.editingMode = limited.length ? "edit" : "none";
    saveTeam();
    refreshTeamDependents();

    const limitedText = imported.length > limited.length ? `（20人上限のため${imported.length - limited.length}人は未登録）` : "";
    setTeamImportStatus(`${file.name} から${limited.length}人を読み込みました${limitedText}`);
  } catch (error) {
    setTeamImportStatus(`読み込みに失敗しました: ${error.message}`, true);
  } finally {
    input.value = "";
  }
}

function nextTeamId() {
  return `team-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function cloneForTeam(player) {
  return {
    ...structuredClone(player),
    teamId: nextTeamId(),
    sourceNo: player.no,
  };
}

function refreshTeamDependents() {
  renderTeam();
  renderPlanner();
}

function recomputePlayerSummary(player) {
  const sorted = Object.entries(player.positionRatings).sort((a, b) => b[1] - a[1]);
  player.bestPosition = sorted[0]?.[0] || player.bestPosition || "1";
  player.rating = Number((sorted[0]?.[1] || 0).toFixed(2));
  player.topStats = Object.entries(player.stats || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value]) => `${name}${value}`)
    .join(" / ");
  if (player.nameOrder === "single-personal-name") {
    player.fullName = player.givenName || player.surname || "無名 選手";
  } else if (player.nameOrder === "given-first" || player.nameOrder === "given-patronymic" || player.nameOrder === "given-surname-postname") {
    player.fullName = `${player.givenName || ""} ${player.surname || ""}`.trim() || "無名 選手";
  } else {
    player.fullName = `${player.surname || ""} ${player.givenName || ""}`.trim() || "無名 選手";
  }
}

function createManualPlayer() {
  const positionRatings = Object.fromEntries(state.data.positionCodes.map((code) => [code, 0]));
  const positionLabels = Object.fromEntries(state.data.positionCodes.map((code) => [code, code === "1" ? "主" : "能力不足"]));
  const positionMultipliers = Object.fromEntries(state.data.positionCodes.map((code) => [code, code === "1" ? 100 : 18]));
  const stats = Object.fromEntries(state.data.statNames.map((name) => [name, 15]));
  const player = {
    teamId: nextTeamId(),
    no: 0,
    surname: "新規",
    givenName: "選手",
    fullName: "新規 選手",
    nameOrder: "family-first",
    nameSubgroup: "",
    surnameNote: "",
    gender: "男",
    age: 24,
    nationality: "日本",
    height: 172,
    hand: "右",
    roleType: "手入力",
    bestPosition: "1",
    rating: 0,
    stats,
    positionRatings,
    positionLabels,
    positionMultipliers,
    positionBaseRatings: { ...positionRatings },
    positionFitScores: { ...positionRatings },
    sidePenaltyRate: 12,
    sidePenaltyPositions: [],
    topStats: "",
  };
  recomputePositionRatingsFromStats(player);
  return player;
}

function renderTable() {
  const head = $("tableHead");
  const body = $("tableBody");
  const cols = activeColumns();
  head.innerHTML = `<tr>${cols.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}<th>操作</th></tr>`;

  if (!state.filtered.length) {
    body.innerHTML = `<tr><td class="empty" colspan="${cols.length + 1}">表示できる選手がありません</td></tr>`;
    return;
  }

  body.innerHTML = state.filtered
    .map((player) => {
      const rowClass = player.no === state.selectedNo ? " class=\"is-selected\"" : "";
      const cells = cols
        .map(([key]) => {
          const classes = [];
          if (key === "rating") classes.push("rating");
          if (key.startsWith("stat:")) classes.push("stat-cell");
          if (key === "rating" || key.startsWith("stat:")) classes.push("heat-cell");
          const className = classes.length ? ` class="${classes.join(" ")}"` : "";
          const value = valueForColumn(player, key);
          const style = key.startsWith("stat:")
            ? ` style="${heatStyle(value, 30)}"`
            : key === "rating"
              ? ` style="${heatStyle(value, 100)}"`
              : "";
          return `<td${className}${style}>${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr${rowClass} data-no="${player.no}">${cells}<td><button class="row-action" type="button" data-action="adopt">採用</button></td></tr>`;
    })
    .join("");

  body.querySelectorAll("tr[data-no]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedNo = Number(row.dataset.no);
      renderTable();
      renderDetail();
    });
  });
  body.querySelectorAll("button[data-action='adopt']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const row = event.currentTarget.closest("tr[data-no]");
      const player = state.players.find((item) => item.no === Number(row.dataset.no));
      if (player) adoptPlayer(player);
    });
  });
}

function renderSummary() {
  const players = state.players;
  $("totalCount").textContent = players.length.toString();
  $("averageRating").textContent = players.length
    ? (players.reduce((sum, player) => sum + player.rating, 0) / players.length).toFixed(1)
    : "0.0";
  const counts = new Map();
  players.forEach((player) => counts.set(player.bestPosition, (counts.get(player.bestPosition) || 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  $("topPosition").textContent = top ? top[0] : "-";
  const group = $("groupSelect").value;
  $("nationalityCount").textContent = countAvailableNationalities(state.data, group).toString();
}

function renderDetail() {
  const panel = $("detailPanel");
  const player = state.players.find((item) => item.no === state.selectedNo);
  if (!player) {
    panel.innerHTML = `<div class="detail-empty">選手を選ぶと、全ステータスとポジション適性を確認できます</div>`;
    return;
  }

  const maxRating = Math.max(...Object.values(player.positionRatings), 1);
  const nameMeta = [
    player.nameSubgroup,
    player.surnameNote ? "命名構造あり" : "",
    player.teamTier,
  ]
    .filter(Boolean)
    .join(" / ");
  const statCards = state.data.statNames
    .map((name) => `<div class="stat-card heat-card" style="${heatStyle(player.stats[name], 30)}"><span>${escapeHtml(name)}</span><strong>${player.stats[name]}</strong></div>`)
    .join("");
  const positionCards = Object.entries(player.positionRatings)
    .sort((a, b) => b[1] - a[1])
    .map(([code, rating]) => {
      const width = Math.round((rating / maxRating) * 100);
      const label = player.positionLabels[code] || "";
      const multiplier = player.positionMultipliers?.[code] ?? "";
      const multiplierText = multiplier ? `${multiplier}%` : "";
      const suffixText = [label, multiplierText, player.sidePenaltyPositions.includes(code) ? "同サイド補正" : ""]
        .filter(Boolean)
        .join(" / ");
      const suffix = suffixText ? ` <small>${escapeHtml(suffixText)}</small>` : "";
      return `<div class="position-card heat-card" style="${heatStyle(rating, 100)}"><span>#${escapeHtml(code)}</span><div class="meter"><i style="width:${width}%"></i></div><strong>${rating}${suffix}</strong></div>`;
    })
    .join("");
  const penaltyText = player.sidePenaltyRate
    ? `同サイド補正 ${player.sidePenaltyRate}%減: ${player.sidePenaltyPositions.join(", ")}`
    : "同サイド補正なし";

  panel.innerHTML = `
    <div class="detail-head">
      <div>
        <h2>${escapeHtml(player.fullName)}</h2>
        <p>${escapeHtml(player.gender)} / ${player.age}歳 / ${escapeHtml(player.nationality)}${nameMeta ? ` / ${escapeHtml(nameMeta)}` : ""} / ${player.height}cm / ${escapeHtml(player.hand)}利き / 型 ${escapeHtml(player.roleType)} / ${escapeHtml(penaltyText)}</p>
      </div>
      <strong class="rating">適性 ${player.bestPosition} / ${player.rating}</strong>
    </div>
    <div class="detail-grid">
      <div class="stat-grid">${statCards}</div>
      <div class="position-list">${positionCards}</div>
    </div>
  `;
}

function renderTeam() {
  const list = $("teamList");
  const summary = $("teamSummary");
  if (!list || !summary) return;

  const count = state.team.length;
  const average = count ? state.team.reduce((sum, player) => sum + (player.rating || 0), 0) / count : 0;
  const positions = new Map();
  state.team.forEach((player) => positions.set(player.bestPosition, (positions.get(player.bestPosition) || 0) + 1));
  const topPosition = [...positions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const nationalities = new Set(state.team.map((player) => player.nationality).filter(Boolean));

  summary.innerHTML = `
    <div><span>採用数</span><strong>${count}</strong></div>
    <div><span>平均主適性</span><strong>${average.toFixed(1)}</strong></div>
    <div><span>最多本職</span><strong>${escapeHtml(topPosition)}</strong></div>
    <div><span>国籍数</span><strong>${nationalities.size}</strong></div>
  `;

  if (!count) {
    list.innerHTML = `<div class="detail-empty">まだ採用選手がいません</div>`;
    renderEditor();
    return;
  }

  list.innerHTML = state.team
    .map((player) => {
      const selected = player.teamId === state.selectedTeamId ? " is-selected" : "";
      const teamMeta = [player.teamTier, player.plannedPosition ? `予定#${player.plannedPosition}` : ""].filter(Boolean).join(" / ");
      return `
        <div class="team-row${selected}" data-team-id="${escapeHtml(player.teamId)}">
          <div>
            <div class="name">${escapeHtml(player.fullName)}</div>
            <div class="meta">${escapeHtml(player.gender)} / ${player.age}歳 / ${escapeHtml(player.nationality)} / 本職 ${escapeHtml(player.bestPosition)} / ${Number(player.rating || 0).toFixed(2)}${teamMeta ? ` / ${escapeHtml(teamMeta)}` : ""}</div>
          </div>
          <button type="button" data-action="edit">編集</button>
          <button type="button" data-action="remove">削除</button>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".team-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      const action = event.target?.dataset?.action;
      const teamId = row.dataset.teamId;
      if (action === "remove") {
        state.team = state.team.filter((player) => player.teamId !== teamId);
        if (state.selectedTeamId === teamId) {
          state.selectedTeamId = null;
          state.editingMode = "none";
        }
        saveTeam();
        refreshTeamDependents();
        return;
      }
      state.selectedTeamId = teamId;
      state.editingMode = "edit";
      refreshTeamDependents();
    });
  });

  renderEditor();
}

function renderEditor() {
  const form = $("playerEditor");
  if (!form) return;
  const player = state.team.find((item) => item.teamId === state.selectedTeamId);
  if (!player) {
    form.innerHTML = `<div class="detail-empty">採用選手を選ぶか、手入力を開始してください</div>`;
    return;
  }

  const positionInputs = state.data.positionCodes
    .map((code) => {
      const label = legacyFamiliarityLabels[player.positionLabels?.[code]] || player.positionLabels?.[code] || "能力不足";
      const rating = Number(player.positionRatings?.[code] || 0).toFixed(1);
      const base = Number(player.positionFitScores?.[code] || 0).toFixed(1);
      const multiplier = Number(player.positionMultipliers?.[code] || 0).toFixed(1);
      return `
        <label>
          #${escapeHtml(code)} ${escapeHtml(label)}
          <span class="computed-aptitude">適性 ${rating} / 基礎 ${base}</span>
          <input name="fam:${escapeHtml(code)}" type="number" min="0" max="100" step="1" value="${multiplier}" />
        </label>
      `;
    })
    .join("");
  const statInputs = state.data.statNames
    .map(
      (name) => `
        <label>
          ${escapeHtml(name)}
          <input name="stat:${escapeHtml(name)}" type="number" min="1" max="30" step="1" value="${Number(player.stats?.[name] || 15)}" />
        </label>
      `,
    )
    .join("");

  form.innerHTML = `
    <div class="editor-grid">
      <label>姓・要素<input name="surname" type="text" value="${escapeHtml(player.surname || "")}" /></label>
      <label>名・個人名<input name="givenName" type="text" value="${escapeHtml(player.givenName || "")}" /></label>
      <label>性別<select name="gender"><option value="男">男</option><option value="女">女</option></select></label>
      <label>年齢<input name="age" type="number" min="12" max="60" value="${Number(player.age || 24)}" /></label>
      <label>国籍<input name="nationality" type="text" value="${escapeHtml(player.nationality || "")}" /></label>
      <label>身長<input name="height" type="number" min="120" max="230" value="${Number(player.height || 170)}" /></label>
      <label>利き手<select name="hand"><option value="右">右</option><option value="左">左</option><option value="両">両</option></select></label>
      <label>型<input name="roleType" type="text" value="${escapeHtml(player.roleType || "")}" /></label>
    </div>
    <h3 class="editor-section-title">ステータス</h3>
    <div class="stat-editor">${statInputs}</div>
    <h3 class="editor-section-title">ポジション慣れ</h3>
    <div class="position-editor">${positionInputs}</div>
    <div class="editor-actions">
      <button type="submit">保存</button>
    </div>
  `;
  form.elements.gender.value = player.gender || "男";
  form.elements.hand.value = player.hand || "右";
}

function adoptSelectedPlayer() {
  const player = state.players.find((item) => item.no === state.selectedNo) || state.filtered[0];
  if (!player) return;
  adoptPlayer(player);
}

function adoptPlayer(player) {
  const adopted = cloneForTeam(player);
  state.team.push(adopted);
  state.selectedTeamId = adopted.teamId;
  state.editingMode = "edit";
  saveTeam();
  refreshTeamDependents();
}

function startManualEntry() {
  const player = createManualPlayer();
  state.team.push(player);
  state.selectedTeamId = player.teamId;
  state.editingMode = "edit";
  saveTeam();
  refreshTeamDependents();
}

function saveEditor(event) {
  event.preventDefault();
  const player = state.team.find((item) => item.teamId === state.selectedTeamId);
  if (!player) return;
  const form = event.currentTarget;
  player.surname = form.elements.surname.value.trim();
  player.givenName = form.elements.givenName.value.trim();
  player.gender = form.elements.gender.value;
  player.age = Number(form.elements.age.value) || 24;
  player.nationality = form.elements.nationality.value.trim();
  player.height = Number(form.elements.height.value) || 170;
  player.hand = form.elements.hand.value;
  player.roleType = form.elements.roleType.value.trim();
  if (player.hand === "両") player.sidePenaltyRate = 0;
  else if (!Number(player.sidePenaltyRate)) player.sidePenaltyRate = 12;
  state.data.statNames.forEach((name) => {
    player.stats[name] = clamp(Number(form.elements[`stat:${name}`].value) || 15, 1, 30);
  });
  state.data.positionCodes.forEach((code) => {
    const value = clamp(Number(form.elements[`fam:${code}`].value) || 0, 0, 100);
    player.positionMultipliers[code] = Number(value.toFixed(1));
  });
  recomputePositionRatingsFromStats(player);
  saveTeam();
  refreshTeamDependents();
}

function slotCandidates(slot, formation) {
  const opReplacementFor = { 11: "1", 10: "4", 14: "4", 15: "5", 16: "6", 17: "7" };
  const baseCode = slot.allowed[0];
  const opCandidates = formation.op.filter((code) => slot.allowed.includes(opReplacementFor[code]) && !slot.allowed.includes(code));
  const rawCandidates = [...slot.allowed, ...opCandidates];
  const candidates = rawCandidates
    .filter((code) => !opReplacementFor[code] || formation.op.includes(code))
    .map((code, index) => {
      const isOp = Boolean(opReplacementFor[code]);
      const kind = index === 0 ? "基本" : isOp ? "OP置換" : "置換";
      return {
        code,
        kind,
        replacementFor: index === 0 ? "" : opReplacementFor[code] || baseCode,
        priority: index === 0 ? 1 : isOp ? 0.96 : 0.97,
      };
    });
  return { candidates };
}

function rankedPlayersForSlot(slot, players) {
  return players
    .map((player) => {
      const best = slot.candidates
        .map((candidate) => ({
          kind: candidate.kind,
          replacementFor: candidate.replacementFor,
          code: candidate.code,
          rawScore: player.positionRatings[candidate.code] || 0,
          score: (player.positionRatings[candidate.code] || 0) * candidate.priority,
          label: legacyFamiliarityLabels[player.positionLabels[candidate.code]] || player.positionLabels[candidate.code] || "能力不足",
          multiplier: player.positionMultipliers?.[candidate.code] || 0,
        }))
        .sort((a, b) => b.score - a.score)[0];
      return { player, ...best };
    })
    .sort((a, b) => b.score - a.score);
}

function playerPlanId(player) {
  return player.teamId || player.no;
}

function enrichPlanAlternatives(assignments, team) {
  const primaryBySlot = new Map(assignments.filter((item) => item.player).map((item) => [item.slot.key, playerPlanId(item.player)]));
  const primaryUsed = new Set(primaryBySlot.values());
  return assignments.map((item) => {
    const otherUsed = new Set([...primaryUsed].filter((id) => id !== primaryBySlot.get(item.slot.key)));
    const compatiblePlayers = team.filter((player) => !otherUsed.has(playerPlanId(player)));
    const options = rankedPlayersForSlot(item.slot, compatiblePlayers).slice(0, 3);
    return { ...item, options };
  });
}

function buildTeamPlan() {
  const formation = formations[$("formationSelect")?.value] || formations.f313;
  const available = [...state.team];
  const used = new Set();
  const assignmentsByKey = new Map();
  const preparedSlots = formation.slots.map((slot) => ({ ...slot, ...slotCandidates(slot, formation) }));
  const planningOrder = [...preparedSlots].sort((a, b) => a.candidates.length - b.candidates.length);

  planningOrder.forEach((slot) => {
    const candidates = rankedPlayersForSlot(
      slot,
      available.filter((player) => !used.has(playerPlanId(player))),
    );
    const selected = candidates[0] || null;
    if (selected) used.add(playerPlanId(selected.player));
    assignmentsByKey.set(slot.key, { slot, ...selected });
  });

  const assignments = enrichPlanAlternatives(
    preparedSlots.map((slot) => assignmentsByKey.get(slot.key) || { slot, player: null }),
    state.team,
  );

  return {
    formation,
    assignments,
  };
}

function slotGridPosition(key) {
  const row = key.startsWith("front") ? 1 : key.startsWith("midfield") ? 2 : 3;
  let col = 3;
  if (key.includes("center_left")) col = 2;
  else if (key.includes("center_right")) col = 4;
  else if (key.includes("wide_left") || key.endsWith("_left")) col = 1;
  else if (key.includes("wide_right") || key.endsWith("_right")) col = 5;
  return { row, col };
}

function replacementText(item) {
  return item.kind === "基本" ? "基本" : `${item.kind}: #${item.replacementFor}→#${item.code}`;
}

function renderPlannerOption(option, index) {
  const player = option.player;
  const rank = index + 1;
  return `
    <li class="planner-option ${index === 0 ? "is-primary" : ""}">
      <span class="option-rank">${rank}</span>
      <span class="option-name">${escapeHtml(player.fullName)}</span>
      <span class="option-score">#${escapeHtml(option.code)} ${option.rawScore.toFixed(1)}</span>
      <span class="option-meta">${escapeHtml(option.label)} / ${escapeHtml(replacementText(option))}</span>
    </li>
  `;
}

function renderPlanner() {
  const grid = $("plannerGrid");
  const summary = $("plannerSummary");
  if (!grid || !summary) return;

  if (!state.team.length) {
    summary.innerHTML = "";
    grid.innerHTML = `<div class="detail-empty">採用チームに選手を入れると、チーム案を作れます</div>`;
    return;
  }

  const { formation, assignments } = buildTeamPlan();
  const filled = assignments.filter((item) => item.player).length;
  const average = filled
    ? assignments.filter((item) => item.player).reduce((sum, item) => sum + item.rawScore, 0) / filled
    : 0;
  const mainLike = assignments.filter((item) => item.player && ["主", "熟達", "達者", "能力あり"].includes(item.label)).length;

  summary.innerHTML = `
    <div><span>形</span><strong>${escapeHtml(formation.label)}</strong></div>
    <div><span>性格</span><strong>${escapeHtml(formation.trait)}</strong></div>
    <div><span>平均適性</span><strong>${average.toFixed(1)}</strong></div>
    <div><span>主力級配置</span><strong>${mainLike}/${formation.slots.length}</strong></div>
    <div><span>OP</span><strong>${escapeHtml(formation.op.map((code) => `#${code}`).join(" "))}</strong></div>
  `;

  grid.innerHTML = assignments
    .map((item) => {
      const position = slotGridPosition(item.slot.key);
      const gridStyle = ` style="grid-row:${position.row};grid-column:${position.col};"`;
      const roleText = item.slot.candidates.map((candidate) => `#${candidate.code}:${candidate.kind}`).join(" ");
      if (!item.player || !item.options?.length) {
        return `
          <div class="planner-card is-empty"${gridStyle}>
            <span class="slot">${escapeHtml(item.slot.label)}</span>
            <strong>未配置</strong>
            <span class="meta">候補: ${escapeHtml(item.slot.candidates.map((candidate) => `#${candidate.code}`).join(", "))}</span>
          </div>
        `;
      }
      const player = item.player;
      return `
        <div class="planner-card"${gridStyle}>
          <div class="planner-card-head">
            <span class="slot">${escapeHtml(item.slot.label)}</span>
            <span class="rating">#${escapeHtml(item.code)} ${item.rawScore.toFixed(1)}</span>
          </div>
          <strong>${escapeHtml(player.fullName)}</strong>
          <span class="meta">${escapeHtml(player.gender)} / ${player.age}歳 / ${escapeHtml(player.nationality)} / 本職 ${escapeHtml(player.bestPosition)}</span>
          <span class="meta">${escapeHtml(item.label)} / ${item.multiplier}% / ${escapeHtml(replacementText(item))}</span>
          <ol class="planner-options">
            ${item.options.map(renderPlannerOption).join("")}
          </ol>
          <span class="candidate-codes">${escapeHtml(roleText)}</span>
        </div>
      `;
    })
    .join("");
}

function applyFilter() {
  const term = $("filterInput").value.trim().toLowerCase();
  state.filtered = term
    ? state.players.filter((player) =>
        [player.fullName, player.gender, player.nationality, player.bestPosition, player.roleType, player.topStats]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : [...state.players];
  renderTable();
  renderPlanner();
}

function generate() {
  const data = state.data;
  const count = clamp(Number($("countInput").value) || 1, 1, 200);
  $("countInput").value = String(count);
  const strengthAdjust = readGenerationStrengthAdjust();
  const target = applyGenerationStrength();
  if (!state.booting) state.generationRun += 1;
  const seed = hashSeed(
    `${$("seedInput").value}|${$("groupSelect").value}|${count}|${$("secretInput").checked}|${strengthAdjust}|${state.generationRun}|fifa-overall-v1`,
  );
  const rng = mulberry32(seed);
  state.players = Array.from({ length: count }, (_, index) =>
    buildPlayer(index, data, rng, $("groupSelect").value, $("secretInput").checked, target),
  );
  state.selectedNo = state.players[0]?.no ?? null;
  renderSummary();
  applyFilter();
  renderDetail();
  renderPlanner();
}

function generateTargeted() {
  const data = state.data;
  const count = clamp(Number($("countInput").value) || 1, 1, 200);
  $("countInput").value = String(count);
  state.generationRun += 1;
  const strengthAdjust = readGenerationStrengthAdjust();
  const target = applyGenerationStrength(readTargetOptions());
  const targetSignature = Object.values(target).join("|");
  const seed = hashSeed(
    `${$("seedInput").value}|${$("groupSelect").value}|${count}|${$("secretInput").checked}|${strengthAdjust}|${state.generationRun}|targeted-fifa-v1|${targetSignature}`,
  );
  const rng = mulberry32(seed);
  state.players = Array.from({ length: count }, (_, index) =>
    buildPlayer(index, data, rng, $("groupSelect").value, $("secretInput").checked, target),
  );
  state.selectedNo = state.players[0]?.no ?? null;
  renderSummary();
  applyFilter();
  renderDetail();
  renderPlanner();
}

function applyGeneratedTeamToRoster(players, options) {
  if (options.outputMode === "candidates") return { changed: false, added: 0 };
  const clones = players.slice(0, 20).map(cloneForTeam);
  if (options.outputMode === "replace") {
    state.team = clones;
    state.selectedTeamId = state.team[0]?.teamId || null;
    state.editingMode = state.selectedTeamId ? "edit" : "none";
    saveTeam();
    return { changed: true, added: state.team.length };
  }

  const room = Math.max(0, 20 - state.team.length);
  const addedPlayers = clones.slice(0, room);
  state.team.push(...addedPlayers);
  state.selectedTeamId = addedPlayers.at(-1)?.teamId || state.selectedTeamId;
  state.editingMode = state.selectedTeamId ? "edit" : "none";
  saveTeam();
  return { changed: addedPlayers.length > 0, added: addedPlayers.length };
}

function renderTeamGenerationStatus(players, options, applyResult) {
  const status = $("teamGenerationStatus");
  if (!status) return;
  const profile = teamStrengthProfiles[options.strengthRank] || teamStrengthProfiles.middle;
  const average = players.length ? players.reduce((sum, player) => sum + player.rating, 0) / players.length : 0;
  const tierCounts = players.reduce((counts, player) => {
    counts[player.teamTier] = (counts[player.teamTier] || 0) + 1;
    return counts;
  }, {});
  const tierText = Object.entries(tierCounts)
    .map(([tier, count]) => `${tier}${count}`)
    .join(" / ");
  const outputText =
    options.outputMode === "replace"
      ? `採用チームを${applyResult.added}人で置換`
      : options.outputMode === "add"
        ? `採用チームへ${applyResult.added}人追加`
        : "候補一覧のみ";
  status.textContent = `${profile.label}${options.strengthAdjust >= 0 ? "+" : ""}${options.strengthAdjust} / 平均主適性 ${average.toFixed(1)} / ${tierText} / ${outputText}`;
}

function generateTeam() {
  const data = state.data;
  const options = readTeamGenerationOptions();
  state.generationRun += 1;
  const optionSignature = Object.values(options).join("|");
  const seed = hashSeed(
    `${$("seedInput").value}|${$("groupSelect").value}|${$("secretInput").checked}|${state.generationRun}|team-v1|${optionSignature}`,
  );
  const rng = mulberry32(seed);
  const players = buildGeneratedTeam(data, rng, $("groupSelect").value, $("secretInput").checked, options);
  const applyResult = applyGeneratedTeamToRoster(players, options);

  $("countInput").value = String(players.length);
  state.players = players;
  state.selectedNo = state.players[0]?.no ?? null;
  renderTeamGenerationStatus(players, options, applyResult);
  renderSummary();
  applyFilter();
  renderDetail();
  refreshTeamDependents();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function exportablePlayer(player) {
  const {
    homegrownSlot,
    originalTeamTier,
    teamTier,
    plannedPosition,
    teamTargetRating,
    ...exported
  } = player;
  return exported;
}

function exportJson() {
  download("touken-players.json", JSON.stringify(state.filtered.map(exportablePlayer), null, 2), "application/json;charset=utf-8");
}

function exportTeam() {
  download("touken-team.json", JSON.stringify(state.team.map(exportablePlayer), null, 2), "application/json;charset=utf-8");
}

async function boot() {
  if (window.TOUKEN_GENERATOR_DATA) {
    state.data = window.TOUKEN_GENERATOR_DATA;
  } else {
    const response = await fetch("./data/generator-data.json");
    state.data = await response.json();
  }
  renderGroups(state.data);
  loadTeam();
  $("generateButton").addEventListener("click", generate);
  $("targetGenerateButton").addEventListener("click", generateTargeted);
  $("teamGenerateButton").addEventListener("click", generateTeam);
  $("filterInput").addEventListener("input", applyFilter);
  $("jsonButton").addEventListener("click", exportJson);
  $("secretInput").addEventListener("change", generate);
  $("adoptSelectedButton").addEventListener("click", adoptSelectedPlayer);
  $("newManualButton").addEventListener("click", startManualEntry);
  $("importTeamButton").addEventListener("click", () => $("teamImportInput").click());
  $("teamImportInput").addEventListener("change", importTeamFile);
  $("exportTeamButton").addEventListener("click", exportTeam);
  $("clearTeamButton").addEventListener("click", () => {
    state.team = [];
    state.selectedTeamId = null;
    saveTeam();
    refreshTeamDependents();
  });
  $("playerEditor").addEventListener("submit", saveEditor);
  $("formationSelect").addEventListener("change", renderPlanner);
  $("statsInput").addEventListener("change", () => {
    renderTable();
    renderDetail();
  });
  generate();
  renderTeam();
  state.booting = false;
}

boot().catch((error) => {
  document.body.innerHTML = `<div class="empty">起動に失敗しました: ${escapeHtml(error.message)}</div>`;
});
