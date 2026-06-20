import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildLineup, generatorStatNames, rateTeam, simulateMatch, simulateSeries, statUsageCoverage } from "../src/simulator.js";

async function fixture(name) {
  const raw = await readFile(new URL(`../samples/${name}`, import.meta.url), "utf8");
  return JSON.parse(raw);
}

function syntheticTeam(statName = "", value = 50) {
  const codes = ["7", "4", "5", "6", "1", "2", "3", "14", "10", "11"];
  const stats = Object.fromEntries(generatorStatNames.map((name) => [name, name === statName ? value : 50]));

  return {
    name: "Synthetic",
    players: codes.map((code, index) => ({
      id: `p${index + 1}`,
      fullName: `Synthetic ${index + 1}`,
      rating: 70,
      bestPosition: code,
      positionRatings: { [code]: 80 },
      stats,
    })),
  };
}

function generatorScaleTeam(name = "Generator Scale") {
  const codes = ["7", "4", "5", "6", "1", "2", "3", "14", "10", "11"];
  const stats = Object.fromEntries(generatorStatNames.map((statName) => [statName, 22.5]));

  return {
    name,
    players: codes.map((code, index) => ({
      id: `${name}-${index + 1}`,
      fullName: `${name} ${index + 1}`,
      rating: 75,
      bestPosition: code,
      positionRatings: { [code]: 75 },
      stats,
    })),
  };
}

function conditionSelectionTeam(name = "Condition Select") {
  const stats = Object.fromEntries(generatorStatNames.map((statName) => [statName, 22.5]));
  const players = [
    ["2", 77, "Right Shield"],
    ["1", 77, "Center Guard"],
    ["3", 77, "Left Shield"],
    ["4", 77, "Pivot"],
    ["5", 77, "Right Wing"],
    ["6", 77, "Left Wing"],
    ["7", 78, "Cold Striker", -8],
    ["7", 76, "Hot Striker", 8],
  ].map(([code, rating, label, conditionDelta], index) => ({
    id: `${name}-${index + 1}`,
    fullName: `${name} ${label}`,
    rating,
    bestPosition: code,
    positionRatings: { [code]: rating },
    conditionDelta,
    stats,
  }));

  return { name, players };
}

test("match results are deterministic with the same seed", async () => {
  const home = await fixture("team-a.json");
  const away = await fixture("team-b.json");
  const options = { seed: "fixed", homeFormation: "f313", awayFormation: "f322" };

  const first = simulateMatch(home, away, options);
  const second = simulateMatch(home, away, options);

  assert.deepEqual(second.score, first.score);
  assert.deepEqual(second.events, first.events);
});

test("lineup assigns unique players to seven slots", async () => {
  const team = await fixture("team-a.json");
  const lineup = buildLineup(team, "f313");
  const players = lineup.assignments.map((assignment) => assignment.player?.id).filter(Boolean);

  assert.equal(lineup.assignments.length, 7);
  assert.equal(new Set(players).size, players.length);
});

test("exported array teams can be simulated directly", async () => {
  const home = (await fixture("team-a.json")).players;
  const away = (await fixture("team-b.json")).players;
  const result = simulateMatch(home, away, { seed: "array-input" });

  assert.equal(typeof result.score.home, "number");
  assert.equal(typeof result.score.away, "number");
  assert.equal(result.ruleset, "luminous-sword-v1");
  assert.deepEqual(result.clock, { sections: 3, minutesPerSection: 20, totalMinutes: 60 });
  assert.ok(Number.isFinite(result.boxScore.home.xg));
  assert.ok(Number.isFinite(result.boxScore.away.xg));
  assert.ok(Number.isFinite(result.teams.home.profile.emission));
  assert.ok(Number.isFinite(result.teams.away.profile.emission));
  assert.equal(result.teams.home.startingLineup.assignments.length, 7);
  assert.equal(result.teams.away.startingLineup.assignments.length, 7);
  assert.ok(result.events.every((event) => event.score.home >= 0 && event.score.away >= 0));
  assert.ok(result.events.every((event) => event.minute >= 1 && event.minute <= result.clock.totalMinutes));
});

test("series aggregates the requested number of matches", async () => {
  const home = await fixture("team-a.json");
  const away = await fixture("team-b.json");
  const series = simulateSeries(home, away, { seed: "series", matches: 12 });

  assert.equal(series.matches, 12);
  assert.equal(series.homeWins + series.awayWins + series.draws, 12);
});

test("all generator stats are mapped into simulation facets", () => {
  const coverage = statUsageCoverage();

  assert.equal(coverage.total, 30);
  assert.equal(coverage.used.length, coverage.total);
  assert.deepEqual(coverage.missing, []);
});

test("each generator stat can affect the rated team profile", () => {
  const base = rateTeam(syntheticTeam()).profile;
  const profileKeys = ["overall", "attack", "defense", "control", "flow", "retention", "emission", "steal", "interception", "finishing", "stamina", "tempo"];

  for (const statName of generatorStatNames) {
    const changed = rateTeam(syntheticTeam(statName, 90)).profile;
    const changedAnyProfile = profileKeys.some((key) => Math.abs((changed[key] || 0) - (base[key] || 0)) > 0.001);

    assert.ok(changedAnyProfile, `${statName} did not affect any profile value`);
  }
});

test("0-30 generator stats are normalized to the simulator scale", () => {
  const profile = rateTeam(generatorScaleTeam()).profile;
  const series = simulateSeries(generatorScaleTeam("Home"), generatorScaleTeam("Away"), { seed: "generator-scale-test", matches: 60 });

  assert.ok(profile.attack > 70);
  assert.ok(profile.emission > 70);
  assert.ok(profile.flow > 70);
  assert.ok(series.averageScore.home + series.averageScore.away > 2.6);
  assert.ok(series.averageXg.home + series.averageXg.away > 3);
});

test("section breaks can use reserves and changers alter formation", async () => {
  const home = await fixture("team-a.json");
  const away = await fixture("team-b.json");
  const result = simulateMatch(home, away, {
    seed: "changer-find:0",
    homeFormation: "f313",
    awayFormation: "f322",
    eventsPerMinute: 1.1,
  });
  const substitutions = result.events.filter((event) => event.type === "substitution");
  const changers = result.events.filter((event) => event.type === "defensive_changer" || event.type === "offensive_changer");

  assert.ok(substitutions.length > 0);
  assert.ok(substitutions.every((event) => event.minute === 21 || event.minute === 41));
  assert.ok(substitutions.every((event) => event.projectedGain > 0));
  assert.ok(changers.some((event) => event.formationFrom && event.formationTo && event.formationFrom !== event.formationTo));
  assert.ok(result.boxScore.home.fatigueImpact > 0);
  assert.ok(result.boxScore.away.fatigueImpact > 0);
});

test("changers can enter mid-section and both changer types can be used", async () => {
  const home = await fixture("team-a.json");
  const away = await fixture("team-b.json");
  const result = simulateMatch(home, away, {
    seed: "latechanger:4",
    homeFormation: "f313",
    awayFormation: "f322",
    eventsPerMinute: 1.1,
  });
  const changers = result.events.filter((event) => event.type === "defensive_changer" || event.type === "offensive_changer");
  const midSectionChangers = changers.filter((event) => event.minute !== 21 && event.minute !== 41);
  const homeChangerTypes = new Set(changers.filter((event) => event.team === result.teams.home.name).map((event) => event.type));
  const regularFormationChange = result.events.find((event) => event.type === "formation_change");

  assert.ok(midSectionChangers.length > 0);
  assert.ok(homeChangerTypes.has("offensive_changer"));
  assert.ok(homeChangerTypes.has("defensive_changer"));
  assert.ok(regularFormationChange);
  assert.equal(regularFormationChange.minute, 21);
  assert.ok(changers.every((event) => {
    const sideDiff = event.side === "home" ? event.score.home - event.score.away : event.score.away - event.score.home;
    const minuteInSection = ((event.minute - 1) % 20) + 1;
    if (Math.abs(sideDiff) !== 1) return true;
    return event.section >= 3 ? minuteInSection >= 13 : minuteInSection >= 17;
  }));
});

test("goals never assign an assist to the scorer", () => {
  const home = generatorScaleTeam("Home");
  const away = generatorScaleTeam("Away");

  for (let index = 0; index < 30; index += 1) {
    const result = simulateMatch(home, away, {
      seed: `assist-check:${index}`,
      eventsPerMinute: 1.1,
    });
    const goals = result.events.filter((event) => event.type === "goal");

    assert.ok(goals.every((event) => !event.assist || event.assist !== event.player));
  }
});

test("fatigue impact can be disabled", async () => {
  const home = await fixture("team-a.json");
  const away = await fixture("team-b.json");
  const result = simulateMatch(home, away, { seed: "no-fatigue", fatigueImpact: 0 });

  assert.equal(result.boxScore.home.fatigueImpact, 0);
  assert.equal(result.boxScore.away.fatigueImpact, 0);
});

test("condition can change the starting lineup when enabled", () => {
  const home = conditionSelectionTeam("Home");
  const away = conditionSelectionTeam("Away");
  const enabled = simulateMatch(home, away, {
    seed: "condition-lineup",
    adjustLineupByCondition: true,
    enableChangers: false,
    enableBenchSubstitutions: false,
  });
  const disabled = simulateMatch(home, away, {
    seed: "condition-lineup",
    adjustLineupByCondition: false,
    enableChangers: false,
    enableBenchSubstitutions: false,
  });
  const enabledStriker = enabled.teams.home.startingLineup.assignments.find((assignment) => assignment.slot === "front_center");
  const disabledStriker = disabled.teams.home.startingLineup.assignments.find((assignment) => assignment.slot === "front_center");

  assert.equal(enabledStriker.player, "Home Hot Striker");
  assert.equal(enabledStriker.condition, "絶好調");
  assert.equal(disabledStriker.player, "Home Cold Striker");
  assert.equal(disabledStriker.condition, "絶不調");
});
