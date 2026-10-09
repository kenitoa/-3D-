// Generated from server/database-transfer.ts; run npm run build.
// server/database-transfer.ts
import { DatabaseSync, backup } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync as readFileSync2, lstatSync, realpathSync, openSync, closeSync } from "node:fs";
import { resolve as resolve2, dirname, relative, isAbsolute } from "node:path";

// server/async-repository.ts
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
var migrations = ["0001-platform.sql", "0002-provider-runs.sql", "0003-asset-bundles.sql", "0004-serverless.sql"];
var AsyncRepository = class {
  constructor(root, db) {
    this.root = root;
    this.db = db;
  }
  async migrate() {
    await this.db.exec("CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
    await this.transaction(async () => {
      const version = Number((await this.db.prepare("SELECT MAX(version) AS version FROM migrations").get())?.version || 0);
      if (version > migrations.length) throw new Error("Database schema is newer than this application.");
      for (let index = version; index < migrations.length; index++) {
        await this.db.exec(readFileSync(resolve(this.root, "server/migrations", migrations[index]), "utf8"));
        await this.db.prepare("INSERT INTO migrations VALUES(?,?)").run(index + 1, (/* @__PURE__ */ new Date()).toISOString());
      }
    });
  }
  async assertReady() {
    const version = Number((await this.db.prepare("SELECT MAX(version) AS version FROM migrations").get())?.version);
    if (version !== migrations.length || await this.db.prepare("SELECT fingerprint FROM database_imports WHERE state='importing'").get() || !await this.setting("currentRelease") || !await this.setting("receiptSecret")) throw new Error("Run DB migration/import before serving requests.");
  }
  transaction(run) {
    return this.db.transaction(run);
  }
  async setting(key) {
    const row = await this.db.prepare("SELECT value FROM settings WHERE key=?").get(key);
    return row ? String(row.value) : null;
  }
  async setSetting(key, value) {
    await this.db.prepare("INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
  }
  async current() {
    const row = await this.db.prepare("SELECT catalog FROM releases WHERE id=?").get(await this.setting("currentRelease") || "");
    if (!row) throw new Error("Current release is missing.");
    const value = JSON.parse(String(row.catalog));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stored catalog is invalid.");
    return value;
  }
  async revision() {
    return Number(await this.setting("revision") || 1);
  }
  async audit(actor, operation, resource, at) {
    await this.db.prepare("INSERT INTO audit(actor_id,operation,resource_id,created_at) VALUES(?,?,?,?)").run(actor, operation, resource, at);
  }
  async createUser(username, encodedPassword, role, campusIds) {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username) || !["admin", "editor", "reviewer"].includes(role) || campusIds.some((id2) => !id2) || role !== "admin" && !campusIds.length || !encodedPassword.startsWith("scrypt$32768$")) throw new Error("Invalid user configuration.");
    const id = randomUUID(), now = (/* @__PURE__ */ new Date()).toISOString();
    await this.transaction(async () => {
      await this.db.prepare("INSERT INTO users(id,username,password_hash,role,campus_ids,created_at) VALUES(?,?,?,?,?,?)").run(id, username, encodedPassword, role, JSON.stringify(campusIds), now);
      await this.audit(id, "user.created", id, now);
    });
    return { id, username, role, campusIds };
  }
  close() {
    this.db.close();
  }
};

// server/database.ts
import { AsyncLocalStorage } from "node:async_hooks";
function localDatabase(native) {
  const context = new AsyncLocalStorage();
  let queue = Promise.resolve();
  function exclusive(run) {
    const task = queue.then(run);
    queue = task.then(() => void 0, () => void 0);
    return task;
  }
  function operation(run) {
    return context.getStore() ? Promise.resolve().then(run) : exclusive(async () => run());
  }
  return {
    prepare: (sql) => ({
      get: (...args) => operation(() => native.prepare(sql).get(...args)),
      all: (...args) => operation(() => native.prepare(sql).all(...args)),
      run: (...args) => operation(() => ({ changes: Number(native.prepare(sql).run(...args).changes) }))
    }),
    exec: (sql) => operation(() => {
      native.exec(sql);
    }),
    batch: (statements) => operation(() => {
      for (const { sql, args } of statements) native.prepare(sql).run(...args);
    }),
    transaction: (run) => context.getStore() ? run() : exclusive(() => context.run(true, async () => {
      native.exec("BEGIN IMMEDIATE");
      try {
        const result = await run();
        native.exec("COMMIT");
        return result;
      } catch (error) {
        native.exec("ROLLBACK");
        throw error;
      }
    })),
    close: () => native.close()
  };
}

// server/database-transfer.ts
var tables = ["settings", "users", "sessions", "identities", "drafts", "releases", "reports", "operations", "audit", "provider_runs", "public_asset_blobs", "release_bundles", "release_asset_links"];
var quote = (name) => '"' + name.replace(/"/g, '""') + '"';
function privatePath(root, path) {
  const target = resolve2(path), parent = realpathSync(dirname(target));
  if (!target.endsWith(".sqlite") || existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error("Use an unlinked .sqlite file.");
  for (const name of ["dist", "src", "styles", "vendor", "evidence", "docs", "server", "api"]) {
    const forbidden = resolve2(root, name), actual = existsSync(forbidden) ? realpathSync(forbidden) : forbidden, local = relative(actual, parent);
    if (!local || !local.startsWith("..") && !isAbsolute(local)) throw new Error("Database snapshots must stay outside public/source directories.");
  }
  return resolve2(parent, target.split(/[\\/]/).pop());
}
async function createMigrationSnapshot(root, sourcePath, destination) {
  const source = privatePath(root, sourcePath), target = privatePath(root, destination);
  if (source === target) throw new Error("Snapshot cannot replace its source.");
  const descriptor = openSync(target, "wx", 384);
  closeSync(descriptor);
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(database, target);
  } finally {
    database.close();
  }
}
async function prepareUploadSnapshot(root, sourcePath, destination) {
  await createMigrationSnapshot(root, sourcePath, destination);
  const snapshot = new DatabaseSync(privatePath(root, destination));
  try {
    snapshot.exec("PRAGMA foreign_keys=ON;");
    await new AsyncRepository(root, localDatabase(snapshot)).migrate();
    if (snapshot.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" || snapshot.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Upload snapshot integrity check failed.");
    snapshot.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;");
  } finally {
    snapshot.close();
  }
}
var digest = (row, columns) => createHash("sha256").update(JSON.stringify(columns.map((key) => {
  const value = row[key];
  return value instanceof Uint8Array ? { blob: createHash("sha256").update(value).digest("hex"), bytes: value.byteLength } : value;
}))).digest("hex");
async function importSnapshot(root, snapshotPath, target, onProgress = () => {
}) {
  const path = privatePath(root, snapshotPath), fingerprint = createHash("sha256").update(readFileSync2(path)).digest("hex");
  const source = new DatabaseSync(path, { readOnly: true });
  try {
    if (source.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" || source.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Snapshot integrity check failed.");
    const sourceVersion = Number(source.prepare("SELECT MAX(version) AS version FROM migrations").get()?.version);
    if (!Number.isInteger(sourceVersion) || sourceVersion < 1 || sourceVersion > 4) throw new Error("Unsupported snapshot schema.");
    const repository = new AsyncRepository(root, target);
    await repository.migrate();
    const available = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => String(row.name)));
    await target.transaction(async () => {
      const prior = await target.prepare("SELECT * FROM database_imports").all();
      if (prior.some((row) => row.fingerprint !== fingerprint)) throw new Error("Target belongs to a different import. Use a new empty database.");
      if (prior.length) return;
      for (const table of tables) if (Number((await target.prepare(`SELECT count(*) AS count FROM ${quote(table)}`).get())?.count)) throw new Error("Import target must be empty.");
      await target.prepare("INSERT INTO database_imports(fingerprint,state,created_at) VALUES(?,'importing',?)").run(fingerprint, (/* @__PURE__ */ new Date()).toISOString());
    });
    const progress = await target.prepare("SELECT * FROM database_imports WHERE fingerprint=?").get(fingerprint);
    const totals = {};
    for (let index = 0; index < tables.length; index++) {
      const table = tables[index], columns = source.prepare(`PRAGMA table_info(${quote(table)})`).all().map((row) => String(row.name));
      const sourceCount = available.has(table) ? Number(source.prepare(`SELECT count(*) AS count FROM ${quote(table)}`).get()?.count) : 0;
      totals[table] = sourceCount;
      if (!available.has(table)) continue;
      if (index < Number(progress?.cursor_table) || progress?.state === "complete") continue;
      let cursor = index === Number(progress?.cursor_table) ? Number(progress?.cursor_row) : 0;
      for (; ; ) {
        const rows = source.prepare(`SELECT rowid AS __rowid,* FROM ${quote(table)} WHERE rowid>? ORDER BY rowid LIMIT 25`).all(cursor);
        if (!rows.length) break;
        for (const row of rows) {
          await target.transaction(async () => {
            const blobs = columns.filter((column) => row[column] instanceof Uint8Array && row[column].byteLength > 512 * 1024);
            const values = columns.map((column) => blobs.includes(column) ? row[column].subarray(0, 512 * 1024) : row[column]);
            await target.prepare(`INSERT INTO ${quote(table)}(rowid,${columns.map(quote).join(",")}) VALUES(${Array(columns.length + 1).fill("?").join(",")})`).run(Number(row.__rowid), ...values);
            for (const column of blobs) {
              const bytes = row[column];
              for (let offset = 512 * 1024; offset < bytes.byteLength; offset += 512 * 1024) await target.prepare(`UPDATE ${quote(table)} SET ${quote(column)}=CAST(${quote(column)} || ? AS BLOB) WHERE rowid=?`).run(bytes.subarray(offset, offset + 512 * 1024), Number(row.__rowid));
            }
            await target.prepare("UPDATE database_imports SET cursor_table=?,cursor_row=? WHERE fingerprint=?").run(index, Number(row.__rowid), fingerprint);
          });
          cursor = Number(row.__rowid);
        }
        onProgress(table, cursor);
      }
      await target.prepare("UPDATE database_imports SET cursor_table=?,cursor_row=0 WHERE fingerprint=?").run(index + 1, fingerprint);
    }
    for (const table of tables) {
      if (Number((await target.prepare(`SELECT count(*) AS count FROM ${quote(table)}`).get())?.count) !== totals[table]) throw new Error(`Import row count mismatch (${table}).`);
      if (!available.has(table)) continue;
      const columns = source.prepare(`PRAGMA table_info(${quote(table)})`).all().map((row) => String(row.name));
      let cursor = 0;
      for (; ; ) {
        const rows = source.prepare(`SELECT rowid AS __rowid,* FROM ${quote(table)} WHERE rowid>? ORDER BY rowid LIMIT 25`).all(cursor);
        if (!rows.length) break;
        for (const row of rows) {
          const actual = await target.prepare(`SELECT * FROM ${quote(table)} WHERE rowid=?`).get(Number(row.__rowid));
          if (!actual || digest(actual, columns) !== digest(row, columns)) throw new Error(`Import integrity mismatch (${table}).`);
          cursor = Number(row.__rowid);
        }
      }
    }
    if ((await target.prepare("PRAGMA foreign_key_check").all()).length) throw new Error("Target foreign key verification failed.");
    await target.prepare("UPDATE database_imports SET state='complete',completed_at=? WHERE fingerprint=?").run((/* @__PURE__ */ new Date()).toISOString(), fingerprint);
    await repository.assertReady();
    return totals;
  } finally {
    source.close();
  }
}
export {
  createMigrationSnapshot,
  importSnapshot,
  prepareUploadSnapshot
};
