import type { Env } from "../types";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  error?: { message?: string };
}

export async function geminiText(env: Env, prompt: string, useSearch = false): Promise<{ text: string; grounding: unknown }> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.55 },
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${payload.error?.message ?? "unknown error"}`);
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return { text, grounding: candidate?.groundingMetadata ?? {} };
}

export async function geminiJson<T>(
  env: Env,
  prompt: string,
  useSearch = false,
  validate?: (value: unknown) => T,
): Promise<T> {
  const result = await geminiText(env, `${prompt}\n\nReturn ONLY valid JSON. No markdown fences.`, useSearch);
  const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Gemini returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return validate ? validate(parsed) : (parsed as T);
}
