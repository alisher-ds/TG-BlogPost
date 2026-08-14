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

type Status = "draft" | "approved" | "rejected" | "scheduled" | "published" | "failed";

interface Candidate {
  id: string;
  title: string;
  angle: string;
  body: string;
  scheduledAt: string;
  status: Status;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "tg-blogpost", time: new Date().toISOString() });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const update = await request.json().catch(() => null);
      ctx.waitUntil(handleTelegramUpdate(env, update));
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/admin/run") {
      const secret = request.headers.get("x-admin-secret");
      if (!secret || secret !== env.ADMIN_TELEGRAM_ID) return json({ error: "unauthorized" }, 401);
      ctx.waitUntil(runEditorialCycle(env));
      return json({ ok: true, started: true });
    }

    return json({ error: "not_found" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runEditorialCycle(env));
  },
};

async function runEditorialCycle(env: Env): Promise<void> {
  await ensureSchema(env.DB);

  // The first production milestone deliberately stops before autonomous publishing.
  // A later cycle will research, write, QA, schedule and send the approval preview.
  const pending = await env.DB.prepare(
    "SELECT id, title, angle, body, scheduled_at as scheduledAt, status FROM posts WHERE status IN ('draft','approved','scheduled') ORDER BY created_at ASC LIMIT 5",
  ).all<Candidate>();

  for (const post of pending.results) {
    if (post.status === "approved" && new Date(post.scheduledAt).getTime() <= Date.now() + 20 * 60 * 1000) {
      await sendApprovalReminder(env, post);
    }
  }
}

async function ensureSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      angle TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision_count INTEGER NOT NULL DEFAULT 0,
      rejection_reason TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      action TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      url TEXT NOT NULL,
      title TEXT,
      source_type TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS style_rules (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`),
  ]);
}

async function handleTelegramUpdate(env: Env, update: unknown): Promise<void> {
  const message = (update as { message?: { chat?: { id?: number }; text?: string } })?.message;
  if (!message?.chat?.id || !message.text) return;
  if (String(message.chat.id) !== env.ADMIN_TELEGRAM_ID) return;

  const text = message.text.trim();
  if (text === "/start") {
    await telegramSend(env, message.chat.id, "Blog boshqaruvi tayyor.\n\n/post — holat\n/run — editorial cycle\n/help — yordam");
    return;
  }

  if (text === "/help") {
    await telegramSend(env, message.chat.id, "Tasdiqlash va rad etish tugmalari keyingi bosqichda ulanadi. Hozircha tizim xavfsiz preview-only rejimda.");
    return;
  }

  if (text === "/run") {
    await runEditorialCycle(env);
    await telegramSend(env, message.chat.id, "Editorial cycle ishga tushirildi.");
  }
}

async function sendApprovalReminder(env: Env, post: Candidate): Promise<void> {
  const keyboard = {
    inline_keyboard: [[
      { text: "✓ TASDIQLASH", callback_data: `approve:${post.id}` },
      { text: "✕ RAD ETISH", callback_data: `reject:${post.id}` },
    ]],
  };

  await telegramSend(
    env,
    Number(env.ADMIN_TELEGRAM_ID),
    `Yangi post tayyor.\n\n${post.body}\n\nRejalashtirilgan vaqt: ${post.scheduledAt}`,
    keyboard,
  );
}

async function telegramSend(env: Env, chatId: number, text: string, replyMarkup?: unknown): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${detail.slice(0, 500)}`);
  }
}
