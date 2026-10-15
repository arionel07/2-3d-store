import type { LayoutObject } from "./types";

type Point = { x: number; y: number };

export type LayoutMeasurements = {
  walls: {
    leftCm: number;
    rightCm: number;
    topCm: number;
    bottomCm: number;
  };
  nearestObjects: Array<{
    id: string;
    name: string;
    distanceCm: number;
  }>;
};

export function getObjectCorners(object: LayoutObject): Point[] {
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

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  const closest = {
    x: start.x + projection * dx,
    y: start.y + projection * dy,
  };

  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function orientation(first: Point, second: Point, third: Point) {
  return (
    (second.x - first.x) * (third.y - first.y) -
    (second.y - first.y) * (third.x - first.x)
  );
}

function onSegment(point: Point, start: Point, end: Point) {
  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}

function segmentsIntersect(
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (
    ((firstOrientation > 0 && secondOrientation < 0) ||
      (firstOrientation < 0 && secondOrientation > 0)) &&
    ((thirdOrientation > 0 && fourthOrientation < 0) ||
      (thirdOrientation < 0 && fourthOrientation > 0))
  ) {
    return true;
  }

  return (
    (firstOrientation === 0 && onSegment(secondStart, firstStart, firstEnd)) ||
    (secondOrientation === 0 && onSegment(secondEnd, firstStart, firstEnd)) ||
    (thirdOrientation === 0 && onSegment(firstStart, secondStart, secondEnd)) ||
    (fourthOrientation === 0 && onSegment(firstEnd, secondStart, secondEnd))
  );
}

function polygonDistance(first: Point[], second: Point[]) {
  if (polygonsOverlap(first, second)) {
    return 0;
  }

  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex]!;
    const firstEnd = first[(firstIndex + 1) % first.length]!;

    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondStart = second[secondIndex]!;
      const secondEnd = second[(secondIndex + 1) % second.length]!;

      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return 0;
      }

      shortestDistance = Math.min(
        shortestDistance,
        distanceToSegment(firstStart, secondStart, secondEnd),
        distanceToSegment(firstEnd, secondStart, secondEnd),
        distanceToSegment(secondStart, firstStart, firstEnd),
        distanceToSegment(secondEnd, firstStart, firstEnd),
      );
    }
  }

  return shortestDistance;
}

export function getLayoutMeasurements(
  object: LayoutObject,
  objects: LayoutObject[],
  room: { widthCm: number; depthCm: number },
): LayoutMeasurements {
  const corners = getObjectCorners(object);
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));

  return {
    walls: {
      leftCm: Math.max(0, minX),
      rightCm: Math.max(0, room.widthCm - maxX),
      topCm: Math.max(0, minY),
      bottomCm: Math.max(0, room.depthCm - maxY),
    },
    nearestObjects: objects
      .filter((other) => other.id !== object.id)
      .map((other) => ({
        id: other.id,
        name: other.name,
        distanceCm: polygonDistance(corners, getObjectCorners(other)),
      }))
      .sort((first, second) => first.distanceCm - second.distanceCm)
      .slice(0, 3),
  };
}

export function isObjectValid(
  object: LayoutObject,
  objects: LayoutObject[],
  room: { widthCm: number; depthCm: number },
) {
  const corners = getObjectCorners(object);
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

    return !polygonsOverlap(corners, getObjectCorners(other));
  });
}
