CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK(hits>0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);
CREATE TABLE provider_leases (
  provider_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE database_imports (
  fingerprint TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN('importing','complete')),
  cursor_table INTEGER NOT NULL DEFAULT 0,
  cursor_row INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
