CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('editor','reviewer','admin')),
  campus_ids TEXT NOT NULL DEFAULT '[]', disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN(0,1)), created_at TEXT NOT NULL
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE drafts (
  id TEXT PRIMARY KEY, catalog TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('draft','submitted','approved','rejected','published')),
  author_id TEXT NOT NULL REFERENCES users(id), reviewer_id TEXT REFERENCES users(id), revision INTEGER NOT NULL CHECK(revision>0), base_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE releases (id TEXT PRIMARY KEY, catalog TEXT NOT NULL, summary TEXT NOT NULL, draft_id TEXT REFERENCES drafts(id), actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE identities (id TEXT PRIMARY KEY, campus_id TEXT NOT NULL, kind TEXT NOT NULL, retired INTEGER NOT NULL DEFAULT 0 CHECK(retired IN(0,1)));
CREATE TABLE reports (
  id TEXT PRIMARY KEY, space_id TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('received','reviewing','resolved','rejected')),
  photo BLOB, photo_mime TEXT, idempotency_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
  response_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX reports_status ON reports(status, created_at);
CREATE TABLE operations (
  id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, payload TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX operations_entity ON operations(entity_id);
CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, operation TEXT NOT NULL, resource_id TEXT, created_at TEXT NOT NULL);
