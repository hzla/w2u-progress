import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConstants, parseMessageBank, reconcileBattleProgress } from './lib/battle-progress.mjs';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sourceArg, ...flags] = process.argv.slice(2);
if (!sourceArg) throw new Error('Usage: node tools/sync-battle-progress.mjs UPGRADE_REPO [--check]');
const source = path.resolve(sourceArg), check = flags.includes('--check');
const read = p => readFile(path.join(source, p), 'utf8');
const load = async p => JSON.parse(await readFile(path.join(site, p), 'utf8'));
const paths = {
  abilityHeader: 'include/w2u_abilities.h', itemHeader: 'include/Items.h',
  registry: 'src/pokeweb_gameplay/battle_modules/registry.json',
  abilities: 'src/pokeweb_gameplay/w2u_abilities.cpp', fieldItems: 'src/pokeweb_gameplay/w2u_field_items.cpp',
  mega: 'src/pokeweb_gameplay/w2u_mega.cpp', protosynthesis: 'src/pokeweb_gameplay/megab2w2/abilities/Protosynthesis.cpp',
  abilityNames: 'data/text/system/374.toml', abilityDescriptions: 'data/text/system/375.toml', itemNames: 'data/text/system/64.toml',
};
const text = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, p]) => [key, await read(p)])));
const dataItems = new Set();
for (const file of await readdir(path.join(source, 'data/items'))) if (file.endsWith('.toml'))
  for (const match of (await read(`data/items/${file}`)).matchAll(/^\[(ITEM_\w+)\]\s*$/gm)) dataItems.add(match[1]);
const iconItems = new Set((await readdir(path.join(source, 'assets/item_icons/icons'))).filter(name => name.endsWith('.png'))
  .map(name => `ITEM_${name.slice(0, -4).toUpperCase()}`));
const input = { abilities: await load('data/abilities.gen6.json'), items: await load('data/items.gen6.json'), progress: await load('data/published-progress.json'),
  abilityIds: parseConstants(text.abilityHeader, 'ABIL_'), itemIds: parseConstants(text.itemHeader, 'ITEM_'),
  abilityNames: parseMessageBank(text.abilityNames), abilityDescriptions: parseMessageBank(text.abilityDescriptions), itemNames: parseMessageBank(text.itemNames),
  registry: JSON.parse(text.registry), sources: text, dataItems, iconItems };
const result = reconcileBattleProgress(input);
const count = (rows, field) => Object.fromEntries([6, 7, 8, 9].map(gen => [gen, { rows: rows.filter(row => row.generation === gen).length,
  implemented: rows.filter(row => row.generation === gen && row.defaultProgress[field]).length,
  verified: rows.filter(row => row.generation === gen && row.defaultProgress.verified).length }]));
const auditDate = check ? (await load('data/battle-progress-audit.json')).auditDate
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const audit = { version: 1, auditDate,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  inspectedSourcesDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', ...Object.values(paths)], { cwd: source, encoding: 'utf8' }).trim()),
  sourceScope: 'White 2 integration; source/data/registration inspection, not new battle verification.',
  sourceFiles: Object.fromEntries(Object.entries(paths).map(([key, p]) => [p, createHash('sha256').update(text[key]).digest('hex')])),
  catalogPolicy: 'Gen 6–9 abilities (As One variants separate, Embody Aspect family one ID); existing items plus Gen 8/9 battle-held/form items and the existing field Ability Patch. New Mega routes use Megite; no invented ROM item IDs. Excludes crafting, mints, evolution-only and Dynamax/Max/Z/Tera activation items.',
  catalogReferences: ['https://bulbapedia.bulbagarden.net/wiki/Category:Abilities_introduced_in_Generation_VIII',
    'https://bulbapedia.bulbagarden.net/wiki/Category:Abilities_introduced_in_Generation_IX',
    'https://bulbapedia.bulbagarden.net/wiki/List_of_items_by_name'],
  abilityGenerations: count(result.abilities, 'battleCode'), itemGenerations: count(result.items, 'battleCode'),
  pendingAbilities: result.abilities.filter(row => !row.defaultProgress.battleCode).map(row => ({ key: row.key, id: row.id, name: row.name, notes: row.defaultProgress.notes })),
  pendingItems: result.items.filter(row => !row.defaultProgress.battleCode).map(row => ({ key: row.key, id: row.id, name: row.name, notes: row.defaultProgress.notes })),
  formDependentMoves: ['MOVE_MULTI_ATTACK', 'MOVE_IVY_CUDGEL'],
  unchanged: ['Pokemon progress', 'move animation flags and credits', 'animation viewer assets', 'patch and save downloads'],
  verified: false };
const outputs = new Map([['data/abilities.gen6.json', result.abilities], ['data/items.gen6.json', result.items], ['data/published-progress.json', result.progress], ['data/battle-progress-audit.json', audit]]);
// Preserve the published timestamp for idempotent validation. Change it only
// when the reconciled implementation/progress content actually changes.
const changed = JSON.stringify(input.abilities) !== JSON.stringify(result.abilities) || JSON.stringify(input.items) !== JSON.stringify(result.items)
  || JSON.stringify(input.progress.progress) !== JSON.stringify(result.progress.progress);
if (changed) result.progress.updatedAt = new Date().toISOString();
for (const [p, value] of outputs) {
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (check) {
    if ((await readFile(path.join(site, p), 'utf8')) !== serialized) throw new Error(`Stale tracker data: ${p}`);
  } else await writeFile(path.join(site, p), serialized);
}
console.log(JSON.stringify({ abilities: audit.abilityGenerations, items: audit.itemGenerations,
  pendingAbilities: audit.pendingAbilities.map(row => row.name), pendingItems: audit.pendingItems.map(row => row.name), verified: false, check }, null, 2));
