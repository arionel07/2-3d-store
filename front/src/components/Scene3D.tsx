"use client";

import { Canvas } from "@react-three/fiber";
import type { LayoutObject } from "../lib/types";
import { isObjectValid } from "../lib/geometry";

type Scene3DProps = {
  room: { widthCm: number; depthCm: number };
  objects: LayoutObject[];
};

function Scene({ room, objects }: Scene3DProps) {
  const roomWidth = room.widthCm / 100;
  const roomDepth = room.depthCm / 100;
  const maxDimension = Math.max(roomWidth, roomDepth);

  return (
    <Canvas
      camera={{ position: [maxDimension * 0.9, maxDimension * 1.1, maxDimension * 1.15], fov: 42 }}
      gl={{ antialias: true }}
      style={{ background: "#e9f0f4" }}
    >
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
  return <Scene {...props} />;
}
