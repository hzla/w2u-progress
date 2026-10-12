import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function model() {
  const source=readFileSync(path.join(root,'app.js'),'utf8');
  assert.ok(source.includes('  init();'));
  const sandbox={document:{querySelectorAll:()=>[],querySelector:()=>({}),getElementById:()=>({})},
    window:{location:{hostname:'hzla.github.io'}},localStorage:{getItem:()=>null}};
  // Exercise the site's real filter/merge functions without starting its DOM
  // or network layer. The production source is not modified by this harness.
  vm.runInNewContext(source.replace('  init();', 'globalThis.unit={state,generationForRow,rowMatchesFilter,filterAvailableForTab,getVisibleRows};'),sandbox);
  const {unit}=sandbox;
  for(const category of ['pokemon','moves','items','abilities'])
    unit.state.seeds[category]=JSON.parse(readFileSync(path.join(root,`data/${category}.gen6.json`),'utf8'));
  unit.state.publishedProgress=JSON.parse(readFileSync(path.join(root,'data/published-progress.json'),'utf8')).progress;
  return unit;
}
test('generation filters use the actual catalog and explicit repurposed item generations',()=>{
  const unit=model();
  for(const [category,counts]of [['abilities',[27,42,34,47]],['items',[56,6,12,11]]]) {
    unit.state.activeTab=category;
    for(const [index,gen]of [6,7,8,9].entries()) {
      unit.state.generation=String(gen);assert.equal(unit.getVisibleRows().length,counts[index]);
    }
  }
  const booster=unit.state.seeds.items.find(row=>row.key==='ITEM_BOOSTER_ENERGY');
  assert.equal(unit.generationForRow('items',booster),9);
  assert.equal(unit.generationForRow('items',unit.state.seeds.items.find(row=>row.key==='ITEM_LOADED_DICE')),9);
});
test('missing-effect excludes completed-but-unverified mechanics and includes dependencies',()=>{
  const unit=model();unit.state.filter='missingEffect';unit.state.activeTab='abilities';
  assert.equal(unit.getVisibleRows().length,6);
  unit.state.generation='8';assert.deepEqual(Array.from(unit.getVisibleRows(),row=>row.name),['Ball Fetch','Neutralizing Gas']);
  unit.state.generation='9';assert.deepEqual(Array.from(unit.getVisibleRows(),row=>row.name),['Embody Aspect','Tera Shift','Teraform Zero']);
  unit.state.activeTab='items';assert.equal(unit.getVisibleRows().length,9);
  unit.state.generation='8';assert.equal(unit.getVisibleRows().length,11);
  unit.state.activeTab='moves';unit.state.generation='all';
  assert.ok(unit.getVisibleRows().some(row=>row.id===718));assert.ok(unit.getVisibleRows().some(row=>row.id===904));
});
test('verified stays empty for the reconciled integration abilities and items',()=>{
  const unit=model();unit.state.filter='verified';
  for(const category of ['abilities','items']){unit.state.activeTab=category;assert.equal(unit.getVisibleRows().length,0);}
  unit.state.filter='open';unit.state.activeTab='abilities';assert.equal(unit.getVisibleRows().length,150);
});
test('effect filter hides on Pokemon and no frontend script/data cache key is stale',()=>{
  const unit=model();assert.equal(unit.filterAvailableForTab('missingEffect','pokemon'),false);
  for(const category of ['moves','items','abilities'])assert.equal(unit.filterAvailableForTab('missingEffect',category),true);
  const html=readFileSync(path.join(root,'index.html'),'utf8'),js=readFileSync(path.join(root,'app.js'),'utf8');
  const version=/const DATA_VERSION = "([^"]+)"/.exec(js)[1];
  assert.ok(html.includes(`app.js?v=${version}`));
});
test('tracker introduction uses the requested project description',()=>{
  const html=readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes('<p class="save-status">This is an artifact of an auto-generated tracker I made to better help me keep track of sprite/animation credits as well as a way to keep track of which moves/abilities have been implemented/verified in w2u-project</p>'));
  assert.ok(!html.includes('Current White 2 integration assets.'));
});
