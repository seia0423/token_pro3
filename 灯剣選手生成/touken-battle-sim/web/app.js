const state = {
  meta: null,
  homeTeam: null,
  awayTeam: null,
  library: [],
  leagueTeams: [],
  worldDraftLeagues: [],
  worldSelectedTeamIds: new Set(),
  worldTeamGroups: {},
  world: null,
  worldApiAvailable: true,
  worldSelectedFixtureId: null,
  worldSummaryLeagueId: "all",
  worldRosterTeamId: null,
  lastNextSeasonPack: null,
  generatorPositionData: null,
  lastWorldSummary: null,
  lastMatch: null,
  lastSeries: null,
  lastLeague: null,
  matchRun: 0,
};

const storageKey = "touken-battle-sim-ui-v1";
const worldStorageKey = "touken-battle-sim-world-v1";
const libraryDbName = "touken-battle-sim-library";
const libraryStoreName = "teams";
const fallbackWorldMeta = {
  defaults: {
    seed: "touken-world",
    scheduleSeed: "touken-schedule",
    seasonLabel: "29/30",
    startDate: "2029-09-15",
    endDate: "2030-07-15",
  },
  countries: [
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
  ],
};
const worldLeagueFormatOptions = [
  { key: "single-round-robin", label: "1回総当たり" },
  { key: "double-round-robin", label: "ホーム&アウェイ1巡" },
  { key: "quadruple-round-robin", label: "ホーム&アウェイ2巡" },
  { key: "split-after-double", label: "前後期分割" },
  { key: "regional-mixed", label: "地域/グループ型" },
];
const countryFormatDefaults = {
  japan: "quadruple-round-robin",
  germany: "double-round-robin",
  usa: "regional-mixed",
  uk: "double-round-robin",
  france: "double-round-robin",
  italy: "split-after-double",
  spain: "split-after-double",
  korea: "regional-mixed",
  china: "double-round-robin",
  russia: "double-round-robin",
};
const countryGroupTemplates = {
  usa: [
    { key: "west", label: "西" },
    { key: "central", label: "中" },
    { key: "east", label: "東" },
  ],
  korea: [
    { key: "central", label: "中央" },
    { key: "local", label: "地方" },
  ],
  default: [
    { key: "group-a", label: "A" },
    { key: "group-b", label: "B" },
  ],
};
const developmentSidePositionPairs = [
  { right: "2", left: "3" },
  { right: "5", left: "6" },
  { right: "12", left: "13" },
  { right: "15", left: "16" },
];
const developmentRatingScale = {
  eliteCurveStart: 88,
  eliteCurveGain: 7,
  eliteCurveWidth: 6,
  hardMax: 94.8,
};
const eventLabels = {
  goal: "ゴール",
  shot_on_target: "枠内",
  shot: "射出",
  blocked_shot: "遮断",
  steal: "奪取",
  interception: "迎撃",
  pass: "パス",
  substitution: "控え交代",
  formation_change: "陣形変更",
  defensive_changer: "守備チェンジャー",
  offensive_changer: "攻撃チェンジャー",
};

const profileLabels = {
  flow: "流れ",
  emission: "射出",
  retention: "保持",
  steal: "奪取",
  interception: "迎撃",
  finishing: "決定",
  stamina: "持久",
};

const assignmentKindLabels = {
  base: "基本",
  op: "OP",
  alternate: "代替",
  substitution: "控え",
  defensive_changer: "守備CH",
  offensive_changer: "攻撃CH",
  empty: "-",
};

const substitutionReasonLabels = {
  attacking_adjustment: "攻撃調整",
  defensive_adjustment: "守備調整",
  fatigue_relief: "疲労対応",
  fitness_upgrade: "実効値改善",
  shape_adjustment: "陣形調整",
  mid_section_changer: "セクション中投入",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function setStatus(text) {
  $("#statusText").textContent = text;
}

function openLibraryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(libraryDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(libraryStoreName)) {
        db.createObjectStore(libraryStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("チームライブラリを開けませんでした。"));
  });
}

async function libraryTransaction(mode, action) {
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(libraryStoreName, mode);
    const store = tx.objectStore(libraryStoreName);
    const result = action(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("チームライブラリの処理に失敗しました。"));
    };
  });
}

async function getLibraryTeams() {
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(libraryStoreName, "readonly");
    const request = tx.objectStore(libraryStoreName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("登録チームを読み込めませんでした。"));
    };
  });
}

async function saveLibraryTeam(team, source = "") {
  const name = teamName(team, "Team");
  const seasonSuffix = team?.season ? ` (${team.season})` : "";
  const libraryName = team?.libraryName || `${name}${seasonSuffix}`;
  const id = team?.libraryId || libraryName;
  const entry = {
    id,
    name: libraryName,
    playerCount: teamPlayers(team).length,
    updatedAt: Date.now(),
    source,
    team,
  };

  await libraryTransaction("readwrite", (store) => store.put(entry));
  return entry;
}

async function deleteLibraryEntry(id) {
  await libraryTransaction("readwrite", (store) => store.delete(id));
}

function teamPlayers(team) {
  if (Array.isArray(team)) return team;
  return team?.players || team?.roster || [];
}

function fileTeamName(fileName) {
  return String(fileName || "Team")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || "Team";
}

function normalizeLoadedTeam(rawTeam, name) {
  if (Array.isArray(rawTeam)) {
    if (!rawTeam.length) throw new Error(`${name} に選手が入っていません。`);
    return { name, players: rawTeam };
  }

  const players = rawTeam?.players || rawTeam?.roster || rawTeam?.team;
  if (!Array.isArray(players) || !players.length) {
    throw new Error(`${name} はチームJSONとして読み込めませんでした。players配列、または選手配列のJSONを指定してください。`);
  }

  return {
    ...rawTeam,
    name: name || rawTeam.name || rawTeam.teamName || "Team",
    players,
  };
}

function teamName(team, fallback) {
  if (!team) return "未読込";
  if (!Array.isArray(team) && (team.name || team.teamName)) return team.name || team.teamName;
  return `${fallback} (${teamPlayers(team).length})`;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    homeTeam: state.homeTeam,
    awayTeam: state.awayTeam,
  }));
}

function saveWorldState() {
  try {
    if (state.world) {
      localStorage.setItem(worldStorageKey, JSON.stringify(compactWorldForStorage(state.world)));
    } else {
      localStorage.removeItem(worldStorageKey);
    }
  } catch {
    setStatus("ワールド保存容量を超えました。保存出力を使ってください。");
  }
}

function compactWorldForStorage(world) {
  if (!world) return world;
  const copy = structuredClone(world);
  pruneStoredWorldMatchDetails(copy, copy.completed ? 0 : 50);
  if (copy.latestSummary?.rangeSummary) {
    copy.latestSummary = {
      ...copy.latestSummary,
      rangeSummary: undefined,
    };
    delete copy.latestSummary.rangeSummary;
  }
  return copy;
}

function lightStoredBoxScore(box = {}) {
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

function pruneStoredResult(result) {
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
      home: lightStoredBoxScore(result.boxScore?.home),
      away: lightStoredBoxScore(result.boxScore?.away),
    },
  };
}

function pruneStoredWorldMatchDetails(world, keepRecent = 50) {
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
  const pruneCount = Math.max(0, played.length - Math.max(0, Number(keepRecent) || 0));
  for (const item of played.slice(0, pruneCount)) {
    item.fixture.result = pruneStoredResult(item.fixture.result);
  }
}

function worldPayload() {
  return compactWorldForStorage(state.world);
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    state.homeTeam = saved.homeTeam || null;
    state.awayTeam = saved.awayTeam || null;
  } catch {
    state.homeTeam = null;
    state.awayTeam = null;
  }
}

function loadSavedWorld() {
  try {
    state.world = compactWorldForStorage(JSON.parse(localStorage.getItem(worldStorageKey) || "null"));
    state.lastWorldSummary = state.world?.latestSummary || null;
    state.worldSummaryLeagueId = "all";
    state.worldRosterTeamId = null;
  } catch {
    state.world = null;
    state.lastWorldSummary = null;
    state.worldSummaryLeagueId = "all";
    state.worldRosterTeamId = null;
  }
}

function updateTeamLabels() {
  $("#homeName").textContent = teamName(state.homeTeam, "Home");
  $("#awayName").textContent = teamName(state.awayTeam, "Away");
}

function updateLibraryControls() {
  const select = $("#librarySelect");
  const sorted = [...state.library].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  select.replaceChildren(...sorted.map((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.name} (${entry.playerCount})`;
    return option;
  }));
  $("#libraryCount").textContent = `${sorted.length}件`;
  const hasTeams = sorted.length > 0;
  $("#loadLibraryHome").disabled = !hasTeams;
  $("#loadLibraryAway").disabled = !hasTeams;
  $("#deleteLibraryTeam").disabled = !hasTeams;
}

async function refreshLibrary() {
  state.library = await getLibraryTeams();
  updateLibraryControls();
  updateWorldControls();
}

function fillSelect(select, items, selected) {
  select.replaceChildren(...items.map((item) => {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = item.label;
    option.selected = item.key === selected;
    return option;
  }));
}

function optionsPayload(overrides = {}) {
  return {
    homeTeam: state.homeTeam,
    awayTeam: state.awayTeam,
    homeName: teamName(state.homeTeam, "Home"),
    awayName: teamName(state.awayTeam, "Away"),
    homeFormation: $("#homeFormation").value,
    awayFormation: $("#awayFormation").value,
    homeTactic: $("#homeTactic").value,
    awayTactic: $("#awayTactic").value,
    homeCondition: $("#homeCondition").value,
    awayCondition: $("#awayCondition").value,
    seed: $("#seed").value.trim() || state.meta.defaults.seed,
    enableChangers: $("#enableChangers").checked,
    enableBenchSubstitutions: $("#enableBenchSubstitutions").checked,
    regularSubstitutionsPerBreak: Number($("#regularSubstitutionsPerBreak").value) || 0,
    enableFatigue: $("#enableFatigue").checked,
    adjustLineupByCondition: $("#adjustLineupByCondition").checked,
    includePassEvents: $("#includePassEvents").checked,
    ...overrides,
  };
}

function nextMatchSeed() {
  const baseSeed = $("#seed").value.trim() || state.meta.defaults.seed;
  if ($("#lockSeed").checked) return baseSeed;
  state.matchRun += 1;
  return `${baseSeed}-${Date.now().toString(36)}-${state.matchRun}`;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // サーバーがプレーンテキストでエラーを返した場合（例: "JSON body is too large."）
    if (!response.ok) throw new Error(text || `Request failed (${response.status}).`);
    throw new Error("サーバーの応答を解析できませんでした。");
  }
  if (!response.ok) throw new Error(data.error || text || "Request failed.");
  return data;
}

async function loadGeneratorPositionData() {
  if (state.generatorPositionData) return state.generatorPositionData;
  const response = await fetch("/api/generator-position-data");
  if (!response.ok) throw new Error("選手生成データを読み込めませんでした。");
  const data = await response.json();
  if (!data?.statNames?.length || !data?.positionCodes?.length || !data?.positionWeights) {
    throw new Error("選手生成データにポジション計算情報がありません。");
  }
  state.generatorPositionData = data;
  return data;
}

function assertTeamsReady() {
  if (!state.homeTeam || !state.awayTeam) {
    throw new Error("HomeとAwayのチームJSONを読み込んでください。");
  }
}

function setBusy(isBusy) {
  for (const button of $$("button")) button.disabled = isBusy;
  if (!isBusy && $("#librarySelect")) updateLibraryControls();
  if (!isBusy && $("#worldTeamPicker")) updateWorldControls();
}

async function readTeamFile(side, file) {
  try {
    if (!file) return;
    const text = await file.text();
    const rawTeam = JSON.parse(text.replace(/^\uFEFF/, ""));
    const team = normalizeLoadedTeam(rawTeam, fileTeamName(file.name));
    state[`${side}Team`] = team;
    saveState();
    updateTeamLabels();
    setStatus(`${side === "home" ? "Home" : "Away"}: ${teamName(team, side)} を読み込みました`);
  } catch (error) {
    setStatus(error.message || "JSONを読み込めませんでした。");
  }
}

function isNextSeasonTeamPack(raw) {
  return raw?.ruleset === "luminous-sword-next-season-team-pack-v1" && Array.isArray(raw.teams);
}

async function registerTeamFiles(files) {
  const selected = [...files];
  if (!selected.length) return;

  let registered = 0;
  const failures = [];

  for (const file of selected) {
    try {
      const text = await file.text();
      const rawTeam = JSON.parse(text.replace(/^\uFEFF/, ""));
      if (isNextSeasonTeamPack(rawTeam)) {
        for (const entry of rawTeam.teams) {
          if (!entry?.team) continue;
          const team = normalizeLoadedTeam(entry.team, entry.team.name || entry.team.teamName || entry.name || fileTeamName(entry.fileName));
          await saveLibraryTeam(team, entry.fileName || file.name);
          registered += 1;
          if (registered % 4 === 0) await yieldToBrowser();
        }
        continue;
      }
      const team = normalizeLoadedTeam(rawTeam, fileTeamName(file.name));
      await saveLibraryTeam(team, file.name);
      registered += 1;
    } catch (error) {
      failures.push(`${file.name}: ${error.message || "読込失敗"}`);
    }
  }

  await refreshLibrary();
  setStatus(failures.length ? `${registered}件登録、${failures.length}件失敗` : `${registered}件のチームを登録しました`);
}

async function registerLoadedTeams() {
  const targets = [
    ["Home", state.homeTeam],
    ["Away", state.awayTeam],
  ].filter(([, team]) => team);

  if (!targets.length) {
    setStatus("登録するチームがありません。");
    return;
  }

  for (const [side, team] of targets) {
    await saveLibraryTeam(team, side);
  }
  await refreshLibrary();
  setStatus(`${targets.length}件の読込中チームを登録しました`);
}

async function loadLibraryTeam(side) {
  const id = $("#librarySelect").value;
  const entry = state.library.find((item) => item.id === id);
  if (!entry) {
    setStatus("登録チームが選択されていません。");
    return;
  }

  state[`${side}Team`] = entry.team;
  saveState();
  updateTeamLabels();
  setStatus(`${side === "home" ? "Home" : "Away"}: ${entry.name} を呼び出しました`);
}

async function deleteSelectedLibraryTeam() {
  const id = $("#librarySelect").value;
  const entry = state.library.find((item) => item.id === id);
  if (!entry) return;

  await deleteLibraryEntry(id);
  await refreshLibrary();
  setStatus(`${entry.name} を登録から削除しました`);
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const fixed = number.toFixed(digits);
  if (digits <= 0) return fixed;
  return fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function formatSigned(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number > 0 ? `+${formatNumber(number, 0)}` : formatNumber(number, 0);
}

function downloadJson(fileName, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function summaryItem(label, homeValue, awayValue) {
  const item = document.createElement("div");
  item.className = "summary-item";
  item.innerHTML = `
    <span>${label}</span>
    <strong>${homeValue}</strong>
    <em>${awayValue}</em>
  `;
  return item;
}

function comparisonRow(label, homeValue, awayValue, highlight = false) {
  return `
    <tr${highlight ? ' class="highlight-row"' : ""}>
      <td class="home-stat">${escapeHtml(homeValue)}</td>
      <th>${escapeHtml(label)}</th>
      <td class="away-stat">${escapeHtml(awayValue)}</td>
    </tr>
  `;
}

function renderScoreboard(result) {
  const home = result.teams.home.name;
  const away = result.teams.away.name;
  const board = $("#scoreboard");
  board.classList.remove("empty");
  board.innerHTML = `
    <div>
      <span>${escapeHtml(home)}</span>
      <strong>${result.score.home}</strong>
    </div>
    <div class="scoreline">-</div>
    <div>
      <span>${escapeHtml(away)}</span>
      <strong>${result.score.away}</strong>
    </div>
  `;
}

function goalRows(result, side) {
  const goals = result.events.filter((event) => event.type === "goal" && event.side === side);

  if (!goals.length) {
    return `<li class="empty-moment">-</li>`;
  }

  return goals.map((goal) => {
    const assist = goal.assist ? ` <em>${escapeHtml(goal.assist)}</em>` : "";
    return `
      <li>
        <time>S${goal.section} ${goal.minute}'</time>
        <span>${escapeHtml(goal.player || "Unknown")}${assist}</span>
      </li>
    `;
  }).join("");
}

function renderScoreDetails(result) {
  $("#scoreDetails").innerHTML = `
    <section>
      <h2>${escapeHtml(result.teams.home.name)}</h2>
      <ul>${goalRows(result, "home")}</ul>
    </section>
    <section>
      <h2>得点者</h2>
    </section>
    <section>
      <h2>${escapeHtml(result.teams.away.name)}</h2>
      <ul>${goalRows(result, "away")}</ul>
    </section>
  `;
}

function changeRows(result, side) {
  const changes = result.events.filter((event) =>
    event.side === side && ["substitution", "formation_change", "defensive_changer", "offensive_changer"].includes(event.type),
  );

  if (!changes.length) {
    return `<li class="empty-moment">-</li>`;
  }

  return changes.map((event) => {
    const label = eventLabels[event.type] || event.type;
    const player = event.player ? ` ${escapeHtml(event.player)}` : "";
    const replaced = event.replaced ? ` <span class="swap-mark">←</span> ${escapeHtml(event.replaced)}` : "";
    const reason = substitutionReasonLabels[event.reason] || "";
    const gain = Number.isFinite(event.projectedGain) ? `効果 +${formatNumber(event.projectedGain, 1)}` : "";
    const formation = event.formationFrom && event.formationTo
      ? `<em>${escapeHtml([`${event.formationFrom} → ${event.formationTo}`, reason, gain].filter(Boolean).join(" / "))}</em>`
      : reason || gain
        ? `<em>${escapeHtml([reason, gain].filter(Boolean).join(" / "))}</em>`
      : "";

    return `
      <li class="${event.type}">
        <time>S${event.section} ${event.minute}'</time>
        <span><strong>${escapeHtml(label)}</strong>${player}${replaced}${formation}</span>
      </li>
    `;
  }).join("");
}

function renderChangeSummary(result) {
  $("#changeSummary").innerHTML = `
    <section>
      <h2>${escapeHtml(result.teams.home.name)}</h2>
      <ul>${changeRows(result, "home")}</ul>
    </section>
    <section>
      <h2>交代・陣形変更</h2>
    </section>
    <section>
      <h2>${escapeHtml(result.teams.away.name)}</h2>
      <ul>${changeRows(result, "away")}</ul>
    </section>
  `;
}

function renderSummary(result) {
  const homeBox = result.boxScore.home;
  const awayBox = result.boxScore.away;
  const homeProfile = result.teams.home.profile;
  const awayProfile = result.teams.away.profile;
  const passRate = (box) => box.passes ? `${formatNumber((box.completedPasses / box.passes) * 100, 1)}%` : "-";
  const rows = [
    comparisonRow("スコア", result.score.home, result.score.away, true),
    comparisonRow("xG", formatNumber(homeBox.xg), formatNumber(awayBox.xg), true),
    comparisonRow("シュート", homeBox.shots, awayBox.shots),
    comparisonRow("枠内", homeBox.shotsOnTarget, awayBox.shotsOnTarget),
    comparisonRow("パス", `${homeBox.completedPasses}/${homeBox.passes}`, `${awayBox.completedPasses}/${awayBox.passes}`),
    comparisonRow("パス成功率", passRate(homeBox), passRate(awayBox)),
    comparisonRow("キャリー", homeBox.carries, awayBox.carries),
    comparisonRow("奪取", homeBox.steals, awayBox.steals),
    comparisonRow("迎撃", homeBox.interceptions, awayBox.interceptions),
    comparisonRow("遮断", homeBox.blocks, awayBox.blocks),
    comparisonRow("ルミナス喪失", homeBox.luminousLosses, awayBox.luminousLosses),
    comparisonRow("導路負荷", formatNumber(homeBox.conduitLoad, 1), formatNumber(awayBox.conduitLoad, 1)),
    comparisonRow("疲労影響", formatNumber(homeBox.fatigueImpact, 1), formatNumber(awayBox.fatigueImpact, 1)),
    comparisonRow("総合", formatNumber(homeProfile.overall, 1), formatNumber(awayProfile.overall, 1), true),
    comparisonRow("攻撃", formatNumber(homeProfile.attack, 1), formatNumber(awayProfile.attack, 1)),
    comparisonRow("守備", formatNumber(homeProfile.defense, 1), formatNumber(awayProfile.defense, 1)),
    comparisonRow("支配", formatNumber(homeProfile.control, 1), formatNumber(awayProfile.control, 1)),
    comparisonRow("流れ", formatNumber(homeProfile.flow, 1), formatNumber(awayProfile.flow, 1)),
    comparisonRow("保持", formatNumber(homeProfile.retention, 1), formatNumber(awayProfile.retention, 1)),
    comparisonRow("射出", formatNumber(homeProfile.emission, 1), formatNumber(awayProfile.emission, 1)),
    comparisonRow("奪取力", formatNumber(homeProfile.steal, 1), formatNumber(awayProfile.steal, 1)),
    comparisonRow("迎撃力", formatNumber(homeProfile.interception, 1), formatNumber(awayProfile.interception, 1)),
    comparisonRow("決定力", formatNumber(homeProfile.finishing, 1), formatNumber(awayProfile.finishing, 1)),
    comparisonRow("スタミナ", formatNumber(homeProfile.stamina, 1), formatNumber(awayProfile.stamina, 1)),
  ].join("");

  $("#summaryGrid").innerHTML = `
    <table class="comparison-table">
      <caption>スタッツ比較</caption>
      <thead>
        <tr>
          <th>${escapeHtml(result.teams.home.name)}</th>
          <th>項目</th>
          <th>${escapeHtml(result.teams.away.name)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function eventText(event) {
  const score = event.score ? `${event.score.home}-${event.score.away}` : "";
  const label = eventLabels[event.type] || event.type;
  if (event.type === "formation_change") {
    const reason = substitutionReasonLabels[event.reason] || "";
    const gain = Number.isFinite(event.projectedGain) ? ` / 効果 +${formatNumber(event.projectedGain, 1)}` : "";
    const reasonText = reason ? ` / ${reason}` : "";
    return `${label} ${event.team}: ${event.formationFrom || ""}→${event.formationTo || ""}${reasonText}${gain} ${score}`.trim();
  }

  const target = event.target ? ` → ${event.target}` : "";
  const replaced = event.replaced ? ` ↔ ${event.replaced}` : "";
  const assist = event.assist ? ` / assist ${event.assist}` : "";
  const xg = Number.isFinite(event.xg) ? ` / xG ${formatNumber(event.xg, 3)}` : "";
  const formation = event.formationFrom && event.formationTo ? ` / ${event.formationFrom}→${event.formationTo}` : "";
  const reason = substitutionReasonLabels[event.reason] || "";
  const gain = Number.isFinite(event.projectedGain) ? ` / 効果 +${formatNumber(event.projectedGain, 1)}` : "";
  const reasonText = reason ? ` / ${reason}` : "";
  return `${label} ${event.team}: ${event.player || ""}${target}${replaced}${assist}${xg}${formation}${reasonText}${gain} ${score}`.trim();
}

function renderEvents(result) {
  const goals = result.events.filter((event) => event.type === "goal");
  const goalBox = $("#goals");

  if (goals.length) {
    goalBox.replaceChildren(...goals.map((goal) => {
      const item = document.createElement("div");
      item.className = "goal-row";
      item.textContent = `S${goal.section} ${goal.minute}' ${goal.team}: ${goal.player}${goal.assist ? ` / ${goal.assist}` : ""} (${goal.score.home}-${goal.score.away})`;
      return item;
    }));
  } else {
    goalBox.innerHTML = `<div class="muted-row">ゴールなし</div>`;
  }

  const rows = result.events.map((event) => {
    const row = document.createElement("div");
    row.className = `event-row ${event.type}`;
    row.innerHTML = `
      <time>S${event.section} ${String(event.minute).padStart(2, "0")}'</time>
      <span>${eventText(event)}</span>
    `;
    return row;
  });
  $("#eventLog").replaceChildren(...rows);
}

function lineupTable(team, lineup, title) {
  const wrap = document.createElement("section");
  wrap.className = "lineup-table";
  const rows = lineup.assignments.map((assignment) => `
    <tr>
      <td>${assignment.slotLabel}</td>
      <td>#${assignment.position}</td>
      <td>${assignment.player || "-"}</td>
      <td>${assignment.condition || "-"}</td>
      <td>${formatNumber(assignment.rawScore, 1)}</td>
      <td>${assignmentKindLabels[assignment.kind] || assignment.kind || "-"}</td>
    </tr>
  `).join("");

  wrap.innerHTML = `
    <h2>${team.name} <span>${title} / ${lineup.formation.label} / ${team.tactic} / ${team.condition || "普通"}</span></h2>
    <table>
      <thead><tr><th>枠</th><th>Pos</th><th>選手</th><th>調子</th><th>適性</th><th>種別</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return wrap;
}

function renderLineups(result) {
  $("#lineups").replaceChildren(
    lineupTable(result.teams.home, result.teams.home.startingLineup || result.teams.home.lineup, "スタメン"),
    lineupTable(result.teams.away, result.teams.away.startingLineup || result.teams.away.lineup, "スタメン"),
    lineupTable(result.teams.home, result.teams.home.lineup, "最終編成"),
    lineupTable(result.teams.away, result.teams.away.lineup, "最終編成"),
  );
}

function renderMatch(result) {
  state.lastMatch = result;
  renderScoreboard(result);
  renderScoreDetails(result);
  renderChangeSummary(result);
  renderSummary(result);
  renderEvents(result);
  renderLineups(result);
  setStatus(`seed: ${result.seed} / ${result.clock.minutesPerSection}分 x ${result.clock.sections}セクション`);
}

function renderSeries(series) {
  const pct = (rate) => `${formatNumber(rate * 100, 1)}%`;
  $("#seriesResult").innerHTML = `
    <div class="series-grid">
      <div><span>Home勝率</span><strong>${pct(series.homeWinRate)}</strong><em>${series.homeWins}勝</em></div>
      <div><span>引分</span><strong>${pct(series.drawRate)}</strong><em>${series.draws}分</em></div>
      <div><span>Away勝率</span><strong>${pct(series.awayWinRate)}</strong><em>${series.awayWins}勝</em></div>
      <div><span>平均スコア</span><strong>${series.averageScore.home} - ${series.averageScore.away}</strong><em>${series.matches}試合</em></div>
      <div><span>平均xG</span><strong>${series.averageXg.home} - ${series.averageXg.away}</strong><em>期待値</em></div>
    </div>
  `;
}

function updateLeagueTeamCount() {
  const count = state.leagueTeams.length;
  $("#leagueTeamCount").textContent = `${count}チーム`;
}

async function loadGermanLeagueTeams() {
  const data = await fetch("/api/league-teams/germany").then((response) => response.json());
  state.leagueTeams = (data.teams || []).map((entry) => entry.team);
  updateLeagueTeamCount();
  setStatus(`${state.leagueTeams.length}チームをリーグに読み込みました`);
}

function useLibraryForLeague() {
  state.leagueTeams = state.library.map((entry) => entry.team);
  updateLeagueTeamCount();
  setStatus(`${state.leagueTeams.length}チームをリーグに登録しました`);
}

function worldCountryItems() {
  return state.meta?.world?.countries || fallbackWorldMeta.countries;
}

function currentWorldCountryKey() {
  return $("#worldCountry")?.value || "";
}

function currentWorldGroupTemplate() {
  return countryGroupTemplates[currentWorldCountryKey()] || countryGroupTemplates.default;
}

function defaultWorldGroupForIndex(index) {
  const template = currentWorldGroupTemplate();
  return template[index % template.length]?.key || template[0]?.key || "group-a";
}

function draftedWorldTeamIds() {
  return new Set(state.worldDraftLeagues.flatMap((league) => league.teamEntryIds));
}

function updateWorldCountryFields() {
  const country = worldCountryItems().find((item) => item.key === $("#worldCountry")?.value);
  if (!country) return;
  $("#worldLeagueName").value = country.leagueName;
  $("#worldClSlots").value = country.clSlots;
  if ($("#worldLeagueFormat")) {
    $("#worldLeagueFormat").value = country.format || countryFormatDefaults[country.key] || "double-round-robin";
  }
}

function updateWorldControls() {
  const teamPicker = $("#worldTeamPicker");
  if (!teamPicker) return;

  const countrySelect = $("#worldCountry");
  if (countrySelect && !countrySelect.options.length && worldCountryItems().length) {
    countrySelect.replaceChildren(...worldCountryItems().map((country) => {
      const option = document.createElement("option");
      option.value = country.key;
      option.textContent = country.country;
      return option;
    }));
    countrySelect.value = worldCountryItems()[1]?.key || worldCountryItems()[0]?.key || "";
    updateWorldCountryFields();
  }
  const formatSelect = $("#worldLeagueFormat");
  if (formatSelect && !formatSelect.options.length) {
    formatSelect.replaceChildren(...worldLeagueFormatOptions.map((format) => {
      const option = document.createElement("option");
      option.value = format.key;
      option.textContent = format.label;
      return option;
    }));
    formatSelect.value = "double-round-robin";
    updateWorldCountryFields();
  }

  const used = draftedWorldTeamIds();
  for (const id of [...state.worldSelectedTeamIds]) {
    if (used.has(id) || !state.library.some((entry) => entry.id === id)) {
      state.worldSelectedTeamIds.delete(id);
    }
  }

  const regionalMode = $("#worldLeagueFormat")?.value === "regional-mixed";
  const groupTemplate = currentWorldGroupTemplate();
  const groupKeys = new Set(groupTemplate.map((item) => item.key));
  const sorted = [...state.library].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  teamPicker.replaceChildren(...sorted.map((entry, index) => {
    const row = document.createElement("div");
    const button = document.createElement("button");
    const isUsed = used.has(entry.id);
    const isSelected = state.worldSelectedTeamIds.has(entry.id);
    const savedGroup = state.worldTeamGroups[entry.id];
    const group = groupKeys.has(savedGroup) ? savedGroup : defaultWorldGroupForIndex(index);
    state.worldTeamGroups[entry.id] = group;
    row.className = `world-team-entry${isSelected ? " is-selected" : ""}${isUsed ? " is-used" : ""}`;
    button.type = "button";
    button.className = "world-team-option";
    button.dataset.teamId = entry.id;
    button.disabled = isUsed;
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    button.innerHTML = `
      <span>${escapeHtml(entry.name)}</span>
      <em>${entry.playerCount}人${isUsed ? " / 登録済" : ""}</em>
    `;
    row.append(button);
    if (regionalMode) {
      row.insertAdjacentHTML("beforeend", `<select class="world-team-group-select" data-team-id="${escapeHtml(entry.id)}" ${isUsed ? "disabled" : ""}>
        ${groupTemplate.map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === group ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>`);
    }
    return row;
  }));

  $("#worldDraftCount").textContent = `${state.worldDraftLeagues.length}リーグ`;
  $("#worldSelectedCount").textContent = `${state.worldSelectedTeamIds.size}チーム`;
  $("#createWorld").disabled = !state.worldDraftLeagues.length;
  $("#progressWorldDay").disabled = !state.world || state.world.completed;
  $("#progressWorldUntil").disabled = !state.world || state.world.completed;
  $("#progressWorldAction").disabled = !state.world || state.world.completed;
  $("#progressWorldTop").disabled = !state.world || state.world.completed;
  $("#exportWorld").disabled = !state.world;
  if ($("#runTransferMarket")) $("#runTransferMarket").disabled = !state.world || !state.world.completed;
  if ($("#exportTransferLog")) $("#exportTransferLog").disabled = !state.world?.transferMarket?.transfers?.length;
  if ($("#exportNextSeasonTeams")) $("#exportNextSeasonTeams").disabled = !state.world || !state.world.completed;
  renderWorldDraftList();
}

function renderWorldDraftList() {
  const list = $("#worldDraftList");
  if (!list) return;
  if (!state.worldDraftLeagues.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = state.worldDraftLeagues.map((league) => `
    <div class="world-draft-item">
      <strong>${escapeHtml(league.name)}</strong>
      <span>${escapeHtml(league.country)} / ${league.teamEntryIds.length}チーム / CL枠 ${league.clSlots}</span>
    </div>
  `).join("");
}

function availableWorldTeamEntries() {
  const used = draftedWorldTeamIds();
  return state.library.filter((entry) => !used.has(entry.id));
}

function selectedWorldTeamEntries() {
  return state.library.filter((entry) => state.worldSelectedTeamIds.has(entry.id));
}

function addWorldLeague() {
  const explicitlySelected = selectedWorldTeamEntries();
  const teams = explicitlySelected.length ? explicitlySelected : availableWorldTeamEntries();
  if (teams.length < 2) {
    setStatus("リーグには2チーム以上必要です。登録チームを追加するか、2チーム以上を選んでください。");
    return;
  }

  const country = worldCountryItems().find((item) => item.key === $("#worldCountry").value);
  const name = $("#worldLeagueName").value.trim() || country?.leagueName || "リーグ";
  const format = $("#worldLeagueFormat")?.value || country?.format || countryFormatDefaults[country?.key] || "double-round-robin";
  const groupTemplate = currentWorldGroupTemplate();
  state.worldDraftLeagues.push({
    name,
    country: country?.country || $("#worldCountry").value,
    clSlots: Number($("#worldClSlots").value) || 0,
    countryKey: country?.key || $("#worldCountry").value,
    format,
    groupTemplate: format === "regional-mixed" ? groupTemplate : [],
    teamGroups: format === "regional-mixed"
      ? teams.map((entry, index) => ({
        group: state.worldTeamGroups[entry.id] || defaultWorldGroupForIndex(index),
      }))
      : [],
    teamEntryIds: teams.map((entry) => entry.id),
  });
  for (const entry of teams) state.worldSelectedTeamIds.delete(entry.id);
  updateWorldControls();
  const sourceText = explicitlySelected.length ? "選択チーム" : "未登録チームすべて";
  setStatus(`${name} に${sourceText} ${teams.length}チームを追加しました`);
}

function clearWorldDraft() {
  state.worldDraftLeagues = [];
  state.worldSelectedTeamIds.clear();
  updateWorldControls();
  setStatus("ワールド構成をクリアしました");
}

function toggleWorldTeamSelection(teamId) {
  if (!teamId || draftedWorldTeamIds().has(teamId)) return;
  if (state.worldSelectedTeamIds.has(teamId)) {
    state.worldSelectedTeamIds.delete(teamId);
  } else {
    state.worldSelectedTeamIds.add(teamId);
  }
  updateWorldControls();
}

function worldMatchOptionsPayload() {
  return {
    seed: $("#seed").value.trim() || state.meta.defaults.seed,
    randomize: true,
    enableChangers: $("#enableChangers").checked,
    enableBenchSubstitutions: $("#enableBenchSubstitutions").checked,
    regularSubstitutionsPerBreak: Number($("#regularSubstitutionsPerBreak").value) || 0,
    enableFatigue: $("#enableFatigue").checked,
    adjustLineupByCondition: true,
    includePassEvents: false,
  };
}

function worldDraftNationsLeagueCarryover() {
  for (const league of state.worldDraftLeagues || []) {
    for (const id of league.teamEntryIds || []) {
      const team = state.library.find((entry) => entry.id === id)?.team;
      const carryover = team?.worldCarryover?.nationsLeague || team?.previousSeason?.nationsLeagueCarryover;
      if (carryover?.ruleset === "luminous-sword-nations-league-carryover-v1" && !carryover.cycleCompleted) {
        return carryover;
      }
    }
  }
  return null;
}

async function createWorldFromDraft() {
  try {
    if (!state.worldApiAvailable) throw new Error("ワールド作成APIがありません。サーバーを再起動してください。");
    if (!state.worldDraftLeagues.length) throw new Error("リーグ構成を追加してください。");
    setBusy(true);
    setStatus("ワールドを作成中");
    const payload = {
      seed: `${$("#seed").value.trim() || state.meta.world.defaults.seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      scheduleSeed: $("#worldScheduleSeed")?.value.trim() || `${$("#worldSeasonLabel").value.trim() || state.meta.world.defaults.seasonLabel}-schedule`,
      seasonLabel: $("#worldSeasonLabel").value.trim() || state.meta.world.defaults.seasonLabel,
      startDate: $("#worldStartDate").value || state.meta.world.defaults.startDate,
      endDate: $("#worldEndDate").value || state.meta.world.defaults.endDate,
      nationsLeagueCarryover: worldDraftNationsLeagueCarryover(),
      leagues: state.worldDraftLeagues.map((league) => ({
        name: league.name,
        country: league.country,
        countryKey: league.countryKey,
        clSlots: league.clSlots,
        format: league.format,
        groupTemplate: league.groupTemplate || [],
        teamGroups: league.teamGroups || [],
        teams: league.teamEntryIds.map((id) => state.library.find((entry) => entry.id === id)?.team).filter(Boolean),
      })),
    };
    state.world = await postJson("/api/world/create", payload);
    state.lastWorldSummary = null;
    state.lastNextSeasonPack = null;
    state.worldSummaryLeagueId = "all";
    state.worldRosterTeamId = null;
    $("#worldProgressUntilDate").value = state.world.currentDate;
    saveWorldState();
    renderWorld();
    activateTab("world");
    setStatus(`${state.world.season.label} ワールドを作成しました`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function progressWorldDay() {
  try {
    if (!state.worldApiAvailable) throw new Error("ワールド進行APIがありません。サーバーを再起動してください。");
    if (!state.world) throw new Error("ワールドを作成または読み込んでください。");
    setBusy(true);
    setStatus(`${state.world.currentDate} を進行中`);
    const result = await postJson("/api/world/progress-day", {
      world: worldPayload(),
      options: worldMatchOptionsPayload(),
    });
    state.world = result.world;
    state.lastWorldSummary = result.summary;
    $("#worldProgressUntilDate").value = state.world.currentDate;
    saveWorldState();
    renderWorld();
    activateTab("world");
    const matchText = result.summary.matches.length ? `${result.summary.matches.length}試合` : "試合なし";
    setStatus(`${result.summary.date}: ${matchText}を処理しました`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function progressWorldUntil() {
  try {
    if (!state.worldApiAvailable) throw new Error("ワールド進行APIがありません。サーバーを再起動してください。");
    if (!state.world) throw new Error("ワールドを作成または読み込んでください。");
    const targetDate = $("#worldProgressUntilDate").value;
    if (!targetDate) throw new Error("進行先の日付を指定してください。");
    setBusy(true);
    setStatus(`${targetDate} まで進行中`);
    const result = await postJson("/api/world/progress-until", {
      world: worldPayload(),
      targetDate,
      options: worldMatchOptionsPayload(),
    });
    state.world = result.world;
    state.lastWorldSummary = {
      date: targetDate,
      matches: result.summary.matches.slice(-24),
      injuries: result.summary.injuries.slice(-24),
      recoveries: result.summary.recoveries.slice(-24),
      completed: result.summary.completed,
      rangeSummary: result.summary,
    };
    $("#worldProgressUntilDate").value = state.world.currentDate;
    saveWorldState();
    renderWorld();
    activateTab("world");
    const matchText = result.summary.matches.length ? `${result.summary.matches.length}試合` : "試合なし";
    const eventDays = result.summary.days.length ? `${result.summary.days.length}日分の出来事` : "出来事なし";
    setStatus(`${result.summary.from} から ${result.summary.finalDate} まで進行: ${matchText} / ${eventDays}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

function exportWorld() {
  if (!state.world) {
    setStatus("出力するワールドがありません。");
    return;
  }
  downloadJson(`touken-world-${state.world.season?.label || "season"}.json`, state.world);
}

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hashText(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed) {
  let value = (hashText(seed) + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function nextSeasonLabel(label) {
  const text = String(label || "").trim();
  const match = text.match(/^(\d{1,4})\s*\/\s*(\d{1,4})$/);
  if (match) {
    const first = Number(match[1]) + 1;
    const second = Number(match[2]) + 1;
    return `${String(first).padStart(match[1].length, "0")}/${String(second).padStart(match[2].length, "0")}`;
  }
  const year = text.match(/\d{4}/)?.[0];
  if (year) return text.replace(year, String(Number(year) + 1));
  return "next-season";
}

function safeFilePart(value) {
  return String(value || "team")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function teamMatchCount(world, teamId) {
  return (world.calendar || []).reduce((count, day) =>
    count + (day.fixtures || []).filter((fixture) =>
      fixture.status === "played" && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId)).length, 0);
}

function developmentEnvironmentBonus(player, minutesRate, worldTeam) {
  const age = numberOr(player.age, 24);
  const rating = numberOr(player.rating, 60);
  if (age > 23 || rating >= 86 || minutesRate < 0.12) return 0;

  const environmentLevel = numberOr(worldTeam?.teamLevel, worldTeamStrength(worldTeam || {}));
  const gap = environmentLevel - rating;
  if (gap < 4) return 0;

  const ageFactor = age <= 19 ? 1.05 : age <= 21 ? 1 : 0.72;
  const playFactor = clampNumber((minutesRate - 0.12) / 0.58, 0.15, 1.15);
  const gapFactor = clampNumber((gap - 3) / 12, 0, 1.25);
  return roundNumber(clampNumber(gapFactor * playFactor * ageFactor * 0.95, 0, age <= 21 ? 1.05 : 0.72), 2);
}

function playerDevelopmentDelta(player, playerState, teamMatches, worldTeam = null) {
  const age = numberOr(player.age, 24);
  const season = playerState?.season || {};
  const minutes = numberOr(season.minutes, 0);
  const fullSeasonMinutes = Math.max(1, teamMatches * 90);
  const minutesRate = clampNumber(minutes / fullSeasonMinutes, 0, 1.2);
  const goals = numberOr(season.goals, 0);
  const assists = numberOr(season.assists, 0);
  const defensive = numberOr(season.steals, 0) + numberOr(season.interceptions, 0) + numberOr(season.blocks, 0);
  const passScore = numberOr(season.completedPasses, 0) / Math.max(1, numberOr(season.passes, 0));
  const outputPer90 = ((goals * 0.42 + assists * 0.34 + defensive * 0.035) / Math.max(1, minutes / 90));
  const performance = clampNumber((outputPer90 - 0.32) * 0.42 + (passScore - 0.72) * 0.28, -0.65, 0.8);
  const form = clampNumber(numberOr(playerState?.formTrend, 0) * 0.035 + numberOr(playerState?.conditionDelta, 0) * 0.018, -0.35, 0.35);
  const injuryPenalty = playerState?.injury?.totalDays ? clampNumber(numberOr(playerState.injury.totalDays, 0) / 180, 0, 0.75) : 0;
  const rating = numberOr(player.rating, 60);
  const eliteGrowthBrake = rating >= 92 ? (age <= 29 ? -0.12 : -0.28)
    : rating >= 88 ? (age <= 29 ? -0.06 : -0.16)
    : 0;
  const youngHighRatingFloor = age <= 25 && rating >= 88 ? -0.18 : null;
  const ageCurve = age <= 19 ? 0.85
    : age <= 22 ? 0.62
    : age <= 25 ? 0.32
    : age <= 28 ? 0.1
    : age <= 30 ? -0.15
    : age <= 33 ? -0.45
    : age <= 35 ? -0.78
    : -1.18;
  const usage = age <= 24 ? (minutesRate - 0.35) * 0.38 : (minutesRate - 0.45) * 0.16;
  const environmentBonus = developmentEnvironmentBonus(player, minutesRate, worldTeam);
  const random = (Math.random() - 0.5) * 0.34;
  const cap = age <= 21 ? 3.05 : age <= 24 ? 2.35 : age >= 34 ? 0.75 : age >= 31 ? 1.05 : 1.55;
  const floor = age >= 36 ? -2.85 : age >= 34 ? -2.55 : age >= 31 ? -2.05 : -1.35;
  const adjustedFloor = youngHighRatingFloor === null ? floor : Math.max(floor, youngHighRatingFloor);
  return roundNumber(clampNumber(ageCurve + usage + performance + form + environmentBonus - injuryPenalty + eliteGrowthBrake + random, adjustedFloor, cap), 2);
}

function statDevelopmentCategory(statName) {
  const text = String(statName || "").toLowerCase();
  if (/speed|acceleration|stamina|agility|balance|jump/.test(text)) return "physical";
  if (/technique|shot|shoot|pass|carry|cross|touch|slash|blade/.test(text)) return "technical";
  if (/marking|positioning|interception|block|steal/.test(text)) return "defense";
  if (/vision|focus|decision|composure|teamwork|leadership|flair|desire|work/.test(text)) return "mental";
  const index = state.generatorPositionData?.statNames?.indexOf(statName) ?? -1;
  if ([0, 1, 2, 3, 4, 5, 23, 28].includes(index)) return "physical";
  if ([6, 7, 8, 9, 10, 11, 12, 13, 14, 16].includes(index)) return "technical";
  if ([15, 17].includes(index)) return "defense";
  if ([18, 19, 20, 21, 22, 24, 25, 26, 27, 29].includes(index)) return "mental";
  return "general";
}

function playerDevelopmentFocus(player, playerState) {
  const best = String(player.bestPosition || "");
  const season = playerState?.season || {};
  const goals = numberOr(season.goals, 0);
  const assists = numberOr(season.assists, 0);
  const defensive = numberOr(season.steals, 0) + numberOr(season.interceptions, 0) + numberOr(season.blocks, 0);
  if (["5", "6", "7", "15", "16", "17"].includes(best) || goals + assists >= defensive * 0.08 + 4) {
    return { physical: 0.55, technical: 1.0, defense: 0.25, mental: 0.58, general: 0.42 };
  }
  if (["1", "2", "3", "11", "12", "13", "14"].includes(best) || defensive >= goals * 12 + assists * 8 + 25) {
    return { physical: 0.5, technical: 0.46, defense: 1.0, mental: 0.72, general: 0.42 };
  }
  if (["4", "10"].includes(best) || assists >= goals + 3) {
    return { physical: 0.36, technical: 0.86, defense: 0.48, mental: 1.0, general: 0.42 };
  }
  return { physical: 0.55, technical: 0.72, defense: 0.58, mental: 0.68, general: 0.42 };
}

function ageStatBias(age, category, delta) {
  if (delta >= 0) {
    if (age <= 21 && category === "physical") return 1.12;
    if (age >= 27 && category === "mental") return 1.08;
    if (age >= 32 && category === "technical") return 0.82;
    if (age >= 29 && category === "physical") return 0.38;
    return 1;
  }
  if (age >= 34 && category === "technical") return 1.12;
  if (age >= 31 && category === "physical") return 1.65;
  if (age >= 31 && category === "mental") return 0.42;
  if (age <= 23 && category === "mental") return 0.72;
  return 1;
}

function evolveStatsForDevelopment(player, playerState, delta) {
  const map = player.stats || {};
  const values = Object.values(map || {}).map((value) => numberOr(value, 0));
  const max = Math.max(30, ...values) > 30 ? 100 : 30;
  return Object.fromEntries(Object.entries(map || {}).map(([key, value]) => [
    key,
    Math.round(clampNumber(
      numberOr(value, 0) +
        delta *
          0.42 *
          (playerDevelopmentFocus(player, playerState)[statDevelopmentCategory(key)] ?? 0.42) *
          ageStatBias(numberOr(player.age, 24), statDevelopmentCategory(key), delta) +
        (Math.random() - 0.5) * 0.26,
      1,
      max,
    )),
  ]));
}

function fifaOverallRatingForDevelopment(rawRating) {
  const value = Number(rawRating) || 0;
  if (value <= developmentRatingScale.eliteCurveStart) return value;
  const over = value - developmentRatingScale.eliteCurveStart;
  return clampNumber(
    developmentRatingScale.eliteCurveStart +
      (1 - Math.exp(-over / developmentRatingScale.eliteCurveWidth)) * developmentRatingScale.eliteCurveGain,
    1,
    developmentRatingScale.hardMax,
  );
}

function sameSidePenaltyCodeForDevelopment(hand, code) {
  if (hand === "両" || hand === "荳｡") return false;
  return developmentSidePositionPairs.some((pair) => (hand === "右" || hand === "蜿ｳ" ? pair.right === code : pair.left === code));
}

function sidePenaltyRateForDevelopment(player) {
  if ((player.hand || "右") === "両" || (player.hand || "蜿ｳ") === "荳｡") return 0;
  return clampNumber(numberOr(player.sidePenaltyRate, 12) / 100, 0, 0.3);
}

function familiarityLabelForDevelopment(percent) {
  const value = Number(percent) || 0;
  if (value >= 90) return "熟練";
  if (value >= 78) return "適応";
  if (value >= 62) return "能力あり";
  if (value >= 46) return "不安あり";
  if (value >= 32) return "不慣れ";
  if (value >= 20) return "急造";
  return "能力不足";
}

function multiplierForDevelopment(player, code, fitScore) {
  const direct = Number(player.positionMultipliers?.[code]);
  if (Number.isFinite(direct)) return clampNumber(direct, 0, 100);
  const rating = Number(player.positionRatings?.[code]);
  if (Number.isFinite(rating) && fitScore > 0) return clampNumber((rating / fitScore) * 100, 0, 100);
  return String(code) === String(player.bestPosition) ? 100 : 14;
}

function recomputePositionRatingsForDevelopment(player, stats) {
  const data = state.generatorPositionData;
  if (!data?.statNames?.length || !data?.positionCodes?.length || !data?.positionWeights) return null;
  const presentCount = data.statNames.filter((name) => Number.isFinite(Number(stats?.[name]))).length;
  if (presentCount < Math.max(5, Math.floor(data.statNames.length * 0.45))) return null;

  const statValues = data.statNames.map((name) => clampNumber(numberOr(stats?.[name], 1), 1, 30));
  const hand = player.hand || "右";
  const sidePenaltyRate = sidePenaltyRateForDevelopment(player);
  const scores = data.positionCodes.map((code) => {
    const weights = data.positionWeights[code] || [];
    const weightedTotal = statValues.reduce((sum, value, index) => sum + value * numberOr(weights[index], 0), 0);
    const weightTotal = weights.reduce((sum, value) => sum + numberOr(value, 0), 0) || 1;
    const rawBaseRating = (weightedTotal / weightTotal / 30) * 100;
    const baseRating = fifaOverallRatingForDevelopment(rawBaseRating);
    const penalty = sameSidePenaltyCodeForDevelopment(hand, code) ? sidePenaltyRate : 0;
    const fitScore = baseRating * (1 - penalty);
    const multiplier = multiplierForDevelopment(player, code, fitScore);
    return {
      code: String(code),
      baseRating,
      fitScore,
      multiplier,
      rating: fitScore * (multiplier / 100),
    };
  });

  const sorted = [...scores].sort((a, b) => b.rating - a.rating);
  const best = sorted[0];
  const labels = {};
  const positionRatings = {};
  const positionMultipliers = {};
  const positionBaseRatings = {};
  const positionFitScores = {};
  for (const score of scores) {
    positionRatings[score.code] = Number(score.rating.toFixed(2));
    positionMultipliers[score.code] = Number(score.multiplier.toFixed(1));
    positionBaseRatings[score.code] = Number(score.baseRating.toFixed(2));
    positionFitScores[score.code] = Number(score.fitScore.toFixed(2));
    labels[score.code] = familiarityLabelForDevelopment(score.multiplier);
  }
  if (best) labels[best.code] = "主";

  return {
    bestPosition: best?.code || player.bestPosition,
    rating: Number((best?.rating || player.rating || 0).toFixed(2)),
    positionRatings,
    positionLabels: labels,
    positionMultipliers,
    positionBaseRatings,
    positionFitScores,
  };
}

function ratingChangeLimitForDevelopment(player, delta) {
  const age = numberOr(player.age, 24);
  const rating = numberOr(player.rating, 60);
  if (delta >= 0) {
    const base = age <= 20 ? 3 : age <= 23 ? 2.4 : 1.8;
    if (rating >= 92) return Math.min(base, age <= 23 ? 1.2 : 0.8);
    if (rating >= 88) return Math.min(base, age <= 23 ? 1.6 : 1.1);
    return base;
  }
  if (age <= 25 && rating >= 88) return 0.35;
  if (age <= 29 && rating >= 92) return 0.6;
  if (age >= 34) return 2.6;
  if (age >= 31) return 2.2;
  return 1.6;
}

function blendStatsForDevelopment(baseStats, evolvedStats, ratio) {
  return Object.fromEntries(Object.entries(evolvedStats || {}).map(([key, value]) => [
    key,
    Math.round(numberOr(baseStats?.[key], value) + (numberOr(value, 0) - numberOr(baseStats?.[key], value)) * ratio),
  ]));
}

function limitStatsByRatingChange(player, evolvedStats, delta) {
  let recomputed = recomputePositionRatingsForDevelopment(player, evolvedStats);
  if (!recomputed) return { stats: player.stats || {}, recomputed: null };
  const before = numberOr(player.rating, recomputed.rating);
  const change = recomputed.rating - before;
  const limit = ratingChangeLimitForDevelopment(player, delta);
  if (Math.abs(change) <= limit) return { stats: evolvedStats, recomputed };

  const ratio = clampNumber(limit / Math.max(0.01, Math.abs(change)), 0, 1);
  const limitedStats = blendStatsForDevelopment(player.stats || {}, evolvedStats, ratio);
  recomputed = recomputePositionRatingsForDevelopment(player, limitedStats);
  return { stats: limitedStats, recomputed };
}

function retirementScore(player, playerState, teamMatches) {
  const age = numberOr(player.age, 24);
  const rating = numberOr(player.rating, 60);
  const minutes = numberOr(playerState?.season?.minutes, 0);
  const minutesRate = minutes / Math.max(1, teamMatches * 90);
  const injuryDays = numberOr(playerState?.injury?.totalDays, 0);
  let score = 0;
  if (age < 32) return 0;
  if (age >= 35) score += (age - 34) * 0.11;
  if (age >= 38) score += 0.28;
  if (rating < 62 && age >= 34) score += 0.16;
  if (minutesRate < 0.12 && age >= 35) score += 0.12;
  if (injuryDays >= 90 && age >= 33) score += 0.18;
  if (injuryDays >= 180 && age >= 32) score += 0.2;
  return clampNumber(score, 0, age >= 38 ? 0.82 : 0.55);
}

function evolvePlayer(player, playerState, worldTeam, world, nextLabel, teamMatches, environmentTeam = worldTeam) {
  const ageFrom = numberOr(player.age, 24);
  const ageTo = ageFrom + 1;
  const season = playerState?.season || {};
  const minutesRate = clampNumber(numberOr(season.minutes, 0) / Math.max(1, teamMatches * 90), 0, 1.2);
  const environmentLevel = numberOr(environmentTeam?.teamLevel, worldTeamStrength(environmentTeam || worldTeam));
  const environmentBonus = developmentEnvironmentBonus(player, minutesRate, environmentTeam);
  const delta = playerDevelopmentDelta(player, playerState, teamMatches, environmentTeam);
  const evolvedStats = evolveStatsForDevelopment(player, playerState, delta);
  const limited = limitStatsByRatingChange(player, evolvedStats, delta);
  const recomputed = limited.recomputed;
  const stats = limited.stats;
  const fallbackPositionRatings = player.positionRatings || {};
  const fallbackRating = numberOr(player.rating, Math.max(1, ...Object.values(fallbackPositionRatings)));
  const rating = recomputed?.rating ?? fallbackRating;

  return {
    ...player,
    age: ageTo,
    rating,
    bestPosition: recomputed?.bestPosition ?? player.bestPosition,
    positionRatings: recomputed?.positionRatings ?? fallbackPositionRatings,
    positionLabels: recomputed?.positionLabels ?? player.positionLabels,
    positionMultipliers: recomputed?.positionMultipliers ?? player.positionMultipliers,
    positionBaseRatings: recomputed?.positionBaseRatings ?? player.positionBaseRatings,
    positionFitScores: recomputed?.positionFitScores ?? player.positionFitScores,
    stats,
    season: nextLabel,
    conditionDelta: 0,
    fatigue: 0,
    development: {
      sourceSeason: world.season?.label,
      ageFrom,
      ageTo,
      ratingFrom: numberOr(player.rating, rating),
      ratingTo: rating,
      delta,
      environmentLevel,
      environmentGap: roundNumber(environmentLevel - numberOr(player.rating, rating), 2),
      environmentBonus,
      positionRatingsRecomputed: Boolean(recomputed),
    },
    seasonHistory: [
      ...(Array.isArray(player.seasonHistory) ? player.seasonHistory.slice(-4) : []),
      {
        season: world.season?.label,
        team: playerState?.seasonTeamName || worldTeam.name,
        matches: numberOr(playerState?.season?.matches, 0),
        minutes: roundNumber(numberOr(playerState?.season?.minutes, 0), 1),
        goals: numberOr(playerState?.season?.goals, 0),
        assists: numberOr(playerState?.season?.assists, 0),
        ratingAfter: rating,
      },
    ],
  };
}

async function yieldToBrowser() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function rookieStatNoise(seed, span = 1) {
  let total = 0;
  for (let index = 0; index < 5; index += 1) {
    total += seededUnit(`${seed}:noise:${index}`);
  }
  return ((total / 5) - 0.5) * span * 2;
}

function rookiePrimaryPosition(worldTeam, currentPlayers, rookieIndex) {
  const requirements = teamTransferRequirements(worldTeam);
  const counts = Object.fromEntries(transferPositionGroups.map((group) => [group.key, 0]));
  for (const player of currentPlayers || []) {
    const group = transferGroupForPosition(player.bestPosition);
    counts[group.key] = (counts[group.key] || 0) + 1;
  }

  const targetGroup = Object.values(requirements)
    .map((requirement) => ({
      group: requirement,
      shortage: Math.max(0, numberOr(requirement.min, 0) - numberOr(counts[requirement.key], 0)),
    }))
    .sort((a, b) => b.shortage - a.shortage || numberOr(b.group.starterSlots, 0) - numberOr(a.group.starterSlots, 0))[0]?.group
    || transferPositionGroups[rookieIndex % transferPositionGroups.length];

  const codes = targetGroup.codes?.length ? targetGroup.codes : state.generatorPositionData.positionCodes;
  const seed = `${worldTeam.id}:${worldTeam.name}:rookie-position:${rookieIndex}`;
  return String(codes[Math.floor(seededUnit(seed) * codes.length) % codes.length]);
}

function rookiePositionMultipliers(primaryCode) {
  const multipliers = {};
  const primaryGroup = transferGroupForPosition(primaryCode);
  for (const code of state.generatorPositionData.positionCodes || []) {
    const group = transferGroupForPosition(code);
    multipliers[String(code)] = group.key === primaryGroup.key ? 55 : 14;
  }
  multipliers[String(primaryCode)] = 100;
  return multipliers;
}

function generateRookieStats(primaryCode, targetRating, seed) {
  const data = state.generatorPositionData;
  const weights = data.positionWeights?.[primaryCode] || [];
  const maxWeight = Math.max(1, ...weights.map((value) => numberOr(value, 0)));
  const targetStat = clampNumber((targetRating / 100) * 30, 11, 23);
  const stats = {};

  for (const [index, statName] of data.statNames.entries()) {
    const importance = clampNumber(numberOr(weights[index], 0) / maxWeight, 0, 1);
    const raw = targetStat - 1.2 + importance * 3.1 + rookieStatNoise(`${seed}:${statName}`, 2.4);
    stats[statName] = clampNumber(Math.round(raw), 1, 30);
  }

  return stats;
}

function generateRookiePlayer(worldTeam, currentPlayers, world, nextLabel, teamIndex, rookieIndex) {
  const primaryCode = rookiePrimaryPosition(worldTeam, currentPlayers, rookieIndex);
  const seed = `${world.id}:${world.season?.label}:${worldTeam.id}:rookie:${teamIndex}:${rookieIndex}`;
  const age = 16 + Math.floor(seededUnit(`${seed}:age`) * 5);
  const averageRating = teamAverageRating(currentPlayers || []);
  const targetRating = clampNumber(averageRating - 13 + seededUnit(`${seed}:rating`) * 8, 43, 68);
  const stats = generateRookieStats(primaryCode, targetRating, seed);
  const playerNumber = (currentPlayers?.length || 0) + rookieIndex + 1;
  const teamNameText = worldTeam.team?.name || worldTeam.name || "Team";
  const player = {
    id: `${worldTeam.id || safeFilePart(teamNameText)}__rookie__${safeFilePart(nextLabel)}__${rookieIndex + 1}`,
    fullName: `${teamNameText} 新人${String(playerNumber).padStart(2, "0")}`,
    name: `${teamNameText} 新人${String(playerNumber).padStart(2, "0")}`,
    age,
    nationality: worldTeam.country || worldTeam.team?.country || worldTeam.leagueName || "",
    season: nextLabel,
    bestPosition: primaryCode,
    hand: seededUnit(`${seed}:hand`) > 0.82 ? "両" : seededUnit(`${seed}:hand2`) > 0.5 ? "右" : "左",
    sidePenaltyRate: 12,
    positionMultipliers: rookiePositionMultipliers(primaryCode),
    stats,
    rookie: {
      source: "generator-position-data",
      sourceSeason: world.season?.label,
      debutSeason: nextLabel,
      joinedTeam: teamNameText,
    },
  };
  const recomputed = recomputePositionRatingsForDevelopment(player, stats);
  const fallbackRating = numberOr(recomputed?.rating, targetRating);
  return {
    ...player,
    rating: fallbackRating,
    bestPosition: recomputed?.bestPosition ?? primaryCode,
    positionRatings: recomputed?.positionRatings || {},
    positionLabels: recomputed?.positionLabels || {},
    positionMultipliers: recomputed?.positionMultipliers || player.positionMultipliers,
    positionBaseRatings: recomputed?.positionBaseRatings || {},
    positionFitScores: recomputed?.positionFitScores || {},
    development: {
      sourceSeason: world.season?.label,
      ageFrom: null,
      ageTo: age,
      ratingFrom: null,
      ratingTo: fallbackRating,
      delta: 0,
      positionRatingsRecomputed: Boolean(recomputed),
      rookieDebut: true,
    },
    seasonHistory: [],
  };
}

function generateRookiesForTeam(worldTeam, evolvedPlayers, world, nextLabel, teamIndex) {
  if (!state.generatorPositionData?.statNames?.length) return [];
  const targetSize = 20;
  const needed = Math.max(0, targetSize - evolvedPlayers.length);
  const rookies = [];
  for (let index = 0; index < needed; index += 1) {
    const rookie = generateRookiePlayer(worldTeam, [...evolvedPlayers, ...rookies], world, nextLabel, teamIndex, index);
    rookies.push(rookie);
  }
  return rookies;
}

function collectLoanReturns(world) {
  const regularTeams = (world.teams || []).filter((team) => !team.competitionOnly);
  const teamIds = new Set(regularTeams.map((team) => team.id));
  const returnsByParent = new Map();
  const outgoingByCurrent = new Map();

  for (const currentTeam of regularTeams) {
    const states = world.playerStates?.[currentTeam.id] || {};
    for (const player of currentTeam.team?.players || []) {
      const loan = player.loan || {};
      if (!loan.endsAfterSeason || !loan.parentTeamId || loan.parentTeamId === currentTeam.id || !teamIds.has(loan.parentTeamId)) continue;
      if (!returnsByParent.has(loan.parentTeamId)) returnsByParent.set(loan.parentTeamId, []);
      returnsByParent.get(loan.parentTeamId).push({
        player,
        state: states[player.id] || {},
        currentTeam,
      });
      if (!outgoingByCurrent.has(currentTeam.id)) outgoingByCurrent.set(currentTeam.id, new Set());
      outgoingByCurrent.get(currentTeam.id).add(player.id);
    }
  }

  return { returnsByParent, outgoingByCurrent };
}

function returnedLoanPlayer(player, parentTeam, loanTeam, nextPlayer, world) {
  return {
    ...nextPlayer,
    loan: undefined,
    transferHistory: [
      ...(Array.isArray(nextPlayer.transferHistory) ? nextPlayer.transferHistory.slice(-4) : []),
      {
        season: world.season?.label,
        fromTeam: loanTeam.name,
        toTeam: parentTeam.name,
        value: 0,
        status: "loan-return",
      },
    ],
    seasonTransition: {
      ...(nextPlayer.seasonTransition || {}),
      loanReturned: true,
      loanTeamId: loanTeam.id,
      loanTeam: loanTeam.name,
      parentTeamId: parentTeam.id,
      parentTeam: parentTeam.name,
    },
  };
}

function nationsLeagueCarryoverForNextSeason(world, nextLabel) {
  const nl = world.futureCompetitions?.nationsLeague;
  if (!nl?.teamIds?.length) return null;
  const nextRoundIndex = Number(nl.nextRoundIndex ?? (Number(nl.startRoundIndex || 0) + (nl.rounds || []).length));
  return {
    ruleset: "luminous-sword-nations-league-carryover-v1",
    sourceWorldId: world.id,
    sourceSeason: world.season?.label,
    nextSeason: nextLabel,
    cycle: nl.cycle || "29/30-30/31",
    division: nl.division || 1,
    cycleSeasonIndex: Math.min(2, Number(nl.cycleSeasonIndex || 1) + 1),
    nextRoundIndex,
    totalCycleRounds: Number(nl.totalCycleRounds || 30),
    cycleCompleted: Boolean(nl.cycleCompleted),
    promotionRelegation: nl.promotionRelegation || null,
    standings: (nl.standings || []).map((standing) => ({
      teamId: standing.teamId,
      name: standing.name,
      rank: standing.rank,
      played: Number(standing.played || 0),
      wins: Number(standing.wins || 0),
      draws: Number(standing.draws || 0),
      losses: Number(standing.losses || 0),
      goalsFor: Number(standing.goalsFor || 0),
      goalsAgainst: Number(standing.goalsAgainst || 0),
      goalDifference: Number(standing.goalDifference || 0),
      points: Number(standing.points || 0),
      xgFor: Number(standing.xgFor || 0),
      xgAgainst: Number(standing.xgAgainst || 0),
      form: Array.isArray(standing.form) ? standing.form.slice(-8) : [],
    })),
  };
}

async function buildNextSeasonTeamPack(world) {
  const nextLabel = nextSeasonLabel(world.season?.label);
  const nationsLeagueCarryover = nationsLeagueCarryoverForNextSeason(world, nextLabel);
  const loanReturns = collectLoanReturns(world);
  const pack = {
    ruleset: "luminous-sword-next-season-team-pack-v1",
    sourceWorldId: world.id,
    sourceSeason: world.season?.label,
    nextSeason: nextLabel,
    generatedAt: new Date().toISOString(),
    summary: { teams: 0, players: 0, retiredPlayers: 0, rookiePlayers: 0, loanReturnedPlayers: 0, recomputedPlayers: 0, unchangedPlayers: 0 },
    worldCarryover: { nationsLeague: nationsLeagueCarryover },
    teams: [],
  };

  for (const [teamIndex, worldTeam] of (world.teams || []).filter((team) => !team.competitionOnly).entries()) {
    const states = world.playerStates?.[worldTeam.id] || {};
    const matches = teamMatchCount(world, worldTeam.id);
    const outgoingLoanIds = loanReturns.outgoingByCurrent.get(worldTeam.id) || new Set();
    const evolved = [];
    const retired = [];

    for (const player of worldTeam.team.players || []) {
      if (outgoingLoanIds.has(player.id)) continue;
      const playerState = states[player.id] || {};
      const nextPlayer = evolvePlayer(player, playerState, worldTeam, world, nextLabel, matches);
      const retireChance = retirementScore(player, playerState, matches);
      if (Math.random() < retireChance) {
        retired.push({
          id: player.id,
          fullName: player.fullName || player.name,
          age: numberOr(player.age, 24) + 1,
          rating: numberOr(player.rating, 0),
          reason: "age-injury-decline",
        });
      } else {
        evolved.push(nextPlayer);
      }
    }

    const returnedLoans = [];
    for (const entry of loanReturns.returnsByParent.get(worldTeam.id) || []) {
      const sourceMatches = teamMatchCount(world, entry.currentTeam.id);
      const nextPlayer = evolvePlayer(entry.player, entry.state, worldTeam, world, nextLabel, sourceMatches, entry.currentTeam);
      const retireChance = retirementScore(entry.player, entry.state, sourceMatches);
      if (Math.random() < retireChance) {
        retired.push({
          id: entry.player.id,
          fullName: entry.player.fullName || entry.player.name,
          age: numberOr(entry.player.age, 24) + 1,
          rating: numberOr(entry.player.rating, 0),
          reason: "loan-return-retirement",
        });
      } else {
        const returned = returnedLoanPlayer(entry.player, worldTeam, entry.currentTeam, nextPlayer, world);
        evolved.push(returned);
        returnedLoans.push(returned);
      }
    }

    while (evolved.length < 7 && retired.length) {
      const rescue = retired
        .map((player, index) => ({ player, index }))
        .sort((a, b) => numberOr(b.player.rating, 0) - numberOr(a.player.rating, 0))[0];
      retired.splice(rescue.index, 1);
      const original = worldTeam.team.players.find((player) => player.id === rescue.player.id);
      evolved.push(evolvePlayer(original, states[original.id] || {}, worldTeam, world, nextLabel, matches));
    }

    const rookies = generateRookiesForTeam(worldTeam, evolved, world, nextLabel, teamIndex);
    evolved.push(...rookies);

    const teamNameText = worldTeam.team.name || worldTeam.name;
    const league = (world.leagues || []).find((item) => item.id === worldTeam.leagueId);
    const standing = league?.standings?.find((item) => item.teamId === worldTeam.id);
    const nextSeasonClEntrants = world.futureCompetitions?.championsLeague?.nextSeasonEntrants || world.futureCompetitions?.championsLeague?.entrants || [];
    const championsLeagueQualified = nextSeasonClEntrants.some((entry) => entry.teamId === worldTeam.id);
    const team = {
      ...worldTeam.team,
      name: teamNameText,
      season: nextLabel,
      libraryName: `${teamNameText} (${nextLabel})`,
      libraryId: `${teamNameText}__${nextLabel}`,
      sourceSeason: world.season?.label,
      worldCarryover: { nationsLeague: nationsLeagueCarryover },
      previousSeason: {
        worldId: world.id,
        season: world.season?.label,
        leagueId: worldTeam.leagueId,
        leagueName: league?.name || "",
        leagueRank: standing?.rank || null,
        points: standing?.points || 0,
        championsLeagueQualified,
        nationsLeagueCarryover,
      },
      players: evolved,
      retiredPlayers: retired,
      seasonTransition: {
        sourceWorldId: world.id,
        sourceSeason: world.season?.label,
        nextSeason: nextLabel,
        teamMatches: matches,
        retiredPlayers: retired.length,
        rookiePlayers: rookies.length,
        loanReturnedPlayers: returnedLoans.length,
      },
    };

    pack.teams.push({
      fileName: `${safeFilePart(teamNameText)}_${safeFilePart(nextLabel)}.json`,
      name: teamNameText,
      team,
      summary: {
        players: evolved.length,
        retiredPlayers: retired.length,
        rookiePlayers: rookies.length,
        loanReturnedPlayers: returnedLoans.length,
        averageRating: roundNumber(evolved.reduce((sum, player) => sum + numberOr(player.rating, 0), 0) / Math.max(1, evolved.length), 2),
      },
    });
    pack.summary.players += evolved.length;
    pack.summary.retiredPlayers += retired.length;
    pack.summary.rookiePlayers += rookies.length;
    pack.summary.loanReturnedPlayers += returnedLoans.length;
    pack.summary.recomputedPlayers += evolved.filter((player) => !player.rookie && player.development?.positionRatingsRecomputed).length;
    pack.summary.unchangedPlayers += evolved.filter((player) => !player.rookie && !player.development?.positionRatingsRecomputed).length;

    if (teamIndex % 4 === 3) {
      setStatus(`翌季チーム生成中... ${teamIndex + 1}/${world.teams.length}`);
      await yieldToBrowser();
    }
  }

  pack.summary.teams = pack.teams.length;
  pack.developmentHighlights = buildDevelopmentHighlights(pack);
  pack.transferSummary = world.transferMarket?.transfers?.length ? {
    transfers: world.transferMarket.transfers.length,
    totalValue: roundNumber(world.transferMarket.transfers.reduce((sum, row) => sum + numberOr(row.value, 0), 0), 2),
  } : null;
  return pack;
}

function buildDevelopmentHighlights(pack) {
  const changed = [];
  const retired = [];
  const rookies = [];
  for (const entry of pack.teams || []) {
    for (const player of entry.team?.players || []) {
      if (player.rookie) {
        rookies.push({
          team: entry.name,
          player: player.fullName || player.name,
          age: player.age,
          rating: numberOr(player.rating, 0),
          position: player.bestPosition,
        });
        continue;
      }
      const development = player.development || {};
      changed.push({
        team: entry.name,
        player: player.fullName || player.name,
        ageFrom: development.ageFrom,
        ageTo: development.ageTo,
        ratingFrom: numberOr(development.ratingFrom, player.rating),
        ratingTo: numberOr(development.ratingTo, player.rating),
        delta: numberOr(development.ratingTo, player.rating) - numberOr(development.ratingFrom, player.rating),
        developmentDelta: numberOr(development.delta, 0),
        position: player.bestPosition,
      });
    }
    for (const player of entry.team?.retiredPlayers || []) {
      retired.push({
        team: entry.name,
        player: player.fullName || player.name,
        age: player.age,
        rating: player.rating,
      });
    }
  }

  return {
    growth: changed
      .filter((row) => row.delta > 0)
      .sort((a, b) => b.delta - a.delta || b.developmentDelta - a.developmentDelta)
      .slice(0, 8),
    decline: changed
      .filter((row) => row.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.developmentDelta - b.developmentDelta)
      .slice(0, 8),
    retired: retired
      .sort((a, b) => numberOr(b.rating, 0) - numberOr(a.rating, 0))
      .slice(0, 8),
    rookies: rookies
      .sort((a, b) => numberOr(b.rating, 0) - numberOr(a.rating, 0))
      .slice(0, 8),
  };
}

async function exportNextSeasonTeams() {
  try {
    if (!state.world) throw new Error("ワールドがありません。");
    if (!state.world.completed) throw new Error("翌季チーム出力はシーズン終了後に実行してください。");
    setBusy(true);
    setStatus("選手生成データを確認中...");
    await loadGeneratorPositionData();
    setStatus("翌季チームを生成中...");
    const pack = await buildNextSeasonTeamPack(state.world);
    state.lastNextSeasonPack = pack;
    downloadJson(`touken-next-season-teams-${safeFilePart(pack.nextSeason)}.json`, pack);
    if (state.world.transferMarket?.transfers?.length) {
      downloadJson(`touken-transfer-log-${safeFilePart(state.world.season?.label || "season")}.json`, transferLogPayload(state.world));
    }
    renderWorld();
    setStatus(`翌季チームパックを出力しました: ${pack.summary.teams}チーム / 適性再計算${pack.summary.recomputedPlayers}人 / 引退${pack.summary.retiredPlayers}人 / 新人${pack.summary.rookiePlayers}人`);
  } catch (error) {
    setStatus(error.message || "翌季チーム出力に失敗しました。");
  } finally {
    setBusy(false);
  }
}

async function importWorldFile(file) {
  try {
    if (!file) return;
    const raw = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    if (raw?.ruleset !== "luminous-sword-world-v1") throw new Error("ワールド保存JSONではありません。");
    state.world = compactWorldForStorage(raw);
    state.lastWorldSummary = raw.latestSummary || null;
    state.lastNextSeasonPack = null;
    state.worldSummaryLeagueId = "all";
    state.worldRosterTeamId = null;
    $("#worldProgressUntilDate").value = raw.currentDate || raw.season?.startDate || fallbackWorldMeta.defaults.startDate;
    saveWorldState();
    renderWorld();
    activateTab("world");
    setStatus(`${raw.season?.label || "ワールド"} を読み込みました`);
  } catch (error) {
    setStatus(error.message || "ワールド保存を読み込めませんでした。");
  }
}

function worldTeamById(teamId) {
  return state.world?.teams?.find((team) => team.id === teamId);
}

function worldFixtureById(fixtureId) {
  for (const day of state.world?.calendar || []) {
    const fixture = day.fixtures.find((item) => item.id === fixtureId);
    if (fixture) return fixture;
  }
  return null;
}

function renderWorldTable(league) {
  const formatLabel = worldLeagueFormatOptions.find((item) => item.key === league.format)?.label || league.format || "-";
  const phaseLabel = league.dynamicSchedule?.phase
    ? ` / ${league.dynamicSchedule.phase === "regular" ? "前期" : league.dynamicSchedule.phase === "regional" ? "地域内" : league.dynamicSchedule.phase === "split" ? "後期" : "合体"}`
    : "";
  const rows = (league.standings || []).map((team) => `
    <tr class="${team.clQualified ? "cl-zone" : ""}">
      <td>${team.rank}</td>
      <th>${escapeHtml(team.name)}</th>
      <td>${team.played}</td>
      <td>${team.wins}</td>
      <td>${team.draws}</td>
      <td>${team.losses}</td>
      <td>${team.goalsFor}</td>
      <td>${team.goalsAgainst}</td>
      <td>${team.goalDifference}</td>
      <td>${team.points}</td>
      <td>${formatNumber(team.fatigue, 1)}</td>
      <td>${escapeHtml(formText(team.form))}</td>
    </tr>
  `).join("");

  return `
    <section class="league-section">
      <h2>${escapeHtml(league.name)} <span>CL枠 ${league.clSlots}</span></h2>
      <div class="league-format-row">League Lv ${league.leagueLevel || 70}</div>
      <div class="league-format-row">開催方式: ${escapeHtml(formatLabel)}${escapeHtml(phaseLabel)}</div>
      <div class="league-table-wrap">
        <table class="league-table">
          <thead>
            <tr><th>#</th><th>チーム</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得</th><th>失</th><th>差</th><th>Pts</th><th>疲労</th><th>直近</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function nextWorldFixtures(world, selectedLeagueId = "all") {
  return (world.calendar || [])
    .map((day) => ({
      ...day,
      fixtures: (day.fixtures || []).filter((fixture) => fixture.status !== "played" && worldFixtureMatchesLeague(fixture, selectedLeagueId)),
    }))
    .filter((day) => day.fixtures.length)
    .slice(0, 3);
}

function worldCompetitionKindLabel(kind) {
  if (kind === "domestic-cup") return "国内杯";
  if (kind === "champions-league") return "CL";
  if (kind === "nations-league") return "NL";
  return "リーグ";
}

function renderWorldMatches(summary) {
  if (!summary?.matches?.length) {
    return `<div class="muted-row">試合なし</div>`;
  }
  return summary.matches.map((match) => `
    <button class="world-match-row${state.worldSelectedFixtureId === match.fixtureId ? " is-selected" : ""}" type="button" data-fixture-id="${escapeHtml(match.fixtureId)}">
      <strong><small>${escapeHtml(worldCompetitionKindLabel(match.competitionKind))}</small> ${escapeHtml(match.home)} ${match.score.home} - ${match.score.away} ${escapeHtml(match.away)}</strong>
      <span>${escapeHtml(match.competition)} / 第${match.round}節 / xG ${formatNumber(match.xg.home, 1)} - ${formatNumber(match.xg.away, 1)}</span>
    </button>
  `).join("");
}

function filterWorldSummary(summary, selectedLeagueId) {
  if (!summary || selectedLeagueId === "all") return summary;
  return {
    ...summary,
    matches: (summary.matches || []).filter((match) => {
      const fixture = worldFixtureById(match.fixtureId);
      return fixture ? worldFixtureMatchesLeague(fixture, selectedLeagueId) : false;
    }),
  };
}

function renderWorldSchedule(world, selectedLeagueId = "all") {
  const days = nextWorldFixtures(world, selectedLeagueId);
  if (!days.length) return `<div class="muted-row">予定なし</div>`;

  return days.map((day) => `
    <section class="round-card">
      <h3>${escapeHtml(day.date)}</h3>
      <div class="round-matches">
        ${day.fixtures.filter((fixture) => fixture.status !== "played").map((fixture) => {
          const home = worldTeamById(fixture.homeTeamId)?.name || fixture.homeTeamId;
          const away = worldTeamById(fixture.awayTeamId)?.name || fixture.awayTeamId;
          return `
            <div>
              <span>${escapeHtml(home)}</span>
              <strong>${escapeHtml(worldCompetitionKindLabel(fixture.competitionKind))}<br />vs</strong>
              <span>${escapeHtml(away)}</span>
              <em>${escapeHtml(fixture.competitionName)} / 第${fixture.round}節</em>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function worldRosterTeams(world, selectedLeagueId = "all") {
  return (world.teams || [])
    .filter((team) => !team.competitionOnly)
    .filter((team) => selectedLeagueId === "all" || team.leagueId === selectedLeagueId)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

function selectedWorldRosterTeam(world, selectedLeagueId = "all") {
  const teams = worldRosterTeams(world, selectedLeagueId);
  if (!teams.length) return null;
  const exists = teams.some((team) => team.id === state.worldRosterTeamId);
  if (!exists) state.worldRosterTeamId = teams[0].id;
  return teams.find((team) => team.id === state.worldRosterTeamId) || teams[0];
}

function renderWorldRosterTeamTabs(world, selectedLeagueId = "all", selectedTeamId = "") {
  const teams = worldRosterTeams(world, selectedLeagueId);
  if (!teams.length) return "";
  return `
    <div class="world-summary-tabs world-roster-tabs" role="tablist" aria-label="チームメンバー表示チーム">
      ${teams.map((team) => `
        <button class="${team.id === selectedTeamId ? "is-active" : ""}" type="button" data-world-roster-team="${escapeHtml(team.id)}">
          ${escapeHtml(team.name)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderWorldTeamRoster(world, selectedLeagueId = "all") {
  const team = selectedWorldRosterTeam(world, selectedLeagueId);
  if (!team) return `<div class="muted-row">チームなし</div>`;
  const league = world.leagues?.find((item) => item.id === team.leagueId);
  const states = world.playerStates?.[team.id] || {};
  const players = [...(team.team?.players || [])].sort((a, b) =>
    numberOr(b.rating, 0) - numberOr(a.rating, 0) ||
    String(a.fullName || a.name || "").localeCompare(String(b.fullName || b.name || ""), "ja"));
  const rows = players.map((player) => {
    const playerState = states[player.id] || {};
    const contract = playerState.contract || {};
    const season = playerState.season || {};
    const defensive = numberOr(season.steals, 0) + numberOr(season.interceptions, 0) + numberOr(season.blocks, 0);
    const injury = playerState.injury?.daysRemaining > 0
      ? `${playerState.injury.name} ${playerState.injury.daysRemaining}日`
      : "-";
    return `
      <tr>
        <th>${escapeHtml(player.fullName || player.name || player.id)}</th>
        <td>${escapeHtml(positionLabel(player.bestPosition || player.position))}</td>
        <td>${formatNumber(player.rating, 1)}</td>
        <td>${player.age ?? "-"}</td>
        <td>${formatNumber(playerState.fatigue || 0, 1)}</td>
        <td>${formatNumber(playerState.conditionDelta || 0, 1)}</td>
        <td>${escapeHtml(injury)}</td>
        <td>${contract.years ?? "-"}</td>
        <td>${formatNumber(contract.salaryIndex || 0, 0)}</td>
        <td>${escapeHtml(contract.role || "-")}</td>
        <td>${numberOr(season.matches, 0)}</td>
        <td>${formatNumber(season.minutes || 0, 0)}</td>
        <td>${numberOr(season.goals, 0)}</td>
        <td>${numberOr(season.assists, 0)}</td>
        <td>${defensive}</td>
      </tr>
    `;
  }).join("");

  return `
    ${renderWorldRosterTeamTabs(world, selectedLeagueId, team.id)}
    <div class="world-detail-head world-roster-head">
      <strong>${escapeHtml(team.name)}</strong>
      <span>${escapeHtml(league?.name || "-")} / Team Lv ${formatNumber(worldTeamStrength(team), 1)} / ${players.length}人 / ${escapeHtml(team.plan?.formation || "-")} / ${escapeHtml(team.plan?.tactic || "-")}</span>
    </div>
    <div class="league-table-wrap world-roster-table-wrap">
      <table class="league-table world-roster-table">
        <thead>
          <tr><th>選手</th><th>適性</th><th>能力</th><th>年齢</th><th>疲労</th><th>調子</th><th>けが</th><th>契約</th><th>年俸</th><th>役割</th><th>試</th><th>分</th><th>G</th><th>A</th><th>守備</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderWorldCups(world, selectedLeagueId = "all") {
  const cups = world.futureCompetitions?.domesticCups || [];
  const filteredCups = selectedLeagueId === "all" ? cups : cups.filter((cup) => cup.leagueId === selectedLeagueId);
  if (!filteredCups.length) return `<div class="muted-row">国内杯なし</div>`;

  return filteredCups.map((cup) => `
    <section class="round-card world-cup-card">
      <h3>${escapeHtml(cup.name)}${cup.completed ? " / 完了" : ""}</h3>
      <div class="world-cup-rounds">
        ${(cup.rounds || []).map((round) => {
          const fixtures = (round.fixtureIds || []).map((fixtureId) => worldFixtureById(fixtureId)).filter(Boolean);
          const byes = (round.byeTeamIds || []).map((teamId) => worldTeamById(teamId)?.name || teamId);
          if (!fixtures.length && !byes.length) {
            return `<div class="muted-row">${escapeHtml(round.date)} / ${escapeHtml(round.label || `R${round.round}`)} / 未確定</div>`;
          }
          return `
            <div class="world-cup-round">
              <strong>${escapeHtml(round.date)} / ${escapeHtml(round.label || `R${round.round}`)}</strong>
              ${fixtures.map((fixture) => {
                const home = worldTeamById(fixture.homeTeamId)?.name || fixture.homeTeamId;
                const away = worldTeamById(fixture.awayTeamId)?.name || fixture.awayTeamId;
                const score = fixture.result?.score;
                const label = score ? `${home} ${score.home} - ${score.away} ${away}` : `${home} vs ${away}`;
                const tag = fixture.status === "played" ? "結果" : "予定";
                if (fixture.status === "played") {
                  return `<button class="world-match-row${state.worldSelectedFixtureId === fixture.id ? " is-selected" : ""}" type="button" data-fixture-id="${escapeHtml(fixture.id)}"><strong><small>${tag}</small> ${escapeHtml(label)}</strong><span>${escapeHtml(cup.name)}</span></button>`;
                }
                return `<div class="world-cup-fixture"><span>${escapeHtml(tag)}</span><strong>${escapeHtml(label)}</strong></div>`;
              }).join("")}
              ${byes.map((name) => `<div class="world-cup-fixture"><span>bye</span><strong>${escapeHtml(name)}</strong></div>`).join("")}
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function renderChampionsLeague(world) {
  const cl = world.futureCompetitions?.championsLeague;
  if (!cl?.enabled) {
    const missing = cl?.missingCountries?.length ? ` / 不足: ${cl.missingCountries.join(", ")}` : "";
    return `<div class="muted-row">CL未開催${escapeHtml(missing)}</div>`;
  }

  const standings = (cl.standings || []).slice(0, 32);
  const table = standings.length ? `
    <div class="league-table-wrap">
      <table class="league-table">
        <thead><tr><th>#</th><th>クラブ</th><th>Pot</th><th>試</th><th>勝点</th><th>得失</th></tr></thead>
        <tbody>
          ${standings.map((row) => `
            <tr>
              <td>${row.rank}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${row.pot || "-"}</td>
              <td>${row.played}</td>
              <td>${row.points}</td>
              <td>${formatSigned(row.goalDifference)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  const knockout = (cl.knockoutRounds || []).map((round) => `
    <div class="world-cup-round">
      <strong>${escapeHtml(round.label || round.phase)}${round.completed ? " / 完了" : ""}</strong>
      ${(round.ties || []).map((tie) => {
        const teams = (tie.teamIds || []).map((teamId) => worldTeamById(teamId)?.name || teamId);
        const winner = tie.winnerTeamId ? worldTeamById(tie.winnerTeamId)?.name || tie.winnerTeamId : "";
        return `<div class="world-cup-fixture"><span>${tie.completed ? "勝者" : "予定"}</span><strong>${escapeHtml(teams.join(" vs "))}${winner ? ` / ${escapeHtml(winner)}` : ""}</strong></div>`;
      }).join("")}
    </div>
  `).join("");

  return `
    <section class="round-card world-cup-card">
      <h3>Champions League${cl.completed ? " / 完了" : ""}${cl.championTeamId ? ` / 優勝 ${escapeHtml(worldTeamById(cl.championTeamId)?.name || cl.championTeamId)}` : ""}</h3>
      <div class="world-cl-list">
        <strong>Pot</strong>
        <span>${(cl.pots || []).map((pot, index) => `Pot${index + 1}: ${pot.map((entry) => entry.team).join(", ")}`).join(" / ")}</span>
      </div>
      ${table}
      <div class="world-cup-rounds">${knockout}</div>
    </section>
  `;
}

function renderNationsLeague(world) {
  const nl = world.futureCompetitions?.nationsLeague;
  if (!nl?.teamIds?.length) return `<div class="muted-row">NL未開催</div>`;
  const rows = (nl.standings || []).map((row) => `
    <tr>
      <td>${row.rank}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.draws}</td>
      <td>${row.losses}</td>
      <td>${row.goalsFor}</td>
      <td>${row.goalsAgainst}</td>
      <td>${formatSigned(row.goalDifference)}</td>
      <td>${row.points}</td>
      <td>${escapeHtml(formText(row.form))}</td>
    </tr>
  `).join("");
  const windows = (nl.windows || []).map((window) => `
    <div class="world-cup-fixture">
      <span>Week ${window.index + 1}</span>
      <strong>${escapeHtml((window.matchDates || []).join(" / "))}</strong>
    </div>
  `).join("");
  return `
    <section class="round-card world-cup-card">
      <h3>灯剣ネーションズリーグ Division ${nl.division || 1}${nl.completed ? " / 完了" : ""}</h3>
      <div class="league-table-wrap">
        <table class="league-table">
          <thead><tr><th>#</th><th>代表</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得</th><th>失</th><th>差</th><th>Pts</th><th>直近</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="world-cup-rounds">${windows}</div>
    </section>
  `;
}

function worldPlayerRows(world, selectedLeagueId = "all") {
  const rows = [];
  for (const team of world.teams || []) {
    if (team.competitionOnly) continue;
    if (selectedLeagueId !== "all" && team.leagueId !== selectedLeagueId) continue;
    const states = world.playerStates?.[team.id] || {};
    for (const player of team.team.players || []) {
      const playerState = states[player.id];
      if (!playerState) continue;
      const injury = playerState.injury?.daysRemaining > 0
        ? `${playerState.injury.name} ${playerState.injury.daysRemaining}日`
        : "";
      if (!injury && Number(playerState.fatigue || 0) < 5.8 && Math.abs(Number(playerState.conditionDelta || 0)) < 4.5) continue;
      rows.push({
        team: team.name,
        player: player.fullName,
        fatigue: Number(playerState.fatigue || 0),
        condition: Number(playerState.conditionDelta || 0),
        injury,
      });
    }
  }

  return rows
    .sort((a, b) => Number(Boolean(b.injury)) - Number(Boolean(a.injury)) || b.fatigue - a.fatigue || a.player.localeCompare(b.player, "ja"))
    .slice(0, 12);
}

function renderWorldPlayerState(world, selectedLeagueId = "all") {
  const rows = worldPlayerRows(world, selectedLeagueId);
  if (!rows.length) return `<div class="muted-row">注意状態なし</div>`;

  return `
    <div class="world-team-state">
      ${rows.map((row) => `
        <div class="world-player-row">
          <span>${escapeHtml(row.player)} / ${escapeHtml(row.team)}</span>
          <em>疲労 ${formatNumber(row.fatigue, 1)}</em>
          <em>調子 ${formatNumber(row.condition, 1)}</em>
          <em>${escapeHtml(row.injury || "-")}</em>
        </div>
      `).join("")}
    </div>
  `;
}

function renderWorldNews(world) {
  const range = state.lastWorldSummary?.rangeSummary;
  const rangeCard = range ? `
    <div class="world-news-row">
      <strong>${escapeHtml(range.from)} - ${escapeHtml(range.finalDate || range.to)}</strong>
      <span>${range.progressedDays}日進行 / ${range.matches.length}試合 / けが${range.injuries.length}件 / 復帰${range.recoveries.length}件</span>
    </div>
  ` : "";
  const news = (world.news || []).slice(0, 8);
  if (!news.length) return rangeCard || `<div class="muted-row">ニュースなし</div>`;
  return rangeCard + news.map((item) => `
    <div class="world-news-row">
      <strong>${escapeHtml(item.date)}</strong>
      <span>${escapeHtml(item.text)}</span>
    </div>
  `).join("");
}

function worldStatRows(world, leagueId = "all") {
  const rows = [];
  for (const team of world.teams || []) {
    if (leagueId !== "all" && team.leagueId !== leagueId) continue;
    const states = world.playerStates?.[team.id] || {};
    for (const player of team.team.players || []) {
      const state = states[player.id];
      const season = state?.season;
      if (!season || !Number(season.matches || 0)) continue;
      const passRate = Number(season.passes || 0) ? Number(season.completedPasses || 0) / Number(season.passes) : 0;
      const defensiveActions = Number(season.steals || 0) + Number(season.interceptions || 0) + Number(season.blocks || 0);
      const mvpScore =
        Number(season.goals || 0) * 5.2 +
        Number(season.assists || 0) * 3.4 +
        Number(season.shots || 0) * 0.08 +
        defensiveActions * 1.25 +
        Number(season.completedPasses || 0) * 0.02 +
        Math.min(8, Number(season.minutes || 0) / 600);
      rows.push({
        playerId: player.id,
        player: player.fullName,
        team: team.name,
        teamId: team.id,
        leagueId: team.leagueId,
        position: String(player.bestPosition || player.position || ""),
        rating: Number(player.rating || 0),
        matches: Number(season.matches || 0),
        minutes: Number(season.minutes || 0),
        goals: Number(season.goals || 0),
        assists: Number(season.assists || 0),
        shots: Number(season.shots || 0),
        passes: Number(season.passes || 0),
        completedPasses: Number(season.completedPasses || 0),
        passRate,
        steals: Number(season.steals || 0),
        interceptions: Number(season.interceptions || 0),
        blocks: Number(season.blocks || 0),
        defensiveActions,
        goalContribution: Number(season.goals || 0) + Number(season.assists || 0),
        mvpScore,
      });
    }
  }
  return rows;
}

function renderLeaderboard(title, rows, valueFn, sortFn) {
  const prepared = [...rows].sort(sortFn).slice(0, 10);
  if (!prepared.length) return "";
  return `
    <section class="world-leaderboard">
      <h3>${escapeHtml(title)}</h3>
      <ol>
        ${prepared.map((row) => `
          <li>
            <span>${escapeHtml(row.player)}</span>
            <em>${escapeHtml(row.team)}</em>
            <strong>${escapeHtml(valueFn(row))}</strong>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function worldSummaryScopes(world) {
  return [
    { id: "all", name: "全体" },
    ...(world.leagues || []).map((league) => ({ id: league.id, name: league.name })),
  ];
}

function selectedWorldSummaryLeague(world) {
  const exists = (world.leagues || []).some((league) => league.id === state.worldSummaryLeagueId);
  if (state.worldSummaryLeagueId !== "all" && !exists) {
    state.worldSummaryLeagueId = "all";
  }
  return (world.leagues || []).find((league) => league.id === state.worldSummaryLeagueId) || null;
}

function renderWorldSummaryScopeTabs(world, selectedId) {
  return `
    <div class="world-summary-tabs" role="tablist" aria-label="シーズンサマリー表示範囲">
      ${worldSummaryScopes(world).map((scope) => `
        <button class="${selectedId === scope.id ? "is-active" : ""}" type="button" data-world-summary-league="${escapeHtml(scope.id)}">
          ${escapeHtml(scope.name)}
        </button>
      `).join("")}
    </div>
  `;
}

function selectedWorldLeagueId(world) {
  const selected = selectedWorldSummaryLeague(world);
  return selected?.id || "all";
}

function worldFixtureMatchesLeague(fixture, selectedLeagueId) {
  if (selectedLeagueId === "all") return true;
  if (fixture.competitionKind === "league") return fixture.competitionId === selectedLeagueId;
  if (fixture.competitionKind === "domestic-cup") {
    return fixture.cupId === `cup-${selectedLeagueId}` || fixture.competitionId === `cup-${selectedLeagueId}`;
  }
  return fixture.leagueId === selectedLeagueId;
}

const bestSevenSlots = [
  { key: "cg", label: "CG", codes: ["1", "11"], family: ["1", "11"] },
  { key: "sg-r", label: "右SG", codes: ["2", "12"], family: ["2", "3", "12", "13"] },
  { key: "sg-l", label: "左SG", codes: ["3", "13"], family: ["2", "3", "12", "13"] },
  { key: "ct", label: "CT", codes: ["4", "10", "14"], family: ["4", "10", "14"] },
  { key: "wg-r", label: "右WG", codes: ["5", "15"], family: ["5", "6", "15", "16"] },
  { key: "wg-l", label: "左WG", codes: ["6", "16"], family: ["5", "6", "15", "16"] },
  { key: "pt", label: "PT", codes: ["7", "17"], family: ["7", "17"] },
];

const positionDetailLabels = {
  1: "CG",
  2: "右SG",
  3: "左SG",
  4: "CT",
  5: "右WG",
  6: "左WG",
  7: "PT",
  10: "Free CT",
  11: "Libero CG",
  12: "攻撃的SG右",
  13: "攻撃的SG左",
  14: "Anchor CT",
  15: "Inside WG右",
  16: "Inside WG左",
  17: "Shadow PT",
};

function rowKey(row) {
  return `${row.teamId}:${row.playerId}`;
}

function positionLabel(position) {
  return positionDetailLabels[String(position || "")] || `#${position || "-"}`;
}

function pickBestSeven(rows) {
  return pickBestSevenByPosition(rows);
  const selected = [];
  const used = new Set();
  const sorted = [...rows].sort((a, b) =>
    b.mvpScore - a.mvpScore ||
    b.goalContribution - a.goalContribution ||
    b.defensiveActions - a.defensiveActions ||
    b.rating - a.rating ||
    b.minutes - a.minutes);
  const slots = [
    { key: "last", label: "最後尾", count: 1 },
    { key: "defense", label: "守備", count: 2 },
    { key: "midfield", label: "中盤", count: 2 },
    { key: "attack", label: "攻撃", count: 2 },
  ];

  for (const slot of slots) {
    const candidates = sorted.filter((row) => !used.has(`${row.teamId}:${row.playerId}`) && positionGroup(row.position) === slot.key);
    for (const row of candidates.slice(0, slot.count)) {
      selected.push({ ...row, bestSevenRole: slot.label });
      used.add(`${row.teamId}:${row.playerId}`);
    }
  }

  for (const row of sorted) {
    if (selected.length >= 7) break;
    if (used.has(`${row.teamId}:${row.playerId}`)) continue;
    selected.push({ ...row, bestSevenRole: "万能" });
    used.add(`${row.teamId}:${row.playerId}`);
  }

  return selected.slice(0, 7);
}

function pickBestSevenByPosition(rows) {
  const selected = [];
  const used = new Set();
  const sorted = [...rows].sort((a, b) =>
    b.mvpScore - a.mvpScore ||
    b.goalContribution - a.goalContribution ||
    b.defensiveActions - a.defensiveActions ||
    b.rating - a.rating ||
    b.minutes - a.minutes);

  for (const slot of bestSevenSlots) {
    const exact = sorted.find((row) => !used.has(rowKey(row)) && slot.codes.includes(String(row.position || "")));
    const family = sorted.find((row) => !used.has(rowKey(row)) && slot.family.includes(String(row.position || "")));
    const picked = exact || family;
    if (picked) {
      selected.push({ ...picked, bestSevenRole: slot.label });
      used.add(rowKey(picked));
    }
  }

  for (const row of sorted) {
    if (selected.length >= 7) break;
    if (used.has(rowKey(row))) continue;
    selected.push({ ...row, bestSevenRole: "補完" });
    used.add(rowKey(row));
  }

  return selected.slice(0, 7);
}

function renderBestSeven(rows) {
  const bestSeven = pickBestSevenByPosition(rows);
  if (!bestSeven.length) return "";
  return `
    <section class="world-best-seven">
      <h3>ベストセブン</h3>
      <div class="world-best-seven-grid">
        ${bestSeven.map((row, index) => `
          <div>
            <em>${index + 1}. ${escapeHtml(row.bestSevenRole)} / 適性${escapeHtml(row.position || "-")}</em>
            <strong>${escapeHtml(row.player)}</strong>
            <span>${escapeHtml(row.team)}</span>
            <small>${formatNumber(row.mvpScore, 1)}pt / ${row.goals}G ${row.assists}A / 守備${row.defensiveActions}</small>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBestSevenByPosition(rows) {
  const bestSeven = pickBestSevenByPosition(rows);
  if (!bestSeven.length) return "";
  return `
    <section class="world-best-seven">
      <h3>ベストセブン</h3>
      <div class="world-best-seven-grid">
        ${bestSeven.map((row, index) => `
          <div>
            <em>${index + 1}. ${escapeHtml(row.bestSevenRole)} / ${escapeHtml(positionLabel(row.position))}</em>
            <strong>${escapeHtml(row.player)}</strong>
            <span>${escapeHtml(row.team)}</span>
            <small>${formatNumber(row.mvpScore, 1)}pt / ${row.goals}G ${row.assists}A / 守備${row.defensiveActions}</small>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDevelopmentHighlightList(title, rows, valueLabel) {
  if (!rows?.length) return "";
  return `
    <section class="world-leaderboard">
      <h3>${escapeHtml(title)}</h3>
      <ol>
        ${rows.map((row) => `
          <li>
            <span>${escapeHtml(row.player)}</span>
            <em>${escapeHtml(row.team)} / ${escapeHtml(positionLabel(row.position))}${row.ageFrom ? ` / ${row.ageFrom}->${row.ageTo}歳` : row.age ? ` / ${row.age}歳` : ""}</em>
            <strong>${escapeHtml(valueLabel(row))}</strong>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderDevelopmentHighlights(world) {
  const pack = state.lastNextSeasonPack;
  if (!world.completed || !pack?.developmentHighlights) return "";
  const highlights = pack.developmentHighlights;
  return `
    <section class="world-best-seven">
      <h3>翌季変動ピックアップ</h3>
      <div class="world-leaderboard-grid">
        ${renderDevelopmentHighlightList("大きく伸びた選手", highlights.growth, (row) => `+${formatNumber(row.delta, 2)}`)}
        ${renderDevelopmentHighlightList("大きく落ちた選手", highlights.decline, (row) => formatNumber(row.delta, 2))}
        ${renderDevelopmentHighlightList("主な引退", highlights.retired, (row) => `適性${formatNumber(row.rating, 1)}`)}
        ${renderDevelopmentHighlightList("新人加入", highlights.rookies, (row) => `適性${formatNumber(row.rating, 1)}`)}
      </div>
    </section>
  `;
}

function renderContractSummaryList(title, rows, valueLabel) {
  if (!rows?.length) return "";
  return `
    <section class="world-leaderboard">
      <h3>${escapeHtml(title)}</h3>
      <ol>
        ${rows.map((row) => `
          <li>
            <span>${escapeHtml(row.player)}</span>
            <em>${escapeHtml(row.team)} / ${escapeHtml(positionLabel(row.position))} / ${row.age ?? "-"}歳 / 年俸${formatNumber(row.salaryIndex || 0, 0)}</em>
            <strong>${escapeHtml(valueLabel(row))}</strong>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderContractSummary(world, selectedLeagueId = "all") {
  if (!world.completed || !world.contractSummary) return "";
  const teamIds = new Set((world.teams || [])
    .filter((team) => selectedLeagueId === "all" || team.leagueId === selectedLeagueId)
    .map((team) => team.id));
  const scopeRows = (rows = []) => rows.filter((row) => selectedLeagueId === "all" || teamIds.has(row.teamId));
  const expired = scopeRows(world.contractSummary.expired);
  const lastYear = scopeRows(world.contractSummary.lastYear);
  const extended = scopeRows(world.contractSummary.extended);
  if (!expired.length && !lastYear.length && !extended.length) return "";

  return `
    <section class="world-best-seven contract-summary">
      <h3>契約サマリー</h3>
      <div class="world-leaderboard-grid">
        ${renderContractSummaryList("契約満了", expired, (row) => `希望${formatNumber((row.interest || 0) * 100, 0)}%`)}
        ${renderContractSummaryList("残り1年", lastYear, (row) => `希望${formatNumber((row.interest || 0) * 100, 0)}%`)}
        ${renderContractSummaryList("自動延長", extended, (row) => `${row.years}年`)}
      </div>
    </section>
  `;
}

const transferPositionGroups = [
  { key: "cg", label: "CG", codes: ["1", "11"] },
  { key: "sg", label: "SG", codes: ["2", "3", "12", "13"] },
  { key: "ct", label: "CT", codes: ["4", "10", "14"] },
  { key: "wg", label: "WG", codes: ["5", "6", "15", "16"] },
  { key: "pt", label: "PT", codes: ["7", "17"] },
];

function transferGroupForPosition(position) {
  const code = String(position || "");
  return transferPositionGroups.find((group) => group.codes.includes(code)) || transferPositionGroups[2];
}

function transferGroupByKey(key) {
  return transferPositionGroups.find((group) => group.key === key) || transferPositionGroups[2];
}

function formationMetaByKey(key) {
  const formationKey = key || "f313";
  return state.meta?.formations?.find((formation) => formation.key === formationKey)
    || state.meta?.formations?.find((formation) => formation.key === "f313")
    || { key: "f313", label: "3-1-3", slots: [] };
}

function transferSlotGroupWeights(slot) {
  const key = String(slot?.key || "");
  const allowed = Array.isArray(slot?.allowed) ? slot.allowed : [];
  const firstGroup = transferGroupForPosition(allowed[0]);

  if (key.includes("back_center")) return { cg: 1 };
  if (key.startsWith("back_") || key.includes("back_wide") || key.includes("midfield_wide")) return { sg: 1 };
  if (key === "front_center") return { pt: 1 };
  if (key === "front_right" || key === "front_left") {
    const groups = new Set(allowed.map((code) => transferGroupForPosition(code).key));
    if (groups.has("pt") && groups.has("wg")) return { pt: 0.5, wg: 0.5 };
    return { [firstGroup.key]: 1 };
  }
  if (key.startsWith("midfield")) return { ct: 1 };

  return { [firstGroup.key]: 1 };
}

function teamTransferRequirements(team) {
  const formation = formationMetaByKey(team.plan?.formation);
  const starters = Object.fromEntries(transferPositionGroups.map((group) => [group.key, 0]));

  for (const slot of formation.slots || []) {
    const weights = transferSlotGroupWeights(slot);
    for (const [key, weight] of Object.entries(weights)) {
      starters[key] = (starters[key] || 0) + weight;
    }
  }

  if (!Object.values(starters).some((value) => value > 0)) {
    starters.cg = 1;
    starters.sg = 2;
    starters.ct = 1;
    starters.wg = 2;
    starters.pt = 1;
  }

  return Object.fromEntries(transferPositionGroups.map((group) => {
    const starterSlots = starters[group.key] || 0;
    const min = starterSlots > 0 ? Math.ceil(Math.max(starterSlots + 1, starterSlots * 1.65)) : 0;
    return [group.key, {
      ...group,
      starterSlots,
      min,
      formation: formation.key,
      formationLabel: formation.label || formation.key,
    }];
  }));
}

function teamAverageRating(players) {
  if (!players.length) return 0;
  return players.reduce((sum, player) => sum + numberOr(player.rating, 0), 0) / players.length;
}

function teamTopAverageRating(players, count = 7) {
  const ratings = players
    .map((player) => numberOr(player.rating, 0))
    .filter((rating) => rating > 0)
    .sort((a, b) => b - a)
    .slice(0, count);
  if (!ratings.length) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function worldLeagueForTeam(world, team) {
  return (world.leagues || []).find((league) => league.id === team.leagueId) || null;
}

function leagueMarketLevel(league) {
  return clampNumber(Number(league?.leagueLevel || 70), 1, 100);
}

function leagueMarketValueMultiplier(league) {
  return 0.72 + leagueMarketLevel(league) / 100 * 0.76;
}

function leagueBudgetMultiplier(league) {
  return 0.68 + leagueMarketLevel(league) / 100 * 0.86;
}

function transferWorldTeamById(world, teamId) {
  return (world.teams || []).find((team) => team.id === teamId) || null;
}

function standingRankForTeam(league, teamId) {
  const index = (league?.standings || []).findIndex((standing) => standing.teamId === teamId);
  return index >= 0 ? index + 1 : null;
}

function worldTeamStrength(team) {
  if (Number.isFinite(Number(team.teamLevel))) return Number(team.teamLevel);
  const players = team.team?.players || [];
  return teamAverageRating(players) * 0.35 + teamTopAverageRating(players, 7) * 0.65;
}

function leagueStrengthContext(world, league) {
  const teams = (league?.teamIds || [])
    .map((teamId) => transferWorldTeamById(world, teamId))
    .filter(Boolean)
    .map((team) => ({
      team,
      strength: worldTeamStrength(team),
      rank: standingRankForTeam(league, team.id),
    }))
    .sort((a, b) => b.strength - a.strength);
  const topCount = Math.max(1, Math.ceil(teams.length * 0.25));
  const titleLine = teams.slice(0, topCount);
  const titleAverage = titleLine.reduce((sum, entry) => sum + entry.strength, 0) / Math.max(1, titleLine.length);
  return { teams, titleAverage, topCount };
}

function ambitionTransferAssessment(world, team, player, rating, minutesRate, teamAverage) {
  const age = numberOr(player.age, 24);
  if (age < 20 || age > 31) return { score: 0, reasons: [] };
  if (rating < 74 || rating < teamAverage + 3) return { score: 0, reasons: [] };

  const league = worldLeagueForTeam(world, team);
  const context = leagueStrengthContext(world, league);
  const teamStrength = worldTeamStrength(team);
  const strengthGap = context.titleAverage - teamStrength;
  const rank = standingRankForTeam(league, team.id);
  const clSlots = Math.max(1, Number(league?.clSlots || 1));
  const playerEdge = rating - teamAverage;
  const isCorePlayer = minutesRate >= 0.45;
  const isUnderCompetitiveCeiling = strengthGap >= 2.4 || (rank && rank > clSlots);

  if (!isCorePlayer || !isUnderCompetitiveCeiling) return { score: 0, reasons: [] };

  let score = 1.0 + Math.min(2.4, strengthGap * 0.22) + Math.min(1.6, playerEdge * 0.18);
  if (age >= 22 && age <= 28) score += 0.6;
  if (rank && rank > clSlots) score += 0.5;
  if (rating >= 86) score += 0.4;

  const reasons = [rank && rank > clSlots ? "CL圏クラブ志向" : "優勝争いクラブ志向"];
  if (playerEdge >= 6) reasons.push("チーム内で能力上位");
  if (age <= 24) reasons.push("成長環境を求める");
  return { score, reasons };
}

function playerMinutesRate(world, teamId, playerState) {
  return numberOr(playerState?.season?.minutes, 0) / Math.max(1, teamMatchCount(world, teamId) * 90);
}

function playerMarketValueIndex(player, league = null, contract = null) {
  const rating = numberOr(player.rating, 60);
  const age = numberOr(player.age, 24);
  const agePremium = age <= 21 ? 1.35 : age <= 24 ? 1.22 : age <= 28 ? 1.08 : age <= 31 ? 0.92 : age <= 34 ? 0.72 : 0.52;
  const elitePremium = rating >= 90 ? 1.35 : rating >= 84 ? 1.18 : rating >= 78 ? 1.05 : 0.9;
  return Math.max(4, rating * 0.72 * agePremium * elitePremium * leagueMarketValueMultiplier(league) * contractMarketValueMultiplier(contract));
}

function contractMarketValueMultiplier(contract) {
  if (!contract) return 1;
  const years = Number(contract.years ?? 2);
  const salary = Number(contract.salaryIndex || 0);
  const yearFactor = years <= 0 ? 0.28 : years === 1 ? 0.58 : years === 2 ? 0.88 : years >= 5 ? 1.12 : 1;
  const salaryFactor = salary >= 120 ? 0.88 : salary >= 90 ? 0.94 : salary <= 35 ? 1.05 : 1;
  return clampNumber(yearFactor * salaryFactor, 0.2, 1.2);
}

function playerContract(world, team, player) {
  return world.playerStates?.[team.id]?.[player.id]?.contract || null;
}

function proposedContractForTransfer(player, currentContract, buyer) {
  const rating = numberOr(player.rating, 60);
  const age = numberOr(player.age, 24);
  const currentSalary = numberOr(currentContract?.salaryIndex, rating * 0.72);
  const years = age <= 23 ? 4 : age <= 29 ? 3 : age <= 33 ? 2 : 1;
  const ambitionPremium = worldTeamStrength(buyer) >= rating ? 1.04 : 1.12;
  return {
    years,
    salaryIndex: roundNumber(Math.max(rating * 0.82, currentSalary * ambitionPremium), 2),
  };
}

function proposedContractForFreeAgent(player, currentContract, buyer) {
  const base = proposedContractForTransfer(player, currentContract, buyer);
  const rating = numberOr(player.rating, 60);
  return {
    ...base,
    salaryIndex: roundNumber(Math.max(base.salaryIndex * 0.94, rating * 0.76), 2),
    status: "free-agent-new",
  };
}

function proposedLoanTerms(player, currentContract, buyer) {
  const rating = numberOr(player.rating, 60);
  const salary = numberOr(currentContract?.salaryIndex, rating * 0.72);
  const buyerStrength = worldTeamStrength(buyer);
  const salaryShare = clampNumber(0.42 + (buyerStrength - rating) * 0.012, 0.25, 0.78);
  return {
    years: 1,
    loan: true,
    salaryShare: roundNumber(salaryShare, 2),
    salaryIndex: roundNumber(salary * salaryShare, 2),
  };
}

function transferBudgetIndex(world, team) {
  if (Number.isFinite(Number(team.finance?.remainingTransferBudgetIndex))) {
    return Math.max(0, Number(team.finance.remainingTransferBudgetIndex));
  }
  if (Number.isFinite(Number(team.finance?.transferBudgetIndex))) {
    return Math.max(0, Number(team.finance.transferBudgetIndex));
  }
  const league = worldLeagueForTeam(world, team);
  const rank = standingRankForTeam(league, team.id) || (league?.teamIds?.length || 12);
  const strength = worldTeamStrength(team);
  const clSlots = Math.max(1, Number(league?.clSlots || 1));
  const rankBonus = rank <= clSlots ? 18 : rank <= clSlots + 3 ? 10 : rank <= Math.ceil((league?.teamIds?.length || 12) / 2) ? 4 : 0;
  return Math.max(18, (strength * 0.55 + rankBonus) * leagueBudgetMultiplier(league));
}

function financeFromTeamLevel(world, team) {
  const league = worldLeagueForTeam(world, team);
  const level = worldTeamStrength(team);
  const leagueLevel = leagueMarketLevel(league);
  const financialPowerIndex = roundNumber(clampNumber(level * 0.74 + leagueLevel * 0.26, 1, 100), 2);
  const transferBudgetIndex = roundNumber(clampNumber(financialPowerIndex * 0.62 + Math.max(0, level - 72) * 1.15, 12, 145), 2);
  const wageBudgetIndex = roundNumber(clampNumber(financialPowerIndex * 1.18 + Math.max(0, level - 78) * 1.6, 25, 230), 2);
  return {
    source: "team-level",
    financialPowerIndex,
    transferBudgetIndex,
    remainingTransferBudgetIndex: transferBudgetIndex,
    wageBudgetIndex,
  };
}

function ensureTeamFinance(world, team) {
  const base = financeFromTeamLevel(world, team);
  team.finance = {
    ...base,
    ...(team.finance || {}),
  };
  if (!Number.isFinite(Number(team.finance.remainingTransferBudgetIndex))) {
    team.finance.remainingTransferBudgetIndex = team.finance.transferBudgetIndex;
  }
  return team.finance;
}

function applyTransferBudgetMovement(world, buyer, seller, value, type = "transfer") {
  const amount = numberOr(value, 0);
  const buyerFinance = ensureTeamFinance(world, buyer);
  const costRate = type === "loan" ? 0.45 : type === "free-agent" ? 0.35 : 1;
  buyerFinance.remainingTransferBudgetIndex = roundNumber(Math.max(0, numberOr(buyerFinance.remainingTransferBudgetIndex, buyerFinance.transferBudgetIndex) - amount * costRate), 2);
  if (seller) {
    const sellerFinance = ensureTeamFinance(world, seller);
    const incomeRate = type === "loan" ? 0.32 : 0.72;
    sellerFinance.remainingTransferBudgetIndex = roundNumber(numberOr(sellerFinance.remainingTransferBudgetIndex, sellerFinance.transferBudgetIndex) + amount * incomeRate, 2);
  }
}

function playerTransferGroupMap(team) {
  const groupMap = Object.fromEntries(transferPositionGroups.map((group) => [group.key, []]));
  for (const player of team.team?.players || []) {
    const group = transferGroupForPosition(player.bestPosition);
    groupMap[group.key].push(player);
  }
  return groupMap;
}

function sellabilityScore(world, team, player, groupMap, requirement, minutesRate, teamAverage, contract = null) {
  const group = transferGroupForPosition(player.bestPosition);
  const rating = numberOr(player.rating, 0);
  const age = numberOr(player.age, 24);
  const groupCount = groupMap[group.key]?.length || 0;
  const surplus = Math.max(0, groupCount - (requirement?.min || 0));
  let score = 0.7;

  if (minutesRate < 0.15) score += 2.2;
  else if (minutesRate < 0.35) score += 1.2;
  else if (minutesRate >= 0.65) score -= 1.2;

  score += Math.min(1.8, surplus * 0.45);
  if (age >= 32) score += 0.8;
  if (age <= 23 && rating >= teamAverage - 2 && minutesRate < 0.35) score -= 0.4;
  if (rating >= teamAverage + 5 && minutesRate >= 0.45) score -= 0.9;
  if (contract) {
    const years = Number(contract.years ?? 2);
    const salaryPressure = (Number(contract.salaryIndex || 0) - rating * 0.9) / 32;
    if (years <= 0) score += 2.0;
    else if (years === 1) score += 1.1;
    else if (years >= 4) score -= 0.35;
    score += clampNumber(salaryPressure, -0.25, 0.9);
  }

  const ambition = ambitionTransferAssessment(world, team, player, rating, minutesRate, teamAverage);
  if (ambition.score > 0) score += Math.min(1.1, ambition.score * 0.25);
  return clampNumber(score, 0, 5);
}

function destinationAcceptanceScore(world, buyer, seller, player, need, buyerRequirement) {
  const buyerLeague = worldLeagueForTeam(world, buyer);
  const sellerLeague = worldLeagueForTeam(world, seller);
  const buyerRank = standingRankForTeam(buyerLeague, buyer.id) || 99;
  const sellerRank = standingRankForTeam(sellerLeague, seller.id) || 99;
  const buyerStrength = worldTeamStrength(buyer);
  const sellerStrength = worldTeamStrength(seller);
  const rating = numberOr(player.rating, 0);
  const age = numberOr(player.age, 24);
  let score = 1.4;

  score += clampNumber((buyerStrength - sellerStrength) * 0.22, -1.2, 2.4);
  score += clampNumber((leagueMarketLevel(buyerLeague) - leagueMarketLevel(sellerLeague)) * 0.045, -1.4, 1.8);
  if (buyerLeague?.id !== sellerLeague?.id) score += 0.25;
  if (buyerRank < sellerRank) score += 0.7;
  if (buyerRank <= Math.max(1, Number(buyerLeague?.clSlots || 1))) score += 0.7;
  if (need?.priority) score += Math.min(1.5, need.priority * 0.16);
  if (buyerRequirement?.starterSlots > 0) score += 0.35;
  if (age <= 23 && buyerStrength > sellerStrength + 1.5) score += 0.35;
  if (rating < teamAverageRating(buyer.team?.players || []) - 5) score -= 0.9;

  return clampNumber(score, 0, 5);
}

function negotiationAskingPrice(proposal) {
  const contractYears = Number(proposal.currentContract?.years ?? 2);
  const sellerPremium = 1.12 + Math.max(0, 3.4 - proposal.sellability) * 0.12;
  const contractPremium = contractYears >= 4 ? 0.18 : contractYears <= 1 ? -0.18 : 0;
  return roundNumber(proposal.value * clampNumber(sellerPremium + contractPremium, 0.75, 1.65), 2);
}

function negotiationInitialOffer(proposal, rng) {
  const budgetPressure = proposal.budget <= proposal.value ? -0.12 : 0.02;
  const confidence = clampNumber((proposal.acceptance + proposal.sellability - 5.2) * 0.035, -0.08, 0.08);
  return roundNumber(proposal.value * clampNumber(0.72 + budgetPressure + confidence + rng * 0.10, 0.58, 0.92), 2);
}

function negotiationStageLabel(status) {
  const readable = {
    agreed: "合意",
    deadline: "終盤妥協",
    competing: "競合中",
    won_competition: "競合勝利",
    rejected: "拒否",
    withdrawn: "撤退",
  }[status];
  if (readable) return readable;
  return {
    agreed: "合意",
    deadline: "終盤妥協",
    competing: "競合中",
    rejected: "拒否",
    withdrawn: "撤退",
  }[status] || status || "-";
}

function transferTypeLabel(type) {
  return {
    transfer: "完全移籍",
    loan: "レンタル",
    "free-agent": "フリー獲得",
  }[type] || "完全移籍";
}

function simulateNegotiation(world, proposal, rawProposals = []) {
  const seed = `${world.id || world.seed || "world"}:${proposal.buyerId}:${proposal.sellerId}:${proposal.playerId}:negotiation`;
  const r1 = seededUnit(`${seed}:initial`);
  const r2 = seededUnit(`${seed}:counter`);
  const r3 = seededUnit(`${seed}:competition`);
  const asking = negotiationAskingPrice(proposal);
  const initialOffer = negotiationInitialOffer(proposal, r1);
  const hardLimit = roundNumber(Math.min(proposal.budget, proposal.value * (1.08 + proposal.acceptance * 0.11)), 2);
  const sellerFloor = roundNumber(asking * clampNumber(0.86 + (3.5 - proposal.sellability) * 0.035, 0.76, 1.04), 2);
  const competitorCount = rawProposals.filter((other) =>
    other.playerId === proposal.playerId && other.buyerId !== proposal.buyerId && other.score >= proposal.score - 0.75).length;
  const competitionPremium = competitorCount ? 1 + Math.min(0.22, competitorCount * 0.07 + r3 * 0.05) : 1;
  const counterOffer = roundNumber(Math.min(hardLimit, Math.max(initialOffer * (1.10 + r2 * 0.12), sellerFloor * 0.94) * competitionPremium), 2);
  const deadlineOffer = roundNumber(Math.min(hardLimit, Math.max(counterOffer, sellerFloor * 0.98, asking * 0.9)), 2);
  const playerAccepted = proposal.acceptance >= 2.55 || (proposal.acceptance >= 2.25 && proposal.newContract?.salaryIndex >= numberOr(proposal.currentContract?.salaryIndex, 0) * 1.04);
  const logs = [
    `初回提示 ${formatNumber(initialOffer, 0)} / 要求 ${formatNumber(asking, 0)}`,
  ];

  let status = "rejected";
  let finalOffer = initialOffer;
  let probability = clampNumber((proposal.score - 2.6) / 4.4, 0.05, 0.86);
  logs[0] = `初回提示 ${formatNumber(initialOffer, 0)} / 要求 ${formatNumber(asking, 0)}`;

  if (initialOffer >= sellerFloor && playerAccepted) {
    status = competitorCount ? "competing" : "agreed";
    finalOffer = initialOffer;
    logs.push("初回提示を受諾");
  } else if (hardLimit < sellerFloor * 0.86) {
    status = "withdrawn";
    finalOffer = initialOffer;
    probability *= 0.45;
    logs.push("要求額に届かず撤退");
  } else {
    logs.push(`売り手が拒否、要求を ${formatNumber(sellerFloor, 0)} 付近へ調整`);
    if (counterOffer >= sellerFloor && playerAccepted) {
      status = competitorCount ? "competing" : "agreed";
      finalOffer = counterOffer;
      probability += 0.16;
      logs.push(`増額提示 ${formatNumber(counterOffer, 0)} で合意圏`);
    } else if (deadlineOffer >= sellerFloor * 0.96 && playerAccepted && proposal.sellability >= 2.4) {
      status = "deadline";
      finalOffer = deadlineOffer;
      probability += 0.08;
      logs.push(`市場終盤に ${formatNumber(deadlineOffer, 0)} で妥協余地`);
    } else {
      status = hardLimit >= sellerFloor * 0.9 ? "rejected" : "withdrawn";
      finalOffer = counterOffer;
      probability *= status === "withdrawn" ? 0.55 : 0.72;
      logs.push(status === "withdrawn" ? "買い手が撤退" : "条件差が残り拒否");
    }
  }

  if (competitorCount) {
    logs.push(`${competitorCount}クラブが競合`);
    probability -= Math.min(0.16, competitorCount * 0.05);
  }
  if (!playerAccepted) {
    logs.push("選手側の受諾度が不足");
    probability *= 0.5;
  }
  const readableLogs = [
    `初回提示 ${formatNumber(initialOffer, 0)} / 要求 ${formatNumber(asking, 0)}`,
  ];
  if (finalOffer > initialOffer) readableLogs.push(`増額提示 ${formatNumber(finalOffer, 0)}`);
  if (competitorCount) readableLogs.push(`${competitorCount}クラブが競合`);
  if (!playerAccepted) readableLogs.push("選手側の受諾度が不足");
  if (status === "deadline") readableLogs.push("市場終盤に妥協");
  else if (status === "withdrawn") readableLogs.push("買い手が撤退");
  else if (status === "rejected") readableLogs.push("条件差が残り拒否");
  else readableLogs.push(status === "competing" ? "競合を制して合意圏" : "合意圏");

  return {
    ...proposal,
    askingPrice: asking,
    initialOffer,
    counterOffer,
    finalOffer,
    hardLimit,
    competitorCount,
    negotiationStatus: status,
    negotiationLabel: negotiationStageLabel(status),
    negotiationProbability: roundNumber(clampNumber(probability, 0.03, 0.94), 2),
    negotiationLogs: readableLogs,
    reasons: [
      ...(proposal.reasons || []),
      `新契約${proposal.newContract?.years || "-"}年・年俸${formatNumber(proposal.newContract?.salaryIndex || 0, 0)}`,
    ],
  };
}

function buildTransferProposals(world, teams, needs, candidates, options = {}) {
  const allowCompetition = Boolean(options.allowCompetition);
  const proposalLimit = Number(options.proposalLimit || 20);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const marketTeams = (world.teams || []).filter((team) => !team.competitionOnly);
  const allTeamsById = new Map(marketTeams.map((team) => [team.id, team]));
  const alreadyMovedPlayers = new Set((world.transferMarket?.transfers || []).map((row) => row.playerId));
  const virtualTeams = new Map(marketTeams.map((team) => {
    const requirements = teamTransferRequirements(team);
    const counts = Object.fromEntries(transferPositionGroups.map((group) => [
      group.key,
      (team.team?.players || []).filter((player) => transferGroupForPosition(player.bestPosition).key === group.key).length,
    ]));
    return [team.id, {
      counts,
      requirements,
      budget: transferBudgetIndex(world, team),
      in: 0,
      out: 0,
      groupIn: Object.fromEntries(transferPositionGroups.map((group) => [group.key, 0])),
    }];
  }));
  const candidateRows = candidates
    .map((candidate) => ({
      ...candidate,
      team: allTeamsById.get(candidate.teamId),
      player: allTeamsById.get(candidate.teamId)?.team?.players?.find((player) => player.id === candidate.playerId),
    }))
    .filter((candidate) => candidate.team && candidate.player);
  const rawProposals = [];

  for (const need of needs.slice(0, 20)) {
    const buyer = teamsById.get(need.teamId);
    if (!buyer) continue;
    const buyerRequirement = teamTransferRequirements(buyer)[need.groupKey];
    const budget = transferBudgetIndex(world, buyer);
    const targets = candidateRows
      .filter((candidate) => candidate.team.id !== buyer.id && candidate.groupKey === need.groupKey)
      .slice(0, 36);

    for (const candidate of targets) {
      const seller = candidate.team;
      const player = candidate.player;
      const currentContract = playerContract(world, seller, player);
      const value = playerMarketValueIndex(player, worldLeagueForTeam(world, seller), currentContract);
      const affordability = clampNumber((budget - value) / Math.max(1, value) + 1, 0, 1.8);
      const acceptance = destinationAcceptanceScore(world, buyer, seller, player, need, buyerRequirement);
      const sellerRequirements = teamTransferRequirements(seller);
      const sellerGroupMap = playerTransferGroupMap(seller);
      const sellerAverage = teamAverageRating(seller.team?.players || []);
      const sellerState = world.playerStates?.[seller.id]?.[player.id] || {};
      const sellerMinutesRate = playerMinutesRate(world, seller.id, sellerState);
      const sellability = sellabilityScore(world, seller, player, sellerGroupMap, sellerRequirements[need.groupKey], sellerMinutesRate, sellerAverage, currentContract);
      const newContract = proposedContractForTransfer(player, currentContract, buyer);
      const score = need.priority * 0.28 + candidate.score * 0.34 + acceptance * 0.30 + sellability * 0.24 + affordability * 0.82;

      if (score >= 2.85) {
        rawProposals.push({
          buyerId: buyer.id,
          buyer: buyer.name,
          sellerId: seller.id,
          seller: seller.name,
          playerId: player.id,
          player: player.fullName || player.name,
          position: player.bestPosition,
          age: numberOr(player.age, 24),
          rating: numberOr(player.rating, 0),
          group: need.group,
          groupKey: need.groupKey,
          value,
          budget,
          currentContract,
          newContract,
          acceptance,
          sellability,
          score,
          reasons: [
            need.reason,
            ...(candidate.reasons || []).slice(0, 2),
          ].filter(Boolean),
        });
      }
    }
  }

  rawProposals.push(...buildFreeAgentProposals(world, teamsById, needs, alreadyMovedPlayers));
  rawProposals.push(...buildLoanProposals(world, teamsById, needs, candidates, alreadyMovedPlayers));

  const selected = [];
  const movedPlayers = new Set();
  const sorted = rawProposals.sort((a, b) => b.score - a.score || b.acceptance - a.acceptance || b.rating - a.rating);

  for (const proposal of sorted) {
    if (selected.length >= proposalLimit) break;
    if (!allowCompetition && movedPlayers.has(proposal.playerId)) continue;
    const buyerState = virtualTeams.get(proposal.buyerId);
    const sellerState = proposal.sellerId ? virtualTeams.get(proposal.sellerId) : null;
    if (!buyerState || (proposal.sellerId && !sellerState)) continue;
    if (buyerState.in >= 3 || sellerState?.out >= 3) continue;

    const buyerRequirement = buyerState.requirements[proposal.groupKey];
    const buyerCount = buyerState.counts[proposal.groupKey] || 0;
    const buyerMin = buyerRequirement?.min || 0;
    const buyerDeficit = buyerMin - buyerCount;
    const alreadyFilledGroup = buyerState.groupIn[proposal.groupKey] || 0;

    if (buyerDeficit <= 0 && alreadyFilledGroup >= 1) continue;
    if (sellerState) {
      const sellerRequirement = sellerState.requirements[proposal.groupKey];
      const sellerCount = sellerState.counts[proposal.groupKey] || 0;
      const sellerMin = sellerRequirement?.min || 0;
      if (sellerCount <= sellerMin && proposal.sellability < 3.2) continue;
      sellerState.counts[proposal.groupKey] = Math.max(0, sellerCount - 1);
      sellerState.out += 1;
    }
    if (buyerState.budget < proposal.value * 0.65) continue;

    buyerState.counts[proposal.groupKey] = buyerCount + 1;
    buyerState.budget = Math.max(0, buyerState.budget - proposal.value);
    buyerState.in += 1;
    buyerState.groupIn[proposal.groupKey] = alreadyFilledGroup + 1;
    if (!allowCompetition) movedPlayers.add(proposal.playerId);

    selected.push({
      ...proposal,
      remainingNeed: Math.max(0, buyerMin - buyerState.counts[proposal.groupKey]),
    });
  }

  return selected
    .map((proposal) => simulateNegotiation(world, proposal, rawProposals))
    .sort((a, b) => {
      const rank = { agreed: 5, deadline: 4, competing: 3, rejected: 2, withdrawn: 1 };
      return (rank[b.negotiationStatus] || 0) - (rank[a.negotiationStatus] || 0) ||
        b.negotiationProbability - a.negotiationProbability ||
        b.score - a.score;
    });
}

function transferMarketReport(world, leagueId = "all", options = {}) {
  const teams = (world.teams || []).filter((team) => !team.competitionOnly && (leagueId === "all" || team.leagueId === leagueId));
  const needs = [];
  const candidates = [];

  for (const team of teams) {
    const players = team.team?.players || [];
    const states = world.playerStates?.[team.id] || {};
    const average = teamAverageRating(players);
    const groupMap = Object.fromEntries(transferPositionGroups.map((group) => [group.key, []]));
    const requirements = teamTransferRequirements(team);

    for (const player of players) {
      const group = transferGroupForPosition(player.bestPosition);
      groupMap[group.key].push(player);
    }

    for (const player of players) {
      const group = transferGroupForPosition(player.bestPosition);
      const requirement = requirements[group.key] || group;
      const state = states[player.id] || {};
      const contract = state.contract || null;
      const minutesRate = playerMinutesRate(world, team.id, state);
      const age = numberOr(player.age, 24);
      const rating = numberOr(player.rating, 0);
      let score = 0;
      const reasons = [];

      if (age <= 23 && minutesRate < 0.28 && rating >= average - 4) {
        score += 3.2;
        reasons.push("若手・出場機会不足");
      }
      if (age >= 24 && age <= 31 && minutesRate < 0.16 && rating >= average - 2) {
        score += 2.2;
        reasons.push("序列停滞");
      }
      if (age >= 24 && age <= 30 && minutesRate < 0.42 && rating >= average - 1) {
        score += 0.75;
        reasons.push("キャリア上昇余地");
      }
      if (age >= 32 && minutesRate < 0.18) {
        score += 1.4;
        reasons.push("ベテラン出場機会");
      }
      if ((groupMap[group.key] || []).length > requirement.min + 1 && minutesRate < 0.35) {
        score += 1.1;
        reasons.push(`${group.label}過多`);
      }
      const ambition = ambitionTransferAssessment(world, team, player, rating, minutesRate, average);
      if (ambition.score > 0) {
        score += ambition.score;
        reasons.push(...ambition.reasons);
      }
      if (contract?.years === 0) {
        score += 2.0;
        reasons.push("契約満了");
      } else if (contract?.years === 1) {
        score += 1.1;
        reasons.push("契約残り1年");
      }
      if (contract?.salaryIndex && Number(contract.salaryIndex) > rating * 1.05) {
        score += 0.6;
        reasons.push("高年俸整理候補");
      }
      if (state.injury?.daysRemaining > 0) {
        score -= 0.7;
        reasons.push("負傷中");
      }

      if (score > 0.9) {
        candidates.push({
          team: team.name,
          teamId: team.id,
          playerId: player.id,
          player: player.fullName || player.name,
          age,
          rating,
          position: player.bestPosition,
          groupKey: group.key,
          minutesRate,
          score,
          reasons,
        });
      }
    }

    for (const group of transferPositionGroups) {
      const groupPlayers = groupMap[group.key] || [];
      const requirement = requirements[group.key] || group;
      const groupAverage = teamAverageRating(groupPlayers);
      const countNeed = Math.max(0, requirement.min - groupPlayers.length);
      const qualityNeed = groupPlayers.length ? Math.max(0, average - groupAverage - 2.2) : 4;
      const priority = countNeed * 2.4 + qualityNeed;
      if (priority > 1.2) {
        needs.push({
          team: team.name,
          teamId: team.id,
          group: group.label,
          groupKey: group.key,
          formation: requirement.formationLabel,
          count: groupPlayers.length,
          min: requirement.min,
          average: groupAverage,
          teamAverage: average,
          priority,
          reason: countNeed ? "人数不足" : "質の底上げ",
        });
      }
    }
  }

  const sortedNeeds = needs.sort((a, b) => b.priority - a.priority);
  const sortedCandidates = candidates.sort((a, b) => b.score - a.score || b.rating - a.rating);

  return {
    needs: sortedNeeds.slice(0, 10),
    candidates: sortedCandidates.slice(0, 12),
    proposals: buildTransferProposals(world, teams, sortedNeeds, sortedCandidates.slice(0, 80), options),
  };
}

function recalculateWorldLevels(world) {
  for (const team of (world.teams || []).filter((item) => !item.competitionOnly)) {
    const previousFinance = team.finance || null;
    const previousSpent = previousFinance
      ? numberOr(previousFinance.transferBudgetIndex, 0) - numberOr(previousFinance.remainingTransferBudgetIndex, previousFinance.transferBudgetIndex)
      : 0;
    team.teamLevel = roundNumber(worldTeamStrength({ ...team, teamLevel: undefined }), 2);
    const nextFinance = financeFromTeamLevel(world, team);
    team.finance = {
      ...nextFinance,
      remainingTransferBudgetIndex: roundNumber(Math.max(0, nextFinance.transferBudgetIndex - Math.max(0, previousSpent)), 2),
    };
  }
  for (const league of world.leagues || []) {
    const levels = (league.teamIds || [])
      .map((teamId) => world.teams.find((team) => team.id === teamId)?.teamLevel)
      .filter((level) => Number.isFinite(Number(level)))
      .sort((a, b) => b - a);
    if (!levels.length) continue;
    const topCount = Math.max(1, Math.ceil(levels.length * 0.25));
    const upperCount = Math.max(1, Math.ceil(levels.length * 0.5));
    const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    league.leagueLevel = roundNumber(average(levels.slice(0, topCount)) * 0.45 + average(levels.slice(0, upperCount)) * 0.30 + average(levels) * 0.25, 2);
  }
}

function transferFinalizeRoll(world, proposal, index) {
  return seededUnit(`${world.id || world.seed || "world"}:${proposal.buyerId}:${proposal.sellerId}:${proposal.playerId}:final:${index}`);
}

function canFinalizeTransfer(world, proposal, index) {
  if (!["agreed", "deadline", "competing"].includes(proposal.negotiationStatus)) return false;
  const threshold = proposal.negotiationStatus === "agreed" ? 0.28
    : proposal.negotiationStatus === "deadline" ? 0.40
      : 0.54;
  return proposal.negotiationProbability >= threshold && transferFinalizeRoll(world, proposal, index) <= proposal.negotiationProbability;
}

function ensureTransferMarket(world) {
  world.transferMarket = world.transferMarket || {};
  world.transferMarket.transfers = world.transferMarket.transfers || [];
  world.transferMarket.freeAgents = world.transferMarket.freeAgents || [];
  world.transferMarket.releasedPlayers = world.transferMarket.releasedPlayers || [];
  return world.transferMarket;
}

function releaseExpiredPlayersToFreeAgency(world) {
  const market = ensureTransferMarket(world);
  if (market.expiredReleased) return [];
  const released = [];

  for (const team of (world.teams || []).filter((item) => !item.competitionOnly)) {
    const states = world.playerStates?.[team.id] || {};
    const keepPlayers = [];
    for (const player of team.team?.players || []) {
      const state = states[player.id] || {};
      const contract = state.contract || {};
      if (Number(contract.years ?? 99) <= 0 || contract.status === "expired") {
        const row = {
          playerId: player.id,
          player: player.fullName || player.name,
          age: numberOr(player.age, 24),
          position: player.bestPosition,
          rating: numberOr(player.rating, 0),
          fromTeamId: team.id,
          fromTeam: team.name,
          leagueId: team.leagueId,
          contract,
          state,
          playerData: {
            ...player,
            contract: undefined,
            freeAgent: {
              releasedSeason: world.season?.label,
              fromTeamId: team.id,
              fromTeam: team.name,
            },
          },
        };
        released.push(row);
        delete states[player.id];
      } else {
        keepPlayers.push(player);
      }
    }
    team.team.players = keepPlayers;
    world.playerStates[team.id] = states;
  }

  market.freeAgents = [...(market.freeAgents || []), ...released];
  market.releasedPlayers = [...(market.releasedPlayers || []), ...released.map(({ playerData, state, ...row }) => row)];
  market.expiredReleased = true;
  if (released.length) recalculateWorldLevels(world);
  return released;
}

function freeAgentDestinationAcceptance(world, buyer, freeAgent, need) {
  const buyerLeague = worldLeagueForTeam(world, buyer);
  const rating = numberOr(freeAgent.rating, 0);
  let score = 1.75;
  score += clampNumber((worldTeamStrength(buyer) - rating) * 0.08, -0.4, 0.7);
  score += clampNumber(leagueMarketLevel(buyerLeague) / 100, 0.25, 1.0);
  if (need?.priority) score += Math.min(1.2, need.priority * 0.15);
  if (rating >= teamAverageRating(buyer.team?.players || []) - 2) score += 0.35;
  return clampNumber(score, 0, 5);
}

function buildFreeAgentProposals(world, teamsById, needs, blockedPlayers) {
  const market = ensureTransferMarket(world);
  const proposals = [];
  for (const need of needs.slice(0, 16)) {
    const buyer = teamsById.get(need.teamId);
    if (!buyer) continue;
    const budget = transferBudgetIndex(world, buyer);
    const targets = (market.freeAgents || [])
      .filter((freeAgent) => !blockedPlayers.has(freeAgent.playerId) && freeAgent.groupKey !== false)
      .map((freeAgent) => ({
        ...freeAgent,
        groupKey: transferGroupForPosition(freeAgent.position).key,
      }))
      .filter((freeAgent) => freeAgent.groupKey === need.groupKey)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 12);

    for (const freeAgent of targets) {
      const player = freeAgent.playerData;
      if (!player) continue;
      const newContract = proposedContractForFreeAgent(player, freeAgent.contract, buyer);
      const signingFee = roundNumber(Math.max(0, numberOr(newContract.salaryIndex, 0) * 0.18), 2);
      const acceptance = freeAgentDestinationAcceptance(world, buyer, freeAgent, need);
      const affordability = clampNumber((budget - signingFee) / Math.max(1, signingFee) + 1, 0, 2.2);
      const score = need.priority * 0.24 + freeAgent.rating * 0.018 + acceptance * 0.46 + affordability * 0.68;
      proposals.push({
        type: "free-agent",
        buyerId: buyer.id,
        buyer: buyer.name,
        sellerId: null,
        seller: "自由契約",
        playerId: freeAgent.playerId,
        player: freeAgent.player,
        position: freeAgent.position,
        age: freeAgent.age,
        rating: freeAgent.rating,
        group: need.group,
        groupKey: need.groupKey,
        value: signingFee,
        budget,
        currentContract: freeAgent.contract,
        newContract,
        acceptance,
        sellability: 5,
        score,
        freeAgent,
        reasons: [need.reason, "契約満了フリー"].filter(Boolean),
      });
    }
  }
  return proposals;
}

function buildLoanProposals(world, teamsById, needs, candidates, blockedPlayers) {
  const proposals = [];
  for (const need of needs.slice(0, 16)) {
    const buyer = teamsById.get(need.teamId);
    if (!buyer) continue;
    const budget = transferBudgetIndex(world, buyer);
    const targets = candidates
      .filter((candidate) => !blockedPlayers.has(candidate.playerId) && candidate.teamId !== buyer.id && candidate.groupKey === need.groupKey)
      .slice(0, 24);

    for (const candidate of targets) {
      const seller = transferWorldTeamById(world, candidate.teamId);
      const player = seller?.team?.players?.find((item) => item.id === candidate.playerId);
      if (!seller || !player) continue;
      const age = numberOr(player.age, 24);
      const sellerState = world.playerStates?.[seller.id]?.[player.id] || {};
      const minutesRate = playerMinutesRate(world, seller.id, sellerState);
      const sellerRequirements = teamTransferRequirements(seller);
      const group = transferGroupForPosition(player.bestPosition);
      const sellerGroupCount = (seller.team?.players || []).filter((item) => transferGroupForPosition(item.bestPosition).key === group.key).length;
      const sellerMin = sellerRequirements[group.key]?.min || 0;
      if (!(age <= 23 || minutesRate < 0.22)) continue;
      if (sellerGroupCount <= sellerMin && minutesRate >= 0.18) continue;

      const currentContract = playerContract(world, seller, player);
      const terms = proposedLoanTerms(player, currentContract, buyer);
      const loanFee = roundNumber(Math.max(2, numberOr(player.rating, 60) * 0.08 + numberOr(terms.salaryIndex, 0) * 0.28), 2);
      const acceptance = destinationAcceptanceScore(world, buyer, seller, player, need, teamTransferRequirements(buyer)[need.groupKey]) + (age <= 23 ? 0.45 : 0);
      const affordability = clampNumber((budget - loanFee) / Math.max(1, loanFee) + 1, 0, 2);
      const score = need.priority * 0.26 + candidate.score * 0.18 + acceptance * 0.34 + affordability * 0.55;
      if (score < 2.75) continue;
      proposals.push({
        type: "loan",
        buyerId: buyer.id,
        buyer: buyer.name,
        sellerId: seller.id,
        seller: seller.name,
        playerId: player.id,
        player: player.fullName || player.name,
        position: player.bestPosition,
        age,
        rating: numberOr(player.rating, 0),
        group: need.group,
        groupKey: need.groupKey,
        value: loanFee,
        budget,
        currentContract,
        newContract: terms,
        acceptance,
        sellability: 3.8,
        score,
        reasons: [need.reason, age <= 23 ? "若手レンタル" : "出場機会レンタル"].filter(Boolean),
      });
    }
  }
  return proposals;
}

function applyFinalizedTransfer(world, proposal, index) {
  if (proposal.type === "free-agent") {
    const buyer = world.teams.find((team) => team.id === proposal.buyerId);
    if (!buyer || !proposal.freeAgent?.playerData) return null;
    const market = ensureTransferMarket(world);
    const player = {
      ...proposal.freeAgent.playerData,
      freeAgent: undefined,
      transferHistory: [
        ...(Array.isArray(proposal.freeAgent.playerData.transferHistory) ? proposal.freeAgent.playerData.transferHistory.slice(-4) : []),
        {
          season: world.season?.label,
          fromTeam: proposal.freeAgent.fromTeam || "自由契約",
          toTeam: buyer.name,
          value: proposal.finalOffer,
          status: "free-agent",
        },
      ],
    };
    buyer.team.players.push(player);
    const buyerStates = world.playerStates?.[buyer.id] || {};
    buyerStates[player.id] = {
      ...(proposal.freeAgent.state || {}),
      seasonTeamName: proposal.freeAgent.fromTeam,
      contract: {
        ...(proposal.newContract || {}),
        status: "free-agent-new",
      },
    };
    world.playerStates[buyer.id] = buyerStates;
    market.freeAgents = (market.freeAgents || []).filter((freeAgent) => freeAgent.playerId !== proposal.playerId);
    const record = {
      index: index + 1,
      type: "free-agent",
      season: world.season?.label,
      playerId: player.id,
      player: player.fullName || player.name,
      age: proposal.age,
      position: proposal.position,
      rating: proposal.rating,
      fromTeamId: proposal.freeAgent.fromTeamId || null,
      fromTeam: proposal.freeAgent.fromTeam || "自由契約",
      toTeamId: buyer.id,
      toTeam: buyer.name,
      value: proposal.finalOffer,
      askingPrice: proposal.askingPrice,
      initialOffer: proposal.initialOffer,
      status: "free-agent",
      probability: proposal.negotiationProbability,
      contract: proposal.newContract,
      logs: proposal.negotiationLogs || [],
    };
    market.transfers = [...(market.transfers || []), record];
    market.updatedAt = new Date().toISOString();
    applyTransferBudgetMovement(world, buyer, null, proposal.finalOffer, "free-agent");
    recalculateWorldLevels(world);
    return record;
  }

  const seller = world.teams.find((team) => team.id === proposal.sellerId);
  const buyer = world.teams.find((team) => team.id === proposal.buyerId);
  if (!seller || !buyer) return null;
  const playerIndex = (seller.team?.players || []).findIndex((player) => player.id === proposal.playerId);
  if (playerIndex < 0) return null;
  if ((seller.team.players || []).length <= 7) return null;

  const [player] = seller.team.players.splice(playerIndex, 1);
  const finalStatus = proposal.negotiationStatus === "competing" ? "won_competition" : proposal.negotiationStatus;
  const movedPlayer = {
    ...player,
    transferHistory: [
      ...(Array.isArray(player.transferHistory) ? player.transferHistory.slice(-4) : []),
      {
        season: world.season?.label,
        fromTeam: seller.name,
        toTeam: buyer.name,
        value: proposal.finalOffer,
        status: proposal.type === "loan" ? "loan" : finalStatus,
      },
    ],
    loan: proposal.type === "loan" ? {
      parentTeamId: seller.id,
      parentTeam: seller.name,
      loanTeamId: buyer.id,
      loanTeam: buyer.name,
      season: world.season?.label,
      endsAfterSeason: true,
    } : player.loan,
  };
  buyer.team.players.push(movedPlayer);

  const sellerStates = world.playerStates?.[seller.id] || {};
  const buyerStates = world.playerStates?.[buyer.id] || {};
  const playerState = sellerStates[player.id] || {};
  delete sellerStates[player.id];
  buyerStates[player.id] = {
    ...playerState,
    seasonTeamName: proposal.type === "loan" ? buyer.name : seller.name,
    contract: {
      ...(playerState.contract || {}),
      ...(proposal.newContract || {}),
      status: proposal.type === "loan" ? "loan" : "transfer-new",
    },
  };
  world.playerStates[seller.id] = sellerStates;
  world.playerStates[buyer.id] = buyerStates;

  const record = {
    index: index + 1,
    type: proposal.type === "loan" ? "loan" : "transfer",
    season: world.season?.label,
    playerId: player.id,
    player: player.fullName || player.name,
    age: proposal.age,
    position: proposal.position,
    rating: proposal.rating,
    fromTeamId: seller.id,
    fromTeam: seller.name,
    toTeamId: buyer.id,
    toTeam: buyer.name,
    value: proposal.finalOffer,
    askingPrice: proposal.askingPrice,
    initialOffer: proposal.initialOffer,
    status: proposal.type === "loan" ? "loan" : finalStatus,
    probability: proposal.negotiationProbability,
    contract: proposal.newContract,
    logs: proposal.negotiationLogs || [],
  };

  world.transferMarket = world.transferMarket || { transfers: [] };
  world.transferMarket.transfers = [...(world.transferMarket.transfers || []), record];
  world.transferMarket.updatedAt = new Date().toISOString();
  applyTransferBudgetMovement(world, buyer, seller, proposal.finalOffer, proposal.type === "loan" ? "loan" : "transfer");
  recalculateWorldLevels(world);
  return record;
}

function transferMarketDayPhase(day, totalDays, teamCount = 0) {
  const rate = day / Math.max(1, totalDays);
  // チーム数に応じて1日あたりの最大オファー数をスケールさせる。
  // 大規模ワールド(100チーム以上)では候補も多いため、処理量を増やす。
  const scale = Math.max(1, Math.ceil(teamCount / 24));
  if (rate >= 0.84) return { key: "deadline", label: "終盤", pressure: 0.34, offerMultiplier: 1.08, maxDailyOffers: 18 * scale };
  if (rate >= 0.5) return { key: "middle", label: "中盤", pressure: 0.18, offerMultiplier: 1.02, maxDailyOffers: 14 * scale };
  return { key: "early", label: "序盤", pressure: 0.02, offerMultiplier: 0.96, maxDailyOffers: 10 * scale };
}

function transferOfferKey(offer) {
  return `${offer.playerId}:${offer.buyerId}:${offer.type || "transfer"}`;
}

function marketOfferFromProposal(world, proposal, day, totalDays, offerIndex) {
  const phase = transferMarketDayPhase(day, totalDays);
  const daySeed = `${world.id || world.seed || "world"}:market:${day}:${proposal.playerId}:${proposal.buyerId}:${offerIndex}`;
  const urgency = phase.pressure + seededUnit(`${daySeed}:urgency`) * 0.08;
  const finalOffer = roundNumber(Math.min(
    proposal.budget || proposal.finalOffer,
    numberOr(proposal.finalOffer, proposal.value) * phase.offerMultiplier * (0.98 + urgency),
  ), 2);
  const probability = roundNumber(clampNumber(numberOr(proposal.negotiationProbability, 0.4) + phase.pressure * 0.55 + urgency * 0.28, 0.04, 0.96), 2);
  return {
    ...proposal,
    offerId: `${day}-${offerIndex}-${proposal.playerId}-${proposal.buyerId}`,
    marketDay: day,
    phase: phase.key,
    finalOffer,
    negotiationProbability: probability,
    status: "active",
    expiresDay: Math.min(totalDays, day + (phase.key === "deadline" ? 1 : 3)),
    negotiationLogs: [
      ...(proposal.negotiationLogs || []),
      `${phase.label}${day}日目: 正式オファー ${formatNumber(finalOffer, 0)}`,
    ],
  };
}

function mergeActiveMarketOffers(activeOffers, newOffers) {
  const byKey = new Map();
  for (const offer of [...activeOffers, ...newOffers]) {
    if (offer.status && offer.status !== "active") continue;
    const key = transferOfferKey(offer);
    const current = byKey.get(key);
    if (!current || numberOr(offer.finalOffer, 0) > numberOr(current.finalOffer, 0) || numberOr(offer.negotiationProbability, 0) > numberOr(current.negotiationProbability, 0)) {
      byKey.set(key, offer);
    }
  }
  return [...byKey.values()];
}

function playerChoiceScoreForOffer(world, offer, day, totalDays) {
  const buyer = transferWorldTeamById(world, offer.buyerId);
  const seller = offer.sellerId ? transferWorldTeamById(world, offer.sellerId) : null;
  const buyerLeague = worldLeagueForTeam(world, buyer);
  const sellerLeague = seller ? worldLeagueForTeam(world, seller) : null;
  const salary = numberOr(offer.newContract?.salaryIndex, 0);
  const currentSalary = numberOr(offer.currentContract?.salaryIndex, salary * 0.9);
  const strengthGain = worldTeamStrength(buyer || {}) - (seller ? worldTeamStrength(seller) : numberOr(offer.rating, 60));
  const leagueGain = leagueMarketLevel(buyerLeague) - leagueMarketLevel(sellerLeague);
  const needBonus = clampNumber(numberOr(offer.score, 0) * 0.08, 0, 0.55);
  const typeBonus = offer.type === "loan" ? 0.22 : offer.type === "free-agent" ? 0.18 : 0;
  const deadlinePressure = transferMarketDayPhase(day, totalDays).pressure * 0.65;
  return roundNumber(
    numberOr(offer.acceptance, 0) * 0.54 +
    clampNumber((salary - currentSalary) / Math.max(1, currentSalary) * 1.4, -0.35, 0.8) +
    clampNumber(strengthGain * 0.08, -0.45, 0.95) +
    clampNumber(leagueGain * 0.025, -0.35, 0.65) +
    needBonus +
    typeBonus +
    deadlinePressure,
    3,
  );
}

function sellerChoiceScoreForOffer(world, offer, day, totalDays) {
  if (offer.type === "free-agent") return numberOr(offer.negotiationProbability, 0) + numberOr(offer.finalOffer, 0) * 0.01;
  const feeRatio = numberOr(offer.finalOffer, 0) / Math.max(1, numberOr(offer.askingPrice, offer.value));
  const sellability = numberOr(offer.sellability, 0);
  const pressure = transferMarketDayPhase(day, totalDays).pressure;
  const loanBonus = offer.type === "loan" ? 0.32 : 0;
  return roundNumber(feeRatio * 1.3 + sellability * 0.3 + pressure + loanBonus, 3);
}

function winningOfferForPlayer(world, offers, day, totalDays) {
  return [...offers]
    .map((offer) => ({
      ...offer,
      playerChoiceScore: playerChoiceScoreForOffer(world, offer, day, totalDays),
      sellerChoiceScore: sellerChoiceScoreForOffer(world, offer, day, totalDays),
    }))
    .sort((a, b) =>
      (b.playerChoiceScore + b.sellerChoiceScore) - (a.playerChoiceScore + a.sellerChoiceScore) ||
      numberOr(b.finalOffer, 0) - numberOr(a.finalOffer, 0) ||
      numberOr(b.negotiationProbability, 0) - numberOr(a.negotiationProbability, 0))[0];
}

function resolveTransferMarketDay(world, market, day, totalDays, blockedPlayers, completed, maxTransfers) {
  const unresolved = [];
  const grouped = new Map();
  for (const offer of market.activeOffers || []) {
    if (blockedPlayers.has(offer.playerId)) continue;
    if (offer.expiresDay < day) {
      market.offerHistory.push({
        day,
        offerId: offer.offerId,
        playerId: offer.playerId,
        player: offer.player,
        buyer: offer.buyer,
        seller: offer.seller,
        type: offer.type || "transfer",
        status: "expired",
      });
      continue;
    }
    if (!grouped.has(offer.playerId)) grouped.set(offer.playerId, []);
    grouped.get(offer.playerId).push(offer);
  }

  let dealsToday = 0;
  for (const offers of grouped.values()) {
    if (completed.length >= maxTransfers) {
      unresolved.push(...offers);
      continue;
    }
    const best = winningOfferForPlayer(world, offers, day, totalDays);
    const phase = transferMarketDayPhase(day, totalDays);
    const competingBonus = Math.min(0.18, (offers.length - 1) * 0.055);
    const deadlineDecision = best.expiresDay <= day || phase.key === "deadline";
    const readiness = clampNumber(numberOr(best.negotiationProbability, 0) * 0.52 + phase.pressure + competingBonus + (deadlineDecision ? 0.18 : 0), 0, 0.96);
    const roll = seededUnit(`${world.id || world.seed}:market:${day}:${best.playerId}:decision`);
    if (roll > readiness) {
      unresolved.push(...offers.map((offer) => ({
        ...offer,
        negotiationLogs: [...(offer.negotiationLogs || []), `${day}日目: 判断保留`],
      })));
      continue;
    }

    const resolvedOffer = {
      ...best,
      negotiationStatus: offers.length > 1 ? "competing" : best.negotiationStatus,
      negotiationLabel: offers.length > 1 ? "競合勝利" : best.negotiationLabel,
      negotiationLogs: [
        ...(best.negotiationLogs || []),
        offers.length > 1 ? `${day}日目: ${offers.length}件の競合から選択` : `${day}日目: 条件合意`,
      ],
    };
    const record = applyFinalizedTransfer(world, resolvedOffer, completed.length);
    if (!record) {
      market.offerHistory.push({
        day,
        offerId: best.offerId,
        playerId: best.playerId,
        player: best.player,
        buyer: best.buyer,
        seller: best.seller,
        type: best.type || "transfer",
        status: "failed-finalize",
      });
      blockedPlayers.add(best.playerId);
      continue;
    }

    record.marketDay = day;
    record.competitorCount = Math.max(0, offers.length - 1);
    completed.push(record);
    blockedPlayers.add(record.playerId);
    dealsToday += 1;
    for (const offer of offers) {
      market.offerHistory.push({
        day,
        offerId: offer.offerId,
        playerId: offer.playerId,
        player: offer.player,
        buyer: offer.buyer,
        seller: offer.seller,
        type: offer.type || "transfer",
        value: offer.finalOffer,
        status: offer.offerId === best.offerId ? "accepted" : "lost-competition",
      });
    }
  }

  market.activeOffers = unresolved;
  return dealsToday;
}

async function runTransferMarket() {
  try {
    if (!state.world) throw new Error("ワールドがありません。");
    if (!state.world.completed) throw new Error("移籍市場はシーズン終了後に実行してください。");
    setBusy(true);
    const world = JSON.parse(JSON.stringify(state.world));
    const released = releaseExpiredPlayersToFreeAgency(world);
    const market = ensureTransferMarket(world);
    const regularTeamCountForDays = (world.teams || []).filter((team) => !team.competitionOnly).length;
    // 市場日数もチーム規模に合わせて延長する。大規模ワールドでは1日あたりの
    // オファー処理だけでは目標成立件数に届かないため、日数を増やす。
    const marketDays = Math.min(90, Math.max(30, Math.ceil(regularTeamCountForDays * 0.6)));
    market.days = { total: marketDays, current: 0 };
    market.dailyLogs = [];
    market.offerHistory = market.offerHistory || [];
    market.activeOffers = [];
    const regularTeamCount = (world.teams || []).filter((team) => !team.competitionOnly).length;
    // 移籍成立件数の上限。チーム数に比例させ、大規模ワールド(100チーム以上)でも
    // 十分な件数の移籍が成立するようにする。以前は Math.min(34, ...) で
    // 34件に固定されており、チーム数が増えても移籍がほとんど起きなかった。
    const maxTransfers = Math.max(10, Math.ceil(regularTeamCount * 0.9));
    const completed = [];
    const blockedPlayers = new Set((world.transferMarket?.transfers || []).map((row) => row.playerId));

    for (let day = 1; day <= market.days.total && completed.length < maxTransfers; day += 1) {
      market.days.current = day;
      const phase = transferMarketDayPhase(day, market.days.total, regularTeamCount);
      const report = transferMarketReport(world, "all", { allowCompetition: true, proposalLimit: Math.max(24, phase.maxDailyOffers * 3) });
      const alreadyActive = new Set((market.activeOffers || []).map(transferOfferKey));
      const newOffers = (report.proposals || [])
        .filter((proposal) => !blockedPlayers.has(proposal.playerId))
        .filter((proposal) => !alreadyActive.has(transferOfferKey(proposal)))
        .slice(0, phase.maxDailyOffers)
        .map((proposal, offerIndex) => marketOfferFromProposal(world, proposal, day, market.days.total, offerIndex));

      market.activeOffers = mergeActiveMarketOffers(market.activeOffers || [], newOffers);
      const dealsToday = resolveTransferMarketDay(world, market, day, market.days.total, blockedPlayers, completed, maxTransfers);
      market.dailyLogs.push({
        day,
        phase: phase.key,
        offersCreated: newOffers.length,
        activeOffers: market.activeOffers.length,
        deals: dealsToday,
        needs: report.needs.length,
        candidates: report.candidates.length,
      });

      setStatus(`移籍市場 ${day}/${market.days.total}日目... 成立${completed.length}件 / 未決オファー${market.activeOffers.length}件`);
      if (day % 3 === 0) await yieldToBrowser();
    }
    market.activeOffers = (market.activeOffers || []).slice(0, 80);
    market.updatedAt = new Date().toISOString();

    // 市場日数を消化しても目標件数 (maxTransfers) に届かなかった場合の補完。
    // 確実に成立できる提案を直接成立させ、件数不足を解消する。
    // (以前は `index = maxTransfers; index < maxTransfers` で条件が常に偽となり、
    //  このフォールバックは一度も実行されていなかった)
    let fallbackGuard = 0;
    while (completed.length < maxTransfers && fallbackGuard < maxTransfers * 4) {
      fallbackGuard += 1;
      const index = completed.length;
      const report = transferMarketReport(world, "all");
      const proposal = (report.proposals || []).find((item) => !blockedPlayers.has(item.playerId) && canFinalizeTransfer(world, item, index));
      if (!proposal) break;
      const record = applyFinalizedTransfer(world, proposal, index);
      if (!record) {
        blockedPlayers.add(proposal.playerId);
        continue;
      }
      blockedPlayers.add(record.playerId);
      completed.push(record);
      setStatus(`移籍市場処理中... ${completed.length}件成立`);
      if (fallbackGuard % 4 === 3) await yieldToBrowser();
    }

    state.world = world;
    state.lastNextSeasonPack = null;
    saveWorldState();
    renderWorld();
    setStatus(completed.length || released.length
      ? `移籍市場を実行しました: 成立${completed.length}件 / 自由契約化${released.length}人`
      : "成立した移籍はありませんでした");
  } catch (error) {
    setStatus(error.message || "移籍市場の実行に失敗しました。");
  } finally {
    setBusy(false);
  }
}

function transferLogPayload(world) {
  const transfers = world?.transferMarket?.transfers || [];
  const byType = transfers.reduce((summary, row) => {
    const type = row.type || "transfer";
    summary[type] = (summary[type] || 0) + 1;
    return summary;
  }, {});
  return {
    ruleset: "luminous-sword-transfer-log-v1",
    sourceWorldId: world?.id,
    season: world?.season?.label,
    generatedAt: new Date().toISOString(),
    summary: {
      transfers: transfers.length,
      byType,
      releasedPlayers: world?.transferMarket?.releasedPlayers?.length || 0,
      unsignedFreeAgents: world?.transferMarket?.freeAgents?.length || 0,
      marketDays: world?.transferMarket?.days?.total || 0,
      unresolvedOffers: world?.transferMarket?.activeOffers?.length || 0,
      totalValue: roundNumber(transfers.reduce((sum, row) => sum + numberOr(row.value, 0), 0), 2),
    },
    transfers,
    dailyLogs: world?.transferMarket?.dailyLogs || [],
    offerHistory: world?.transferMarket?.offerHistory || [],
    activeOffers: (world?.transferMarket?.activeOffers || []).map((offer) => ({
      offerId: offer.offerId,
      marketDay: offer.marketDay,
      expiresDay: offer.expiresDay,
      type: offer.type || "transfer",
      playerId: offer.playerId,
      player: offer.player,
      seller: offer.seller,
      buyer: offer.buyer,
      value: offer.finalOffer,
      probability: offer.negotiationProbability,
    })),
    releasedPlayers: world?.transferMarket?.releasedPlayers || [],
    unsignedFreeAgents: (world?.transferMarket?.freeAgents || []).map(({ playerData, state, ...row }) => row),
  };
}

function exportTransferLog() {
  if (!state.world?.transferMarket?.transfers?.length) {
    setStatus("出力できる移籍一覧がありません。");
    return;
  }
  const payload = transferLogPayload(state.world);
  downloadJson(`touken-transfer-log-${safeFilePart(payload.season || "season")}.json`, payload);
  setStatus(`移籍一覧を出力しました: ${payload.summary.transfers}件`);
}

function renderTransferMarketReport(world, leagueId = "all") {
  if (!world.completed) return "";
  const report = transferMarketReport(world, leagueId);
  const transfers = (world.transferMarket?.transfers || []).filter((row) => leagueId === "all" || row.fromTeamId && world.teams.find((team) => team.id === row.fromTeamId)?.leagueId === leagueId || row.toTeamId && world.teams.find((team) => team.id === row.toTeamId)?.leagueId === leagueId);
  const dailyLogs = world.transferMarket?.dailyLogs || [];
  if (!report.needs.length && !report.candidates.length && !transfers.length) return "";

  return `
    <section class="world-best-seven transfer-market-report">
      <h3>移籍市場スカウトレポート</h3>
      <div class="world-leaderboard-grid">
        ${dailyLogs.length ? `
        <section class="world-leaderboard">
          <h3>市場日数</h3>
          <ol>
            ${dailyLogs.slice(-6).map((day) => `
              <li>
                <span>${day.day}日目 / ${escapeHtml(day.phase)}</span>
                <em>新規${day.offersCreated} / 未決${day.activeOffers} / ニーズ${day.needs}</em>
                <strong>${day.deals}件</strong>
              </li>
            `).join("")}
          </ol>
        </section>
        ` : ""}
        <section class="world-leaderboard">
          <h3>成立済み移籍</h3>
          <ol>
            ${transfers.slice(-12).reverse().map((transfer) => `
              <li>
                <span>${escapeHtml(transfer.player)}</span>
                <em>${escapeHtml(transferTypeLabel(transfer.type))} / ${escapeHtml(transfer.fromTeam)} → ${escapeHtml(transfer.toTeam)} / ${escapeHtml(positionLabel(transfer.position))} / ${escapeHtml(negotiationStageLabel(transfer.status))} / ${formatNumber(transfer.value, 0)}</em>
                <strong>${formatNumber((transfer.probability || 0) * 100, 0)}%</strong>
              </li>
            `).join("") || `<li><span>成立移籍なし</span><em>-</em><strong>-</strong></li>`}
          </ol>
        </section>
        <section class="world-leaderboard">
          <h3>補強ニーズ</h3>
          <ol>
            ${report.needs.map((need) => `
              <li>
                <span>${escapeHtml(need.team)}</span>
                <em>${escapeHtml(need.formation)} / ${escapeHtml(need.group)} / ${need.count}/${need.min} / ${escapeHtml(need.reason)}</em>
                <strong>${formatNumber(need.priority, 1)}</strong>
              </li>
            `).join("") || `<li><span>大きな不足なし</span><em>-</em><strong>-</strong></li>`}
          </ol>
        </section>
        <section class="world-leaderboard">
          <h3>移籍候補</h3>
          <ol>
            ${report.candidates.map((candidate) => `
              <li>
                <span>${escapeHtml(candidate.player)}</span>
                <em>${escapeHtml(candidate.team)} / ${escapeHtml(positionLabel(candidate.position))} / ${candidate.age}歳 / 出場${formatNumber(candidate.minutesRate * 100, 0)}%</em>
                ${candidate.reasons?.length ? `<em>${escapeHtml(candidate.reasons.slice(0, 2).join(" / "))}</em>` : ""}
                <strong>${formatNumber(candidate.score, 1)}</strong>
              </li>
            `).join("") || `<li><span>候補なし</span><em>-</em><strong>-</strong></li>`}
          </ol>
        </section>
        <section class="world-leaderboard">
          <h3>交渉シミュレーション</h3>
          <ol>
            ${report.proposals.map((proposal) => `
              <li>
                <span>${escapeHtml(proposal.player)}</span>
                <em>${escapeHtml(transferTypeLabel(proposal.type))} / ${escapeHtml(proposal.seller)} → ${escapeHtml(proposal.buyer)} / ${escapeHtml(proposal.negotiationLabel)} / 提示${formatNumber(proposal.finalOffer, 0)}・要求${formatNumber(proposal.askingPrice, 0)}</em>
                <em>${escapeHtml((proposal.negotiationLogs || []).slice(-2).join(" / "))}</em>
                <strong>${formatNumber((proposal.negotiationProbability || 0) * 100, 0)}%</strong>
              </li>
            `).join("") || `<li><span>交渉候補なし</span><em>-</em><strong>-</strong></li>`}
          </ol>
        </section>
      </div>
    </section>
  `;
}

function renderWorldSeasonSummary(world) {
  if (!world.completed) return "";
  const selectedLeague = selectedWorldSummaryLeague(world);
  const selectedLeagueId = selectedLeague?.id || "all";
  const playerRows = worldStatRows(world, selectedLeagueId);
  const champions = selectedLeague
    ? [selectedLeague.standings?.[0]].filter(Boolean)
    : (world.leagues || []).map((league) => league.standings?.[0]).filter(Boolean);
  const clEntrants = (world.futureCompetitions?.championsLeague?.entrants || [])
    .filter((entry) => !selectedLeague || entry.league === selectedLeague.name);
  const scopeTabs = renderWorldSummaryScopeTabs(world, selectedLeagueId);
  const bestSeven = renderBestSevenByPosition(playerRows);
  const leaderboards = [
    renderLeaderboard("総合MVP", playerRows, (row) => formatNumber(row.mvpScore, 1), (a, b) => b.mvpScore - a.mvpScore),
    renderLeaderboard("得点王", playerRows, (row) => row.goals, (a, b) => b.goals - a.goals || b.assists - a.assists),
    renderLeaderboard("アシスト", playerRows, (row) => row.assists, (a, b) => b.assists - a.assists || b.goals - a.goals),
    renderLeaderboard("得点関与", playerRows, (row) => row.goalContribution, (a, b) => b.goalContribution - a.goalContribution),
    renderLeaderboard("守備アクション", playerRows, (row) => row.defensiveActions, (a, b) => b.defensiveActions - a.defensiveActions),
    renderLeaderboard("出場時間", playerRows, (row) => `${formatNumber(row.minutes, 0)}分`, (a, b) => b.minutes - a.minutes),
  ].join("");

  return `
    <section class="world-section">
      <h2>シーズンサマリー</h2>
      ${scopeTabs}
      <div class="team-awards">
        ${champions.map((team) => `<div><span>${escapeHtml(team.name)}</span><strong>優勝</strong><em>${team.points} pts / ${team.goalsFor}-${team.goalsAgainst}</em></div>`).join("")}
      </div>
      <div class="world-cl-list">
        <strong>CL出場予定</strong>
        <span>${clEntrants.map((entry) => `${entry.league}: ${entry.team}`).join(" / ") || "-"}</span>
      </div>
      ${bestSeven}
      ${renderDevelopmentHighlights(world)}
      ${renderContractSummary(world, selectedLeagueId)}
      ${renderTransferMarketReport(world, selectedLeagueId)}
      <div class="world-leaderboard-grid">${leaderboards}</div>
    </section>
  `;
}

function eventLabel(type) {
  return eventLabels[type] || type || "-";
}

function matchPlayerStatRows(stats = []) {
  return [...stats]
    .sort((a, b) =>
      (b.goals || 0) - (a.goals || 0) ||
      (b.assists || 0) - (a.assists || 0) ||
      ((b.steals || 0) + (b.interceptions || 0) + (b.blocks || 0)) - ((a.steals || 0) + (a.interceptions || 0) + (a.blocks || 0)) ||
      (b.completedPasses || 0) - (a.completedPasses || 0))
    .slice(0, 10)
    .map((player) => `
      <tr>
        <th>${escapeHtml(player.name)}</th>
        <td>${player.goals || 0}</td>
        <td>${player.assists || 0}</td>
        <td>${player.shots || 0}</td>
        <td>${player.completedPasses || 0}/${player.passes || 0}</td>
        <td>${player.steals || 0}</td>
        <td>${player.interceptions || 0}</td>
        <td>${player.blocks || 0}</td>
      </tr>
    `).join("");
}

function renderWorldMatchDetail() {
  const fixture = worldFixtureById(state.worldSelectedFixtureId);
  const result = fixture?.result;
  if (!fixture || !result) return "";
  const home = worldTeamById(fixture.homeTeamId)?.name || result.teams?.home?.name || "Home";
  const away = worldTeamById(fixture.awayTeamId)?.name || result.teams?.away?.name || "Away";
  if (result.detailPruned) {
    return `
      <section class="world-section world-match-detail">
        <h2>試合詳細</h2>
        <div class="world-detail-head">
          <strong>${escapeHtml(home)} ${result.score?.home ?? "-"} - ${result.score?.away ?? "-"} ${escapeHtml(away)}</strong>
          <span>${escapeHtml(fixture.date)} / ${escapeHtml(fixture.competitionName)} / 第${fixture.round}節</span>
        </div>
        <div class="world-cl-list">
          <strong>詳細データは軽量化のため削除済み</strong>
          <span>スコア、xG、得点者、順位表、累積個人成績、疲労・調子・けが情報は保持されています。</span>
        </div>
        <div class="event-log world-detail-events">
          ${(result.goals || []).length ? result.goals.map((event) => `
            <div class="event-row goal">
              <time>S${event.section || "-"} ${String(event.minute || "-").padStart(2, "0")}'</time>
              <span>ゴール ${escapeHtml(event.team || "")}: ${escapeHtml(event.player || "")}${event.assist ? ` / assist ${escapeHtml(event.assist)}` : ""}</span>
            </div>
          `).join("") : `<div class="muted-row">得点イベントなし</div>`}
        </div>
      </section>
    `;
  }
  const homeBox = result.boxScore?.home || {};
  const awayBox = result.boxScore?.away || {};
  const comparisonRows = [
    ["スコア", result.score?.home, result.score?.away],
    ["xG", formatNumber(result.xg?.home ?? homeBox.xg, 2), formatNumber(result.xg?.away ?? awayBox.xg, 2)],
    ["シュート", homeBox.shots ?? "-", awayBox.shots ?? "-"],
    ["枠内", homeBox.shotsOnTarget ?? "-", awayBox.shotsOnTarget ?? "-"],
    ["パス", `${homeBox.completedPasses ?? "-"}/${homeBox.passes ?? "-"}`, `${awayBox.completedPasses ?? "-"}/${awayBox.passes ?? "-"}`],
    ["奪取", homeBox.steals ?? "-", awayBox.steals ?? "-"],
    ["迎撃", homeBox.interceptions ?? "-", awayBox.interceptions ?? "-"],
    ["遮断", homeBox.blocks ?? "-", awayBox.blocks ?? "-"],
    ["導路負荷", formatNumber(homeBox.conduitLoad, 1), formatNumber(awayBox.conduitLoad, 1)],
    ["疲労影響", formatNumber(result.fatigueImpact?.home ?? homeBox.fatigueImpact, 1), formatNumber(result.fatigueImpact?.away ?? awayBox.fatigueImpact, 1)],
  ];
  const events = (result.events || result.goals || []).slice(0, 80);

  return `
    <section class="world-section world-match-detail">
      <h2>試合詳細</h2>
      <div class="world-detail-head">
        <strong>${escapeHtml(home)} ${result.score?.home ?? "-"} - ${result.score?.away ?? "-"} ${escapeHtml(away)}</strong>
        <span>${escapeHtml(fixture.date)} / ${escapeHtml(fixture.competitionName)} / 第${fixture.round}節</span>
      </div>
      <div class="summary-grid">
        <table class="comparison-table">
          <thead><tr><th>${escapeHtml(home)}</th><th>項目</th><th>${escapeHtml(away)}</th></tr></thead>
          <tbody>
            ${comparisonRows.map(([label, h, a]) => comparisonRow(label, h, a, label === "スコア" || label === "xG")).join("")}
          </tbody>
        </table>
      </div>
      <div class="world-grid">
        <section class="world-player-stats">
          <h3>${escapeHtml(home)}</h3>
          <table>
            <thead><tr><th>選手</th><th>得</th><th>A</th><th>射</th><th>パス</th><th>奪</th><th>迎</th><th>遮</th></tr></thead>
            <tbody>${matchPlayerStatRows(result.teams?.home?.playerStats)}</tbody>
          </table>
        </section>
        <section class="world-player-stats">
          <h3>${escapeHtml(away)}</h3>
          <table>
            <thead><tr><th>選手</th><th>得</th><th>A</th><th>射</th><th>パス</th><th>奪</th><th>迎</th><th>遮</th></tr></thead>
            <tbody>${matchPlayerStatRows(result.teams?.away?.playerStats)}</tbody>
          </table>
        </section>
      </div>
      <div class="event-log world-detail-events">
        ${events.length ? events.map((event) => `
          <div class="event-row ${escapeHtml(event.type || "goal")}">
            <time>S${event.section || "-"} ${String(event.minute || "-").padStart(2, "0")}'</time>
            <span>${escapeHtml(eventLabel(event.type))} ${escapeHtml(event.team || "")}: ${escapeHtml(event.player || "")}${event.target ? ` → ${escapeHtml(event.target)}` : ""}${event.assist ? ` / assist ${escapeHtml(event.assist)}` : ""}${Number.isFinite(event.xg) ? ` / xG ${formatNumber(event.xg, 3)}` : ""}</span>
          </div>
        `).join("") : `<div class="muted-row">主要イベントなし</div>`}
      </div>
    </section>
  `;
}

function renderWorld() {
  const panel = $("#worldResult");
  if (!panel) return;
  const world = state.world;
  if (!world) {
    panel.innerHTML = `<div class="muted-row">ワールドなし</div>`;
    return;
  }

  const scheduled = (world.calendar || []).reduce((sum, day) => sum + day.fixtures.length, 0);
  const played = (world.calendar || []).reduce((sum, day) => sum + day.fixtures.filter((fixture) => fixture.status === "played").length, 0);
  const summary = state.lastWorldSummary || world.latestSummary;
  const clEntrants = world.futureCompetitions?.championsLeague?.entrants || [];
  const regularTeamCount = (world.teams || []).filter((team) => !team.competitionOnly).length;
  const selectedLeagueId = selectedWorldLeagueId(world);
  const visibleLeagues = selectedLeagueId === "all" ? world.leagues : world.leagues.filter((league) => league.id === selectedLeagueId);
  const filteredSummary = filterWorldSummary(summary, selectedLeagueId);
  const scopeTabs = renderWorldSummaryScopeTabs(world, selectedLeagueId);

  panel.innerHTML = `
    <div class="world-headline">
      <div><span>シーズン</span><strong>${escapeHtml(world.season.label)}</strong><em>${escapeHtml(world.currentDate)} / ${escapeHtml(world.scheduleSeed || "-")}</em></div>
      <div><span>リーグ</span><strong>${world.leagues.length}</strong><em>${regularTeamCount}チーム</em></div>
      <div><span>進行</span><strong>${played}/${scheduled}</strong><em>${world.completed ? "終了" : "進行中"}</em></div>
      <div><span>CL予定枠</span><strong>${clEntrants.length}</strong><em>シーズン順位連動</em></div>
    </div>
    <section class="world-section">
      <h2>${escapeHtml(summary?.date || world.currentDate)} 結果</h2>
      <div class="world-grid">
        <div>${renderWorldMatches(filteredSummary)}</div>
        <div>${renderWorldNews(world)}</div>
      </div>
    </section>
    <section class="world-section world-display-tabs">
      <h2>表示リーグ</h2>
      ${scopeTabs}
    </section>
    <section class="world-section world-roster-section">
      <h2>チームメンバー</h2>
      ${renderWorldTeamRoster(world, selectedLeagueId)}
    </section>
    ${renderWorldMatchDetail()}
    ${renderWorldSeasonSummary(world)}
    ${visibleLeagues.map(renderWorldTable).join("")}
    <section class="world-section">
      <h2>次の予定</h2>
      <div class="round-list">${renderWorldSchedule(world, selectedLeagueId)}</div>
    </section>
    <section class="world-section">
      <h2>国内杯</h2>
      <div class="round-list">${renderWorldCups(world, selectedLeagueId)}</div>
    </section>
    <section class="world-section">
      <h2>Champions League</h2>
      <div class="round-list">${renderChampionsLeague(world)}</div>
    </section>
    <section class="world-section">
      <h2>Nations League</h2>
      <div class="round-list">${renderNationsLeague(world)}</div>
    </section>
    <section class="world-section">
      <h2>選手状態</h2>
      ${renderWorldPlayerState(world, selectedLeagueId)}
    </section>
  `;
  updateWorldControls();
}

function formText(form) {
  return Array.isArray(form) ? form.join("") : String(form || "-");
}

const awardLabels = {
  mvp: "総合MVP",
  topScorers: "得点王",
  assists: "アシスト",
  goalContributions: "得点関与",
  shooters: "射出数",
  passers: "パス成功",
  passAccuracy: "パス成功率",
  stealers: "奪取",
  interceptors: "迎撃",
  blockers: "遮断",
  defensiveMvp: "守備MVP",
  workhorses: "出場時間",
};

function awardValue(key, player) {
  if (key === "mvp") return player.mvpScore;
  if (key === "goalContributions") return player.goalContribution;
  if (key === "passAccuracy") return `${formatNumber(player.passRate * 100, 1)}%`;
  if (key === "defensiveMvp") return player.defensiveActions;
  if (key === "workhorses") return `${formatNumber(player.minutes, 0)}分`;
  const field = {
    topScorers: "goals",
    assists: "assists",
    shooters: "shots",
    passers: "completedPasses",
    stealers: "steals",
    interceptors: "interceptions",
    blockers: "blocks",
  }[key];
  return field ? player[field] : player.mvpScore;
}

function renderAwardCard(key, players) {
  return `
    <section class="award-card">
      <h3>${escapeHtml(awardLabels[key] || key)}</h3>
      <ol>
        ${(players || []).map((player) => `
          <li>
            <span>${escapeHtml(player.name)}</span>
            <em>${escapeHtml(player.team)}</em>
            <strong>${escapeHtml(awardValue(key, player))}</strong>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderTeamMvp(awards) {
  return `
    <section class="award-card team-mvp-card">
      <h3>チームMVP</h3>
      <ol>
        ${(awards.teamMvp || []).map((entry) => `
          <li>
            <span>${escapeHtml(entry.team)}</span>
            <em>${escapeHtml(entry.player?.name || "-")}</em>
            <strong>${escapeHtml(entry.player?.mvpScore ?? "-")}</strong>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderTeamAwards(awards) {
  const items = [
    ["優勝", awards.teamAwards?.champion?.name],
    ["最多得点", awards.teamAwards?.bestAttack?.name],
    ["最少失点", awards.teamAwards?.bestDefense?.name],
    ["最高得失差", awards.teamAwards?.bestGoalDifference?.name],
  ];
  return `
    <div class="team-awards">
      ${items.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value || "-")}</strong></div>`).join("")}
    </div>
  `;
}

function renderLeague(league) {
  state.lastLeague = league;
  const tableRows = league.table.map((team) => `
    <tr class="${team.clQualified ? "cl-zone" : ""}">
      <td>${team.rank}</td>
      <th>${escapeHtml(team.name)}</th>
      <td>${team.played}</td>
      <td>${team.wins}</td>
      <td>${team.draws}</td>
      <td>${team.losses}</td>
      <td>${team.goalsFor}</td>
      <td>${team.goalsAgainst}</td>
      <td>${team.goalDifference}</td>
      <td>${team.points}</td>
      <td>${formatNumber(team.fatigue, 1)}</td>
      <td>${escapeHtml(formText(team.form))}</td>
    </tr>
  `).join("");
  const allRounds = league.rounds.map((round) => `
    <section class="round-card">
      <h3>${escapeHtml(round.label)}</h3>
      <div class="round-matches">
        ${round.matches.map((match) => `
          <div>
            <span>${escapeHtml(match.home)}</span>
            <strong>${match.score.home} - ${match.score.away}</strong>
            <span>${escapeHtml(match.away)}</span>
            <em>xG ${formatNumber(match.xg.home, 1)} - ${formatNumber(match.xg.away, 1)} / 疲労 ${formatNumber(match.fatigue.home, 1)} - ${formatNumber(match.fatigue.away, 1)}</em>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");
  const awards = league.awards || {};
  const awardCards = Object.keys(awardLabels).map((key) => renderAwardCard(key, awards[key])).join("");

  $("#leagueResult").innerHTML = `
    <div class="league-headline">
      <div><span>リーグ</span><strong>${escapeHtml(league.league.name)}</strong></div>
      <div><span>方式</span><strong>${league.league.teams}チーム / ${league.league.rounds}節</strong></div>
      <div><span>試合数</span><strong>${league.league.matches}</strong></div>
      <div><span>CL枠</span><strong>上位${league.league.clSlots}</strong></div>
    </div>
    <div class="league-table-wrap">
      <table class="league-table">
        <thead>
          <tr><th>#</th><th>チーム</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得</th><th>失</th><th>差</th><th>Pts</th><th>疲労</th><th>直近</th></tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <section class="league-section">
      <h2>シーズン表彰</h2>
      ${renderTeamAwards(awards)}
      <div class="award-grid">${awardCards}${renderTeamMvp(awards)}</div>
    </section>
    <section class="league-section">
      <h2>全試合結果</h2>
      <div class="round-list">${allRounds}</div>
    </section>
  `;
}

async function runLeague(usePreset = false) {
  try {
    setBusy(true);
    setStatus("リーグ戦を進行中");
    const payload = {
      ...optionsPayload(),
      seed: nextMatchSeed(),
      name: $("#leagueName").value.trim() || "ドイツリーグ",
      enableSeasonFatigue: $("#enableSeasonFatigue").checked,
      preset: usePreset ? "germany" : undefined,
      teams: usePreset ? undefined : state.leagueTeams,
    };
    if (!usePreset && payload.teams.length < 2) {
      throw new Error("リーグに使うチームを読み込んでください。");
    }
    const result = await postJson("/api/league-season", payload);
    renderLeague(result);
    activateTab("league");
    setStatus(`${result.league.rounds}節・${result.league.matches}試合を完了しました`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function runMatch() {
  try {
    assertTeamsReady();
    setBusy(true);
    setStatus("試合中");
    const result = await postJson("/api/match", optionsPayload({ seed: nextMatchSeed() }));
    renderMatch(result);
    activateTab("log");
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function runSeries() {
  try {
    assertTeamsReady();
    setBusy(true);
    setStatus("連戦中");
    const result = await postJson("/api/series", {
      ...optionsPayload(),
      matches: Number($("#matches").value) || 100,
    });
    state.lastSeries = result;
    renderSeries(result);
    activateTab("series");
    setStatus(`${result.matches}試合を集計しました`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

function activateTab(name) {
  for (const tab of $$(".tab")) tab.classList.toggle("active", tab.dataset.tab === name);
  for (const panel of $$(".tab-panel")) panel.classList.toggle("active", panel.id === `tab-${name}`);
}

function bindEvents() {
  $("#homeFile").addEventListener("change", (event) => readTeamFile("home", event.target.files[0]));
  $("#awayFile").addEventListener("change", (event) => readTeamFile("away", event.target.files[0]));
  $("#libraryFiles").addEventListener("change", async (event) => {
    try {
      await registerTeamFiles(event.target.files);
      event.target.value = "";
    } catch (error) {
      setStatus(error.message || "チーム登録に失敗しました。");
    }
  });
  $("#loadLibraryHome").addEventListener("click", () => loadLibraryTeam("home"));
  $("#loadLibraryAway").addEventListener("click", () => loadLibraryTeam("away"));
  $("#registerLoadedTeams").addEventListener("click", () => registerLoadedTeams().catch((error) => setStatus(error.message)));
  $("#deleteLibraryTeam").addEventListener("click", () => deleteSelectedLibraryTeam().catch((error) => setStatus(error.message)));
  $("#loadGermanLeagueTeams").addEventListener("click", () => loadGermanLeagueTeams().catch((error) => setStatus(error.message)));
  $("#useLibraryForLeague").addEventListener("click", useLibraryForLeague);
  $("#worldCountry").addEventListener("change", () => {
    updateWorldCountryFields();
    updateWorldControls();
  });
  $("#worldLeagueFormat").addEventListener("change", updateWorldControls);
  $("#worldTeamPicker").addEventListener("click", (event) => {
    if (event.target.closest(".world-team-group-select")) return;
    const button = event.target.closest(".world-team-option");
    if (!button) return;
    toggleWorldTeamSelection(button.dataset.teamId);
  });
  $("#worldTeamPicker").addEventListener("change", (event) => {
    const select = event.target.closest(".world-team-group-select");
    if (!select) return;
    state.worldTeamGroups[select.dataset.teamId] = select.value;
    updateWorldControls();
  });
  $("#worldResult").addEventListener("click", (event) => {
    const summaryButton = event.target.closest("[data-world-summary-league]");
    if (summaryButton) {
      state.worldSummaryLeagueId = summaryButton.dataset.worldSummaryLeague || "all";
      state.worldRosterTeamId = null;
      renderWorld();
      return;
    }
    const rosterButton = event.target.closest("[data-world-roster-team]");
    if (rosterButton) {
      state.worldRosterTeamId = rosterButton.dataset.worldRosterTeam || null;
      renderWorld();
      return;
    }
    const button = event.target.closest(".world-match-row");
    if (!button) return;
    state.worldSelectedFixtureId = button.dataset.fixtureId;
    renderWorld();
  });
  $("#addWorldLeague").addEventListener("click", addWorldLeague);
  $("#clearWorldDraft").addEventListener("click", clearWorldDraft);
  $("#createWorld").addEventListener("click", createWorldFromDraft);
  $("#progressWorldDay").addEventListener("click", progressWorldDay);
  $("#progressWorldUntil").addEventListener("click", progressWorldUntil);
  $("#progressWorldAction").addEventListener("click", progressWorldDay);
  $("#progressWorldTop").addEventListener("click", progressWorldDay);
  $("#exportWorld").addEventListener("click", exportWorld);
  $("#runTransferMarket")?.addEventListener("click", runTransferMarket);
  $("#exportTransferLog")?.addEventListener("click", exportTransferLog);
  $("#exportNextSeasonTeams")?.addEventListener("click", exportNextSeasonTeams);
  $("#importWorld").addEventListener("click", () => $("#worldImportFile").click());
  $("#worldImportFile").addEventListener("change", async (event) => {
    await importWorldFile(event.target.files[0]);
    event.target.value = "";
  });
  $("#runMatch").addEventListener("click", runMatch);
  $("#runSeries").addEventListener("click", runSeries);
  $("#runLeague").addEventListener("click", () => runLeague(false));
  $("#runMatchTop").addEventListener("click", runMatch);
  $("#runSeriesTop").addEventListener("click", runSeries);
  $("#runLeagueTop").addEventListener("click", () => runLeague(state.leagueTeams.length < 2));
  $("#clearSaved").addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    state.homeTeam = null;
    state.awayTeam = null;
    updateTeamLabels();
    setStatus("読込をクリアしました");
  });

  for (const tab of $$(".tab")) {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  }
}

async function init() {
  bindEvents();
  loadSavedState();
  loadSavedWorld();
  const response = await fetch("/api/meta");
  state.meta = await response.json();
  const hasWorldApi = Boolean(state.meta.world);
  state.worldApiAvailable = hasWorldApi;
  state.meta.world = state.meta.world || fallbackWorldMeta;

  fillSelect($("#homeFormation"), state.meta.formations, state.meta.defaults.homeFormation);
  fillSelect($("#awayFormation"), state.meta.formations, state.meta.defaults.awayFormation);
  fillSelect($("#homeTactic"), state.meta.tactics, state.meta.defaults.homeTactic);
  fillSelect($("#awayTactic"), state.meta.tactics, state.meta.defaults.awayTactic);
  fillSelect($("#homeCondition"), state.meta.conditions, state.meta.defaults.homeCondition);
  fillSelect($("#awayCondition"), state.meta.conditions, state.meta.defaults.awayCondition);
  $("#seed").value = state.meta.defaults.seed;
  $("#enableChangers").checked = state.meta.defaults.enableChangers;
  $("#enableBenchSubstitutions").checked = state.meta.defaults.enableBenchSubstitutions;
  $("#regularSubstitutionsPerBreak").value = state.meta.defaults.regularSubstitutionsPerBreak;
  $("#enableFatigue").checked = state.meta.defaults.fatigueImpact !== 0;
  $("#adjustLineupByCondition").checked = state.meta.defaults.adjustLineupByCondition;
  $("#includePassEvents").checked = state.meta.defaults.includePassEvents;
  $("#worldSeasonLabel").value = state.meta.world.defaults.seasonLabel;
  if ($("#worldScheduleSeed")) $("#worldScheduleSeed").value = state.meta.world.defaults.scheduleSeed || fallbackWorldMeta.defaults.scheduleSeed;
  $("#worldStartDate").value = state.meta.world.defaults.startDate;
  $("#worldEndDate").value = state.meta.world.defaults.endDate;

  await refreshLibrary();
  updateLeagueTeamCount();
  updateTeamLabels();
  updateWorldControls();
  renderWorld();
  setStatus(hasWorldApi ? "準備完了" : "準備完了（ワールド作成にはサーバー再起動が必要です）");
}

init().catch((error) => {
  setStatus(error.message);
});
