import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SqlDatabase, SqlRow } from './database';

export const migrations = ['0001-platform.sql', '0002-provider-runs.sql', '0003-asset-bundles.sql', '0004-serverless.sql'];
export class AsyncRepository {
  constructor(public root: string, public db: SqlDatabase) {}
  async migrate(): Promise<void> {
    await this.db.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);');
    await this.transaction(async () => {
      const version = Number((await this.db.prepare('SELECT MAX(version) AS version FROM migrations').get())?.version || 0);
      if (version > migrations.length) throw new Error('Database schema is newer than this application.');
      for (let index = version; index < migrations.length; index++) {
        await this.db.exec(readFileSync(resolve(this.root, 'server/migrations', migrations[index]), 'utf8'));
        await this.db.prepare('INSERT INTO migrations VALUES(?,?)').run(index + 1, new Date().toISOString());
      }
    });
  }
  async assertReady(): Promise<void> {
    const version = Number((await this.db.prepare('SELECT MAX(version) AS version FROM migrations').get())?.version);
    if (version !== migrations.length || await this.db.prepare("SELECT fingerprint FROM database_imports WHERE state='importing'").get() || !await this.setting('currentRelease') || !await this.setting('receiptSecret')) throw new Error('Run DB migration/import before serving requests.');
  }
  transaction<T>(run: () => Promise<T>): Promise<T> { return this.db.transaction(run); }
  async setting(key: string): Promise<string | null> { const row = await this.db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? String(row.value) : null; }
  async setSetting(key: string, value: string): Promise<void> { await this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  async current(): Promise<SqlRow> {
    const row = await this.db.prepare('SELECT catalog FROM releases WHERE id=?').get(await this.setting('currentRelease') || '');
    if (!row) throw new Error('Current release is missing.');
    const value: unknown = JSON.parse(String(row.catalog));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Stored catalog is invalid.');
    return value as SqlRow;
  }
  async revision(): Promise<number> { return Number(await this.setting('revision') || 1); }
  async audit(actor: string | null, operation: string, resource: string | null, at: string): Promise<void> { await this.db.prepare('INSERT INTO audit(actor_id,operation,resource_id,created_at) VALUES(?,?,?,?)').run(actor, operation, resource, at); }
  async createUser(username: string, encodedPassword: string, role: 'admin' | 'editor' | 'reviewer', campusIds: string[]): Promise<{ id: string; username: string; role: string; campusIds: string[] }> {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username) || !['admin', 'editor', 'reviewer'].includes(role) || campusIds.some(id => !id) || role !== 'admin' && !campusIds.length || !encodedPassword.startsWith('scrypt$32768$')) throw new Error('Invalid user configuration.');
    const id = randomUUID(), now = new Date().toISOString();
    await this.transaction(async () => {
      await this.db.prepare('INSERT INTO users(id,username,password_hash,role,campus_ids,created_at) VALUES(?,?,?,?,?,?)').run(id, username, encodedPassword, role, JSON.stringify(campusIds), now);
      await this.audit(id, 'user.created', id, now);
    });
    return { id, username, role, campusIds };
  }
  close(): void { this.db.close(); }
}
