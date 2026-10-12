// Source-backed tracker reconciliation. A definition/name alone is not code.
export function parseConstants(text, prefix) {
  const expressions = new Map();
  const patterns = [/^\s*#define\s+(\w+)\s+(0x[\da-f]+|\d+|[A-Z_]\w*)\b/gmi,
    /^\s*(\w+)\s*=\s*(0x[\da-f]+|\d+|[A-Z_]\w*)\s*[,;]/gmi];
  for (const pattern of patterns) for (const match of text.matchAll(pattern))
    if (match[1].startsWith(prefix)) expressions.set(match[1], match[2]);
  const values = new Map();
  function resolve(name, chain = new Set()) {
    if (values.has(name)) return values.get(name);
    if (chain.has(name)) throw new Error(`Cyclic constant ${name}`);
    const expression = expressions.get(name);
    if (expression === undefined) throw new Error(`Unknown constant ${name}`);
    const value = /^(?:0x[\da-f]+|\d+)$/i.test(expression) ? Number(expression)
      : resolve(expression, new Set([...chain, name]));
    values.set(name, value);
    return value;
  }
  for (const name of expressions.keys()) resolve(name);
  return values;
}

export function parseMessageBank(text) {
  const result = new Map();
  for (const match of text.matchAll(/\[msg\.section_0\.entries\.(\d+)\]\s*text\s*=\s*\[([\s\S]*?)\]/g)) {
    const parts = [...match[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(part => JSON.parse(`"${part[1]}"`));
    result.set(Number(match[1]), parts.join('').replace(/\\n/g, ' ').replace(/\$$/, '').trim());
  }
  return result;
}

// Generations describe debut, not W2U's repurposed numeric item slots.
// Unassigned items deliberately have null IDs: do not invent usable ROM IDs.
export const ITEM_ADDITIONS = [
  ['ITEM_MEGITE', 'Megite', 6, 'Custom universal Mega Evolution stone used by this integration.'],
  ['ITEM_ABILITY_PATCH', 'Ability Patch', 8, 'Changes between the Hidden Ability and supported standard Ability slot.'],
  ['ITEM_THROAT_SPRAY', 'Throat Spray', 8, 'A sound move consumes it to raise Special Attack.'],
  ['ITEM_EJECT_PACK', 'Eject Pack', 8, 'A stat reduction consumes it and switches the holder out.'],
  ['ITEM_HEAVY_DUTY_BOOTS', 'Heavy-Duty Boots', 8, 'Ignores entry hazards when switching in.'],
  ['ITEM_BLUNDER_POLICY', 'Blunder Policy', 8, 'An accuracy miss consumes it to raise Speed by two stages.'],
  ['ITEM_ROOM_SERVICE', 'Room Service', 8, 'Consumes under Trick Room to lower the holder\'s Speed.'],
  ['ITEM_UTILITY_UMBRELLA', 'Utility Umbrella', 8, 'Shields its holder from rain and sun effects.'],
  ['ITEM_RUSTED_SWORD', 'Rusted Sword', 8, 'Enables Zacian\'s Crowned Sword form.'],
  ['ITEM_RUSTED_SHIELD', 'Rusted Shield', 8, 'Enables Zamazenta\'s Crowned Shield form.'],
  ['ITEM_ADAMANT_CRYSTAL', 'Adamant Crystal', 8, 'Selects Origin Dialga and strengthens Steel and Dragon moves.'],
  ['ITEM_LUSTROUS_GLOBE', 'Lustrous Globe', 8, 'Selects Origin Palkia and strengthens Water and Dragon moves.'],
  ['ITEM_GRISEOUS_CORE', 'Griseous Core', 8, 'Selects Origin Giratina and strengthens Ghost and Dragon moves.'],
  ['ITEM_ABILITY_SHIELD', 'Ability Shield', 9, 'Protects the holder\'s Ability from change, suppression and bypass.'],
  ['ITEM_CLEAR_AMULET', 'Clear Amulet', 9, 'Blocks stat reductions caused by opposing Pokémon.'],
  ['ITEM_MIRROR_HERB', 'Mirror Herb', 9, 'Copies an opponent\'s positive stat changes once.'],
  ['ITEM_PUNCHING_GLOVE', 'Punching Glove', 9, 'Boosts punching attacks and removes their contact effects.'],
  ['ITEM_COVERT_CLOAK', 'Covert Cloak', 9, 'Blocks additional effects of damaging moves.'],
  ['ITEM_LOADED_DICE', 'Loaded Dice', 9, 'Biases multi-strike attacks toward more hits.'],
  ['ITEM_BOOSTER_ENERGY', 'Booster Energy', 9, 'Consumes to activate Protosynthesis or Quark Drive without their environment.'],
  ['ITEM_WELLSPRING_MASK', 'Wellspring Mask', 9, 'Selects Ogerpon\'s Wellspring form and Water-type Ivy Cudgel.'],
  ['ITEM_HEARTHFLAME_MASK', 'Hearthflame Mask', 9, 'Selects Ogerpon\'s Hearthflame form and Fire-type Ivy Cudgel.'],
  ['ITEM_CORNERSTONE_MASK', 'Cornerstone Mask', 9, 'Selects Ogerpon\'s Cornerstone form and Rock-type Ivy Cudgel.'],
];
const FORM_ITEMS = new Set(['ITEM_RUSTED_SWORD', 'ITEM_RUSTED_SHIELD', 'ITEM_ADAMANT_CRYSTAL',
  'ITEM_LUSTROUS_GLOBE', 'ITEM_GRISEOUS_CORE', 'ITEM_WELLSPRING_MASK', 'ITEM_HEARTHFLAME_MASK', 'ITEM_CORNERSTONE_MASK']);
const ABILITY_PENDING = new Map([
  [225, 'Memory items and Silvally\'s item-driven typing/form service are not integrated.'],
  [237, 'Failed-Poké-Ball retrieval in wild battles is not implemented.'],
  [256, 'Global ability suppression and restoration are not implemented.'],
  [303, 'Ogerpon masks and Terastallization-dependent stat effects are not integrated.'],
  [304, 'Terapagos\'s automatic entry form change is not integrated.'],
  [306, 'Stellar-form activation and its weather/terrain reset are not integrated.'],
]);
const ABILITY_LIMITS = new Map([
  [185, 'Second ordinary hit uses quarter final damage; existing fixed-damage exceptions remain.'],
  [209, 'Mimikyu-only; one 1/8-max-HP bust cost.'],
  [210, 'Uses the integration\'s Greninja form-change policy.'],
  [241, 'Prey damage/status mechanics exist; dedicated Gulping/Gorging artwork is not bundled.'],
  [266, 'Unnerve plus Chilling Neigh; access to Calyrex fusion forms is a separate feature.'],
  [267, 'Unnerve plus Grim Neigh; access to Calyrex fusion forms is a separate feature.'],
  [305, 'Registered full-HP damage effect only; Terapagos form access and Terastallization are not supplied.'],
]);
const generationOfAbility = id => id <= 191 ? 6 : id <= 233 ? 7 : id <= 267 ? 8 : 9;
const statusLabel = completed => completed ? 'Implemented — unverified' : 'Pending';
const unfinished = 'Current integration remains unverified.';

export function reconcileBattleProgress(input) {
  const { abilityIds, itemIds, abilityNames, abilityDescriptions, itemNames, registry, sources, dataItems } = input;
  const progress = structuredClone(input.progress);
  const routes = { ability: new Map(), item: new Map() };
  for (const module of registry.modules) for (const [kind, constant, handler] of module.entries) {
    if (!routes[kind]) continue;
    const id = (kind === 'ability' ? abilityIds : itemIds).get(constant);
    if (!Number.isInteger(id)) throw new Error(`Registry ID is unresolved: ${constant}`);
    if (routes[kind].has(id)) throw new Error(`Duplicate ${kind} registration ${id}`);
    routes[kind].set(id, { module: module.name, handler });
  }
  const aliases = new Map([...sources.abilities.matchAll(/W2U_VANILLA_ABILITY_ALIAS\((ABIL_\w+),\s*(\d+)\)/g)]
    .map(match => [abilityIds.get(match[1]), Number(match[2])]));
  const hookAbilities = new Set(['ABIL_LONG_REACH', 'ABIL_CORROSION', 'ABIL_COMATOSE']);
  const preferred = new Map([[214, 'ABIL_QUEENLY_MAJESTY'], [266, 'ABIL_AS_ONE_GLASTRIER'], [267, 'ABIL_AS_ONE_SPECTRIER']]);
  const existing = new Map(input.abilities.map(row => [row.id, row]));
  const constants = new Map();
  for (const [constant, id] of abilityIds) if (id >= 165 && id <= 314) constants.set(id, preferred.get(id) ?? existing.get(id)?.constant ?? constant);
  const abilities = [...constants].sort((a, b) => a[0] - b[0]).map(([id, constant]) => {
    const old = existing.get(id) ?? {};
    const route = routes.ability.get(id);
    let completed = false, notes = '', method = 'not implemented', evidence = [];
    if (ABILITY_PENDING.has(id)) notes = ABILITY_PENDING.get(id);
    else if (route) {
      completed = true; method = 'on-demand module';
      notes = `${route.module}: ${route.handler}.`;
      evidence = ['src/pokeweb_gameplay/battle_modules/registry.json'];
    } else if (aliases.has(id)) {
      completed = true; method = 'native alias';
      notes = `Resident alias of native ability ${aliases.get(id)}.`;
      evidence = ['src/pokeweb_gameplay/w2u_abilities.cpp'];
    } else if (hookAbilities.has(constant) && sources.abilities.includes(constant)) {
      completed = true; method = 'resident hooks';
      notes = 'Resident battle hooks own this mechanic.';
      evidence = ['src/pokeweb_gameplay/w2u_abilities.cpp'];
    } else notes = 'No implemented module, native alias or reviewed resident service was found.';
    if (ABILITY_PENDING.has(id) && route) throw new Error(`Review pending policy for newly registered ability ${constant}`);
    const limit = ABILITY_LIMITS.get(id);
    notes = [notes, limit, unfinished].filter(Boolean).join(' ');
    let name = abilityNames.get(id) ?? old.name;
    if (id === 266) name = 'As One (Glastrier)';
    if (id === 267) name = 'As One (Spectrier)';
    if (!name) throw new Error(`Missing ability name ${id}`);
    const row = { ...old, key: old.key ?? constant, id, constant, name, generation: generationOfAbility(id),
      description: abilityDescriptions.get(id) ?? old.description ?? '', implementationStatus: statusLabel(completed),
      implementationMethod: method, evidence, defaultProgress: { ...old.defaultProgress, battleCode: completed, verified: false, notes } };
    progress.progress.abilities[row.key] = { ...progress.progress.abilities[row.key], ...row.defaultProgress };
    return row;
  });
  const items = structuredClone(input.items);
  for (const [constant, name, generation, description] of ITEM_ADDITIONS) {
    let row = items.find(row => row.key === constant);
    if (!row) { row = { key: constant, constant, name, generation, description, defaultProgress: {} }; items.push(row); }
    else Object.assign(row, { generation, description });
  }
  for (const row of items) {
    const id = itemIds.get(row.constant), route = routes.item.get(id);
    const hasData = dataItems.has(row.constant);
    let completed = false, method = 'not implemented', notes = '', evidence = [];
    if (id === undefined) notes = `${FORM_ITEMS.has(row.constant) ? 'Form/item dependency is not integrated.' : 'Battle effect is not implemented.'} No integration item slot or data record is assigned.`;
    else if (!hasData) notes = 'An ID exists, but its integration item-data record is absent.';
    else if (route) {
      completed = true; method = 'on-demand module'; notes = `${route.module}: ${route.handler}.`;
      evidence = ['include/Items.h', 'src/pokeweb_gameplay/battle_modules/registry.json'];
    } else if (['ITEM_ABILITY_CAPSULE', 'ITEM_ABILITY_PATCH'].includes(row.constant) && sources.fieldItems.includes(row.constant)) {
      completed = true; method = 'field-item service'; notes = 'Implemented field ability-slot change; not an in-battle consumable.';
      evidence = ['src/pokeweb_gameplay/w2u_field_items.cpp'];
    } else if (row.constant === 'ITEM_BOOSTER_ENERGY' && sources.protosynthesis.includes('BattleMon_GetHeldItem(bm) == ITEM_BOOSTER_ENERGY')) {
      completed = true; method = 'ability-owned module'; notes = 'abilities/mb_terrain owns activation and consumption through Protosynthesis/Quark Drive.';
      evidence = ['src/pokeweb_gameplay/megab2w2/abilities/Protosynthesis.cpp'];
    } else if (row.constant === 'ITEM_PROTECTIVE_PADS' && sources.abilities.includes('ITEM_PROTECTIVE_PADS')) {
      completed = true; method = 'resident hooks'; notes = 'Resident contact-reaction checks suppress the protected contact effects.';
      evidence = ['src/pokeweb_gameplay/w2u_abilities.cpp'];
    } else if (row.constant === 'ITEM_MEGA_RING' || sources.mega.includes(`, ${row.constant},`) || row.constant === 'ITEM_MEGITE' && sources.mega.includes('ITEM_MEGITE')) {
      completed = true; method = 'resident Mega system'; notes = row.constant === 'ITEM_MEGITE'
        ? 'Custom universal stone; uses the integration\'s existing Mega/G-Max-derived routes.'
        : 'Resident Mega system and item data are present; inventory/UI behavior remains unverified.';
      evidence = ['src/pokeweb_gameplay/w2u_mega.cpp'];
    } else notes = 'An ID/data record exists, but no reviewed implementation was found.';
    row.id = id ?? null;
    row.name = itemNames.get(id) ?? row.name;
    row.generation ??= row.constant === 'ITEM_FAIRY_FEATHER' ? 9 : /^ITEM_(?:PROTECTIVE_PADS|TERRAIN_EXTENDER|(?:ELECTRIC|GRASSY|PSYCHIC|MISTY)_SEED)$/.test(row.constant) ? 7 : 6;
    row.implementationStatus = statusLabel(completed);
    row.implementationMethod = method;
    row.evidence = evidence;
    row.defaultProgress = { ...row.defaultProgress, battleCode: completed,
      itemIcon: id !== undefined && hasData && (input.iconItems.has(row.constant) || row.defaultProgress?.itemIcon === true),
      verified: false, notes: `${notes} ${unfinished}` };
    progress.progress.items[row.key] = { ...progress.progress.items[row.key], ...row.defaultProgress };
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const rows of [abilities, items]) {
    if (new Set(rows.map(row => row.key)).size !== rows.length) throw new Error('Duplicate tracker key');
    const ids = rows.map(row => row.id).filter(id => id !== null);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate assigned tracker ID');
  }
  // These dependencies are still deferred even if an old published override
  // claims otherwise. Leave animation progress and every other category alone.
  for (const [key, notes] of [
    ['MOVE_MULTI_ATTACK', 'Deferred: Memory items and Silvally item-driven typing/form support are not integrated.'],
    ['MOVE_IVY_CUDGEL', 'Deferred: Ogerpon masks and mask-dependent type selection are not integrated.'],
  ]) if (progress.progress.moves[key]) progress.progress.moves[key] = { ...progress.progress.moves[key], effectHandler: false, verified: false, notes };
  return { abilities, items, progress };
}
