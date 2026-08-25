import { describe, expect, it } from "vitest";
import { parseDraftPost, parseQAResult, parseTelegramUpdate, parseTopicCandidate } from "../src/lib/validation";

describe("runtime validation", () => {
  it("accepts a valid Telegram update", () => {
    expect(parseTelegramUpdate({ update_id: 42, message: { message_id: 1, chat: { id: 7 }, text: "/start" } })).toMatchObject({ update_id: 42 });
  });

  it("rejects a malformed Telegram update", () => {
    expect(() => parseTelegramUpdate({ update_id: "42" })).toThrow("Invalid Telegram update");
  });

  it("accepts a valid topic candidate", () => {
    expect(parseTopicCandidate({
      topic: "AI agents", angle: "Practical workflows", why_now: "Useful now",
      novelty_score: 8, alisher_fit_score: 9, value_score: 9, source_quality_score: 8,
      urgency: "timely", evidence: [],
    }).urgency).toBe("timely");
  });

  it("rejects an invalid topic candidate", () => {
    expect(() => parseTopicCandidate({ topic: "AI", urgency: "unknown" })).toThrow();
  });

  it("accepts and rejects draft payloads", () => {
    const draft = { title: "Title", angle: "Angle", body: "Body", sources: [], urgency: "evergreen", proposed_time: "2026-08-25T20:00:00+05:00", reasoning: "Reason" };
    expect(parseDraftPost(draft).title).toBe("Title");
    expect(() => parseDraftPost({ ...draft, urgency: "invalid" })).toThrow();
  });

  it("validates QA results", () => {
    expect(parseQAResult({ passed: true, score: 9, issues: [], strengths: ["clear"] }).passed).toBe(true);
    expect(() => parseQAResult({ passed: "yes", score: 9, issues: [], strengths: [] })).toThrow();
  });
});
