import Fastify, { type FastifyInstance } from "fastify";

import { registerErrorHandler } from "./http/errors.js";
import { registerHealthRoute } from "./http/routes/health.js";
import { registerSeasonRoutes } from "./modules/seasons/season.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);
  await registerHealthRoute(app);
  await registerSeasonRoutes(app);

  return app;
}
