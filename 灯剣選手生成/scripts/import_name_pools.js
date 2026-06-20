const fs = require("fs");
const path = require("path");

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node scripts/import_name_pools.js <player_name_pools.json>");
  process.exit(1);
}

const root = path.dirname(path.dirname(__filename));
const jsonPath = path.join(root, "data", "generator-data.json");
const jsPath = path.join(root, "data", "generator-data.js");

function cleanEntries(entries = []) {
  return entries
    .map((entry) => ({
      name: String(entry.name || "").trim(),
      subgroup: String(entry.subgroup || "").trim(),
      alternativeForm: String(entry.alternative_form || entry.alternativeForm || "").trim(),
      note: String(entry.note || "").trim(),
    }))
    .filter((entry) => entry.name);
}

function simpleNames(entries) {
  return [...new Set(cleanEntries(entries).map((entry) => entry.name))];
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const pools = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

data.namePoolsByCountry = data.namePoolsByCountry || {};

for (const [country, info] of Object.entries(pools.countries || {})) {
  const surnames = cleanEntries(info.surnames);
  const maleGivenNames = cleanEntries(info.male_given_names);
  const femaleGivenNames = cleanEntries(info.female_given_names);

  data.namePoolsByCountry[country] = {
    countryEn: info.country_en || "",
    iso3: info.iso3 || "",
    nameOrder: info.name_order || "given-first",
    surnameNote: info.surname_note || "",
    conventionReferenceUrl: info.convention_reference_url || "",
    surnames,
    maleGivenNames,
    femaleGivenNames,
  };

  if (surnames.length && maleGivenNames.length) {
    data.namesByKey[`${country}|男`] = {
      surnames: simpleNames(info.surnames),
      givenNames: simpleNames(info.male_given_names),
    };
  }
  if (surnames.length && femaleGivenNames.length) {
    data.namesByKey[`${country}|女`] = {
      surnames: simpleNames(info.surnames).map((name) => {
        const entry = surnames.find((item) => item.name === name);
        return entry?.alternativeForm || name;
      }),
      givenNames: simpleNames(info.female_given_names),
    };
  }
}

fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
fs.writeFileSync(jsPath, `window.TOUKEN_GENERATOR_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");

console.log(`Imported ${Object.keys(pools.countries || {}).length} country name pools.`);
