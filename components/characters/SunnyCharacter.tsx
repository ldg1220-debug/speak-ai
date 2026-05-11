"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Emotion } from "@/store/useCharacterStore";
import { ANIM_CONFIG } from "@/lib/personas";

interface Props { audioVolume: number; isSpeaking: boolean; emotion: Emotion }

export default function SunnyCharacter({ audioVolume, isSpeaking }: Props) {
  const cfg = ANIM_CONFIG.sunny;
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const mouthInteriorRef = useRef<THREE.Mesh>(null);
  const lidLeftRef = useRef<THREE.Mesh>(null);
  const lidRightRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const jaw = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const ti = t.current;
    const targetJaw = isSpeaking ? Math.min(audioVolume * 0.85, 0.85) : 0;
    jaw.current = THREE.MathUtils.lerp(jaw.current, targetJaw, 0.22);
    if (mouthInteriorRef.current) {
      mouthInteriorRef.current.scale.y = jaw.current * 5 + 0.001;
      mouthInteriorRef.current.visible = jaw.current > 0.02;
    }
    const blinkPhase = ti % cfg.blinkInterval;
    const blinkVal = blinkPhase < 0.08 ? blinkPhase / 0.08 : blinkPhase < 0.16 ? (0.16 - blinkPhase) / 0.08 : 0;
    if (lidLeftRef.current) lidLeftRef.current.scale.y = blinkVal + 0.001;
    if (lidRightRef.current) lidRightRef.current.scale.y = blinkVal + 0.001;
    if (rootRef.current) rootRef.current.position.y = Math.sin(ti * cfg.idleSpeed) * cfg.idleAmp;
    if (bodyRef.current) {
      const bounce = Math.sin(ti * cfg.idleSpeed);
      bodyRef.current.scale.y = 1 + bounce * 0.03;
      bodyRef.current.scale.x = 1 - bounce * 0.015;
    }
    if (headRef.current) {
      const nodTarget = isSpeaking ? Math.sin(ti * cfg.nodSpeed) * 0.06 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, nodTarget, 0.12);
      headRef.current.rotation.z = Math.sin(ti * cfg.idleSpeed * 0.5) * cfg.swayAmp;
    }
    if (leftArmRef.current && rightArmRef.current) {
      const waveTarget = isSpeaking ? Math.sin(ti * cfg.nodSpeed) * 0.55 + 0.3 : 0;
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, waveTarget, 0.1);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -waveTarget, 0.1);
    }
  });

  const green = "#5DBB63"; const darkGreen = "#3A8C40"; const lightGreen = "#7DD881";
  const orange = "#FF9800"; const white = "#FAFFF8"; const dark = "#1a1a1a";
  const rosy = "#FF8C8C"; const mouthRed = "#CC2200";

  return (
    <group ref={rootRef} position={[0, -0.45, 0]}>
      <group ref={bodyRef} position={[0, 0, 0]}>
        <mesh><sphereGeometry args={[0.42, 32, 32]} /><meshStandardMaterial color={green} roughness={0.75} /></mesh>
        <mesh position={[0, 0.02, 0.3]}><sphereGeometry args={[0.26, 24, 24]} /><meshStandardMaterial color={white} roughness={0.9} /></mesh>
        <group ref={leftArmRef} position={[0.4, 0.12, 0.1]}>
          <mesh rotation={[0.2, 0, 0.4]}><capsuleGeometry args={[0.07, 0.18, 8, 16]} /><meshStandardMaterial color={green} roughness={0.75} /></mesh>
          <mesh position={[0.07, -0.18, 0.04]}><sphereGeometry args={[0.08, 16, 16]} /><meshStandardMaterial color={lightGreen} roughness={0.75} /></mesh>
        </group>
        <group ref={rightArmRef} position={[-0.4, 0.12, 0.1]}>
          <mesh rotation={[0.2, 0, -0.4]}><capsuleGeometry args={[0.07, 0.18, 8, 16]} /><meshStandardMaterial color={green} roughness={0.75} /></mesh>
          <mesh position={[-0.07, -0.18, 0.04]}><sphereGeometry args={[0.08, 16, 16]} /><meshStandardMaterial color={lightGreen} roughness={0.75} /></mesh>
        </group>
        <mesh position={[0.2, -0.42, 0.14]} rotation={[0.35, 0, 0]}><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial color={orange} roughness={0.8} /></mesh>
        <mesh position={[-0.2, -0.42, 0.14]} rotation={[0.35, 0, 0]}><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial color={orange} roughness={0.8} /></mesh>
        <group position={[0.12, 0.1, -0.38]} rotation={[-0.5, 0.3, 0.2]}>
          <mesh><cylinderGeometry args={[0.05, 0.025, 0.28, 12]} /><meshStandardMaterial color={darkGreen} roughness={0.8} /></mesh>
          <mesh position={[0, -0.18, 0]}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial color={darkGreen} roughness={0.8} /></mesh>
        </group>
      </group>
      <group ref={headRef} position={[0, 0.65, 0.05]}>
        <mesh><sphereGeometry args={[0.4, 32, 32]} /><meshStandardMaterial color={green} roughness={0.75} /></mesh>
        <mesh position={[0.08, 0.36, -0.18]} rotation={[0.4, 0, -0.3]}><sphereGeometry args={[0.07, 16, 16]} /><meshStandardMaterial color={darkGreen} roughness={0.8} /></mesh>
        <mesh position={[-0.04, 0.4, -0.22]} rotation={[0.3, 0, 0.2]}><sphereGeometry args={[0.08, 16, 16]} /><meshStandardMaterial color={darkGreen} roughness={0.8} /></mesh>
        <mesh position={[-0.16, 0.33, -0.15]} rotation={[0.5, 0, 0.4]}><sphereGeometry args={[0.06, 16, 16]} /><meshStandardMaterial color={darkGreen} roughness={0.8} /></mesh>
        <group position={[0, -0.1, 0.3]}>
          <mesh scale={[1.1, 0.75, 1.3]}><sphereGeometry args={[0.22, 24, 20]} /><meshStandardMaterial color={lightGreen} roughness={0.75} /></mesh>
          <mesh position={[0.07, 0.06, 0.22]}><sphereGeometry args={[0.035, 12, 12]} /><meshStandardMaterial color={darkGreen} /></mesh>
          <mesh position={[-0.07, 0.06, 0.22]}><sphereGeometry args={[0.035, 12, 12]} /><meshStandardMaterial color={darkGreen} /></mesh>
        </group>
        <group position={[0, -0.19, 0.47]}>
          <mesh><boxGeometry args={[0.18, 0.028, 0.01]} /><meshStandardMaterial color={mouthRed} /></mesh>
          <mesh ref={mouthInteriorRef} position={[0, -0.04, 0]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.09, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
            <meshStandardMaterial color="#6B0000" side={THREE.FrontSide} />
          </mesh>
        </group>
        <group position={[0.19, 0.17, 0.31]}>
          <mesh><sphereGeometry args={[0.13, 20, 20]} /><meshStandardMaterial color={white} roughness={0.1} /></mesh>
          <mesh position={[0.02, 0, 0.09]}><sphereGeometry args={[0.075, 16, 16]} /><meshStandardMaterial color="#3D1A00" /></mesh>
          <mesh position={[0.025, 0, 0.125]}><sphereGeometry args={[0.04, 12, 12]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh position={[0.055, 0.035, 0.135]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={1} /></mesh>
          <mesh ref={lidLeftRef} position={[0, 0.06, 0.06]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} /><meshStandardMaterial color={green} /></mesh>
          <mesh position={[-0.01, 0.14, 0.08]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.13, 0.03, 0.02]} /><meshStandardMaterial color={darkGreen} /></mesh>
        </group>
        <group position={[-0.19, 0.17, 0.31]}>
          <mesh><sphereGeometry args={[0.13, 20, 20]} /><meshStandardMaterial color={white} roughness={0.1} /></mesh>
          <mesh position={[-0.02, 0, 0.09]}><sphereGeometry args={[0.075, 16, 16]} /><meshStandardMaterial color="#3D1A00" /></mesh>
          <mesh position={[-0.025, 0, 0.125]}><sphereGeometry args={[0.04, 12, 12]} /><meshStandardMaterial color={dark} /></mesh>
          <mesh position={[-0.055, 0.035, 0.135]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color={white} emissive={white} emissiveIntensity={1} /></mesh>
          <mesh ref={lidRightRef} position={[0, 0.06, 0.06]} scale={[1, 0.001, 1]}><sphereGeometry args={[0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} /><meshStandardMaterial color={green} /></mesh>
          <mesh position={[0.01, 0.14, 0.08]} rotation={[0, 0, 0.25]}><boxGeometry args={[0.13, 0.03, 0.02]} /><meshStandardMaterial color={darkGreen} /></mesh>
        </group>
        <mesh position={[0.32, 0.02, 0.26]}><sphereGeometry args={[0.085, 16, 16]} /><meshStandardMaterial color={rosy} transparent opacity={0.65} roughness={1} /></mesh>
        <mesh position={[-0.32, 0.02, 0.26]}><sphereGeometry args={[0.085, 16, 16]} /><meshStandardMaterial color={rosy} transparent opacity={0.65} roughness={1} /></mesh>
      </group>
    </group>
  );
}
