import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import { validateRequest } from "../../http/validation.js";
import { mapTeamToResponse } from "./team.mapper.js";
import { teamSlugParamsSchema } from "./team.schemas.js";
import { findTeamBySlug, listTeams } from "./team.service.js";

export async function registerTeamRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teams", async () => {
    const teams = await listTeams();

    return teams.map(mapTeamToResponse);
  });

  app.get<{
    Params: {
      slug: string;
    };
  }>("/teams/:slug", async (request) => {
    const { slug } = validateRequest(teamSlugParamsSchema, request.params);
    const team = await findTeamBySlug(slug);

    if (!team) {
      throw new HttpError(404, "Team not found.");
    }

    return mapTeamToResponse(team);
  });
}
