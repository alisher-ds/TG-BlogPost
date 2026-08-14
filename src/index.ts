import type { Env } from "./types";
import { handleTelegramUpdate } from "./telegram";
import { publishDue, revisePost, runEditorialCycle, sendDueApprovals } from "./editorial";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "tg-blogpost", time: new Date().toISOString() });
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const update = await request.json();
      ctx.waitUntil(handleTelegramUpdate(env, update));
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
      return Response.json({ ok: true, postId });
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      await publishDue(env);
      await sendDueApprovals(env);

      const active = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM posts WHERE status IN ('candidate','draft','pending_approval','approved','scheduled','revision_requested')",
      ).first<{ count: number }>();

      if ((active?.count ?? 0) === 0) await runEditorialCycle(env);
    })());
  },
};
