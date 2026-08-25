import type { Env } from "./types";

let schemaPromise: Promise<void> | null = null;

const SCHEMA_SQL = `
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
  publish_claimed_at TEXT,
  publish_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision_count INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  qa_score REAL,
  qa_notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_posts_status_schedule ON posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_publish_claim ON posts(status, publish_claimed_at);
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

CREATE TABLE IF NOT EXISTS processed_telegram_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_processed_telegram_updates_time ON processed_telegram_updates(processed_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_locks (
  name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pipeline_locks_expiry ON pipeline_locks(expires_at);

INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES
  ('blog_username', 'AlisherTuychiyev', datetime('now')),
  ('admin_telegram_id', '6276407335', datetime('now')),
  ('timezone', 'Asia/Tashkent', datetime('now')),
  ('min_post_gap_hours', '18', datetime('now')),
  ('max_post_gap_hours', '120', datetime('now')),
  ('approval_lead_minutes', '20', datetime('now')),
  ('image_generation_enabled', 'false', datetime('now')),
  ('min_qa_score', '85', datetime('now')),
  ('max_revisions', '3', datetime('now')),
  ('approval_required', 'true', datetime('now'));

INSERT OR IGNORE INTO style_rules(key,value,confidence,source,updated_at) VALUES
  ('language','Uzbek Latin script; natural Uzbek conversational syntax',1.0,'manual-style-analysis',datetime('now')),
  ('emoji_policy','Do not use emojis by default; only when genuinely natural',1.0,'manual-style-analysis',datetime('now')),
  ('hashtag_policy','Never add hashtags to normal blog posts',1.0,'manual-style-analysis',datetime('now')),
  ('rubric_policy','Do not print rubric/category labels inside the post',1.0,'manual-style-analysis',datetime('now')),
  ('punctuation_va','Do not import English comma conventions before the Uzbek conjunction "va"',1.0,'manual-style-analysis',datetime('now')),
  ('dash_policy','Avoid em dashes and stylistic hyphens; use ordinary Uzbek sentence flow',1.0,'manual-style-analysis',datetime('now')),
  ('voice','Personal, observant, thoughtful, conversational and genuinely human',1.0,'manual-style-analysis',datetime('now')),
  ('intellectual_level','Do not explain obvious beginner ideas; seek a non-obvious angle',1.0,'manual-style-analysis',datetime('now')),
  ('originality','Never copy or paraphrase a ready-made internet or Telegram post',1.0,'manual-style-analysis',datetime('now')),
  ('topic_scope','Blog is broad; AI/IT is only one part of the authors worldview',1.0,'manual-style-analysis',datetime('now')),
  ('posting_frequency','Irregular 2-4 posts in a typical week; no fixed recurring schedule',0.9,'manual-style-analysis',datetime('now')),
  ('image_policy','Images are optional and disabled in the core pipeline',1.0,'manual-style-analysis',datetime('now')),
  ('ending_policy','Do not force a moral, motivational ending or question',1.0,'manual-style-analysis',datetime('now')),
  ('quality_policy','No post is better than a weak or filler post',1.0,'manual-style-analysis',datetime('now'));

-- Backward-compatible migration for databases created before publish claims existed.
ALTER TABLE posts ADD COLUMN publish_claimed_at TEXT;
ALTER TABLE posts ADD COLUMN publish_attempts INTEGER NOT NULL DEFAULT 0;
`;

export function ensureSchema(env: Env): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = env.DB.exec(SCHEMA_SQL).then(() => undefined).catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("duplicate column name")) return;
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
