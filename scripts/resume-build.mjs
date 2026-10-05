import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
console.log(readFileSync(new URL('../docs/BUILD_STATUS.md', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--status-only')) throw new Error('Supported option: --status-only');
if (args.includes('--status-only')) process.exit(0);
if (!existsSync(new URL('../node_modules/typescript', import.meta.url))) {
  console.error('Dependencies missing. Run npm ci, then rerun resume:build.');
  process.exit(2);
}
const hash = createHash('sha256');
function include(path) {
  const full = join(root,path);
  if (!existsSync(full)) return;
  if (['apps','packages','tests','migrations','scripts','docs','data/reference'].includes(path) || path.includes('/') && !/\.[a-z]+$/i.test(path)) {
    for (const entry of readdirSync(full, {withFileTypes:true}).sort((a,b) => a.name < b.name ? -1 : 1)) {
      if (entry.isDirectory()) include(join(path,entry.name));
      else {hash.update(join(path,entry.name));hash.update(readFileSync(join(full,entry.name)));}
    }
  } else {hash.update(path);hash.update(readFileSync(full));}
}
for (const path of ['README.md','PRODUCTION_READINESS.md','playwright.config.mjs','package.json','package-lock.json','tsconfig.json','eslint.config.mjs','apps','packages','tests','migrations','scripts','docs','data/reference']) include(path);
const fingerprint = hash.digest('hex');
const lastCheck = new URL('../.runtime/last-resume-check.json', import.meta.url);
if (existsSync(lastCheck)) {
  const previous = JSON.parse(readFileSync(lastCheck,'utf8'));
  if (previous.exitCode === 0 && previous.fingerprint === fingerprint) {
    console.log('Existing passing check matches unchanged inputs. Continue from checkpoint; no repeat testing needed.');
    process.exit(0);
  }
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'check'], { cwd: root, stdio: 'inherit' });
const code = result.status ?? 1;
mkdirSync(new URL('../.runtime/', import.meta.url), { recursive: true });
writeFileSync(lastCheck, JSON.stringify({ checkedAt: new Date().toISOString(), fingerprint, exitCode: code, next: 'Agent reads checkpoint and continues; script does not perform autonomous financial decisions.' }, null, 2));
if (result.error) console.error(result.error.message);
process.exit(code);
