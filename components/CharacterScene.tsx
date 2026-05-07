"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PERSONAS, ANIM_CONFIG, PersonaId } from "@/lib/personas";

export type CharacterState = "idle" | "listening" | "thinking" | "speaking";

interface SceneProps {
  personaId: PersonaId;
  characterState: CharacterState;
  amplitudeRef: React.MutableRefObject<number>;
}

// ─── Accessories ────────────────────────────────────────────────────────────

function SunnyAccessory({ color }: { color: string }) {
  const starRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (starRef.current) starRef.current.rotation.z = Math.sin(clock.elapsedTime * 2.5) * 0.25;
  });
  return (
    <group ref={starRef} position={[0, 1.18, 0]}>
      <mesh>
        <coneGeometry args={[0.28, 0.44, 5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function AriaAccessory({ color }: { color: string }) {
  return (
    <group>
      {/* Hair bun */}
      <mesh position={[0.36, 1.02, -0.08]}>
        <sphereGeometry args={[0.33, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {/* Decorative dot */}
      <mesh position={[0.36, 1.02, 0.22]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function KaiAccessory({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.28, 1.12, 0.28]} rotation={[0.5, 0, -0.35]}>
        <cylinderGeometry args={[0.09, 0.14, 0.38, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0.08, 1.17, 0.22]} rotation={[0.3, 0, 0.12]}>
        <cylinderGeometry args={[0.09, 0.14, 0.44, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0.36, 1.04, 0.12]} rotation={[0.2, 0, 0.32]}>
        <cylinderGeometry args={[0.07, 0.12, 0.3, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

function SterlingAccessory({ color }: { color: string }) {
  return (
    <group position={[0, 0.18, 0.97]}>
      <mesh position={[-0.3, 0, 0]}>
        <torusGeometry args={[0.17, 0.026, 8, 32]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.3, 0, 0]}>
        <torusGeometry args={[0.17, 0.026, 8, 32]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.24, 0.026, 0.026]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ─── Character mesh ──────────────────────────────────────────────────────────

function Character({ personaId, characterState, amplitudeRef }: SceneProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const mouthRef   = useRef<THREE.Mesh>(null);
  const eyeLRef    = useRef<THREE.Mesh>(null);
  const eyeRRef    = useRef<THREE.Mesh>(null);
  const browLRef   = useRef<THREE.Mesh>(null);
  const browRRef   = useRef<THREE.Mesh>(null);

  const timeRef    = useRef(0);
  const blinkTimer = useRef(Math.random() * 3 + 2);

  const colors = PERSONAS[personaId].colors;
  const anim   = ANIM_CONFIG[personaId];

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const t   = timeRef.current;
    const amp = Math.min(Math.max(amplitudeRef.current, 0), 1);
    const g   = groupRef.current;

    // ── Mouth ──
    if (mouthRef.current) {
      const targetY = characterState === "speaking" ? 0.15 + amp * 0.72 : 0.06;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetY, 0.22);
    }

    // ── Eyebrows ──
    if (browLRef.current && browRRef.current) {
      const by =
        characterState === "speaking"  ? 0.53 + amp * 0.08 :
        characterState === "thinking"  ? 0.57 :
        characterState === "listening" ? 0.50 : 0.52;
      browLRef.current.position.y = THREE.MathUtils.lerp(browLRef.current.position.y, by, 0.1);
      browRRef.current.position.y = THREE.MathUtils.lerp(browRRef.current.position.y, by, 0.1);
    }

    // ── Blink ──
    blinkTimer.current -= delta;
    if (blinkTimer.current <= 0) blinkTimer.current = anim.blinkInterval + Math.random() * 2.5;
    const blinkOpen = blinkTimer.current > 0.12 ? 1 : Math.sin((blinkTimer.current / 0.12) * Math.PI);
    eyeLRef.current?.scale.setY(Math.max(0.06, blinkOpen));
    eyeRRef.current?.scale.setY(Math.max(0.06, blinkOpen));

    // ── Head motion by state ──
    if (characterState === "idle") {
      g.position.y = Math.sin(t * anim.idleSpeed) * anim.idleAmp;
      g.rotation.y = Math.sin(t * 0.55) * anim.swayAmp * 2;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0, 0.05);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.05);
    } else if (characterState === "listening") {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.11, 0.04);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0.04, 0.04);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0.04, 0.04);
    } else if (characterState === "thinking") {
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0.2, 0.03);
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.04, 0.03);
      g.position.y = Math.sin(t * 0.9) * 0.025;
    } else if (characterState === "speaking") {
      g.rotation.x = Math.sin(t * anim.nodSpeed) * amp * 0.065;
      g.rotation.z = Math.sin(t * 1.3) * anim.swayAmp;
      g.position.y = Math.sin(t * 2.5) * amp * 0.028;
    }
  });

  const isSterling = personaId === "sterling";

  return (
    <group ref={groupRef}>
      {/* ── Head ── */}
      <mesh castShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color={colors.head}
          roughness={isSterling ? 0.7 : 0.22}
          metalness={isSterling ? 0.15 : 0}
        />
      </mesh>

      {/* ── Rosy cheeks ── */}
      {colors.rosy && (
        <>
          <mesh position={[-0.6, 0.05, 0.78]} rotation={[0, 0.65, 0]}>
            <circleGeometry args={[0.22, 32]} />
            <meshStandardMaterial color={colors.rosy} transparent opacity={0.42} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.6, 0.05, 0.78]} rotation={[0, -0.65, 0]}>
            <circleGeometry args={[0.22, 32]} />
            <meshStandardMaterial color={colors.rosy} transparent opacity={0.42} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}

      {/* ── Left eye ── */}
      <mesh ref={eyeLRef} position={[-0.29, 0.21, 0.951]}>
        <sphereGeometry args={[0.188, 32, 32]} />
        <meshStandardMaterial color="white" roughness={0.08} />
      </mesh>
      <mesh position={[-0.29, 0.21, 0.972]}>
        <sphereGeometry args={[0.093, 16, 16]} />
        <meshStandardMaterial color={colors.eye} />
      </mesh>
      {/* shine */}
      <mesh position={[-0.265, 0.235, 0.988]}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={1} />
      </mesh>

      {/* ── Right eye ── */}
      <mesh ref={eyeRRef} position={[0.29, 0.21, 0.951]}>
        <sphereGeometry args={[0.188, 32, 32]} />
        <meshStandardMaterial color="white" roughness={0.08} />
      </mesh>
      <mesh position={[0.29, 0.21, 0.972]}>
        <sphereGeometry args={[0.093, 16, 16]} />
        <meshStandardMaterial color={colors.eye} />
      </mesh>
      {/* shine */}
      <mesh position={[0.315, 0.235, 0.988]}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={1} />
      </mesh>

      {/* ── Eyebrows ── */}
      <mesh ref={browLRef} position={[-0.29, 0.52, 0.951]}
            rotation={[0, 0, isSterling ? 0.38 : 0.16]}>
        <boxGeometry args={[isSterling ? 0.36 : 0.3, 0.062, 0.055]} />
        <meshStandardMaterial color={colors.eye} />
      </mesh>
      <mesh ref={browRRef} position={[0.29, 0.52, 0.951]}
            rotation={[0, 0, isSterling ? -0.38 : -0.16]}>
        <boxGeometry args={[isSterling ? 0.36 : 0.3, 0.062, 0.055]} />
        <meshStandardMaterial color={colors.eye} />
      </mesh>

      {/* ── Mouth ── */}
      <mesh ref={mouthRef} position={[0, -0.27, 0.963]} scale={[1, 0.06, 1]}>
        <circleGeometry args={[0.27, 32]} />
        <meshStandardMaterial color={colors.mouth} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Accessories ── */}
      {personaId === "sunny"    && <SunnyAccessory    color={colors.accessory} />}
      {personaId === "aria"     && <AriaAccessory     color={colors.accessory} />}
      {personaId === "kai"      && <KaiAccessory      color={colors.accessory} />}
      {personaId === "sterling" && <SterlingAccessory color={colors.accessory} />}
    </group>
  );
}

// ─── Scene wrapper ───────────────────────────────────────────────────────────

function Scene({ personaId, characterState, amplitudeRef }: SceneProps) {
  const colors = PERSONAS[personaId].colors;
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 5]} intensity={1.3} castShadow />
      {/* Rim / fill light colored to persona */}
      <pointLight position={[-3, -2, 2]} intensity={0.5} color={colors.head} />
      <pointLight position={[3, 3, -2]} intensity={0.2} color="#ffffff" />
      <Suspense fallback={null}>
        <Character personaId={personaId} characterState={characterState} amplitudeRef={amplitudeRef} />
      </Suspense>
    </>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export default function CharacterScene({ personaId, characterState, amplitudeRef }: SceneProps) {
  const { bgFrom } = PERSONAS[personaId].colors;
  return (
    <div
      className="w-full h-full"
      style={{ background: `radial-gradient(ellipse at 50% 60%, ${bgFrom} 0%, #0a0f1a 100%)` }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.3], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Scene personaId={personaId} characterState={characterState} amplitudeRef={amplitudeRef} />
      </Canvas>
    </div>
  );
}
