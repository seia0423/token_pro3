import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { startServer } from "../src/web-server.js";

async function fixture(name) {
  const raw = await readFile(new URL(`../samples/${name}`, import.meta.url), "utf8");
  return JSON.parse(raw);
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("web server serves metadata and match API", async () => {
  const { server, url } = await startServer({ port: 0 });

  try {
    const meta = await fetch(`${url}api/meta`).then((response) => response.json());
    assert.equal(meta.formations.length, 8);
    assert.equal(meta.tactics.length, 6);
    assert.ok(meta.samples.length >= 2);

    const homeTeam = await fixture("team-a.json");
    const awayTeam = await fixture("team-b.json");
    const match = await fetch(`${url}api/match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeTeam: homeTeam.players,
        awayTeam: awayTeam.players,
        homeName: "Home File Name",
        awayName: "Away File Name",
        seed: "web-test",
      }),
    }).then((response) => response.json());

    assert.equal(match.ruleset, "luminous-sword-v1");
    assert.equal(match.teams.home.name, "Home File Name");
    assert.equal(match.teams.away.name, "Away File Name");
    assert.equal(typeof match.score.home, "number");
    assert.equal(typeof match.score.away, "number");
    assert.ok(Array.isArray(match.events));
  } finally {
    await closeServer(server);
  }
});
