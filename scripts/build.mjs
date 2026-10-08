import { mkdir, readFile, writeFile, readdir, copyFile, unlink, rmdir, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { transform, build } from 'esbuild';
import { prepareRuntime } from './prepare-runtime.mjs';
import { publicFiles, safePublicFile, isInside } from './static-assets.mjs';
import { buildServer } from './build-server.mjs';
import { createHash } from 'node:crypto';

async function removeUnlistedFiles(root, allowed, directory = '') {
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const name = directory ? `${directory}/${entry.name}` : entry.name;
    const file = resolve(root, name);
    if (!isInside(root, file)) throw new Error('Refusing cleanup outside the generated distribution.');
    if (entry.isSymbolicLink()) await unlink(file);
    else if (entry.isDirectory()) {
      await removeUnlistedFiles(root, allowed, name);
      if (!(await readdir(file)).length) await rmdir(file);
    } else if (!allowed.has(name)) await unlink(file);
  }
}

const checkOnly = process.argv.includes('--check');
await buildServer(checkOnly);
const models = (await readdir('src/models')).filter((file) => file.endsWith('.ts'));
const sources = models.map((file) => join('src/models', file));
const stale = [];
const application = await build({ entryPoints: ['src/bootstrap.ts'], bundle: true, write: false, format: 'iife', target: 'es2020', legalComments: 'none' });
const appCode = `// Generated from src/bootstrap.ts and src/app.ts; run npm run build.\n${application.outputFiles[0].text}`;
if (checkOnly) {
  if (await readFile('src/app.js', 'utf8') !== appCode) stale.push('src/app.js');
} else {
  await writeFile('src/app.js', appCode, 'utf8');
}
for (const source of sources) {
  const input = await readFile(source, 'utf8');
  const result = await transform(input, { loader: 'ts', target: 'es2020', format: 'iife', legalComments: 'none' });
  const output = source.replace(/\.ts$/, '.js');
  const code = `// Generated from ${source.replaceAll('\\', '/')}; run npm run build.\n${result.code}`;
  if (checkOnly) {
    const existing = await readFile(output, 'utf8');
    if (existing !== code) stale.push(output);
  } else {
    await writeFile(output, code, 'utf8');
  }
}
if (checkOnly) {
  if (stale.length) throw new Error(`Generated JavaScript is stale: ${stale.join(', ')}`);
  process.stdout.write('TypeScript and browser JavaScript are synchronized.\n');
} else {
  const destination = resolve('dist');
  await mkdir(destination, { recursive: true });
  if ((await lstat(destination)).isSymbolicLink()) throw new Error('The generated distribution cannot be a directory link.');
  const allowed = await publicFiles(resolve('.'));
  await removeUnlistedFiles(destination, allowed);
  await prepareRuntime();
  await prepareRuntime(resolve('dist/vendor'));
  for (const name of allowed) {
    if (name === 'offline-manifest.json') continue;
    const source = await safePublicFile(resolve('.'), name);
    if (!source) throw new Error(`Public asset escapes the project: ${name}`);
    const target = resolve(destination, name);
    if (!isInside(destination, target)) throw new Error('Invalid public distribution path.');
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  const assets = [];
  for (const name of [...allowed].sort()) {
    if (name === 'offline-manifest.json' || name.startsWith('admin') || name === 'src/ui/admin.js' || name === 'src/ui/refinement-scene-preview.js' || name === 'styles/admin.css' || name.startsWith('docs/') || name.startsWith('evidence/')) continue;
    const bytes = await readFile(resolve(destination,name));
    assets.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),detail:name.startsWith('src/models/')||name.endsWith('.glb')});
  }
  const version=createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,20);
  const offlineManifest=JSON.stringify({schemaVersion:1,version,generatedAt:new Date().toISOString(),assets},null,2)+'\n';
  await writeFile('offline-manifest.json',offlineManifest,'utf8');
  await writeFile(resolve(destination,'offline-manifest.json'),offlineManifest,'utf8');
  process.stdout.write(`Production static build prepared in dist/ (${sources.length} synchronized TS entries).\n`);
}
