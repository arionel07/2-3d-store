"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { getObjectCorners, type LayoutMeasurements } from "../lib/geometry";
import type { LayoutObject } from "../lib/types";

type PlanCanvasProps = {
  room: { widthCm: number; depthCm: number };
  objects: LayoutObject[];
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  validity: Record<string, boolean>;
  measurements: LayoutMeasurements | null;
  showMeasurements: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xCm: number, yCm: number) => void;
};

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

type PinchState = {
  distance: number;
  center: { x: number; y: number };
  viewport: Viewport;
};

const GRID_SIZE_CM = 50;
const MIN_SCALE_MULTIPLIER = 0.35;
const MAX_SCALE_MULTIPLIER = 5;

function getTouchCenter(first: Touch, second: Touch, rect: DOMRect) {
  return {
    x: (first.clientX + second.clientX) / 2 - rect.left,
    y: (first.clientY + second.clientY) / 2 - rect.top,
  };
}

function getTouchDistance(first: Touch, second: Touch) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function formatDistance(valueCm: number) {
  const rounded = Math.round(valueCm * 10) / 10;
  if (rounded >= 100) {
    return `${rounded.toLocaleString("ru-RU")} см (${(rounded / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м)`;
  }
  return `${rounded.toLocaleString("ru-RU")} см`;
}

function formatRoomDimension(valueCm: number) {
  return `${(valueCm / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м`;
}

export default function PlanCanvas({
  room,
  objects,
  selectedObjectId,
  selectedObjectIds,
  validity,
  measurements,
  showMeasurements,
  onSelect,
  onMove,
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const [size, setSize] = useState({ width: 760, height: 620 });
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 44, y: 44 });

  const getFitViewport = useCallback(() => {
    const padding = size.width < 560 ? 44 : 120;
    const scale = Math.min(
      (size.width - padding * 2) / room.widthCm,
      (size.height - padding * 2) / room.depthCm,
    );

    return {
      scale: Math.max(0.01, scale),
      x: (size.width - room.widthCm * scale) / 2,
      y: (size.height - room.depthCm * scale) / 2,
    };
  }, [room.depthCm, room.widthCm, size.height, size.width]);

  const fitRoom = useCallback(() => {
    setViewport(getFitViewport());
  }, [getFitViewport]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setSize({
        width: Math.max(280, container.clientWidth),
        height: Math.max(360, container.clientHeight),
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fitRoom();
  }, [fitRoom]);

  function handleWheel(event: { evt: WheelEvent }) {
    event.evt.preventDefault();
  }

  function zoomAt(requestedScale: number, point: { x: number; y: number }) {
    const fitScale = getFitViewport().scale;
    const nextScale = Math.min(
      fitScale * MAX_SCALE_MULTIPLIER,
      Math.max(fitScale * MIN_SCALE_MULTIPLIER, requestedScale),
    );
    const worldPoint = {
      x: (point.x - viewport.x) / viewport.scale,
      y: (point.y - viewport.y) / viewport.scale,
    };

    setViewport({
      scale: nextScale,
      x: point.x - worldPoint.x * nextScale,
      y: point.y - worldPoint.y * nextScale,
    });
  }

  function zoomBy(factor: number) {
    zoomAt(viewport.scale * factor, { x: size.width / 2, y: size.height / 2 });
  }

  function startCanvasPan(event: { target: { getStage: () => any; name: () => string }; evt: MouseEvent | TouchEvent }) {
    const stage = event.target.getStage();
    const targetName = event.target.name();
    if (!stage || (event.target !== stage && targetName !== "room-background")) {
      return;
    }

    if ("button" in event.evt && event.evt.button !== 0) {
      return;
    }

    event.evt.preventDefault();
    onSelect(null);
    stage.startDrag();
  }

  function finishCanvasPan(event: { target: { getStage: () => any } }) {
    const stage = event.target.getStage();
    if (!stage) return;
    setViewport((current) => ({ ...current, x: stage.x(), y: stage.y() }));
  }

  function handleTouchStart(event: { evt: TouchEvent; target: { getStage: () => any } }) {
    if (event.evt.touches.length === 1) {
      startCanvasPan(event as { target: { getStage: () => any; name: () => string }; evt: TouchEvent });
      return;
    }

    if (event.evt.touches.length !== 2 || !containerRef.current) {
      return;
    }

    event.evt.preventDefault();
    event.target.getStage()?.stopDrag();
    const [first, second] = Array.from(event.evt.touches);
    const rect = containerRef.current.getBoundingClientRect();
    pinchRef.current = {
      distance: getTouchDistance(first!, second!),
      center: getTouchCenter(first!, second!, rect),
      viewport,
    };
  }

  function handleTouchMove(event: { evt: TouchEvent }) {
    if (event.evt.touches.length !== 2 || !pinchRef.current || !containerRef.current) {
      return;
    }

    event.evt.preventDefault();
    const [first, second] = Array.from(event.evt.touches);
    const distance = getTouchDistance(first!, second!);
    const initial = pinchRef.current;
    const fitScale = getFitViewport().scale;
    const nextScale = Math.min(
      fitScale * MAX_SCALE_MULTIPLIER,
      Math.max(fitScale * MIN_SCALE_MULTIPLIER, initial.viewport.scale * (distance / initial.distance)),
    );
    const worldPoint = {
      x: (initial.center.x - initial.viewport.x) / initial.viewport.scale,
      y: (initial.center.y - initial.viewport.y) / initial.viewport.scale,
    };

    setViewport({
      scale: nextScale,
      x: initial.center.x - worldPoint.x * nextScale,
      y: initial.center.y - worldPoint.y * nextScale,
    });
  }

  function handleTouchEnd() {
    pinchRef.current = null;
  }

  const selectedObject = objects.find((object) => object.id === selectedObjectId);
  const selectedCorners = selectedObject ? getObjectCorners(selectedObject) : [];
  const selectedBounds = selectedCorners.length > 0
    ? {
        minX: Math.min(...selectedCorners.map((point) => point.x)),
        maxX: Math.max(...selectedCorners.map((point) => point.x)),
        minY: Math.min(...selectedCorners.map((point) => point.y)),
        maxY: Math.max(...selectedCorners.map((point) => point.y)),
      }
    : null;
  const labelFontSize = 11 / viewport.scale;
  const lineWidth = 1 / viewport.scale;
  const gridLines = [];

  for (let x = 0; x <= room.widthCm; x += GRID_SIZE_CM) {
    gridLines.push(
      <Line
        key={`vertical-${x}`}
        points={[x, 0, x, room.depthCm]}
        stroke="#e8edef"
        strokeWidth={(x % 200 === 0 ? 1 : 0.6) / viewport.scale}
        listening={false}
      />,
    );
  }

  for (let y = 0; y <= room.depthCm; y += GRID_SIZE_CM) {
    gridLines.push(
      <Line
        key={`horizontal-${y}`}
        points={[0, y, room.widthCm, y]}
        stroke="#e8edef"
        strokeWidth={(y % 200 === 0 ? 1 : 0.6) / viewport.scale}
        listening={false}
      />,
    );
  }

  const measurementLines = measurements && selectedBounds && showMeasurements
    ? [
        {
          key: "left",
          points: [0, (selectedBounds.minY + selectedBounds.maxY) / 2, selectedBounds.minX, (selectedBounds.minY + selectedBounds.maxY) / 2],
          label: formatDistance(measurements.walls.leftCm),
          x: measurements.walls.leftCm / 2,
          y: (selectedBounds.minY + selectedBounds.maxY) / 2,
        },
        {
          key: "right",
          points: [selectedBounds.maxX, (selectedBounds.minY + selectedBounds.maxY) / 2, room.widthCm, (selectedBounds.minY + selectedBounds.maxY) / 2],
          label: formatDistance(measurements.walls.rightCm),
          x: selectedBounds.maxX + measurements.walls.rightCm / 2,
          y: (selectedBounds.minY + selectedBounds.maxY) / 2,
        },
        {
          key: "top",
          points: [(selectedBounds.minX + selectedBounds.maxX) / 2, 0, (selectedBounds.minX + selectedBounds.maxX) / 2, selectedBounds.minY],
          label: formatDistance(measurements.walls.topCm),
          x: (selectedBounds.minX + selectedBounds.maxX) / 2,
          y: measurements.walls.topCm / 2,
        },
        {
          key: "bottom",
          points: [(selectedBounds.minX + selectedBounds.maxX) / 2, selectedBounds.maxY, (selectedBounds.minX + selectedBounds.maxX) / 2, room.depthCm],
          label: formatDistance(measurements.walls.bottomCm),
          x: (selectedBounds.minX + selectedBounds.maxX) / 2,
          y: selectedBounds.maxY + measurements.walls.bottomCm / 2,
        },
      ]
    : [];

  return (
    <div className="plan-canvas" ref={containerRef}>
      <Stage
        width={size.width}
        height={size.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable
        onMouseDown={(event) => {
          startCanvasPan(event as { target: { getStage: () => any; name: () => string }; evt: MouseEvent });
        }}
        onDragEnd={finishCanvasPan}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Layer>
          <Rect
            name="room-background"
            x={0}
            y={0}
            width={room.widthCm}
            height={room.depthCm}
            fill="#fbfdfe"
            stroke="#253748"
            strokeWidth={8 / viewport.scale}
            shadowColor="#a9bac6"
            shadowBlur={14 / viewport.scale}
            shadowOpacity={0.2}
          />
          {gridLines}
          <Text
            x={0}
            y={-27 / viewport.scale}
            text={formatRoomDimension(room.widthCm)}
            fill="#738392"
            fontSize={labelFontSize}
            width={room.widthCm}
            align="center"
          />
          <Text
            x={-38 / viewport.scale}
            y={0}
            text={formatRoomDimension(room.depthCm)}
            fill="#738392"
            fontSize={labelFontSize}
            rotation={-90}
          />
          {objects.map((object) => {
            const isSelected = selectedObjectIds.includes(object.id);
            const isValid = validity[object.id] ?? true;
            const color = isValid ? "#7b878c" : "#df6f5f";
            const fill = isValid ? "#f4f6f6" : "#fff0ed";

            return (
              <Group
                key={object.id}
                x={object.xCm + object.widthCm / 2}
                y={object.yCm + object.depthCm / 2}
                offsetX={object.widthCm / 2}
                offsetY={object.depthCm / 2}
                rotation={object.rotationDeg}
                draggable
                onClick={() => onSelect(object.id)}
                onTap={() => onSelect(object.id)}
                onDragEnd={(event) => {
                  const node = event.target;
                  onMove(
                    object.id,
                    Math.round(node.x() - object.widthCm / 2),
                    Math.round(node.y() - object.depthCm / 2),
                  );
                }}
              >
                <Rect
                  x={0}
                  y={0}
                  width={object.widthCm}
                  height={object.depthCm}
                  fill={fill}
                  stroke={isSelected ? "#f0ba22" : color}
                  strokeWidth={(isSelected ? 3 : 2) / viewport.scale}
                  cornerRadius={4 / viewport.scale}
                  shadowColor="#6c7d89"
                  shadowBlur={isSelected ? 10 / viewport.scale : 4 / viewport.scale}
                  shadowOpacity={0.15}
                />
                <Text
                  x={0}
                  y={Math.max(5 / viewport.scale, object.depthCm / 2 - 7 / viewport.scale)}
                  text={object.name}
                  width={object.widthCm}
                  align="center"
                  fill="#183247"
                  fontSize={Math.max(10 / viewport.scale, Math.min(14 / viewport.scale, object.widthCm / 9))}
                  listening={false}
                />
                {isSelected && [
                  [0, 0],
                  [object.widthCm, 0],
                  [object.widthCm, object.depthCm],
                  [0, object.depthCm],
                ].map(([x, y], index) => (
                  <Rect
                    key={`handle-${index}`}
                    x={x - 4 / viewport.scale}
                    y={y - 4 / viewport.scale}
                    width={8 / viewport.scale}
                    height={8 / viewport.scale}
                    fill="#f0ba22"
                    stroke="#ffffff"
                    strokeWidth={1 / viewport.scale}
                    listening={false}
                  />
                ))}
              </Group>
            );
          })}
          {measurementLines.map((measurement) => (
            <Group key={measurement.key} listening={false}>
              <Line
                points={measurement.points}
                stroke="#7b8d98"
                strokeWidth={lineWidth}
                dash={[4 / viewport.scale, 4 / viewport.scale]}
              />
              <Text
                x={measurement.x - 36 / viewport.scale}
                y={measurement.y - 8 / viewport.scale}
                width={72 / viewport.scale}
                text={measurement.label}
                align="center"
                fill="#526979"
                fontSize={9 / viewport.scale}
              />
            </Group>
          ))}
        </Layer>
      </Stage>
      <div className="canvas-zoom-controls" aria-label="Масштаб холста">
        <button type="button" onClick={() => zoomBy(0.9)} aria-label="Уменьшить масштаб">−</button>
        <button type="button" className="canvas-zoom-value" onClick={fitRoom} aria-label="Показать всё помещение" title="Показать всё помещение">{Math.round((viewport.scale / getFitViewport().scale) * 100)}%</button>
        <button type="button" onClick={() => zoomBy(1.1)} aria-label="Увеличить масштаб">+</button>
      </div>
    </div>
  );
}
