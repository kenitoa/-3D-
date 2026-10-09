import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseSync, backup } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readFileSync, mkdirSync, existsSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import vm from 'node:vm';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { loadProviders, fetchProvider } from './providers';
import type { CampusProvider } from './providers';
import { prepareReleaseBundle, storeReleaseBundle, readReleaseBundle } from './asset-bundles';
import { validateModelManifest } from '../src/scene/model-loader';
import { answerApprovedQuestion } from './assistant';
import type { CampusCatalog } from '../src/types/platform-types';
import type { Client } from '@libsql/client';
import { localDatabase, libsqlDatabase } from './database';
import { AsyncRepository, migrations } from './async-repository';
export { loadProviders, publicNetworkAddress, fetchProvider } from './providers';
export { remoteClient, libsqlDatabase } from './database';
export { AsyncRepository } from './async-repository';

type JsonRecord = Record<string, unknown>;
type Role = 'editor' | 'reviewer' | 'admin';
interface User { id: string; username: string; role: Role; campusIds: string[] }
interface Domain {
  createCatalog(plan: unknown, data: unknown): JsonRecord;
  validateCatalog(input: unknown): { valid: boolean; errors: unknown[] };
  validateImport(input: unknown, current: unknown): { valid: boolean; errors: unknown[]; catalog?: JsonRecord | null };
  publicCatalog(catalog: unknown): JsonRecord;
  resolve(catalog: unknown, id: string): JsonRecord | null;
  operationStatus(records: unknown[], entityId: string, at: string): unknown;
}
interface Options { root: string; assetRoot?: string; databasePath?: string; sqlClient?: Client; initializeDatabase?: boolean; origins: string[]; secureCookies?: boolean; baseline?: JsonRecord; domain?: Domain; now?: () => Date; log?: (record: JsonRecord) => void; providersFile?: string; providers?: CampusProvider[]; providerTransport?: (provider: CampusProvider, payload?: Record<string, unknown>) => Promise<unknown>; trustedProxyIPs?: string[]; clientAddress?: (request: IncomingMessage) => string }
class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
function fail(status: number, code: string, message: string): never { throw new ApiError(status, code, message); }
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const record = (v: unknown): v is JsonRecord => !!v && typeof v === 'object' && !Array.isArray(v);
function object(v: unknown): JsonRecord { return record(v) ? v : fail(422, 'INVALID_INPUT', '입력 형식이 올바르지 않습니다.'); }
function text(v: unknown, max: number, name: string, required = true): string {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) return fail(422, 'INVALID_INPUT', `${name}을 확인해 주세요.`);
  return v.trim();
}
function arrayRecords(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.filter(record) : []; }
function catalogEntity(catalog: JsonRecord, id: string): JsonRecord | undefined { return arrayRecords(catalog.entities).find((entity) => entity.id === id || entity.legacyId === id); }
export function passwordHash(password: string): string {
  if (password.length < 12 || password.length > 256) throw new Error('Password must contain between 12 and 256 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$32768$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
}
function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, cost, salt, expected] = encoded.split('$');
  if (algorithm !== 'scrypt' || cost !== '32768' || !salt || !expected || password.length > 256) return false;
  const actual = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const bytes = Buffer.from(expected, 'hex');
  return bytes.length === actual.length && timingSafeEqual(bytes, actual);
}
export function loadDomain(root: string): { domain: Domain; baseline: JsonRecord } {
  const context = vm.createContext({ window: {}, URL, console: { log() {}, warn() {}, error() {} } });
  for (const file of ['src/data/campus-data.js','src/data/interior-data.js','src/domain/site-geometry.js','src/data/site-plan.js','src/domain/campus-platform.js']) vm.runInContext(readFileSync(resolve(root, file), 'utf8'), context, { filename: file, timeout: 5000 });
  const exposed: unknown = Reflect.get(context.window, 'CampusPlatform');
  if (!record(exposed) || !['createCatalog','validateCatalog','publicCatalog','resolve'].every((key) => typeof exposed[key] === 'function')) throw new Error('Campus domain contract is unavailable.');
  const domain = exposed as unknown as Domain;
  const baseline = domain.createCatalog(Reflect.get(context, 'SitePlanData'), Reflect.get(context.window, 'CampusData'));
  if (!domain.validateCatalog(baseline).valid) throw new Error('Baseline campus catalog did not pass validation.');
  return { domain, baseline };
}
function checkedDatabasePath(root: string, supplied?: string): string {
  const path = resolve(supplied || resolve(root, 'var/campus.sqlite'));
  if (path === resolve(root) || !/\.sqlite$/.test(path)) throw new Error('CAMPUS_DB_PATH must name a .sqlite file.');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const parent = realpathSync(dirname(path));
  for (const forbidden of ['dist','src','styles','vendor','evidence','docs','server']) {
    const directory = resolve(root, forbidden);
    const actual = existsSync(directory) ? realpathSync(directory) : directory;
    const local = relative(actual, parent);
    if (!local || (!local.startsWith('..') && !isAbsolute(local))) throw new Error('Database cannot be placed in a public or source directory.');
  }
  if (existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())) throw new Error('Database file cannot be a link or directory.');
  return resolve(parent, path.slice(path.lastIndexOf('\\') + 1).split('/').pop()!);
}
export class CampusRepository {
  db: DatabaseSync;
  databasePath: string;
  constructor(public root: string, databasePath?: string) {
    this.databasePath = checkedDatabasePath(root, databasePath);
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);');
    const version = this.db.prepare('SELECT MAX(version) AS version FROM migrations').get()?.version;
    if (version !== null && version !== undefined && Number(version) > migrations.length) throw new Error('Database schema is newer than this application.');
    for(let index=Number(version||0);index<migrations.length;index++)this.transaction(()=>{this.db.exec(readFileSync(resolve(root,'server/migrations',migrations[index]),'utf8'));this.db.prepare('INSERT INTO migrations VALUES(?,?)').run(index+1,new Date().toISOString());});
  }
  transaction<T>(run: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const result = run(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  setting(key: string): string | null { const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? String(row.value) : null; }
  setSetting(key: string, value: string): void { this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  current(): JsonRecord { const id = this.setting('currentRelease'); const row = this.db.prepare('SELECT catalog FROM releases WHERE id=?').get(id || ''); if (!row) throw new Error('Current release is missing.'); return object(JSON.parse(String(row.catalog))); }
  revision(): number { return Number(this.setting('revision') || 1); }
  audit(actor: string | null, operation: string, resource: string | null, at: string): void { this.db.prepare('INSERT INTO audit(actor_id,operation,resource_id,created_at) VALUES(?,?,?,?)').run(actor, operation, resource, at); }
  createUser(username: string, password: string, role: Role, campusIds: string[]): User {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username) || !['admin','editor','reviewer'].includes(role) || !Array.isArray(campusIds) || campusIds.some((id) => typeof id !== 'string' || !id)) throw new Error('Invalid username, role or campus scope.');
    if (role !== 'admin' && !campusIds.length) throw new Error('Editors/reviewers need explicit campus scope.');
    const user = { id: randomUUID(), username, role, campusIds };
    this.db.prepare('INSERT INTO users(id,username,password_hash,role,campus_ids,created_at) VALUES(?,?,?,?,?,?)').run(user.id, username, passwordHash(password), role, JSON.stringify(campusIds), new Date().toISOString());
    this.audit(user.id, 'user.created', user.id, new Date().toISOString());
    return user;
  }
  async backup(destination: string): Promise<void> {
    const path = checkedDatabasePath(this.root, destination);
    if (existsSync(path) || path === this.databasePath || !/\.sqlite$/.test(path)) throw new Error('Backup destination must be a new .sqlite file.');
    await backup(this.db, path);
  }
  close(): void { this.db.close(); }
}
export async function createPlatform(options: Options) {
  const loaded = options.domain && options.baseline ? { domain: options.domain, baseline: options.baseline } : loadDomain(options.root);
  const domain = loaded.domain;
  const providers=options.providers||loadProviders(options.providersFile);
  const providerTransport=options.providerTransport||fetchProvider;
  const localRepository = options.sqlClient ? null : new CampusRepository(options.root, options.databasePath);
  const repository = new AsyncRepository(options.root, options.sqlClient ? libsqlDatabase(options.sqlClient) : localDatabase(localRepository!.db));
  if (options.sqlClient) {
    if (options.initializeDatabase) await repository.migrate();
    else await repository.assertReady();
  }
  const clock = options.now || (() => new Date());
  const origins = new Set(options.origins.map((v) => { const u = new URL(v); if (!['http:','https:'].includes(u.protocol) || u.origin !== v || u.username || u.password) throw new Error('Invalid public origin.'); return u.origin; }));
  if (!origins.size) throw new Error('An explicit public origin is required.');
  const dummyPassword = passwordHash(randomBytes(24).toString('hex'));
  const normalizeIP = (value: string): string => value.startsWith('::ffff:') && isIP(value.slice(7)) === 4 ? value.slice(7) : value;
  const trustedProxies = new Set((options.trustedProxyIPs || []).map((value) => { if (!isIP(value)) throw new Error('Trusted proxy entries must be explicit IP addresses.'); return normalizeIP(value); }));
  function clientAddress(request: IncomingMessage): string {
    if (options.clientAddress) return options.clientAddress(request);
    const address = normalizeIP(request.socket.remoteAddress || 'local');
    const forwarded = request.headers['x-forwarded-for'];
    if (!trustedProxies.has(address) || forwarded === undefined) return address;
    if (typeof forwarded !== 'string' || !isIP(forwarded)) fail(400, 'INVALID_PROXY_HEADER', '요청 주소를 확인해 주세요.');
    return normalizeIP(forwarded);
  }
  const metrics: Record<string, number> = { requests: 0, errors: 0, conflicts: 0, reportsReceived: 0, releasesPublished: 0 };
  const startedAt = clock().toISOString();
  async function rememberIds(catalog: JsonRecord, restoring = false): Promise<void> {
    const rows = arrayRecords(catalog.entities);
    const existing = new Map((await repository.db.prepare('SELECT * FROM identities').all()).map(row => [String(row.id),row]));
    for (const item of rows) {
      const old = existing.get(String(item.id));
      if (old && (old.kind !== item.kind || old.campus_id !== item.campusId || (Number(old.retired) && !restoring && item.status !== 'retired'))) fail(422, 'IDENTITY_REUSED', '기존 공간 ID를 다른 공간에 재사용할 수 없습니다.');
    }
    (await repository.db.exec('UPDATE identities SET retired=1;'));
    await repository.db.batch(rows.map(item => ({sql:'INSERT INTO identities(id,campus_id,kind,retired) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET retired=excluded.retired',args:[String(item.id),String(item.campusId),String(item.kind),item.status === 'retired' ? 1 : 0]})));
  }
  if (!options.sqlClient || options.initializeDatabase) (await repository.transaction(async () => {
    if (await repository.setting('currentRelease')) return;
    const id = randomUUID();
    (await repository.db.prepare('INSERT INTO releases(id,catalog,summary,created_at) VALUES(?,?,?,?)').run(id, JSON.stringify(loaded.baseline), '기존 공개 자료를 변환한 최초 공개판', clock().toISOString()));
    (await repository.setSetting('currentRelease', id)); (await repository.setSetting('revision', '1')); (await rememberIds(loaded.baseline));
  }));
  await repository.transaction(async () => {
    if (!await repository.setting('receiptSecret')) await repository.setSetting('receiptSecret',randomBytes(32).toString('hex'));
  });
  const receiptSecret = (await repository.setting('receiptSecret'))!;
  const receiptToken=(id:string)=>createHmac('sha256',receiptSecret).update(id).digest('hex');
  async function rate(key: string, count: number, period: number): Promise<void> {
    const now = clock().getTime();
    const hits = await repository.transaction(async () => {
      await repository.db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').run(now);
      const capacity = await repository.db.prepare('SELECT COUNT(*) AS count FROM rate_limits').get();
      if (Number(capacity?.count) >= 4096 && !await repository.db.prepare('SELECT key FROM rate_limits WHERE key=?').get(key)) return count + 1;
      const row = await repository.db.prepare('INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits').get(key,now+period);
      return Number(row?.hits);
    });
    if (hits > count) fail(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.');
  }
  function originAllowed(request: IncomingMessage, mutation: boolean): void {
    const host = request.headers.host || '';
    if (![...origins].some((origin) => new URL(origin).host === host)) fail(403, 'ORIGIN_REJECTED', '허용된 서비스 주소에서 요청해 주세요.');
    if ((mutation || request.headers.origin) && (!request.headers.origin || !origins.has(request.headers.origin))) fail(403, 'ORIGIN_REJECTED', '허용된 서비스 주소에서 요청해 주세요.');
  }
  async function session(request: IncomingMessage): Promise<{ user: User; csrf: string; tokenHash: string } | null> {
    const cookies = (request.headers.cookie || '').split(';').map((v) => v.trim());
    const token = cookies.find((v) => v.startsWith('campus_session='))?.slice(15);
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const row = (await repository.db.prepare('SELECT s.*,u.username,u.role,u.campus_ids FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>? AND u.disabled=0').get(hash(token), clock().toISOString()));
    if (!row) return null;
    return { user: { id: String(row.user_id), username: String(row.username), role: row.role as Role, campusIds: JSON.parse(String(row.campus_ids)) }, csrf: String(row.csrf), tokenHash: hash(token) };
  }
  async function authorize(request: IncomingMessage, roles: Role[], mutation = false): Promise<User> {
    const active = (await session(request));
    if (!active) return fail(401, 'AUTHENTICATION_REQUIRED', '로그인이 필요합니다.');
    if (!roles.includes(active.user.role)) return fail(403, 'FORBIDDEN', '이 작업을 수행할 권한이 없습니다.');
    if (mutation) {
      const token = request.headers['x-csrf-token'];
      if (typeof token !== 'string' || hash(token) !== hash(active.csrf)) fail(403, 'CSRF_REJECTED', '세션을 새로 확인한 뒤 다시 시도해 주세요.');
    }
    return active.user;
  }
  function assertEntityScope(user: User, catalog: JsonRecord, id: string): void {
    const entity = domain.resolve(catalog, id);
    if (!entity) fail(404, 'RESOURCE_NOT_FOUND', '공간을 찾을 수 없습니다.');
    if (user.role !== 'admin' && !user.campusIds.includes(String(entity.campusId))) fail(403, 'FORBIDDEN', '담당 캠퍼스의 자료만 관리할 수 있습니다.');
  }
  async function assertCatalogScope(user: User, next: JsonRecord): Promise<void> {
    assertCatalogReadable(user, (await repository.current()));
    assertCatalogReadable(user, next);
  }
  function canReadCatalog(user: User, catalog: JsonRecord): boolean {
    return user.role === 'admin' || arrayRecords(catalog.campuses).every((campus) => user.campusIds.includes(String(campus.id)));
  }
  function assertCatalogReadable(user: User, catalog: JsonRecord): void {
    if (!canReadCatalog(user, catalog)) fail(403, 'FORBIDDEN', '전체 관리 자료는 포함된 모든 캠퍼스의 담당 권한이 필요합니다.');
  }
  function catalogScopeSql(user: User, alias: 'drafts' | 'releases'): { sql: string; parameters: string[] } {
    if (user.role === 'admin') return { sql: '1=1', parameters: [] };
    return { sql: `NOT EXISTS (SELECT 1 FROM json_each(${alias}.catalog,'$.campuses') campus WHERE json_extract(campus.value,'$.id') NOT IN (SELECT value FROM json_each(?)))`, parameters: [JSON.stringify(user.campusIds)] };
  }
  function identityScopeSql(user: User): { sql: string; parameters: string[] } {
    return user.role === 'admin' ? { sql: '1=1', parameters: [] } : { sql: 'identity.campus_id IN (SELECT value FROM json_each(?))', parameters: [JSON.stringify(user.campusIds)] };
  }
  async function assertIdentityScope(user: User, id: string): Promise<void> {
    if (user.role === 'admin') return;
    const identity = (await repository.db.prepare('SELECT campus_id FROM identities WHERE id=?').get(id));
    if (!identity || !user.campusIds.includes(String(identity.campus_id))) fail(403, 'FORBIDDEN', '해당 캠퍼스의 기록만 관리할 수 있습니다.');
  }
  function pagination(url: URL, maximum = 100): { limit: number; offset: number } {
    const integer = (key: string, minimum: number, maximumValue: number, fallback: number): number => {
      const values = url.searchParams.getAll(key);
      if (!values.length) return fallback;
      if (values.length !== 1 || !/^(0|[1-9]\d*)$/.test(values[0])) fail(422, 'INVALID_PAGINATION', '목록의 limit과 offset을 확인해 주세요.');
      const value = Number(values[0]);
      if (!Number.isSafeInteger(value) || value < minimum || value > maximumValue) fail(422, 'INVALID_PAGINATION', '목록의 limit과 offset을 확인해 주세요.');
      return value;
    };
    return { limit: integer('limit', 1, maximum, maximum), offset: integer('offset', 0, 100_000, 0) };
  }
  async function checkedCatalog(input: unknown, user?: User): Promise<JsonRecord> {
    const catalog = object(input); const validation = user ? domain.validateImport(catalog, (await repository.current())) : domain.validateCatalog(catalog);
    if(catalog.assetManifest!==undefined){try{validateModelManifest(catalog.assetManifest);}catch{fail(422,'INVALID_ASSETS','?? ????????????? ??? ??? ???.');}}
    if (!validation.valid) fail(422, 'INVALID_CATALOG', `공간 자료를 검증하지 못했습니다. ${validation.errors.slice(0, 6).map((v) => typeof v === 'string' ? v : JSON.stringify(v)).join(' / ')}`);
    if (JSON.stringify(catalog).length > 4_000_000) fail(413, 'PAYLOAD_TOO_LARGE', '공간 자료는 4MB 이하로 등록해 주세요.');
    const normalized='catalog' in validation&&record(validation.catalog)?validation.catalog:catalog;
    if (user) (await assertCatalogScope(user, normalized));
    return normalized;
  }
  function revision(body: JsonRecord, expected: number): void { if (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== expected) { metrics.conflicts++; fail(409, 'REVISION_CONFLICT', '다른 변경이 있습니다. 최신 자료를 확인한 뒤 다시 시도해 주세요.'); } }
  async function readBody(request: IncomingMessage): Promise<JsonRecord> {
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 요청만 지원합니다.');
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const value of request) { const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value); bytes += chunk.length; if (bytes > 6_000_000) fail(413, 'PAYLOAD_TOO_LARGE', '요청 크기가 너무 큽니다.'); chunks.push(chunk); }
    try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { if (error instanceof ApiError) throw error; return fail(400, 'INVALID_JSON', 'JSON 입력을 확인해 주세요.'); }
  }
  function safePhoto(value: unknown): { data: Buffer; mime: string } | null {
    if (value === undefined || value === null) return null;
    const input = object(value); const mime = text(input.mimeType, 32, '사진 형식'); const encoded = text(input.dataBase64, 2_800_000, '사진');
    if (!['image/png','image/jpeg'].includes(mime) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(422, 'INVALID_PHOTO', 'PNG 또는 JPEG 사진만 등록할 수 있습니다.');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== encoded) fail(422, 'INVALID_PHOTO', '사진은 2MB 이하로 등록해 주세요.');
    if (mime === 'image/png') {
      if (bytes.length < 45 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || bytes.subarray(12,16).toString() !== 'IHDR') fail(422, 'INVALID_PHOTO', 'PNG 파일을 확인해 주세요.');
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      if (!width || !height || width > 4096 || height > 4096 || width * height > 12_000_000) fail(422, 'INVALID_PHOTO', '사진 크기가 너무 큽니다.');
      // Keep only structural/color/image chunks; EXIF/text/location metadata is discarded.
      const channels:Record<number,number>={0:1,2:3,3:1,4:2,6:4};const channelCount=channels[bytes[25]];
      if(bytes[24]!==8||!channelCount||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)fail(422,'INVALID_PHOTO','사진을 다시 선택해 표준 PNG로 변환해 주세요.');
      const kept: Buffer[] = [bytes.subarray(0,8)],compressed:Buffer[]=[]; let offset = 8, ended = false;
      while (offset + 12 <= bytes.length) {
        const size = bytes.readUInt32BE(offset); if (size > bytes.length - offset - 12) fail(422, 'INVALID_PHOTO', 'PNG 파일을 확인해 주세요.');
        const kind = bytes.subarray(offset+4,offset+8).toString('ascii');let crc=0xffffffff;
        for(const byte of bytes.subarray(offset+4,offset+8+size)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
        if(((crc^0xffffffff)>>>0)!==bytes.readUInt32BE(offset+size+8))fail(422,'INVALID_PHOTO','PNG 파일이 손상되었습니다.');
        if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(kind))kept.push(bytes.subarray(offset,offset+size+12));
        if(kind==='IDAT')compressed.push(bytes.subarray(offset+8,offset+size+8));
        offset+=size+12;if(kind==='IEND'){ended=true;break;}
      }
      if (!ended || !kept.some((chunk) => chunk.subarray(4,8).toString() === 'IDAT')) fail(422, 'INVALID_PHOTO', 'PNG 파일을 확인해 주세요.');
      try{const rowBytes=width*channelCount+1,decoded=inflateSync(Buffer.concat(compressed),{maxOutputLength:rowBytes*height});if(decoded.length!==rowBytes*height)fail(422,'INVALID_PHOTO','PNG 파일을 확인해 주세요.');for(let row=0;row<height;row++)if(decoded[row*rowBytes]>4)fail(422,'INVALID_PHOTO','PNG 필터를 확인해 주세요.');}catch{fail(422,'INVALID_PHOTO','PNG 이미지를 확인해 주세요.');}
      return { data: Buffer.concat(kept), mime };
    }
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length-2] !== 0xff || bytes[bytes.length-1] !== 0xd9) fail(422, 'INVALID_PHOTO', 'JPEG 파일을 확인해 주세요.');
    const kept: Buffer[] = [bytes.subarray(0,2)]; let offset = 2, scanned = false, dimensions = false;
    while (offset + 4 <= bytes.length) { if (bytes[offset] !== 0xff) fail(422, 'INVALID_PHOTO', 'JPEG 파일을 확인해 주세요.'); const marker = bytes[offset+1]; const size = bytes.readUInt16BE(offset+2); if (size < 2 || offset + 2 + size > bytes.length) fail(422, 'INVALID_PHOTO', 'JPEG 파일을 확인해 주세요.'); if ([0xc0,0xc1,0xc2].includes(marker)) { if(size<8)fail(422,'INVALID_PHOTO','JPEG 파일을 확인해 주세요.');const height = bytes.readUInt16BE(offset+5), width = bytes.readUInt16BE(offset+7); if (!width || !height || width > 4096 || height > 4096 || width*height > 12_000_000) fail(422, 'INVALID_PHOTO', '사진 크기가 너무 큽니다.'); dimensions = true; } if (marker === 0xda) { kept.push(bytes.subarray(offset)); scanned = true; break; } if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) kept.push(bytes.subarray(offset,offset+size+2)); offset += size+2; }
    if (!scanned || !dimensions) fail(422, 'INVALID_PHOTO', 'JPEG 파일을 확인해 주세요.');
    return { data: Buffer.concat(kept), mime };
  }
  function safeDraft(row: JsonRecord, user: User): JsonRecord { const catalog=object(JSON.parse(String(row.catalog)));assertCatalogReadable(user,catalog);return { id:row.id,catalog,summary:row.summary,status:row.status,authorId:row.author_id,reviewerId:row.reviewer_id,revision:Number(row.revision),baseRevision:Number(row.base_revision),createdAt:row.created_at,updatedAt:row.updated_at }; }
  function safeReport(row: JsonRecord): JsonRecord { return { id:row.id,spaceId:row.space_id,type:row.type,description:row.description,status:row.status,hasPhoto:row.has_photo===undefined?!!row.photo:!!row.has_photo,responseNote:row.response_note,createdAt:row.created_at,updatedAt:row.updated_at }; }
  async function publicOperations(page?: {limit:number;offset:number}): Promise<JsonRecord[]> {
    const full=(await repository.current());
    const visible=domain.publicCatalog(full);
    const sql="SELECT payload FROM operations WHERE json_extract(payload,'$.visibility')='public' AND json_extract(payload,'$.status') IS NOT 'cancelled' AND entity_id IN (SELECT value FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM json_each(payload,'$.sourceIds') source WHERE source.value NOT IN (SELECT value FROM json_each(?))) ORDER BY updated_at DESC,id DESC";
    const parameters=[JSON.stringify(arrayRecords(visible.entities).map((entity)=>entity.id)),JSON.stringify(arrayRecords(visible.sources).map((source)=>source.id))];
    const rows=page?(await repository.db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...parameters,page.limit+1,page.offset)):(await repository.db.prepare(sql).all(...parameters));
    full.operations=rows.map((row)=>object(JSON.parse(String(row.payload))));
    return arrayRecords(domain.publicCatalog(full).operations);
  }
  async function makeOperation(body: JsonRecord, user: User, now: string): Promise<JsonRecord> {
    const suppliedId=text(body.entityId,180,'공간'),current=(await repository.current());assertEntityScope(user,current,suppliedId);
    const entityId=String(domain.resolve(current,suppliedId)!.id);
    const title=text(body.title||body.label,200,'제목'),owner=text(body.owner,100,'관리 부서'),statusValue=text(body.status||body.state,30,'운영 상태');
    if(!['open','closed','restricted','unknown','construction','cancelled'].includes(statusValue))fail(422,'INVALID_STATUS','운영 상태를 확인해 주세요.');
    const suppliedStart=text(body.startsAt||body.validFrom,40,'시작일'),suppliedEnd=text(body.endsAt||body.validUntil,40,'종료일');
    const timestamp=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/;
    const validTime=(value:string):boolean=>{
      const parts=timestamp.exec(value);if(!parts)return false;
      const [,yearText,monthText,dayText,hourText,minuteText,secondText,offsetHour,offsetMinute]=parts;
      const year=Number(yearText),month=Number(monthText),day=Number(dayText),leap=year%4===0&&(year%100!==0||year%400===0);
      const monthDays=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
      return month>=1&&month<=12&&day>=1&&day<=monthDays[month-1]&&Number(hourText)<=23&&Number(minuteText)<=59&&Number(secondText)<=59&&Number(offsetHour||0)<=23&&Number(offsetMinute||0)<=59&&Number.isFinite(Date.parse(value));
    };
    if(!validTime(suppliedStart)||!validTime(suppliedEnd))fail(422,'INVALID_PERIOD','달력과 시간대가 유효한 ISO 운영기간을 입력해 주세요.');
    const startsAt=new Date(suppliedStart).toISOString(),endsAt=new Date(suppliedEnd).toISOString();
    if(!Number.isFinite(Date.parse(startsAt))||!Number.isFinite(Date.parse(endsAt))||Date.parse(endsAt)<=Date.parse(startsAt)||new Date(endsAt).getTime()-new Date(startsAt).getTime()>366*24*60*60_000)fail(422,'INVALID_PERIOD','1년 이내의 유효한 운영기간을 입력해 주세요.');
    if(body.visibility!==undefined&&!['restricted','public'].includes(String(body.visibility)))fail(422,'INVALID_INPUT','공개 범위를 확인해 주세요.');
    const visibility=body.visibility==='restricted'?'restricted':'public';
    const sourceId=text(body.sourceId||(Array.isArray(body.sourceIds)?body.sourceIds[0]:null),180,'출처');
    if(!arrayRecords((await repository.current()).sources).some((source)=>source.id===sourceId))fail(422,'INVALID_SOURCE','등록된 출처를 선택해 주세요.');
    return {id:body.id?text(body.id,100,'운영 정보 ID'):randomUUID(),entityId,title,label:`${title} · ${owner}`,owner,status:statusValue,state:statusValue==='open'?'open':'closed',startsAt,endsAt,validFrom:startsAt,validUntil:statusValue==='cancelled'?now:endsAt,observedAt:now,visibility,sourceId,sourceIds:[sourceId],verification:statusValue==='unknown'?'unverified':'verified',reviewedAt:now,reviewerId:user.id,updatedAt:now};
  }
  async function ensureBundle(id:string,full:JsonRecord,at:string){
    const known=(await readReleaseBundle(repository.db,id));if(known)return known;
    const prepared=(await checkedPublicBundle(id,full,at));
    (await repository.transaction(async ()=>(await storeReleaseBundle(repository.db,prepared))));return prepared.bundle;
  }
  async function checkedPublicBundle(id:string,full:JsonRecord,at:string){
    try{return (await prepareReleaseBundle(options.assetRoot||options.root,id,domain.publicCatalog(full),at,repository.db));}
    catch{fail(422,'INVALID_PUBLIC_ASSETS','공개 자산의 경로·SHA·형상·공개성 검증을 통과하지 못했습니다. 등록 파일과 제작 보고서를 확인해 주세요.');}
  }
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    if (!request.url?.startsWith('/api/') && !request.url?.startsWith('/assets/releases/')) return false;
    const requestId = randomUUID(), started = performance.now(); metrics.requests++;
    const headers = { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Request-Id':requestId,'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'" };
    let status = 200;
    const pending: { reply?: { code: number; headers: Record<string,string>; body: Buffer } } = {};
    const send = async (data: unknown, code = 200, extra: Record<string,string> = {}, meta: JsonRecord = {}) => {
      status=code;
      pending.reply={code,headers:{...headers,...extra},body:Buffer.from(JSON.stringify({data,error:null,meta:{requestId,revision:await repository.revision(),...meta}}))};
    };
    const sendBinary = (body: Buffer | undefined, extra: Record<string,string>) => { pending.reply={code:200,headers:{...headers,...extra},body:body||Buffer.alloc(0)}; };
    const sendPage = async (rows: JsonRecord[], page: {limit:number;offset:number}, transform: (row: JsonRecord) => unknown = (row) => row) => {
      const hasMore=rows.length>page.limit;
      (await send(rows.slice(0,page.limit).map(transform),200,{}, {pagination:{...page,hasMore,nextOffset:hasMore&&page.offset+page.limit<=100_000?page.offset+page.limit:null}}));
    };
    try {
      const method = request.method || 'GET'; const mutation = !['GET','HEAD'].includes(method); originAllowed(request,mutation);
      if (!['GET','HEAD','POST','PATCH','DELETE'].includes(method)) fail(405,'METHOD_NOT_ALLOWED','지원하지 않는 요청입니다.');
      const url = new URL(request.url, [...origins][0]); const path = url.pathname; const now=clock().toISOString();
      const client = hash(clientAddress(request)); (await rate(`api:${client}`,300,60_000));
      if(method==='POST'&&path==='/api/v1/session') await rate(`login:${client}`,8,15*60_000);
      if(method==='POST'&&path==='/api/v1/reports') await rate(`report:${client}`,6,60*60_000);
      if(method==='POST'&&path==='/api/v1/assistant') await rate(`assistant:${client}`,15,60_000);
      const dispatch = async (): Promise<boolean> => {
      if (path === '/api/v1/health' && method === 'GET') { (await send({status:'ok',schemaVersion:4,catalogSchemaVersion:1,revision:(await repository.revision()),startedAt})); return true; }
      if (path === '/api/v1/session' && method === 'GET') { const active=(await session(request)); (await send({user:active?.user || null,csrfToken:active?.csrf,adminConfigured:Number((await repository.db.prepare('SELECT COUNT(*) count FROM users WHERE disabled=0').get())?.count)>0})); return true; }
      if (path === '/api/v1/session' && method === 'POST') {
        const body=await readBody(request); const username=text(body.username,64,'계정'); const password=typeof body.password==='string'?body.password:'';
        const user=(await repository.db.prepare('SELECT * FROM users WHERE username=? AND disabled=0').get(username)); const valid=verifyPassword(password,user?String(user.password_hash):dummyPassword);
        if (!user || !valid) fail(401,'INVALID_CREDENTIALS','계정과 비밀번호를 확인해 주세요.');
        const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex'),expires=new Date(clock().getTime()+8*60*60_000).toISOString();
        (await repository.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now)); (await repository.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),String(user.id),csrf,expires)); (await repository.audit(String(user.id),'session.created',null,now));
        (await send({user:{id:user.id,username:user.username,role:user.role,campusIds:JSON.parse(String(user.campus_ids))},csrfToken:csrf},200,{'Set-Cookie':`campus_session=${token}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=28800${options.secureCookies?'; Secure':''}`})); return true;
      }
      if (path === '/api/v1/session' && method === 'DELETE') { const user=(await authorize(request,['admin','editor','reviewer'],true)); const active=(await session(request))!; (await repository.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(active.tokenHash)); (await repository.audit(user.id,'session.deleted',null,now)); (await send({loggedOut:true},200,{'Set-Cookie':`campus_session=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0${options.secureCookies?'; Secure':''}`})); return true; }
      const snapshotMatch=path.match(/^\/assets\/releases\/([a-f0-9]{64})(\.[a-z0-9]+)$/);
      if(snapshotMatch&&['GET','HEAD'].includes(method)){
        const row=(await repository.db.prepare('SELECT body,mime_type,bytes FROM public_asset_blobs WHERE sha256=? AND extension=? AND EXISTS(SELECT 1 FROM release_asset_links WHERE sha256=public_asset_blobs.sha256 AND extension=public_asset_blobs.extension)').get(snapshotMatch[1],snapshotMatch[2]));
        if(!row)fail(404,'RESOURCE_NOT_FOUND','공개 자산을 찾을 수 없습니다.');
        sendBinary(method==='HEAD'?undefined:Buffer.from(row.body as Uint8Array),{'Content-Type':String(row.mime_type),'Content-Length':String(row.bytes),'Cache-Control':'public,max-age=31536000,immutable'});return true;
      }
      if(path==='/api/v1/bundle'&&method==='GET'){
        const id=url.searchParams.get('release')||(await repository.setting('currentRelease'))!;
        if(!/^[a-f0-9-]{36}$/.test(id))fail(422,'INVALID_RELEASE','공개판 ID를 확인해 주세요.');
        const row=(await repository.db.prepare('SELECT catalog,created_at FROM releases WHERE id=?').get(id));if(!row)fail(404,'RESOURCE_NOT_FOUND','승인된 공개판을 찾을 수 없습니다.');
        const bundle=(await ensureBundle(id,object(JSON.parse(String(row.catalog))),String(row.created_at)));(await send(bundle));return true;
      }
      if (path === '/api/v1/catalog' && method === 'GET') {
        const releaseId=url.searchParams.get('release'); const row=releaseId?(await repository.db.prepare('SELECT catalog FROM releases WHERE id=?').get(releaseId)):null; if(releaseId&&!row)fail(404,'RESOURCE_NOT_FOUND','공개판을 찾을 수 없습니다.'); const full=row?object(JSON.parse(String(row.catalog))):(await repository.current()); const catalog=domain.publicCatalog(full);
        if(!releaseId)catalog.operations=[...arrayRecords(catalog.operations),...(await publicOperations())]; const id=releaseId||(await repository.setting('currentRelease'))!; const bundle=(await ensureBundle(id,full,now)); catalog.assetManifest=bundle.manifest;catalog.assetsVersion=bundle.assetsVersion; (await send(catalog,200,{}, {releaseId:id,bundleHash:bundle.catalogHash,mediaRecords:bundle.mediaRecords})); return true;
      }
      if(path==='/api/v1/assistant/status'&&method==='GET'){
        const current=domain.publicCatalog((await repository.current()));const sources=new Set(arrayRecords(current.sources).filter(source=>source.visibility==='public'&&source.confidence==='verified').map(source=>source.id));
        (await send({providers:providers.filter(provider=>provider.enabled&&provider.kind==='assistant'&&sources.has(provider.sourceId)).map(provider=>({id:provider.id,campusId:provider.campusId,sourceId:provider.sourceId})),mode:'approved-catalog-only'}));return true;
      }
      if(path==='/api/v1/assistant'&&method==='POST'){
        const body=await readBody(request),current=domain.publicCatalog((await repository.current()));
        const question=text(body.question,500,'질문'),campusId=text(body.campusId,160,'캠퍼스'),contentVersion=text(body.contentVersion,160,'자료판');
        if(contentVersion!==current.contentVersion)fail(409,'CATALOG_CHANGED','자료판이 변경되었습니다. 새로고침한 뒤 다시 질문해 주세요.');
        if(!arrayRecords(current.campuses).some(campus=>campus.id===campusId))fail(422,'INVALID_CAMPUS','등록된 캠퍼스를 선택해 주세요.');
        const result=await answerApprovedQuestion({catalog:current as unknown as CampusCatalog,question,campusId,contentVersion,purpose:typeof body.purpose==='string'?body.purpose:undefined},providers,providerTransport);(await send(result));return true;
      }
      if (path === '/api/v1/releases' && method === 'GET') { const page=pagination(url);(await sendPage((await repository.db.prepare("SELECT id,created_at AS createdAt,json_extract(catalog,'$.contentVersion') AS contentVersion FROM releases ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").all(page.limit+1,page.offset)),page)); return true; }
      if (path === '/api/v1/operations' && method === 'GET') { const page=pagination(url);(await sendPage((await publicOperations(page)),page)); return true; }
      if (path.startsWith('/api/v1/spaces/') && method === 'GET') { const id=decodeURIComponent(path.slice('/api/v1/spaces/'.length)); const current=domain.publicCatalog((await repository.current())); const entity=domain.resolve(current,id); if(entity)(await send(entity)); else if((await repository.db.prepare('SELECT id FROM identities WHERE id=? AND retired=1').get(id)))fail(410,'SPACE_RETIRED','이 공간은 현재 공개판에서 변경되었습니다. 전체 보기에서 목적지를 다시 확인해 주세요.'); else fail(404,'RESOURCE_NOT_FOUND','공간을 찾을 수 없습니다.'); return true; }
      if (path === '/api/v1/reports' && method === 'POST') {
        const body=await readBody(request); const spaceId=text(body.spaceId,180,'공간'); const entity=domain.resolve(domain.publicCatalog((await repository.current())),spaceId); if(!entity)fail(422,'INVALID_SPACE','공개된 공간을 선택해 주세요.'); const type=text(body.type,30,'문제 유형'); if(!['location','name','access','facility','other','map','information','closure'].includes(type))fail(422,'INVALID_REPORT_TYPE','문제 유형을 확인해 주세요.');
        const description=text(body.description,3000,'내용'); const key=text(body.idempotencyKey,100,'접수 키'); if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail(422,'INVALID_INPUT','접수 키를 확인해 주세요.'); const photo=safePhoto(body.photo); const requestHash=hash(JSON.stringify({spaceId:entity.id,type,description,photo:photo?hash(photo.data):null})); const existing=(await repository.db.prepare('SELECT * FROM reports WHERE idempotency_key=?').get(key));
        if(existing){if(existing.request_hash!==requestHash)fail(409,'IDEMPOTENCY_CONFLICT','접수 키가 다른 내용에 사용되었습니다.');(await send({id:existing.id,status:existing.status,createdAt:existing.created_at,receiptToken:(await receiptToken(String(existing.id)))},200));return true;}
        const id=randomUUID(); (await repository.db.prepare('INSERT INTO reports(id,space_id,type,description,status,photo,photo_mime,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,String(entity.id),type,description,'received',photo?.data||null,photo?.mime||null,key,requestHash,now,now)); (await repository.audit(null,'report.received',id,now));metrics.reportsReceived++;(await send({id,status:'received',createdAt:now,receiptToken:(await receiptToken(id))},201));return true;
      }
      const receiptMatch=path.match(/^\/api\/v1\/reports\/([a-f0-9-]+)$/);
      if(receiptMatch&&method==='GET'){
        const token=request.headers['x-report-receipt'];
        if(typeof token!=='string'||!(/^[a-f0-9]{64}$/).test(token)||!timingSafeEqual(Buffer.from(token,'hex'),Buffer.from((await receiptToken(receiptMatch[1])),'hex')))fail(404,'RESOURCE_NOT_FOUND','접수번호와 조회 키를 확인해 주세요.');
        const row=(await repository.db.prepare('SELECT id,status,response_note,created_at,updated_at FROM reports WHERE id=?').get(receiptMatch[1]));
        if(!row)fail(404,'RESOURCE_NOT_FOUND','접수번호와 조회 키를 확인해 주세요.');
        (await send({id:row.id,status:row.status,responseNote:row.response_note,createdAt:row.created_at,updatedAt:row.updated_at}));return true;
      }
      if (!path.startsWith('/api/v1/admin/')) fail(404,'RESOURCE_NOT_FOUND','요청한 리소스를 찾을 수 없습니다.');
      const user=(await authorize(request,['admin','editor','reviewer'],mutation));
      if(path==='/api/v1/admin/providers'&&method==='GET'){
        (await send(await Promise.all(providers.filter(p=>user.role==='admin'||user.campusIds.includes(p.campusId)).map(async provider=>{const row=(await repository.db.prepare('SELECT * FROM provider_runs WHERE provider_id=?').get(provider.id)),draft=row?.draft_id?(await repository.db.prepare('SELECT catalog FROM drafts WHERE id=?').get(String(row.draft_id))):null;return {id:provider.id,kind:provider.kind,campusId:provider.campusId,sourceId:provider.sourceId,enabled:provider.enabled,state:row?.state||'unconfigured',lastAttemptAt:row?.last_attempt_at||null,lastSuccessAt:row?.last_success_at||null,draftId:draft&&canReadCatalog(user,object(JSON.parse(String(draft.catalog))))?row?.draft_id:null,errorCode:row?.error_code||null};}))));return true;
      }
      const providerMatch=path.match(/^\/api\/v1\/admin\/providers\/([a-z0-9_-]+)\/sync$/);
      if(providerMatch&&method==='POST'){
        const body=await readBody(request);revision(body,(await repository.revision()));
        const provider=providers.find(p=>p.id===providerMatch[1]);
        if(!provider)fail(404,'RESOURCE_NOT_FOUND','등록된 연동이 없습니다.');
        if(!provider.enabled)fail(409,'PROVIDER_DISABLED','연동이 아직 활성화되지 않았습니다.');
        if(user.role!=='admin'&&!user.campusIds.includes(provider.campusId))fail(403,'FORBIDDEN','담당 캠퍼스의 연동만 실행할 수 있습니다.');
        assertCatalogReadable(user,(await repository.current()));
        const leaseOwner=randomUUID(),leaseNow=clock().getTime();
        const leased=await repository.db.prepare('INSERT INTO provider_leases VALUES(?,?,?) ON CONFLICT(provider_id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE provider_leases.expires_at<=? RETURNING owner').get(provider.id,leaseOwner,leaseNow+60_000,leaseNow);
        if(leased?.owner!==leaseOwner)fail(409,'PROVIDER_BUSY','이미 자료를 가져오고 있습니다.');
        const prior=(await repository.db.prepare('SELECT * FROM provider_runs WHERE provider_id=?').get(provider.id));
        try{
          const incoming=await providerTransport(provider);let catalog:JsonRecord;
          if(provider.kind==='catalog')catalog=object(incoming);
          else{if(!Array.isArray(incoming)||incoming.length>1000)fail(422,'INVALID_PROVIDER_DATA','운영 정보 목록 형식을 확인해 주세요.');catalog=(await repository.current());catalog.operations=incoming.map(entry=>({...object(entry),sourceIds:[provider.sourceId],verification:'unverified'}));catalog.contentVersion=`${String(catalog.contentVersion)}-import-${hash(JSON.stringify(incoming)).slice(0,12)}`;catalog.datasetVersion=catalog.contentVersion;}
          await repository.transaction(async ()=>{
            const active=await authorize(request,['admin','editor','reviewer'],true);
            const lease=await repository.db.prepare('SELECT owner,expires_at FROM provider_leases WHERE provider_id=?').get(provider.id);
            if(lease?.owner!==leaseOwner||Number(lease.expires_at)<=clock().getTime())fail(409,'PROVIDER_BUSY','연동 잠금이 만료되었습니다. 다시 시도해 주세요.');
            if(active.role!=='admin'&&!active.campusIds.includes(provider.campusId))fail(403,'FORBIDDEN','담당 캠퍼스의 연동만 실행할 수 있습니다.');
            catalog=await checkedCatalog(catalog,active);
            revision(body,await repository.revision());
            if(!arrayRecords(catalog.campuses).some(c=>c.id===provider.campusId)||!arrayRecords(catalog.sources).some(s=>s.id===provider.sourceId))fail(422,'INVALID_PROVIDER_DATA','연동의 캠퍼스와 출처를 확인해 주세요.');
            const summary=`외부 자료 ${provider.id}: 검토 후 공개`,serialized=JSON.stringify(catalog);
            const duplicate=await repository.db.prepare("SELECT id FROM drafts WHERE catalog=? AND summary=? AND status IN('draft','submitted','approved') ORDER BY created_at DESC LIMIT 1").get(serialized,summary);
            const id=duplicate?String(duplicate.id):randomUUID(),completed=clock().toISOString();
            if(!duplicate)await repository.db.prepare('INSERT INTO drafts(id,catalog,summary,status,author_id,revision,base_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,serialized,summary,'draft',active.id,1,await repository.revision(),completed,completed);
            await repository.db.prepare('INSERT INTO provider_runs VALUES(?,?,?,?,?,?) ON CONFLICT(provider_id) DO UPDATE SET state=excluded.state,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,draft_id=excluded.draft_id,error_code=NULL').run(provider.id,'success',now,completed,id,null);
            await repository.audit(active.id,'provider.imported',provider.id,completed);
            await send({providerId:provider.id,draftId:id,state:'success',lastSuccessAt:completed,requiresReview:true,duplicate:!!duplicate},duplicate?200:201);
          });
        }catch(error){
          const code=error instanceof ApiError?error.code:error instanceof Error&&/^[A-Z_]{1,80}$/.test(error.message)?error.message:'PROVIDER_UNAVAILABLE';
          await repository.transaction(async()=>{
            if((await repository.db.prepare('SELECT owner FROM provider_leases WHERE provider_id=?').get(provider.id))?.owner!==leaseOwner)return;
            await repository.db.prepare('INSERT INTO provider_runs VALUES(?,?,?,?,?,?) ON CONFLICT(provider_id) DO UPDATE SET state=excluded.state,last_attempt_at=excluded.last_attempt_at,error_code=excluded.error_code').run(provider.id,'failed',now,prior?.last_success_at?String(prior.last_success_at):null,prior?.draft_id?String(prior.draft_id):null,code);
            await repository.audit(user.id,'provider.failed',provider.id,now);
          });
          fail(503,'PROVIDER_UNAVAILABLE','자료를 가져오지 못했습니다. 기존 공개판과 마지막 성공 시각은 유지됩니다.');
        }
        finally{await repository.db.prepare('DELETE FROM provider_leases WHERE provider_id=? AND owner=?').run(provider.id,leaseOwner);}return true;
      }
      if(path==='/api/v1/admin/status'&&method==='GET'){
        const current=(await repository.current()),allCampuses=canReadCatalog(user,current),draftScope=catalogScopeSql(user,'drafts'),reportScope=identityScopeSql(user);
        (await send({catalogRevision:(await repository.revision()),currentRelease:(await repository.setting('currentRelease')),startedAt,metrics:allCampuses?metrics:{},drafts:(await repository.db.prepare(`SELECT id,status,revision,summary FROM drafts WHERE ${draftScope.sql} ORDER BY updated_at DESC,id DESC LIMIT 100`).all(...draftScope.parameters)),reportCount:Number((await repository.db.prepare(`SELECT COUNT(*) count FROM reports LEFT JOIN identities identity ON identity.id=reports.space_id WHERE ${reportScope.sql}`).get(...reportScope.parameters))?.count),sources:allCampuses?arrayRecords(current.sources).map((s)=>({id:s.id,dates:s.dates,owner:s.owner||null})):[],integrations:allCampuses?arrayRecords(current.services).map((s)=>({id:s.id,status:s.status||'unconfigured',lastSuccessAt:s.lastSuccessAt||null})):[],catalogReadable:allCampuses,user}));return true;
      }
      if(path==='/api/v1/admin/catalog'&&method==='GET'){const catalog=(await repository.current());assertCatalogReadable(user,catalog);(await send(catalog));return true;}
      if(path==='/api/v1/admin/drafts'&&method==='GET'){const page=pagination(url),scope=catalogScopeSql(user,'drafts');(await sendPage((await repository.db.prepare(`SELECT * FROM drafts WHERE ${scope.sql} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`).all(...scope.parameters,page.limit+1,page.offset)),page,(row)=>safeDraft(row,user)));return true;}
      if(path==='/api/v1/admin/drafts'&&method==='POST'){const body=await readBody(request);revision(body,(await repository.revision()));const catalog=(await checkedCatalog(body.catalog,user)),summary=text(body.summary,500,'변경 요약');const id=randomUUID();(await repository.db.prepare('INSERT INTO drafts(id,catalog,summary,status,author_id,revision,base_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,JSON.stringify(catalog),summary,'draft',user.id,1,(await repository.revision()),now,now));(await repository.audit(user.id,'draft.created',id,now));(await send(safeDraft((await repository.db.prepare('SELECT * FROM drafts WHERE id=?').get(id))!,user),201));return true;}
      const draftMatch=path.match(/^\/api\/v1\/admin\/drafts\/([a-f0-9-]+)$/);
      if(draftMatch&&method==='PATCH'){const body=await readBody(request);const row=(await repository.db.prepare('SELECT * FROM drafts WHERE id=?').get(draftMatch[1]));if(!row)fail(404,'RESOURCE_NOT_FOUND','초안을 찾을 수 없습니다.');revision(body,Number(row.revision));(await assertCatalogScope(user,object(JSON.parse(String(row.catalog)))));let catalog=object(JSON.parse(String(row.catalog))),summary=String(row.summary),nextStatus=String(row.status),reviewer=row.reviewer_id?String(row.reviewer_id):null;
        if(body.catalog!==undefined||body.summary!==undefined){if(!['draft','rejected'].includes(nextStatus)|| (user.role!=='admin'&&row.author_id!==user.id))fail(403,'FORBIDDEN','본인의 편집 가능한 초안만 수정할 수 있습니다.');if(body.catalog!==undefined)catalog=(await checkedCatalog(body.catalog,user));if(body.summary!==undefined)summary=text(body.summary,500,'변경 요약');nextStatus='draft';reviewer=null;}
        if(body.action==='submit'){if(!['draft','rejected'].includes(nextStatus)||(user.role!=='admin'&&row.author_id!==user.id))fail(409,'INVALID_TRANSITION','제출할 수 있는 초안이 아닙니다.');nextStatus='submitted';}
        else if(body.action==='approve'||body.action==='reject'){if(!['reviewer','admin'].includes(user.role))fail(403,'FORBIDDEN','검토 권한이 필요합니다.');if(nextStatus!=='submitted')fail(409,'INVALID_TRANSITION','제출된 초안만 검토할 수 있습니다.');if(user.role!=='admin'&&row.author_id===user.id)fail(403,'SELF_APPROVAL_REJECTED','다른 검토자가 승인해야 합니다.');nextStatus=body.action==='approve'?'approved':'rejected';reviewer=user.id;}
        else if(body.action!==undefined)fail(422,'INVALID_ACTION','지원하지 않는 초안 작업입니다.');
        (await repository.db.prepare('UPDATE drafts SET catalog=?,summary=?,status=?,reviewer_id=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(catalog),summary,nextStatus,reviewer,now,String(row.id)));(await repository.audit(user.id,`draft.${String(body.action||'updated')}`,String(row.id),now));(await send(safeDraft((await repository.db.prepare('SELECT * FROM drafts WHERE id=?').get(String(row.id)))!,user)));return true;
      }
      if(path==='/api/v1/admin/releases'&&method==='GET'){const page=pagination(url),scope=catalogScopeSql(user,'releases');(await sendPage((await repository.db.prepare(`SELECT id,summary,draft_id AS draftId,created_at AS createdAt FROM releases WHERE ${scope.sql} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...scope.parameters,page.limit+1,page.offset)),page));return true;}
      if(path==='/api/v1/admin/releases'&&method==='POST'){if(!['admin','reviewer'].includes(user.role))fail(403,'FORBIDDEN','공개 권한이 필요합니다.');const body=await readBody(request);revision(body,(await repository.revision()));const row=(await repository.db.prepare('SELECT * FROM drafts WHERE id=?').get(text(body.draftId,100,'초안')));if(!row)fail(404,'RESOURCE_NOT_FOUND','초안을 찾을 수 없습니다.');if(row.status!=='approved')fail(409,'APPROVAL_REQUIRED','승인된 초안만 공개할 수 있습니다.');if(Number(row.base_revision)!==(await repository.revision()))fail(409,'BASE_RELEASE_CHANGED','공개 자료가 변경되었습니다. 최신 공개판을 기준으로 새 초안을 검토해 주세요.');const catalog=(await checkedCatalog(JSON.parse(String(row.catalog)),user));const id=randomUUID();const prepared=(await checkedPublicBundle(id,catalog,now));(await repository.transaction(async ()=>{(await rememberIds(catalog));(await repository.db.prepare('INSERT INTO releases VALUES(?,?,?,?,?,?)').run(id,JSON.stringify(catalog),String(row.summary),String(row.id),user.id,now));(await storeReleaseBundle(repository.db,prepared));(await repository.setSetting('currentRelease',id));(await repository.setSetting('revision',String((await repository.revision())+1)));(await repository.db.prepare("UPDATE drafts SET status='published',revision=revision+1,updated_at=? WHERE id=?").run(now,String(row.id)));(await repository.audit(user.id,'release.published',id,now));}));metrics.releasesPublished++;(await send({id,revision:(await repository.revision()),createdAt:now},201));return true;}
      const restoreMatch=path.match(/^\/api\/v1\/admin\/releases\/([a-f0-9-]+)\/restore$/);
      if(restoreMatch&&method==='POST'){if(user.role!=='admin')fail(403,'FORBIDDEN','복구는 관리자만 수행할 수 있습니다.');const body=await readBody(request);revision(body,(await repository.revision()));const row=(await repository.db.prepare('SELECT catalog FROM releases WHERE id=?').get(restoreMatch[1]));if(!row)fail(404,'RESOURCE_NOT_FOUND','공개판을 찾을 수 없습니다.');const catalog=(await checkedCatalog(JSON.parse(String(row.catalog))));(await ensureBundle(restoreMatch[1],catalog,now));(await repository.transaction(async ()=>{(await rememberIds(catalog,true));(await repository.setSetting('currentRelease',restoreMatch[1]));(await repository.setSetting('revision',String((await repository.revision())+1)));(await repository.audit(user.id,'release.restored',restoreMatch[1],now));}));(await send({id:restoreMatch[1],revision:(await repository.revision())}));return true;}
      if(path==='/api/v1/admin/reports'&&method==='GET'){const page=pagination(url),scope=identityScopeSql(user);(await sendPage((await repository.db.prepare(`SELECT reports.id,reports.space_id,reports.type,reports.description,reports.status,reports.response_note,reports.created_at,reports.updated_at,reports.photo IS NOT NULL AS has_photo FROM reports LEFT JOIN identities identity ON identity.id=reports.space_id WHERE ${scope.sql} ORDER BY reports.created_at DESC,reports.id DESC LIMIT ? OFFSET ?`).all(...scope.parameters,page.limit+1,page.offset)),page,safeReport));return true;}
      const reportMatch=path.match(/^\/api\/v1\/admin\/reports\/([a-f0-9-]+)(\/photo)?$/);
      if(reportMatch){const row=(await repository.db.prepare('SELECT * FROM reports WHERE id=?').get(reportMatch[1]));if(!row)fail(404,'RESOURCE_NOT_FOUND','접수를 찾을 수 없습니다.');(await assertIdentityScope(user,String(row.space_id)));
        if(method==='GET'&&reportMatch[2]){if(!row.photo)fail(404,'RESOURCE_NOT_FOUND','사진이 없습니다.');sendBinary(Buffer.from(row.photo as Uint8Array),{'Content-Type':String(row.photo_mime),'Content-Disposition':'attachment; filename="report-photo"'});return true;}
        if(method==='GET'){(await send(safeReport(row)));return true;}if(method==='PATCH'&&!reportMatch[2]){const body=await readBody(request);const state=text(body.status,20,'처리 상태');if(!['received','reviewing','resolved','rejected'].includes(state))fail(422,'INVALID_STATUS','처리 상태를 확인해 주세요.');const note=text(body.responseNote||'',1000,'처리 내용',false);(await repository.db.prepare('UPDATE reports SET status=?,response_note=?,updated_at=? WHERE id=?').run(state,note,now,String(row.id)));(await repository.audit(user.id,'report.updated',String(row.id),now));(await send(safeReport((await repository.db.prepare('SELECT * FROM reports WHERE id=?').get(String(row.id)))!)));return true;}
      }
      if(path==='/api/v1/admin/operations'&&method==='GET'){const page=pagination(url),scope=identityScopeSql(user);(await sendPage((await repository.db.prepare(`SELECT operations.payload FROM operations LEFT JOIN identities identity ON identity.id=operations.entity_id WHERE ${scope.sql} ORDER BY operations.updated_at DESC,operations.id DESC LIMIT ? OFFSET ?`).all(...scope.parameters,page.limit+1,page.offset)),page,(row)=>object(JSON.parse(String(row.payload)))));return true;}
      if(path==='/api/v1/admin/operations'&&method==='POST'){
        if(!['admin','reviewer'].includes(user.role))fail(403,'FORBIDDEN','운영 정보 공개는 검토 권한이 필요합니다.');
        const body=await readBody(request),payload=(await makeOperation(body,user,now)),id=String(payload.id),entityId=String(payload.entityId);
        const old=(await repository.db.prepare('SELECT entity_id,payload FROM operations WHERE id=?').get(id));
        if(old){(await assertIdentityScope(user,String(old.entity_id)));revision(body,Number(object(JSON.parse(String(old.payload))).revision||1));}
        payload.revision=old?Number(object(JSON.parse(String(old.payload))).revision||1)+1:1;
        (await repository.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET entity_id=excluded.entity_id,payload=excluded.payload,actor_id=excluded.actor_id,updated_at=excluded.updated_at').run(id,entityId,JSON.stringify(payload),user.id,now,now));
        (await repository.audit(user.id,'operation.published',id,now));(await send(payload,old?200:201));return true;
      }
      if(path==='/api/v1/admin/audit'&&method==='GET'){if(user.role!=='admin')fail(403,'FORBIDDEN','관리자 권한이 필요합니다.');const page=pagination(url,200);(await sendPage((await repository.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ? OFFSET ?').all(page.limit+1,page.offset)),page));return true;}
      fail(404,'RESOURCE_NOT_FOUND','요청한 리소스를 찾을 수 없습니다.');
      };
      const external = path==='/api/v1/assistant' || /^\/api\/v1\/admin\/providers\/[^/]+\/sync$/.test(path);
      if (external) await dispatch(); else await repository.transaction(dispatch);
      if (!pending.reply) throw new Error('API did not produce a response.');
      response.writeHead(pending.reply.code,pending.reply.headers);
      // A response is emitted only after the transaction commits successfully.
      const bytes=pending.reply.body;
      function* chunks() { for(let offset=0;offset<bytes.length;offset+=64*1024) yield bytes.subarray(offset,offset+64*1024); }
      await pipeline(Readable.from(chunks()),response);
    } catch(error) {
      const known=error instanceof ApiError; status=known?error.status:error instanceof URIError?400:500;metrics.errors++;
      if(!response.headersSent){response.writeHead(status,headers);response.end(JSON.stringify({data:null,error:{code:known?error.code:'INTERNAL_ERROR',message:known?error.message:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},meta:{requestId}}));}else response.end();
    } finally { options.log?.({timestamp:clock().toISOString(),level:status>=500?'error':'info',service:'campus-api',requestId,operation:(request.url||'').split('?')[0],durationMs:Math.round(performance.now()-started),status}); }
    return true;
  }
  return { handle,repository:localRepository || repository,metrics,close:()=>repository.close() };
}
