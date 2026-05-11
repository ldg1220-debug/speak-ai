import { useRef, useCallback } from "react";
import { useCharacterStore } from "@/store/useCharacterStore";
import { lipState, ARKIT_LIP } from "@/lib/visemeState";

export function useAudioAnalyzer() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<AudioBufferSourceNode | null>(null);
  const animRef     = useRef<number>(0);
  const amplitudeRef = useRef(0);

  const setAudioVolume = useCharacterStore((s) => s.setAudioVolume);
  const setIsSpeaking  = useCharacterStore((s) => s.setIsSpeaking);

  const stopCurrent = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    amplitudeRef.current = 0;
    setAudioVolume(0);
    setIsSpeaking(false);
    lipState.speaking = false;
    for (const k of ARKIT_LIP) lipState.target[k] = 0;
  }, [setAudioVolume, setIsSpeaking]);

  const playAudio = useCallback(async (audioBuffer: ArrayBuffer) => {
    stopCurrent();

    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    const decoded = await ctx.decodeAudioData(audioBuffer.slice(0));
    const source  = ctx.createBufferSource();
    source.buffer = decoded;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const vol = data.reduce((a, b) => a + b, 0) / data.length / 128;
      amplitudeRef.current = Math.min(vol * 2.5, 1);
      setAudioVolume(amplitudeRef.current);
      // Drive ARKit lip sync for GLB avatars
      lipState.speaking = true;
      lipState.target.jawOpen     = amplitudeRef.current * 0.65;
      lipState.target.mouthFunnel = amplitudeRef.current * 0.18;
      animRef.current = requestAnimationFrame(tick);
    };

    setIsSpeaking(true);
    source.start();
    tick();

    source.onended = () => {
      cancelAnimationFrame(animRef.current);
      amplitudeRef.current = 0;
      setAudioVolume(0);
      setIsSpeaking(false);
      lipState.speaking = false;
      for (const k of ARKIT_LIP) lipState.target[k] = 0;
    };
  }, [stopCurrent, setAudioVolume, setIsSpeaking]);

  return { playAudio, stopCurrent, amplitudeRef };
}
