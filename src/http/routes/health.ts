import type { FastifyInstance } from "fastify";

import { prisma } from "../../database/prisma.js";
import { errorResponseSchema } from "../openapi.js";

type HealthResponse = {
  status: "ok";
  database: "connected";
};

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Check API and database health",
        response: {
          200: {
            type: "object",
            required: ["status", "database"],
            properties: {
              status: {
                type: "string",
                enum: ["ok"],
              },
              database: {
                type: "string",
                enum: ["connected"],
              },
            },
          },
          500: errorResponseSchema,
        },
      },
    },
    async (): Promise<HealthResponse> => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "connected",
    };
    },
  );
}
