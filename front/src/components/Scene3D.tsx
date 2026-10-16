"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TOUCH, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { Maximize2, Minus, Plus, RotateCw } from "lucide-react";
import type { LayoutObject } from "../lib/types";
import { isObjectValid } from "../lib/geometry";

type Scene3DProps = {
  room: { widthCm: number; depthCm: number };
  objects: LayoutObject[];
  hiddenObjectIds: string[];
  selectedObjectId: string | null;
  onSelect: (id: string | null) => void;
};

type CameraApi = {
  reset: () => void;
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type CameraControlsProps = {
  roomWidth: number;
  roomDepth: number;
  onReady: (api: CameraApi) => void;
  onZoomChange: (zoomPercent: number) => void;
};

const cameraDirection = new Vector3(0.34, 1.08, 1.28).normalize();

function CameraControls({ roomWidth, roomDepth, onReady, onZoomChange }: CameraControlsProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const fitDistanceRef = useRef<number | null>(null);

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
    fitDistanceRef.current = distance;
    perspectiveCamera.near = Math.max(0.05, distance / 100);
    perspectiveCamera.far = Math.max(100, Math.max(roomWidth, roomDepth) * 8);
    perspectiveCamera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
    onZoomChange(100);
  }, [getPerspectiveCamera, onZoomChange, roomDepth, roomWidth]);

  const resetCamera = useCallback(() => {
    fitCamera();
  }, [fitCamera]);

  const zoomBy = useCallback((factor: number) => {
    const controls = controlsRef.current;
    const perspectiveCamera = getPerspectiveCamera();
    const fitDistance = fitDistanceRef.current;

    if (!controls || !fitDistance) return;

    const offset = perspectiveCamera.position.clone().sub(controls.target);
    const nextDistance = MathUtils.clamp(
      offset.length() * factor,
      controls.minDistance,
      controls.maxDistance,
    );

    perspectiveCamera.position.copy(controls.target).add(offset.normalize().multiplyScalar(nextDistance));
    controls.update();
    onZoomChange(Math.round((fitDistance / nextDistance) * 100));
  }, [getPerspectiveCamera, onZoomChange]);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    const maxDimension = Math.max(roomWidth, roomDepth);
    const maxPan = maxDimension * 0.65;

    // The editor needs a stable camera after a gesture. Inertia keeps moving
    // the bounded target after the pointer is released and looks like jitter.
    controls.enableDamping = false;
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
    onReady({
      reset: resetCamera,
      fit: fitCamera,
      zoomIn: () => zoomBy(0.82),
      zoomOut: () => zoomBy(1.22),
    });

    return () => {
      controls.removeEventListener("change", clampTarget);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, fitCamera, gl, onReady, resetCamera, roomDepth, roomWidth, zoomBy]);

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
  const wallColor = "#c8cecc";
  const wallCapColor = "#7d8582";

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
      <mesh position={[width / 2, wallHeight - 0.045, 0]} castShadow>
        <boxGeometry args={[width + wallThickness, 0.09, wallThickness * 1.08]} />
        <meshStandardMaterial color={wallCapColor} roughness={0.62} />
      </mesh>
      <mesh position={[width / 2, wallHeight / 2, depth]} castShadow receiveShadow>
        <boxGeometry args={[width + wallThickness, wallHeight, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[width / 2, wallHeight - 0.045, depth]} castShadow>
        <boxGeometry args={[width + wallThickness, 0.09, wallThickness * 1.08]} />
        <meshStandardMaterial color={wallCapColor} roughness={0.62} />
      </mesh>
      <mesh position={[0, wallHeight / 2, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[0, wallHeight - 0.045, depth / 2]} castShadow>
        <boxGeometry args={[wallThickness * 1.08, 0.09, depth]} />
        <meshStandardMaterial color={wallCapColor} roughness={0.62} />
      </mesh>
      <mesh position={[width, wallHeight / 2, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[width, wallHeight - 0.045, depth / 2]} castShadow>
        <boxGeometry args={[wallThickness * 1.08, 0.09, depth]} />
        <meshStandardMaterial color={wallCapColor} roughness={0.62} />
      </mesh>
    </group>
  );
}

function ShelfModel({ width, depth, height, surfaceColor, trimColor }: { width: number; depth: number; height: number; surfaceColor: string; trimColor: string }) {
  const baseHeight = Math.max(0.09, height * 0.1);
  const shelfHeight = Math.max(0.025, Math.min(height * 0.035, 0.075));
  const sideWidth = Math.max(0.045, width * 0.045);

  return (
    <>
      <mesh position={[0, baseHeight / 2, 0]} castShadow>
        <boxGeometry args={[width, baseHeight, depth]} />
        <meshStandardMaterial color={trimColor} roughness={0.62} />
      </mesh>
      <mesh position={[0, height * 0.53, -depth * 0.39]} castShadow>
        <boxGeometry args={[width * 0.92, height * 0.78, depth * 0.08]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.55} />
      </mesh>
      {([0.32, 0.56, 0.8] as const).map((level) => (
        <mesh key={level} position={[0, height * level, depth * 0.04]} castShadow>
          <boxGeometry args={[width * 0.9, shelfHeight, depth * 0.78]} />
          <meshStandardMaterial color={surfaceColor} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[-width * 0.43, height * 0.52, 0]} castShadow>
        <boxGeometry args={[sideWidth, height * 0.82, depth * 0.86]} />
        <meshStandardMaterial color={trimColor} roughness={0.58} />
      </mesh>
      <mesh position={[width * 0.43, height * 0.52, 0]} castShadow>
        <boxGeometry args={[sideWidth, height * 0.82, depth * 0.86]} />
        <meshStandardMaterial color={trimColor} roughness={0.58} />
      </mesh>
    </>
  );
}

function CheckoutModel({ width, depth, height, surfaceColor, trimColor }: { width: number; depth: number; height: number; surfaceColor: string; trimColor: string }) {
  const counterHeight = Math.max(0.12, height * 0.72);
  const topHeight = Math.max(0.04, height * 0.07);

  return (
    <>
      <mesh position={[0, counterHeight / 2, 0]} castShadow>
        <boxGeometry args={[width * 0.9, counterHeight, depth * 0.9]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.56} />
      </mesh>
      <mesh position={[0, counterHeight + topHeight / 2, 0]} castShadow>
        <boxGeometry args={[width, topHeight, depth]} />
        <meshStandardMaterial color={trimColor} roughness={0.48} />
      </mesh>
      <mesh position={[0, height * 0.91, -depth * 0.04]} castShadow>
        <boxGeometry args={[width * 0.22, height * 0.12, depth * 0.32]} />
        <meshStandardMaterial color="#727b7a" roughness={0.42} />
      </mesh>
      <mesh position={[0, height * 0.98, -depth * 0.04]} castShadow>
        <boxGeometry args={[width * 0.3, Math.max(0.025, height * 0.025), depth * 0.18]} />
        <meshStandardMaterial color="#aab3b1" roughness={0.45} />
      </mesh>
    </>
  );
}

function DisplayModel({ width, depth, height, surfaceColor, trimColor }: { width: number; depth: number; height: number; surfaceColor: string; trimColor: string }) {
  const shelfHeight = Math.max(0.025, Math.min(height * 0.03, 0.06));
  const sideWidth = Math.max(0.035, width * 0.035);

  return (
    <>
      <mesh position={[0, height * 0.5, -depth * 0.39]} castShadow>
        <boxGeometry args={[width * 0.92, height * 0.94, depth * 0.08]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.48} />
      </mesh>
      {([0.22, 0.47, 0.72] as const).map((level) => (
        <mesh key={level} position={[0, height * level, depth * 0.02]} castShadow>
          <boxGeometry args={[width * 0.9, shelfHeight, depth * 0.78]} />
          <meshStandardMaterial color={surfaceColor} roughness={0.46} />
        </mesh>
      ))}
      <mesh position={[-width * 0.43, height * 0.48, 0]} castShadow>
        <boxGeometry args={[sideWidth, height * 0.94, depth * 0.86]} />
        <meshStandardMaterial color={trimColor} roughness={0.48} />
      </mesh>
      <mesh position={[width * 0.43, height * 0.48, 0]} castShadow>
        <boxGeometry args={[sideWidth, height * 0.94, depth * 0.86]} />
        <meshStandardMaterial color={trimColor} roughness={0.48} />
      </mesh>
      <mesh position={[0, height * 0.95, 0]} castShadow>
        <boxGeometry args={[width * 0.94, shelfHeight * 1.25, depth * 0.86]} />
        <meshStandardMaterial color={trimColor} roughness={0.45} />
      </mesh>
    </>
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
  const surfaceColor = valid ? "#f5f7f6" : "#ffd9d2";
  const trimColor = valid ? "#b9c3c1" : "#dd7768";

  return (
    <group
      position={[(object.xCm + object.widthCm / 2) / 100, 0, (object.yCm + object.depthCm / 2) / 100]}
      rotation={[0, (-object.rotationDeg * Math.PI) / 180, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {object.type === "shelf" && <ShelfModel width={width} depth={depth} height={height} surfaceColor={surfaceColor} trimColor={trimColor} />}
      {object.type === "checkout" && <CheckoutModel width={width} depth={depth} height={height} surfaceColor={surfaceColor} trimColor={trimColor} />}
      {object.type === "display" && <DisplayModel width={width} depth={depth} height={height} surfaceColor={surfaceColor} trimColor={trimColor} />}
      {selected && (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width * 1.01, height * 1.01, depth * 1.01]} />
          <meshBasicMaterial color="#f1ba22" wireframe transparent opacity={1} />
        </mesh>
      )}
    </group>
  );
}

function Scene({ room, objects, hiddenObjectIds, selectedObjectId, onSelect, onReady, onZoomChange }: Scene3DProps & CameraControlsProps) {
  const roomWidth = room.widthCm / 100;
  const roomDepth = room.depthCm / 100;
  const maxDimension = Math.max(roomWidth, roomDepth);

  return (
    <Canvas
      camera={{ position: [maxDimension * 0.9, maxDimension * 1.1, maxDimension * 1.15], fov: 42 }}
      shadows
      gl={{ antialias: true }}
      style={{ background: "#ffffff" }}
      onPointerMissed={() => onSelect(null)}
    >
      <CameraControls roomWidth={roomWidth} roomDepth={roomDepth} onReady={onReady} onZoomChange={onZoomChange} />
      <ambientLight intensity={1.9} />
      <directionalLight castShadow position={[5, 11, 6]} intensity={2.4} shadow-mapSize={[1024, 1024]} />
      <group position={[-roomWidth / 2, 0, -roomDepth / 2]}>
        <Room width={roomWidth} depth={roomDepth} />
        {objects.map((object) => hiddenObjectIds.includes(object.id) ? null : (
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

export default function Scene3D({ room, objects, hiddenObjectIds, selectedObjectId, onSelect }: Scene3DProps) {
  const cameraApiRef = useRef<CameraApi | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const handleReady = useCallback((api: CameraApi) => {
    cameraApiRef.current = api;
    setIsReady(true);
  }, []);

  return (
    <div className="scene-3d-inner">
      <Scene room={room} objects={objects} hiddenObjectIds={hiddenObjectIds} selectedObjectId={selectedObjectId} onSelect={onSelect} roomWidth={room.widthCm / 100} roomDepth={room.depthCm / 100} onReady={handleReady} onZoomChange={setZoomPercent} />
      <div className="scene-dimension scene-dimension-width" aria-hidden="true"><span>{formatDimension(room.widthCm)} м</span></div>
      <div className="scene-dimension scene-dimension-depth" aria-hidden="true"><span>{formatDimension(room.depthCm)} м</span></div>
      <div className="scene-controls" aria-label="Управление камерой">
        <button type="button" onClick={() => cameraApiRef.current?.reset()} disabled={!isReady} aria-label="Сбросить камеру" title="Сбросить камеру"><RotateCw aria-hidden="true" /></button>
        <div className="scene-zoom-controls" aria-label="Масштаб 3D-сцены">
          <button type="button" onClick={() => cameraApiRef.current?.zoomOut()} disabled={!isReady} aria-label="Уменьшить масштаб"><Minus aria-hidden="true" /></button>
          <span>{zoomPercent}%</span>
          <button type="button" onClick={() => cameraApiRef.current?.zoomIn()} disabled={!isReady} aria-label="Увеличить масштаб"><Plus aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={() => cameraApiRef.current?.fit()} disabled={!isReady} aria-label="Показать всё помещение" title="Показать всё помещение"><Maximize2 aria-hidden="true" /></button>
      </div>
      <div className="scene-help">Перетащите, чтобы повернуть</div>
    </div>
  );
}

function formatDimension(valueCm: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(valueCm / 100);
}
