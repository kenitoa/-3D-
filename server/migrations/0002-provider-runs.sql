CREATE TABLE provider_runs (
  provider_id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN('unconfigured','success','failed')),
  last_attempt_at TEXT NOT NULL, last_success_at TEXT, draft_id TEXT REFERENCES drafts(id), error_code TEXT
);
