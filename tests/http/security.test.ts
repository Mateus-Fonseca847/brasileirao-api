import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

describe("HTTP security", () => {
  let app: FastifyInstance | undefined;
  let previousCorsOrigin: string | undefined;
  let previousRateLimitMax: string | undefined;

  beforeEach(() => {
    previousCorsOrigin = process.env.CORS_ORIGIN;
    previousRateLimitMax = process.env.RATE_LIMIT_MAX;
    process.env.RATE_LIMIT_MAX = "3";
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;

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

    await prisma.$disconnect();
  });

  async function buildSecurityTestApp(corsOrigin: string): Promise<FastifyInstance> {
    process.env.CORS_ORIGIN = corsOrigin;
    app = await buildApp();
    await app.ready();

    return app;
  }

  it("returns CORS headers for an allowed restricted origin", async () => {
    const testApp = await buildSecurityTestApp("http://localhost:5173");
    const response = await testApp.inject({
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

  it("does not return CORS headers for a disallowed restricted origin", async () => {
    const testApp = await buildSecurityTestApp("http://localhost:5173");
    const response = await testApp.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://example.com",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns wildcard CORS headers for an arbitrary origin", async () => {
    const testApp = await buildSecurityTestApp("*");
    const response = await testApp.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://arbitrary.example",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("handles wildcard CORS preflight requests", async () => {
    const testApp = await buildSecurityTestApp("*");
    const response = await testApp.inject({
      method: "OPTIONS",
      url: "/teams",
      headers: {
        origin: "https://arbitrary.example",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("returns security headers", async () => {
    const testApp = await buildSecurityTestApp("http://localhost:5173");
    const response = await testApp.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toBeDefined();
  });

  it("rate limits excessive requests", async () => {
    const testApp = await buildSecurityTestApp("http://localhost:5173");
    const responses = [];

    for (let requestIndex = 0; requestIndex < 4; requestIndex += 1) {
      responses.push(
        await testApp.inject({
          method: "GET",
          url: "/teams",
          remoteAddress: "192.0.2.10",
        }),
      );
    }

    expect(responses.at(-1)?.statusCode).toBe(429);
  });

  it("keeps existing routes working", async () => {
    const testApp = await buildSecurityTestApp("http://localhost:5173");
    const response = await testApp.inject({
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
