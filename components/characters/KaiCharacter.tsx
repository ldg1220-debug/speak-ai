"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Emotion } from "@/store/useCharacterStore";
import { ANIM_CONFIG } from "@/lib/personas";

interface Props { audioVolume: number; isSpeaking: boolean; emotion: Emotion }

export default function KaiCharacter({ audioVolume, isSpeaking }: Props) {
  const cfg = ANIM_CONFIG.kai;
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
    const targetJaw = isSpeaking ? Math.min(audioVolume * 0.75, 0.75) : 0;
    jaw.current = THREE.MathUtils.lerp(jaw.current, targetJaw, 0.2);
    if (mouthInteriorRef.current) {
      mouthInteriorRef.current.scale.y = jaw.current * 4.5 + 0.001;
      mouthInteriorRef.current.visible = jaw.current > 0.02;
    }
    const blinkPhase = ti % cfg.blinkInterval;
    const blinkVal = blinkPhase < 0.08 ? blinkPhase / 0.08 : blinkPhase < 0.16 ? (0.16 - blinkPhase) / 0.08 : 0;
    if (lidLeftRef.current) lidLeftRef.current.scale.y = blinkVal + 0.001;
    if (lidRightRef.current) lidRightRef.current.scale.y = blinkVal + 0.001;
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(ti * cfg.idleSpeed) * cfg.idleAmp;
      rootRef.current.rotation.z = Math.sin(ti * cfg.idleSpeed * 0.4) * 0.015;
    }
    if (headRef.current) {
      const nodTarget = isSpeaking ? Math.sin(ti * cfg.nodSpeed) * 0.05 : 0;
      const leanTarget = isSpeaking ? 0.04 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, leanTarget + nodTarget, 0.08);
    }
    if (rightArmRef.current) {
      const gestureTarget = isSpeaking ? Math.sin(ti * cfg.nodSpeed * 0.8) * 0.2 - 0.3 : 0;
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, gestureTarget, 0.09);
    }
  });

  const blue = "#38BDF8"; const darkBlue = "#0369A1"; const white = "#FFFFFF";
  const dark = "#0C4A6E"; const nearBlack = "#0a0a0a"; const skin = "#FDDBA0";

  return (
    <group ref={rootRef} position={[0, -0.5, 0]}>
      <group position={[0, 0, 0]}>
        <mesh scale={[1.05, 1.0, 0.9]}><sphereGeometry args={[0.4, 32, 32]} /><meshStandardMaterial color={blue} roughness={0.65} /></mesh>
        <mesh position={[0, -0.1, 0.33]}><boxGeometry args={[0.22, 0.1, 0.01]} /><meshStandardMaterial color={darkBlue} roughness={0.8} /></mesh>
        <group position={[0.38, 0.06, 0.05]}>
          <mesh rotation={[0.1, 0, 0.5]}><capsuleGeometry args={[0.065, 0.24, 8, 16]} /><meshStandardMaterial color={blue} roughness={0.65} /></mesh>
          <mesh position={[0.1, -0.22, 0.02]}><sphereGeometry args={[0.07, 16, 16]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
        </group>
        <group ref={rightArmRef} position={[-0.38, 0.06, 0.05]}>
          <mesh rotation={[0.1, 0, -0.5]}><capsuleGeometry args={[0.065, 0.24, 8, 16]} /><meshStandardMaterial color={blue} roughness={0.65} /></mesh>
          <mesh position={[-0.1, -0.22, 0.02]}><sphereGeometry args={[0.07, 16, 16]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
        </group>
      </group>
      <group ref={headRef} position={[0, 0.63, 0]}>
        <mesh scale={[1.05, 1.0, 0.97]}><sphereGeometry args={[0.38, 32, 32]} /><meshStandardMaterial color={blue} roughness={0.65} /></mesh>
        <mesh position={[0, 0.3, -0.05]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.38, 24, 12]} /><meshStandardMaterial color={darkBlue} roughness={0.5} /></mesh>
        <mesh position={[0.18, 0.36, 0.12]} rotation={[0.3, 0.2, 0.4]}><sphereGeometry args={[0.1, 12, 12]} /><meshStandardMaterial color={darkBlue} roughness={0.5} /></mesh>
        <mesh position={[-0.12, 0.38, 0.1]} rotation={[0.2, -0.3, -0.3]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color={darkBlue} roughness={0.5} /></mesh>
        <group position={[0, 0.1, 0.35]}>
          <mesh position={[0.13, 0, 0]} scale={[1.2, 0.65, 0.2]}><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color={nearBlack} transparent opacity={0.85} roughness={0.1} metalness={0.2} /></mesh>
          <mesh position={[-0.13, 0, 0]} scale={[1.2, 0.65, 0.2]}><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color={nearBlack} transparent opacity={0.85} roughness={0.1} metalness={0.2} /></mesh>
          <mesh><boxGeometry args={[0.06, 0.015, 0.01]} /><meshStandardMaterial color={dark} metalness={0.6} roughness={0.3} /></mesh>
          <mesh position={[0.26, 0, -0.04]} rotation={[0, -0.3, 0]}><boxGeometry args={[0.12, 0.012, 0.01]} /><meshStandardMaterial color={dark} metalness={0.6} roughness={0.3} /></mesh>
          <mesh position={[-0.26, 0, -0.04]} rotation={[0, 0.3, 0]}><boxGeometry args={[0.12, 0.012, 0.01]} /><meshStandardMaterial color={dark} metalness={0.6} roughness={0.3} /></mesh>
        </group>
        <group position={[0.02, -0.17, 0.34]}>
          <mesh rotation={[0, 0, -0.06]}><boxGeometry args={[0.15, 0.028, 0.01]} /><meshStandardMaterial color={darkBlue} /></mesh>
          <mesh ref={mouthInteriorRef} position={[0, -0.03, 0]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.075, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
            <meshStandardMaterial color="#001f33" side={THREE.FrontSide} />
          </mesh>
        </group>
        <group position={[0.13, 0.1, 0.33]}>
          <mesh><sphereGeometry args={[0.075, 16, 16]} /><meshStandardMaterial color={white} roughness={0.1} transparent opacity={0.15} /></mesh>
          <mesh ref={lidLeftRef} position={[0, 0.04, 0.04]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} /><meshStandardMaterial color={blue} /></mesh>
          <mesh position={[0, 0.1, 0.06]} rotation={[0, 0, -0.15]}><boxGeometry args={[0.13, 0.032, 0.02]} /><meshStandardMaterial color={darkBlue} /></mesh>
        </group>
        <group position={[-0.13, 0.1, 0.33]}>
          <mesh><sphereGeometry args={[0.075, 16, 16]} /><meshStandardMaterial color={white} roughness={0.1} transparent opacity={0.15} /></mesh>
          <mesh ref={lidRightRef} position={[0, 0.04, 0.04]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} /><meshStandardMaterial color={blue} /></mesh>
          <mesh position={[0, 0.1, 0.06]} rotation={[0, 0, 0.15]}><boxGeometry args={[0.13, 0.032, 0.02]} /><meshStandardMaterial color={darkBlue} /></mesh>
        </group>
      </group>
    </group>
  );
}
