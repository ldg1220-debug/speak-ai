"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PERSONAS, PersonaId } from "@/lib/personas";
import { useCharacterStore } from "@/store/useCharacterStore";
import SunnyCharacter    from "./characters/SunnyCharacter";
import AriaCharacter     from "./characters/AriaCharacter";
import KaiCharacter      from "./characters/KaiCharacter";
import SterlingCharacter from "./characters/SterlingCharacter";
import DinoAvatar        from "./DinoAvatar";
import StaticGlbAvatar  from "./StaticGlbAvatar";

export type CharacterState = "idle" | "listening" | "thinking" | "speaking";

interface SceneProps {
  personaId: PersonaId;
  characterState: CharacterState;
  amplitudeRef: React.MutableRefObject<number>;
}

// Procedural geometric character (used when persona has no avatarUrl)
function ProceduralCharacter() {
  const personaId      = useCharacterStore((s) => s.personaId);
  const audioVolume    = useCharacterStore((s) => s.audioVolume);
  const isSpeaking     = useCharacterStore((s) => s.isSpeaking);
  const currentEmotion = useCharacterStore((s) => s.currentEmotion);
  const props = { audioVolume, isSpeaking, emotion: currentEmotion };

  switch (personaId) {
    case "aria":     return <AriaCharacter     {...props} />;
    case "kai":      return <KaiCharacter      {...props} />;
    case "sterling": return <SterlingCharacter {...props} />;
    default:         return <SunnyCharacter    {...props} />;
  }
}

function Lights({ personaId }: { personaId: PersonaId }) {
  const { colors } = PERSONAS[personaId];
  const isKai = personaId === "kai";
  return (
    <>
      {/* Bright ambient so all skin tones render clearly */}
      <ambientLight intensity={isKai ? 3.5 : 1.4} color={isKai ? "#fff8ee" : "#ffffff"} />
      {/* Key light from upper-right */}
      <directionalLight position={[2, 5, 3]} intensity={isKai ? 3.0 : 1.2} color={isKai ? "#fff0d8" : "#ffffff"} castShadow />
      {/* Front fill — warm bright for Kai, white for others */}
      <directionalLight position={[0, 1, 5]} intensity={isKai ? 3.5 : 1.6} color={isKai ? "#fff8e8" : "#ffffff"} />
      {/* Warm under-fill for Kai to lift shadows */}
      {isKai && <directionalLight position={[0, -1, 3]} intensity={2.0} color="#ffe8c0" />}
      {/* Side fill for Kai */}
      {isKai && <directionalLight position={[-3, 2, 3]} intensity={1.5} color="#fff4e0" />}
      {/* Subtle persona-coloured rim/accent lights */}
      <directionalLight position={[-2, 2, -1]} intensity={0.25} color={colors.head} />
      <pointLight position={[0, 1.5, 2]} intensity={isKai ? 1.5 : 0.3} color={isKai ? "#ffe8c8" : colors.accessory} />
    </>
  );
}

// Personas whose avatarUrl points to the Dino bone-rig model
const DINO_RIG_PERSONAS = new Set<PersonaId>(["sunny"]);

export default function CharacterScene({ personaId }: SceneProps) {
  const { bgFrom } = PERSONAS[personaId].colors;
  const hasGlb    = !!PERSONAS[personaId].avatarUrl;
  const isDinoRig = DINO_RIG_PERSONAS.has(personaId);

  return (
    <div
      className="w-full h-full"
      style={{ background: "linear-gradient(180deg, #87CEEB 0%, #cde8f7 60%, #e8f4fb 100%)" }}
    >
      <Canvas
        camera={{ position: [0, 0.2, 4.2], fov: 46 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.6}
          minAzimuthAngle={-Math.PI / 3}
          maxAzimuthAngle={Math.PI / 3}
          dampingFactor={0.08}
          enableDamping
        />
        <Lights personaId={personaId} />
        <Suspense fallback={null}>
          {isDinoRig ? <DinoAvatar /> :
           hasGlb    ? <StaticGlbAvatar url={PERSONAS[personaId].avatarUrl!} /> :
                       <ProceduralCharacter />}
        </Suspense>
      </Canvas>
    </div>
  );
}
