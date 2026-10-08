import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'evidence');
await mkdir(output, { recursive: true });
const collectedAt = new Date().toISOString();
const query = '[out:json][timeout:45];(nwr["amenity"="university"](37.185,127.015,37.205,127.04);way["building"](37.186,127.017,37.2,127.036);way["highway"](37.186,127.017,37.2,127.036);nwr["amenity"="parking"](37.186,127.017,37.2,127.036);nwr["leisure"](37.186,127.017,37.2,127.036);nwr["landuse"](37.186,127.017,37.2,127.036);nwr["natural"](37.186,127.017,37.2,127.036);nwr["waterway"](37.186,127.017,37.2,127.036);node["barrier"="gate"](37.186,127.017,37.2,127.036);node["entrance"](37.186,127.017,37.2,127.036););out meta geom;';
const sources = [];
const attempts = [];
async function save(name, url, response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 24 * 1024 * 1024) throw new Error('Evidence response exceeds 24 MB.');
  await writeFile(path.join(output, name), bytes);
  sources.push({ file: name, url, collectedAt, contentType: response.headers.get('content-type'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes;
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'User-Agent': 'HanshinCampusModel/1.0 (educational mapping; local evidence collection)', ...options.headers }, signal: AbortSignal.timeout(55000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).hostname}`);
  return response;
}
let osmError;
for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
  try {
    const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: query }) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(data.elements) || data.remark) throw new Error('Incomplete Overpass response.');
    if (!data.elements.some((element) => element.tags?.amenity === 'university' && /한신|Hanshin/i.test(element.tags?.name ?? ''))) throw new Error('Hanshin campus area missing from response.');
    await writeFile(path.join(output, 'osm-campus-raw.json'), JSON.stringify(data, null, 2) + '\n');
    sources.push({ file: 'osm-campus-raw.json', url: endpoint, query, collectedAt, osmBaseTimestamp: data.osm3s?.timestamp_osm_base, elements: data.elements.length, sha256: createHash('sha256').update(bytes).digest('hex'), sha256Scope: 'HTTP response bytes before JSON formatting', license: 'ODbL 1.0; attribution OpenStreetMap contributors required' });
    console.log(`Saved ${data.elements.length} OSM elements from ${endpoint}`);
    osmError = null;
    break;
  } catch (error) {
    osmError = error;
    attempts.push({ url: endpoint, collectedAt: new Date().toISOString(), status: 'unavailable', reason: error.message });
    console.error(`OSM endpoint unavailable: ${error.message}`);
  }
}
if (osmError) {
  sources.push({ id: 'latest-osm', status: 'unavailable', collectedAt, reason: osmError.message, attempts });
  process.exitCode = 2;
}
for (const source of [
  { file: 'hanshin-campus-tour.html', url: 'https://www.hs.ac.kr/kor/4891/subview.do', scope: 'Current official building names and campus addresses; no survey coordinates' },
  { file: 'hanshin-campus-directions.html', url: 'https://www.hs.ac.kr/kor/4984/subview.do', scope: 'Official Gyeonggi campus access information' },
  { file: 'eum-2021-54.html', url: 'https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=502075&mobile_yn=', scope: 'Existence of public planning notice; attachment map and current final boundary not validated' }
]) {
  try {
    await save(source.file, source.url, await request(source.url));
    sources.at(-1).scope = source.scope;
    console.log(`Saved ${source.file}`);
  } catch (error) {
    sources.push({ file: source.file, url: source.url, collectedAt, status: 'unavailable', reason: error.message, scope: source.scope });
    console.error(`Official document unavailable: ${source.file}`);
  }
}
await writeFile(path.join(output, 'collection-manifest.json'), JSON.stringify({ collectedAt, sources, attempts, limitations: ['OSM campus polygon is a volunteered map feature, not cadastral ownership.', 'Aerial imagery, cadastral coordinates, surveyed elevations, legal ownership and final planning attachments remain unverified.'] }, null, 2) + '\n');
