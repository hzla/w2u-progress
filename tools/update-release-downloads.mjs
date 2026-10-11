import { readFile, writeFile, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [romPath, cleanPath, patchPath, savePath] = process.argv.slice(2);
if (!romPath || !cleanPath || !patchPath || !savePath)
  throw new Error('Usage: update-release-downloads.mjs INTEGRATION_ROM CLEAN_WHITE2_ROM VERIFIED_XDELTA RAW_DEMO_SAVE');
const hash = b => createHash('sha256').update(b).digest('hex');
const rom = await readFile(romPath), clean = await readFile(cleanPath), patch = await readFile(patchPath), raw = await readFile(savePath);
if (rom.toString('ascii',12,16) !== 'IRDO' || clean.toString('ascii',12,16) !== 'IRDO') throw new Error('Expected US White 2 inputs');
if (raw.length !== 0x80000) throw new Error('Expected a 512 KiB raw demo save');
const previous = await readFile(path.join(root,'downloads/demosave.dsv'));
const footer = previous.subarray(0x80000);
if (footer.length !== 122 || !footer.toString('ascii').endsWith('|-DESMUME SAVE-|')) throw new Error('Unsupported DeSmuME save footer');
const temporary = await mkdtemp(path.join(tmpdir(),'w2u-patch-verify-'));
try {
  const decoded = path.join(temporary,'patched.nds');
  execFileSync('xdelta3',['-d','-s',path.resolve(cleanPath),path.resolve(patchPath),decoded]);
  if (!(await readFile(decoded)).equals(rom)) throw new Error('Patch does not reproduce the integration ROM');
} finally {
  await rm(path.join(temporary,'patched.nds'),{force:true});
  await rmdir(temporary);
}
const save = Buffer.concat([raw,footer]);
await writeFile(path.join(root,'downloads/White2Upgrade.xdelta'),patch);
await writeFile(path.join(root,'downloads/demosave.dsv'),save);
await writeFile(path.join(root,'downloads/White2Upgrade.dsv'),save);
await writeFile(path.join(root,'data/release-manifest.json'),JSON.stringify({
  version:1, updatedAt:new Date().toISOString(), status:'Integration build; behavior and visuals not fully verified',
  sourceRom:{name:'cleanwhite2.nds',sha256:hash(clean),bytes:clean.length},
  integrationRom:{name:path.basename(romPath),sha256:hash(rom),bytes:rom.length},
  patch:{path:'downloads/White2Upgrade.xdelta',sha256:hash(patch),bytes:patch.length,decodedByteIdentical:true},
  save:{path:'downloads/demosave.dsv',sha256:hash(save),bytes:save.length,rawSha256:hash(raw),rawBytes:raw.length,
    description:'Current Gen 6–9 PC collection; raw save preserved in a DeSmuME-compatible wrapper'},
},null,2)+'\n');
console.log('Updated patch and demo saves; patch decode is byte-identical and the source raw save is unchanged.');
