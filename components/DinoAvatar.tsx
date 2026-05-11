"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useCharacterStore } from "@/store/useCharacterStore";

const MODEL_PATH = "/models/Sunny.glb";

const BONE = {
  MOUTH:  "MOUTH_017",
  MOUTH2: "MOUTH.001_018",
  HEAD:   "HEAD_016",
  TAIL1:  "TAIL1_03",
  TAIL2:  "TAIL2_04",
  TAIL3:  "TAIL3_05",
} as const;

const ANIM = {
  STAND_IDLE: "META DINO|stand idle",
  SIT_IDLE:   "META DINO|sit idle",
  SAY_HI:     "META DINO|sayHi",
  JUMP:       "META DINO|jump",
  ARRIVE:     "META DINO|arrive",
} as const;

export default function DinoAvatar() {
  const groupRef = useRef<THREE.Group>(null);
  const [scene, setScene] = useState<THREE.Group | null>(null);

  const mixerRef   = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});

  const mouthBoneRef  = useRef<THREE.Object3D | null>(null);
  const mouth2BoneRef = useRef<THREE.Object3D | null>(null);
  const headBoneRef   = useRef<THREE.Object3D | null>(null);
  const tail1Ref      = useRef<THREE.Object3D | null>(null);
  const tail2Ref      = useRef<THREE.Object3D | null>(null);
  const tail3Ref      = useRef<THREE.Object3D | null>(null);

  const tRef         = useRef(0);
  const mouthOpenRef = useRef(0);
  const prevEmotion  = useRef("");

  const isSpeaking     = useCharacterStore((s) => s.isSpeaking);
  const audioVolume    = useCharacterStore((s) => s.audioVolume);
  const currentEmotion = useCharacterStore((s) => s.currentEmotion);

  // Load GLB directly — no Suspense/useGLTF
  useEffect(() => {
    let cancelled = false;
    new GLTFLoader().load(
      MODEL_PATH,
      (gltf) => {
        if (cancelled) return;

        const s = gltf.scene;
        mouthBoneRef.current  = s.getObjectByName(BONE.MOUTH)  ?? null;
        mouth2BoneRef.current = s.getObjectByName(BONE.MOUTH2) ?? null;
        headBoneRef.current   = s.getObjectByName(BONE.HEAD)   ?? null;
        tail1Ref.current      = s.getObjectByName(BONE.TAIL1)  ?? null;
        tail2Ref.current      = s.getObjectByName(BONE.TAIL2)  ?? null;
        tail3Ref.current      = s.getObjectByName(BONE.TAIL3)  ?? null;

        const mixer = new THREE.AnimationMixer(s);
        mixerRef.current = mixer;

        gltf.animations.forEach((clip) => {
          actionsRef.current[clip.name] = mixer.clipAction(clip);
        });

        const idle = actionsRef.current[ANIM.STAND_IDLE];
        if (idle) { idle.setLoop(THREE.LoopRepeat, Infinity); idle.fadeIn(0.3).play(); }

        setScene(s);
      },
      undefined,
      (err) => console.error("[DinoAvatar] load error:", err),
    );
    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, []);

  // Emotion -> animation
  useEffect(() => {
    if (currentEmotion === prevEmotion.current) return;
    const prev = prevEmotion.current;
    prevEmotion.current = currentEmotion;
    const a = actionsRef.current;

    const returnToStand = () => {
      const sit   = a[ANIM.SIT_IDLE];
      const stand = a[ANIM.STAND_IDLE];
      if (sit?.isRunning()) sit.fadeOut(0.5);
      if (stand && !stand.isRunning()) {
        stand.setLoop(THREE.LoopRepeat, Infinity);
        stand.reset().fadeIn(0.5).play();
      }
    };

    if (prev === "thinking") returnToStand();

    switch (currentEmotion) {
      case "happy": {
        const sayHi = a[ANIM.SAY_HI];
        if (sayHi) {
          sayHi.setLoop(THREE.LoopOnce, 1);
          sayHi.clampWhenFinished = false;
          sayHi.reset().fadeIn(0.25).play();
          setTimeout(() => sayHi.fadeOut(0.5), 2800);
        }
        break;
      }
      case "surprised": {
        const jump = a[ANIM.JUMP];
        if (jump) {
          jump.setLoop(THREE.LoopOnce, 1);
          jump.clampWhenFinished = false;
          jump.reset().fadeIn(0.15).play();
          setTimeout(() => jump.fadeOut(0.5), 1600);
        }
        break;
      }
      case "thinking": {
        a[ANIM.STAND_IDLE]?.fadeOut(0.5);
        const sit = a[ANIM.SIT_IDLE];
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
  }, [currentEmotion]);

  useFrame((_, delta) => {
    // 1) advance mixer — sets mouth bone to animation base (~-103° stand idle)
    mixerRef.current?.update(delta);

    // 2) additive mouth open on top of animation base (only when speaking)
    //    In this rig: more negative X = jaw further down = more open.
    //    The natural stand-idle position is ~-103°; we push further negative when speaking.
    tRef.current += delta;
    const t = tRef.current;

    const targetOpen = isSpeaking ? Math.max(audioVolume * 0.55, 0.08) : 0;
    mouthOpenRef.current = THREE.MathUtils.lerp(mouthOpenRef.current, targetOpen, Math.min(delta * 22, 1));
    const ripple = isSpeaking ? Math.abs(Math.sin(t * 4.5)) * audioVolume * 0.12 : 0;
    const extraOpen = mouthOpenRef.current + ripple; // 0 when silent, up to ~0.67 when loud

    if (mouthBoneRef.current) {
      // Subtract (go more negative) to open jaw additively on top of animation
      mouthBoneRef.current.rotation.x -= extraOpen * 0.45;
    }
    if (mouth2BoneRef.current) {
      mouth2BoneRef.current.rotation.x -= extraOpen * 0.45 * 0.6;
    }

    if (headBoneRef.current) {
      const nod  = isSpeaking ? Math.sin(t * 3.2) * 0.045 * Math.max(audioVolume, 0.3) : 0;
      const sway = Math.sin(t * 0.65) * 0.018;
      headBoneRef.current.rotation.x = THREE.MathUtils.lerp(headBoneRef.current.rotation.x, nod,  0.09);
      headBoneRef.current.rotation.y = THREE.MathUtils.lerp(headBoneRef.current.rotation.y, sway, 0.035);
    }

    const wagSpeed = isSpeaking ? 2.8 : 1.4;
    const wagAmp   = isSpeaking ? 0.28 : 0.14;
    if (tail1Ref.current) tail1Ref.current.rotation.z = Math.sin(t * wagSpeed)        * wagAmp;
    if (tail2Ref.current) tail2Ref.current.rotation.z = Math.sin(t * wagSpeed + 0.45) * wagAmp * 1.35;
    if (tail3Ref.current) tail3Ref.current.rotation.z = Math.sin(t * wagSpeed + 0.9)  * wagAmp * 1.7;
  });

  if (!scene) return null;

  return (
    <group ref={groupRef} position={[0, -1.3, 0]} scale={0.62}>
      <primitive object={scene} />
    </group>
  );
}
