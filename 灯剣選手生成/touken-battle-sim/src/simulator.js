import { formationByKey, formations, positionLabels, slotCandidates, slotLane } from "./formations.js";
import { clamp, createRng, normalish, round, weightedPick } from "./random.js";

export const defaultMatchOptions = {
  seed: "touken-battle",
  homeFormation: "f313",
  awayFormation: "f313",
  homeTactic: "balanced",
  awayTactic: "balanced",
  sections: 3,
  minutesPerSection: 20,
  eventsPerMinute: 0.86,
  enableChangers: true,
  enableBenchSubstitutions: true,
  regularSubstitutionsPerBreak: 2,
  fatigueImpact: 1,
  homeCondition: "normal",
  awayCondition: "normal",
  adjustLineupByCondition: true,
  includePassEvents: false,
};

export const defaultLeagueOptions = {
  seed: "touken-league",
  name: "German League",
  format: "quadruple-round-robin",
  pointsForWin: 3,
  pointsForDraw: 1,
  clSlots: 4,
  includeMatchDetails: false,
  enableSeasonFatigue: true,
  winterBreakRound: 30,
};

export const conditionLevels = {
  excellent: { label: "絶好調", mean: 4.8, spread: 2.2 },
  good: { label: "好調", mean: 2.4, spread: 2 },
  normal: { label: "普通", mean: 0, spread: 2.4 },
  poor: { label: "不調", mean: -2.7, spread: 2.1 },
  awful: { label: "絶不調", mean: -5.2, spread: 2.1 },
};

const conditionAliases = {
  excellent: "excellent",
  "絶好調": "excellent",
  great: "excellent",
  good: "good",
  "好調": "good",
  normal: "normal",
  "普通": "normal",
  average: "normal",
  poor: "poor",
  "不調": "poor",
  bad: "poor",
  awful: "awful",
  "絶不調": "awful",
  terrible: "awful",
};

export const tactics = {
  balanced: {
    label: "Balanced",
    attack: 1,
    defense: 1,
    flow: 1,
    retention: 1,
    emission: 1,
    steal: 1,
    interception: 1,
    tempo: 1,
    risk: 1,
    staminaCost: 1,
  },
  press: {
    label: "Steal Press",
    attack: 1.01,
    defense: 1.03,
    flow: 1.01,
    retention: 0.98,
    emission: 1,
    steal: 1.1,
    interception: 1.05,
    tempo: 1.13,
    risk: 1.12,
    staminaCost: 1.18,
  },
  counter: {
    label: "Counter",
    attack: 1.04,
    defense: 1.02,
    flow: 0.94,
    retention: 0.98,
    emission: 1.04,
    steal: 1.03,
    interception: 1.06,
    tempo: 1.05,
    risk: 0.97,
    staminaCost: 0.98,
  },
  possession: {
    label: "Luminous Keep",
    attack: 0.97,
    defense: 1,
    flow: 1.12,
    retention: 1.1,
    emission: 0.97,
    steal: 0.96,
    interception: 1,
    tempo: 0.9,
    risk: 0.88,
    staminaCost: 0.96,
  },
  direct: {
    label: "Direct Emission",
    attack: 1.06,
    defense: 0.96,
    flow: 0.94,
    retention: 0.96,
    emission: 1.09,
    steal: 0.98,
    interception: 0.96,
    tempo: 1.11,
    risk: 1.13,
    staminaCost: 1.05,
  },
  defensive: {
    label: "Defensive Block",
    attack: 0.9,
    defense: 1.09,
    flow: 0.97,
    retention: 1.02,
    emission: 0.93,
    steal: 1.06,
    interception: 1.11,
    tempo: 0.86,
    risk: 0.82,
    staminaCost: 0.93,
  },
};

const formationTraits = {
  f313: { attack: 1, defense: 1, flow: 1, retention: 1, steal: 1, interception: 1, tempo: 1, staminaCost: 1 },
  f223: { attack: 1.04, defense: 0.96, flow: 1.07, retention: 1.04, steal: 0.98, interception: 0.98, tempo: 1.03, staminaCost: 1.02 },
  f232: { attack: 0.98, defense: 1.03, flow: 1.08, retention: 1.06, steal: 1.03, interception: 1.04, tempo: 0.98, staminaCost: 1.01 },
  f331: { attack: 0.92, defense: 1.09, flow: 1.06, retention: 1.04, steal: 1.08, interception: 1.08, tempo: 0.91, staminaCost: 0.98 },
  f241: { attack: 0.88, defense: 0.97, flow: 1.15, retention: 1.13, steal: 0.96, interception: 0.97, tempo: 0.88, staminaCost: 1.04 },
  f322: { attack: 0.99, defense: 1.01, flow: 1.01, retention: 1.01, steal: 1, interception: 1, tempo: 1, staminaCost: 1 },
  f421: { attack: 0.9, defense: 1.14, flow: 0.92, retention: 0.97, steal: 1.09, interception: 1.13, tempo: 0.91, staminaCost: 1.1 },
  f412: { attack: 0.99, defense: 1.09, flow: 0.91, retention: 0.96, steal: 1.06, interception: 1.08, tempo: 0.98, staminaCost: 1.06 },
};

export const generatorStatNames = [
  "スピード",
  "加速",
  "ジャンプ",
  "スタミナ",
  "アジリティ",
  "バランス",
  "テクニック",
  "ショット",
  "パス",
  "シュート",
  "ロングシュート",
  "キャリー",
  "クロス",
  "ファーストタッチ",
  "スラッシュ",
  "マーキング",
  "剣さばき",
  "ポジショニング",
  "チームワーク",
  "リーダーシップ",
  "ひらめき",
  "視野",
  "集中力",
  "運動量",
  "勝利意欲",
  "積極性",
  "予測力",
  "判断力",
  "勇敢さ",
  "冷静さ",
];

const statFacets = {
  speed: ["スピード", "speed"],
  acceleration: ["加速", "acceleration"],
  jump: ["ジャンプ", "jump"],
  stamina: ["スタミナ", "stamina"],
  agility: ["アジリティ", "agility"],
  balance: ["バランス", "balance"],
  technique: ["テクニック", "technique"],
  shotTouch: ["ショット", "shot"],
  passing: ["パス", "pass", "passing"],
  shooting: ["シュート", "shoot", "shooting"],
  longShooting: ["ロングシュート", "longShot", "longShooting"],
  carry: ["キャリー", "carry"],
  cross: ["クロス", "cross"],
  firstTouch: ["ファーストタッチ", "firstTouch", "first_touch"],
  slash: ["スラッシュ", "slash"],
  blade: ["剣さばき", "blade", "swordplay"],
  marking: ["マーキング", "marking"],
  positioning: ["ポジショニング", "positioning"],
  teamwork: ["チームワーク", "teamwork"],
  leadership: ["リーダーシップ", "leadership"],
  flair: ["ひらめき", "flair"],
  vision: ["視野", "vision"],
  focus: ["集中力", "focus"],
  workRate: ["運動量", "workRate", "work_rate"],
  desire: ["勝利意欲", "desire", "willToWin"],
  aggression: ["積極性", "aggression"],
  anticipation: ["予測力", "anticipation"],
  decision: ["判断力", "decision"],
  bravery: ["勇敢さ", "bravery"],
  composure: ["冷静さ", "composure"],
};

const simulationFacetMap = {
  physicalBurst: ["speed", "acceleration", "agility"],
  aerialReach: ["jump", "balance", "bravery"],
  endurance: ["stamina", "workRate", "desire"],
  bodyControl: ["agility", "balance", "firstTouch"],
  swordControl: ["technique", "blade", "firstTouch"],
  emissionPower: ["shotTouch", "shooting", "longShooting", "cross", "slash"],
  passCraft: ["passing", "cross", "firstTouch", "vision", "decision"],
  carryCraft: ["carry", "agility", "balance", "technique"],
  finishingSkill: ["shotTouch", "shooting", "longShooting", "composure", "bravery"],
  stealSkill: ["slash", "blade", "aggression", "bravery"],
  markSkill: ["marking", "positioning", "anticipation", "focus"],
  interceptRead: ["positioning", "anticipation", "decision", "focus", "vision"],
  teamFlow: ["teamwork", "leadership", "vision", "decision"],
  creativity: ["flair", "vision", "technique", "composure"],
  mentalEdge: ["focus", "desire", "aggression", "bravery", "composure"],
};

const statAliases = {
  physical: [
    "speed",
    "acceleration",
    "jump",
    "stamina",
    "agility",
    "balance",
    "workRate",
    "スピード",
    "加速",
    "ジャンプ",
    "スタミナ",
    "アジリティ",
    "バランス",
    "運動量",
    "繧ｹ繝斐・繝・",
    "蜉騾・",
    "繧ｸ繝｣繝ｳ繝・",
    "繧ｹ繧ｿ繝溘リ",
    "繧｢繧ｸ繝ｪ繝・ぅ",
    "繝舌Λ繝ｳ繧ｹ",
    "驕句虚驥・",
  ],
  technique: [
    "technique",
    "shot",
    "pass",
    "shoot",
    "longShot",
    "carry",
    "cross",
    "firstTouch",
    "slash",
    "blade",
    "テクニック",
    "ショット",
    "パス",
    "シュート",
    "ロングシュート",
    "キャリー",
    "クロス",
    "ファーストタッチ",
    "スラッシュ",
    "剣さばき",
    "繝・け繝九ャ繧ｯ",
    "繧ｷ繝ｧ繝・ヨ",
    "繝代せ",
    "繧ｷ繝･繝ｼ繝・",
    "繝ｭ繝ｳ繧ｰ繧ｷ繝･繝ｼ繝・",
    "繧ｭ繝｣繝ｪ繝ｼ",
    "繧ｯ繝ｭ繧ｹ",
    "繝輔ぃ繝ｼ繧ｹ繝医ち繝・メ",
    "繧ｹ繝ｩ繝・す繝･",
    "蜑｣縺輔・縺・",
  ],
  emission: [
    "shot",
    "shoot",
    "longShot",
    "pass",
    "cross",
    "slash",
    "power",
    "シュート",
    "ロングシュート",
    "パス",
    "クロス",
    "スラッシュ",
    "剣さばき",
    "筋力",
    "繧ｷ繝･繝ｼ繝・",
    "繝ｭ繝ｳ繧ｰ繧ｷ繝･繝ｼ繝・",
    "繝代せ",
    "繧ｯ繝ｭ繧ｹ",
    "繧ｹ繝ｩ繝・す繝･",
    "蜑｣縺輔・縺・",
  ],
  attack: [
    "shot",
    "shoot",
    "longShot",
    "carry",
    "cross",
    "slash",
    "flair",
    "vision",
    "シュート",
    "ロングシュート",
    "キャリー",
    "クロス",
    "スラッシュ",
    "ひらめき",
    "視野",
    "繧ｷ繝ｧ繝・ヨ",
    "繧ｷ繝･繝ｼ繝・",
    "繝ｭ繝ｳ繧ｰ繧ｷ繝･繝ｼ繝・",
    "繧ｭ繝｣繝ｪ繝ｼ",
    "繧ｯ繝ｭ繧ｹ",
    "繧ｹ繝ｩ繝・す繝･",
    "縺ｲ繧峨ａ縺・",
    "隕夜㍽",
  ],
  defense: [
    "marking",
    "blade",
    "positioning",
    "anticipation",
    "decision",
    "composure",
    "マーキング",
    "剣さばき",
    "ポジショニング",
    "予測力",
    "判断力",
    "冷静さ",
    "繝槭・繧ｭ繝ｳ繧ｰ",
    "蜑｣縺輔・縺・",
    "繝昴ず繧ｷ繝ｧ繝九Φ繧ｰ",
    "莠域ｸｬ蜉・",
    "蛻､譁ｭ蜉・",
    "蜀ｷ髱吶＆",
  ],
  mental: [
    "positioning",
    "teamwork",
    "leadership",
    "flair",
    "vision",
    "focus",
    "desire",
    "aggression",
    "anticipation",
    "decision",
    "composure",
    "ポジショニング",
    "チームワーク",
    "リーダーシップ",
    "ひらめき",
    "視野",
    "集中力",
    "勝利意欲",
    "積極性",
    "予測力",
    "判断力",
    "冷静さ",
    "繝昴ず繧ｷ繝ｧ繝九Φ繧ｰ",
    "繝√・繝繝ｯ繝ｼ繧ｯ",
    "繝ｪ繝ｼ繝繝ｼ繧ｷ繝・・",
    "縺ｲ繧峨ａ縺・",
    "隕夜㍽",
    "髮・ｸｭ蜉・",
    "蜍晏茜諢乗ｬｲ",
    "遨肴･ｵ諤ｧ",
    "莠域ｸｬ蜉・",
    "蛻､譁ｭ蜉・",
    "蜀ｷ髱吶＆",
  ],
};

function numeric(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function average(values, fallback = 0) {
  const prepared = values.map(Number).filter(Number.isFinite);
  if (!prepared.length) return fallback;
  return prepared.reduce((sum, value) => sum + value, 0) / prepared.length;
}

function maxRating(positionRatings) {
  return Math.max(0, ...Object.values(positionRatings).map((value) => numeric(value)));
}

function conditionLevelKey(value = "normal") {
  return conditionAliases[String(value)] || "normal";
}

function conditionKeyFromDelta(delta) {
  if (delta >= 5.5) return "excellent";
  if (delta >= 1.75) return "good";
  if (delta > -1.75) return "normal";
  if (delta > -5.5) return "poor";
  return "awful";
}

function explicitConditionDelta(player) {
  for (const key of ["conditionDelta", "formDelta", "conditionScore", "formScore"]) {
    const value = Number(player[key]);
    if (Number.isFinite(value)) return clamp(value, -10, 10);
  }

  const raw = player.condition || player.form || player.調子;
  if (raw) {
    const key = conditionLevelKey(raw);
    return conditionLevels[key].mean;
  }

  return NaN;
}

function playerConditionDelta(player) {
  return numeric(player.conditionDelta, 0);
}

function effectiveRating(player) {
  return clamp(numeric(player.rating, 50) + playerConditionDelta(player) * 0.82, 0, 105);
}

function withPlayerCondition(player, rng, teamConditionKey = "normal") {
  const explicit = explicitConditionDelta(player);
  const profile = conditionLevels[conditionLevelKey(teamConditionKey)] || conditionLevels.normal;
  const delta = Number.isFinite(explicit)
    ? explicit
    : clamp(profile.mean + normalish(rng) * profile.spread, -10, 10);
  const conditionKey = conditionKeyFromDelta(delta);

  return {
    ...player,
    conditionKey,
    conditionLabel: conditionLevels[conditionKey].label,
    conditionDelta: round(delta, 2),
  };
}

function prepareConditionedTeam(teamLike, options = {}) {
  const team = normalizeTeam(teamLike, options.name || "Team");
  const rng = createRng(`${options.seed || defaultMatchOptions.seed}:condition:${options.side || team.name}`);

  return {
    ...team,
    players: team.players.map((player) => withPlayerCondition(player, rng, options.condition || "normal")),
  };
}

export function normalizePlayer(player, index = 0) {
  const positionRatings = Object.fromEntries(
    Object.entries(player.positionRatings || {}).map(([code, value]) => [String(code), numeric(value)]),
  );
  const rating = numeric(player.rating, maxRating(positionRatings));
  const bestPosition = String(player.bestPosition || Object.entries(positionRatings).sort((a, b) => b[1] - a[1])[0]?.[0] || "");
  const stats = Object.fromEntries(Object.entries(player.stats || {}).map(([key, value]) => [key, numeric(value)]));
  const name = player.fullName || player.name || [player.surname, player.givenName].filter(Boolean).join(" ") || `Player ${index + 1}`;

  if (bestPosition && !positionRatings[bestPosition]) {
    positionRatings[bestPosition] = rating;
  }

  return {
    ...player,
    id: String(player.teamId || player.id || player.no || `${name}-${index}`),
    name,
    fullName: name,
    bestPosition,
    rating,
    positionRatings,
    stats,
  };
}

export function normalizeTeam(teamLike, fallbackName = "Team") {
  const players = Array.isArray(teamLike) ? teamLike : teamLike.players || teamLike.roster;

  if (!Array.isArray(players)) {
    throw new Error(`${fallbackName} must be an array or an object with players.`);
  }

  return {
    name: teamLike.name || teamLike.teamName || fallbackName,
    players: players.map(normalizePlayer),
  };
}

function ratingForPosition(player, code) {
  return numeric(player.positionRatings[String(code)], code === player.bestPosition ? player.rating : 0);
}

function bestCandidateForSlot(player, slot) {
  return slot.candidates
    .map((candidate) => {
      const rawScore = ratingForPosition(player, candidate.code);
      return {
        ...candidate,
        rawScore,
        score: rawScore * candidate.priority + effectiveRating(player) * 0.04,
      };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function buildLineupInternal(teamLike, formationKey = "f313", fallbackName = "Team", options = {}) {
  const team = normalizeTeam(teamLike, fallbackName);
  const formation = formationByKey(formationKey);
  const preferredIds = new Set((options.preferredIds || []).map(String));
  const forcedIds = new Set((options.forcedIds || []).map(String));
  const selectionBias = options.selectionBias || (() => 0);
  const conditionLineupWeight = options.adjustLineupByCondition === false ? 0 : numeric(options.conditionLineupWeight, 1.35);
  const preparedSlots = formation.slots.map((slot) => ({
    ...slot,
    lane: slotLane(slot),
    candidates: slotCandidates(slot, formation),
  }));
  const used = new Set();
  const bySlot = new Map();
  const planningOrder = [...preparedSlots].sort((a, b) => a.candidates.length - b.candidates.length);

  for (const slot of planningOrder) {
    const selected = team.players
      .filter((player) => !used.has(player.id))
      .map((player) => ({ player, candidate: bestCandidateForSlot(player, slot) }))
      .filter((entry) => entry.candidate)
      .map((entry) => ({
        ...entry,
        selectionScore:
          entry.candidate.score +
          (preferredIds.has(entry.player.id) ? 6 : 0) +
          (forcedIds.has(entry.player.id) ? 1000 : 0) +
          playerConditionDelta(entry.player) * conditionLineupWeight +
          selectionBias(entry.player, slot, entry.candidate),
      }))
      .sort((a, b) => b.selectionScore - a.selectionScore)[0];

    if (!selected) {
      bySlot.set(slot.key, { slot, player: null, code: slot.allowed[0], rawScore: 0, score: 0 });
      continue;
    }

    used.add(selected.player.id);
    bySlot.set(slot.key, {
      slot,
      player: selected.player,
      code: selected.candidate.code,
      kind: selected.candidate.kind,
      replacementFor: selected.candidate.replacementFor,
      rawScore: selected.candidate.rawScore,
      score: selected.candidate.score,
    });
  }

  const assignments = preparedSlots.map((slot) => bySlot.get(slot.key));

  return {
    team,
    formation: {
      key: formation.key,
      label: formation.label,
    },
    assignments,
  };
}

export function buildLineup(teamLike, formationKey = "f313", fallbackName = "Team") {
  return buildLineupInternal(teamLike, formationKey, fallbackName);
}

function statAverage(player, bucket) {
  const values = statAliases[bucket]
    .map((alias) => normalizeStatScore(player.stats[alias]))
    .filter((value) => Number.isFinite(value));

  if (values.length) return average(values);
  return effectiveRating(player);
}

function teamStatAverage(players, bucket) {
  return average(players.map((player) => statAverage(player, bucket)), 50);
}

function normalizeStatScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  return number <= 35 ? clamp((number / 30) * 100, 0, 100) : number;
}

function statFacetValue(player, facet) {
  const aliases = statFacets[facet] || [facet];
  const values = aliases.map((alias) => normalizeStatScore(player.stats[alias])).filter((value) => Number.isFinite(value));
  return values.length ? average(values) : NaN;
}

function playerFacet(player, facetName) {
  const facets = simulationFacetMap[facetName] || [facetName];
  const values = facets.map((facet) => statFacetValue(player, facet)).filter(Number.isFinite);
  const base = values.length ? average(values) : effectiveRating(player);
  return clamp(base + playerConditionDelta(player) * 0.54, 0, 110);
}

function teamFacetAverage(players, facetName) {
  return average(players.map((player) => playerFacet(player, facetName)), 50);
}

export function statUsageCoverage() {
  const used = new Set();

  for (const facet of Object.values(simulationFacetMap).flat()) {
    for (const alias of statFacets[facet] || []) {
      if (generatorStatNames.includes(alias)) used.add(alias);
    }
  }

  return {
    total: generatorStatNames.length,
    used: generatorStatNames.filter((name) => used.has(name)),
    missing: generatorStatNames.filter((name) => !used.has(name)),
  };
}

function assignmentAverage(assignments, lane, fallback = 50) {
  return average(
    assignments
      .filter((assignment) => assignment.slot.lane === lane)
      .map((assignment) => assignment.rawScore || assignment.player?.rating || 0),
    fallback,
  );
}

function topRatingForCodes(players, codes, count = 3) {
  const ratings = players
    .map((player) => Math.max(...codes.map((code) => ratingForPosition(player, code))))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, count);

  return average(ratings, 50);
}

function benchDepth(players, starters) {
  const starterIds = new Set(starters.filter(Boolean).map((player) => player.id));
  const bench = players.filter((player) => !starterIds.has(player.id));
  const bestBench = bench.map((player) => effectiveRating(player)).sort((a, b) => b - a).slice(0, 5);
  return average(bestBench, average(players.map((player) => effectiveRating(player)), 50));
}

function genderBalance(players) {
  const known = players.filter((player) => ["男", "女", "male", "female", "M", "F"].includes(String(player.gender || "")));
  if (!known.length) return 1;
  const female = known.filter((player) => ["女", "female", "F"].includes(String(player.gender))).length;
  const ratio = female / known.length;
  return clamp(1.02 - Math.abs(ratio - 0.5) * 0.08, 0.97, 1.02);
}

function withFormationTrait(profile, formationKey) {
  const trait = {
    attack: 1,
    defense: 1,
    flow: 1,
    retention: 1,
    emission: 1,
    steal: 1,
    interception: 1,
    tempo: 1,
    staminaCost: 1,
    ...(formationTraits[formationKey] || formationTraits.f313),
  };

  return {
    ...profile,
    attack: profile.attack * trait.attack,
    defense: profile.defense * trait.defense,
    control: profile.control * trait.flow,
    flow: profile.flow * trait.flow,
    retention: profile.retention * trait.retention,
    emission: profile.emission * trait.emission,
    steal: profile.steal * trait.steal,
    interception: profile.interception * trait.interception,
    tempo: profile.tempo * trait.tempo,
    staminaCost: profile.staminaCost * trait.staminaCost,
  };
}

function profileForLineup(lineup) {
  const { team, assignments } = lineup;
  const starters = assignments.map((assignment) => assignment.player).filter(Boolean);
  const front = assignmentAverage(assignments, "front");
  const midfield = assignmentAverage(assignments, "midfield");
  const back = assignmentAverage(assignments, "back");
  const starterAverage = average(starters.map((player) => effectiveRating(player)), 50);
  const depth = benchDepth(team.players, starters);
  const physicalBurst = teamFacetAverage(starters, "physicalBurst");
  const aerialReach = teamFacetAverage(starters, "aerialReach");
  const endurance = teamFacetAverage(starters, "endurance");
  const bodyControl = teamFacetAverage(starters, "bodyControl");
  const swordControl = teamFacetAverage(starters, "swordControl");
  const emissionPower = teamFacetAverage(starters, "emissionPower");
  const passCraft = teamFacetAverage(starters, "passCraft");
  const carryCraft = teamFacetAverage(starters, "carryCraft");
  const finishingSkill = teamFacetAverage(starters, "finishingSkill");
  const stealSkill = teamFacetAverage(starters, "stealSkill");
  const markSkill = teamFacetAverage(starters, "markSkill");
  const interceptRead = teamFacetAverage(starters, "interceptRead");
  const teamFlow = teamFacetAverage(starters, "teamFlow");
  const creativity = teamFacetAverage(starters, "creativity");
  const mentalEdge = teamFacetAverage(starters, "mentalEdge");
  const topFinishing = topRatingForCodes(starters, ["7", "17", "5", "6", "15", "16", "10"], 3);
  const topShield = topRatingForCodes(starters, ["1", "2", "3", "11", "14", "12", "13"], 4);
  const fit = average(assignments.map((assignment) => assignment.rawScore), starterAverage);
  const cohesion = clamp((0.94 + (teamFlow - 60) / 340 + (mentalEdge - 60) / 520 + Math.min(starters.length, 7) * 0.006) * genderBalance(starters), 0.9, 1.1);
  const baseTempo = (starterAverage * 0.25 + physicalBurst * 0.2 + passCraft * 0.18 + teamFlow * 0.17 + endurance * 0.1 + fit * 0.1) * cohesion;
  const rawProfile = {
    overall: round((starterAverage * 0.46 + fit * 0.16 + depth * 0.1 + teamFlow * 0.1 + mentalEdge * 0.1 + swordControl * 0.08) * cohesion, 2),
    attack: round((front * 0.31 + midfield * 0.13 + topFinishing * 0.16 + emissionPower * 0.14 + finishingSkill * 0.13 + creativity * 0.07 + carryCraft * 0.06) * cohesion, 2),
    defense: round((back * 0.3 + midfield * 0.12 + topShield * 0.16 + markSkill * 0.16 + interceptRead * 0.12 + stealSkill * 0.08 + teamFlow * 0.06) * cohesion, 2),
    control: round((midfield * 0.29 + back * 0.1 + passCraft * 0.17 + teamFlow * 0.16 + swordControl * 0.11 + carryCraft * 0.07 + fit * 0.1) * cohesion, 2),
    flow: round((midfield * 0.3 + passCraft * 0.19 + teamFlow * 0.18 + creativity * 0.12 + fit * 0.11 + depth * 0.1) * cohesion, 2),
    retention: round((swordControl * 0.19 + bodyControl * 0.18 + carryCraft * 0.15 + mentalEdge * 0.13 + fit * 0.15 + midfield * 0.12 + front * 0.08) * cohesion, 2),
    emission: round((emissionPower * 0.26 + swordControl * 0.13 + physicalBurst * 0.13 + front * 0.15 + passCraft * 0.11 + topFinishing * 0.12 + creativity * 0.1) * cohesion, 2),
    steal: round((stealSkill * 0.24 + markSkill * 0.17 + physicalBurst * 0.13 + back * 0.18 + midfield * 0.1 + mentalEdge * 0.18) * cohesion, 2),
    interception: round((interceptRead * 0.25 + markSkill * 0.18 + aerialReach * 0.09 + back * 0.18 + midfield * 0.12 + swordControl * 0.08 + topShield * 0.1) * cohesion, 2),
    finishing: round((finishingSkill * 0.29 + topFinishing * 0.27 + emissionPower * 0.18 + creativity * 0.08 + front * 0.12 + physicalBurst * 0.06) * cohesion, 2),
    stamina: round(endurance * 0.62 + mentalEdge * 0.16 + depth * 0.14 + physicalBurst * 0.08, 2),
    depth: round(depth, 2),
    cohesion: round(cohesion, 3),
    starterFit: round(fit, 2),
    tempo: round(baseTempo, 2),
    staminaCost: 1,
  };

  return withFormationTrait(rawProfile, lineup.formation.key);
}

function ratedFromLineup(lineup, name = lineup.team.name) {
  return {
    name,
    lineup,
    profile: profileForLineup(lineup),
  };
}

export function rateTeam(teamLike, options = {}) {
  const formationKey = options.formation || "f313";
  const lineup = buildLineupInternal(teamLike, formationKey, options.name || "Team", {
    adjustLineupByCondition: options.adjustLineupByCondition,
  });
  return ratedFromLineup(lineup, lineup.team.name);
}

function applyTactic(profile, tacticKey) {
  const tactic = tactics[tacticKey] || tactics.balanced;

  return {
    ...profile,
    tactic: tacticKey in tactics ? tacticKey : "balanced",
    tacticLabel: tactic.label,
    attack: profile.attack * tactic.attack,
    defense: profile.defense * tactic.defense,
    control: profile.control * tactic.flow,
    flow: profile.flow * tactic.flow,
    retention: profile.retention * tactic.retention,
    emission: profile.emission * tactic.emission,
    steal: profile.steal * tactic.steal,
    interception: profile.interception * tactic.interception,
    finishing: profile.finishing * tactic.attack * tactic.emission,
    tempo: profile.tempo * tactic.tempo,
    risk: tactic.risk,
    staminaCost: profile.staminaCost * tactic.staminaCost,
  };
}

function recordActiveMinutes(lineup, usage, minutes) {
  if (!lineup || !usage || minutes <= 0) return;
  for (const assignment of lineup.assignments) {
    const id = assignment.player?.id;
    if (!id) continue;
    usage.set(id, (usage.get(id) || 0) + minutes);
  }
}

function recordActiveUntil(matchState, side, usage, activeSinceMinute, minute) {
  const elapsed = Math.max(0, minute - activeSinceMinute[side]);
  if (elapsed > 0) {
    recordActiveMinutes(matchState[side].rated.lineup, usage[side], elapsed);
  }
  activeSinceMinute[side] = minute;
}

function playerFatiguePenalty(player, minutes, settings) {
  if (!player || !settings.fatigueImpact) return 0;
  const total = Math.max(1, Number(settings.sections) * Number(settings.minutesPerSection));
  const playedShare = clamp(minutes / total, 0, 1.25);
  const extraLoad = clamp((minutes - settings.minutesPerSection) / total, 0, 1);
  const stamina = playerFacet(player, "endurance");
  const staminaWeakness = clamp((74 - stamina) / 44, -0.3, 1.15);
  const penalty = (playedShare * playedShare * 5.2 + extraLoad * 4.1) * (0.86 + staminaWeakness * 0.68);
  return clamp(penalty * Number(settings.fatigueImpact || 1), 0, 9.5);
}

function lineupFatiguePenalty(lineup, usage, minute, activeSinceMinute, settings) {
  if (!lineup || !usage || !settings.fatigueImpact) return 0;
  const currentSectionMinutes = clamp(minute - activeSinceMinute, 0, settings.minutesPerSection);
  const penalties = lineup.assignments
    .map((assignment) => {
      const player = assignment.player;
      if (!player) return NaN;
      return playerFatiguePenalty(player, (usage.get(player.id) || 0) + currentSectionMinutes, settings);
    })
    .filter(Number.isFinite);

  return average(penalties, 0);
}

function effectiveProfile(profile, progress, runtime = null, settings = defaultMatchOptions) {
  const late = clamp((progress - 0.34) / 0.66, 0, 1);
  const staminaGap = clamp((72 - profile.stamina) / 42, -0.35, 1);
  const depthGap = clamp((66 - profile.depth) / 42, -0.25, 1);
  const baseFatigue = late * (staminaGap * 4.8 + depthGap * 2.6) * profile.staminaCost;
  const playerFatigue = runtime
    ? lineupFatiguePenalty(runtime.lineup, runtime.usage, runtime.minute, runtime.activeSinceMinute, settings) * profile.staminaCost
    : 0;
  const fatigue = baseFatigue + playerFatigue;

  return {
    ...profile,
    attack: profile.attack - fatigue * 0.72,
    defense: profile.defense - fatigue * 0.88,
    control: profile.control - fatigue * 0.7,
    flow: profile.flow - fatigue * 0.7,
    retention: profile.retention - fatigue * 0.78,
    emission: profile.emission - fatigue * 0.86,
    steal: profile.steal - fatigue * 0.72,
    interception: profile.interception - fatigue * 0.8,
    finishing: profile.finishing - fatigue * 0.82,
    tempo: profile.tempo - fatigue * 0.45,
  };
}

function chanceToControl(home, away, rng) {
  const homeScore = home.flow * 0.46 + home.retention * 0.22 + home.steal * 0.12 + home.interception * 0.12 + home.tempo * 0.08;
  const awayScore = away.flow * 0.46 + away.retention * 0.22 + away.steal * 0.12 + away.interception * 0.12 + away.tempo * 0.08;
  return clamp(homeScore / (homeScore + awayScore) + normalish(rng) * 0.012, 0.28, 0.72);
}

function duelStealChance(attacker, defender, carrier, challenger, rng) {
  const carrierRetention =
    playerFacet(carrier, "swordControl") * 0.25 +
    playerFacet(carrier, "bodyControl") * 0.2 +
    playerFacet(carrier, "carryCraft") * 0.18 +
    playerFacet(carrier, "mentalEdge") * 0.12 +
    effectiveRating(carrier) * 0.25;
  const challengerSteal =
    playerFacet(challenger, "stealSkill") * 0.31 +
    playerFacet(challenger, "markSkill") * 0.19 +
    playerFacet(challenger, "physicalBurst") * 0.16 +
    playerFacet(challenger, "mentalEdge") * 0.12 +
    effectiveRating(challenger) * 0.22;
  const edge = (defender.steal + challengerSteal * 0.26) - (attacker.retention + carrierRetention * 0.24);
  return clamp(0.19 + edge / 260 + (defender.risk - 1) * 0.04 + normalish(rng) * 0.018, 0.04, 0.55);
}

function passInterceptionChance(attacker, defender, passer, receiver, interceptor, rng) {
  const emission =
    playerFacet(passer, "passCraft") * 0.31 +
    playerFacet(passer, "emissionPower") * 0.16 +
    playerFacet(passer, "teamFlow") * 0.11 +
    effectiveRating(passer) * 0.14 +
    attacker.flow * 0.28;
  const receive =
    playerFacet(receiver, "swordControl") * 0.24 +
    playerFacet(receiver, "bodyControl") * 0.18 +
    playerFacet(receiver, "interceptRead") * 0.1 +
    playerFacet(receiver, "mentalEdge") * 0.12 +
    effectiveRating(receiver) * 0.36;
  const defense =
    playerFacet(interceptor, "interceptRead") * 0.3 +
    playerFacet(interceptor, "markSkill") * 0.18 +
    playerFacet(interceptor, "aerialReach") * 0.12 +
    playerFacet(interceptor, "mentalEdge") * 0.12 +
    effectiveRating(interceptor) * 0.28;
  const edge = (defender.interception + defense * 0.22) - (emission * 0.13 + receive * 0.11 + attacker.flow);
  return clamp(0.14 + edge / 250 + (attacker.risk - 1) * 0.045 + normalish(rng) * 0.016, 0.03, 0.48);
}

function shotQuality(attacker, defender, shooter, rng) {
  const shooterEmission =
    playerFacet(shooter, "finishingSkill") * 0.3 +
    playerFacet(shooter, "emissionPower") * 0.24 +
    playerFacet(shooter, "creativity") * 0.12 +
    playerFacet(shooter, "mentalEdge") * 0.1 +
    effectiveRating(shooter) * 0.24;
  const attackEdge = (attacker.finishing + attacker.emission * 0.34 + shooterEmission * 0.3) - (defender.interception * 0.72 + defender.defense * 0.42);
  return clamp(0.092 + attackEdge / 405 + (attacker.risk - 1) * 0.035 + normalish(rng) * 0.026, 0.022, 0.39);
}

function shotBlockChance(attacker, defender, blocker, rng) {
  const blockSkill =
    playerFacet(blocker, "interceptRead") * 0.28 +
    playerFacet(blocker, "markSkill") * 0.2 +
    playerFacet(blocker, "aerialReach") * 0.13 +
    playerFacet(blocker, "mentalEdge") * 0.11 +
    effectiveRating(blocker) * 0.28;
  const edge = (defender.interception + blockSkill * 0.28) - (attacker.emission * 0.64 + attacker.finishing * 0.32);
  return clamp(0.3 + edge / 265 + normalish(rng) * 0.018, 0.1, 0.7);
}

function sideBox() {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    possessions: 0,
    possessionEvents: 0,
    passes: 0,
    completedPasses: 0,
    carries: 0,
    steals: 0,
    interceptions: 0,
    blocks: 0,
    luminousLosses: 0,
    conduitLoad: 0,
    fatigueImpact: 0,
  };
}

function blankPlayerStat(player) {
  return {
    id: player.id,
    name: player.fullName,
    goals: 0,
    assists: 0,
    shots: 0,
    passes: 0,
    completedPasses: 0,
    steals: 0,
    interceptions: 0,
    blocks: 0,
  };
}

function addPlayerStat(playerStats, player, field, amount = 1) {
  if (!player) return;
  const key = player.id;
  const current = playerStats.get(key) || blankPlayerStat(player);
  current[field] = (current[field] || 0) + amount;
  playerStats.set(key, current);
}

function serializeScore(score) {
  return { home: score.home, away: score.away };
}

function otherSide(side) {
  return side === "home" ? "away" : "home";
}

function lineupForSide(matchState, side) {
  return matchState[side].rated.lineup.assignments;
}

function pickPlayerFromAssignments(assignments, rng, role, laneHint = "") {
  const laneWeights = {
    holder: { front: 0.9, midfield: 1.45, back: 0.95 },
    passer: { front: 0.8, midfield: 1.55, back: 0.9 },
    receiver: { front: 1.25, midfield: 1.15, back: 0.55 },
    scorer: { front: 1.7, midfield: 0.82, back: 0.22 },
    defender: { front: 0.35, midfield: 1.05, back: 1.55 },
    interceptor: { front: 0.35, midfield: 1.15, back: 1.45 },
  };
  const roleFacets = {
    holder: [["swordControl", 0.35], ["carryCraft", 0.25], ["bodyControl", 0.2], ["mentalEdge", 0.2]],
    passer: [["passCraft", 0.45], ["teamFlow", 0.25], ["creativity", 0.15], ["emissionPower", 0.15]],
    receiver: [["passCraft", 0.25], ["swordControl", 0.25], ["bodyControl", 0.25], ["physicalBurst", 0.15], ["mentalEdge", 0.1]],
    scorer: [["finishingSkill", 0.45], ["emissionPower", 0.25], ["creativity", 0.15], ["physicalBurst", 0.15]],
    defender: [["markSkill", 0.38], ["stealSkill", 0.25], ["physicalBurst", 0.17], ["mentalEdge", 0.2]],
    interceptor: [["interceptRead", 0.45], ["markSkill", 0.23], ["aerialReach", 0.17], ["mentalEdge", 0.15]],
  };
  const weights = assignments
    .filter((assignment) => assignment.player)
    .map((assignment) => {
      const laneBonus = laneHint && assignment.slot.lane === laneHint ? 1.28 : 1;
      const roleBonus = laneWeights[role]?.[assignment.slot.lane] || 1;
      const facets = roleFacets[role] || [];
      const roleFit = facets.length
        ? facets.reduce((sum, [facet, weight]) => sum + playerFacet(assignment.player, facet) * weight, 0) / facets.reduce((sum, [, weight]) => sum + weight, 0)
        : effectiveRating(assignment.player);
      return {
        item: assignment.player,
        weight: (Math.max(1, assignment.rawScore) * 0.72 + roleFit * 0.28) * roleBonus * laneBonus,
      };
    });

  return weightedPick(weights, rng);
}

function pickDistinctReceiver(assignments, carrier, rng) {
  const options = assignments.filter((assignment) => assignment.player && assignment.player.id !== carrier?.id);
  return pickPlayerFromAssignments(options, rng, "receiver") || pickPlayerFromAssignments(assignments, rng, "receiver");
}

function sequencePhaseCount(profile, rng) {
  const controlBias = clamp((profile.flow + profile.retention - 130) / 100, -0.8, 1.2);
  return clamp(Math.round(2 + rng() * 3 + controlBias), 1, 6);
}

function activePlayerIds(lineup) {
  return new Set(lineup.assignments.map((assignment) => assignment.player?.id).filter(Boolean));
}

function lineupContainsPlayer(lineup, player) {
  return lineup.assignments.some((assignment) => assignment.player?.id === player?.id);
}

function substituteAssignment(assignment, player, candidate, kind = "substitution") {
  return {
    ...assignment,
    player,
    code: candidate.code,
    kind,
    replacementFor: candidate.replacementFor,
    rawScore: candidate.rawScore,
    score: candidate.score,
  };
}

function tacticalSubstitutionValue(player, lane, scoreDiff) {
  const laneAttack = { front: 1, midfield: 0.62, back: 0.2 };
  const laneDefense = { front: 0.18, midfield: 0.62, back: 1 };
  const attackValue =
    playerFacet(player, "finishingSkill") * 0.32 +
    playerFacet(player, "emissionPower") * 0.26 +
    playerFacet(player, "creativity") * 0.18 +
    playerFacet(player, "passCraft") * 0.12 +
    playerFacet(player, "physicalBurst") * 0.12;
  const defenseValue =
    playerFacet(player, "markSkill") * 0.3 +
    playerFacet(player, "interceptRead") * 0.28 +
    playerFacet(player, "stealSkill") * 0.2 +
    playerFacet(player, "mentalEdge") * 0.14 +
    playerFacet(player, "aerialReach") * 0.08;
  const balancedValue =
    playerFacet(player, "teamFlow") * 0.27 +
    playerFacet(player, "endurance") * 0.24 +
    playerFacet(player, "swordControl") * 0.2 +
    playerFacet(player, "passCraft") * 0.15 +
    playerFacet(player, "mentalEdge") * 0.14;

  if (scoreDiff < 0) return attackValue * (laneAttack[lane] || 0.5) + balancedValue * 0.24;
  if (scoreDiff > 0) return defenseValue * (laneDefense[lane] || 0.5) + balancedValue * 0.24;
  return balancedValue;
}

function substitutionThreshold(section, settings, scoreDiff) {
  const finalSection = section >= Number(settings.sections);
  if (finalSection) return scoreDiff === 0 ? 0.45 : 0.3;
  return scoreDiff === 0 ? 1.15 : 0.85;
}

function bestBenchSubstitution(lineup, usage, settings, blockedIds = new Set(), protectedIds = new Set(), scoreDiff = 0, section = 1) {
  const activeIds = activePlayerIds(lineup);
  const bench = lineup.team.players.filter((player) => !activeIds.has(player.id) && !blockedIds.has(player.id));
  if (!bench.length) return null;

  const options = [];
  const minGain = substitutionThreshold(section, settings, scoreDiff);

  for (const [index, assignment] of lineup.assignments.entries()) {
    if (!assignment.player || String(assignment.kind || "").includes("changer")) continue;
    if (protectedIds.has(assignment.player.id)) continue;
    const outgoingMinutes = usage.get(assignment.player.id) || 0;
    const outgoingFatigue = playerFatiguePenalty(assignment.player, outgoingMinutes, settings);
    const lane = assignment.slot.lane;
    const outgoingTactical = tacticalSubstitutionValue(assignment.player, lane, scoreDiff);

    for (const player of bench) {
      const candidate = bestCandidateForSlot(player, assignment.slot);
      if (!candidate || candidate.rawScore < 45) continue;

      const incomingMinutes = usage.get(player.id) || 0;
      const freshness = clamp((outgoingMinutes - incomingMinutes) / settings.minutesPerSection, 0, 2) * 1.9;
      const incomingTactical = tacticalSubstitutionValue(player, lane, scoreDiff);
      const incomingScore =
        candidate.rawScore * 0.84 +
        incomingTactical * 0.16 +
        playerFacet(player, "endurance") * 0.03 +
        freshness -
        (incomingMinutes > 0 ? 2.4 : 0);
      const outgoingScore = assignment.rawScore * 0.84 + outgoingTactical * 0.16 - outgoingFatigue * 1.42;
      const delta = incomingScore - outgoingScore;
      const fatigueRelief = outgoingFatigue > (section >= Number(settings.sections) ? 2.25 : 3.05);

      if (delta > minGain || (fatigueRelief && delta > 0.15)) {
        options.push({
          index,
          assignment,
          player,
          candidate,
          delta,
          fatigue: outgoingFatigue,
          incomingScore,
          outgoingScore,
          reason: fatigueRelief && delta <= minGain ? "fatigue_relief" : scoreDiff < 0 ? "attacking_adjustment" : scoreDiff > 0 ? "defensive_adjustment" : "fitness_upgrade",
        });
      }
    }
  }

  return options.sort((a, b) => b.delta - a.delta || b.fatigue - a.fatigue)[0] || null;
}

function maybeUseBenchSubstitutions(rated, side, section, settings, events, minute, score, usage, scoreDiff = 0) {
  if (!settings.enableBenchSubstitutions || section <= 1) return rated;

  let current = rated;
  const blockedIds = new Set(current.lineup.breakBlockedIds || []);
  const protectedIds = new Set(current.lineup.breakProtectedIds || []);
  const maxSubs = clamp(Math.floor(Number(settings.regularSubstitutionsPerBreak) || 0), 0, 5);

  for (let count = 0; count < maxSubs; count += 1) {
    const option = bestBenchSubstitution(current.lineup, usage, settings, blockedIds, protectedIds, scoreDiff, section);
    if (!option) break;

    const nextAssignments = current.lineup.assignments.map((assignment, index) =>
      index === option.index ? substituteAssignment(assignment, option.player, option.candidate) : assignment,
    );
    const nextLineup = {
      ...current.lineup,
      assignments: nextAssignments,
    };

    events.push({
      index: events.length + 1,
      minute,
      section,
      period: section,
      type: "substitution",
      side,
      team: current.name,
      player: option.player.fullName,
      replaced: option.assignment.player?.fullName || "",
      position: option.candidate.code,
      reason: option.reason,
      fatigue: round(option.fatigue, 2),
      projectedGain: round(option.delta, 2),
      incomingScore: round(option.incomingScore, 2),
      outgoingScore: round(option.outgoingScore, 2),
      luminousState: "held",
      score: serializeScore(score),
    });

    current = ratedFromLineup(nextLineup, current.name);
    if (option.assignment.player?.id) blockedIds.add(option.assignment.player.id);
    protectedIds.add(option.player.id);
  }

  return current;
}

function hasActiveChanger(lineup) {
  return lineup.assignments.some((assignment) => String(assignment.kind || "").includes("changer"));
}

const regularFormationPlans = {
  attacking: ["f223", "f322", "f241", "f313"],
  defensive: ["f421", "f412", "f331", "f232"],
  balanced: ["f313", "f322", "f232", "f223"],
};

function regularFormationScore(lineup, scoreDiff) {
  const profile = profileForLineup(lineup);
  const fit = average(lineup.assignments.map((assignment) => assignment.rawScore), profile.starterFit);

  if (scoreDiff < 0) {
    return profile.attack * 0.33 + profile.finishing * 0.2 + profile.emission * 0.17 + profile.flow * 0.16 + fit * 0.14;
  }

  if (scoreDiff > 0) {
    return profile.defense * 0.34 + profile.interception * 0.2 + profile.steal * 0.16 + profile.retention * 0.15 + fit * 0.15;
  }

  return profile.overall * 0.28 + profile.control * 0.22 + profile.flow * 0.2 + profile.retention * 0.16 + fit * 0.14;
}

function maybeUseRegularFormationChange(rated, side, section, settings, events, minute, score, scoreDiff = 0) {
  if (!settings.enableBenchSubstitutions || section <= 1 || hasActiveChanger(rated.lineup)) return rated;

  const activeIds = [...activePlayerIds(rated.lineup)];
  const style = scoreDiff < 0 ? "attacking" : scoreDiff > 0 ? "defensive" : "balanced";
  const candidateKeys = [...new Set([...regularFormationPlans[style], rated.lineup.formation.key])];
  const currentScore = regularFormationScore(rated.lineup, scoreDiff);
  const threshold = section >= Number(settings.sections) ? 0.18 : scoreDiff === 0 ? 0.72 : 0.42;
  const best = candidateKeys
    .map((formationKey) => {
      const lineup = buildLineupInternal(rated.lineup.team, formationKey, rated.lineup.team.name, {
        forcedIds: activeIds,
        adjustLineupByCondition: settings.adjustLineupByCondition,
      });
      return {
        lineup,
        score: regularFormationScore(lineup, scoreDiff) + (formationKey === rated.lineup.formation.key ? 0 : 0.22),
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.lineup.formation.key === rated.lineup.formation.key || best.score <= currentScore + threshold) {
    return rated;
  }

  events.push({
    index: events.length + 1,
    minute,
    section,
    period: section,
    type: "formation_change",
    side,
    team: rated.name,
    player: "",
    formationFrom: rated.lineup.formation.label,
    formationTo: best.lineup.formation.label,
    reason: scoreDiff < 0 ? "attacking_adjustment" : scoreDiff > 0 ? "defensive_adjustment" : "shape_adjustment",
    projectedGain: round(best.score - currentScore, 2),
    luminousState: "held",
    score: serializeScore(score),
  });

  return ratedFromLineup(best.lineup, rated.name);
}

function changerCandidateForBench(lineup, needDefense, usage, settings) {
  const activeIds = activePlayerIds(lineup);
  const bench = lineup.team.players.filter((player) => !activeIds.has(player.id));
  if (!bench.length) return null;

  const preferredCodes = needDefense ? ["8", "1", "2", "3", "11", "14", "12", "13"] : ["9", "7", "17", "5", "6", "10", "15", "16"];
  const incoming = bench
    .map((player) => {
      const positional = Math.max(...preferredCodes.map((code) => ratingForPosition(player, code)));
      const facetScore = needDefense
        ? playerFacet(player, "markSkill") * 0.42 + playerFacet(player, "interceptRead") * 0.36 + playerFacet(player, "mentalEdge") * 0.22
        : playerFacet(player, "finishingSkill") * 0.4 + playerFacet(player, "emissionPower") * 0.34 + playerFacet(player, "creativity") * 0.26;
      const freshness = clamp((settings.minutesPerSection - (usage.get(player.id) || 0)) / settings.minutesPerSection, -1, 1) * 1.6;
      return {
        player,
        score: positional + facetScore * 0.16 + freshness,
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  return incoming && incoming.score >= 66 ? incoming : null;
}

const changerFormationPlans = {
  defensive: ["f421", "f412", "f331", "f232"],
  offensive: ["f223", "f322", "f241", "f313"],
};

function chooseChangerFormationLineup(lineup, incoming, needDefense) {
  const activeIds = [...activePlayerIds(lineup)];
  const plan = changerFormationPlans[needDefense ? "defensive" : "offensive"];
  const candidates = [...plan.filter((key) => key !== lineup.formation.key), lineup.formation.key];

  return candidates
    .map((formationKey) => {
      const nextLineup = buildLineupInternal(lineup.team, formationKey, lineup.team.name, {
        preferredIds: activeIds,
        selectionBias: (player) => (player.id === incoming.player.id ? -45 : 0),
      });
      const profile = profileForLineup(nextLineup);
      const fit = average(nextLineup.assignments.map((assignment) => assignment.rawScore), profile.starterFit);
      const needScore = needDefense
        ? profile.defense * 0.46 + profile.interception * 0.2 + profile.steal * 0.18 + fit * 0.16
        : profile.attack * 0.42 + profile.finishing * 0.22 + profile.emission * 0.2 + fit * 0.16;
      return {
        lineup: nextLineup,
        score: needScore + (formationKey === lineup.formation.key ? -3 : 2),
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.lineup;
}

function applyChangerToLineup(lineup, incoming, needDefense) {
  const positionCode = needDefense ? "8" : "9";
  const outgoingLane = needDefense ? "front" : "back";
  const targetIndex =
    lineup.assignments
      .map((assignment, index) => ({ assignment, index }))
      .filter(({ assignment }) => assignment.player && assignment.slot.lane === outgoingLane)
      .sort((a, b) => a.assignment.rawScore - b.assignment.rawScore)[0]?.index ??
    lineup.assignments
      .map((assignment, index) => ({ assignment, index }))
      .filter(({ assignment }) => assignment.player)
      .sort((a, b) => a.assignment.rawScore - b.assignment.rawScore)[0]?.index;

  if (targetIndex === undefined) return null;

  const replaced = lineup.assignments[targetIndex];
  const rawScore = Math.max(ratingForPosition(incoming.player, positionCode), effectiveRating(incoming.player), incoming.score * 0.88);
  const changerLane = laneForPositionCode(positionCode);
  const nextAssignments = lineup.assignments.map((item, index) =>
    index === targetIndex
      ? {
          ...item,
          slot: {
            ...item.slot,
            label: needDefense ? "Defensive Changer" : "Offensive Changer",
            lane: changerLane,
          },
          player: incoming.player,
          code: positionCode,
          kind: needDefense ? "defensive_changer" : "offensive_changer",
          replacementFor: replaced.code,
          rawScore,
          score: rawScore,
        }
      : item,
  );

  return {
    lineup: {
      ...lineup,
      assignments: nextAssignments,
    },
    replaced,
  };
}

function usedChangerKinds(lineup) {
  return new Set(lineup.usedChangerKinds || []);
}

function maybeUseChanger(rated, side, scoreDiff, section, settings, events, minute, score, usage) {
  if (!settings.enableChangers) return rated;
  if (scoreDiff === 0) return rated;

  const lineup = rated.lineup;
  const needDefense = scoreDiff > 0;
  const changerKind = needDefense ? "defensive_changer" : "offensive_changer";
  const usedKinds = usedChangerKinds(lineup);
  if (usedKinds.has(changerKind)) return rated;

  const incoming = changerCandidateForBench(lineup, needDefense, usage, settings);
  if (!incoming) return rated;

  const formationLineup = hasActiveChanger(lineup) ? lineup : chooseChangerFormationLineup(lineup, incoming, needDefense);
  if (!formationLineup) return rated;

  const changed = applyChangerToLineup(formationLineup, incoming, needDefense);
  if (!changed || !lineupContainsPlayer(changed.lineup, incoming.player)) return rated;

  events.push({
    index: events.length + 1,
    minute,
    section,
    period: section,
    type: needDefense ? "defensive_changer" : "offensive_changer",
    side,
    team: rated.name,
    player: incoming.player.fullName,
    replaced: changed.replaced.player?.fullName || "",
    position: needDefense ? "8" : "9",
    formationFrom: lineup.formation.label,
    formationTo: changed.lineup.formation.label,
    reason: "mid_section_changer",
    luminousState: "held",
    score: serializeScore(score),
  });

  const nextRated = ratedFromLineup(changed.lineup, rated.name);

  return {
    ...nextRated,
    lineup: {
      ...nextRated.lineup,
      usedChangerKinds: [...usedKinds, changerKind],
      breakBlockedIds: [changed.replaced.player?.id].filter(Boolean),
      breakProtectedIds: [incoming.player.id],
    },
  };
}

function shouldUseInSectionChanger(rated, scoreDiff, section, minuteInSection, settings) {
  if (!settings.enableChangers || scoreDiff === 0) return false;

  const needDefense = scoreDiff > 0;
  const changerKind = needDefense ? "defensive_changer" : "offensive_changer";
  if (usedChangerKinds(rated.lineup).has(changerKind)) return false;

  const absDiff = Math.abs(scoreDiff);
  const finalSection = section >= Number(settings.sections);
  const oneGoal = absDiff === 1;

  if (!needDefense) {
    if (oneGoal && !finalSection) return minuteInSection >= 17;
    if (oneGoal) return minuteInSection >= 13;
    return finalSection ? minuteInSection >= 8 : minuteInSection >= 11;
  }

  if (oneGoal && !finalSection) return minuteInSection >= 18;
  if (oneGoal) return minuteInSection >= 15;
  return finalSection ? minuteInSection >= 11 : minuteInSection >= 14;
}

function laneForPositionCode(code) {
  if (["1", "2", "3", "8", "11"].includes(String(code))) return "back";
  if (["4", "10", "12", "13", "14"].includes(String(code))) return "midfield";
  return "front";
}

function prepareSide(teamLike, options) {
  const conditionedTeam = prepareConditionedTeam(teamLike, {
    name: options.name,
    seed: options.seed,
    side: options.side,
    condition: options.condition,
  });
  const rated = rateTeam(conditionedTeam, {
    formation: options.formation,
    name: options.name,
    adjustLineupByCondition: options.adjustLineupByCondition,
  });
  return {
    rated,
    baseProfile: applyTactic(rated.profile, options.tactic),
  };
}

function logEvent(events, event) {
  events.push({
    index: events.length + 1,
    ...event,
  });
}

function resolveSequence(context) {
  const {
    side,
    profiles,
    matchState,
    rng,
    minute,
    section,
    score,
    boxScore,
    playerStats,
    events,
    settings,
  } = context;
  let possessionSide = side;
  let defendingSide = otherSide(possessionSide);
  let carrier = pickPlayerFromAssignments(lineupForSide(matchState, possessionSide), rng, "holder");
  let lastPasser = null;
  const phases = sequencePhaseCount(profiles[possessionSide], rng);

  boxScore[possessionSide].possessions += 1;
  boxScore[possessionSide].possessionEvents += 1;

  for (let phase = 0; phase < phases; phase += 1) {
    const attacker = profiles[possessionSide];
    const defender = profiles[defendingSide];
    const attackingAssignments = lineupForSide(matchState, possessionSide);
    const defendingAssignments = lineupForSide(matchState, defendingSide);
    const challenger = pickPlayerFromAssignments(defendingAssignments, rng, "defender");

    if (carrier && challenger && rng() < duelStealChance(attacker, defender, carrier, challenger, rng)) {
      boxScore[defendingSide].steals += 1;
      boxScore[possessionSide].luminousLosses += 1;
      addPlayerStat(playerStats[defendingSide], challenger, "steals");
      logEvent(events, {
        minute,
        section,
        period: section,
        type: "steal",
        side: defendingSide,
        team: matchState[defendingSide].rated.name,
        player: challenger.fullName,
        target: carrier.fullName,
        luminousState: "held",
        score: serializeScore(score),
        pressure: round(defender.steal - attacker.retention, 2),
      });
      possessionSide = defendingSide;
      defendingSide = otherSide(possessionSide);
      carrier = challenger;
      lastPasser = null;
      continue;
    }

    const shouldShoot =
      phase >= 1 &&
      rng() <
        clamp(
          0.18 + phase * 0.1 + (attacker.finishing - defender.defense) / 260 + (attacker.risk - 1) * 0.08,
          0.12,
          0.72,
        );

    if (shouldShoot) {
      const shooter = carrier || pickPlayerFromAssignments(attackingAssignments, rng, "scorer");
      const blocker = pickPlayerFromAssignments(defendingAssignments, rng, "interceptor", "back");
      const xg = shotQuality(attacker, defender, shooter, rng);
      const blocked = blocker && rng() < shotBlockChance(attacker, defender, blocker, rng);

      boxScore[possessionSide].shots += 1;
      boxScore[possessionSide].conduitLoad += 1.25 + xg * 2;
      addPlayerStat(playerStats[possessionSide], shooter, "shots");

      if (blocked) {
        boxScore[defendingSide].blocks += 1;
        boxScore[defendingSide].interceptions += 1;
        boxScore[possessionSide].luminousLosses += 1;
        addPlayerStat(playerStats[defendingSide], blocker, "blocks");
        addPlayerStat(playerStats[defendingSide], blocker, "interceptions");
        logEvent(events, {
          minute,
          section,
          period: section,
          type: "blocked_shot",
          side: defendingSide,
          team: matchState[defendingSide].rated.name,
          player: blocker.fullName,
          target: shooter?.fullName || "Unknown",
          xg: round(xg, 3),
          luminousState: "held",
          score: serializeScore(score),
          pressure: round(defender.interception - attacker.emission, 2),
        });
        return;
      }

      boxScore[possessionSide].xg += xg;
      const onTarget = rng() < clamp(0.36 + xg + (attacker.emission - defender.interception) / 360, 0.28, 0.78);
      const isGoal = rng() < xg;

      if (onTarget || isGoal) {
        boxScore[possessionSide].shotsOnTarget += 1;
      }

      if (isGoal) {
        const assistingPlayer = lastPasser?.id && lastPasser.id !== shooter?.id ? lastPasser : null;
        score[possessionSide] += 1;
        boxScore[possessionSide].goals += 1;
        addPlayerStat(playerStats[possessionSide], shooter, "goals");
        addPlayerStat(playerStats[possessionSide], assistingPlayer, "assists");
      }

      const assistingPlayer = isGoal && lastPasser?.id && lastPasser.id !== shooter?.id ? lastPasser : null;
      logEvent(events, {
        minute,
        section,
        period: section,
        type: isGoal ? "goal" : onTarget ? "shot_on_target" : "shot",
        side: possessionSide,
        team: matchState[possessionSide].rated.name,
        player: shooter?.fullName || "Unknown",
        assist: assistingPlayer?.fullName || "",
        xg: round(xg, 3),
        luminousState: isGoal ? "goal" : "airborne",
        score: serializeScore(score),
        pressure: round(attacker.emission + attacker.finishing - defender.interception - defender.defense, 2),
        defendedBy: defendingSide,
      });
      return;
    }

    const receiver = pickDistinctReceiver(attackingAssignments, carrier, rng);
    const interceptor = pickPlayerFromAssignments(defendingAssignments, rng, "interceptor", receiver ? laneOfPlayer(attackingAssignments, receiver) : "");
    boxScore[possessionSide].passes += 1;
    boxScore[possessionSide].conduitLoad += 0.6;
    addPlayerStat(playerStats[possessionSide], carrier, "passes");

    if (receiver && interceptor && rng() < passInterceptionChance(attacker, defender, carrier, receiver, interceptor, rng)) {
      boxScore[defendingSide].interceptions += 1;
      boxScore[possessionSide].luminousLosses += 1;
      addPlayerStat(playerStats[defendingSide], interceptor, "interceptions");
      logEvent(events, {
        minute,
        section,
        period: section,
        type: "interception",
        side: defendingSide,
        team: matchState[defendingSide].rated.name,
        player: interceptor.fullName,
        target: receiver.fullName,
        luminousState: "held",
        score: serializeScore(score),
        pressure: round(defender.interception - attacker.flow, 2),
      });
      possessionSide = defendingSide;
      defendingSide = otherSide(possessionSide);
      carrier = interceptor;
      lastPasser = null;
      continue;
    }

    boxScore[possessionSide].completedPasses += 1;
    addPlayerStat(playerStats[possessionSide], carrier, "completedPasses");
    if (settings.includePassEvents) {
      logEvent(events, {
        minute,
        section,
        period: section,
        type: "pass",
        side: possessionSide,
        team: matchState[possessionSide].rated.name,
        player: carrier?.fullName || "Unknown",
        target: receiver?.fullName || "Unknown",
        luminousState: "held",
        score: serializeScore(score),
      });
    }
    lastPasser = carrier;
    carrier = receiver;

    if (rng() < clamp((attacker.retention - defender.steal) / 260 + 0.18, 0.06, 0.34)) {
      boxScore[possessionSide].carries += 1;
      boxScore[possessionSide].conduitLoad += 0.35;
    }
  }
}

function laneOfPlayer(assignments, player) {
  return assignments.find((assignment) => assignment.player?.id === player?.id)?.slot.lane || "";
}

function roundedProfile(profile) {
  const keys = [
    "overall",
    "attack",
    "defense",
    "control",
    "flow",
    "retention",
    "emission",
    "steal",
    "interception",
    "finishing",
    "stamina",
    "depth",
    "cohesion",
    "starterFit",
  ];

  return Object.fromEntries(keys.map((key) => [key, round(profile[key], key === "cohesion" ? 3 : 2)]));
}

function totalMinutes(settings) {
  const sections = Number(settings.sections ?? settings.periods ?? defaultMatchOptions.sections);
  const minutesPerSection = Number(settings.minutesPerSection ?? settings.minutesPerPeriod ?? defaultMatchOptions.minutesPerSection);
  return { sections, minutesPerSection, total: sections * minutesPerSection };
}

export function simulateMatch(homeTeamLike, awayTeamLike, options = {}) {
  const settings = { ...defaultMatchOptions, ...options };
  const rng = createRng(settings.seed);
  const clock = totalMinutes(settings);
  settings.sections = clock.sections;
  settings.minutesPerSection = clock.minutesPerSection;
  const score = { home: 0, away: 0 };
  const boxScore = { home: sideBox(), away: sideBox() };
  const playerStats = { home: new Map(), away: new Map() };
  const usage = { home: new Map(), away: new Map() };
  const events = [];
  const baseState = {
    home: prepareSide(homeTeamLike, {
      formation: settings.homeFormation,
      name: settings.homeName || "Home",
      tactic: settings.homeTactic,
      seed: settings.seed,
      side: "home",
      condition: settings.homeCondition,
      adjustLineupByCondition: settings.adjustLineupByCondition,
    }),
    away: prepareSide(awayTeamLike, {
      formation: settings.awayFormation,
      name: settings.awayName || "Away",
      tactic: settings.awayTactic,
      seed: settings.seed,
      side: "away",
      condition: settings.awayCondition,
      adjustLineupByCondition: settings.adjustLineupByCondition,
    }),
  };
  let matchState = baseState;
  let currentSection = 0;
  let sectionStartMinute = 1;
  const activeSinceMinute = { home: 1, away: 1 };
  const baseTempo = (baseState.home.baseProfile.tempo + baseState.away.baseProfile.tempo) / 145;
  const sequenceCount = Math.max(1, Math.round(clock.total * settings.eventsPerMinute * baseTempo));

  for (let eventIndex = 0; eventIndex < sequenceCount; eventIndex += 1) {
    const progress = eventIndex / Math.max(1, sequenceCount - 1);
    const minute = Math.min(clock.total, Math.floor(progress * clock.total) + 1);
    const section = Math.min(clock.sections, Math.floor((minute - 1) / clock.minutesPerSection) + 1);

    if (section !== currentSection) {
      if (currentSection > 0) {
        recordActiveUntil(matchState, "home", usage, activeSinceMinute, minute);
        recordActiveUntil(matchState, "away", usage, activeSinceMinute, minute);
      }

      currentSection = section;
      sectionStartMinute = (section - 1) * clock.minutesPerSection + 1;
      const homeDiff = score.home - score.away;
      const awayDiff = score.away - score.home;
      let homeRated = matchState.home.rated;
      let awayRated = matchState.away.rated;

      homeRated = maybeUseBenchSubstitutions(homeRated, "home", section, settings, events, minute, score, usage.home, homeDiff);
      awayRated = maybeUseBenchSubstitutions(awayRated, "away", section, settings, events, minute, score, usage.away, awayDiff);
      homeRated = maybeUseRegularFormationChange(homeRated, "home", section, settings, events, minute, score, homeDiff);
      awayRated = maybeUseRegularFormationChange(awayRated, "away", section, settings, events, minute, score, awayDiff);
      matchState = {
        home: { rated: homeRated, baseProfile: applyTactic(homeRated.profile, settings.homeTactic) },
        away: { rated: awayRated, baseProfile: applyTactic(awayRated.profile, settings.awayTactic) },
      };
    }

    const minuteInSection = minute - sectionStartMinute + 1;
    for (const changerSide of ["home", "away"]) {
      const diff = changerSide === "home" ? score.home - score.away : score.away - score.home;
      if (!shouldUseInSectionChanger(matchState[changerSide].rated, diff, section, minuteInSection, settings)) continue;

      const nextRated = maybeUseChanger(
        matchState[changerSide].rated,
        changerSide,
        diff,
        section,
        settings,
        events,
        minute,
        score,
        usage[changerSide],
      );

      if (nextRated !== matchState[changerSide].rated) {
        recordActiveUntil(matchState, changerSide, usage, activeSinceMinute, minute);
        matchState = {
          ...matchState,
          [changerSide]: {
            rated: nextRated,
            baseProfile: applyTactic(nextRated.profile, changerSide === "home" ? settings.homeTactic : settings.awayTactic),
          },
        };
      }
    }

    const home = effectiveProfile(
      matchState.home.baseProfile,
      progress,
      { lineup: matchState.home.rated.lineup, usage: usage.home, minute, activeSinceMinute: activeSinceMinute.home },
      settings,
    );
    const away = effectiveProfile(
      matchState.away.baseProfile,
      progress,
      { lineup: matchState.away.rated.lineup, usage: usage.away, minute, activeSinceMinute: activeSinceMinute.away },
      settings,
    );
    const side = rng() < chanceToControl(home, away, rng) ? "home" : "away";

    resolveSequence({
      side,
      profiles: { home, away },
      matchState,
      rng,
      minute,
      section,
      score,
      boxScore,
      playerStats,
      events,
      settings,
    });
  }

  if (currentSection > 0) {
    recordActiveUntil(matchState, "home", usage, activeSinceMinute, clock.total + 1);
    recordActiveUntil(matchState, "away", usage, activeSinceMinute, clock.total + 1);
  }

  for (const side of ["home", "away"]) {
    boxScore[side].xg = round(boxScore[side].xg, 2);
    boxScore[side].conduitLoad = round(boxScore[side].conduitLoad, 2);
    boxScore[side].fatigueImpact = round(lineupFatiguePenalty(matchState[side].rated.lineup, usage[side], 0, 0, settings), 2);
  }

  const winner = score.home === score.away ? "draw" : score.home > score.away ? "home" : "away";

  return {
    seed: settings.seed,
    ruleset: "luminous-sword-v1",
    clock: {
      sections: clock.sections,
      minutesPerSection: clock.minutesPerSection,
      totalMinutes: clock.total,
    },
    winner,
    score,
    boxScore,
    usage: {
      home: serializeUsage(usage.home),
      away: serializeUsage(usage.away),
    },
    teams: {
      home: {
        name: matchState.home.rated.name,
        formation: matchState.home.rated.lineup.formation,
        startingFormation: baseState.home.rated.lineup.formation,
        tactic: matchState.home.baseProfile.tactic,
        condition: conditionLevels[conditionLevelKey(settings.homeCondition)].label,
        profile: roundedProfile(matchState.home.rated.profile),
        startingLineup: serializeLineup(baseState.home.rated.lineup),
        lineup: serializeLineup(matchState.home.rated.lineup),
        playerStats: serializePlayerStats(playerStats.home),
      },
      away: {
        name: matchState.away.rated.name,
        formation: matchState.away.rated.lineup.formation,
        startingFormation: baseState.away.rated.lineup.formation,
        tactic: matchState.away.baseProfile.tactic,
        condition: conditionLevels[conditionLevelKey(settings.awayCondition)].label,
        profile: roundedProfile(matchState.away.rated.profile),
        startingLineup: serializeLineup(baseState.away.rated.lineup),
        lineup: serializeLineup(matchState.away.rated.lineup),
        playerStats: serializePlayerStats(playerStats.away),
      },
    },
    events,
  };
}

function serializePlayerStats(stats) {
  return [...stats.values()].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.steals + b.interceptions + b.blocks - (a.steals + a.interceptions + a.blocks) ||
      b.shots - a.shots ||
      b.completedPasses - a.completedPasses,
  );
}

function serializeUsage(usage) {
  return Object.fromEntries([...usage.entries()].map(([id, minutes]) => [id, round(minutes, 2)]));
}

function serializeLineup(lineup) {
  return {
    formation: lineup.formation,
    assignments: lineup.assignments.map((assignment) => ({
      slot: assignment.slot.key,
      slotLabel: assignment.slot.label,
      lane: assignment.slot.lane,
      position: assignment.code,
      positionLabel: positionLabels[assignment.code] || assignment.code,
      playerId: assignment.player?.id || null,
      player: assignment.player?.fullName || null,
      condition: assignment.player?.conditionLabel || conditionLevels.normal.label,
      conditionDelta: round(playerConditionDelta(assignment.player || {}), 2),
      rawScore: round(assignment.rawScore || 0, 2),
      kind: assignment.kind || "empty",
    })),
  };
}

export function simulateSeries(homeTeamLike, awayTeamLike, options = {}) {
  const matches = Math.max(1, Number(options.matches) || 100);
  const seed = options.seed || defaultMatchOptions.seed;
  const aggregate = {
    matches,
    homeWins: 0,
    awayWins: 0,
    draws: 0,
    homeGoals: 0,
    awayGoals: 0,
    homeXg: 0,
    awayXg: 0,
  };

  for (let index = 0; index < matches; index += 1) {
    const result = simulateMatch(homeTeamLike, awayTeamLike, {
      ...options,
      seed: `${seed}:${index + 1}`,
    });

    aggregate.homeGoals += result.score.home;
    aggregate.awayGoals += result.score.away;
    aggregate.homeXg += result.boxScore.home.xg;
    aggregate.awayXg += result.boxScore.away.xg;

    if (result.winner === "home") aggregate.homeWins += 1;
    else if (result.winner === "away") aggregate.awayWins += 1;
    else aggregate.draws += 1;
  }

  return {
    ...aggregate,
    homeWinRate: round(aggregate.homeWins / matches, 3),
    awayWinRate: round(aggregate.awayWins / matches, 3),
    drawRate: round(aggregate.draws / matches, 3),
    averageScore: {
      home: round(aggregate.homeGoals / matches, 2),
      away: round(aggregate.awayGoals / matches, 2),
    },
    averageXg: {
      home: round(aggregate.homeXg / matches, 2),
      away: round(aggregate.awayXg / matches, 2),
    },
  };
}

function leagueTeamName(team, fallback) {
  if (!Array.isArray(team) && (team.name || team.teamName)) return team.name || team.teamName;
  return fallback;
}

function makeLeagueSchedule(teamCount) {
  if (teamCount < 2) return [];
  const hasBye = teamCount % 2 === 1;
  const teams = Array.from({ length: hasBye ? teamCount + 1 : teamCount }, (_, index) => index);
  const bye = hasBye ? teamCount : -1;
  const rounds = [];
  const roundCount = teams.length - 1;
  const half = teams.length / 2;
  let rotation = [...teams];

  for (let round = 0; round < roundCount; round += 1) {
    const matches = [];
    for (let index = 0; index < half; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first === bye || second === bye) continue;
      const flip = (round + index) % 2 === 1;
      matches.push({ home: flip ? second : first, away: flip ? first : second });
    }
    rounds.push(matches);
    rotation = [rotation[0], rotation.at(-1), ...rotation.slice(1, -1)];
  }

  return [
    ...rounds,
    ...rounds.map((round) => round.map((match) => ({ home: match.away, away: match.home }))),
    ...rounds,
    ...rounds.map((round) => round.map((match) => ({ home: match.away, away: match.home }))),
  ];
}

function emptyStanding(team, index) {
  return {
    id: String(index),
    name: leagueTeamName(team, `Team ${index + 1}`),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    xgFor: 0,
    xgAgainst: 0,
    form: [],
    fatigue: 0,
  };
}

function rankStandings(standings) {
  return [...standings].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    b.wins - a.wins ||
    a.name.localeCompare(b.name, "ja"),
  ).map((standing, index) => ({ ...standing, rank: index + 1 }));
}

function addStandingResult(standing, goalsFor, goalsAgainst, xgFor, xgAgainst, pointsForWin, pointsForDraw) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  standing.xgFor = round(standing.xgFor + xgFor, 2);
  standing.xgAgainst = round(standing.xgAgainst + xgAgainst, 2);

  if (goalsFor > goalsAgainst) {
    standing.wins += 1;
    standing.points += pointsForWin;
    standing.form.push("W");
  } else if (goalsFor < goalsAgainst) {
    standing.losses += 1;
    standing.form.push("L");
  } else {
    standing.draws += 1;
    standing.points += pointsForDraw;
    standing.form.push("D");
  }

  standing.form = standing.form.slice(-5);
}

function playerBaseConditionDelta(player) {
  for (const key of ["conditionDelta", "formDelta", "conditionScore", "formScore"]) {
    const value = Number(player?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function leagueFatigueTeam(team, fatigue, rng, morale = 0) {
  const normalized = normalizeTeam(team, leagueTeamName(team, "Team"));
  return {
    ...normalized,
    players: normalized.players.map((player) => {
      const load = Number(fatigue.players.get(player.id) || 0);
      const randomForm = normalish(rng) * 1.25;
      const delta = clamp(playerBaseConditionDelta(player) + morale + randomForm - load * 0.72, -10, 10);
      return {
        ...player,
        conditionDelta: round(delta, 2),
        seasonFatigue: round(load, 2),
      };
    }),
  };
}

function updateLeagueFatigue(fatigue, result, side, settings) {
  if (!settings.enableSeasonFatigue) return;
  const usage = result.usage?.[side] || {};
  const box = result.boxScore?.[side] || {};
  const conduitFactor = clamp(Number(box.conduitLoad || 0) / 120, 0, 1.2);
  const impactFactor = clamp(Number(box.fatigueImpact || 0) / 9, 0, 1.2);

  for (const [id, minutes] of Object.entries(usage)) {
    const current = Number(fatigue.players.get(id) || 0);
    const playedShare = Number(minutes) / Math.max(1, defaultMatchOptions.sections * defaultMatchOptions.minutesPerSection);
    const added = playedShare * (2.25 + conduitFactor * 0.7 + impactFactor * 0.9);
    fatigue.players.set(id, clamp(current + added, 0, 10));
  }
}

function recoverLeagueFatigue(fatigue, amount) {
  for (const [id, value] of fatigue.players.entries()) {
    const next = Math.max(0, Number(value) - amount);
    if (next > 0.05) fatigue.players.set(id, round(next, 3));
    else fatigue.players.delete(id);
  }
}

function teamFatigueAverage(fatigue) {
  const values = [...fatigue.players.values()].map(Number);
  return round(average(values, 0), 2);
}

function emptyLeaguePlayerStat(player, teamName, teamIndex) {
  return {
    id: `${teamIndex}:${player.id}`,
    playerId: player.id,
    name: player.fullName,
    team: teamName,
    matches: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    passes: 0,
    completedPasses: 0,
    steals: 0,
    interceptions: 0,
    blocks: 0,
  };
}

function aggregateLeaguePlayerStats(leagueStats, team, teamName, teamIndex, result, side) {
  const playersById = new Map(team.players.map((player) => [player.id, player]));
  const usage = result.usage?.[side] || {};

  for (const [playerId, minutes] of Object.entries(usage)) {
    const player = playersById.get(playerId);
    if (!player) continue;
    const key = `${teamIndex}:${playerId}`;
    const current = leagueStats.get(key) || emptyLeaguePlayerStat(player, teamName, teamIndex);
    current.matches += 1;
    current.minutes += Number(minutes) || 0;
    leagueStats.set(key, current);
  }

  for (const stat of result.teams[side].playerStats || []) {
    const player = playersById.get(stat.id) || { id: stat.id, fullName: stat.name };
    const key = `${teamIndex}:${stat.id}`;
    const current = leagueStats.get(key) || emptyLeaguePlayerStat(player, teamName, teamIndex);
    current.goals += stat.goals || 0;
    current.assists += stat.assists || 0;
    current.shots += stat.shots || 0;
    current.passes += stat.passes || 0;
    current.completedPasses += stat.completedPasses || 0;
    current.steals += stat.steals || 0;
    current.interceptions += stat.interceptions || 0;
    current.blocks += stat.blocks || 0;
    leagueStats.set(key, current);
  }
}

function playerMvpScore(player) {
  const passRate = player.passes ? player.completedPasses / player.passes : 0;
  const defensive = player.steals * 1.4 + player.interceptions * 1.35 + player.blocks * 1.2;
  const creation = player.assists * 3.4 + player.completedPasses * 0.025 + passRate * 2.2;
  const scoring = player.goals * 5.2 + player.shots * 0.08;
  const durability = Math.min(6, player.minutes / 600);
  return scoring + creation + defensive + durability;
}

function serializeLeaguePlayer(player) {
  const passRate = player.passes ? player.completedPasses / player.passes : 0;
  return {
    ...player,
    minutes: round(player.minutes, 1),
    passRate: round(passRate, 3),
    mvpScore: round(playerMvpScore(player), 2),
    goalContribution: player.goals + player.assists,
    defensiveActions: player.steals + player.interceptions + player.blocks,
  };
}

function topPlayers(players, scorer, minFilter = () => true) {
  return players
    .filter(minFilter)
    .map(serializeLeaguePlayer)
    .sort((a, b) => scorer(b) - scorer(a) || b.mvpScore - a.mvpScore || a.name.localeCompare(b.name, "ja"))
    .slice(0, 10);
}

function buildLeagueAwards(leagueStats, table) {
  const players = [...leagueStats.values()];
  const byTeam = new Map();

  for (const player of players) {
    const current = byTeam.get(player.team) || [];
    current.push(player);
    byTeam.set(player.team, current);
  }

  const teamMvp = [...byTeam.entries()]
    .map(([team, teamPlayers]) => ({
      team,
      player: topPlayers(teamPlayers, (player) => player.mvpScore)[0],
    }))
    .sort((a, b) => a.team.localeCompare(b.team, "ja"));

  return {
    mvp: topPlayers(players, (player) => player.mvpScore),
    topScorers: topPlayers(players, (player) => player.goals),
    assists: topPlayers(players, (player) => player.assists),
    goalContributions: topPlayers(players, (player) => player.goalContribution),
    shooters: topPlayers(players, (player) => player.shots),
    passers: topPlayers(players, (player) => player.completedPasses),
    passAccuracy: topPlayers(players, (player) => player.passRate, (player) => player.passes >= 300),
    stealers: topPlayers(players, (player) => player.steals),
    interceptors: topPlayers(players, (player) => player.interceptions),
    blockers: topPlayers(players, (player) => player.blocks),
    defensiveMvp: topPlayers(players, (player) => player.defensiveActions),
    workhorses: topPlayers(players, (player) => player.minutes),
    teamMvp,
    teamAwards: {
      champion: table[0] || null,
      bestAttack: [...table].sort((a, b) => b.goalsFor - a.goalsFor || b.points - a.points)[0] || null,
      bestDefense: [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.points - a.points)[0] || null,
      bestGoalDifference: [...table].sort((a, b) => b.goalDifference - a.goalDifference || b.points - a.points)[0] || null,
    },
  };
}

function stableTeamPlan(team, index, seed) {
  const keys = Object.keys(formations);
  const rng = createRng(`${seed}:plan:${leagueTeamName(team, index)}`);
  const profile = rateTeam(team, { formation: keys[index % keys.length], name: leagueTeamName(team, `Team ${index + 1}`) }).profile;
  const formation = keys[Math.floor(rng() * keys.length) % keys.length] || defaultMatchOptions.homeFormation;
  let tactic = "balanced";
  if (profile.steal > profile.retention + 3) tactic = "press";
  else if (profile.retention > profile.emission + 3) tactic = "possession";
  else if (profile.emission > profile.flow + 2) tactic = "direct";
  else if (profile.defense > profile.attack + 3) tactic = "defensive";
  else if (profile.attack > profile.control + 2) tactic = "counter";
  return { formation, tactic };
}

export function simulateLeagueSeason(teamLikes, options = {}) {
  const settings = { ...defaultLeagueOptions, ...options };
  const teams = teamLikes.map((team, index) => normalizeTeam(team, leagueTeamName(team, `Team ${index + 1}`)));
  if (teams.length < 2) throw new Error("League season requires at least two teams.");

  const standings = teams.map(emptyStanding);
  const fatigue = teams.map(() => ({ players: new Map() }));
  const plans = teams.map((team, index) => stableTeamPlan(team, index, settings.seed));
  const schedule = makeLeagueSchedule(teams.length);
  const leagueStats = new Map();
  const rounds = [];

  schedule.forEach((matches, roundIndex) => {
    for (const teamFatigue of fatigue) {
      recoverLeagueFatigue(teamFatigue, roundIndex === settings.winterBreakRound ? 3.3 : 1.05);
    }

    const round = {
      round: roundIndex + 1,
      label: `第${roundIndex + 1}節`,
      matches: [],
    };

    for (const [matchIndex, fixture] of matches.entries()) {
      const homeFatigue = fatigue[fixture.home];
      const awayFatigue = fatigue[fixture.away];
      const homeStanding = standings[fixture.home];
      const awayStanding = standings[fixture.away];
      const homeMorale = clamp((homeStanding.points - awayStanding.points) / 28, -1.2, 1.2);
      const awayMorale = clamp((awayStanding.points - homeStanding.points) / 28, -1.2, 1.2);
      const homeTeam = leagueFatigueTeam(teams[fixture.home], homeFatigue, createRng(`${settings.seed}:r${roundIndex + 1}:m${matchIndex + 1}:home-form`), homeMorale);
      const awayTeam = leagueFatigueTeam(teams[fixture.away], awayFatigue, createRng(`${settings.seed}:r${roundIndex + 1}:m${matchIndex + 1}:away-form`), awayMorale);
      const homePlan = plans[fixture.home];
      const awayPlan = plans[fixture.away];
      const result = simulateMatch(homeTeam, awayTeam, {
        ...settings,
        seed: `${settings.seed}:league:${roundIndex + 1}:${matchIndex + 1}`,
        homeName: homeStanding.name,
        awayName: awayStanding.name,
        homeFormation: homePlan.formation,
        awayFormation: awayPlan.formation,
        homeTactic: homePlan.tactic,
        awayTactic: awayPlan.tactic,
        homeCondition: "normal",
        awayCondition: "normal",
        includePassEvents: Boolean(settings.includeMatchDetails && settings.includePassEvents),
      });

      addStandingResult(
        homeStanding,
        result.score.home,
        result.score.away,
        result.boxScore.home.xg,
        result.boxScore.away.xg,
        settings.pointsForWin,
        settings.pointsForDraw,
      );
      addStandingResult(
        awayStanding,
        result.score.away,
        result.score.home,
        result.boxScore.away.xg,
        result.boxScore.home.xg,
        settings.pointsForWin,
        settings.pointsForDraw,
      );
      updateLeagueFatigue(homeFatigue, result, "home", settings);
      updateLeagueFatigue(awayFatigue, result, "away", settings);
      aggregateLeaguePlayerStats(leagueStats, teams[fixture.home], homeStanding.name, fixture.home, result, "home");
      aggregateLeaguePlayerStats(leagueStats, teams[fixture.away], awayStanding.name, fixture.away, result, "away");
      homeStanding.fatigue = teamFatigueAverage(homeFatigue);
      awayStanding.fatigue = teamFatigueAverage(awayFatigue);

      round.matches.push({
        home: homeStanding.name,
        away: awayStanding.name,
        score: result.score,
        winner: result.winner,
        xg: {
          home: result.boxScore.home.xg,
          away: result.boxScore.away.xg,
        },
        fatigue: {
          home: homeStanding.fatigue,
          away: awayStanding.fatigue,
        },
        formations: {
          home: result.teams.home.startingFormation.label,
          away: result.teams.away.startingFormation.label,
        },
        tactics: {
          home: result.teams.home.tactic,
          away: result.teams.away.tactic,
        },
        result: settings.includeMatchDetails ? result : undefined,
      });
    }

    rounds.push(round);
  });

  const table = rankStandings(standings).map((standing) => ({
    ...standing,
    xgFor: round(standing.xgFor, 2),
    xgAgainst: round(standing.xgAgainst, 2),
    xgDifference: round(standing.xgFor - standing.xgAgainst, 2),
    clQualified: standing.rank <= Number(settings.clSlots || 0),
  }));

  return {
    seed: settings.seed,
    ruleset: "luminous-sword-league-v1",
    league: {
      name: settings.name,
      format: settings.format,
      teams: teams.length,
      rounds: schedule.length,
      matches: schedule.reduce((sum, round) => sum + round.length, 0),
      pointsForWin: settings.pointsForWin,
      pointsForDraw: settings.pointsForDraw,
      clSlots: settings.clSlots,
      seasonFatigue: settings.enableSeasonFatigue !== false,
    },
    table,
    awards: buildLeagueAwards(leagueStats, table),
    rounds,
  };
}
