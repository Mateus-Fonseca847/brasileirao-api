import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

describe("season routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns persisted seasons ordered by year", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons",
    });
    const body = response.json<Array<Record<string, unknown>>>();

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(22);
    expect(body[0]?.year).toBe(2003);
    expect(body.at(-1)?.year).toBe(2024);
    expect(body[0]).not.toHaveProperty("id");
    expect(body[0]).not.toHaveProperty("createdAt");
    expect(body[0]).not.toHaveProperty("updatedAt");
  });

  it("returns a persisted season by year", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/2024",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      year: 2024,
      status: "FINISHED",
      startDate: null,
      endDate: null,
      teamsCount: null,
    });
  });

  it("returns not found when the season does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/9999",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Season not found.",
      statusCode: 404,
    });
  });

  it("returns bad request when the season year is text", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/abc",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Season year must be a valid integer.",
      statusCode: 400,
    });
  });

  it("returns bad request when the season year is decimal", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/2024.5",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Season year must be a valid integer.",
      statusCode: 400,
    });
  });

  it("returns bad request when the season year is below 2003", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/2002",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Season year must be greater than or equal to 2003.",
      statusCode: 400,
    });
  });
});
