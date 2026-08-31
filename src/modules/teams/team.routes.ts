import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import { errorResponseSchema, teamResponseSchema } from "../../http/openapi.js";
import { validateRequest } from "../../http/validation.js";
import { mapTeamToResponse } from "./team.mapper.js";
import { teamSlugParamsSchema } from "./team.schemas.js";
import { findTeamBySlug, listTeams } from "./team.service.js";

export async function registerTeamRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/teams",
    {
      schema: {
        tags: ["teams"],
        summary: "List canonical teams",
        response: {
          200: {
            type: "array",
            items: teamResponseSchema,
          },
        },
      },
    },
    async () => {
    const teams = await listTeams();

    return teams.map(mapTeamToResponse);
    },
  );

  app.get<{
    Params: {
      slug: string;
    };
  }>(
    "/teams/:slug",
    {
      schema: {
        tags: ["teams"],
        summary: "Get a canonical team by slug",
        params: {
          type: "object",
          required: ["slug"],
          properties: {
            slug: {
              type: "string",
              description: "Canonical lowercase kebab-case team slug.",
            },
          },
        },
        response: {
          200: teamResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
    const { slug } = validateRequest(teamSlugParamsSchema, request.params);
    const team = await findTeamBySlug(slug);

    if (!team) {
      throw new HttpError(404, "Team not found.");
    }

    return mapTeamToResponse(team);
    },
  );
}
