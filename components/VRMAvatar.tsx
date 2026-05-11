"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import * as THREE from "three";
import { useCharacterStore } from "@/store/useCharacterStore";

// ─── Loading hook (no Suspense — avoids ErrorBoundary issues) ─────────────────

function useVRM(url: string) {
  const [vrm, setVrm]   = useState<VRM | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setVrm(null);
    setError(false);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        const v = gltf.userData.vrm as VRM;
        // VRM 0.x needs 180° rotation to face camera
        if ((v.meta as { metaVersion?: string }).metaVersion === "0") {
          VRMUtils.rotateVRM0(v);
        }
        VRMUtils.removeUnnecessaryJoints(v.scene);
        setVrm(v);
      },
      undefined,
      () => setError(true),
    );
  }, [url]);

  return { vrm, error };
}

// ─── Animated VRM character ───────────────────────────────────────────────────

function VRMModel({ url }: { url: string }) {
  const { vrm, error } = useVRM(url);

  const audioVolume    = useCharacterStore((s) => s.audioVolume);
  const isSpeaking     = useCharacterStore((s) => s.isSpeaking);
  const currentEmotion = useCharacterStore((s) => s.currentEmotion);

  const tRef       = useRef(0);
  const blinkTimer = useRef(Math.random() * 4);
  const lipSmooth  = useRef(0);

  useFrame((_, delta) => {
    if (!vrm) return;

    tRef.current      += delta;
    blinkTimer.current += delta;
    const t = tRef.current;

    // Spring bones (hair physics etc.)
    vrm.update(delta);

    // ── Lip sync ──────────────────────────────────────────────────────────────
    const targetLip = isSpeaking ? audioVolume * 0.85 : 0;
    lipSmooth.current = THREE.MathUtils.lerp(lipSmooth.current, targetLip, 0.22);
    // Alternate between vowel shapes for natural speech
    const phase = (t * 6) % (Math.PI * 2);
    vrm.expressionManager?.setValue("aa", lipSmooth.current * (0.6 + 0.4 * Math.abs(Math.sin(phase))));
    vrm.expressionManager?.setValue("oh", lipSmooth.current * 0.25 * Math.abs(Math.cos(phase)));
    vrm.expressionManager?.setValue("ih", lipSmooth.current * 0.15 * Math.abs(Math.sin(phase * 1.3)));

    // ── Eye blink ─────────────────────────────────────────────────────────────
    const bp = blinkTimer.current % 4;
    const blinkVal = bp < 0.08 ? bp / 0.08 : bp < 0.16 ? (0.16 - bp) / 0.08 : 0;
    vrm.expressionManager?.setValue("blinkLeft",  blinkVal);
    vrm.expressionManager?.setValue("blinkRight", blinkVal);

    // ── Emotions ──────────────────────────────────────────────────────────────
    vrm.expressionManager?.setValue("happy",     currentEmotion === "happy"     ? 0.65 : 0);
    vrm.expressionManager?.setValue("sad",       currentEmotion === "sad"       ? 0.55 : 0);
    vrm.expressionManager?.setValue("surprised", currentEmotion === "surprised" ? 0.75 : 0);

    // ── Head movement ─────────────────────────────────────────────────────────
    const headBone = vrm.humanoid?.getNormalizedBoneNode("head");
    if (headBone) {
      const nod  = isSpeaking ? Math.sin(t * 3.2) * 0.04 : 0;
      const sway = Math.sin(t * 0.7) * 0.012;
      headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, nod, 0.08);
      headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, sway, 0.05);
    }
  });

  if (error)  return null; // on load failure → nothing (procedural char shows through)
  if (!vrm)   return null; // still loading → nothing

  return <primitive object={vrm.scene} position={[0, -0.9, 0]} />;
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function VRMAvatar({ url }: { url: string }) {
  return <VRMModel url={url} />;
}
