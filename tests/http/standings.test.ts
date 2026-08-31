import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

describe("standing routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it.each([
    [2003, 24],
    [2005, 22],
    [2024, 20],
  ])("returns %i season standings", async (year, expectedRows) => {
    const response = await app.inject({
      method: "GET",
      url: `/seasons/${year}/standings`,
    });
    const body = response.json<Array<Record<string, unknown>>>();
    const positions = body.map((standing) => standing.position as number);
    const sortedPositions = [...positions].sort((first, second) => first - second);

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(expectedRows);
    expect(positions).toEqual(sortedPositions);
    expect(positions[0]).toBe(1);
    expect(positions.at(-1)).toBe(expectedRows);
    expect(body[0]).toHaveProperty("pointsAdjustment");
    expect(Object.keys(body[0] ?? {}).sort()).toEqual([
      "draws",
      "goalDifference",
      "goalsAgainst",
      "goalsFor",
      "losses",
      "played",
      "points",
      "pointsAdjustment",
      "position",
      "team",
      "wins",
    ]);
    expect(body[0]).not.toHaveProperty("id");
    expect(body[0]).not.toHaveProperty("createdAt");
    expect(body[0]).not.toHaveProperty("updatedAt");
    expect(body[0]?.team).not.toHaveProperty("id");
    expect(body[0]?.team).not.toHaveProperty("createdAt");
    expect(body[0]?.team).not.toHaveProperty("updatedAt");
  });

  it("returns not found for standings from a missing season", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/9999/standings",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Season not found.",
      statusCode: 404,
    });
  });

  it("returns bad request for standings from an invalid season year", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/abc/standings",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Season year must be a valid integer.",
      statusCode: 400,
    });
  });
});
