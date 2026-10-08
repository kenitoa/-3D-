CREATE TABLE release_bundles (
  release_id TEXT PRIMARY KEY REFERENCES releases(id),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE public_asset_blobs (
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes>0),
  body BLOB NOT NULL,
  PRIMARY KEY(sha256,extension)
);
CREATE TABLE release_asset_links (
  release_id TEXT NOT NULL REFERENCES release_bundles(release_id),
  sha256 TEXT NOT NULL,
  extension TEXT NOT NULL,
  original_path TEXT NOT NULL,
  PRIMARY KEY(release_id, original_path),
  FOREIGN KEY(sha256,extension) REFERENCES public_asset_blobs(sha256,extension)
);
