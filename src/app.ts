import Fastify, { type FastifyInstance } from "fastify";

import { registerErrorHandler } from "./http/errors.js";
import { registerHealthRoute } from "./http/routes/health.js";
import { registerMatchRoutes } from "./modules/matches/match.routes.js";
import { registerSeasonRoutes } from "./modules/seasons/season.routes.js";
import { registerStandingRoutes } from "./modules/standings/standing.routes.js";
import { registerTeamRoutes } from "./modules/teams/team.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);
  await registerHealthRoute(app);
  await registerMatchRoutes(app);
  await registerSeasonRoutes(app);
  await registerStandingRoutes(app);
  await registerTeamRoutes(app);

  return app;
}
