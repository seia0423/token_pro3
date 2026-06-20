export function hashSeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createRng(seed) {
  let state = hashSeed(seed || "touken-battle");

  return function rng() {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function normalish(rng) {
  let total = 0;

  for (let index = 0; index < 6; index += 1) {
    total += rng();
  }

  return total - 3;
}

export function weightedPick(entries, rng) {
  const prepared = entries
    .map((entry) => {
      if (Array.isArray(entry)) return { item: entry[0], weight: Number(entry[1]) || 0 };
      return { item: entry.item, weight: Number(entry.weight) || 0 };
    })
    .filter((entry) => entry.weight > 0);

  if (!prepared.length) return null;

  const total = prepared.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;

  for (const entry of prepared) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }

  return prepared.at(-1).item;
}
