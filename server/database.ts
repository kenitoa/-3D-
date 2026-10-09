import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Client, Transaction, InValue } from '@libsql/client';

export type SqlRow = Record<string, unknown>;
export interface SqlStatement {
  get(...args: SQLInputValue[]): Promise<SqlRow | undefined>;
  all(...args: SQLInputValue[]): Promise<SqlRow[]>;
  run(...args: SQLInputValue[]): Promise<{ changes: number }>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  exec(sql: string): Promise<void>;
  batch(statements: { sql: string; args: SQLInputValue[] }[]): Promise<void>;
  transaction<T>(run: () => Promise<T>): Promise<T>;
  close(): void;
}

// Transactions use their own remote connection. Local async requests share an
// exclusive queue so an awaited request cannot join another request's transaction.
export function localDatabase(native: DatabaseSync): SqlDatabase {
  const context = new AsyncLocalStorage<boolean>();
  let queue = Promise.resolve();
  function exclusive<T>(run: () => Promise<T>): Promise<T> {
    const task = queue.then(run);
    queue = task.then(() => undefined, () => undefined);
    return task;
  }
  function operation<T>(run: () => T): Promise<T> {
    return context.getStore() ? Promise.resolve().then(run) : exclusive(async () => run());
  }
  return {
    prepare: sql => ({
      get: (...args) => operation(() => native.prepare(sql).get(...args)),
      all: (...args) => operation(() => native.prepare(sql).all(...args)),
      run: (...args) => operation(() => ({ changes: Number(native.prepare(sql).run(...args).changes) })),
    }),
    exec: sql => operation(() => { native.exec(sql); }),
    batch: statements => operation(() => { for (const { sql, args } of statements) native.prepare(sql).run(...args); }),
    transaction: run => context.getStore() ? run() : exclusive(() => context.run(true, async () => {
      native.exec('BEGIN IMMEDIATE');
      try { const result = await run(); native.exec('COMMIT'); return result; }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    })),
    close: () => native.close(),
  };
}

export async function remoteClient(url: string | undefined, authToken: string | undefined): Promise<Client> {
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  const target = new URL(url);
  if (!['libsql:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || !['', '/'].includes(target.pathname) || target.port || !target.hostname.endsWith('.turso.io')) {
    throw new Error('TURSO_DATABASE_URL must be a TLS Turso database URL.');
  }
  const { createClient } = await import('@libsql/client/web');
  return createClient({ url, authToken, intMode: 'number', concurrency: 8, fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const timeout = AbortSignal.timeout(10_000);
    return fetch(input, { ...init, redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  } });
}

export function libsqlDatabase(client: Client): SqlDatabase {
  const context = new AsyncLocalStorage<Transaction>();
  const values = (args: SQLInputValue[]): InValue[] => args.map(value => ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : value);
  const rows = (items: readonly SqlRow[]): SqlRow[] => items.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof ArrayBuffer ? Buffer.from(value) : value])));
  const execute = (sql: string, args: SQLInputValue[]) => (context.getStore() || client).execute({ sql, args: values(args) });
  return {
    prepare: sql => ({
      get: async (...args) => rows((await execute(sql, args)).rows)[0],
      all: async (...args) => rows((await execute(sql, args)).rows),
      run: async (...args) => ({ changes: (await execute(sql, args)).rowsAffected }),
    }),
    exec: async sql => { await (context.getStore() || client).executeMultiple(sql); },
    batch: async statements => {
      const input = statements.map(({sql,args}) => ({sql,args:values(args)}));
      const transaction = context.getStore();
      if (transaction) await transaction.batch(input); else await client.batch(input,'write');
    },
    transaction: async run => {
      if (context.getStore()) return run();
      const transaction = await client.transaction('write');
      try {
        const result = await context.run(transaction, run);
        await transaction.commit();
        return result;
      } catch (error) {
        if (!transaction.closed) await transaction.rollback();
        throw error;
      } finally { transaction.close(); }
    },
    close: () => client.close(),
  };
}
