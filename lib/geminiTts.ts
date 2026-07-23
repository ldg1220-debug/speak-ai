import { GoogleGenAI } from "@google/genai";
import type { GeminiVoice } from "@/lib/personas";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_SAMPLE_RATE = 24000;

// Preview models occasionally return transient 503 "high demand" errors —
// retry once after a short delay before giving up.
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

// Gemini TTS returns raw 16-bit PCM with no header — wrap it as WAV so
// the browser's decodeAudioData() can play it.
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesizeGeminiSpeech(
  ai: GoogleGenAI,
  text: string,
  voiceName: GeminiVoice,
): Promise<string> {
  const tts = await withRetry(() => ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  }));
  const pcmBase64 = tts.data;
  if (!pcmBase64) throw new Error("No audio returned from TTS.");
  const wav = pcmToWav(Buffer.from(pcmBase64, "base64"), TTS_SAMPLE_RATE);
  return wav.toString("base64");
}
