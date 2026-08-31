import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

describe("team routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns canonical teams ordered by name", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/teams",
    });
    const body = response.json<Array<Record<string, unknown>>>();
    const names = body.map((team) => team.name as string);
    const sortedNames = [...names].sort();

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(44);
    expect(names).toEqual(sortedNames);
    expect(Object.keys(body[0] ?? {}).sort()).toEqual([
      "name",
      "shortName",
      "slug",
      "state",
    ]);
    expect(body[0]).not.toHaveProperty("id");
    expect(body[0]).not.toHaveProperty("createdAt");
    expect(body[0]).not.toHaveProperty("updatedAt");
  });

  it("returns a canonical team by slug", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/teams/flamengo",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      slug: "flamengo",
      name: "Flamengo",
      shortName: null,
      state: null,
    });
  });

  it("returns not found for an unknown valid team slug", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/teams/unknown-team",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Team not found.",
      statusCode: 404,
    });
  });

  it("returns bad request for a malformed team slug", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/teams/Flamengo",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Team slug must be a lowercase kebab-case string.",
      statusCode: 400,
    });
  });
});
