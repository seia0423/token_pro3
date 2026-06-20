#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultMatchOptions, simulateMatch, simulateSeries, tactics } from "./simulator.js";
import { formations } from "./formations.js";

const __filename = fileURLToPath(import.meta.url);

function usage() {
  const formationList = Object.keys(formations).join(", ");
  const tacticList = Object.keys(tactics).join(", ");

  return `
Usage:
  node ${path.basename(__filename)} <home-team.json> <away-team.json> [options]

Options:
  --seed <text>              Deterministic seed. Default: ${defaultMatchOptions.seed}
  --home-name <text>         Override home team name.
  --away-name <text>         Override away team name.
  --home-formation <key>     ${formationList}
  --away-formation <key>     ${formationList}
  --home-tactic <key>        ${tacticList}
  --away-tactic <key>        ${tacticList}
  --sections <number>        Match sections. Default: ${defaultMatchOptions.sections}
  --minutes-per-section <n>  Minutes per section. Default: ${defaultMatchOptions.minutesPerSection}
  --events-per-minute <n>    Possession sequence density. Default: ${defaultMatchOptions.eventsPerMinute}
  --include-pass-events      Include completed passes in event log.
  --disable-changers         Disable #8/#9-style section changers.
  --series <number>          Run many matches and print aggregate.
  --json                     Print raw JSON result.
  --help                     Show this help.
`;
}

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  const options = {};

  while (args.length) {
    const arg = args.shift();

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--include-pass-events") {
      options.includePassEvents = true;
      continue;
    }

    if (arg === "--disable-changers") {
      options.enableChangers = false;
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = args.shift();
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} needs a value.`);
      }
      options[key] = value;
      continue;
    }

    positional.push(arg);
  }

  return { positional, options };
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function teamName(team, fallbackPath, fallback) {
  if (!Array.isArray(team) && (team.name || team.teamName)) return team.name || team.teamName;
  return path.basename(fallbackPath, path.extname(fallbackPath)) || fallback;
}

function printLineup(result, side) {
  const team = result.teams[side];
  console.log(`${team.name} lineup (${team.formation.label}, ${team.tactic}):`);

  for (const assignment of team.lineup.assignments) {
    const player = assignment.player || "EMPTY";
    console.log(`  ${assignment.slotLabel.padEnd(22)} #${String(assignment.position).padEnd(2)} ${player} (${assignment.rawScore})`);
  }
}

function printMatch(result) {
  const { home, away } = result.teams;

  console.log(`${home.name} ${result.score.home} - ${result.score.away} ${away.name}`);
  console.log(`seed: ${result.seed}`);
  console.log(`clock: ${result.clock.minutesPerSection}分 x ${result.clock.sections}セクション (${result.clock.totalMinutes}分)`);
  console.log(
    `xG: ${home.name} ${result.boxScore.home.xg} / ${away.name} ${result.boxScore.away.xg}`,
  );
  console.log(
    `shots: ${result.boxScore.home.shots} (${result.boxScore.home.shotsOnTarget} on target) / ${result.boxScore.away.shots} (${result.boxScore.away.shotsOnTarget} on target)`,
  );
  console.log(
    `passes: ${result.boxScore.home.completedPasses}/${result.boxScore.home.passes} / ${result.boxScore.away.completedPasses}/${result.boxScore.away.passes}`,
  );
  console.log(
    `steals/interceptions/blocks: ${result.boxScore.home.steals}/${result.boxScore.home.interceptions}/${result.boxScore.home.blocks} / ${result.boxScore.away.steals}/${result.boxScore.away.interceptions}/${result.boxScore.away.blocks}`,
  );
  console.log("");
  console.log(
    `profile: ${home.name} flow ${home.profile.flow} em ${home.profile.emission} ret ${home.profile.retention} steal ${home.profile.steal} int ${home.profile.interception}`,
  );
  console.log(
    `         ${away.name} flow ${away.profile.flow} em ${away.profile.emission} ret ${away.profile.retention} steal ${away.profile.steal} int ${away.profile.interception}`,
  );
  console.log("");

  const goals = result.events.filter((event) => event.type === "goal");

  if (goals.length) {
    console.log("goals:");
    for (const goal of goals) {
      const assist = goal.assist ? `, assist ${goal.assist}` : "";
      console.log(`  S${goal.section} ${String(goal.minute).padStart(2, "0")}' ${goal.team}: ${goal.player}${assist} (${goal.score.home}-${goal.score.away})`);
    }
    console.log("");
  } else {
    console.log("goals: none");
    console.log("");
  }

  printLineup(result, "home");
  console.log("");
  printLineup(result, "away");
}

function printSeries(series, homeName, awayName) {
  console.log(`${homeName} vs ${awayName} (${series.matches} matches)`);
  console.log(`home wins: ${series.homeWins} (${Math.round(series.homeWinRate * 1000) / 10}%)`);
  console.log(`draws: ${series.draws} (${Math.round(series.drawRate * 1000) / 10}%)`);
  console.log(`away wins: ${series.awayWins} (${Math.round(series.awayWinRate * 1000) / 10}%)`);
  console.log(`average score: ${series.averageScore.home} - ${series.averageScore.away}`);
  console.log(`average xG: ${series.averageXg.home} - ${series.averageXg.away}`);
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  if (positional.length < 2) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const [homePath, awayPath] = positional;
  const [homeTeam, awayTeam] = await Promise.all([readJson(homePath), readJson(awayPath)]);
  const matchOptions = {
    seed: options.seed || defaultMatchOptions.seed,
    homeName: options.homeName || teamName(homeTeam, homePath, "Home"),
    awayName: options.awayName || teamName(awayTeam, awayPath, "Away"),
    homeFormation: options.homeFormation || defaultMatchOptions.homeFormation,
    awayFormation: options.awayFormation || defaultMatchOptions.awayFormation,
    homeTactic: options.homeTactic || defaultMatchOptions.homeTactic,
    awayTactic: options.awayTactic || defaultMatchOptions.awayTactic,
    sections: options.sections ? Number(options.sections) : defaultMatchOptions.sections,
    minutesPerSection: options.minutesPerSection ? Number(options.minutesPerSection) : defaultMatchOptions.minutesPerSection,
    eventsPerMinute: options.eventsPerMinute ? Number(options.eventsPerMinute) : defaultMatchOptions.eventsPerMinute,
    includePassEvents: Boolean(options.includePassEvents),
    enableChangers: options.enableChangers ?? defaultMatchOptions.enableChangers,
  };

  if (options.series) {
    const series = simulateSeries(homeTeam, awayTeam, {
      ...matchOptions,
      matches: Number(options.series),
    });

    if (options.json) console.log(JSON.stringify(series, null, 2));
    else printSeries(series, matchOptions.homeName, matchOptions.awayName);
    return;
  }

  const result = simulateMatch(homeTeam, awayTeam, matchOptions);

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else printMatch(result);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
