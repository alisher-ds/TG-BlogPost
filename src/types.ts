export type PostStatus =
  | "candidate"
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "revision_requested"
  | "failed";

export type Urgency = "evergreen" | "timely" | "breaking";

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  BLOG_USERNAME: string;
  ADMIN_TELEGRAM_ID: string;
  TIMEZONE: string;
  DEFAULT_MIN_POST_GAP_HOURS: string;
  DEFAULT_MAX_POST_GAP_HOURS: string;
}

export interface TopicCandidate {
  topic: string;
  angle: string;
  why_now: string;
  novelty_score: number;
  alisher_fit_score: number;
  value_score: number;
  source_quality_score: number;
  urgency: Urgency;
  evidence: SourceEvidence[];
}

export interface SourceEvidence {
  url: string;
  title: string;
  source_type: string;
  credibility_score: number;
  notes?: string;
}

export interface DraftPost {
  title: string;
  angle: string;
  body: string;
  sources: SourceEvidence[];
  urgency: Urgency;
  proposed_time: string;
  reasoning: string;
}

export interface QAResult {
  passed: boolean;
  score: number;
  issues: string[];
  strengths: string[];
  revised_body?: string;
}

export interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from?: { id: number };
    data?: string;
    message?: { chat?: { id?: number }; message_id?: number };
  };
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
}
