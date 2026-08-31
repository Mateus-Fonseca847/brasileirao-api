import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

import { loadEnvironment } from "../config/environment.js";

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  const environment = loadEnvironment();

  await app.register(cors, {
    origin: environment.corsOrigins,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: environment.rateLimitMax,
    timeWindow: "1 minute",
    skipOnError: false,
    allowList: (request) => request.url === "/health",
  });
}
