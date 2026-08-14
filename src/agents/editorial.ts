import type { Env, DraftPost, QAResult, TopicCandidate } from "../types";
import { geminiJson } from "../providers/gemini";
import { getRecentBodies, getRecentTopics, getStyleRules, insertTopic } from "../lib/db";
import { ALISHER_STYLE_DNA } from "../prompts/style";

function compact(text: string, max = 9000): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export async function researchAndSelect(env: Env): Promise<TopicCandidate | null> {
  const [recentBodies, recentTopics, styleRules] = await Promise.all([
    getRecentBodies(env),
    getRecentTopics(env),
    getStyleRules(env),
  ]);

  const prompt = `${ALISHER_STYLE_DNA}

You are the editorial research director, not a writer.
Search the open web broadly and find current or evergreen subjects that could genuinely fit a personal blog written by Alisher.
The blog is NOT an AI/IT-only blog. Consider technology, learning, books, psychology, career, business, culture, interesting observations, science, podcasts, personal development and other subjects when relevant.

NON-NEGOTIABLE:
1. Do not copy or paraphrase an existing Telegram/social post.
2. Use sources as evidence, not as text to imitate.
3. Reject topics that are obvious to an informed young IT/ML student.
4. Reject topics that merely repeat the author's existing ideas.
5. Prefer a specific angle, contradiction, surprising implication, useful discovery or real observation.
6. A weak topic is better rejected than inflated into a fake deep post.
7. Search multiple sources before selecting.

RECENT POST BODIES:
${compact(recentBodies.join("\n---\n"))}

RECENT TOPIC MEMORY:
${compact(JSON.stringify(recentTopics))}

STYLE RULES:
${compact(JSON.stringify(styleRules))}

Return JSON:
{
  "topic": "...",
  "angle": "the original angle, not a summary of a source",
  "why_now": "...",
  "novelty_score": 0-10,
  "alisher_fit_score": 0-10,
  "value_score": 0-10,
  "source_quality_score": 0-10,
  "urgency": "evergreen|timely|breaking",
  "evidence": [{"url":"...","title":"...","source_type":"...","credibility_score":0-10,"notes":"..."}]
}

Only select a topic if the combined quality is genuinely high. Otherwise return {"reject":true}.`;

  const candidate = await geminiJson<TopicCandidate & { reject?: boolean }>(env, prompt, true);
  if (candidate.reject) return null;

  const score = (
    candidate.novelty_score * 0.28 +
    candidate.alisher_fit_score * 0.30 +
    candidate.value_score * 0.27 +
    candidate.source_quality_score * 0.15
  ) * 10;

  if (score < 72) return null;
  await insertTopic(env, { ...candidate, score, evidence: candidate.evidence ?? [] });
  return candidate;
}

export async function writeDraft(env: Env, topic: TopicCandidate): Promise<DraftPost> {
  const recentBodies = await getRecentBodies(env, 40);
  const prompt = `${ALISHER_STYLE_DNA}

You are Alisher's ghostwriter. Write one original Telegram blog post from the editorial brief below.

EDITORIAL BRIEF:
${JSON.stringify(topic)}

PREVIOUS POSTS TO AVOID REPEATING:
${compact(recentBodies.join("\n---\n"), 12000)}

Rules:
- Do not mention that you are an AI.
- Do not cite or reproduce source wording.
- The sources are factual evidence only.
- Do not turn a simple fact into fake wisdom.
- Write at the level of someone who already knows the basics.
- Make the author's own interpretation the center of gravity.
- Use concrete details where useful.
- No hashtags, rubric label or decorative emoji.
- No unnecessary em dashes.
- Keep natural paragraph breaks.
- Do not automatically add a question at the end.
- Do not automatically add a moral.

Return JSON with title, angle, body, urgency, proposed_time, reasoning.
The proposed_time must be an ISO timestamp in Asia/Tashkent and should be a natural publishing time, not a fixed recurring slot.`;

  return geminiJson<DraftPost>(env, prompt, false);
}

export async function qualityCheck(env: Env, draft: DraftPost): Promise<QAResult> {
  const prompt = `${ALISHER_STYLE_DNA}

You are the final editor. Be harsh.

DRAFT:
${draft.body}

ANGLE:
${draft.angle}

Check:
1. Is the idea genuinely worth a Telegram post?
2. Is it too obvious for Alisher?
3. Is the reasoning deeper than a generic AI-generated lesson?
4. Does it sound personal and human?
5. Does it use natural Uzbek syntax?
6. Is there an unnecessary comma before "va"?
7. Are there unnecessary dashes/hyphens used as English-style separators?
8. Are there generic AI transitions or motivational clichés?
9. Is there fake certainty, invented experience or unsupported claims?
10. Does it resemble a common internet post too closely?
11. Are there hashtags, rubric labels or unnecessary emojis?
12. Does the ending feel forced?

Return JSON:
{"passed":true|false,"score":0-100,"issues":[...],"strengths":[...],"revised_body":"only if a revision is clearly needed"}

Pass only at 85+. A score below 85 must be revised or rejected.`;

  return geminiJson<QAResult>(env, prompt, false);
}
