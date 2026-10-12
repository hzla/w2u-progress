import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseConstants, parseMessageBank, reconcileBattleProgress, ITEM_ADDITIONS } from '../lib/battle-progress.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const json = name => JSON.parse(readFileSync(path.join(root, 'data', name), 'utf8'));
function fixture() {
  const abilityIds = new Map([['ABIL_AROMA_VEIL', 165], ['ABIL_QUEENLY_MAGESTY', 214], ['ABIL_QUEENLY_MAJESTY', 214],
    ['ABIL_LONG_REACH', 203], ['ABIL_RKS_SYSTEM', 225], ['ABIL_BALL_FETCH', 237], ['ABIL_GULP_MISSILE', 241],
    ['ABIL_NEUTRALIZING_GAS', 256], ['ABIL_CHILLING_NEIGH', 264], ['ABIL_TERA_SHELL', 305]]);
  const itemIds = new Map([['ITEM_ASSAULT_VEST', 121], ['ITEM_ABILITY_PATCH', 130], ['ITEM_BOOSTER_ENERGY', 426], ['ITEM_MEGITE', 113]]);
  const names = new Map([...abilityIds].map(([constant, id]) => [id, constant]));
  return { abilities: [{key:'ABIL_QUEENLY_MAJESTY',constant:'ABIL_QUEENLY_MAJESTY',id:214,name:'Queenly Majesty',defaultProgress:{verified:true}}],
    items: [{key:'ITEM_ASSAULT_VEST',constant:'ITEM_ASSAULT_VEST',id:121,name:'Assault Vest',defaultProgress:{battleCode:true,itemIcon:true,verified:true}}],
    progress: {updatedAt:'unchanged',progress:{pokemon:{sentinel:{verified:true}},moves:{MOVE_MULTI_ATTACK:{animation:true,effectHandler:true},MOVE_IVY_CUDGEL:{animation:true,effectHandler:true}},
      abilities:{ABIL_QUEENLY_MAJESTY:{verified:true}},items:{ITEM_ASSAULT_VEST:{verified:true}}}},
    abilityIds, itemIds, abilityNames:names, abilityDescriptions:new Map(), itemNames:new Map(),
    registry:{modules:[{name:'abilities/test',entries:[['ability','ABIL_AROMA_VEIL','Aroma'],['ability','ABIL_QUEENLY_MAGESTY','Queen'],
      ['ability','ABIL_GULP_MISSILE','Gulp'],['ability','ABIL_TERA_SHELL','Tera']]},{name:'items/test',entries:[['item','ITEM_ASSAULT_VEST','Vest']]}]},
    sources:{abilities:'ABIL_LONG_REACH; ABIL_RKS_SYSTEM; W2U_VANILLA_ABILITY_ALIAS(ABIL_CHILLING_NEIGH, 153)',
      fieldItems:'ITEM_ABILITY_PATCH', mega:'ITEM_MEGITE', protosynthesis:'BattleMon_GetHeldItem(bm) == ITEM_BOOSTER_ENERGY'},
    dataItems:new Set(['ITEM_ASSAULT_VEST','ITEM_ABILITY_PATCH','ITEM_BOOSTER_ENERGY','ITEM_MEGITE']),
    iconItems:new Set(['ITEM_ABILITY_PATCH','ITEM_BOOSTER_ENERGY','ITEM_MEGITE'])};
}

test('constants resolve numeric IDs and aliases without treating mentions as definitions', () => {
  const ids=parseConstants('#define ITEM_A 0x80\nITEM_A;\n enum Abil {\n ABIL_TEST = 266,\n ABIL_ALIAS = ABIL_TEST,\n};','ABIL_');
  assert.equal(ids.get('ABIL_ALIAS'),266);assert.equal(ids.has('ITEM_A'),false);
  assert.equal(parseConstants('#define ITEM_A 0x80','ITEM_').get('ITEM_A'),128);
  assert.throws(()=>parseConstants('ABIL_A = ABIL_B,\nABIL_B = ABIL_A,','ABIL_'),/Cyclic/);
  assert.throws(()=>parseConstants('ABIL_A = ABIL_MISSING,','ABIL_'),/Unknown/);
});
test('message rows join wrapped lines and strip only the terminal control marker', () => {
  const bank=parseMessageBank('[msg.section_0.entries.268]\ntext = ["Lingering ","Aroma$"]\n[msg.section_0.entries.269]\ntext = ["A\\\\nB$"]');
  assert.equal(bank.get(268),'Lingering Aroma');assert.equal(bank.get(269),'A B');
});
test('registered, native-aliased and reviewed hook abilities are complete but unverified', () => {
  const result=reconcileBattleProgress(fixture());
  for(const id of [165,203,214,241,264,305]) {
    const row=result.abilities.find(row=>row.id===id);assert.equal(row.defaultProgress.battleCode,true);assert.equal(row.defaultProgress.verified,false);
  }
  assert.equal(result.abilities.find(row=>row.id===214).key,'ABIL_QUEENLY_MAJESTY');
  assert.match(result.abilities.find(row=>row.id===241).defaultProgress.notes,/artwork is not bundled/);
});
test('named but unimplemented abilities stay unchecked and new registrations require policy review', () => {
  const input=fixture(),result=reconcileBattleProgress(input);
  for(const id of [225,237,256]) assert.equal(result.abilities.find(row=>row.id===id).defaultProgress.battleCode,false);
  input.registry.modules[0].entries.push(['ability','ABIL_NEUTRALIZING_GAS','Gas']);
  assert.throws(()=>reconcileBattleProgress(input),/Review pending policy/);
});
test('unassigned modern items never borrow canonical IDs or mark icons/effects complete', () => {
  const result=reconcileBattleProgress(fixture());
  for(const key of ['ITEM_LOADED_DICE','ITEM_HEAVY_DUTY_BOOTS','ITEM_RUSTED_SWORD','ITEM_WELLSPRING_MASK']) {
    const row=result.items.find(row=>row.key===key);assert.equal(row.id,null);assert.equal(row.defaultProgress.battleCode,false);assert.equal(row.defaultProgress.itemIcon,false);
    assert.ok([8,9].includes(row.generation));
  }
});
test('Booster Energy is ability-owned and Ability Patch is an explicit field service', () => {
  const result=reconcileBattleProgress(fixture());
  for(const key of ['ITEM_BOOSTER_ENERGY','ITEM_ABILITY_PATCH','ITEM_MEGITE','ITEM_ASSAULT_VEST']) {
    const row=result.items.find(row=>row.key===key);assert.equal(row.defaultProgress.battleCode,true);assert.equal(row.defaultProgress.verified,false);assert.equal(row.defaultProgress.itemIcon,true);
  }
  assert.equal(result.items.find(row=>row.id===426).generation,9);
  assert.equal(result.items.find(row=>row.id===130).generation,8);
  const input=fixture();input.sources.protosynthesis='';
  assert.equal(reconcileBattleProgress(input).items.find(row=>row.id===426).defaultProgress.battleCode,false);
});
test('ID or item data without an effect is not an implementation', () => {
  const input=fixture();input.itemIds.set('ITEM_LOADED_DICE',600);input.dataItems.add('ITEM_LOADED_DICE');
  assert.equal(reconcileBattleProgress(input).items.find(row=>row.key==='ITEM_LOADED_DICE').defaultProgress.battleCode,false);
  input.dataItems.delete('ITEM_ASSAULT_VEST');
  assert.equal(reconcileBattleProgress(input).items.find(row=>row.id===121).defaultProgress.battleCode,false);
});
test('input objects and unrelated progress remain untouched; form-dependent moves stay pending', () => {
  const input=fixture(),before=structuredClone(input),result=reconcileBattleProgress(input);
  assert.deepEqual(input,before);assert.deepEqual(result.progress.progress.pokemon,input.progress.progress.pokemon);
  for(const key of ['MOVE_MULTI_ATTACK','MOVE_IVY_CUDGEL']) {
    assert.equal(result.progress.progress.moves[key].effectHandler,false);assert.equal(result.progress.progress.moves[key].animation,true);
  }
  const again=reconcileBattleProgress({...input,abilities:result.abilities,items:result.items,progress:result.progress});
  assert.deepEqual(again,result);
});
test('numeric registry collisions are rejected even through aliases', () => {
  const input=fixture();input.registry.modules[0].entries.push(['ability','ABIL_QUEENLY_MAJESTY','Duplicate']);
  assert.throws(()=>reconcileBattleProgress(input),/Duplicate ability registration/);
  input.registry.modules[0].entries=[['ability','ABIL_UNKNOWN','Unknown']];
  assert.throws(()=>reconcileBattleProgress(input),/Registry ID is unresolved/);
});
test('published catalog covers every integration ability and the complete tracked modern item list', () => {
  const abilities=json('abilities.gen6.json'),items=json('items.gen6.json'),published=json('published-progress.json').progress;
  assert.equal(abilities.length,150);
  assert.deepEqual(abilities.map(row=>row.id),Array.from({length:150},(_,i)=>i+165));
  assert.deepEqual([6,7,8,9].map(gen=>abilities.filter(row=>row.generation===gen).length),[27,42,34,47]);
  for(const [constant] of ITEM_ADDITIONS) assert.ok(items.some(row=>row.key===constant),constant);
  for(const [category,rows] of [['abilities',abilities],['items',items]]) for(const row of rows) {
    assert.equal(row.defaultProgress.verified,false);assert.equal(published[category][row.key].verified,false);
    assert.equal(row.defaultProgress.battleCode,published[category][row.key].battleCode);
    if(row.id===null){assert.equal(row.defaultProgress.battleCode,false);assert.equal(row.defaultProgress.itemIcon,false);}
  }
});
test('release downloads remain bound to their existing manifest', () => {
  const release=json('release-manifest.json');
  assert.equal(release.integrationRom.sha256,'41ec23667f7e8ce0d6269a84d910a34a841ae8b5987d47654042bf4a95461140');
  assert.equal(release.save.rawSha256,'8acf8070686368e395b5e694dbb10d3350fb45f46e95a0b207c79ca80604f813');
  for(const asset of [release.patch,release.save]) {
    const data=readFileSync(path.join(root,asset.path));
    assert.equal(data.length,asset.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);
  }
});
