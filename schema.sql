PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS artists (
  name TEXT PRIMARY KEY,
  photo_key TEXT,
  bio TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cover_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  album_id TEXT,
  track_number INTEGER,
  duration_seconds INTEGER,
  audio_key TEXT NOT NULL UNIQUE,
  cover_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS track_artists (
  track_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, artist_name),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_name) REFERENCES artists(name) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_name);
CREATE INDEX IF NOT EXISTS idx_track_artists_track ON track_artists(track_id);

INSERT OR IGNORE INTO artists(name, sort_order) VALUES
  ('Neggoneko', 1),
  ('erizo eskizo', 2),
  ('xAMMO', 3),
  ('TGT', 4),
  ('Perrancos', 5),
  ('Dasito', 6);

INSERT OR IGNORE INTO app_settings(key, value) VALUES
  ('storage_bytes', '0'),
  ('schema_version', '1');
