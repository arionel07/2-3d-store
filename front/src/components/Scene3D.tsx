"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TOUCH } from "three";
import type { LayoutObject } from "../lib/types";
import { isObjectValid } from "../lib/geometry";

type Scene3DProps = {
  room: { widthCm: number; depthCm: number };
  objects: LayoutObject[];
};

type CameraControlsProps = {
  onReady: (reset: () => void) => void;
};

function CameraControls({ onReady }: CameraControlsProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 80;
    controls.touches.ONE = TOUCH.ROTATE;
    controls.touches.TWO = TOUCH.DOLLY_PAN;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    const initialPosition = camera.position.clone();
    const reset = () => {
      camera.position.copy(initialPosition);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    onReady(reset);

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, onReady]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

function Scene({ room, objects, onReady }: Scene3DProps & CameraControlsProps) {
  const roomWidth = room.widthCm / 100;
  const roomDepth = room.depthCm / 100;
  const maxDimension = Math.max(roomWidth, roomDepth);

  return (
    <Canvas
      camera={{ position: [maxDimension * 0.9, maxDimension * 1.1, maxDimension * 1.15], fov: 42 }}
      gl={{ antialias: true }}
      style={{ background: "#e9f0f4" }}
    >
      <CameraControls onReady={onReady} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 8, 5]} intensity={2.4} />
      <group position={[-roomWidth / 2, 0, -roomDepth / 2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomWidth / 2, 0, roomDepth / 2]}>
          <planeGeometry args={[roomWidth, roomDepth]} />
          <meshStandardMaterial color="#f8fbfc" />
        </mesh>
        <mesh position={[roomWidth / 2, 1.2, 0]}>
          <boxGeometry args={[roomWidth, 2.4, 0.12]} />
          <meshStandardMaterial color="#70818d" />
        </mesh>
        <mesh position={[roomWidth / 2, 1.2, roomDepth]}>
          <boxGeometry args={[roomWidth, 2.4, 0.12]} />
          <meshStandardMaterial color="#70818d" />
        </mesh>
        <mesh position={[0, 1.2, roomDepth / 2]}>
          <boxGeometry args={[0.12, 2.4, roomDepth]} />
          <meshStandardMaterial color="#70818d" />
        </mesh>
        <mesh position={[roomWidth, 1.2, roomDepth / 2]}>
          <boxGeometry args={[0.12, 2.4, roomDepth]} />
          <meshStandardMaterial color="#70818d" />
        </mesh>
        {objects.map((object) => {
          const width = object.widthCm / 100;
          const depth = object.depthCm / 100;
          const height = object.heightCm / 100;
          const valid = isObjectValid(object, objects, room);

          return (
            <mesh
              key={object.id}
              position={[
                (object.xCm + object.widthCm / 2) / 100,
                height / 2,
                (object.yCm + object.depthCm / 2) / 100,
              ]}
              rotation={[0, (-object.rotationDeg * Math.PI) / 180, 0]}
            >
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={valid ? "#2c9a8c" : "#dc6e5b"} />
            </mesh>
          );
        })}
      </group>
    </Canvas>
  );
}

export default function Scene3D(props: Scene3DProps) {
  const resetRef = useRef<(() => void) | null>(null);
  const [isReady, setIsReady] = useState(false);
  const handleReady = useCallback((reset: () => void) => {
    resetRef.current = reset;
    setIsReady(true);
  }, []);

  return (
    <div className="scene-3d-inner">
      <Scene {...props} onReady={handleReady} />
      <button
        type="button"
        className="scene-reset-button"
        onClick={() => resetRef.current?.()}
        disabled={!isReady}
      >
        Сбросить вид
      </button>
    </div>
  );
}
