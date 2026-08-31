import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, unknown>;
};

describe("OpenAPI documentation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("serves Swagger UI", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("serves the generated OpenAPI document", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });
    const body = response.json<OpenApiDocument>();

    expect(response.statusCode).toBe(200);
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info).toMatchObject({
      title: "Brasileirão API",
      version: "1.0.0",
    });
    expect(body.info.description).toContain("Campeonato Brasileiro Série A");
  });

  it("documents the current public routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });
    const body = response.json<OpenApiDocument>();

    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        "/health",
        "/seasons",
        "/seasons/{year}",
        "/seasons/{year}/teams",
        "/seasons/{year}/standings",
        "/teams",
        "/teams/{slug}",
        "/matches",
        "/matches/{id}",
        "/matches/{id}/stats",
      ]),
    );
  });
});
