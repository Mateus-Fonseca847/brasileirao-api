import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

describe("HTTP security", () => {
  let app: FastifyInstance;
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  const previousRateLimitMax = process.env.RATE_LIMIT_MAX;

  beforeAll(async () => {
    process.env.CORS_ORIGIN = "http://localhost:5173";
    process.env.RATE_LIMIT_MAX = "3";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (previousCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = previousCorsOrigin;
    }

    if (previousRateLimitMax === undefined) {
      delete process.env.RATE_LIMIT_MAX;
    } else {
      process.env.RATE_LIMIT_MAX = previousRateLimitMax;
    }

    await app.close();
    await prisma.$disconnect();
  });

  it("returns CORS headers for an allowed origin", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "http://localhost:5173",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("returns security headers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toBeDefined();
  });

  it("rate limits excessive requests", async () => {
    const responses = [];

    for (let requestIndex = 0; requestIndex < 4; requestIndex += 1) {
      responses.push(
        await app.inject({
          method: "GET",
          url: "/teams",
          remoteAddress: "192.0.2.10",
        }),
      );
    }

    expect(responses.at(-1)?.statusCode).toBe(429);
  });

  it("keeps existing routes working", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/seasons/2024",
      remoteAddress: "192.0.2.11",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      year: 2024,
      status: "FINISHED",
    });
  });
});
