CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','approved','rejected','scheduled','published','failed')),
  scheduled_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision_count INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_status_schedule ON posts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_post ON feedback(post_id, created_at);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  source_type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_post ON sources(post_id);

CREATE TABLE IF NOT EXISTS style_rules (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_memory (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  angle TEXT NOT NULL,
  outcome TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topic_memory_topic ON topic_memory(topic);
