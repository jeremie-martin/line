/** Rebuild only the compiler engine; leave the independent judge untouched. */
import {readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = new URL('../../', import.meta.url), native = new URL('scripts/lib/native_motion/', root);
const target = new URL('generated/native-motion-target/', root);
execFileSync('cargo', ['build', '--locked', '--release', '--target', 'wasm32-unknown-unknown',
  '--manifest-path', fileURLToPath(new URL('Cargo.toml', native)), '--target-dir', fileURLToPath(target)], {stdio: 'inherit'});
copyFileSync(new URL('wasm32-unknown-unknown/release/lr_engine.wasm', target), new URL('engine.wasm', native));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestPath = new URL('manifest.json', native), manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const name of Object.keys(manifest.generated)) manifest.generated[name] = hash(readFileSync(new URL(name, native)));
writeFileSync(manifestPath, JSON.stringify(manifest) + '\n');
writeFileSync(new URL('manifest.json.sha256', native), hash(readFileSync(manifestPath)) + '\n');
console.log(`Packaged compiler engine ${manifest.generated['engine.wasm']}`);
