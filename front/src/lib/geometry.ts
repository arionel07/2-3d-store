import type { LayoutObject } from "./types";

type Point = { x: number; y: number };

function getCorners(object: LayoutObject): Point[] {
  const radians = (object.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const center = {
    x: object.xCm + object.widthCm / 2,
    y: object.yCm + object.depthCm / 2,
  };

  return [
    { x: -object.widthCm / 2, y: -object.depthCm / 2 },
    { x: object.widthCm / 2, y: -object.depthCm / 2 },
    { x: object.widthCm / 2, y: object.depthCm / 2 },
    { x: -object.widthCm / 2, y: object.depthCm / 2 },
  ].map((point) => ({
    x: center.x + point.x * cos - point.y * sin,
    y: center.y + point.x * sin + point.y * cos,
  }));
}

function getAxes(polygon: Point[]) {
  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const edge = { x: next.x - point.x, y: next.y - point.y };
    return { x: -edge.y, y: edge.x };
  });
}

function project(polygon: Point[], axis: Point) {
  return polygon.reduce(
    (range, point) => {
      const value = point.x * axis.x + point.y * axis.y;
      return {
        min: Math.min(range.min, value),
        max: Math.max(range.max, value),
      };
    },
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
  );
}

function polygonsOverlap(first: Point[], second: Point[]) {
  for (const axis of [...getAxes(first), ...getAxes(second)]) {
    const firstRange = project(first, axis);
    const secondRange = project(second, axis);

    if (firstRange.max <= secondRange.min || secondRange.max <= firstRange.min) {
      return false;
    }
  }

  return true;
}

export function isObjectValid(
  object: LayoutObject,
  objects: LayoutObject[],
  room: { widthCm: number; depthCm: number },
) {
  const corners = getCorners(object);
  const insideRoom = corners.every(
    (point) =>
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= room.widthCm &&
      point.y <= room.depthCm,
  );

  if (!insideRoom) {
    return false;
  }

  return objects.every((other) => {
    if (other.id === object.id) {
      return true;
    }

    return !polygonsOverlap(corners, getCorners(other));
  });
}
