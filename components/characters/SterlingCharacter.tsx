"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Emotion } from "@/store/useCharacterStore";
import { ANIM_CONFIG } from "@/lib/personas";

interface Props { audioVolume: number; isSpeaking: boolean; emotion: Emotion }

export default function SterlingCharacter({ audioVolume, isSpeaking }: Props) {
  const cfg = ANIM_CONFIG.sterling;
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const mouthInteriorRef = useRef<THREE.Mesh>(null);
  const lidLeftRef = useRef<THREE.Mesh>(null);
  const lidRightRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const jaw = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const ti = t.current;
    const targetJaw = isSpeaking ? Math.min(audioVolume * 0.55, 0.55) : 0;
    jaw.current = THREE.MathUtils.lerp(jaw.current, targetJaw, 0.18);
    if (mouthInteriorRef.current) {
      mouthInteriorRef.current.scale.y = jaw.current * 3.5 + 0.001;
      mouthInteriorRef.current.visible = jaw.current > 0.03;
    }
    const blinkPhase = ti % cfg.blinkInterval;
    const blinkVal = blinkPhase < 0.07 ? blinkPhase / 0.07 : blinkPhase < 0.14 ? (0.14 - blinkPhase) / 0.07 : 0;
    if (lidLeftRef.current) lidLeftRef.current.scale.y = blinkVal + 0.001;
    if (lidRightRef.current) lidRightRef.current.scale.y = blinkVal + 0.001;
    if (rootRef.current) rootRef.current.position.y = Math.sin(ti * cfg.idleSpeed) * cfg.idleAmp;
    if (headRef.current) {
      const nodTarget = isSpeaking ? Math.sin(ti * cfg.nodSpeed) * 0.025 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, nodTarget, 0.06);
    }
    if (rightArmRef.current) {
      const gestureTarget = isSpeaking ? -0.45 + Math.sin(ti * cfg.nodSpeed * 0.5) * 0.06 : 0;
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, gestureTarget, 0.06);
    }
  });

  const slate = "#94A3B8"; const darkSlate = "#475569"; const lighterSlate = "#CBD5E1";
  const gold = "#F59E0B"; const white = "#FFFFFF"; const dark = "#0F172A";
  const nearBlack = "#0a0a0f"; const suit = "#1E293B";

  return (
    <group ref={rootRef} position={[0, -0.5, 0]}>
      <group position={[0, 0, 0]}>
        <mesh scale={[1.02, 1.08, 0.88]}><sphereGeometry args={[0.42, 32, 32]} /><meshStandardMaterial color={suit} roughness={0.7} /></mesh>
        <mesh position={[0, 0.06, 0.33]} scale={[0.7, 0.9, 0.3]}><sphereGeometry args={[0.22, 20, 20]} /><meshStandardMaterial color={white} roughness={0.9} /></mesh>
        <group position={[0, -0.02, 0.37]}>
          <mesh scale={[1, 1.6, 0.15]}><boxGeometry args={[0.06, 0.22, 0.04]} /><meshStandardMaterial color={gold} roughness={0.4} metalness={0.1} /></mesh>
          <mesh position={[0, -0.2, 0]} scale={[1.4, 1, 1]}><boxGeometry args={[0.06, 0.06, 0.04]} /><meshStandardMaterial color={gold} roughness={0.4} metalness={0.1} /></mesh>
        </group>
        <mesh position={[0.08, 0.18, 0.33]} rotation={[0, -0.3, 0.4]}><boxGeometry args={[0.08, 0.2, 0.02]} /><meshStandardMaterial color={suit} roughness={0.7} /></mesh>
        <mesh position={[-0.08, 0.18, 0.33]} rotation={[0, 0.3, -0.4]}><boxGeometry args={[0.08, 0.2, 0.02]} /><meshStandardMaterial color={suit} roughness={0.7} /></mesh>
        <group position={[0.4, 0.04, 0.02]}>
          <mesh rotation={[0.05, 0, 0.15]}><capsuleGeometry args={[0.062, 0.26, 8, 16]} /><meshStandardMaterial color={suit} roughness={0.7} /></mesh>
        </group>
        <group ref={rightArmRef} position={[-0.4, 0.04, 0.02]}>
          <mesh rotation={[0.05, 0, -0.15]}><capsuleGeometry args={[0.062, 0.26, 8, 16]} /><meshStandardMaterial color={suit} roughness={0.7} /></mesh>
          <mesh position={[-0.04, -0.26, 0]}><boxGeometry args={[0.1, 0.04, 0.1]} /><meshStandardMaterial color={white} roughness={0.8} /></mesh>
        </group>
      </group>
      <group ref={headRef} position={[0, 0.65, 0]}>
        <mesh scale={[1.08, 1.0, 0.95]}><sphereGeometry args={[0.37, 32, 32]} /><meshStandardMaterial color={slate} roughness={0.6} /></mesh>
        <mesh position={[0, 0.27, -0.1]} scale={[1.05, 0.38, 1]}><sphereGeometry args={[0.37, 24, 12]} /><meshStandardMaterial color={dark} roughness={0.4} /></mesh>
        <mesh position={[0.04, 0.35, 0.14]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.01, 0.02, 0.2]} /><meshStandardMaterial color={lighterSlate} /></mesh>
        <group position={[0, -0.17, 0.34]}>
          <mesh><boxGeometry args={[0.16, 0.022, 0.01]} /><meshStandardMaterial color={darkSlate} /></mesh>
          <mesh position={[0.08, -0.01, 0]} rotation={[0, 0, -0.2]}><boxGeometry args={[0.04, 0.015, 0.01]} /><meshStandardMaterial color={darkSlate} /></mesh>
          <mesh position={[-0.08, -0.01, 0]} rotation={[0, 0, 0.2]}><boxGeometry args={[0.04, 0.015, 0.01]} /><meshStandardMaterial color={darkSlate} /></mesh>
          <mesh ref={mouthInteriorRef} position={[0, -0.028, 0]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.07, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
            <meshStandardMaterial color="#1a1a1a" side={THREE.FrontSide} />
          </mesh>
        </group>
        <group position={[0.15, 0.08, 0.31]}>
          <mesh><sphereGeometry args={[0.1, 20, 20]} /><meshStandardMaterial color={white} roughness={0.1} /></mesh>
          <mesh position={[0.01, 0, 0.072]}><sphereGeometry args={[0.06, 16, 16]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh position={[0.014, 0, 0.098]}><sphereGeometry args={[0.032, 12, 12]} /><meshStandardMaterial color={nearBlack} /></mesh>
          <mesh position={[0.028, 0.026, 0.108]}><sphereGeometry args={[0.012, 8, 8]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={0.6} /></mesh>
          <mesh position={[-0.01, 0.12, 0.07]} rotation={[0, 0, -0.35]}><boxGeometry args={[0.13, 0.035, 0.02]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh ref={lidLeftRef} position={[0, 0.05, 0.05]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]} /><meshStandardMaterial color={slate} /></mesh>
        </group>
        <group position={[-0.15, 0.08, 0.31]}>
          <mesh><sphereGeometry args={[0.1, 20, 20]} /><meshStandardMaterial color={white} roughness={0.1} /></mesh>
          <mesh position={[-0.01, 0, 0.072]}><sphereGeometry args={[0.06, 16, 16]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh position={[-0.014, 0, 0.098]}><sphereGeometry args={[0.032, 12, 12]} /><meshStandardMaterial color={nearBlack} /></mesh>
          <mesh position={[-0.028, 0.026, 0.108]}><sphereGeometry args={[0.012, 8, 8]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={0.6} /></mesh>
          <mesh position={[0.01, 0.12, 0.07]} rotation={[0, 0, 0.35]}><boxGeometry args={[0.13, 0.035, 0.02]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh ref={lidRightRef} position={[0, 0.05, 0.05]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]} /><meshStandardMaterial color={slate} /></mesh>
        </group>
      </group>
    </group>
  );
}
