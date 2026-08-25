import type { Env, PostStatus, SourceEvidence, Urgency } from "../types";

export interface PostRow {
  id: string;
  title: string;
  angle: string;
  body: string;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  approval_sent_at: string | null;
  rejection_reason: string | null;
  qa_score: number | null;
  qa_notes: string | null;
  revision_count: number;
  publish_claimed_at: string | null;
  publish_attempts: number;
  metadata_json: string | null;
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?1").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings(key, value, updated_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
  ).bind(key, value).run();
}

export async function createRun(env: Env, kind: string): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO runs(id, kind, status, started_at) VALUES (?1, ?2, 'running', datetime('now'))",
  ).bind(id, kind).run();
  return id;
}

export async function finishRun(env: Env, id: string, status: string, error?: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE runs SET status=?2, finished_at=datetime('now'), error=?3 WHERE id=?1",
  ).bind(id, status, error ?? null).run();
}

export async function claimTelegramUpdate(env: Env, updateId: number): Promise<boolean> {
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO processed_telegram_updates(update_id, processed_at) VALUES (?1, datetime('now'))",
  ).bind(updateId).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function acquirePipelineLock(env: Env, name: string, ownerId: string, leaseMinutes = 15): Promise<boolean> {
  const result = await env.DB.prepare(
    `INSERT INTO pipeline_locks(name, owner_id, acquired_at, expires_at)
     VALUES (?1, ?2, datetime('now'), datetime('now', ?3))
     ON CONFLICT(name) DO UPDATE SET
       owner_id=excluded.owner_id,
       acquired_at=excluded.acquired_at,
       expires_at=excluded.expires_at
     WHERE pipeline_locks.expires_at <= datetime('now')`,
  ).bind(name, ownerId, `+${leaseMinutes} minutes`).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function releasePipelineLock(env: Env, name: string, ownerId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM pipeline_locks WHERE name=?1 AND owner_id=?2").bind(name, ownerId).run();
}

export async function claimPostForPublishing(env: Env, postId: string, leaseMinutes = 10): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE posts
     SET publish_claimed_at=datetime('now'), publish_attempts=publish_attempts+1, updated_at=datetime('now')
     WHERE id=?1 AND status='approved' AND scheduled_at IS NOT NULL
       AND unixepoch(scheduled_at) <= unixepoch('now')
       AND (publish_claimed_at IS NULL OR unixepoch(publish_claimed_at) <= unixepoch('now', ?2))`,
  ).bind(postId, `-${leaseMinutes} minutes`).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function releasePublishClaim(env: Env, postId: string): Promise<void> {
  await env.DB.prepare("UPDATE posts SET publish_claimed_at=NULL, updated_at=datetime('now') WHERE id=?1 AND status='approved'").bind(postId).run();
}

export async function getLatestPosts(env: Env, limit = 20) {
  const result = await env.DB.prepare(
    "SELECT id, title, angle, body, status, scheduled_at, published_at, created_at, rejection_reason FROM posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?1",
  ).bind(limit).all<Pick<PostRow, "id" | "title" | "angle" | "body" | "status" | "scheduled_at" | "published_at" | "created_at" | "rejection_reason">>();
  return result.results;
}

export async function getRecentBodies(env: Env, limit = 30): Promise<string[]> {
  const result = await env.DB.prepare("SELECT body FROM posts WHERE status IN ('published','approved','scheduled','pending_approval','draft') ORDER BY created_at DESC LIMIT ?1").bind(limit).all<{ body: string }>();
  return result.results.map((row) => row.body);
}

export async function getRecentTopics(env: Env, limit = 50): Promise<Array<{ topic: string; angle: string; status: PostStatus }>> {
  const result = await env.DB.prepare("SELECT topic, angle, status FROM topics ORDER BY created_at DESC LIMIT ?1").bind(limit).all<{ topic: string; angle: string; status: PostStatus }>();
  return result.results;
}

export async function getStyleRules(env: Env): Promise<Array<{ key: string; value: string; confidence: number }>> {
  const result = await env.DB.prepare("SELECT key, value, confidence FROM style_rules ORDER BY confidence DESC, updated_at DESC").bind().all<{ key: string; value: string; confidence: number }>();
  return result.results;
}

export async function insertTopic(env: Env, topic: { topic: string; angle: string; score: number; novelty_score: number; alisher_fit_score: number; value_score: number; urgency: Urgency; evidence: SourceEvidence[] }): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO topics(id, topic, angle, score, novelty_score, alisher_fit_score, value_score, urgency, status, evidence_json, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'candidate',?9,datetime('now'))`,
  ).bind(id, topic.topic, topic.angle, topic.score, topic.novelty_score, topic.alisher_fit_score, topic.value_score, topic.urgency, JSON.stringify(topic.evidence)).run();
  return id;
}

export async function insertPost(env: Env, post: { title: string; angle: string; body: string; scheduledAt: string; status?: PostStatus; metadata?: Record<string, unknown> }): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO posts(id,title,angle,body,status,scheduled_at,created_at,updated_at,metadata_json)
     VALUES (?1,?2,?3,?4,?5,?6,datetime('now'),datetime('now'),?7)`,
  ).bind(id, post.title, post.angle, post.body, post.status ?? "draft", post.scheduledAt, JSON.stringify(post.metadata ?? {})).run();
  return id;
}

export async function getPost(env: Env, id: string): Promise<PostRow | null> {
  return env.DB.prepare("SELECT * FROM posts WHERE id=?1").bind(id).first<PostRow>();
}

export async function updatePostStatus(env: Env, id: string, status: PostStatus, extra: Record<string, unknown> = {}): Promise<void> {
  const sets = ["status=?2", "updated_at=datetime('now')"];
  const values: unknown[] = [id, status];
  let index = 3;
  for (const [key, value] of Object.entries(extra)) {
    if (!["scheduled_at","approval_sent_at","published_at","rejection_reason","qa_score","qa_notes","revision_count","publish_claimed_at","publish_attempts"].includes(key)) continue;
    sets.push(`${key}=?${index++}`);
    values.push(value);
  }
  await env.DB.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id=?1`).bind(...values).run();
}

export async function addFeedback(env: Env, postId: string, action: string, message?: string): Promise<void> {
  await env.DB.prepare("INSERT INTO feedback(id,post_id,action,message,created_at) VALUES (?1,?2,?3,?4,datetime('now'))").bind(crypto.randomUUID(), postId, action, message ?? null).run();
}

export async function addMemory(env: Env, kind: string, key: string | null, value: string, weight = 1): Promise<void> {
  await env.DB.prepare("INSERT INTO memory(id,kind,key,value,weight,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,datetime('now'),datetime('now'))").bind(crypto.randomUUID(), kind, key, value, weight).run();
}
