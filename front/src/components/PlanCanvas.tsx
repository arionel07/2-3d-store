"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type { LayoutObject } from "../lib/types";

type PlanCanvasProps = {
  room: { widthCm: number; depthCm: number };
  objects: LayoutObject[];
  selectedObjectId: string | null;
  validity: Record<string, boolean>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xCm: number, yCm: number) => void;
};

const GRID_SIZE_CM = 50;

export default function PlanCanvas({
  room,
  objects,
  selectedObjectId,
  validity,
  onSelect,
  onMove,
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 760, height: 620 });

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

  const padding = 44;
  const scale = Math.min(
    (size.width - padding * 2) / room.widthCm,
    (size.height - padding * 2) / room.depthCm,
  );
  const roomWidth = room.widthCm * scale;
  const roomHeight = room.depthCm * scale;
  const roomX = (size.width - roomWidth) / 2;
  const roomY = (size.height - roomHeight) / 2;
  const gridLines = [];

  for (let x = 0; x <= room.widthCm; x += GRID_SIZE_CM) {
    gridLines.push(
      <Line
        key={`vertical-${x}`}
        points={[roomX + x * scale, roomY, roomX + x * scale, roomY + roomHeight]}
        stroke="#dce6ed"
        strokeWidth={x % 200 === 0 ? 1 : 0.6}
        listening={false}
      />,
    );
  }

  for (let y = 0; y <= room.depthCm; y += GRID_SIZE_CM) {
    gridLines.push(
      <Line
        key={`horizontal-${y}`}
        points={[roomX, roomY + y * scale, roomX + roomWidth, roomY + y * scale]}
        stroke="#dce6ed"
        strokeWidth={y % 200 === 0 ? 1 : 0.6}
        listening={false}
      />,
    );
  }

  return (
    <div className="plan-canvas" ref={containerRef}>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) {
            onSelect(null);
          }
        }}
      >
        <Layer>
          <Rect
            x={roomX}
            y={roomY}
            width={roomWidth}
            height={roomHeight}
            fill="#fbfdfe"
            stroke="#253748"
            strokeWidth={8}
            shadowColor="#a9bac6"
            shadowBlur={14}
            shadowOpacity={0.2}
          />
          {gridLines}
          <Text
            x={roomX}
            y={roomY - 27}
            text={`${room.widthCm} cm`}
            fill="#738392"
            fontSize={11}
            width={roomWidth}
            align="center"
          />
          <Text
            x={roomX - 38}
            y={roomY}
            text={`${room.depthCm} cm`}
            fill="#738392"
            fontSize={11}
            rotation={-90}
          />
          {objects.map((object) => {
            const isSelected = object.id === selectedObjectId;
            const isValid = validity[object.id] ?? true;
            const width = object.widthCm * scale;
            const depth = object.depthCm * scale;
            const centerX = roomX + (object.xCm + object.widthCm / 2) * scale;
            const centerY = roomY + (object.yCm + object.depthCm / 2) * scale;
            const color = isValid ? "#77c9bd" : "#ef8e7b";
            const fill = isValid ? "#d8f2ed" : "#ffe2dc";

            return (
              <Group
                key={object.id}
                x={centerX}
                y={centerY}
                offsetX={width / 2}
                offsetY={depth / 2}
                rotation={object.rotationDeg}
                draggable
                onClick={() => onSelect(object.id)}
                onTap={() => onSelect(object.id)}
                onDragEnd={(event) => {
                  const node = event.target;
                  onMove(
                    object.id,
                    Math.round((node.x() - roomX) / scale - object.widthCm / 2),
                    Math.round((node.y() - roomY) / scale - object.depthCm / 2),
                  );
                }}
              >
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={depth}
                  fill={fill}
                  stroke={isSelected ? "#0f766e" : color}
                  strokeWidth={isSelected ? 3 : 2}
                  cornerRadius={4}
                  shadowColor="#6c7d89"
                  shadowBlur={isSelected ? 10 : 4}
                  shadowOpacity={0.15}
                />
                <Text
                  x={0}
                  y={Math.max(5, depth / 2 - 7)}
                  text={object.name}
                  width={width}
                  align="center"
                  fill="#183247"
                  fontSize={Math.max(10, Math.min(14, width / 9))}
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
