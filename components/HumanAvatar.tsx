"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useCharacterStore } from "@/store/useCharacterStore";
import { PERSONAS } from "@/lib/personas";
import { ARKIT_LIP, LEGACY_VISEMES, lipState, legacyLipState } from "@/lib/visemeState";

// ─── Placeholder shown while loading ─────────────────────────────────────────

export function AvatarPlaceholder() {
  const tRef    = useRef(0);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    tRef.current += delta;
    if (meshRef.current) {
      meshRef.current.rotation.y = tRef.current * 0.5;
      meshRef.current.position.y = Math.sin(tRef.current * 1.2) * 0.06;
    }
  });
  return (
    <mesh ref={meshRef}>
      <torusKnotGeometry args={[0.28, 0.09, 80, 16]} />
      <meshStandardMaterial color="#4f46e5" roughness={0.3} metalness={0.4} />
    </mesh>
  );
}

// ─── Per-model position / scale / material overrides ─────────────────────────

const AVATAR_CONFIG: Record<string, {
  position: [number, number, number];
  scale: number;
  rotation?: [number, number, number];
  poseArmsDown?: boolean;
  armDownX?: number;
  whiteMeshNames?: string[];
}> = {
  '/models/Aria.glb':        { position: [0, -2.6, 0],          scale: 0.022, poseArmsDown: true, armDownX: 1.3  },
  '/models/Kai.glb':         { position: [-0.3, -4.0, -0.7],  scale: 3.5 },
  '/models/Mr.Sterling.glb': { position: [0, -2.6, 0],          scale: 0.022, poseArmsDown: true, armDownX: 1.0  },
};

const WHITE_SHIRT = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0xf5f5f5),
  roughness: 0.85,
  metalness: 0.0,
});

// ─── GLB avatar — supports both morph-target and bone-based rigs ──────────────

function GlbAvatar({ url }: { url: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, groupRef);
  const cfg = AVATAR_CONFIG[url] ?? { position: [0, -1.55, 0] as [number, number, number], scale: 1 };

  const isSpeaking     = useCharacterStore((s) => s.isSpeaking);
  const audioVolume    = useCharacterStore((s) => s.audioVolume);
  const currentEmotion = useCharacterStore((s) => s.currentEmotion);

  // ── Morph-target state ────────────────────────────────────────────────────
  const meshesRef  = useRef<THREE.Mesh[]>([]);
  const blinkTimer = useRef(0);
  const tRef       = useRef(0);
  const modeRef    = useRef<"arkit" | "viseme" | "bone">("bone");

  // ── Bone refs (for rigs without morph targets, e.g. Sunny/Dino) ──────────
  const mouthBoneRef  = useRef<THREE.Object3D | null>(null);
  const mouth2BoneRef = useRef<THREE.Object3D | null>(null);
  const headBoneRef   = useRef<THREE.Object3D | null>(null);
  const tail1Ref      = useRef<THREE.Object3D | null>(null);
  const tail2Ref      = useRef<THREE.Object3D | null>(null);
  const tail3Ref      = useRef<THREE.Object3D | null>(null);
  const mouthOpenRef  = useRef(0);

  // ── Emotion tracking ──────────────────────────────────────────────────────
  const prevEmotionRef = useRef(currentEmotion);

  useEffect(() => {
    // Apply white shirt material to designated meshes (e.g. Aria's torso)
    if (cfg.whiteMeshNames?.length) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const matches = cfg.whiteMeshNames!.some((n) => child.name.includes(n));
          if (matches) child.material = WHITE_SHIRT;
        }
      });
    }

    // Collect morph-target meshes
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
        meshes.push(child);
      }
    });
    meshesRef.current = meshes;

    // Auto-detect rig type
    const dict = meshes[0]?.morphTargetDictionary ?? {};
    if ("jawOpen" in dict) {
      modeRef.current = "arkit";
    } else if ("viseme_aa" in dict || "viseme_O" in dict) {
      modeRef.current = "viseme";
    } else {
      modeRef.current = "bone";
      // Find bones for bone-based rigs
      mouthBoneRef.current  = scene.getObjectByName("MOUTH_017")   ?? null;
      mouth2BoneRef.current = scene.getObjectByName("MOUTH.001_018") ?? null;
      headBoneRef.current   = scene.getObjectByName("HEAD_016")    ?? null;
      tail1Ref.current      = scene.getObjectByName("TAIL1_03")    ?? null;
      tail2Ref.current      = scene.getObjectByName("TAIL2_04")    ?? null;
      tail3Ref.current      = scene.getObjectByName("TAIL3_05")    ?? null;
    }

    // Pose arms down from T-pose (Sketchfab Wolf3D humanoid rig)
    // LeftArm local Z → world +Y (up), local X → world +Z (camera depth).
    // Rotating around local X by -PI/2 swings arm from world +X to world -Y (down).
    if (cfg.poseArmsDown) {
      const leftArm  = scene.getObjectByName("LeftArm_011");
      const rightArm = scene.getObjectByName("RightArm_035");
      const ax = cfg.armDownX ?? 1.3;
      if (leftArm)  leftArm.rotation.x  = ax;
      if (rightArm) rightArm.rotation.x  = ax;
    }
  }, [scene]);

  // ── Keyframe animations (bone rigs only) ─────────────────────────────────
  useEffect(() => {
    if (modeRef.current !== "bone") return;

    Object.values(actions).forEach((a) => a?.stop());

    const idle = actions["META DINO|stand idle"];
    if (idle) {
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.fadeIn(0.3).play();
    }
    // Entrance animation
    const arrive = actions["META DINO|arrive"];
    if (arrive) {
      arrive.setLoop(THREE.LoopOnce, 1);
      arrive.clampWhenFinished = false;
      arrive.reset().fadeIn(0.1).play();
      setTimeout(() => arrive.fadeOut(0.6), 2000);
    }
  }, [actions]);

  // ── Emotion → animation (bone rigs) ──────────────────────────────────────
  useEffect(() => {
    if (modeRef.current !== "bone") return;
    if (currentEmotion === prevEmotionRef.current) return;
    const prev = prevEmotionRef.current;
    prevEmotionRef.current = currentEmotion;

    const returnToStand = () => {
      actions["META DINO|sit idle"]?.fadeOut(0.5);
      const stand = actions["META DINO|stand idle"];
      if (stand && !stand.isRunning()) {
        stand.setLoop(THREE.LoopRepeat, Infinity);
        stand.reset().fadeIn(0.5).play();
      }
    };

    if (prev === "thinking") returnToStand();

    switch (currentEmotion) {
      case "happy": {
        const a = actions["META DINO|sayHi"];
        if (a) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = false;
          a.reset().fadeIn(0.25).play();
          setTimeout(() => a.fadeOut(0.5), 2800);
        }
        break;
      }
      case "surprised": {
        const a = actions["META DINO|jump"];
        if (a) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = false;
          a.reset().fadeIn(0.15).play();
          setTimeout(() => a.fadeOut(0.5), 1600);
        }
        break;
      }
      case "thinking": {
        actions["META DINO|stand idle"]?.fadeOut(0.5);
        const sit = actions["META DINO|sit idle"];
        if (sit) {
          sit.setLoop(THREE.LoopRepeat, Infinity);
          sit.reset().fadeIn(0.5).play();
        }
        break;
      }
      case "neutral":
        returnToStand();
        break;
    }
  }, [currentEmotion, actions]);

  // ── Morph-target helper ───────────────────────────────────────────────────
  const setMorph = (name: string, value: number) => {
    for (const mesh of meshesRef.current) {
      const idx = mesh.morphTargetDictionary?.[name];
      if (idx !== undefined && mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(value, 0, 1);
      }
    }
  };

  // ── Per-frame animation ───────────────────────────────────────────────────
  // Morph-target animations run at default priority 0.
  // Bone overrides run at priority 1 (after mixer update).
  useFrame((_, delta) => {
    tRef.current       += delta;
    blinkTimer.current += delta;
    const t = tRef.current;
    const lerpSpeed = Math.min(delta * 18, 1);

    // ── ARKit morph-target lip sync ────────────────────────────────────────
    if (modeRef.current === "arkit") {
      for (const k of ARKIT_LIP) {
        lipState.current[k] = THREE.MathUtils.lerp(lipState.current[k] ?? 0, lipState.target[k] ?? 0, lerpSpeed);
        setMorph(k, lipState.current[k]);
      }
    }

    // ── Oculus Viseme lip sync ─────────────────────────────────────────────
    if (modeRef.current === "viseme") {
      for (const k of LEGACY_VISEMES) {
        legacyLipState.current[k] = THREE.MathUtils.lerp(legacyLipState.current[k] ?? 0, legacyLipState.target[k] ?? 0, lerpSpeed);
        setMorph(k, legacyLipState.current[k]);
      }
    }

    // ── Morph-target emotions & blink (ARKit / Viseme only) ───────────────
    if (modeRef.current !== "bone") {
      const bp = blinkTimer.current % 4;
      const blinkVal = bp < 0.08 ? bp / 0.08 : bp < 0.16 ? (0.16 - bp) / 0.08 : 0;
      setMorph("eyeBlinkLeft",  blinkVal);
      setMorph("eyeBlinkRight", blinkVal);

      setMorph("mouthSmileLeft",   currentEmotion === "happy"     ? 0.7 : 0);
      setMorph("mouthSmileRight",  currentEmotion === "happy"     ? 0.7 : 0);
      setMorph("browOuterUpLeft",  currentEmotion === "surprised" ? 0.8 : 0);
      setMorph("browOuterUpRight", currentEmotion === "surprised" ? 0.8 : 0);
      setMorph("browInnerUp",      currentEmotion === "surprised" ? 0.48 : 0);
      setMorph("browDownLeft",     currentEmotion === "thinking"  ? 0.5 : 0);
      setMorph("browDownRight",    currentEmotion === "thinking"  ? 0.5 : 0);
      setMorph("eyeSquintLeft",    currentEmotion === "thinking"  ? 0.2 : 0);
      setMorph("eyeSquintRight",   currentEmotion === "thinking"  ? 0.2 : 0);
    }

    // ── Group-level head nod (morph-target rigs) ───────────────────────────
    if (modeRef.current !== "bone" && groupRef.current) {
      const nod  = isSpeaking ? Math.sin(t * 3.2) * 0.04 : 0;
      const sway = Math.sin(t * 0.7) * 0.01;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, nod, 0.08);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, sway, 0.04);
    }
  });

  // Bone procedural animation runs AFTER the animation mixer (priority 1)
  useFrame((_, delta) => {
    if (modeRef.current !== "bone") return;
    const t = tRef.current;

    // ── MOUTH bone → lip sync ──────────────────────────────────────────────
    const targetOpen = isSpeaking ? Math.max(audioVolume * 0.55, 0.08) : 0;
    mouthOpenRef.current = THREE.MathUtils.lerp(
      mouthOpenRef.current,
      targetOpen,
      Math.min(delta * 22, 1),
    );
    const ripple = isSpeaking ? Math.abs(Math.sin(t * 4.5)) * audioVolume * 0.12 : 0;
    const finalOpen = mouthOpenRef.current + ripple;

    if (mouthBoneRef.current)  mouthBoneRef.current.rotation.x  = finalOpen;
    if (mouth2BoneRef.current) mouth2BoneRef.current.rotation.x = finalOpen * 0.6;

    // ── HEAD bone → nod when speaking ─────────────────────────────────────
    if (headBoneRef.current) {
      const nod  = isSpeaking ? Math.sin(t * 3.2) * 0.045 * Math.max(audioVolume, 0.3) : 0;
      const sway = Math.sin(t * 0.65) * 0.018;
      headBoneRef.current.rotation.x = THREE.MathUtils.lerp(headBoneRef.current.rotation.x, nod, 0.09);
      headBoneRef.current.rotation.y = THREE.MathUtils.lerp(headBoneRef.current.rotation.y, sway, 0.035);
    }

    // ── TAIL bones → wag ──────────────────────────────────────────────────
    const wagSpeed = isSpeaking ? 2.8 : 1.4;
    const wagAmp   = isSpeaking ? 0.28 : 0.14;
    if (tail1Ref.current) tail1Ref.current.rotation.z = Math.sin(t * wagSpeed)         * wagAmp;
    if (tail2Ref.current) tail2Ref.current.rotation.z = Math.sin(t * wagSpeed + 0.45)  * wagAmp * 1.35;
    if (tail3Ref.current) tail3Ref.current.rotation.z = Math.sin(t * wagSpeed + 0.9)   * wagAmp * 1.7;
  }, 1);

  return (
    <group ref={groupRef} position={cfg.position} scale={cfg.scale} rotation={cfg.rotation ?? [0, 0, 0]}>
      <primitive object={scene} />
    </group>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function HumanAvatar() {
  const personaId = useCharacterStore((s) => s.personaId);
  const persona   = PERSONAS[personaId];
  const avatarUrl = persona.avatarUrl;

  if (!avatarUrl) return <AvatarPlaceholder />;
  return <GlbAvatar url={avatarUrl} />;
}
