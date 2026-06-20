import { defaultMatchOptions, normalizeTeam, rateTeam, simulateMatch } from "./simulator.js";
import { clamp, createRng, round } from "./random.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const defaultWorldOptions = {
  seed: "touken-world",
  scheduleSeed: "touken-schedule",
  seasonLabel: "29/30",
  startDate: "2029-09-15",
  endDate: "2030-07-15",
  pointsForWin: 3,
  pointsForDraw: 1,
  format: "quadruple-round-robin",
  enableDomesticCups: true,
};

export const worldCountryDefaults = [
  { key: "japan", country: "日本", leagueName: "日本リーグ", clSlots: 4 },
  { key: "germany", country: "ドイツ", leagueName: "ドイツリーグ", clSlots: 4 },
  { key: "usa", country: "アメリカ", leagueName: "アメリカリーグ", clSlots: 4 },
  { key: "uk", country: "イギリス", leagueName: "イギリスリーグ", clSlots: 4 },
  { key: "france", country: "フランス", leagueName: "フランスリーグ", clSlots: 3 },
  { key: "italy", country: "イタリア", leagueName: "イタリアリーグ", clSlots: 2 },
  { key: "spain", country: "スペイン", leagueName: "スペインリーグ", clSlots: 2 },
  { key: "korea", country: "韓国", leagueName: "韓国リーグ", clSlots: 2 },
  { key: "china", country: "中国", leagueName: "中国リーグ", clSlots: 1 },
  { key: "russia", country: "ロシア", leagueName: "ロシアリーグ", clSlots: 1 },
];

const championsLeagueCountrySlots = {
  germany: 4,
  japan: 4,
  usa: 4,
  uk: 4,
  france: 3,
  italy: 2,
  spain: 2,
  korea: 2,
  china: 1,
  russia: 1,
};

const championsLeagueRequiredCountries = Object.keys(championsLeagueCountrySlots);

const nationsLeagueDivisionOne = [
  { key: "usa", country: "アメリカ", name: "アメリカ代表" },
  { key: "japan", country: "日本", name: "日本代表" },
  { key: "germany", country: "ドイツ", name: "ドイツ代表" },
  { key: "england", country: "イングランド", name: "イングランド代表" },
  { key: "france", country: "フランス", name: "フランス代表" },
  { key: "italy", country: "イタリア", name: "イタリア代表" },
  { key: "canada", country: "カナダ", name: "カナダ代表" },
  { key: "mexico", country: "メキシコ", name: "メキシコ代表" },
  { key: "korea", country: "韓国", name: "韓国代表" },
  { key: "russia", country: "ロシア", name: "ロシア代表" },
  { key: "brazil", country: "ブラジル", name: "ブラジル代表" },
  { key: "australia", country: "オーストラリア", name: "オーストラリア代表" },
  { key: "china", country: "中国", name: "中国代表" },
  { key: "india", country: "インド", name: "インド代表" },
  { key: "spain", country: "スペイン", name: "スペイン代表" },
  { key: "indonesia", country: "インドネシア", name: "インドネシア代表" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseDate(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid date: ${dateText}`);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateText, days) {
  return formatDate(new Date(parseDate(dateText).getTime() + days * DAY_MS));
}

function compareDate(a, b) {
  return parseDate(a).getTime() - parseDate(b).getTime();
}

function monthOf(dateText) {
  return parseDate(dateText).getUTCMonth() + 1;
}

function roundRobinCycles(format) {
  return {
    "single-round-robin": 1,
    "double-round-robin": 2,
    "quadruple-round-robin": 4,
  }[format] || 4;
}

function makeRoundRobinRounds(teamIndexes, cycles = 1) {
  if (teamIndexes.length < 2) return [];
  const hasBye = teamIndexes.length % 2 === 1;
  const teams = [...teamIndexes, ...(hasBye ? [null] : [])];
  const baseRounds = [];
  const half = teams.length / 2;
  let rotation = [...teams];

  for (let round = 0; round < teams.length - 1; round += 1) {
    const matches = [];
    for (let index = 0; index < half; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first === null || second === null) continue;
      const flip = (round + index) % 2 === 1;
      matches.push({ home: flip ? second : first, away: flip ? first : second });
    }
    baseRounds.push(matches);
    rotation = [rotation[0], rotation.at(-1), ...rotation.slice(1, -1)];
  }

  const rounds = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const reverse = cycle % 2 === 1;
    for (const round of baseRounds) {
      rounds.push(round.map((match) => reverse
        ? { home: match.away, away: match.home }
        : { home: match.home, away: match.away }));
    }
  }
  return rounds;
}

function chunkIndexes(teamCount, groupCount) {
  const groups = Array.from({ length: Math.max(1, groupCount) }, () => []);
  for (let index = 0; index < teamCount; index += 1) {
    groups[index % groups.length].push(index);
  }
  return groups.filter((group) => group.length);
}

function mergeRoundSets(roundSets) {
  const max = Math.max(0, ...roundSets.map((rounds) => rounds.length));
  const merged = [];
  for (let index = 0; index < max; index += 1) {
    merged.push(roundSets.flatMap((rounds) => rounds[index] || []));
  }
  return merged;
}

export function makeLeagueSchedule(teamCount, format = defaultWorldOptions.format) {
  if (teamCount < 2) return [];
  const all = Array.from({ length: teamCount }, (_, index) => index);

  if (format === "split-after-double") {
    const regular = makeRoundRobinRounds(all, 4);
    const groups = chunkIndexes(teamCount, teamCount >= 12 ? 3 : 2);
    const split = mergeRoundSets(groups.map((group) => makeRoundRobinRounds(group, 2)));
    return [...regular, ...split];
  }

  if (format === "regional-mixed") {
    const groups = chunkIndexes(teamCount, teamCount >= 18 ? 3 : teamCount >= 12 ? 2 : 1);
    const regional = mergeRoundSets(groups.map((group) => makeRoundRobinRounds(group, 4)));
    const national = makeRoundRobinRounds(all, 1);
    return [...regional, ...national];
  }

  return makeRoundRobinRounds(all, roundRobinCycles(format));
}

function isDynamicLeagueFormat(format) {
  return format === "split-after-double" || format === "regional-mixed";
}

function regionalGroupCount(teamCount) {
  if (teamCount >= 18) return 3;
  if (teamCount >= 12) return 2;
  return 1;
}

function initialLeagueSchedule(teamCount, format) {
  const all = Array.from({ length: teamCount }, (_, index) => index);
  if (format === "split-after-double") return makeRoundRobinRounds(all, 4);
  if (format === "regional-mixed") {
    const groups = chunkIndexes(teamCount, regionalGroupCount(teamCount));
    return mergeRoundSets(groups.map((group) => makeRoundRobinRounds(group, 4)));
  }
  return makeLeagueSchedule(teamCount, format);
}

function regionalGroupsForLeague(league) {
  const grouped = new Map();
  for (const teamId of league.teamIds || []) {
    const group = league.teamGroups?.[teamId] || "group-a";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(teamId);
  }
  const groups = [...grouped.values()].filter((group) => group.length >= 2);
  if (groups.length) return groups;
  return chunkIndexes(league.teamIds.length, regionalGroupCount(league.teamIds.length))
    .map((group) => group.map((teamIndex) => league.teamIds[teamIndex]));
}

function initialLeagueMatches(league) {
  const scheduleSeed = league.scheduleSeed || `${league.id}:schedule`;
  if (league.format === "regional-mixed") {
    return mergeRoundSets(regionalGroupsForLeague(league).map((group, index) =>
      makeRoundRobinRounds(shuffledTeamIds(group, `${scheduleSeed}:regional:${index}`), 4)));
  }
  if (league.format === "split-after-double") {
    return makeRoundRobinRounds(shuffledTeamIds(league.teamIds, `${scheduleSeed}:split`), 4);
  }
  return makeRoundRobinRounds(shuffledTeamIds(league.teamIds, `${scheduleSeed}:regular`), roundRobinCycles(league.format));
}

function draftTeamGroup(draft, teamIndex) {
  const value = Array.isArray(draft.teamGroups) ? draft.teamGroups[teamIndex] : null;
  if (typeof value === "string") return value;
  return value?.group || "";
}

function makeLeagueDates(startDate, roundCount, endDate = defaultWorldOptions.endDate) {
  const dates = [];
  let date = parseDate(startDate);
  const hardStop = new Date(parseDate(endDate).getTime() + 70 * DAY_MS);

  while (dates.length < roundCount && date <= hardStop) {
    const dateText = formatDate(date);
    const day = date.getUTCDay();
    const weekIndex = Math.floor((date.getTime() - parseDate(startDate).getTime()) / (7 * DAY_MS));
    const midweekLeagueSlot = day === 3 && (weekIndex % 2 === 0 || weekIndex % 5 === 3);
    if (day === 6 || midweekLeagueSlot) dates.push(dateText);
    date = new Date(date.getTime() + DAY_MS);
  }

  while (dates.length < roundCount) {
    dates.push(addDays(dates.at(-1) || startDate, 4));
  }

  return dates;
}

function makeDomesticCupDates(startDate, endDate, roundCount) {
  const startYear = parseDate(startDate).getUTCFullYear();
  const endYear = parseDate(endDate).getUTCFullYear();
  const preferred = [
    `${startYear}-10-15`,
    `${startYear}-12-17`,
    `${endYear}-02-12`,
    `${endYear}-05-07`,
    `${endYear}-07-10`,
  ].filter((date) => compareDate(date, startDate) >= 0 && compareDate(date, endDate) <= 0);

  const dates = preferred.slice(-roundCount);
  while (dates.length < roundCount) {
    dates.unshift(addDays(dates[0] || startDate, -28));
  }
  return dates.slice(0, roundCount);
}

function roundLabelForCup(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return "決勝";
  if (remaining === 2) return "準決勝";
  if (remaining === 3) return "準々決勝";
  return `${roundIndex + 1}回戦`;
}

function shuffledTeamIds(teamIds, seed) {
  const rng = createRng(seed);
  const entries = [...teamIds];
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
  }
  return entries;
}

function pairTeamIds(teamIds) {
  const pairs = [];
  const byes = [];
  for (let index = 0; index < teamIds.length; index += 2) {
    if (teamIds[index + 1]) pairs.push([teamIds[index], teamIds[index + 1]]);
    else byes.push(teamIds[index]);
  }
  return { pairs, byes };
}

function calendarDay(calendarByDate, date) {
  const day = calendarByDate.get(date) || { date, fixtures: [] };
  calendarByDate.set(date, day);
  return day;
}

function applyInternationalCalendarBlocks(calendarByDate, world) {
  calendarByDate.blockedDates = new Set((world?.futureCompetitions?.nationsLeague?.windows || nationsLeagueWindows(
    world?.season?.startDate || defaultWorldOptions.startDate,
    world?.season?.endDate || defaultWorldOptions.endDate,
  )).flatMap((window) => window.blockedDates || []));
  return calendarByDate;
}

function daysBetween(a, b) {
  return Math.abs(parseDate(a).getTime() - parseDate(b).getTime()) / DAY_MS;
}

function fixturesForTeam(calendarByDate, teamId) {
  const rows = [];
  for (const [date, day] of calendarByDate.entries()) {
    for (const fixture of day.fixtures || []) {
      if (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId) rows.push({ date, fixture });
    }
  }
  return rows;
}

function teamHasFixtureOnDate(calendarByDate, teamId, date) {
  return fixturesForTeam(calendarByDate, teamId).some((row) => row.date === date);
}

function teamRestIsAcceptable(calendarByDate, teamId, date, minRestDays) {
  if (teamHasFixtureOnDate(calendarByDate, teamId, date)) return false;
  return fixturesForTeam(calendarByDate, teamId).every((row) => daysBetween(row.date, date) >= minRestDays);
}

function dateIsInsideSeason(date, startDate, endDate, extraDays = 45) {
  return compareDate(date, startDate) >= 0 && compareDate(date, addDays(endDate, extraDays)) <= 0;
}

function searchDateOffsets(maxShift) {
  const offsets = [0];
  for (let value = 1; value <= maxShift; value += 1) {
    offsets.push(value, -value);
  }
  return offsets;
}

function weekdayAllowed(date, allowedWeekdays) {
  if (!allowedWeekdays?.length) return true;
  return allowedWeekdays.includes(parseDate(date).getUTCDay());
}

function findAvailableFixtureDate(calendarByDate, preferredDate, teamIds, options = {}) {
  const startDate = options.startDate || preferredDate;
  const endDate = options.endDate || preferredDate;
  const minRestDays = Number(options.minRestDays ?? 3);
  const maxShift = Number(options.maxShift ?? 21);
  const allowedWeekdays = options.allowedWeekdays || null;
  const requiredTeams = teamIds.map(String);
  const blockedDates = calendarByDate.blockedDates || new Set();

  for (const offset of searchDateOffsets(maxShift)) {
    const date = addDays(preferredDate, offset);
    if (!dateIsInsideSeason(date, startDate, endDate, Number(options.extraDays ?? 45))) continue;
    if (!weekdayAllowed(date, allowedWeekdays)) continue;
    if (!options.allowBlockedDates && blockedDates.has(date)) continue;
    if (requiredTeams.every((teamId) => teamRestIsAcceptable(calendarByDate, teamId, date, minRestDays))) return date;
  }

  for (const offset of searchDateOffsets(maxShift + 21)) {
    const date = addDays(preferredDate, offset);
    if (!dateIsInsideSeason(date, startDate, endDate, Number(options.extraDays ?? 60))) continue;
    if (!options.allowBlockedDates && blockedDates.has(date)) continue;
    if (requiredTeams.every((teamId) => !teamHasFixtureOnDate(calendarByDate, teamId, date))) return date;
  }

  return preferredDate;
}

function fixtureDateSlots(startDate, roundCount, endDate) {
  return makeLeagueDates(startDate, roundCount, endDate);
}

function addLeagueRoundFixtures(calendarByDate, league, matches, roundIndex, date, phase = "regular") {
  const fixtureIds = [];
  for (const [matchIndex, match] of matches.entries()) {
    const homeTeamId = String(match.home);
    const awayTeamId = String(match.away);
    const fixtureDate = league.worldSeason
      ? findAvailableFixtureDate(calendarByDate, date, [homeTeamId, awayTeamId], {
        startDate: league.worldSeason.startDate,
        endDate: league.worldSeason.endDate,
        minRestDays: phase === "regular" ? 2 : 3,
        maxShift: phase === "regular" ? 7 : 18,
        allowedWeekdays: phase === "regular" ? [3, 6] : [5, 6],
      })
      : date;
    const fixture = {
      id: `${league.id}-r${roundIndex + 1}-m${matchIndex + 1}`,
      competitionId: league.id,
      competitionName: league.name,
      competitionKind: "league",
      phase,
      round: roundIndex + 1,
      date: fixtureDate,
      homeTeamId,
      awayTeamId,
      status: "scheduled",
      result: null,
    };
    calendarDay(calendarByDate, fixtureDate).fixtures.push(fixture);
    fixtureIds.push(fixture.id);
  }
  return fixtureIds;
}

function standingOrderForTeams(league, teamIds = league.teamIds) {
  const allowed = new Set(teamIds);
  return rankStandings((league.standings || []).filter((standing) => allowed.has(standing.teamId)))
    .map((standing) => standing.teamId);
}

function splitRankedTeamIds(teamIds, groupCount) {
  const groups = Array.from({ length: Math.max(1, groupCount) }, () => []);
  for (const [index, teamId] of teamIds.entries()) {
    groups[Math.floor(index * groups.length / teamIds.length)].push(teamId);
  }
  return groups.filter((group) => group.length >= 2);
}

function scheduleCupRound(world, calendarByDate, cup, roundIndex, entrants) {
  const round = cup.rounds[roundIndex];
  if (!round || round.fixtureIds.length || entrants.length < 2) return [];
  const { pairs, byes } = pairTeamIds(entrants);
  round.byeTeamIds = byes;

  for (const [matchIndex, [homeTeamId, awayTeamId]] of pairs.entries()) {
    const fixtureDate = findAvailableFixtureDate(calendarByDate, round.date, [homeTeamId, awayTeamId], {
      startDate: world.season.startDate,
      endDate: world.season.endDate,
      minRestDays: 3,
      maxShift: 18,
      allowedWeekdays: [2, 3, 4],
    });
    const fixture = {
      id: `${cup.id}-r${roundIndex + 1}-m${matchIndex + 1}`,
      competitionId: cup.id,
      competitionName: cup.name,
      competitionKind: "domestic-cup",
      cupId: cup.id,
      round: roundIndex + 1,
      date: fixtureDate,
      homeTeamId,
      awayTeamId,
      status: "scheduled",
      result: null,
    };
    calendarDay(calendarByDate, fixtureDate).fixtures.push(fixture);
    round.fixtureIds.push(fixture.id);
  }

  if (!pairs.length && byes.length === 1) {
    cup.completed = true;
    cup.championTeamId = byes[0];
  }
  return byes;
}

function addDomesticCups(world, calendarByDate) {
  for (const league of world.leagues) {
    const teamIds = shuffledTeamIds(league.teamIds, `${world.seed}:cup:${league.id}`);
    const totalRounds = Math.max(1, Math.ceil(Math.log2(teamIds.length)));
    const roundDates = makeDomesticCupDates(world.season.startDate, world.season.endDate, totalRounds);
    const cup = {
      id: `cup-${league.id}`,
      name: `${league.country || league.name}カップ`,
      country: league.country,
      leagueId: league.id,
      teamIds: [...league.teamIds],
      completed: false,
      championTeamId: null,
      rounds: roundDates.map((date, index) => ({
        round: index + 1,
        label: roundLabelForCup(index, roundDates.length),
        date,
        fixtureIds: [],
        byeTeamIds: [],
      })),
    };
    world.futureCompetitions.domesticCups.push(cup);
    scheduleCupRound(world, calendarByDate, cup, 0, teamIds);
  }
}

function countryKeyFromText(value = "") {
  const text = String(value).toLowerCase();
  const aliases = [
    ["germany", ["germany", "german", "ドイツ"]],
    ["japan", ["japan", "日本"]],
    ["usa", ["usa", "america", "アメリカ"]],
    ["uk", ["uk", "england", "britain", "イギリス", "英国"]],
    ["france", ["france", "フランス"]],
    ["italy", ["italy", "イタリア"]],
    ["spain", ["spain", "スペイン"]],
    ["korea", ["korea", "韓国"]],
    ["china", ["china", "中国"]],
    ["russia", ["russia", "ロシア"]],
  ];
  return aliases.find(([, words]) => words.some((word) => text.includes(word)))?.[0] || "";
}

function previousSeasonRankForTeam(worldTeam) {
  const candidates = [
    worldTeam.previousSeason?.leagueRank,
    worldTeam.previousSeason?.rank,
    worldTeam.team?.previousSeason?.leagueRank,
    worldTeam.team?.previousSeason?.rank,
    worldTeam.team?.seasonTransition?.leagueRank,
  ];
  const rank = candidates.map(Number).find((value) => Number.isFinite(value) && value > 0);
  return rank || null;
}

function selectChampionsLeagueEntrants(world) {
  const byCountry = new Map();
  for (const league of world.leagues || []) {
    const key = league.countryKey || countryKeyFromText(`${league.country} ${league.name}`);
    if (!key) continue;
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key).push(league);
  }

  const missingCountries = championsLeagueRequiredCountries.filter((key) => !byCountry.has(key));
  if (missingCountries.length) return { enabled: false, entrants: [], missingCountries };

  const entrants = [];
  for (const countryKey of championsLeagueRequiredCountries) {
    const league = byCountry.get(countryKey)[0];
    const slots = championsLeagueCountrySlots[countryKey];
    const teams = (league.teamIds || [])
      .map((teamId) => world.teams.find((team) => team.id === teamId))
      .filter(Boolean)
      .sort((a, b) => {
        const rankA = previousSeasonRankForTeam(a);
        const rankB = previousSeasonRankForTeam(b);
        if (rankA && rankB) return rankA - rankB;
        if (rankA) return -1;
        if (rankB) return 1;
        return Number(b.teamLevel || 0) - Number(a.teamLevel || 0) || a.name.localeCompare(b.name, "ja");
      })
      .slice(0, slots);

    for (const [index, team] of teams.entries()) {
      entrants.push({
        teamId: team.id,
        team: team.name,
        leagueId: league.id,
        league: league.name,
        country: league.country,
        countryKey,
        rank: previousSeasonRankForTeam(team) || index + 1,
        seedRating: Number(team.teamLevel || 50),
        dummy: false,
      });
    }
  }

  return { enabled: entrants.length >= 27, entrants, missingCountries: [] };
}

function dummyPlayer(teamId, index, rating) {
  const positions = ["1", "2", "4", "5", "6", "7", "14"];
  const bestPosition = positions[index % positions.length];
  return {
    id: `${teamId}-p${index + 1}`,
    name: `CL Dummy ${index + 1}`,
    fullName: `CL Dummy ${index + 1}`,
    age: 24 + (index % 8),
    bestPosition,
    rating,
    positionRatings: { [bestPosition]: rating },
    stats: {},
  };
}

function createChampionsLeagueDummyTeam(world, index) {
  const id = `cl-dummy-${index + 1}`;
  const rating = 56 + index * 1.2;
  const team = {
    name: `CL Dummy ${index + 1}`,
    players: Array.from({ length: 16 }, (_, playerIndex) => dummyPlayer(id, playerIndex, round(rating + (playerIndex % 5) * 0.4, 2))),
  };
  const worldTeam = {
    id,
    name: team.name,
    country: "CL",
    leagueId: "champions-league",
    teamLevel: calculateTeamLevel(team),
    competitionOnly: true,
    dummy: true,
    plan: autoPlanForTeam(team, world.seed, 1000 + index),
    team,
  };
  world.playerStates[id] = Object.fromEntries(team.players.map((player) => [player.id, emptyPlayerState(player, {
    seed: world.seed,
    teamId: id,
    teamLevel: worldTeam.teamLevel,
    leagueLevel: 58,
  })]));
  world.teams.push(worldTeam);
  return worldTeam;
}

function makeChampionsLeaguePots(entrants) {
  const sorted = [...entrants].sort((a, b) => Number(b.seedRating || 0) - Number(a.seedRating || 0) || a.team.localeCompare(b.team, "ja"));
  return [0, 1, 2, 3].map((potIndex) => sorted.slice(potIndex * 8, potIndex * 8 + 8).map((entry) => ({
    ...entry,
    pot: potIndex + 1,
  })));
}

function makeChampionsLeagueLeaguePhasePairs(entries, seed) {
  const pots = [1, 2, 3, 4].map((pot) =>
    shuffledTeamIds(entries.filter((entry) => entry.pot === pot).map((entry) => entry.teamId), `${seed}:cl-pot:${pot}`));
  const pairs = [];

  for (const pot of pots) {
    for (let index = 0; index < pot.length; index += 1) {
      pairs.push([pot[index], pot[(index + 1) % pot.length]]);
    }
  }

  for (let firstPot = 0; firstPot < pots.length; firstPot += 1) {
    for (let secondPot = firstPot + 1; secondPot < pots.length; secondPot += 1) {
      const first = pots[firstPot];
      const second = pots[secondPot];
      const offsetSeed = createRng(`${seed}:cl-cross:${firstPot + 1}:${secondPot + 1}`);
      const firstOffset = 1 + Math.floor(offsetSeed() * Math.max(1, second.length - 1));
      const secondOffset = ((firstOffset + 3) % second.length) || 2;
      for (let index = 0; index < first.length; index += 1) {
        pairs.push([first[index], second[(index + firstOffset) % second.length]]);
        pairs.push([first[index], second[(index + secondOffset) % second.length]]);
      }
    }
  }

  return shuffledTeamIds(pairs.map((_, index) => index), `${seed}:cl-pair-order`).map((index) => pairs[index]);
}

function makeChampionsLeagueDates(startDate, endDate) {
  const startYear = parseDate(startDate).getUTCFullYear();
  const endYear = parseDate(endDate).getUTCFullYear();
  return {
    leaguePhase: [
      `${startYear}-09-24`,
      `${startYear}-10-22`,
      `${startYear}-11-12`,
      `${startYear}-12-10`,
      `${endYear}-01-14`,
      `${endYear}-01-28`,
      `${endYear}-02-11`,
      `${endYear}-02-25`,
    ],
    playoff: [`${endYear}-03-11`, `${endYear}-03-18`],
    round16: [`${endYear}-04-01`, `${endYear}-04-08`],
    quarter: [`${endYear}-04-22`, `${endYear}-04-29`],
    semi: [`${endYear}-05-13`, `${endYear}-05-20`],
    final: [`${endYear}-06-03`, `${endYear}-06-10`],
  };
}

function emptyChampionsLeagueStanding(entry, index) {
  return {
    teamId: entry.teamId,
    name: entry.team,
    rank: index + 1,
    pot: entry.pot,
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
    dummy: Boolean(entry.dummy),
    countryKey: entry.countryKey,
  };
}

function rankChampionsLeagueStandings(standings) {
  return rankStandings(standings);
}

function addChampionsLeague(world, calendarByDate) {
  const selection = selectChampionsLeagueEntrants(world);
  const championsLeague = world.futureCompetitions.championsLeague;
  championsLeague.enabled = selection.enabled;
  championsLeague.missingCountries = selection.missingCountries;
  championsLeague.format = "current-football-cl";
  if (!selection.enabled) return;

  const entrants = [...selection.entrants];
  while (entrants.length < 32) {
    const dummy = createChampionsLeagueDummyTeam(world, entrants.length - selection.entrants.length);
    entrants.push({
      teamId: dummy.id,
      team: dummy.name,
      leagueId: "champions-league",
      league: "Champions League",
      country: "CL",
      countryKey: "dummy",
      rank: entrants.length + 1,
      seedRating: dummy.teamLevel,
      dummy: true,
    });
  }

  const pots = makeChampionsLeaguePots(entrants);
  const entries = pots.flat();
  const pairs = makeChampionsLeagueLeaguePhasePairs(entries, world.scheduleSeed || world.seed);
  const dates = makeChampionsLeagueDates(world.season.startDate, world.season.endDate);
  const homeCounts = Object.fromEntries(entries.map((entry) => [entry.teamId, 0]));
  const rounds = Array.from({ length: 8 }, (_, index) => ({
    round: index + 1,
    label: `League Phase ${index + 1}`,
    date: dates.leaguePhase[index],
    fixtureIds: [],
  }));

  for (const [matchIndex, pair] of pairs.entries()) {
    const roundIndex = matchIndex % 8;
    const [first, second] = pair;
    const homeTeamId = homeCounts[first] <= homeCounts[second] ? first : second;
    const awayTeamId = homeTeamId === first ? second : first;
    homeCounts[homeTeamId] += 1;
    const date = findAvailableFixtureDate(calendarByDate, rounds[roundIndex].date, [homeTeamId, awayTeamId], {
      startDate: world.season.startDate,
      endDate: world.season.endDate,
      minRestDays: 3,
      maxShift: 14,
      allowedWeekdays: [2, 3, 4],
    });
    const fixture = {
      id: `cl-league-r${roundIndex + 1}-m${Math.floor(matchIndex / 8) + 1}`,
      competitionId: "champions-league",
      competitionName: "Champions League",
      competitionKind: "champions-league",
      phase: "league",
      round: roundIndex + 1,
      date,
      homeTeamId,
      awayTeamId,
      status: "scheduled",
      result: null,
    };
    calendarDay(calendarByDate, date).fixtures.push(fixture);
    rounds[roundIndex].fixtureIds.push(fixture.id);
  }

  championsLeague.entrants = entries;
  championsLeague.pots = pots;
  championsLeague.leaguePhase = { rounds, completed: false };
  championsLeague.standings = entries.map((entry, index) => emptyChampionsLeagueStanding(entry, index));
  championsLeague.knockoutRounds = [];
  championsLeague.completed = false;
  championsLeague.championTeamId = null;
}

function nationsLeagueWindows(startDate, endDate) {
  const startYear = parseDate(startDate).getUTCFullYear();
  const endYear = parseDate(endDate).getUTCFullYear();
  const baseDates = [
    `${startYear}-10-02`,
    `${startYear}-11-06`,
    `${endYear}-01-22`,
    `${endYear}-03-12`,
    `${endYear}-06-10`,
  ].filter((date) => compareDate(date, startDate) >= 0 && compareDate(date, endDate) <= 0);
  return baseDates.map((start, index) => ({
    index,
    start,
    matchDates: [start, addDays(start, 3), addDays(start, 6)],
    blockedDates: Array.from({ length: 9 }, (_, offset) => addDays(start, offset - 1)),
  }));
}

function nationKeyFromText(value = "") {
  const text = String(value).toLowerCase();
  const aliases = [
    ["usa", ["usa", "america", "アメリカ"]],
    ["japan", ["japan", "日本"]],
    ["germany", ["germany", "german", "ドイツ"]],
    ["england", ["england", "uk", "イングランド", "イギリス", "英国"]],
    ["france", ["france", "フランス"]],
    ["italy", ["italy", "イタリア"]],
    ["canada", ["canada", "カナダ"]],
    ["mexico", ["mexico", "メキシコ"]],
    ["korea", ["korea", "韓国"]],
    ["russia", ["russia", "ロシア"]],
    ["brazil", ["brazil", "ブラジル"]],
    ["australia", ["australia", "オーストラリア"]],
    ["china", ["china", "中国"]],
    ["india", ["india", "インド"]],
    ["spain", ["spain", "スペイン"]],
    ["indonesia", ["indonesia", "インドネシア"]],
  ];
  return aliases.find(([, words]) => words.some((word) => text.includes(word)))?.[0] || "";
}

function dummyNationalPlayer(nation, index) {
  const positions = ["1", "2", "3", "4", "5", "6", "7", "10", "11", "14", "17"];
  const rating = 54 + (index % 7) * 1.1;
  const bestPosition = positions[index % positions.length];
  return {
    id: `nation-${nation.key}-dummy-${index + 1}`,
    name: `${nation.country} Dummy ${index + 1}`,
    fullName: `${nation.country} Dummy ${index + 1}`,
    age: 22 + (index % 10),
    nationality: nation.country,
    bestPosition,
    rating,
    positionRatings: { [bestPosition]: rating },
    stats: {},
    nationalDummy: true,
  };
}

function createNationsLeagueTeams(world) {
  const teams = [];
  for (const [index, nation] of nationsLeagueDivisionOne.entries()) {
    const id = `nation-${nation.key}`;
    const team = {
      name: nation.name,
      players: Array.from({ length: 18 }, (_, playerIndex) => dummyNationalPlayer(nation, playerIndex)),
    };
    const worldTeam = {
      id,
      name: nation.name,
      country: nation.country,
      countryKey: nation.key,
      leagueId: "nations-league-division-1",
      teamLevel: calculateTeamLevel(team),
      competitionOnly: true,
      nationalTeam: true,
      plan: autoPlanForTeam(team, world.seed, 2000 + index),
      team,
    };
    world.playerStates[id] = {};
    world.teams.push(worldTeam);
    teams.push(worldTeam);
  }
  return teams;
}

function normalizeNationsLeagueCarryover(carryover) {
  if (!carryover || carryover.ruleset !== "luminous-sword-nations-league-carryover-v1") return null;
  return {
    ...carryover,
    nextRoundIndex: Math.max(0, Number(carryover.nextRoundIndex || 0)),
    cycleSeasonIndex: Math.max(1, Number(carryover.cycleSeasonIndex || 1)),
    standings: Array.isArray(carryover.standings) ? carryover.standings : [],
  };
}

function addNationsLeague(world, calendarByDate, carryoverInput = null) {
  const carryover = normalizeNationsLeagueCarryover(carryoverInput);
  const nationalTeams = createNationsLeagueTeams(world);
  const windows = nationsLeagueWindows(world.season.startDate, world.season.endDate);
  for (const window of windows) {
    for (const date of window.blockedDates) calendarByDate.blockedDates.add(date);
  }

  const teamIds = nationalTeams.map((team) => team.id);
  const allRounds = makeRoundRobinRounds(teamIds, 2);
  const startRoundIndex = carryover?.nextRoundIndex || 0;
  const rounds = allRounds.slice(startRoundIndex, startRoundIndex + windows.length * 3);
  const carryoverStandings = new Map((carryover?.standings || []).map((standing) => [standing.teamId, standing]));
  const nationsLeague = {
    id: "nations-league",
    name: "灯剣ネーションズリーグ",
    cycle: "29/30-30/31",
    division: 1,
    cycleSeasonIndex: carryover?.cycleSeasonIndex || 1,
    totalCycleRounds: allRounds.length,
    startRoundIndex,
    nextRoundIndex: startRoundIndex,
    format: "two-season-double-round-robin",
    windows,
    teamIds,
    standings: nationalTeams.map((team, index) => ({
      ...emptyStanding(team, index, 3, 1),
      ...(carryoverStandings.get(team.id) || {}),
      teamId: team.id,
      name: team.name,
      pointsForWin: 3,
      pointsForDraw: 1,
    })),
    rounds: [],
    completed: false,
    seasonCompleted: false,
    cycleCompleted: false,
    promotionRelegation: carryover?.promotionRelegation || null,
  };

  for (const [roundIndex, matches] of rounds.entries()) {
    const windowIndex = Math.floor(roundIndex / 3);
    const matchDate = windows[windowIndex]?.matchDates[roundIndex % 3];
    const absoluteRoundIndex = startRoundIndex + roundIndex;
    if (!matchDate) continue;
    const round = {
      round: absoluteRoundIndex + 1,
      label: `NL ${absoluteRoundIndex + 1}`,
      windowIndex,
      date: matchDate,
      fixtureIds: [],
    };
    for (const [matchIndex, match] of matches.entries()) {
      const fixture = {
        id: `nl-d1-r${absoluteRoundIndex + 1}-m${matchIndex + 1}`,
        competitionId: nationsLeague.id,
        competitionName: nationsLeague.name,
        competitionKind: "nations-league",
        phase: "division-1",
        windowIndex,
        round: absoluteRoundIndex + 1,
        date: matchDate,
        homeTeamId: match.home,
        awayTeamId: match.away,
        status: "scheduled",
        result: null,
      };
      calendarDay(calendarByDate, matchDate).fixtures.push(fixture);
      round.fixtureIds.push(fixture.id);
    }
    nationsLeague.rounds.push(round);
  }

  nationsLeague.standings = rankStandings(nationsLeague.standings);
  nationsLeague.nextRoundIndex = startRoundIndex + nationsLeague.rounds.length;
  world.futureCompetitions.nationsLeague = nationsLeague;
}

function leagueTeamName(team, fallback) {
  if (!team) return fallback;
  if (Array.isArray(team)) return fallback;
  return team.name || team.teamName || fallback;
}

function emptyStanding(worldTeam, index, pointsForWin, pointsForDraw) {
  return {
    teamId: worldTeam.id,
    name: worldTeam.name,
    rank: index + 1,
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
    clQualified: false,
    pointsForWin,
    pointsForDraw,
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

function autoPlanForTeam(team, seed, index) {
  const formationKeys = ["f313", "f223", "f232", "f331", "f241", "f322", "f421", "f412"];
  const rng = createRng(`${seed}:plan:${team.name}:${index}`);
  const baseFormation = formationKeys[Math.floor(rng() * formationKeys.length) % formationKeys.length] || "f313";
  const profile = rateTeam(team, { formation: baseFormation, name: team.name }).profile;
  let tactic = "balanced";

  if (profile.steal > profile.retention + 3) tactic = "press";
  else if (profile.retention > profile.emission + 3) tactic = "possession";
  else if (profile.emission > profile.flow + 2) tactic = "direct";
  else if (profile.defense > profile.attack + 3) tactic = "defensive";
  else if (profile.attack > profile.control + 2) tactic = "counter";

  return { formation: baseFormation, tactic };
}

function contractRoleForPlayer(player, teamLevel = 70) {
  const rating = playerRating(player);
  const age = Number(player.age || 24);
  if (age <= 21) return rating >= teamLevel - 1 ? "young-core" : "prospect";
  if (age >= 33) return rating >= teamLevel - 2 ? "veteran-core" : "veteran";
  if (rating >= teamLevel + 3) return "key";
  if (rating >= teamLevel - 2) return "rotation";
  return "squad";
}

function salaryForContract(player, role, rng) {
  const rating = playerRating(player);
  const age = Number(player.age || 24);
  const rolePremium = {
    key: 1.28,
    "young-core": 1.12,
    "veteran-core": 1.08,
    rotation: 0.92,
    prospect: 0.58,
    veteran: 0.70,
    squad: 0.62,
  }[role] || 0.75;
  const agePremium = age <= 21 ? 0.72 : age <= 24 ? 0.88 : age <= 29 ? 1.04 : age <= 32 ? 0.98 : 0.82;
  return round(clamp(rating * rolePremium * agePremium * (0.92 + rng() * 0.18), 8, 180), 2);
}

function yearsForContract(player, role, rng) {
  const age = Number(player.age || 24);
  if (role === "prospect" || role === "young-core") return 3 + Math.floor(rng() * 3);
  if (age >= 34) return 1 + Math.floor(rng() * 2);
  if (age >= 31) return 2 + Math.floor(rng() * 2);
  if (role === "key") return 3 + Math.floor(rng() * 3);
  return 2 + Math.floor(rng() * 4);
}

function releaseClauseForContract(player, salaryIndex, role, leagueLevel = 70, rng) {
  if (role === "prospect" && rng() < 0.45) return null;
  const rating = playerRating(player);
  const rolePremium = role === "key" || role === "young-core" ? 2.3 : role === "rotation" ? 1.8 : 1.35;
  return round(clamp((rating * 1.1 + salaryIndex) * rolePremium * (0.78 + leagueLevel / 100 * 0.7), 20, 650), 2);
}

function makeInitialContract(player, context = {}) {
  const seed = `${context.seed || "contract"}:${context.teamId || "team"}:${player.id || player.fullName || player.name}`;
  const rng = createRng(seed);
  const teamLevel = Number(context.teamLevel || 70);
  const leagueLevel = Number(context.leagueLevel || 70);
  const role = contractRoleForPlayer(player, teamLevel);
  const years = yearsForContract(player, role, rng);
  const salaryIndex = salaryForContract(player, role, rng);
  return {
    years,
    salaryIndex,
    releaseClauseIndex: releaseClauseForContract(player, salaryIndex, role, leagueLevel, rng),
    role,
    extensionMood: round(clamp(0.44 + rng() * 0.26, 0, 1), 3),
    status: "active",
  };
}

function emptyPlayerState(player, context = {}) {
  return {
    playerId: player.id,
    name: player.fullName,
    contract: player.contract || makeInitialContract(player, context),
    fatigue: 0,
    conditionDelta: Number.isFinite(Number(player.conditionDelta)) ? clamp(Number(player.conditionDelta), -10, 10) : 0,
    formTrend: 0,
    conduitLoad: 0,
    injury: null,
    season: {
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
    },
  };
}

function playerRating(player) {
  return Number.isFinite(Number(player.rating)) ? Number(player.rating) : 0;
}

function average(values, fallback = 0) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return fallback;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function calculateTeamLevel(team) {
  const ratings = (team.players || [])
    .map(playerRating)
    .filter((rating) => rating > 0)
    .sort((a, b) => b - a);
  if (!ratings.length) return 50;
  const starting = average(ratings.slice(0, 7), ratings[0]);
  const rotation = average(ratings.slice(0, Math.min(14, ratings.length)), starting);
  const roster = average(ratings, rotation);
  return round(clamp(starting * 0.48 + rotation * 0.34 + roster * 0.18, 1, 100), 2);
}

function calculateLeagueLevel(teams) {
  const levels = teams
    .map((team) => Number(team.teamLevel))
    .filter((level) => Number.isFinite(level) && level > 0)
    .sort((a, b) => b - a);
  if (!levels.length) return 50;
  const topCount = Math.max(1, Math.ceil(levels.length * 0.25));
  const top = average(levels.slice(0, topCount), levels[0]);
  const upperHalf = average(levels.slice(0, Math.max(1, Math.ceil(levels.length * 0.5))), top);
  const all = average(levels, upperHalf);
  return round(clamp(top * 0.45 + upperHalf * 0.30 + all * 0.25, 1, 100), 2);
}

function calculateTeamFinance(teamLevel, leagueLevel = 70) {
  const level = Number(teamLevel || 50);
  const league = Number(leagueLevel || 70);
  const financialPowerIndex = round(clamp(level * 0.74 + league * 0.26, 1, 100), 2);
  const transferBudgetIndex = round(clamp(financialPowerIndex * 0.62 + Math.max(0, level - 72) * 1.15, 12, 145), 2);
  const wageBudgetIndex = round(clamp(financialPowerIndex * 1.18 + Math.max(0, level - 78) * 1.6, 25, 230), 2);
  return {
    source: "team-level",
    financialPowerIndex,
    transferBudgetIndex,
    remainingTransferBudgetIndex: transferBudgetIndex,
    wageBudgetIndex,
  };
}

function createWorldTeam(rawTeam, league, teamIndex, globalIndex, seed) {
  const fallback = `${league.name || league.country || "League"} ${teamIndex + 1}`;
  const normalized = normalizeTeam(rawTeam, leagueTeamName(rawTeam, fallback));
  if (normalized.players.length < 7) {
    throw new Error(`${normalized.name} は7人未満のためワールドに登録できません。`);
  }

  const id = `team-${globalIndex + 1}`;
  const team = {
    ...normalized,
    players: normalized.players.map((player) => ({
      ...player,
      id: String(player.id),
    })),
  };

  const teamLevel = calculateTeamLevel(team);
  return {
    id,
    name: team.name,
    country: league.country || "",
    leagueId: league.id,
    teamLevel,
    finance: calculateTeamFinance(teamLevel, league.leagueLevel || 70),
    previousSeason: rawTeam?.previousSeason || rawTeam?.seasonTransition || null,
    plan: autoPlanForTeam(team, seed, globalIndex),
    team,
  };
}

function updateLeagueQualification(league) {
  league.standings = rankStandings(league.standings).map((standing) => ({
    ...standing,
    clQualified: standing.rank <= Number(league.clSlots || 0),
  }));
  league.clQualifiedTeamIds = league.standings.filter((standing) => standing.clQualified).map((standing) => standing.teamId);
}

export function createWorld(options = {}) {
  const settings = { ...defaultWorldOptions, ...options };
  const draftLeagues = Array.isArray(options.leagues) ? options.leagues : [];
  if (!draftLeagues.length) throw new Error("ワールドには少なくとも1つのリーグが必要です。");

  const world = {
    id: `world-${Date.now().toString(36)}`,
    ruleset: "luminous-sword-world-v1",
    seed: settings.seed || defaultWorldOptions.seed,
    scheduleSeed: settings.scheduleSeed || defaultWorldOptions.scheduleSeed,
    season: {
      label: settings.seasonLabel || defaultWorldOptions.seasonLabel,
      startDate: settings.startDate || defaultWorldOptions.startDate,
      endDate: settings.endDate || defaultWorldOptions.endDate,
    },
    currentDate: settings.startDate || defaultWorldOptions.startDate,
    progressedDays: 0,
    completed: false,
    phase: "season",
    teams: [],
    leagues: [],
    calendar: [],
    playerStates: {},
    results: [],
    news: [],
    latestSummary: null,
    futureCompetitions: {
      domesticCups: [],
      championsLeague: {
        entrants: [],
        format: "pending",
      },
    },
  };

  let globalTeamIndex = 0;
  for (const [leagueIndex, draft] of draftLeagues.entries()) {
    const league = {
      id: `league-${leagueIndex + 1}`,
      name: draft.name || draft.leagueName || `${draft.country || "国内"}リーグ`,
      country: draft.country || "",
      countryKey: draft.countryKey || countryKeyFromText(`${draft.country || ""} ${draft.name || draft.leagueName || ""}`),
      format: draft.format || settings.format,
      scheduleSeed: `${settings.scheduleSeed || defaultWorldOptions.scheduleSeed}:${draft.name || draft.leagueName || leagueIndex + 1}`,
      clSlots: Number(draft.clSlots ?? settings.clSlots ?? 0),
      pointsForWin: Number(draft.pointsForWin ?? settings.pointsForWin),
      pointsForDraw: Number(draft.pointsForDraw ?? settings.pointsForDraw),
      worldSeason: {
        startDate: settings.startDate || defaultWorldOptions.startDate,
        endDate: settings.endDate || defaultWorldOptions.endDate,
      },
      teamIds: [],
      teamGroups: {},
      groupTemplate: Array.isArray(draft.groupTemplate) ? draft.groupTemplate : [],
      rounds: [],
      standings: [],
      clQualifiedTeamIds: [],
      scheduleComplete: !isDynamicLeagueFormat(draft.format || settings.format),
      dynamicSchedule: isDynamicLeagueFormat(draft.format || settings.format)
        ? { phase: draft.format === "regional-mixed" ? "regional" : "regular", generated: false, groups: [] }
        : null,
    };

    const rawTeams = Array.isArray(draft.teams) ? draft.teams : [];
    if (rawTeams.length < 2) throw new Error(`${league.name} は2チーム以上必要です。`);

    for (const [teamIndex, rawTeam] of rawTeams.entries()) {
      const worldTeam = createWorldTeam(rawTeam, league, teamIndex, globalTeamIndex, world.seed);
      globalTeamIndex += 1;
      league.teamIds.push(worldTeam.id);
      const group = draftTeamGroup(draft, teamIndex);
      if (group) league.teamGroups[worldTeam.id] = group;
      world.teams.push(worldTeam);
    }

    league.leagueLevel = calculateLeagueLevel(world.teams.filter((team) => team.leagueId === league.id));
    for (const worldTeam of world.teams.filter((team) => team.leagueId === league.id)) {
      worldTeam.finance = calculateTeamFinance(worldTeam.teamLevel, league.leagueLevel);
      world.playerStates[worldTeam.id] = Object.fromEntries(
        worldTeam.team.players.map((player) => [player.id, emptyPlayerState(player, {
          seed: world.seed,
          teamId: worldTeam.id,
          teamLevel: worldTeam.teamLevel,
          leagueLevel: league.leagueLevel,
        })]),
      );
    }
    world.leagues.push(league);
  }

  for (const league of world.leagues) {
    const leagueTeams = league.teamIds.map((teamId) => world.teams.find((team) => team.id === teamId));
    league.standings = leagueTeams.map((team, index) =>
      emptyStanding(team, index, league.pointsForWin, league.pointsForDraw));

    const indexRounds = initialLeagueMatches(league);
    league.rounds = indexRounds.map((matches, roundIndex) => ({
      round: roundIndex + 1,
      label: `第${roundIndex + 1}節`,
      fixtureIds: matches.map((_, matchIndex) => `${league.id}-r${roundIndex + 1}-m${matchIndex + 1}`),
    }));
    if (league.format === "regional-mixed") league.dynamicSchedule.groups = regionalGroupsForLeague(league);
    updateLeagueQualification(league);
  }

  const maxRounds = Math.max(...world.leagues.map((league) => league.rounds.length));
  const dates = fixtureDateSlots(world.season.startDate, maxRounds, world.season.endDate);
  const calendarByDate = new Map();
  calendarByDate.blockedDates = new Set(nationsLeagueWindows(world.season.startDate, world.season.endDate)
    .flatMap((window) => window.blockedDates));

  for (const league of world.leagues) {
    const indexRounds = initialLeagueMatches(league);

    for (const [roundIndex, matches] of indexRounds.entries()) {
      const date = dates[roundIndex];
      for (const [matchIndex, match] of matches.entries()) {
        const fixtureDate = findAvailableFixtureDate(calendarByDate, date, [match.home, match.away], {
          startDate: world.season.startDate,
          endDate: world.season.endDate,
          minRestDays: 2,
          maxShift: 6,
          allowedWeekdays: [3, 6],
        });
        const fixture = {
          id: `${league.id}-r${roundIndex + 1}-m${matchIndex + 1}`,
          competitionId: league.id,
          competitionName: league.name,
          competitionKind: "league",
          phase: league.format === "regional-mixed" ? "regional" : "regular",
          round: roundIndex + 1,
          date: fixtureDate,
          homeTeamId: match.home,
          awayTeamId: match.away,
          status: "scheduled",
          result: null,
        };
        calendarDay(calendarByDate, fixtureDate).fixtures.push(fixture);
      }
    }
  }

  if (settings.enableDomesticCups !== false) {
    addDomesticCups(world, calendarByDate);
  }

  addChampionsLeague(world, calendarByDate);
  addNationsLeague(world, calendarByDate, settings.nationsLeagueCarryover);

  world.calendar = [...calendarByDate.values()].sort((a, b) => compareDate(a.date, b.date));
  return world;
}

function teamById(world, teamId) {
  const team = world.teams.find((item) => item.id === teamId);
  if (!team) throw new Error(`Unknown team: ${teamId}`);
  return team;
}

function leagueById(world, leagueId) {
  const league = world.leagues.find((item) => item.id === leagueId);
  if (!league) throw new Error(`Unknown league: ${leagueId}`);
  return league;
}

function leagueForTeam(world, team) {
  return world.leagues.find((league) => league.id === team.leagueId) || null;
}

function standingByTeam(league, teamId) {
  const standing = league.standings.find((item) => item.teamId === teamId);
  if (!standing) throw new Error(`Unknown standing: ${teamId}`);
  return standing;
}

function dailyRecoveryAmount(dateText, state) {
  const offSeason = monthOf(dateText) === 8;
  const injuryBonus = state.injury?.daysRemaining > 0 ? 0.35 : 0;
  return offSeason ? 1.85 + injuryBonus : 0.92 + injuryBonus;
}

function driftTowardZero(value, amount) {
  if (value > 0) return Math.max(0, value - amount);
  if (value < 0) return Math.min(0, value + amount);
  return 0;
}

function applyDailyRecovery(world, summary) {
  for (const team of world.teams) {
    const states = world.playerStates[team.id] || {};
    for (const player of team.team.players) {
      const state = states[player.id] || emptyPlayerState(player);
      const recovery = dailyRecoveryAmount(world.currentDate, state);
      state.fatigue = round(Math.max(0, Number(state.fatigue || 0) - recovery), 2);
      state.conditionDelta = round(driftTowardZero(Number(state.conditionDelta || 0), state.conditionDelta > 0 ? 0.05 : 0.08), 2);
      state.formTrend = round(driftTowardZero(Number(state.formTrend || 0), 0.06), 2);

      if (state.injury?.daysRemaining > 0) {
        state.injury.daysRemaining -= 1;
        if (state.injury.daysRemaining <= 0) {
          summary.recoveries.push({ team: team.name, player: player.fullName, injury: state.injury.name });
          state.injury = null;
        }
      }

      states[player.id] = state;
    }
    world.playerStates[team.id] = states;
  }
}

function injuryPenalty(state) {
  if (!state.injury?.daysRemaining) return 0;
  if (state.injury.daysRemaining >= 14) return -8;
  if (state.injury.daysRemaining >= 4) return -6;
  return -3.5;
}

function matchTeamFromWorld(world, worldTeam) {
  const states = world.playerStates[worldTeam.id] || {};
  const decorated = worldTeam.team.players.map((player) => {
    const state = states[player.id] || emptyPlayerState(player);
    return {
      ...player,
      conditionDelta: round(clamp(
        Number(state.conditionDelta || 0) - Number(state.fatigue || 0) * 0.68 + injuryPenalty(state),
        -10,
        10,
      ), 2),
      seasonFatigue: round(Number(state.fatigue || 0), 2),
      worldInjury: state.injury || null,
      worldUnavailable: Boolean(state.injury?.daysRemaining > 0 && state.injury.daysRemaining >= 2),
    };
  });

  let players = decorated.filter((player) => !player.worldUnavailable);
  if (players.length < 7) {
    players = decorated
      .sort((a, b) => Number(a.worldInjury?.daysRemaining || 0) - Number(b.worldInjury?.daysRemaining || 0))
      .slice(0, Math.max(7, Math.min(decorated.length, 16)));
  }

  return {
    name: worldTeam.name,
    players,
  };
}

function playerNationKey(player, clubTeam, league) {
  return nationKeyFromText(player.nationality || player.country || "") ||
    nationKeyFromText(clubTeam.countryKey || league?.countryKey || clubTeam.country || league?.country || "");
}

function nationalCallupScore(player, state) {
  const rating = playerRating(player);
  const fatiguePenalty = Number(state?.fatigue || 0) * 0.42;
  const form = Number(state?.formTrend || 0) * 0.35 + Number(state?.conditionDelta || 0) * 0.18;
  const age = Number(player.age || 24);
  const youthBonus = age <= 22 ? 0.8 : 0;
  const injuryPenalty = state?.injury?.daysRemaining > 0 ? 100 : 0;
  return rating + form + youthBonus - fatiguePenalty - injuryPenalty;
}

function nationalTeamCandidates(world, nationKey) {
  const candidates = [];
  for (const clubTeam of (world.teams || []).filter((team) => !team.competitionOnly)) {
    const league = leagueForTeam(world, clubTeam);
    const states = world.playerStates?.[clubTeam.id] || {};
    for (const player of clubTeam.team?.players || []) {
      if (playerNationKey(player, clubTeam, league) !== nationKey) continue;
      const state = states[player.id] || {};
      if (state.injury?.daysRemaining > 0 && state.injury.daysRemaining >= 2) continue;
      candidates.push({
        player,
        state,
        clubTeam,
        score: nationalCallupScore(player, state),
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || playerRating(b.player) - playerRating(a.player));
}

function callupPlayerForNation(nationTeam, entry) {
  return {
    ...entry.player,
    id: `${nationTeam.id}__${entry.clubTeam.id}__${entry.player.id}`,
    sourceClubTeamId: entry.clubTeam.id,
    sourcePlayerId: entry.player.id,
    clubTeamName: entry.clubTeam.name,
    nationalTeamId: nationTeam.id,
  };
}

function updateNationsLeagueCallups(world, windowIndex) {
  const nationsLeague = world.futureCompetitions?.nationsLeague;
  if (!nationsLeague || nationsLeague.lastCallupWindow === windowIndex) return;

  for (const nationTeamId of nationsLeague.teamIds || []) {
    const nationTeam = world.teams.find((team) => team.id === nationTeamId);
    if (!nationTeam) continue;
    const nation = nationsLeagueDivisionOne.find((item) => `nation-${item.key}` === nationTeam.id) || { key: nationTeam.countryKey, country: nationTeam.country };
    const selected = nationalTeamCandidates(world, nation.key).slice(0, 18);
    const players = selected.map((entry) => callupPlayerForNation(nationTeam, entry));
    while (players.length < 18) players.push(dummyNationalPlayer(nation, players.length));
    nationTeam.team = {
      ...nationTeam.team,
      players,
    };
    nationTeam.teamLevel = calculateTeamLevel(nationTeam.team);
    nationTeam.lastCallupWindow = windowIndex;
    nationTeam.callupSummary = {
      windowIndex,
      realPlayers: selected.length,
      dummyPlayers: Math.max(0, 18 - selected.length),
    };
  }

  nationsLeague.lastCallupWindow = windowIndex;
}

function statsById(result, side) {
  return new Map((result.teams?.[side]?.playerStats || []).map((stat) => [String(stat.id), stat]));
}

function seasonStatsFor(state) {
  state.season = state.season || emptyPlayerState({ id: state.playerId, fullName: state.name }).season;
  return state.season;
}

function playerImpactScore(stat, minutes, outcome) {
  const passRate = stat.passes ? stat.completedPasses / stat.passes : 0;
  const scoring = (stat.goals || 0) * 4.8 + (stat.assists || 0) * 3.4 + (stat.shots || 0) * 0.08;
  const defense = (stat.steals || 0) * 0.68 + (stat.interceptions || 0) * 0.58 + (stat.blocks || 0) * 0.72;
  const flow = (stat.completedPasses || 0) * 0.018 + passRate * 0.45;
  const outcomeBonus = outcome === "win" ? 0.42 : outcome === "draw" ? 0.08 : -0.28;
  const quietPenalty = minutes >= 35 && scoring + defense < 0.5 ? -0.42 : 0;
  return scoring + defense + flow + outcomeBonus + quietPenalty;
}

function injuryNameFor(player, stat, rng) {
  const position = String(player.bestPosition || "");
  const shots = Number(stat.shots || 0);
  const defensive = Number(stat.blocks || 0) + Number(stat.interceptions || 0) + Number(stat.steals || 0);

  if (["4", "10", "14"].includes(position)) return rng() < 0.58 ? "導流腱炎" : "保持疲労";
  if (["7", "17"].includes(position)) return shots >= 2 || rng() < 0.55 ? "脱力性虚脱" : "導流肘";
  if (["1", "11"].includes(position)) return defensive >= 2 || rng() < 0.62 ? "過負荷吸収症" : "奪取時衝撃";
  if (["2", "3", "12", "13"].includes(position)) return rng() < 0.52 ? "奪取時衝撃" : "導流腱炎";
  if (["5", "6", "15", "16"].includes(position)) return rng() < 0.5 ? "導流腱炎" : "ルミナス酔い";
  return rng() < 0.5 ? "通常外傷" : "ルミナス酔い";
}

function injurySeverity(name, fatigue, rng) {
  const pressure = rng() + clamp((fatigue - 5) / 18, 0, 0.22);
  let days;
  let severity;

  if (name === "脱力性虚脱" || name === "ルミナス酔い") {
    days = pressure < 0.74 ? 1 + Math.floor(rng() * 3) : 5 + Math.floor(rng() * 7);
  } else if (pressure < 0.58) {
    days = 1 + Math.floor(rng() * 4);
  } else if (pressure < 0.84) {
    days = 6 + Math.floor(rng() * 9);
  } else if (pressure < 0.98) {
    days = 18 + Math.floor(rng() * 28);
  } else {
    days = 60 + Math.floor(rng() * 62);
  }

  if (days <= 3) severity = "軽度";
  else if (days <= 14) severity = "短期離脱";
  else if (days <= 50) severity = "中期離脱";
  else severity = "長期離脱";

  return { days, severity };
}

function maybeCreateInjury(player, state, stat, minutes, box, seed) {
  if (state.injury?.daysRemaining > 0 || minutes <= 0) return null;
  const rng = createRng(seed);
  const playedShare = minutes / Math.max(1, defaultMatchOptions.sections * defaultMatchOptions.minutesPerSection);
  const actionLoad =
    Number(stat.shots || 0) * 0.003 +
    Number(stat.passes || 0) * 0.00075 +
    (Number(stat.steals || 0) + Number(stat.interceptions || 0) + Number(stat.blocks || 0)) * 0.0022;
  const fatigueRisk = clamp((Number(state.fatigue || 0) - 4.5) / 5.5, 0, 1.4) * 0.022;
  const conduitRisk = clamp(Number(box.conduitLoad || 0) / 150, 0, 1) * 0.006;
  const ageRisk = Math.max(0, Number(player.age || 24) - 29) * 0.0009;
  const risk = 0.003 + playedShare * 0.0065 + actionLoad + fatigueRisk + conduitRisk + ageRisk;

  if (rng() >= risk) return null;

  const name = injuryNameFor(player, stat, rng);
  const severity = injurySeverity(name, Number(state.fatigue || 0), rng);
  return {
    name,
    severity: severity.severity,
    daysRemaining: severity.days,
    totalDays: severity.days,
  };
}

function applyPlayerMatchState(world, worldTeam, result, side, outcome, summary, fixture) {
  const usage = result.usage?.[side] || {};
  const statMap = statsById(result, side);
  const states = world.playerStates[worldTeam.id] || {};
  const box = result.boxScore?.[side] || {};
  const conduitFactor = clamp(Number(box.conduitLoad || 0) / 120, 0, 1.35);
  const impactFactor = clamp(Number(box.fatigueImpact || 0) / 9, 0, 1.25);

  for (const [playerId, rawMinutes] of Object.entries(usage)) {
    const player = worldTeam.team.players.find((item) => item.id === String(playerId));
    if (!player) continue;
    const state = states[player.id] || emptyPlayerState(player);
    const minutes = Number(rawMinutes) || 0;
    const stat = statMap.get(player.id) || { id: player.id, name: player.fullName };
    const season = seasonStatsFor(state);
    const playedShare = minutes / Math.max(1, defaultMatchOptions.sections * defaultMatchOptions.minutesPerSection);
    const addedFatigue = playedShare * (2.05 + conduitFactor * 0.72 + impactFactor * 0.95);
    const impactScore = playerImpactScore(stat, minutes, outcome);
    const expectedImpact = minutes >= 45 ? 0.65 : minutes >= 20 ? 0.38 : 0.18;
    const conditionChange = clamp((impactScore - expectedImpact) * 0.28 - Math.max(0, state.fatigue - 7) * 0.035, -1.3, 1.35);

    state.fatigue = round(clamp(Number(state.fatigue || 0) + addedFatigue, 0, 10), 2);
    state.conditionDelta = round(clamp(Number(state.conditionDelta || 0) + conditionChange, -10, 10), 2);
    state.formTrend = round(clamp(Number(state.formTrend || 0) * 0.72 + conditionChange, -10, 10), 2);
    state.conduitLoad = round(Number(state.conduitLoad || 0) + conduitFactor * playedShare, 3);
    state.lastPlayedDate = fixture.date;
    state.lastMatchImpact = round(impactScore, 2);

    season.matches += 1;
    season.minutes = round(Number(season.minutes || 0) + minutes, 1);
    for (const key of ["goals", "assists", "shots", "passes", "completedPasses", "steals", "interceptions", "blocks"]) {
      season[key] = Number(season[key] || 0) + Number(stat[key] || 0);
    }

    const injurySeed = `${fixture.playSeed || world.seed}:${worldTeam.id}:${player.id}`;
    const injury = maybeCreateInjury(player, state, stat, minutes, box, injurySeed);
    if (injury) {
      state.injury = injury;
      summary.injuries.push({
        team: worldTeam.name,
        player: player.fullName,
        injury: injury.name,
        severity: injury.severity,
        days: injury.daysRemaining,
      });
    }

    states[player.id] = state;
  }

  world.playerStates[worldTeam.id] = states;
}

function internationalStatsFor(state) {
  state.internationalSeason = state.internationalSeason || {
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
  return state.internationalSeason;
}

function applyNationalPlayerMatchState(world, nationalTeam, result, side, outcome, summary, fixture) {
  const usage = result.usage?.[side] || {};
  const statMap = statsById(result, side);
  const box = result.boxScore?.[side] || {};
  const conduitFactor = clamp(Number(box.conduitLoad || 0) / 120, 0, 1.35);
  const impactFactor = clamp(Number(box.fatigueImpact || 0) / 9, 0, 1.25);

  for (const [nationalPlayerId, rawMinutes] of Object.entries(usage)) {
    const nationalPlayer = nationalTeam.team.players.find((item) => item.id === String(nationalPlayerId));
    if (!nationalPlayer?.sourceClubTeamId || !nationalPlayer?.sourcePlayerId) continue;
    const clubTeam = teamById(world, nationalPlayer.sourceClubTeamId);
    const clubPlayer = clubTeam.team.players.find((item) => item.id === String(nationalPlayer.sourcePlayerId));
    if (!clubPlayer) continue;
    const states = world.playerStates[clubTeam.id] || {};
    const state = states[clubPlayer.id] || emptyPlayerState(clubPlayer);
    const minutes = Number(rawMinutes) || 0;
    const stat = statMap.get(nationalPlayer.id) || { id: nationalPlayer.id, name: nationalPlayer.fullName };
    const playedShare = minutes / Math.max(1, defaultMatchOptions.sections * defaultMatchOptions.minutesPerSection);
    const addedFatigue = playedShare * (1.45 + conduitFactor * 0.45 + impactFactor * 0.55);
    const impactScore = playerImpactScore(stat, minutes, outcome);
    const expectedImpact = minutes >= 45 ? 0.65 : minutes >= 20 ? 0.38 : 0.18;
    const conditionChange = clamp((impactScore - expectedImpact) * 0.2 - Math.max(0, state.fatigue - 7) * 0.02, -0.85, 0.95);
    const international = internationalStatsFor(state);

    state.fatigue = round(clamp(Number(state.fatigue || 0) + addedFatigue, 0, 10), 2);
    state.conditionDelta = round(clamp(Number(state.conditionDelta || 0) + conditionChange, -10, 10), 2);
    state.formTrend = round(clamp(Number(state.formTrend || 0) * 0.78 + conditionChange, -10, 10), 2);
    state.lastInternationalDate = fixture.date;
    state.lastInternationalTeam = nationalTeam.name;

    international.matches += 1;
    international.minutes = round(Number(international.minutes || 0) + minutes, 1);
    for (const key of ["goals", "assists", "shots", "passes", "completedPasses", "steals", "interceptions", "blocks"]) {
      international[key] = Number(international[key] || 0) + Number(stat[key] || 0);
    }

    const injurySeed = `${fixture.playSeed || world.seed}:national:${nationalTeam.id}:${clubTeam.id}:${clubPlayer.id}`;
    const injury = maybeCreateInjury(clubPlayer, state, stat, minutes, box, injurySeed);
    if (injury) {
      state.injury = injury;
      summary.injuries.push({
        team: clubTeam.name,
        player: clubPlayer.fullName,
        injury: injury.name,
        severity: injury.severity,
        days: injury.daysRemaining,
        internationalTeam: nationalTeam.name,
      });
    }

    states[clubPlayer.id] = state;
    world.playerStates[clubTeam.id] = states;
  }
}

function teamFatigueAverage(world, teamId) {
  const states = Object.values(world.playerStates[teamId] || {});
  if (!states.length) return 0;
  return round(states.reduce((sum, state) => sum + Number(state.fatigue || 0), 0) / states.length, 2);
}

function applyFixtureResult(world, fixture, result, summary) {
  const homeTeam = teamById(world, fixture.homeTeamId);
  const awayTeam = teamById(world, fixture.awayTeamId);
  const homeOutcome = result.winner === "home" ? "win" : result.winner === "away" ? "loss" : "draw";
  const awayOutcome = result.winner === "away" ? "win" : result.winner === "home" ? "loss" : "draw";
  if (fixture.competitionKind === "nations-league") {
    applyNationalPlayerMatchState(world, homeTeam, result, "home", homeOutcome, summary, fixture);
    applyNationalPlayerMatchState(world, awayTeam, result, "away", awayOutcome, summary, fixture);
    const nationsLeague = world.futureCompetitions?.nationsLeague;
    const homeStanding = nationsLeague?.standings?.find((standing) => standing.teamId === fixture.homeTeamId);
    const awayStanding = nationsLeague?.standings?.find((standing) => standing.teamId === fixture.awayTeamId);
    if (homeStanding && awayStanding) {
      addStandingResult(
        homeStanding,
        result.score.home,
        result.score.away,
        result.boxScore.home.xg,
        result.boxScore.away.xg,
        3,
        1,
      );
      addStandingResult(
        awayStanding,
        result.score.away,
        result.score.home,
        result.boxScore.away.xg,
        result.boxScore.home.xg,
        3,
        1,
      );
      nationsLeague.standings = rankStandings(nationsLeague.standings);
    }
    return;
  }
  applyPlayerMatchState(world, homeTeam, result, "home", homeOutcome, summary, fixture);
  applyPlayerMatchState(world, awayTeam, result, "away", awayOutcome, summary, fixture);

  if (fixture.competitionKind === "champions-league" && fixture.phase === "league") {
    const standings = world.futureCompetitions?.championsLeague?.standings || [];
    const homeStanding = standings.find((standing) => standing.teamId === fixture.homeTeamId);
    const awayStanding = standings.find((standing) => standing.teamId === fixture.awayTeamId);
    if (homeStanding && awayStanding) {
      addStandingResult(
        homeStanding,
        result.score.home,
        result.score.away,
        result.boxScore.home.xg,
        result.boxScore.away.xg,
        3,
        1,
      );
      addStandingResult(
        awayStanding,
        result.score.away,
        result.score.home,
        result.boxScore.away.xg,
        result.boxScore.home.xg,
        3,
        1,
      );
      world.futureCompetitions.championsLeague.standings = rankChampionsLeagueStandings(standings);
    }
    return;
  }

  if (fixture.competitionKind !== "league") {
    return;
  }

  const league = leagueById(world, fixture.competitionId);
  const homeStanding = standingByTeam(league, fixture.homeTeamId);
  const awayStanding = standingByTeam(league, fixture.awayTeamId);

  addStandingResult(
    homeStanding,
    result.score.home,
    result.score.away,
    result.boxScore.home.xg,
    result.boxScore.away.xg,
    league.pointsForWin,
    league.pointsForDraw,
  );
  addStandingResult(
    awayStanding,
    result.score.away,
    result.score.home,
    result.boxScore.away.xg,
    result.boxScore.home.xg,
    league.pointsForWin,
    league.pointsForDraw,
  );

  homeStanding.fatigue = teamFatigueAverage(world, fixture.homeTeamId);
  awayStanding.fatigue = teamFatigueAverage(world, fixture.awayTeamId);
  updateLeagueQualification(league);
}

function compactResult(result) {
  return {
    seed: result.seed,
    winner: result.winner,
    score: result.score,
    boxScore: result.boxScore,
    teams: {
      home: {
        name: result.teams.home.name,
        formation: result.teams.home.formation,
        startingFormation: result.teams.home.startingFormation,
        tactic: result.teams.home.tactic,
        profile: result.teams.home.profile,
        startingLineup: result.teams.home.startingLineup,
        lineup: result.teams.home.lineup,
        playerStats: result.teams.home.playerStats,
      },
      away: {
        name: result.teams.away.name,
        formation: result.teams.away.formation,
        startingFormation: result.teams.away.startingFormation,
        tactic: result.teams.away.tactic,
        profile: result.teams.away.profile,
        startingLineup: result.teams.away.startingLineup,
        lineup: result.teams.away.lineup,
        playerStats: result.teams.away.playerStats,
      },
    },
    xg: {
      home: result.boxScore.home.xg,
      away: result.boxScore.away.xg,
    },
    fatigueImpact: {
      home: result.boxScore.home.fatigueImpact,
      away: result.boxScore.away.fatigueImpact,
    },
    goals: result.events
      .filter((event) => event.type === "goal")
      .map((event) => ({
        minute: event.minute,
        section: event.section,
        team: event.team,
        player: event.player,
        assist: event.assist,
        score: event.score,
      })),
    events: result.events
      .filter((event) => event.type !== "pass")
      .map((event) => ({
        minute: event.minute,
        section: event.section,
        type: event.type,
        side: event.side,
        team: event.team,
        player: event.player,
        target: event.target,
        assist: event.assist,
        xg: event.xg,
        score: event.score,
        reason: event.reason,
        replaced: event.replaced,
        formationFrom: event.formationFrom,
        formationTo: event.formationTo,
      })),
  };
}

function lightBoxScore(box = {}) {
  return {
    xg: box.xg,
    shots: box.shots,
    shotsOnTarget: box.shotsOnTarget,
    passes: box.passes,
    completedPasses: box.completedPasses,
    steals: box.steals,
    interceptions: box.interceptions,
    blocks: box.blocks,
    conduitLoad: box.conduitLoad,
    fatigueImpact: box.fatigueImpact,
  };
}

function prunedResult(result) {
  if (!result || result.detailPruned) return result;
  return {
    detailPruned: true,
    seed: result.seed,
    winner: result.winner,
    score: result.score,
    xg: result.xg,
    fatigueImpact: result.fatigueImpact,
    goals: result.goals || [],
    boxScore: {
      home: lightBoxScore(result.boxScore?.home),
      away: lightBoxScore(result.boxScore?.away),
    },
  };
}

function pruneWorldMatchDetails(world, options = {}) {
  const keepRecent = Math.max(0, Number(options.keepRecent ?? (world.completed ? 0 : 50)));
  const played = [];

  for (const [dayIndex, day] of (world.calendar || []).entries()) {
    for (const [fixtureIndex, fixture] of (day.fixtures || []).entries()) {
      if (fixture.status === "played" && fixture.result && !fixture.result.detailPruned) {
        played.push({ fixture, dayIndex, fixtureIndex, date: fixture.date || day.date || "" });
      }
    }
  }

  played.sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) ||
    a.dayIndex - b.dayIndex ||
    a.fixtureIndex - b.fixtureIndex);

  const pruneCount = Math.max(0, played.length - keepRecent);
  for (const item of played.slice(0, pruneCount)) {
    item.fixture.result = prunedResult(item.fixture.result);
  }

  return world;
}

function playFixture(world, fixture, options, summary) {
  const homeWorldTeam = teamById(world, fixture.homeTeamId);
  const awayWorldTeam = teamById(world, fixture.awayTeamId);
  const homeTeam = matchTeamFromWorld(world, homeWorldTeam);
  const awayTeam = matchTeamFromWorld(world, awayWorldTeam);
  const randomPart = options.randomize === false
    ? ""
    : `:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  const matchSeed = `${world.seed}:${fixture.id}${randomPart}`;
  const result = simulateMatch(homeTeam, awayTeam, {
    ...defaultMatchOptions,
    ...options,
    seed: matchSeed,
    homeName: homeWorldTeam.name,
    awayName: awayWorldTeam.name,
    homeFormation: homeWorldTeam.plan?.formation || defaultMatchOptions.homeFormation,
    awayFormation: awayWorldTeam.plan?.formation || defaultMatchOptions.awayFormation,
    homeTactic: homeWorldTeam.plan?.tactic || defaultMatchOptions.homeTactic,
    awayTactic: awayWorldTeam.plan?.tactic || defaultMatchOptions.awayTactic,
    homeCondition: "normal",
    awayCondition: "normal",
    adjustLineupByCondition: true,
    includePassEvents: false,
  });

  const compact = compactResult(result);
  fixture.playSeed = result.seed;
  fixture.status = "played";
  fixture.result = compact;
  applyFixtureResult(world, fixture, result, summary);

  const matchSummary = {
    fixtureId: fixture.id,
    competition: fixture.competitionName,
    competitionKind: fixture.competitionKind,
    round: fixture.round,
    home: homeWorldTeam.name,
    away: awayWorldTeam.name,
    score: result.score,
    winner: result.winner,
    xg: compact.xg,
    fatigueImpact: compact.fatigueImpact,
    goals: compact.goals,
  };
  summary.matches.push(matchSummary);
  world.results.push({ date: fixture.date, ...matchSummary });
}

function fixtureById(world, fixtureId) {
  for (const day of world.calendar || []) {
    const fixture = day.fixtures.find((item) => item.id === fixtureId);
    if (fixture) return fixture;
  }
  return null;
}

function cupWinnerTeamId(world, fixture) {
  const result = fixture?.result;
  if (!result) return null;
  if (result.score.home > result.score.away) return fixture.homeTeamId;
  if (result.score.away > result.score.home) return fixture.awayTeamId;
  const homeXg = Number(result.xg?.home ?? result.boxScore?.home?.xg ?? 0);
  const awayXg = Number(result.xg?.away ?? result.boxScore?.away?.xg ?? 0);
  if (homeXg > awayXg) return fixture.homeTeamId;
  if (awayXg > homeXg) return fixture.awayTeamId;
  const rng = createRng(`${fixture.playSeed || fixture.id}:cup-tiebreak`);
  return rng() < 0.5 ? fixture.homeTeamId : fixture.awayTeamId;
}

function progressDomesticCups(world) {
  const cups = world.futureCompetitions?.domesticCups || [];
  if (!cups.length) return;
  const calendarByDate = applyInternationalCalendarBlocks(new Map((world.calendar || []).map((day) => [day.date, day])), world);
  let changed = false;

  for (const cup of cups) {
    if (cup.completed) continue;
    for (let roundIndex = 0; roundIndex < cup.rounds.length; roundIndex += 1) {
      const round = cup.rounds[roundIndex];
      if (!round.fixtureIds.length && roundIndex > 0) break;
      const fixtures = round.fixtureIds.map((fixtureId) => fixtureById(world, fixtureId)).filter(Boolean);
      if (!fixtures.length) continue;
      if (!fixtures.every((fixture) => fixture.status === "played")) continue;
      if (round.completed) continue;

      const winners = [
        ...(round.byeTeamIds || []),
        ...fixtures.map((fixture) => cupWinnerTeamId(world, fixture)).filter(Boolean),
      ];
      round.completed = true;
      round.winnerTeamIds = winners;

      if (winners.length <= 1 || roundIndex === cup.rounds.length - 1) {
        cup.completed = true;
        cup.championTeamId = winners[0] || null;
        changed = true;
      } else {
        scheduleCupRound(world, calendarByDate, cup, roundIndex + 1, winners);
        changed = true;
      }
    }
  }

  if (changed) {
    world.calendar = [...calendarByDate.values()].sort((a, b) => compareDate(a.date, b.date));
  }
}

function championsLeagueFixtureIds(championsLeague, phase = null) {
  const leagueIds = championsLeague.leaguePhase?.rounds?.flatMap((round) => round.fixtureIds || []) || [];
  const knockoutIds = (championsLeague.knockoutRounds || [])
    .filter((round) => !phase || round.phase === phase)
    .flatMap((round) => (round.ties || []).flatMap((tie) => tie.fixtureIds || []));
  return phase === "league" ? leagueIds : [...leagueIds, ...knockoutIds];
}

function allFixtureIdsPlayed(world, fixtureIds) {
  return fixtureIds.length > 0 && fixtureIds.every((fixtureId) => fixtureById(world, fixtureId)?.status === "played");
}

function scheduleChampionsLeagueRound(world, calendarByDate, phase, label, pairs) {
  const championsLeague = world.futureCompetitions?.championsLeague;
  const dates = makeChampionsLeagueDates(world.season.startDate, world.season.endDate)[phase] || [];
  const roundIndex = (championsLeague.knockoutRounds || []).length + 1;
  const round = {
    phase,
    label,
    completed: false,
    ties: [],
  };

  for (const [pairIndex, [firstTeamId, secondTeamId]] of pairs.entries()) {
    const tie = {
      id: `cl-${phase}-t${pairIndex + 1}`,
      teamIds: [firstTeamId, secondTeamId],
      fixtureIds: [],
      completed: false,
      winnerTeamId: null,
    };
    const firstLegDate = dates[0] && compareDate(dates[0], world.currentDate) > 0 ? dates[0] : addDays(world.currentDate, 7);
    const secondLegDate = dates[1] && compareDate(dates[1], firstLegDate) > 0 ? dates[1] : addDays(firstLegDate, 7);
    const scheduledFirstLeg = findAvailableFixtureDate(calendarByDate, firstLegDate, [firstTeamId, secondTeamId], {
      startDate: world.season.startDate,
      endDate: world.season.endDate,
      minRestDays: 3,
      maxShift: 14,
      allowedWeekdays: [2, 3, 4],
      extraDays: 60,
    });
    const scheduledSecondLeg = findAvailableFixtureDate(calendarByDate, addDays(scheduledFirstLeg, 7), [firstTeamId, secondTeamId], {
      startDate: world.season.startDate,
      endDate: world.season.endDate,
      minRestDays: 3,
      maxShift: 14,
      allowedWeekdays: [2, 3, 4],
      extraDays: 75,
    });
    const legs = [
      { date: scheduledFirstLeg, homeTeamId: firstTeamId, awayTeamId: secondTeamId },
      { date: scheduledSecondLeg, homeTeamId: secondTeamId, awayTeamId: firstTeamId },
    ];
    for (const [legIndex, leg] of legs.entries()) {
      const fixture = {
        id: `cl-${phase}-r${roundIndex}-t${pairIndex + 1}-l${legIndex + 1}`,
        competitionId: "champions-league",
        competitionName: "Champions League",
        competitionKind: "champions-league",
        phase,
        round: roundIndex,
        leg: legIndex + 1,
        date: leg.date,
        homeTeamId: leg.homeTeamId,
        awayTeamId: leg.awayTeamId,
        status: "scheduled",
        result: null,
      };
      calendarDay(calendarByDate, leg.date).fixtures.push(fixture);
      tie.fixtureIds.push(fixture.id);
    }
    round.ties.push(tie);
  }

  championsLeague.knockoutRounds.push(round);
}

function championsLeagueTieWinner(world, tie) {
  const totals = Object.fromEntries((tie.teamIds || []).map((teamId) => [teamId, { goals: 0, xg: 0 }]));
  for (const fixtureId of tie.fixtureIds || []) {
    const fixture = fixtureById(world, fixtureId);
    if (!fixture?.result) continue;
    totals[fixture.homeTeamId].goals += Number(fixture.result.score?.home || 0);
    totals[fixture.awayTeamId].goals += Number(fixture.result.score?.away || 0);
    totals[fixture.homeTeamId].xg += Number(fixture.result.xg?.home ?? fixture.result.boxScore?.home?.xg ?? 0);
    totals[fixture.awayTeamId].xg += Number(fixture.result.xg?.away ?? fixture.result.boxScore?.away?.xg ?? 0);
  }
  const [firstTeamId, secondTeamId] = tie.teamIds;
  if (totals[firstTeamId].goals > totals[secondTeamId].goals) return firstTeamId;
  if (totals[secondTeamId].goals > totals[firstTeamId].goals) return secondTeamId;
  if (totals[firstTeamId].xg > totals[secondTeamId].xg) return firstTeamId;
  if (totals[secondTeamId].xg > totals[firstTeamId].xg) return secondTeamId;
  const rng = createRng(`${world.seed}:${tie.id}:cl-tiebreak`);
  return rng() < 0.5 ? firstTeamId : secondTeamId;
}

function pairHighLow(teamIds) {
  const pairs = [];
  for (let index = 0; index < Math.floor(teamIds.length / 2); index += 1) {
    pairs.push([teamIds[index], teamIds[teamIds.length - 1 - index]]);
  }
  return pairs;
}

function progressChampionsLeague(world) {
  const championsLeague = world.futureCompetitions?.championsLeague;
  if (!championsLeague?.enabled || championsLeague.completed) return;
  const calendarByDate = applyInternationalCalendarBlocks(new Map((world.calendar || []).map((day) => [day.date, day])), world);
  let changed = false;

  if (!championsLeague.leaguePhase?.completed) {
    const fixtureIds = championsLeagueFixtureIds(championsLeague, "league");
    if (allFixtureIdsPlayed(world, fixtureIds)) {
      championsLeague.standings = rankChampionsLeagueStandings(championsLeague.standings || []);
      championsLeague.leaguePhase.completed = true;
      championsLeague.directRound16TeamIds = championsLeague.standings.slice(0, 8).map((standing) => standing.teamId);
      championsLeague.playoffTeamIds = championsLeague.standings.slice(8, 24).map((standing) => standing.teamId);
      scheduleChampionsLeagueRound(world, calendarByDate, "playoff", "Playoff", pairHighLow(championsLeague.playoffTeamIds));
      changed = true;
    }
  }

  const currentRound = (championsLeague.knockoutRounds || []).find((round) => !round.completed);
  if (currentRound && currentRound.ties.every((tie) => allFixtureIdsPlayed(world, tie.fixtureIds || []))) {
    const winners = [];
    for (const tie of currentRound.ties) {
      tie.winnerTeamId = championsLeagueTieWinner(world, tie);
      tie.completed = true;
      winners.push(tie.winnerTeamId);
    }
    currentRound.completed = true;

    if (currentRound.phase === "playoff") {
      const nextTeams = [
        ...(championsLeague.directRound16TeamIds || []),
        ...winners,
      ];
      scheduleChampionsLeagueRound(world, calendarByDate, "round16", "Round of 16", pairHighLow(nextTeams));
    } else if (currentRound.phase === "round16") {
      scheduleChampionsLeagueRound(world, calendarByDate, "quarter", "Quarter Final", pairHighLow(winners));
    } else if (currentRound.phase === "quarter") {
      scheduleChampionsLeagueRound(world, calendarByDate, "semi", "Semi Final", pairHighLow(winners));
    } else if (currentRound.phase === "semi") {
      scheduleChampionsLeagueRound(world, calendarByDate, "final", "Final", pairHighLow(winners));
    } else if (currentRound.phase === "final") {
      championsLeague.completed = true;
      championsLeague.championTeamId = winners[0] || null;
    }
    changed = true;
  }

  if (changed) {
    world.calendar = [...calendarByDate.values()].sort((a, b) => compareDate(a.date, b.date));
  }
}

function allLeagueFixturesPlayed(world, league) {
  return (league.rounds || [])
    .flatMap((round) => round.fixtureIds || [])
    .every((fixtureId) => fixtureById(world, fixtureId)?.status === "played");
}

function appendLeaguePhase(world, calendarByDate, league, groups, phase) {
  const phaseSeed = `${league.scheduleSeed || league.id}:${phase}`;
  const roundSets = groups.map((group, index) => makeRoundRobinRounds(shuffledTeamIds(group, `${phaseSeed}:${index}`), 2));
  const rounds = mergeRoundSets(roundSets).filter((round) => round.length);
  if (!rounds.length) {
    league.scheduleComplete = true;
    return;
  }

  const startRound = league.rounds.length;
  const dates = fixtureDateSlots(addDays(world.currentDate, 7), rounds.length, world.season.endDate);
  for (const [offset, matches] of rounds.entries()) {
    const roundIndex = startRound + offset;
    const date = dates[offset];
    const fixtureIds = addLeagueRoundFixtures(calendarByDate, league, matches, roundIndex, date, phase);
    league.rounds.push({
      round: roundIndex + 1,
      label: `${phase === "split" ? "後期" : "合体"} ${offset + 1}`,
      phase,
      fixtureIds,
      groupTeamIds: groups,
    });
  }
}

function progressDynamicLeagueSchedules(world) {
  const calendarByDate = applyInternationalCalendarBlocks(new Map((world.calendar || []).map((day) => [day.date, day])), world);
  let changed = false;

  for (const league of world.leagues || []) {
    if (league.scheduleComplete || !league.dynamicSchedule || league.dynamicSchedule.generated) continue;
    if (!allLeagueFixturesPlayed(world, league)) continue;

    const rankedTeamIds = standingOrderForTeams(league);
    let groups = [];
    let phase = "split";
    if (league.format === "split-after-double") {
      groups = splitRankedTeamIds(rankedTeamIds, league.teamIds.length >= 12 ? 3 : 2);
      phase = "split";
    } else if (league.format === "regional-mixed") {
      groups = splitRankedTeamIds(rankedTeamIds, league.teamIds.length >= 18 ? 4 : league.teamIds.length >= 12 ? 3 : 2);
      phase = "merged";
    }

    appendLeaguePhase(world, calendarByDate, league, groups, phase);
    league.dynamicSchedule.generated = true;
    league.dynamicSchedule.phase = phase;
    league.dynamicSchedule.groups = groups;
    league.scheduleComplete = true;
    changed = true;
  }

  if (changed) {
    world.calendar = [...calendarByDate.values()].sort((a, b) => compareDate(a.date, b.date));
  }
}

function worldPlayedMatchesForTeam(world, teamId) {
  return (world.calendar || []).reduce((count, day) =>
    count + (day.fixtures || []).filter((fixture) =>
      fixture.status === "played" && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId)).length, 0);
}

function contractExtensionInterest(world, team, player, state) {
  const contract = state.contract || makeInitialContract(player, { seed: world.seed, teamId: team.id, teamLevel: team.teamLevel });
  const age = Number(player.age || 24);
  const rating = playerRating(player);
  const teamLevel = Number(team.teamLevel || calculateTeamLevel(team.team));
  const season = state.season || {};
  const minutesRate = Number(season.minutes || 0) / Math.max(1, worldPlayedMatchesForTeam(world, team.id) * 90);
  const salaryPressure = clamp((Number(contract.salaryIndex || 0) - rating * 0.92) / 35, -0.35, 0.45);
  const roleFit = rating >= teamLevel + 2 ? 0.12 : rating >= teamLevel - 3 ? 0.06 : -0.08;
  const ageFit = age <= 22 ? 0.12 : age <= 29 ? 0.06 : age <= 32 ? -0.02 : -0.16;
  const playingFit = minutesRate >= 0.55 ? 0.14 : minutesRate >= 0.28 ? 0.04 : -0.16;
  const injuryPenalty = state.injury?.daysRemaining > 0 ? -0.08 : 0;
  return round(clamp(Number(contract.extensionMood ?? 0.5) + roleFit + ageFit + playingFit - salaryPressure + injuryPenalty, 0, 1), 3);
}

function extensionYearsFor(player, interest) {
  const age = Number(player.age || 24);
  if (age >= 34) return interest >= 0.72 ? 2 : 1;
  if (age >= 31) return interest >= 0.7 ? 3 : 2;
  if (age <= 23) return interest >= 0.72 ? 5 : 3;
  return interest >= 0.72 ? 4 : 3;
}

function extendContract(contract, player, interest) {
  const years = extensionYearsFor(player, interest);
  const rating = playerRating(player);
  const raise = interest >= 0.72 ? 1.12 : 1.04;
  return {
    ...contract,
    years,
    salaryIndex: round(clamp(Math.max(Number(contract.salaryIndex || 0) * raise, rating * 0.82), 8, 220), 2),
    releaseClauseIndex: contract.releaseClauseIndex
      ? round(clamp(Number(contract.releaseClauseIndex) * (interest >= 0.72 ? 1.12 : 1.04), 20, 720), 2)
      : null,
    extensionMood: round(clamp(interest + 0.08, 0, 1), 3),
    status: "extended",
  };
}

function processSeasonEndContracts(world) {
  if (world.contractsProcessed) return;
  const summary = { expired: [], lastYear: [], extended: [] };

  for (const team of world.teams || []) {
    const states = world.playerStates?.[team.id] || {};
    for (const player of team.team?.players || []) {
      const state = states[player.id] || emptyPlayerState(player, {
        seed: world.seed,
        teamId: team.id,
        teamLevel: team.teamLevel,
        leagueLevel: leagueForTeam(world, team)?.leagueLevel,
      });
      const before = state.contract || makeInitialContract(player, { seed: world.seed, teamId: team.id, teamLevel: team.teamLevel });
      const reduced = { ...before, years: Math.max(0, Number(before.years || 0) - 1), status: "active" };
      const interest = contractExtensionInterest(world, team, player, { ...state, contract: reduced });
      reduced.extensionInterest = interest;

      const shouldExtend = reduced.years <= 1 && interest >= (reduced.years === 0 ? 0.64 : 0.72);
      if (shouldExtend) {
        state.contract = extendContract(reduced, player, interest);
        summary.extended.push({
          teamId: team.id,
          team: team.name,
          player: player.fullName || player.name,
          age: player.age,
          position: player.bestPosition,
          years: state.contract.years,
          salaryIndex: state.contract.salaryIndex,
          interest,
        });
      } else {
        state.contract = reduced;
        const row = {
          teamId: team.id,
          team: team.name,
          player: player.fullName || player.name,
          age: player.age,
          position: player.bestPosition,
          years: reduced.years,
          salaryIndex: reduced.salaryIndex,
          interest,
        };
        if (reduced.years === 0) {
          reduced.status = "expired";
          summary.expired.push(row);
        } else if (reduced.years === 1) {
          summary.lastYear.push(row);
        }
      }

      states[player.id] = state;
    }
    world.playerStates[team.id] = states;
  }

  world.contractSummary = {
    expired: summary.expired.sort((a, b) => b.salaryIndex - a.salaryIndex).slice(0, 20),
    lastYear: summary.lastYear.sort((a, b) => b.salaryIndex - a.salaryIndex).slice(0, 20),
    extended: summary.extended.sort((a, b) => b.salaryIndex - a.salaryIndex).slice(0, 20),
  };
  world.contractsProcessed = true;
}

function updateWorldCompletion(world) {
  for (const league of world.leagues) updateLeagueQualification(league);
  const nationsLeague = world.futureCompetitions?.nationsLeague;
  if (nationsLeague && !nationsLeague.completed) {
    const fixtureIds = (nationsLeague.rounds || []).flatMap((round) => round.fixtureIds || []);
    if (fixtureIds.length && fixtureIds.every((fixtureId) => fixtureById(world, fixtureId)?.status === "played")) {
      nationsLeague.completed = true;
      nationsLeague.seasonCompleted = true;
      nationsLeague.nextRoundIndex = Number(nationsLeague.startRoundIndex || 0) + (nationsLeague.rounds || []).length;
      nationsLeague.standings = rankStandings(nationsLeague.standings || []);
      if (nationsLeague.nextRoundIndex >= Number(nationsLeague.totalCycleRounds || 30)) {
        nationsLeague.cycleCompleted = true;
        const relegated = nationsLeague.standings.slice(-4).map((standing) => ({
          teamId: standing.teamId,
          team: standing.name,
          rank: standing.rank,
          points: standing.points,
        }));
        nationsLeague.promotionRelegation = {
          processed: true,
          season: world.season?.label,
          relegated,
          promoted: [],
          note: "Division 2 is not generated yet; relegated countries are recorded for the next cycle.",
        };
      }
    }
  }
  const nextSeasonEntrants = world.leagues.flatMap((league) =>
    league.standings
      .filter((standing) => standing.clQualified)
      .map((standing) => ({
        teamId: standing.teamId,
        team: standing.name,
        leagueId: league.id,
        league: league.name,
        rank: standing.rank,
      })));
  world.futureCompetitions.championsLeague.nextSeasonEntrants = nextSeasonEntrants;
  if (!world.futureCompetitions.championsLeague.enabled) {
    world.futureCompetitions.championsLeague.entrants = nextSeasonEntrants;
  }

  const pending = world.leagues.some((league) => !league.scheduleComplete) ||
    world.calendar.some((day) => day.fixtures.some((fixture) => fixture.status !== "played")) ||
    (world.futureCompetitions.domesticCups || []).some((cup) => !cup.completed) ||
    (world.futureCompetitions.championsLeague?.enabled && !world.futureCompetitions.championsLeague?.completed);
  if (!pending) {
    world.completed = true;
    world.phase = "season-complete";
    processSeasonEndContracts(world);
  }
}

export function progressWorldDay(inputWorld, options = {}) {
  const world = clone(inputWorld);
  if (!world || world.ruleset !== "luminous-sword-world-v1") throw new Error("ワールドデータを読み込めません。");

  const summary = {
    date: world.currentDate,
    matches: [],
    injuries: [],
    recoveries: [],
    completed: false,
  };

  if (world.completed) {
    summary.completed = true;
    world.latestSummary = summary;
    return { world, summary };
  }

  applyDailyRecovery(world, summary);
  const day = world.calendar.find((entry) => entry.date === world.currentDate);
  if (day) {
    for (const fixture of day.fixtures) {
      if (fixture.status === "played") continue;
      if (fixture.competitionKind === "nations-league") {
        updateNationsLeagueCallups(world, fixture.windowIndex);
      }
      playFixture(world, fixture, options, summary);
    }
  }

  progressDomesticCups(world);
  progressDynamicLeagueSchedules(world);
  progressChampionsLeague(world);
  world.progressedDays = Number(world.progressedDays || 0) + 1;
  world.currentDate = addDays(world.currentDate, 1);
  updateWorldCompletion(world);
  summary.completed = world.completed;
  world.latestSummary = summary;
  world.news = [
    ...summary.injuries.map((item) => ({
      date: summary.date,
      type: "injury",
      text: `${item.team} / ${item.player}: ${item.injury}（${item.severity}・${item.days}日）`,
    })),
    ...summary.recoveries.map((item) => ({
      date: summary.date,
      type: "recovery",
      text: `${item.team} / ${item.player}: ${item.injury}から復帰`,
    })),
    ...(world.news || []),
  ].slice(0, 80);
  pruneWorldMatchDetails(world, { keepRecent: world.completed ? 0 : Number(options.detailRetention ?? 50) });

  return { world, summary };
}

export function progressWorldUntil(inputWorld, options = {}) {
  const targetDate = options.targetDate;
  if (!targetDate) throw new Error("進行先の日付を指定してください。");

  let world = clone(inputWorld);
  if (!world || world.ruleset !== "luminous-sword-world-v1") throw new Error("ワールドデータを読み込めません。");
  if (compareDate(targetDate, world.currentDate) < 0) {
    throw new Error("現在日以降の日付を指定してください。");
  }

  const maxDays = Math.max(1, Number(options.maxDays) || 430);
  const collected = {
    from: world.currentDate,
    to: targetDate,
    days: [],
    matches: [],
    injuries: [],
    recoveries: [],
    progressedDays: 0,
    completed: false,
  };

  while (!world.completed && compareDate(world.currentDate, targetDate) <= 0 && collected.progressedDays < maxDays) {
    const progressed = progressWorldDay(world, options.matchOptions || options);
    world = progressed.world;
    collected.progressedDays += 1;
    const summary = progressed.summary;
    if (summary.matches.length || summary.injuries.length || summary.recoveries.length || summary.completed) {
      collected.days.push(summary);
    }
    collected.matches.push(...summary.matches);
    collected.injuries.push(...summary.injuries.map((item) => ({ ...item, date: summary.date })));
    collected.recoveries.push(...summary.recoveries.map((item) => ({ ...item, date: summary.date })));
  }

  collected.completed = world.completed;
  collected.finalDate = world.currentDate;
  pruneWorldMatchDetails(world, { keepRecent: world.completed ? 0 : Number(options.detailRetention ?? 20) });
  world.latestSummary = {
    date: collected.to,
    matches: collected.matches.slice(-24),
    injuries: collected.injuries.slice(-24),
    recoveries: collected.recoveries.slice(-24),
    completed: collected.completed,
  };

  return { world, summary: collected };
}
