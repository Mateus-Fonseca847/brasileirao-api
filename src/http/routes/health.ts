import type { FastifyInstance } from "fastify";

import { prisma } from "../../database/prisma.js";

type HealthResponse = {
  status: "ok";
  database: "connected";
};

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get("/health", async (): Promise<HealthResponse> => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "connected",
    };
  });
}
