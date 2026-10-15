export type GeometryObject = {
  id?: string;
  name: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotationDeg: number;
};

type Point = { x: number; y: number };
type Room = { widthCm: number; depthCm: number };

export type LayoutObjectProblem = {
  code: "out_of_bounds" | "overlap";
  objectIds: string[];
  message: string;
};

function getObjectReference(object: GeometryObject, index: number) {
  return object.id ?? `index:${index}`;
}

function getCorners(object: GeometryObject): Point[] {
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
    const next = polygon[(index + 1) % polygon.length]!;
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

    // Equal projections only touch at an edge or corner and are not overlap.
    if (firstRange.max <= secondRange.min || secondRange.max <= firstRange.min) {
      return false;
    }
  }

  return true;
}

export function validateLayoutObjects(
  objects: GeometryObject[],
  room: Room,
): LayoutObjectProblem[] {
  const corners = objects.map(getCorners);
  const problems: LayoutObjectProblem[] = [];

  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index]!;
    const insideRoom = corners[index]!.every(
      (point) =>
        point.x >= 0 &&
        point.y >= 0 &&
        point.x <= room.widthCm &&
        point.y <= room.depthCm,
    );

    if (!insideRoom) {
      const objectId = getObjectReference(object, index);
      problems.push({
        code: "out_of_bounds",
        objectIds: [objectId],
        message: `Object "${object.name}" (${objectId}) is outside the room bounds.`,
      });
    }
  }

  for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < objects.length;
      secondIndex += 1
    ) {
      if (!polygonsOverlap(corners[firstIndex]!, corners[secondIndex]!)) {
        continue;
      }

      const first = objects[firstIndex]!;
      const second = objects[secondIndex]!;
      const firstId = getObjectReference(first, firstIndex);
      const secondId = getObjectReference(second, secondIndex);
      problems.push({
        code: "overlap",
        objectIds: [firstId, secondId],
        message: `Objects "${first.name}" (${firstId}) and "${second.name}" (${secondId}) overlap.`,
      });
    }
  }

  return problems;
}
