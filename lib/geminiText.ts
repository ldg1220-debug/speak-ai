import { GoogleGenAI } from "@google/genai";

export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };

// Preview/flash models occasionally return transient 503 "high demand"
// errors — retry once after a short delay before giving up.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("UNAVAILABLE") && !message.includes("503")) throw err;
    await new Promise((r) => setTimeout(r, 1000));
    return fn();
  }
}

interface GenerateJsonOptions {
  systemInstruction?: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Generates a JSON response from Gemini with the 2.5 "thinking" step disabled
 * (thinkingBudget: 0) for low latency. Returns the raw JSON text.
 */
export async function generateGeminiJson(
  ai: GoogleGenAI,
  { systemInstruction, contents, temperature, maxOutputTokens = 500 }: GenerateJsonOptions,
): Promise<string> {
  const res = await withRetry(() => ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      responseMimeType: "application/json",
      ...(temperature !== undefined ? { temperature } : {}),
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }));
  return res.text ?? "{}";
}

/** Convenience: single-turn user prompt → JSON text. */
export function userPromptContents(prompt: string): GeminiContent[] {
  return [{ role: "user", parts: [{ text: prompt }] }];
}
