"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TOUCH, MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { LayoutObject } from "../lib/types";
import { isObjectValid } from "../lib/geometry";

type Scene3DProps = {
  room: { widthCm: number; depthCm: number };
  objects: LayoutObject[];
  selectedObjectId: string | null;
  onSelect: (id: string | null) => void;
};

type CameraApi = {
  reset: () => void;
  fit: () => void;
};

type CameraControlsProps = {
  roomWidth: number;
  roomDepth: number;
  onReady: (api: CameraApi) => void;
};

const cameraDirection = new Vector3(0.82, 1.08, 0.92).normalize();

function CameraControls({ roomWidth, roomDepth, onReady }: CameraControlsProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  const getPerspectiveCamera = useCallback(() => camera as PerspectiveCamera, [camera]);

  const fitCamera = useCallback(() => {
    const perspectiveCamera = getPerspectiveCamera();
    const controls = controlsRef.current;

    if (!controls) return;

    const verticalFov = MathUtils.degToRad(perspectiveCamera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * perspectiveCamera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const roomRadius = Math.hypot(roomWidth / 2, roomDepth / 2, 1.35);
    const distance = (roomRadius / Math.sin(limitingFov / 2)) * 0.85;
    const target = new Vector3(0, 0.25, 0);

    perspectiveCamera.position.copy(target).add(cameraDirection.clone().multiplyScalar(distance));
    perspectiveCamera.near = Math.max(0.05, distance / 100);
    perspectiveCamera.far = Math.max(100, Math.max(roomWidth, roomDepth) * 8);
    perspectiveCamera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
  }, [getPerspectiveCamera, roomDepth, roomWidth]);

  const resetCamera = useCallback(() => {
    fitCamera();
  }, [fitCamera]);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    const maxDimension = Math.max(roomWidth, roomDepth);
    const maxPan = maxDimension * 0.65;

    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = Math.max(1.5, maxDimension * 0.18);
    controls.maxDistance = Math.max(70, maxDimension * 6);
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.touches.ONE = TOUCH.ROTATE;
    controls.touches.TWO = TOUCH.DOLLY_PAN;
    controls.target.set(0, 0.25, 0);

    const clampTarget = () => {
      const target = controls.target;
      const nextTarget = target.clone();
      nextTarget.x = MathUtils.clamp(nextTarget.x, -maxPan, maxPan);
      nextTarget.y = 0;
      nextTarget.z = MathUtils.clamp(nextTarget.z, -maxPan, maxPan);
      const delta = nextTarget.sub(target);

      if (delta.lengthSq() > 0) {
        target.copy(nextTarget);
        camera.position.add(delta);
      }
    };

    controls.addEventListener("change", clampTarget);
    controlsRef.current = controls;
    fitCamera();
    onReady({ reset: resetCamera, fit: fitCamera });

    return () => {
      controls.removeEventListener("change", clampTarget);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, fitCamera, gl, onReady, resetCamera, roomDepth, roomWidth]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

function RoomGrid({ width, depth }: { width: number; depth: number }) {
  const maxDimension = Math.max(width, depth);
  const divisions = Math.max(2, Math.round(maxDimension / 0.5));

  return (
    <gridHelper
      args={[maxDimension, divisions, "#d1dfdc", "#e8efed"]}
      position={[width / 2, 0.012, depth / 2]}
      scale={[width / maxDimension, 1, depth / maxDimension]}
    />
  );
}

function Room({ width, depth }: { width: number; depth: number }) {
  const wallHeight = 1.35;
  const wallThickness = 0.14;
  const wallColor = "#cbd3d1";

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f8fbfa" roughness={0.86} />
      </mesh>
      <RoomGrid width={width} depth={depth} />
      <mesh position={[width / 2, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + wallThickness, wallHeight, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[width / 2, wallHeight / 2, depth]} castShadow receiveShadow>
        <boxGeometry args={[width + wallThickness, wallHeight, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[0, wallHeight / 2, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[width, wallHeight / 2, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
    </group>
  );
}

function ObjectMesh({
  object,
  valid,
  selected,
  onSelect,
}: {
  object: LayoutObject;
  valid: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const width = object.widthCm / 100;
  const depth = object.depthCm / 100;
  const height = object.heightCm / 100;
  const baseColor = selected ? "#f1ba22" : valid ? "#cbd8d5" : "#e68775";
  const accentColor = selected ? "#ffe18a" : valid ? "#eef5f3" : "#ffc3b8";
  const accentHeight = Math.max(0.025, Math.min(height * 0.06, 0.12));

  return (
    <group
      position={[(object.xCm + object.widthCm / 2) / 100, 0, (object.yCm + object.depthCm / 2) / 100]}
      rotation={[0, (-object.rotationDeg * Math.PI) / 180, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={baseColor} roughness={0.65} metalness={0.02} />
      </mesh>
      {object.type === "shelf" && (
        <>
          <mesh position={[0, height * 0.38, 0]} castShadow>
            <boxGeometry args={[width * 0.92, accentHeight, depth * 0.93]} />
            <meshStandardMaterial color={accentColor} roughness={0.58} />
          </mesh>
          <mesh position={[0, height * 0.7, 0]} castShadow>
            <boxGeometry args={[width * 0.92, accentHeight, depth * 0.93]} />
            <meshStandardMaterial color={accentColor} roughness={0.58} />
          </mesh>
        </>
      )}
      {object.type === "checkout" && (
        <mesh position={[0, height * 0.97, 0]} castShadow>
          <boxGeometry args={[width * 0.94, accentHeight, depth * 0.94]} />
          <meshStandardMaterial color={accentColor} roughness={0.5} />
        </mesh>
      )}
      {object.type === "display" && (
        <mesh position={[0, height * 0.72, 0]}>
          <boxGeometry args={[width * 0.88, Math.max(0.035, height * 0.04), depth * 0.88]} />
          <meshStandardMaterial color={accentColor} roughness={0.42} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width * 1.01, height * 1.01, depth * 1.01]} />
          <meshBasicMaterial color="#f1ba22" wireframe transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  );
}

function Scene({ room, objects, selectedObjectId, onSelect, onReady }: Scene3DProps & CameraControlsProps) {
  const roomWidth = room.widthCm / 100;
  const roomDepth = room.depthCm / 100;
  const maxDimension = Math.max(roomWidth, roomDepth);

  return (
    <Canvas
      camera={{ position: [maxDimension * 0.9, maxDimension * 1.1, maxDimension * 1.15], fov: 42 }}
      shadows
      gl={{ antialias: true }}
      style={{ background: "#f7faf9" }}
      onPointerMissed={() => onSelect(null)}
    >
      <CameraControls roomWidth={roomWidth} roomDepth={roomDepth} onReady={onReady} />
      <ambientLight intensity={1.7} />
      <directionalLight castShadow position={[5, 10, 6]} intensity={2.1} shadow-mapSize={[1024, 1024]} />
      <group position={[-roomWidth / 2, 0, -roomDepth / 2]}>
        <Room width={roomWidth} depth={roomDepth} />
        {objects.map((object) => (
          <ObjectMesh
            key={object.id}
            object={object}
            valid={isObjectValid(object, objects, room)}
            selected={object.id === selectedObjectId}
            onSelect={() => onSelect(object.id)}
          />
        ))}
      </group>
    </Canvas>
  );
}

export default function Scene3D({ room, objects, selectedObjectId, onSelect }: Scene3DProps) {
  const cameraApiRef = useRef<CameraApi | null>(null);
  const [isReady, setIsReady] = useState(false);
  const handleReady = useCallback((api: CameraApi) => {
    cameraApiRef.current = api;
    setIsReady(true);
  }, []);

  return (
    <div className="scene-3d-inner">
      <Scene room={room} objects={objects} selectedObjectId={selectedObjectId} onSelect={onSelect} roomWidth={room.widthCm / 100} roomDepth={room.depthCm / 100} onReady={handleReady} />
      <div className="scene-controls" aria-label="Управление камерой">
        <button type="button" onClick={() => cameraApiRef.current?.reset()} disabled={!isReady} aria-label="Сбросить камеру">Сбросить</button>
        <button type="button" onClick={() => cameraApiRef.current?.fit()} disabled={!isReady} aria-label="Показать всё помещение">Показать всё</button>
      </div>
      <div className="scene-help">Перетаскивайте — вращение · колесо — масштаб · правая кнопка — панорама</div>
    </div>
  );
}
