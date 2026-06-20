import assert from "node:assert/strict";
import test from "node:test";
import { createWorld, makeLeagueSchedule, progressWorldDay, progressWorldUntil } from "../src/world.js";
import { generatorStatNames } from "../src/simulator.js";

function team(name, offset = 0) {
  const positions = ["1", "2", "3", "4", "5", "6", "7", "10", "11", "14", "17"];
  const stats = Object.fromEntries(generatorStatNames.map((statName) => [statName, 22 + offset]));
  return {
    name,
    players: positions.map((position, index) => ({
      id: `${name}-${index + 1}`,
      fullName: `${name} Player ${index + 1}`,
      rating: 70 + offset,
      bestPosition: position,
      positionRatings: { [position]: 75 + offset },
      stats,
    })),
  };
}

test("world schedule supports quadruple round robin", () => {
  const schedule = makeLeagueSchedule(4, "quadruple-round-robin");

  assert.equal(schedule.length, 12);
  assert.ok(schedule.every((round) => round.length === 2));
});

test("world schedule supports split and regional league formats", () => {
  assert.ok(makeLeagueSchedule(12, "split-after-double").length > makeLeagueSchedule(12, "double-round-robin").length);
  assert.ok(makeLeagueSchedule(14, "regional-mixed").length > makeLeagueSchedule(14, "single-round-robin").length);
});

test("split league creates ranking groups after the first phase", () => {
  let world = createWorld({
    seed: "world-split-test",
    startDate: "2029-09-13",
    enableDomesticCups: false,
    leagues: [
      { name: "Split League", country: "IT", format: "split-after-double", clSlots: 2, teams: [team("S1", 3), team("S2", 2), team("S3", 1), team("S4")] },
    ],
  });
  const initialRounds = world.leagues[0].rounds.length;
  assert.equal(initialRounds, makeLeagueSchedule(4, "quadruple-round-robin").length);

  for (let index = 0; index < 180 && world.leagues[0].rounds.length === initialRounds; index += 1) {
    ({ world } = progressWorldDay(world, { seed: "world-split-match" }));
  }

  assert.ok(world.leagues[0].rounds.length > initialRounds);
  assert.equal(world.leagues[0].dynamicSchedule.phase, "split");
  assert.equal(world.leagues[0].scheduleComplete, true);
});

test("regional league uses assigned team groups before merging", () => {
  const world = createWorld({
    seed: "world-regional-group-test",
    startDate: "2029-09-13",
    enableDomesticCups: false,
    leagues: [
      {
        name: "Regional League",
        country: "US",
        format: "regional-mixed",
        clSlots: 2,
        teamGroups: [
          { group: "west" },
          { group: "west" },
          { group: "central" },
          { group: "central" },
          { group: "east" },
          { group: "east" },
        ],
        teams: [team("W1"), team("W2"), team("C1"), team("C2"), team("E1"), team("E2")],
      },
    ],
  });
  const league = world.leagues[0];
  const groupByTeam = new Map(Object.entries(league.teamGroups));
  const initialFixtures = world.calendar.flatMap((day) => day.fixtures).filter((fixture) => fixture.competitionKind === "league");

  assert.equal(league.dynamicSchedule.groups.length, 3);
  assert.ok(initialFixtures.length > 0);
  assert.ok(initialFixtures.every((fixture) => groupByTeam.get(fixture.homeTeamId) === groupByTeam.get(fixture.awayTeamId)));
  for (const group of league.dynamicSchedule.groups) {
    assert.equal(initialFixtures.filter((fixture) => group.includes(fixture.homeTeamId) && group.includes(fixture.awayTeamId)).length, 4);
  }
});

test("world schedule seed changes reproducible league fixtures", () => {
  const base = {
    seed: "world-schedule-seed-test",
    startDate: "2029-09-13",
    enableDomesticCups: false,
    leagues: [
      { name: "Seed League", country: "JP", format: "split-after-double", clSlots: 1, teams: [team("A"), team("B"), team("C"), team("D")] },
    ],
  };
  const first = createWorld({ ...base, scheduleSeed: "schedule-a" });
  const firstAgain = createWorld({ ...base, scheduleSeed: "schedule-a" });
  const second = createWorld({ ...base, scheduleSeed: "schedule-b" });
  const signature = (world) => world.calendar
    .flatMap((day) => day.fixtures)
    .filter((fixture) => fixture.competitionKind === "league")
    .map((fixture) => `${fixture.homeTeamId}-${fixture.awayTeamId}`)
    .join("|");

  assert.equal(signature(first), signature(firstAgain));
  assert.notEqual(signature(first), signature(second));
});

test("world can be created with multiple leagues", () => {
  const world = createWorld({
    seed: "world-create-test",
    startDate: "2029-09-15",
    leagues: [
      { name: "A League", country: "日本", clSlots: 1, teams: [team("A1"), team("A2"), team("A3"), team("A4")] },
      { name: "B League", country: "ドイツ", clSlots: 2, teams: [team("B1"), team("B2"), team("B3"), team("B4")] },
    ],
  });

  assert.equal(world.ruleset, "luminous-sword-world-v1");
  assert.equal(world.leagues.length, 2);
  assert.equal(world.teams.filter((item) => !item.competitionOnly).length, 8);
  assert.ok(world.calendar.length > 0);
  assert.ok(world.calendar[0].fixtures.length >= 4);
  assert.ok(world.futureCompetitions.domesticCups.length >= 2);
  assert.ok(world.calendar.some((day) => day.fixtures.some((fixture) => fixture.competitionKind === "domestic-cup")));
  assert.equal(world.futureCompetitions.nationsLeague.teamIds.length, 16);
  assert.equal(world.futureCompetitions.nationsLeague.rounds.length, 15);
  const nlFixtureDates = new Set(world.calendar
    .flatMap((day) => day.fixtures)
    .filter((fixture) => fixture.competitionKind === "nations-league")
    .map((fixture) => fixture.date));
  const nlWindowDates = new Set(world.futureCompetitions.nationsLeague.windows.flatMap((window) => window.matchDates));
  assert.ok([...nlFixtureDates].every((date) => nlWindowDates.has(date)));
});

test("nations league carries standings into the second season", () => {
  const first = createWorld({
    seed: "world-nl-carryover-a",
    startDate: "2029-09-15",
    leagues: [
      { name: "A League", country: "JP", clSlots: 1, teams: [team("NA1"), team("NA2"), team("NA3"), team("NA4")] },
      { name: "B League", country: "DE", clSlots: 1, teams: [team("NB1"), team("NB2"), team("NB3"), team("NB4")] },
    ],
  });
  const carriedStandings = first.futureCompetitions.nationsLeague.standings.map((standing, index) => ({
    ...standing,
    played: 15,
    wins: index === 0 ? 10 : 4,
    draws: index === 0 ? 3 : 2,
    losses: index === 0 ? 2 : 9,
    goalsFor: index === 0 ? 33 : 18,
    goalsAgainst: index === 0 ? 12 : 25,
    goalDifference: index === 0 ? 21 : -7,
    points: index === 0 ? 33 : 14,
  }));
  const second = createWorld({
    seed: "world-nl-carryover-b",
    startDate: "2030-09-15",
    endDate: "2031-06-30",
    nationsLeagueCarryover: {
      ruleset: "luminous-sword-nations-league-carryover-v1",
      cycleSeasonIndex: 2,
      nextRoundIndex: 15,
      totalCycleRounds: 30,
      standings: carriedStandings,
    },
    leagues: [
      { name: "A League", country: "JP", clSlots: 1, teams: [team("NC1"), team("NC2"), team("NC3"), team("NC4")] },
      { name: "B League", country: "DE", clSlots: 1, teams: [team("ND1"), team("ND2"), team("ND3"), team("ND4")] },
    ],
  });

  const nl = second.futureCompetitions.nationsLeague;
  assert.equal(nl.cycleSeasonIndex, 2);
  assert.equal(nl.startRoundIndex, 15);
  assert.equal(nl.rounds.length, 15);
  assert.equal(nl.rounds[0].round, 16);
  assert.equal(nl.standings[0].played, 15);
  assert.equal(nl.standings[0].points, 33);
});

test("world creates lightweight contract state for players", () => {
  const world = createWorld({
    seed: "world-contract-create-test",
    startDate: "2029-09-13",
    enableDomesticCups: false,
    leagues: [
      { name: "Contract League", country: "JP", clSlots: 1, teams: [team("K1", 3), team("K2")] },
    ],
  });
  const worldTeam = world.teams[0];
  const player = worldTeam.team.players[0];
  const contract = world.playerStates[worldTeam.id][player.id].contract;

  assert.ok(worldTeam.teamLevel > 0);
  assert.ok(world.leagues[0].leagueLevel > 0);
  assert.ok(contract);
  assert.ok(contract.years >= 1);
  assert.ok(contract.salaryIndex > 0);
  assert.ok(contract.role);
});

test("progressing a world day plays fixtures and updates state", () => {
  let world = createWorld({
    seed: "world-progress-test",
    startDate: "2029-09-13",
    leagues: [
      { name: "Progress League", country: "日本", clSlots: 1, teams: [team("P1", 1), team("P2"), team("P3"), team("P4")] },
    ],
  });

  while (!world.latestSummary?.matches?.length) {
    ({ world } = progressWorldDay(world, { seed: "world-progress-match" }));
  }

  const league = world.leagues[0];
  const played = league.standings.reduce((sum, standing) => sum + standing.played, 0);
  const fatigueValues = Object.values(world.playerStates).flatMap((states) =>
    Object.values(states).map((state) => Number(state.fatigue || 0)));

  assert.ok(world.latestSummary.matches.length > 0);
  assert.ok(played > 0);
  assert.ok(fatigueValues.some((value) => value > 0));
});

test("world completion exposes Champions League entrants", () => {
  let world = createWorld({
    seed: "world-complete-test",
    startDate: "2029-09-13",
    leagues: [
      { name: "Complete League", country: "日本", clSlots: 2, teams: [team("C1", 2), team("C2"), team("C3"), team("C4")] },
    ],
  });

  for (let index = 0; index < 430 && !world.completed; index += 1) {
    ({ world } = progressWorldDay(world, { seed: "world-complete-match" }));
  }

  assert.equal(world.completed, true);
  assert.equal(world.futureCompetitions.championsLeague.entrants.length, 2);
  assert.ok(world.futureCompetitions.championsLeague.entrants.every((entry) => entry.rank <= 2));
  const playedFixtures = world.calendar.flatMap((day) => day.fixtures).filter((fixture) => fixture.status === "played");
  assert.ok(playedFixtures.length > 0);
  assert.ok(playedFixtures.every((fixture) => fixture.result?.detailPruned));
  assert.ok(playedFixtures.every((fixture) => !fixture.result?.teams && !fixture.result?.events));
  assert.equal(world.contractsProcessed, true);
  assert.ok(world.contractSummary);
  assert.ok(Array.isArray(world.contractSummary.expired));
  assert.ok(Array.isArray(world.contractSummary.lastYear));
  assert.ok(Array.isArray(world.contractSummary.extended));
});

test("world creates Champions League when required countries are present", () => {
  const specs = [
    ["germany", "Germany", 4],
    ["japan", "Japan", 4],
    ["usa", "USA", 4],
    ["uk", "UK", 4],
    ["france", "France", 3],
    ["italy", "Italy", 2],
    ["spain", "Spain", 2],
    ["korea", "Korea", 2],
    ["china", "China", 1],
    ["russia", "Russia", 1],
  ];
  const world = createWorld({
    seed: "world-cl-test",
    scheduleSeed: "world-cl-schedule",
    startDate: "2029-09-13",
    enableDomesticCups: false,
    leagues: specs.map(([countryKey, country, slots]) => ({
      name: `${country} League`,
      country,
      countryKey,
      clSlots: slots,
      format: "single-round-robin",
      teams: Array.from({ length: Math.max(2, slots) }, (_, index) => team(`${country}-${index + 1}`, slots - index)),
    })),
  });

  const cl = world.futureCompetitions.championsLeague;
  assert.equal(cl.enabled, true);
  assert.equal(cl.entrants.length, 32);
  assert.equal(cl.entrants.filter((entry) => entry.dummy).length, 5);
  assert.equal(cl.pots.length, 4);
  assert.ok(cl.pots.every((pot) => pot.length === 8));
  const leaguePhaseFixtures = world.calendar
    .flatMap((day) => day.fixtures)
    .filter((fixture) => fixture.competitionKind === "champions-league" && fixture.phase === "league");
  assert.equal(leaguePhaseFixtures.length, 128);
  for (const entry of cl.entrants) {
    assert.equal(leaguePhaseFixtures.filter((fixture) => fixture.homeTeamId === entry.teamId || fixture.awayTeamId === entry.teamId).length, 8);
  }
  const datesByTeam = new Map();
  for (const fixture of world.calendar.flatMap((day) => day.fixtures)) {
    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      const key = `${teamId}:${fixture.date}`;
      assert.equal(datesByTeam.has(key), false, `${teamId} has multiple fixtures on ${fixture.date}`);
      datesByTeam.set(key, fixture.id);
    }
  }
});

test("world can progress until a target date", () => {
  const world = createWorld({
    seed: "world-until-test",
    startDate: "2029-09-13",
    leagues: [
      { name: "Until League", country: "日本", clSlots: 1, teams: [team("U1", 1), team("U2"), team("U3"), team("U4")] },
    ],
  });
  const progressed = progressWorldUntil(world, {
    targetDate: "2029-10-15",
    matchOptions: { seed: "world-until-match" },
  });

  assert.ok(progressed.summary.progressedDays > 1);
  assert.ok(progressed.summary.matches.length > 0);
  assert.ok(progressed.world.currentDate > "2029-10-15");
  assert.equal(progressed.world.latestSummary.rangeSummary, undefined);
});
