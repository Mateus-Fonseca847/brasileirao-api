import Fastify, { type FastifyInstance } from "fastify";

import { registerErrorHandler } from "./http/errors.js";
import { registerHealthRoute } from "./http/routes/health.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);
  await registerHealthRoute(app);

  return app;
}
