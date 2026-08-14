PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('candidate','draft','pending_approval','approved','scheduled','published','rejected','revision_requested','failed')),
  source_type TEXT,
  scheduled_at TEXT,
  approval_sent_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision_count INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  qa_score REAL,
  qa_notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_posts_status_schedule ON posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  url TEXT NOT NULL,
  canonical_url TEXT,
  title TEXT,
  source_type TEXT,
  credibility_score REAL NOT NULL DEFAULT 0.5,
  notes TEXT,
  fetched_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sources_post ON sources(post_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_canonical ON sources(canonical_url) WHERE canonical_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  angle TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  novelty_score REAL NOT NULL DEFAULT 0,
  alisher_fit_score REAL NOT NULL DEFAULT 0,
  value_score REAL NOT NULL DEFAULT 0,
  urgency TEXT NOT NULL DEFAULT 'evergreen',
  status TEXT NOT NULL DEFAULT 'candidate',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_topics_status_score ON topics(status, score DESC);

CREATE TABLE IF NOT EXISTS style_rules (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_post ON feedback(post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  key TEXT,
  value TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_kind ON memory(kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_runs_kind_started ON runs(kind, started_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES
  ('blog_username', 'AlisherTuychiyev', datetime('now')),
  ('admin_telegram_id', '6276407335', datetime('now')),
  ('timezone', 'Asia/Tashkent', datetime('now')),
  ('min_post_gap_hours', '18', datetime('now')),
  ('max_post_gap_hours', '120', datetime('now')),
  ('approval_lead_minutes', '20', datetime('now')),
  ('image_generation_enabled', 'false', datetime('now'));
