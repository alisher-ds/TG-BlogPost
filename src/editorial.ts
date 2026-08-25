import type { Env } from "./types";
import { researchAndSelect, qualityCheck, writeDraft } from "./agents/editorial";
import { acquirePipelineLock, addFeedback, claimPostForPublishing, createRun, finishRun, getPost, insertPost, releasePipelineLock, releasePublishClaim, updatePostStatus } from "./lib/db";
import { sendApprovalPreview, publishPost } from "./telegram";
import { geminiJson } from "./providers/gemini";
import { ALISHER_STYLE_DNA } from "./prompts/style";

export async function runEditorialCycle(env: Env): Promise<void> {
  const runId = await createRun(env, "editorial-cycle");
  const lockOwner = runId;
  const acquired = await acquirePipelineLock(env, "editorial-cycle", lockOwner, 15);
  if (!acquired) {
    await finishRun(env, runId, "skipped", "Another editorial cycle is already running");
    return;
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM posts WHERE status IN ('draft','pending_approval','approved','scheduled','revision_requested')",
    ).first<{ count: number }>();
    if ((existing?.count ?? 0) > 0) {
      await finishRun(env, runId, "skipped", "There is already an active post in the pipeline");
      return;
    }

    const topic = await researchAndSelect(env);
    if (!topic) {
      await finishRun(env, runId, "no-topic");
      return;
    }

    const draft = await writeDraft(env, topic);
    let qa = await qualityCheck(env, draft);
    let finalDraft = draft;

    if (!qa.passed && qa.revised_body && qa.score >= 70) {
      finalDraft = { ...draft, body: qa.revised_body };
      qa = await qualityCheck(env, finalDraft);
    }

    if (!qa.passed) {
      await finishRun(env, runId, "rejected", qa.issues.join(" | "));
      return;
    }

    const scheduledAt = chooseNaturalTime(finalDraft.proposed_time, env.DEFAULT_MIN_POST_GAP_HOURS, env.DEFAULT_MAX_POST_GAP_HOURS);
    const postId = await insertPost(env, {
      title: finalDraft.title,
      angle: finalDraft.angle,
      body: finalDraft.body,
      scheduledAt,
      status: "scheduled",
      metadata: {
        urgency: finalDraft.urgency,
        reasoning: finalDraft.reasoning,
        sources: topic.evidence,
        qa_score: qa.score,
      },
    });

    for (const source of topic.evidence ?? []) {
      await env.DB.prepare(
        `INSERT INTO sources(id,post_id,url,canonical_url,title,source_type,credibility_score,notes,created_at)
         VALUES (?1,?2,?3,?3,?4,?5,?6,?7,datetime('now'))`,
      ).bind(crypto.randomUUID(), postId, source.url, source.title, source.source_type, source.credibility_score, source.notes ?? null).run();
    }

    await finishRun(env, runId, "success");
  } catch (error) {
    await finishRun(env, runId, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await releasePipelineLock(env, "editorial-cycle", lockOwner);
  }
}

export async function sendDueApprovals(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT id FROM posts
     WHERE status='scheduled'
       AND approval_sent_at IS NULL
       AND unixepoch(scheduled_at) > unixepoch('now')
       AND unixepoch(scheduled_at) <= unixepoch('now', '+20 minutes')
     ORDER BY unixepoch(scheduled_at) ASC LIMIT 3`,
  ).all<{ id: string }>();

  for (const row of rows.results) {
    await sendApprovalPreview(env, row.id);
  }
}

export async function publishDue(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT id FROM posts
     WHERE status='approved'
       AND unixepoch(scheduled_at) <= unixepoch('now')
     ORDER BY unixepoch(scheduled_at) ASC LIMIT 5`,
  ).all<{ id: string }>();

  for (const row of rows.results) {
    const claimed = await claimPostForPublishing(env, row.id, 10);
    if (!claimed) continue;

    try {
      await publishPost(env, row.id);
    } catch (error) {
      await releasePublishClaim(env, row.id);
      await updatePostStatus(env, row.id, "failed", {
        rejection_reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function revisePost(env: Env, instruction: string): Promise<string | null> {
  const post = await env.DB.prepare(
    "SELECT * FROM posts WHERE status='revision_requested' ORDER BY updated_at DESC LIMIT 1",
  ).first<any>();
  if (!post) return null;

  const prompt = `${ALISHER_STYLE_DNA}

Revise the following personal Telegram post using the user's feedback.
Do not blindly obey feedback if it would make the post unnatural. Preserve the useful idea and factual basis.

CURRENT POST:
${post.body}

USER FEEDBACK:
${instruction}

Return JSON: {"body":"...","angle":"...","change_summary":"..."}`;

  const revision = await geminiJson<{ body: string; angle: string; change_summary: string }>(env, prompt, false);
  await env.DB.prepare(
    "UPDATE posts SET body=?2, angle=?3, status='scheduled', revision_count=revision_count+1, rejection_reason=NULL, approval_sent_at=NULL, publish_claimed_at=NULL, updated_at=datetime('now') WHERE id=?1",
  ).bind(post.id, revision.body, revision.angle).run();
  await addFeedback(env, post.id, "revision", instruction);
  return post.id;
}

function chooseNaturalTime(proposed: string, minGapText: string, maxGapText: string): string {
  const now = new Date();
  const minGap = Number(minGapText || 18);
  const maxGap = Number(maxGapText || 120);
  let candidate = new Date(proposed);
  if (Number.isNaN(candidate.getTime())) candidate = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const min = new Date(now.getTime() + minGap * 60 * 60 * 1000);
  const max = new Date(now.getTime() + maxGap * 60 * 60 * 1000);
  if (candidate < min) candidate = min;
  if (candidate > max) candidate = max;

  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(Math.ceil(candidate.getUTCMinutes() / 5) * 5);
  return candidate.toISOString().replace(".000Z", "Z");
}
