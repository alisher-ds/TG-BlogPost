import type { Env, TelegramUpdate } from "./types";
import { addFeedback, addMemory, getPost, updatePostStatus } from "./lib/db";
import { runEditorialCycle } from "./editorial";

const api = (env: Env, method: string) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

async function callTelegram<T>(env: Env, method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(api(env, method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method}: ${data.description ?? response.status}`);
  return data.result as T;
}

/** Idempotent: safe to call from every cron tick. */
export async function ensureTelegramWebhook(env: Env, origin: string): Promise<void> {
  const webhookUrl = `${origin.replace(/\/$/, "")}/telegram/webhook`;
  await callTelegram(env, "setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
  });
}

export async function sendApprovalPreview(env: Env, postId: string): Promise<void> {
  const post = await getPost(env, postId);
  if (!post) throw new Error("Post not found");

  const text = `Yangi post tayyor.\n\n${post.body}\n\nNashr vaqti: ${formatTashkent(post.scheduled_at)}\n\nPostni ko'rib chiqing.`;
  await callTelegram(env, "sendMessage", {
    chat_id: env.ADMIN_TELEGRAM_ID,
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: "Tasdiqlash", callback_data: `approve:${postId}` },
        { text: "Rad etish", callback_data: `reject:${postId}` },
      ], [
        { text: "Tahrirlash", callback_data: `edit:${postId}` },
      ]],
    },
    disable_web_page_preview: true,
  });
  await updatePostStatus(env, postId, "pending_approval", { approval_sent_at: new Date().toISOString() });
}

export async function publishPost(env: Env, postId: string): Promise<void> {
  const post = await getPost(env, postId);
  if (!post) throw new Error("Post not found");
  await callTelegram(env, "sendMessage", {
    chat_id: `@${env.BLOG_USERNAME}`,
    text: post.body,
    disable_web_page_preview: false,
  });
  await updatePostStatus(env, postId, "published", { published_at: new Date().toISOString() });
}

export async function answerCallback(env: Env, callbackId: string, text: string): Promise<void> {
  await callTelegram(env, "answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: false });
}

async function clearButtons(env: Env, callback: TelegramUpdate["callback_query"]): Promise<void> {
  if (!callback?.message?.chat?.id || !callback.message.message_id) return;
  await callTelegram(env, "editMessageReplyMarkup", {
    chat_id: callback.message.chat.id,
    message_id: callback.message.message_id,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function handleTelegramUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  const callback = update.callback_query;
  if (!callback) {
    const message = update.message;
    if (message?.chat?.id?.toString() !== env.ADMIN_TELEGRAM_ID) return;

    if (message.text === "/start") {
      await callTelegram(env, "sendMessage", {
        chat_id: env.ADMIN_TELEGRAM_ID,
        text: "Blog agent ishlayapti.\n\n/run — yangi editorial cycle\n/status — pipeline holati\n/help — yordam\n\nPostlar siz tasdiqlamasangiz kanalga chiqmaydi.",
      });
      return;
    }

    if (message.text === "/help") {
      await callTelegram(env, "sendMessage", {
        chat_id: env.ADMIN_TELEGRAM_ID,
        text: "/run — yangi mavzu izlash va post tayyorlash\n/status — joriy pipeline\n/start — boshqaruv menyusi\n\nPost kelganda Tasdiqlash, Rad etish yoki Tahrirlash tugmalaridan foydalaning.",
      });
      return;
    }

    if (message.text === "/run") {
      await callTelegram(env, "sendMessage", {
        chat_id: env.ADMIN_TELEGRAM_ID,
        text: "Research boshlandi. Yaxshi mavzu topilmasa post yaratilmaydi.",
      });
      await runEditorialCycle(env);
      return;
    }

    if (message.text === "/status") {
      const rows = await env.DB.prepare(
        "SELECT status, COUNT(*) AS count FROM posts GROUP BY status ORDER BY status",
      ).all<{ status: string; count: number }>();
      const lines = rows.results.length
        ? rows.results.map((row) => `${row.status}: ${row.count}`)
        : ["Hali post yaratilmagan."];
      await callTelegram(env, "sendMessage", {
        chat_id: env.ADMIN_TELEGRAM_ID,
        text: `Pipeline holati:\n\n${lines.join("\n")}`,
      });
      return;
    }

    return;
  }

  if (String(callback.from?.id) !== env.ADMIN_TELEGRAM_ID) {
    await answerCallback(env, callback.id, "Bu tugma siz uchun emas.");
    return;
  }

  const [action, postId] = String(callback.data ?? "").split(":");
  if (!postId) return;

  if (action === "approve") {
    const post = await getPost(env, postId);
    if (!post) return answerCallback(env, callback.id, "Post topilmadi.");
    if (!["pending_approval", "scheduled"].includes(post.status)) {
      return answerCallback(env, callback.id, `Post holati: ${post.status}`);
    }
    await updatePostStatus(env, postId, "approved");
    await addFeedback(env, postId, "approved");
    await clearButtons(env, callback);
    await answerCallback(env, callback.id, "Tasdiqlandi. Belgilangan vaqtda kanalga chiqadi.");
    return;
  }

  if (action === "reject") {
    await updatePostStatus(env, postId, "revision_requested");
    await addFeedback(env, postId, "rejected", "Telegramdagi Rad etish tugmasi bosildi");
    await addMemory(env, "rejection_pattern", "telegram_rejection", "User rejected a draft from the approval preview; explicit feedback should be collected before revision.", 1);
    await clearButtons(env, callback);
    await answerCallback(env, callback.id, "Rad etildi. Sababini keyingi xabarda yozing.");
    await callTelegram(env, "sendMessage", {
      chat_id: env.ADMIN_TELEGRAM_ID,
      text: "Nimasi yoqmadi? Masalan: fikr sayoz, uslub sun'iy, mavzu qiziq emas, juda uzun yoki o'zingiz xohlagan tuzatishni yozing.",
    });
    return;
  }

  if (action === "edit") {
    await updatePostStatus(env, postId, "revision_requested");
    await clearButtons(env, callback);
    await answerCallback(env, callback.id, "Tahrirlash rejimi.");
    await callTelegram(env, "sendMessage", {
      chat_id: env.ADMIN_TELEGRAM_ID,
      text: "Nimani o'zgartirish kerakligini keyingi xabarda yozing.",
    });
  }
}

function formatTashkent(value: string): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
