#!/usr/bin/env node

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conditionLevels, defaultLeagueOptions, defaultMatchOptions, simulateLeagueSeason, simulateMatch, simulateSeries, tactics } from "./simulator.js";
import { formations } from "./formations.js";
import { createWorld, defaultWorldOptions, progressWorldDay, progressWorldUntil, worldCountryDefaults } from "./world.js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const webRoot = path.join(projectRoot, "web");
const samplesRoot = path.join(projectRoot, "samples");
const generatorDataPath = path.resolve(projectRoot, "..", "data", "generator-data.json");
let generatorPositionDataCache = null;
const germanLeagueFiles = [
  "ベルリン.json",
  "ミュンヘン.json",
  "ハンブルク.json",
  "フランクフルト.json",
  "ライプツィヒ.json",
  "ドルトムント.json",
  "ケルン.json",
  "シュトゥットガルト.json",
  "デュッセルドルフ.json",
  "エッセン.json",
  "ブレーメン.json",
  "ドレスデン.json",
  "ハノーファー.json",
  "ニュルンベルク.json",
  "デュースブルク.json",
  "ボーフム.json",
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

// 10リーグ規模のワールド全体（全チーム・全選手の状態）を毎回 POST するため、
// 8MB では足りずに "JSON body is too large." が発生していた。
// localhost で動かすローカルツールのため、上限を大きめに引き上げる。
const MAX_JSON_BODY_BYTES = 256 * 1024 * 1024;

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BODY_BYTES) {
      throw new Error("JSON body is too large.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw.replace(/^\uFEFF/, "")) : {};
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function readGeneratorPositionData() {
  if (generatorPositionDataCache) return generatorPositionDataCache;
  const data = await readJsonFile(generatorDataPath);
  generatorPositionDataCache = {
    statNames: data.statNames || [],
    positionCodes: data.positionCodes || [],
    positionWeights: data.positionWeights || {},
  };
  return generatorPositionDataCache;
}

function teamName(team, fallback) {
  if (!team) return fallback;
  if (!Array.isArray(team) && (team.name || team.teamName)) return team.name || team.teamName;
  return fallback;
}

function matchOptionsFromBody(body) {
  return {
    seed: body.seed || defaultMatchOptions.seed,
    homeName: body.homeName || teamName(body.homeTeam, "Home"),
    awayName: body.awayName || teamName(body.awayTeam, "Away"),
    homeFormation: body.homeFormation || defaultMatchOptions.homeFormation,
    awayFormation: body.awayFormation || defaultMatchOptions.awayFormation,
    homeTactic: body.homeTactic || defaultMatchOptions.homeTactic,
    awayTactic: body.awayTactic || defaultMatchOptions.awayTactic,
    sections: Number(body.sections) || defaultMatchOptions.sections,
    minutesPerSection: Number(body.minutesPerSection) || defaultMatchOptions.minutesPerSection,
    eventsPerMinute: Number(body.eventsPerMinute) || defaultMatchOptions.eventsPerMinute,
    includePassEvents: Boolean(body.includePassEvents),
    enableChangers: body.enableChangers !== false,
    enableBenchSubstitutions: body.enableBenchSubstitutions !== false,
    regularSubstitutionsPerBreak: Number(body.regularSubstitutionsPerBreak) || defaultMatchOptions.regularSubstitutionsPerBreak,
    fatigueImpact: body.enableFatigue === false ? 0 : Number(body.fatigueImpact ?? defaultMatchOptions.fatigueImpact),
    homeCondition: body.homeCondition || defaultMatchOptions.homeCondition,
    awayCondition: body.awayCondition || defaultMatchOptions.awayCondition,
    adjustLineupByCondition: body.adjustLineupByCondition !== false,
  };
}

function worldMatchOptionsFromBody(body) {
  return {
    ...matchOptionsFromBody(body),
    randomize: body.randomize !== false,
  };
}

function leagueOptionsFromBody(body) {
  return {
    ...matchOptionsFromBody(body),
    seed: body.seed || defaultLeagueOptions.seed,
    name: body.name || defaultLeagueOptions.name,
    clSlots: Number(body.clSlots) || defaultLeagueOptions.clSlots,
    includeMatchDetails: Boolean(body.includeMatchDetails),
    enableSeasonFatigue: body.enableSeasonFatigue !== false,
  };
}

async function listSamples() {
  const names = await readdir(samplesRoot);
  const files = names.filter((name) => name.endsWith(".json")).sort();
  const samples = [];

  for (const file of files) {
    try {
      const team = await readJsonFile(path.join(samplesRoot, file));
      samples.push({ file, name: teamName(team, path.basename(file, ".json")) });
    } catch {
      samples.push({ file, name: path.basename(file, ".json") });
    }
  }

  return samples;
}

async function listGermanLeagueTeams() {
  const teams = [];

  for (const file of germanLeagueFiles) {
    try {
      const rawTeam = await readJsonFile(path.join(projectRoot, file));
      const name = teamName(rawTeam, path.basename(file, ".json"));
      const team = Array.isArray(rawTeam) ? { name, players: rawTeam } : { ...rawTeam, name };
      teams.push({ file, name, team });
    } catch {
      // Missing team files are ignored so custom workspaces can still run.
    }
  }

  return teams;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/meta") {
    sendJson(res, 200, {
      defaults: defaultMatchOptions,
      formations: Object.entries(formations).map(([key, formation]) => ({
        key,
        label: formation.label,
        slots: formation.slots,
        op: formation.op,
      })),
      tactics: Object.entries(tactics).map(([key, tactic]) => ({ key, label: tactic.label })),
      conditions: Object.entries(conditionLevels).map(([key, condition]) => ({ key, label: condition.label })),
      samples: await listSamples(),
      league: {
        defaults: defaultLeagueOptions,
        germanTeams: (await listGermanLeagueTeams()).map(({ file, name }) => ({ file, name })),
      },
      world: {
        defaults: defaultWorldOptions,
        countries: worldCountryDefaults,
      },
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/league-teams/germany") {
    sendJson(res, 200, { teams: await listGermanLeagueTeams() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/generator-position-data") {
    sendJson(res, 200, await readGeneratorPositionData());
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/samples/")) {
    const file = decodeURIComponent(url.pathname.slice("/api/samples/".length));
    if (!/^[\w.-]+\.json$/i.test(file)) {
      sendJson(res, 400, { error: "Invalid sample file." });
      return true;
    }
    sendJson(res, 200, await readJsonFile(path.join(samplesRoot, file)));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/match") {
    const body = await readJsonBody(req);
    if (!body.homeTeam || !body.awayTeam) {
      sendJson(res, 400, { error: "Home and away teams are required." });
      return true;
    }
    sendJson(res, 200, simulateMatch(body.homeTeam, body.awayTeam, matchOptionsFromBody(body)));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/series") {
    const body = await readJsonBody(req);
    if (!body.homeTeam || !body.awayTeam) {
      sendJson(res, 400, { error: "Home and away teams are required." });
      return true;
    }
    sendJson(res, 200, simulateSeries(body.homeTeam, body.awayTeam, {
      ...matchOptionsFromBody(body),
      matches: Number(body.matches) || 100,
    }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/league-season") {
    const body = await readJsonBody(req);
    let teams = Array.isArray(body.teams) ? body.teams : [];

    if (!teams.length && body.preset === "germany") {
      teams = (await listGermanLeagueTeams()).map((entry) => entry.team);
    }

    if (teams.length < 2) {
      sendJson(res, 400, { error: "At least two teams are required for a league season." });
      return true;
    }

    sendJson(res, 200, simulateLeagueSeason(teams, leagueOptionsFromBody(body)));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/world/create") {
    const body = await readJsonBody(req);
    sendJson(res, 200, createWorld(body));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/world/progress-day") {
    const body = await readJsonBody(req);
    if (!body.world) {
      sendJson(res, 400, { error: "World data is required." });
      return true;
    }
    sendJson(res, 200, progressWorldDay(body.world, worldMatchOptionsFromBody(body.options || {})));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/world/progress-until") {
    const body = await readJsonBody(req);
    if (!body.world) {
      sendJson(res, 400, { error: "World data is required." });
      return true;
    }
    sendJson(res, 200, progressWorldUntil(body.world, {
      targetDate: body.targetDate,
      matchOptions: worldMatchOptionsFromBody(body.options || {}),
    }));
    return true;
  }

  return false;
}

async function serveStatic(res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const resolved = path.resolve(webRoot, `.${requestPath}`);

  if (!resolved.startsWith(webRoot)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

function createRequestHandler() {
  return async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    try {
      if (url.pathname.startsWith("/api/") && await handleApi(req, res, url)) return;
      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "API endpoint not found." });
        return;
      }
      await serveStatic(res, url);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Server error." });
    }
  };
}

async function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true });
    return;
  }

  execFile(process.platform === "darwin" ? "open" : "xdg-open", [url]);
}

export async function startServer({ host = "127.0.0.1", port = 3217, open = false } = {}) {
  let lastError = null;

  for (let nextPort = port; nextPort < port + 20; nextPort += 1) {
    const server = createServer(createRequestHandler());

    try {
      await listen(server, host, nextPort);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : nextPort;
      const url = `http://${host}:${actualPort}/`;
      if (open) openBrowser(url);
      return { server, url, host, port: actualPort };
    } catch (error) {
      lastError = error;
      if (error.code !== "EADDRINUSE") throw error;
    }
  }

  throw lastError || new Error("No available port found.");
}

function parseCliArgs(argv) {
  const options = { host: "127.0.0.1", port: 3217, open: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--open") options.open = true;
    else if (arg === "--host") options.host = argv[++index] || options.host;
    else if (arg === "--port") options.port = Number(argv[++index]) || options.port;
  }

  return options;
}

if (path.resolve(process.argv[1] || "") === __filename) {
  startServer(parseCliArgs(process.argv.slice(2)))
    .then(({ url }) => {
      console.log(`Touken Battle Sim: ${url}`);
      console.log("Close this window to stop the local server.");
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
