import type { Env } from "./types";
import { ensureTelegramWebhook, handleTelegramUpdate, sendApprovalPreview } from "./telegram";
import { publishDue, revisePost, runEditorialCycle, sendDueApprovals } from "./editorial";

const WORKER_ORIGIN = "https://tg-blogpost.alishertuuchiyev.workers.dev";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "tg-blogpost",
        time: new Date().toISOString(),
        configured: {
          telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
          gemini: Boolean(env.GEMINI_API_KEY),
          d1: Boolean(env.DB),
          admin: Boolean(env.ADMIN_TELEGRAM_ID),
          blog: Boolean(env.BLOG_USERNAME),
        },
      });
    }

    if (url.pathname === "/setup-webhook" && request.method === "GET") {
      try {
        if (!env.TELEGRAM_BOT_TOKEN) {
          return Response.json({ ok: false, error: "telegram_token_missing" }, { status: 500 });
        }
        await ensureTelegramWebhook(env, WORKER_ORIGIN);
        return Response.json({ ok: true, webhook: `${WORKER_ORIGIN}/telegram/webhook` });
      } catch (error) {
        console.error("Manual Telegram webhook setup failed", error);
        const message = error instanceof Error ? error.message : "unknown_error";
        return Response.json({ ok: false, error: "telegram_webhook_setup_failed", detail: message }, { status: 502 });
      }
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const update = await request.json() as any;
      ctx.waitUntil((async () => {
        try {
          await handleTelegramUpdate(env, update);
          const message = update?.message;
          if (message?.chat?.id?.toString() === env.ADMIN_TELEGRAM_ID && typeof message.text === "string" && !message.text.startsWith("/")) {
            const postId = await revisePost(env, message.text.trim());
            if (postId) await sendApprovalPreview(env, postId);
          }
        } catch (error) {
          console.error("Telegram update handling failed", error);
        }
      })());
      return Response.json({ ok: true });
    }

    if (url.pathname === "/admin/run" && request.method === "POST") {
      if (request.headers.get("x-admin-secret") !== env.ADMIN_TELEGRAM_ID) return new Response("Unauthorized", { status: 401 });
      ctx.waitUntil(runEditorialCycle(env));
      return Response.json({ ok: true, queued: true });
    }

    if (url.pathname === "/admin/revise" && request.method === "POST") {
      if (request.headers.get("x-admin-secret") !== env.ADMIN_TELEGRAM_ID) return new Response("Unauthorized", { status: 401 });
      const body = await request.json() as { instruction?: string };
      if (!body.instruction) return Response.json({ ok: false, error: "instruction_required" }, { status: 400 });
      const postId = await revisePost(env, body.instruction);
      if (postId) await sendApprovalPreview(env, postId);
      return Response.json({ ok: true, postId });
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      try {
        await ensureTelegramWebhook(env, WORKER_ORIGIN);
      } catch (error) {
        console.error("Telegram webhook registration failed", error);
      }

      await publishDue(env);
      await sendDueApprovals(env);

      const active = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM posts WHERE status IN ('candidate','draft','pending_approval','approved','scheduled','revision_requested')",
      ).first<{ count: number }>();

      if ((active?.count ?? 0) === 0) await runEditorialCycle(env);
    })());
  },
};
