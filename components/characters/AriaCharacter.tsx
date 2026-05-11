"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Emotion } from "@/store/useCharacterStore";
import { ANIM_CONFIG } from "@/lib/personas";

interface Props { audioVolume: number; isSpeaking: boolean; emotion: Emotion }

export default function AriaCharacter({ audioVolume, isSpeaking }: Props) {
  const cfg = ANIM_CONFIG.aria;
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const mouthInteriorRef = useRef<THREE.Mesh>(null);
  const lidLeftRef = useRef<THREE.Mesh>(null);
  const lidRightRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const jaw = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const ti = t.current;
    const targetJaw = isSpeaking ? Math.min(audioVolume * 0.7, 0.7) : 0;
    jaw.current = THREE.MathUtils.lerp(jaw.current, targetJaw, 0.2);
    if (mouthInteriorRef.current) {
      mouthInteriorRef.current.scale.y = jaw.current * 4 + 0.001;
      mouthInteriorRef.current.visible = jaw.current > 0.025;
    }
    const blinkPhase = ti % cfg.blinkInterval;
    const blinkVal = blinkPhase < 0.08 ? blinkPhase / 0.08 : blinkPhase < 0.16 ? (0.16 - blinkPhase) / 0.08 : 0;
    if (lidLeftRef.current) lidLeftRef.current.scale.y = blinkVal + 0.001;
    if (lidRightRef.current) lidRightRef.current.scale.y = blinkVal + 0.001;
    if (rootRef.current) rootRef.current.position.y = Math.sin(ti * cfg.idleSpeed) * cfg.idleAmp;
    if (headRef.current) {
      const nodTarget = isSpeaking ? Math.sin(ti * cfg.nodSpeed) * 0.04 : 0;
      const tiltTarget = isSpeaking ? 0.06 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, tiltTarget + nodTarget, 0.05)
        + Math.sin(ti * cfg.idleSpeed * 0.7) * cfg.swayAmp;
    }
    if (leftArmRef.current) {
      const raiseTarget = isSpeaking ? -0.7 + Math.sin(ti * cfg.nodSpeed * 0.6) * 0.12 : 0;
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, raiseTarget, 0.08);
    }
  });

  const purple = "#C084FC"; const deepPurple = "#7C3AED"; const lightPurple = "#DDA9FF";
  const pink = "#EC4899"; const rosy = "#F0ABFC"; const white = "#FFFFFF";
  const dark = "#1a1a1a"; const skin = "#FDDDE6";

  return (
    <group ref={rootRef} position={[0, -0.5, 0]}>
      <group position={[0, 0, 0]}>
        <mesh scale={[0.88, 1.1, 0.82]}><sphereGeometry args={[0.38, 32, 32]} /><meshStandardMaterial color={purple} roughness={0.7} /></mesh>
        <mesh position={[0, 0.06, 0.27]} scale={[0.9, 0.9, 0.5]}><sphereGeometry args={[0.18, 20, 20]} /><meshStandardMaterial color={lightPurple} roughness={0.8} transparent opacity={0.5} /></mesh>
        <group ref={leftArmRef} position={[0.34, 0.16, 0.05]}>
          <mesh rotation={[0.1, 0, 0.3]}><capsuleGeometry args={[0.055, 0.22, 8, 16]} /><meshStandardMaterial color={purple} roughness={0.7} /></mesh>
          <mesh position={[0.06, -0.22, 0.02]}><sphereGeometry args={[0.065, 16, 16]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
        </group>
        <group position={[-0.34, 0.16, 0.05]}>
          <mesh rotation={[0.1, 0, -0.3]}><capsuleGeometry args={[0.055, 0.22, 8, 16]} /><meshStandardMaterial color={purple} roughness={0.7} /></mesh>
          <mesh position={[-0.06, -0.22, 0.02]}><sphereGeometry args={[0.065, 16, 16]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
        </group>
      </group>
      <group ref={headRef} position={[0, 0.62, 0]}>
        <mesh scale={[1, 1.05, 0.95]}><sphereGeometry args={[0.37, 32, 32]} /><meshStandardMaterial color={purple} roughness={0.7} /></mesh>
        <mesh position={[0, 0.35, -0.06]}><sphereGeometry args={[0.18, 20, 20]} /><meshStandardMaterial color={deepPurple} roughness={0.6} /></mesh>
        <mesh position={[0.28, 0.15, -0.15]} rotation={[0.2, 0.3, 0.5]} scale={[0.7, 1, 0.7]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color={deepPurple} roughness={0.6} /></mesh>
        <mesh position={[-0.28, 0.15, -0.15]} rotation={[0.2, -0.3, -0.5]} scale={[0.7, 1, 0.7]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color={deepPurple} roughness={0.6} /></mesh>
        <group position={[0.2, 0.38, -0.04]}>
          <mesh rotation={[0, 0, 0.5]}><boxGeometry args={[0.1, 0.06, 0.04]} /><meshStandardMaterial color={pink} roughness={0.5} /></mesh>
          <mesh rotation={[0, 0, -0.5]}><boxGeometry args={[0.1, 0.06, 0.04]} /><meshStandardMaterial color={pink} roughness={0.5} /></mesh>
          <mesh><sphereGeometry args={[0.03, 10, 10]} /><meshStandardMaterial color={pink} roughness={0.5} /></mesh>
        </group>
        <group position={[0, -0.16, 0.34]}>
          <mesh><boxGeometry args={[0.14, 0.025, 0.01]} /><meshStandardMaterial color={pink} /></mesh>
          <mesh position={[0, 0.015, 0]}><boxGeometry args={[0.06, 0.02, 0.01]} /><meshStandardMaterial color={pink} /></mesh>
          <mesh ref={mouthInteriorRef} position={[0, -0.035, 0]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.07, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
            <meshStandardMaterial color="#6B0030" side={THREE.FrontSide} />
          </mesh>
        </group>
        <group position={[0.16, 0.1, 0.3]}>
          <mesh scale={[1.1, 1.2, 1]}><sphereGeometry args={[0.11, 20, 20]} /><meshStandardMaterial color={white} roughness={0.1} /></mesh>
          <mesh position={[0.015, 0, 0.085]}><sphereGeometry args={[0.065, 16, 16]} /><meshStandardMaterial color={deepPurple} /></mesh>
          <mesh position={[0.018, 0, 0.112]}><sphereGeometry args={[0.035, 12, 12]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh position={[0.04, 0.03, 0.122]}><sphereGeometry args={[0.016, 8, 8]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={1} /></mesh>
          {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
            <mesh key={i} position={[x, 0.1, 0.06]} rotation={[0, 0, x * 0.8]}><boxGeometry args={[0.012, 0.04, 0.01]} /><meshStandardMaterial color={dark} /></mesh>
          ))}
          <mesh ref={lidLeftRef} position={[0, 0.055, 0.055]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.115, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} /><meshStandardMaterial color={purple} /></mesh>
        </group>
        <group position={[-0.16, 0.1, 0.3]}>
          <mesh scale={[1.1, 1.2, 1]}><sphereGeometry args={[0.11, 20, 20]} /><meshStandardMaterial color={white} roughness={0.1} /></mesh>
          <mesh position={[-0.015, 0, 0.085]}><sphereGeometry args={[0.065, 16, 16]} /><meshStandardMaterial color={deepPurple} /></mesh>
          <mesh position={[-0.018, 0, 0.112]}><sphereGeometry args={[0.035, 12, 12]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh position={[-0.04, 0.03, 0.122]}><sphereGeometry args={[0.016, 8, 8]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={1} /></mesh>
          {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
            <mesh key={i} position={[x, 0.1, 0.06]} rotation={[0, 0, x * 0.8]}><boxGeometry args={[0.012, 0.04, 0.01]} /><meshStandardMaterial color={dark} /></mesh>
          ))}
          <mesh ref={lidRightRef} position={[0, 0.055, 0.055]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.115, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} /><meshStandardMaterial color={purple} /></mesh>
        </group>
        <mesh position={[0.27, -0.02, 0.25]}><sphereGeometry args={[0.075, 16, 16]} /><meshStandardMaterial color={rosy} transparent opacity={0.55} roughness={1} /></mesh>
        <mesh position={[-0.27, -0.02, 0.25]}><sphereGeometry args={[0.075, 16, 16]} /><meshStandardMaterial color={rosy} transparent opacity={0.55} roughness={1} /></mesh>
      </group>
    </group>
  );
}
