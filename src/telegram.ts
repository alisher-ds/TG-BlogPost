import type { Env } from "./types";
import { addFeedback, addMemory, getPost, updatePostStatus } from "./lib/db";

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

export async function handleTelegramUpdate(env: Env, update: any): Promise<void> {
  const callback = update.callback_query;
  if (!callback) {
    const message = update.message;
    if (message?.chat?.id?.toString() === env.ADMIN_TELEGRAM_ID && message?.text === "/start") {
      await callTelegram(env, "sendMessage", {
        chat_id: env.ADMIN_TELEGRAM_ID,
        text: "Blog agent ishlayapti. Postlar tasdiqlashdan o'tmasdan kanalga chiqmaydi.",
      });
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
    await updatePostStatus(env, postId, "approved");
    await addFeedback(env, postId, "approved");
    await answerCallback(env, callback.id, "Tasdiqlandi.");
    return;
  }

  if (action === "reject") {
    await updatePostStatus(env, postId, "revision_requested");
    await addFeedback(env, postId, "rejected", "Telegramdagi Rad etish tugmasi bosildi");
    await addMemory(env, "rejection_pattern", "telegram_rejection", "User rejected a draft from the approval preview; request explicit reason on next message.", 1);
    await answerCallback(env, callback.id, "Rad etildi. Sababini keyingi xabarda yozing.");
    await callTelegram(env, "sendMessage", {
      chat_id: env.ADMIN_TELEGRAM_ID,
      text: "Nimasi yoqmadi? Masalan: fikr sayoz, uslub sun'iy, mavzu qiziq emas, juda uzun yoki o'zingiz xohlagan tuzatishni yozing.",
    });
    return;
  }

  if (action === "edit") {
    await updatePostStatus(env, postId, "revision_requested");
    await answerCallback(env, callback.id, "Tahrirlash rejimi. Keyingi xabarda nimani o'zgartirish kerakligini yozing.");
  }
}

function formatTashkent(value: string): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
