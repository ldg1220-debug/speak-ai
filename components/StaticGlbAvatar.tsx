"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useCharacterStore } from "@/store/useCharacterStore";

// ─── Per-model display config ─────────────────────────────────────────────────

interface AvatarConfig {
  position: [number, number, number];
  scale: number;
  /** Euler rotation [x,y,z] in radians — used to fix model orientation */
  rotation?: [number, number, number];
  /** Partial mesh names whose material should be replaced with a white shirt */
  whiteMeshNames?: string[];
  /** Rotate arm bones down from T-pose to natural hanging position */
  poseArmsDown?: boolean;
  /** rotation.x value for arm-down pose (default 1.3). Tune per-model. */
  armDownX?: number;
}

const AVATAR_CONFIG: Record<string, AvatarConfig> = {
  // Aria: right-side-up. Move down so upper body (chest→head) is in frame.
  "/models/Aria.glb": {
    position: [0, -2.6, 0],
    scale: 0.022,
    poseArmsDown: true,
    armDownX: 1.3,
  },
  // Kai: large rig. X/Z compensate for mesh offset (local ≈0.426, 0.201). Scale up for upper-body zoom.
  "/models/Kai.glb": {
    position: [-0.3, -4.0, -0.7],
    scale: 3.5,
  },
  // Sterling: arm bind pose has larger initial X rotation (-22°) than Aria (-8°),
  // so needs a larger armDownX to achieve the same visual result.
  "/models/Mr.Sterling.glb": {
    position: [0, -2.6, 0],
    scale: 0.022,
    poseArmsDown: true,
    armDownX: 1.0,
  },
};

const DEFAULT_CONFIG: AvatarConfig = { position: [0, -1.55, 0], scale: 1 };

const WHITE_SHIRT_MAT = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0xf5f5f5),
  roughness: 0.85,
  metalness: 0.0,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaticGlbAvatar({ url }: { url: string }) {
  const groupRef   = useRef<THREE.Group>(null);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const tRef       = useRef(0);
  const isSpeaking = useCharacterStore((s) => s.isSpeaking);
  const cfg        = AVATAR_CONFIG[url] ?? DEFAULT_CONFIG;

  // Base Z rotation from config (e.g. Math.PI for Aria/Sterling)
  const baseRotZ = cfg.rotation?.[2] ?? 0;

  useEffect(() => {
    let cancelled = false;

    new GLTFLoader().load(
      url,
      (gltf) => {
        if (cancelled) return;
        const s = gltf.scene;

        // Apply white shirt material to designated meshes
        if (cfg.whiteMeshNames?.length) {
          s.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (cfg.whiteMeshNames!.some((n) => child.name.includes(n))) {
                child.material = WHITE_SHIRT_MAT;
              }
            }
          });
        }

        // Pose arms down from T-pose (Wolf3D_Avatar / Sketchfab humanoid rig)
        // Analysis: LeftArm local Z → world +Y (up), local X → world +Z (camera).
        // To swing arm from world +X to world -Y (down), rotate around local X by -PI/2.
        if (cfg.poseArmsDown) {
          const leftArm  = s.getObjectByName("LeftArm_011");
          const rightArm = s.getObjectByName("RightArm_035");
          const ax = cfg.armDownX ?? 1.3;
          if (leftArm)  leftArm.rotation.x  = ax;
          if (rightArm) rightArm.rotation.x  = ax;
        }

        setScene(s);
      },
      undefined,
      (err) => console.error(`[StaticGlbAvatar] load error (${url}):`, err),
    );

    return () => { cancelled = true; };
  }, [url]);

  // Subtle idle breathing + speaking head-tilt
  // NOTE: lerp rotation.z toward (baseRotZ + tilt) so the config base rotation
  // isn't overwritten by the animation loop.
  useFrame((_, delta) => {
    tRef.current += delta;
    if (!groupRef.current) return;
    const base    = cfg.position[1];
    const breathe = Math.sin(tRef.current * 0.9) * 0.012;
    const tilt    = isSpeaking ? Math.sin(tRef.current * 3.0) * 0.010 : 0;
    groupRef.current.position.y = base + breathe;
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      baseRotZ + tilt,
      0.06,
    );
  });

  if (!scene) return null;

  return (
    <group
      ref={groupRef}
      position={cfg.position}
      scale={cfg.scale}
      rotation={cfg.rotation ?? [0, 0, 0]}
    >
      <primitive object={scene} />
    </group>
  );
}
