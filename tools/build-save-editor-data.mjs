import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const repoRoot = path.resolve(siteRoot, "..");
const upgradeRoot = path.resolve(repoRoot, "White2Upgrade");
const referenceRoot = path.resolve(repoRoot, "reference_repos", "Pokeweb-Live");

const FORM_NAME_OVERRIDES = new Map(Object.entries({
  201: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "!", "?"],
  351: ["Normal", "Sunny", "Rainy", "Snowy"],
  386: ["Normal", "Attack", "Defense", "Speed"],
  412: ["Plant", "Sandy", "Trash"],
  413: ["Plant", "Sandy", "Trash"],
  421: ["Overcast", "Sunshine"],
  422: ["West", "East"],
  423: ["West", "East"],
  479: ["Rotom", "Heat", "Wash", "Frost", "Fan", "Mow"],
  487: ["Altered", "Origin"],
  492: ["Land", "Sky"],
  493: ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel", "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"],
  550: ["Red-Striped", "Blue-Striped"],
  555: ["Standard", "Zen"],
  585: ["Spring", "Summer", "Autumn", "Winter"],
  586: ["Spring", "Summer", "Autumn", "Winter"],
  641: ["Incarnate", "Therian"],
  642: ["Incarnate", "Therian"],
  645: ["Incarnate", "Therian"],
  646: ["Kyurem", "White", "Black"],
  647: ["Ordinary", "Resolute"],
  648: ["Aria", "Pirouette"],
  649: ["Normal", "Douse", "Shock", "Burn", "Chill"],
  676: ["Natural", "Heart", "Star", "Diamond", "Debutante", "Matron", "Dandy", "La Reine", "Kabuki", "Pharaoh"],
  681: ["Shield", "Blade"],
  710: ["Average", "Small", "Large", "Super"],
  711: ["Average", "Small", "Large", "Super"],
  716: ["Neutral", "Active"],
  718: ["50%", "Complete"],
  720: ["Confined", "Unbound"]
}).map(([species, names]) => [Number(species), names]));

function titleFromConstant(value, prefix) {
  const raw = value
    .replace(prefix, "")
    .replace(/^0+$/, "0")
    .replace(/_/g, " ")
    .toLowerCase();

  return raw.replace(/\b[a-z0-9]/g, (char) => char.toUpperCase())
    .replace(/\bTm\b/g, "TM")
    .replace(/\bHm\b/g, "HM")
    .replace(/\bHp\b/g, "HP")
    .replace(/\bPp\b/g, "PP")
    .replace(/\bOhko\b/g, "OHKO")
    .replace(/\bMr\b/g, "Mr.")
    .replace(/\bMime Jr\b/g, "Mime Jr.")
    .replace(/\bHo Oh\b/g, "Ho-Oh")
    .replace(/\bPorygon Z\b/g, "Porygon-Z")
    .replace(/\bNidoran M\b/g, "Nidoran M")
    .replace(/\bNidoran F\b/g, "Nidoran F");
}

async function readText(file) {
  return readFile(file, "utf8");
}

async function readJson(file) {
  return JSON.parse(await readText(file));
}

function parseDefines(text, prefix) {
  const rows = [];
  const definePattern = new RegExp(`^#define\\s+(${prefix}[A-Z0-9_]+)\\s+(0x[0-9A-Fa-f]+|\\d+)\\b`, "gm");
  const enumPattern = new RegExp(`^\\s*(${prefix}[A-Z0-9_]+)\\s*=\\s*(0x[0-9A-Fa-f]+|\\d+)\\s*,?`, "gm");
  for (const pattern of [definePattern, enumPattern]) {
    for (const match of text.matchAll(pattern)) {
      rows.push({
        constant: match[1],
        id: Number.parseInt(match[2], 0)
      });
    }
  }
  return rows;
}

function parseSpeciesCount(text, defines) {
  const match = text.match(/^#define\s+SPECIES_CNT\s+SPECIES_(\d+)\s*$/m);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return Math.max(...defines.map((define) => define.id));
}

function parseYamlInt(text, key) {
  const pattern = new RegExp(`^-\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(-?\\d+)\\s*$`, "m");
  const match = text.match(pattern);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function loadTrackerMap(name) {
  const rows = await readJson(path.join(siteRoot, "data", `${name}.gen6.json`));
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function loadPersonalInfo(id) {
  const personalPath = path.join(upgradeRoot, "data", "pml", "personal", `${String(id).padStart(3, "0")}.yml`);
  if (!existsSync(personalPath)) {
    return null;
  }

  const personal = await readText(personalPath);
  return {
    id,
    baseStats: [
      parseYamlInt(personal, "Base HP"),
      parseYamlInt(personal, "Base Attack"),
      parseYamlInt(personal, "Base Defense"),
      parseYamlInt(personal, "Base Speed"),
      parseYamlInt(personal, "Base Special Attack"),
      parseYamlInt(personal, "Base Special Defense")
    ],
    expGroup: parseYamlInt(personal, "Experience Group"),
    formDataOffset: parseYamlInt(personal, "Form Data Offset") || 0,
    formCount: parseYamlInt(personal, "Form Count") || 1,
    abilities: [
      parseYamlInt(personal, "Primary Ability"),
      parseYamlInt(personal, "Secondary Ability"),
      parseYamlInt(personal, "Hidden Ability")
    ].filter((value) => value !== null)
  };
}

function formName(speciesId, formId, speciesName, personalId, tracker) {
  const override = FORM_NAME_OVERRIDES.get(speciesId)?.[formId];
  if (override) {
    return override;
  }
  if (formId === 0) {
    return "Base";
  }

  const trackerName = tracker.get(personalId)?.name;
  if (trackerName) {
    return trackerName;
  }
  return `${speciesName} Form ${formId}`;
}

function showdownFormName(speciesName, speciesId, formId, name) {
  if (formId === 0) {
    return speciesName;
  }
  if (speciesId === 479 || speciesId === 720) {
    return `${speciesName}-${name}`;
  }
  if (name.startsWith(`Mega ${speciesName}`)) {
    return `${speciesName}-Mega${name.slice(`Mega ${speciesName}`.length).replace(/\s+/g, "-")}`;
  }
  if (name.startsWith("Primal ")) {
    return `${speciesName}-Primal`;
  }
  return `${speciesName}-${name}`;
}

async function buildForms(speciesId, speciesName, personalInfo, speciesCount, tracker) {
  if (speciesId > speciesCount || personalInfo.formCount <= 1) {
    return undefined;
  }

  const forms = [];
  for (let formId = 0; formId < personalInfo.formCount; formId += 1) {
    const personalId = formId > 0 && personalInfo.formDataOffset > speciesCount
      ? personalInfo.formDataOffset + formId - 1
      : speciesId;
    const formInfo = formId === 0
      ? personalInfo
      : await loadPersonalInfo(personalId) || personalInfo;
    const name = formName(speciesId, formId, speciesName, personalId, tracker);
    forms.push({
      id: formId,
      name,
      personalId,
      showdownName: showdownFormName(speciesName, speciesId, formId, name),
      baseStats: formInfo.baseStats,
      expGroup: formInfo.expGroup,
      abilities: formInfo.abilities
    });
  }
  return forms;
}

async function loadSpecies() {
  const tracker = await loadTrackerMap("pokemon");
  const speciesHeader = await readText(path.join(upgradeRoot, "include", "Species.h"));
  const defines = parseDefines(speciesHeader, "SPECIES_");
  const speciesCount = parseSpeciesCount(speciesHeader, defines);
  const seen = new Set();
  const species = [];

  for (const define of defines) {
    if (define.id <= 0 || seen.has(define.id)) {
      continue;
    }

    const personalInfo = await loadPersonalInfo(define.id);
    if (!personalInfo) {
      continue;
    }

    const trackerRow = tracker.get(define.id);
    const name = trackerRow?.name || (/^SPECIES_\d+$/.test(define.constant) ? `Species ${define.id}` : titleFromConstant(define.constant, "SPECIES_"));
    const forms = await buildForms(define.id, name, personalInfo, speciesCount, tracker);

    species.push({
      id: define.id,
      constant: trackerRow?.constant || define.constant,
      name,
      baseStats: personalInfo.baseStats,
      expGroup: personalInfo.expGroup,
      formDataOffset: personalInfo.formDataOffset,
      formCount: personalInfo.formCount,
      forms,
      abilities: personalInfo.abilities
    });
    seen.add(define.id);
  }

  return species.sort((a, b) => a.id - b.id);
}

async function loadMoves() {
  const tracker = await loadTrackerMap("moves");
  const defines = parseDefines(await readText(path.join(upgradeRoot, "include", "Moves.h")), "MOVE_");
  const seen = new Set([0]);
  const moves = [{ id: 0, constant: "MOVE_NONE", name: "None", pp: 0 }];

  for (const define of defines) {
    if (define.id <= 0 || seen.has(define.id)) {
      continue;
    }

    const movePath = path.join(upgradeRoot, "data", "pml", "moves", `${String(define.id).padStart(3, "0")}.yml`);
    if (!existsSync(movePath)) {
      continue;
    }

    const move = await readText(movePath);
    const trackerRow = tracker.get(define.id);
    moves.push({
      id: define.id,
      constant: trackerRow?.constant || define.constant,
      name: trackerRow?.name || titleFromConstant(define.constant, "MOVE_"),
      pp: parseYamlInt(move, "Base PP") || 0
    });
    seen.add(define.id);
  }

  return moves.sort((a, b) => a.id - b.id);
}

async function loadItems() {
  const tracker = await loadTrackerMap("items");
  const constants = new Map(
    parseDefines(await readText(path.join(upgradeRoot, "include", "Items.h")), "ITEM_")
      .map((row) => [row.id, row.constant])
  );
  const textRows = (await readText(path.join(upgradeRoot, "tools", "helpers", "txtdmp", "Items.txt")))
    .split(/\r?\n/);
  const ids = new Set([...textRows.keys(), ...constants.keys(), ...tracker.keys()]);

  return [...ids]
    .filter((id) => Number.isInteger(id) && id >= 0)
    .sort((a, b) => a - b)
    .map((id) => {
      const trackerRow = tracker.get(id);
      const constant = trackerRow?.constant || constants.get(id) || `ITEM_${id}`;
      const dumpedName = textRows[id]?.trim();
      return {
        id,
        constant,
        name: trackerRow?.name || (dumpedName && dumpedName !== "???" ? dumpedName : titleFromConstant(constant, "ITEM_"))
      };
    });
}

async function loadAbilities() {
  const tracker = await loadTrackerMap("abilities");
  const constants = new Map([
    ...parseDefines(await readText(path.join(upgradeRoot, "include", "w2u_battle.h")), "ABIL_"),
    ...parseDefines(await readText(path.join(upgradeRoot, "include", "w2u_abilities.h")), "ABIL_")
  ].map((row) => [row.id, row.constant]));
  const abilityTextPath = path.join(referenceRoot, "randomizer", "abilities.txt");
  const textRows = existsSync(abilityTextPath)
    ? (await readText(abilityTextPath)).split(/\r?\n/)
    : [];
  const ids = new Set([...textRows.keys(), ...constants.keys(), ...tracker.keys()]);

  return [...ids]
    .filter((id) => Number.isInteger(id) && id >= 0)
    .sort((a, b) => a - b)
    .map((id) => {
      const trackerRow = tracker.get(id);
      const constant = trackerRow?.constant || constants.get(id) || `ABIL_${id}`;
      const dumpedName = textRows[id]?.trim();
      return {
        id,
        constant,
        name: trackerRow?.name || (id === 0 ? "None" : dumpedName && dumpedName !== "-" ? titleFromConstant(`ABIL_${dumpedName.replace(/[^A-Z0-9]+/g, "_")}`, "ABIL_") : titleFromConstant(constant, "ABIL_"))
      };
    });
}

const data = {
  source: "White2Upgrade include headers and data/pml YAML",
  species: await loadSpecies(),
  moves: await loadMoves(),
  items: await loadItems(),
  abilities: await loadAbilities()
};

await writeFile(
  path.join(siteRoot, "data", "save-editor-data.json"),
  `${JSON.stringify(data, null, 2)}\n`
);

console.log(`Wrote save-editor-data.json with ${data.species.length} species, ${data.moves.length} moves, ${data.items.length} items, ${data.abilities.length} abilities.`);
