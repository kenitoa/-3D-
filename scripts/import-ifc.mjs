import { readFile, writeFile, mkdtemp, mkdir, stat, lstat, realpath, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeTriangleGlb } from './glb-writer.mjs';
import '../src/domain/refinement.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), worker = resolve(root, 'scripts/ifc-worker.py');
const inside = (base, target) => { const path = relative(base, target); return path !== '' && !path.startsWith('..') && !isAbsolute(path); };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const object = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const point = (value) => Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item) && Math.abs(item) < 1e9);
export function validateIfcRequest(request) {
  if (!object(request) || !Array.isArray(request.publicAllowlist) || !request.publicAllowlist.length || request.publicAllowlist.length > 5000 || !point(request.sourceOriginMeters) || typeof request.sourceId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(request.sourceId) || typeof request.license !== 'string' || !request.license.trim()) throw new Error('IFC conversion requires explicit public product IDs, source origin, evidence and reuse rights.');
  const guids = new Set();
  for (const item of request.publicAllowlist) {
    if (!object(item) || typeof item.globalId !== 'string' || !/^[0-3][a-zA-Z0-9_$]{21}$/.test(item.globalId) || guids.has(item.globalId) || typeof item.spaceId !== 'string' || !/^[a-z0-9][a-z0-9:_-]{0,159}$/.test(item.spaceId)) throw new Error('Invalid or duplicate selected IFC product identity.');
    guids.add(item.globalId);
  }
  const p = request.placement;
  if (!object(p) || p.units !== 'm' || p.upAxis !== 'Y' || !point(p.origin) || p.origin.some((value) => value !== 0) || !point(p.anchorMeters) || !Number.isFinite(p.yawRadians) || !['local-site-meters', 'terrain-relative'].includes(p.altitudeDatum) || !['inferred', 'measured'].includes(p.mode)) throw new Error('Normalized IFC geometry requires explicit meter placement with origin zero.');
  return request;
}
async function subprocess(python, request, directory, timeoutMs) {
  if (typeof python !== 'string' || !isAbsolute(python) || !(await stat(python)).isFile()) throw new Error('Configure an absolute CAMPUS_IFC_PYTHON interpreter with the optional pinned IFC requirements.');
  return new Promise((done, reject) => {
    // -I prevents Python importing from the source directory or environment PYTHONPATH.
    const child = spawn(python, ['-I', worker], { cwd: directory, windowsHide: true, shell: false, env: { ...process.env, PYTHONPATH: '', PYTHONUTF8: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let count = 0, settled = false;
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else done(result); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('IFC conversion exceeded its timeout.')); }, timeoutMs);
    child.on('error', () => finish(new Error('The optional IFC interpreter could not be started.')));
    child.stdout.on('data', (bytes) => { count += bytes.length; if (count > 64 * 1024 * 1024) { child.kill(); finish(new Error('IFC output exceeded the 64 MiB conversion limit.')); } else chunks.push(bytes); });
    // Deliberately discard private model diagnostics; the worker returns a bounded generic failure.
    child.stderr.on('data', () => {});
    child.on('close', (code) => { if (code !== 0) return finish(new Error('IFC conversion failed. Install the pinned toolchain and verify the selected building products.')); try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish(new Error('IFC conversion returned invalid public geometry.')); } });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(request));
  });
}
async function cleanupPrivateDirectory(directory) {
  const actual = await realpath(directory);
  if (!inside(await realpath(tmpdir()), actual) || !actual.split(/[\\/]/).pop().startsWith('campus-ifc-')) throw new Error('Refusing cleanup outside the private conversion directory.');
  await rm(actual, { recursive: true, force: false });
}
export async function convertIfc({ input, request, python = process.env.CAMPUS_IFC_PYTHON, timeoutMs = 120000 }) {
  validateIfcRequest(request);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000 || typeof input !== 'string' || !/\.ifc$/i.test(input)) throw new Error('Only IFC-SPF files and bounded conversion timeouts are supported.');
  const path = resolve(input), fileStat = await lstat(path);
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size < 20 || fileStat.size > 128 * 1024 * 1024 || await realpath(path) !== path) throw new Error('The IFC input must be a regular bounded file, without a path link.');
  const source = await readFile(path);
  if (!source.subarray(0, 100).toString('utf8').trimStart().startsWith('ISO-10303-21;')) throw new Error('Unsupported IFC container. Use a raw IFC-SPF input.');
  const directory = await mkdtemp(join(tmpdir(), 'campus-ifc-'));
  try {
    const snapshot = join(directory, 'input.ifc'); await writeFile(snapshot, source, { mode: 0o600, flag: 'wx' });
    const result = await subprocess(python, { input: snapshot, publicAllowlist: request.publicAllowlist, sourceOriginMeters: request.sourceOriginMeters }, directory, timeoutMs);
    if (!object(result) || result.schemaVersion !== 1 || !Array.isArray(result.groups) || result.groups.length !== request.publicAllowlist.length) throw new Error('IFC conversion returned incomplete selected geometry.');
    const allowedSpaces = new Set(request.publicAllowlist.map((item) => item.spaceId));
    for (const group of result.groups) if (!object(group) || !allowedSpaces.has(group.spaceId)) throw new Error('IFC conversion returned a non-public space identity.');
    const glb = writeTriangleGlb(result.groups, { extras: { confirmation: request.placement.mode === 'measured' ? 'source-placement-declared' : 'estimated', sourceId: request.sourceId, campusCoordinateConvention: 'babylon-auto-lh-x-reflection-v1' } });
    const buffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), statistics = globalThis.CampusRefinement.inspectGlb(buffer);
    return { glb, report: { schemaVersion: 1, engine: result.engine, engineVersion: result.engineVersion, sourceSchema: result.schema, sourceUnitScaleMeters: result.sourceUnitScaleMeters, sourceSha256: hash(source), sourceId: request.sourceId, license: request.license, selectedProducts: request.publicAllowlist.length, publicSpaceIds: [...allowedSpaces].sort(), sha256: hash(glb), statistics, placement: request.placement, confirmationUnchanged: true, privacy: 'only explicit selected geometry; source attributes and raw product IDs excluded' }, privateMapping: { sourceSha256: hash(source), products: request.publicAllowlist } };
  } finally {
    await cleanupPrivateDirectory(directory);
  }
}
async function writeNew(path, bytes) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, config, output, ...extra] = process.argv.slice(2);
  if (!input || !config || !output || extra.length) throw new Error('Usage: CAMPUS_IFC_PYTHON=<absolute-python> node scripts/import-ifc.mjs source.ifc private-selection.json assets/models/new-model.glb');
  const outputPath = resolve(output), normalized = relative(root, outputPath).replaceAll('\\', '/');
  if (!/^assets\/models\/[a-zA-Z0-9_/-]+\.glb$/.test(normalized) || normalized.includes('..')) throw new Error('Converted public geometry must be a new assets/models/*.glb path.');
  await mkdir(dirname(outputPath), { recursive: true });
  if (!inside(await realpath(root), await realpath(dirname(outputPath)))) throw new Error('Public conversion output cannot traverse a directory link.');
  const request = JSON.parse(await readFile(resolve(config), 'utf8')), result = await convertIfc({ input, request });
  // GUID mapping and the input IFC stay private; the public GLB never contains either.
  const mapping = resolve(root, 'var/ifc-mappings', `${result.report.sourceSha256}-${result.report.sha256}.json`);
  await writeNew(mapping, JSON.stringify(result.privateMapping, null, 2) + '\n');
  await writeNew(`${outputPath}.audit.json`, JSON.stringify(result.report, null, 2) + '\n');
  await writeNew(outputPath, result.glb);
  process.stdout.write(`Converted ${result.report.selectedProducts} selected products to ${result.report.statistics.triangles} triangles. Geometry remains a review candidate until approved.\n`);
}
