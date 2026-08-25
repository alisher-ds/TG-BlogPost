import type { DraftPost, Env, QAResult, TelegramUpdate, TopicCandidate } from "../types";

export function requireEnv(env: Env): void {
  const required: Array<keyof Env> = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "GEMINI_API_KEY",
    "BLOG_USERNAME",
    "ADMIN_TELEGRAM_ID",
    "ADMIN_SECRET",
    "TIMEZONE",
  ];

  const missing = required.filter((key) => !String(env[key] ?? "").trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function parseTelegramUpdate(value: unknown): TelegramUpdate {
  if (!isRecord(value) || !Number.isInteger(value.update_id)) {
    throw new Error("Invalid Telegram update");
  }

  return value as TelegramUpdate;
}

export function parseTopicCandidate(value: unknown): TopicCandidate {
  if (
    !isRecord(value) ||
    typeof value.topic !== "string" ||
    typeof value.angle !== "string" ||
    typeof value.why_now !== "string" ||
    !isFiniteNumber(value.novelty_score) ||
    !isFiniteNumber(value.alisher_fit_score) ||
    !isFiniteNumber(value.value_score) ||
    !isFiniteNumber(value.source_quality_score) ||
    !isUrgency(value.urgency) ||
    !Array.isArray(value.evidence)
  ) {
    throw new Error("Invalid topic candidate returned by AI provider");
  }

  return value as TopicCandidate;
}

export function parseDraftPost(value: unknown): DraftPost {
  if (
    !isRecord(value) ||
    typeof value.title !== "string" ||
    typeof value.angle !== "string" ||
    typeof value.body !== "string" ||
    typeof value.proposed_time !== "string" ||
    typeof value.reasoning !== "string" ||
    !isUrgency(value.urgency) ||
    !Array.isArray(value.sources)
  ) {
    throw new Error("Invalid draft returned by AI provider");
  }

  return value as DraftPost;
}

export function parseQAResult(value: unknown): QAResult {
  if (
    !isRecord(value) ||
    typeof value.passed !== "boolean" ||
    !isFiniteNumber(value.score) ||
    !Array.isArray(value.issues) ||
    !value.issues.every((item) => typeof item === "string") ||
    !Array.isArray(value.strengths) ||
    !value.strengths.every((item) => typeof item === "string") ||
    (value.revised_body !== undefined && typeof value.revised_body !== "string")
  ) {
    throw new Error("Invalid QA result returned by AI provider");
  }

  return value as QAResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUrgency(value: unknown): value is TopicCandidate["urgency"] {
  return value === "evergreen" || value === "timely" || value === "breaking";
}
