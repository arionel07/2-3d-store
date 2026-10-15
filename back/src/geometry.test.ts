import { describe, expect, test } from "bun:test";
import { validateLayoutObjects } from "./geometry.ts";

const room = { widthCm: 1000, depthCm: 800 };

function object(overrides: Partial<Parameters<typeof validateLayoutObjects>[0][number]> = {}) {
  return {
    id: "object-1",
    name: "Shelf",
    xCm: 100,
    yCm: 100,
    widthCm: 200,
    depthCm: 80,
    rotationDeg: 0,
    ...overrides,
  };
}

describe("layout object geometry", () => {
  test("accepts objects that fit without overlap", () => {
    const problems = validateLayoutObjects([
      object(),
      object({ id: "object-2", name: "Checkout", xCm: 500 }),
    ], room);

    expect(problems).toEqual([]);
  });

  test("reports an object outside the room", () => {
    const problems = validateLayoutObjects(
      [object({ xCm: 900 })],
      room,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      code: "out_of_bounds",
      objectIds: ["object-1"],
    });
  });

  test("reports overlapping objects", () => {
    const problems = validateLayoutObjects([
      object(),
      object({ id: "object-2", name: "Display", xCm: 250 }),
    ], room);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      code: "overlap",
      objectIds: ["object-1", "object-2"],
    });
  });

  test("uses the rotated corners for room bounds", () => {
    const problems = validateLayoutObjects(
      [object({ xCm: 0, yCm: 100, depthCm: 100, rotationDeg: 45 })],
      { widthCm: 300, depthCm: 300 },
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]!.code).toBe("out_of_bounds");
  });
});
