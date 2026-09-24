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
  paths: Record<string, Record<string, unknown>>;
};

type OpenApiOperation = {
  summary?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string }>;
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown }> }
  >;
};

// Métodos HTTP que o OpenAPI reconhece como operação de um path.
const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

// O @fastify/swagger em modo dinâmico gera os paths a partir das próprias
// rotas registradas. Uma rota sem schema aparece no documento do mesmo jeito,
// mas sem summary, tags ou resposta descrita. Por isso este helper mede a
// qualidade de cada operação, e não a presença do path.
function findOperationProblems(document: OpenApiDocument): string[] {
  const problems: string[] = [];

  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method] as OpenApiOperation | undefined;

      if (operation === undefined) {
        continue;
      }

      const missing: string[] = [];

      if (!operation.tags || operation.tags.length === 0) {
        missing.push("sem tags");
      }

      if (!operation.summary || operation.summary.trim() === "") {
        missing.push("sem summary");
      }

      const hasDocumentedSuccess = Object.entries(
        operation.responses ?? {},
      ).some(
        ([status, response]) =>
          /^2\d\d$/.test(status) &&
          Object.values(response.content ?? {}).some(
            (media) => media.schema !== undefined,
          ),
      );

      if (!hasDocumentedSuccess) {
        missing.push("sem resposta 2xx com schema de conteúdo");
      }

      const declaredPathParams = new Set(
        (operation.parameters ?? [])
          .filter((parameter) => parameter.in === "path")
          .map((parameter) => parameter.name),
      );

      for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
        if (!declaredPathParams.has(name as string)) {
          missing.push(`parâmetro de path {${name}} não declarado`);
        }
      }

      if (missing.length > 0) {
        problems.push(`${method.toUpperCase()} ${path}: ${missing.join(", ")}`);
      }
    }
  }

  return problems;
}

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

  it("fully documents every operation in the OpenAPI document", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });
    const body = response.json<OpenApiDocument>();

    const problems = findOperationProblems(body);

    expect(
      problems,
      `Operações do OpenAPI com documentação incompleta:\n${problems.join("\n")}`,
    ).toEqual([]);
  });

  it("does not expose automatic HEAD operations in the OpenAPI document", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });
    const body = response.json<OpenApiDocument>();

    const headPaths = Object.entries(body.paths)
      .filter(([, item]) => "head" in item)
      .map(([path]) => path);

    expect(headPaths).toEqual([]);
  });
});
