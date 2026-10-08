// Isolated browser fixtures. These accounts never enter the normal application database.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { CampusRepository } from '../server/platform.mjs';

const temporary = mkdtempSync(join(tmpdir(), 'hanshin-browser-'));
if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep) || !basename(temporary).startsWith('hanshin-browser-')) throw new Error('Unsafe browser fixture directory.');
process.env.PORT = '8767';
process.env.CAMPUS_DB_PATH = join(temporary, 'browser.sqlite');
process.env.CAMPUS_PUBLIC_ORIGIN = 'http://127.0.0.1:8767';
process.env.CAMPUS_BIND_HOST = '127.0.0.1';
delete process.env.CAMPUS_PROVIDERS_FILE;
delete process.env.CAMPUS_EMBED_ORIGINS;
delete process.env.CAMPUS_TRUSTED_PROXY_IPS;
const repository = new CampusRepository(resolve('.'), process.env.CAMPUS_DB_PATH);
for (const role of ['admin', 'editor', 'reviewer']) repository.createUser(role, 'CampusFixture!2026', role, role === 'admin' ? [] : ['hanshin-gg']);
repository.close();
process.on('exit', () => {
  try { rmSync(temporary, { recursive: true }); }
  catch { process.stderr.write('Browser fixture cleanup was deferred because a file is still in use.\n'); }
});
process.argv.push('--platform');
await import('./serve.mjs');
