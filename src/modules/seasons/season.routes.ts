import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import {
  errorResponseSchema,
  seasonResponseSchema,
  teamResponseSchema,
} from "../../http/openapi.js";
import { validateRequest } from "../../http/validation.js";
import { mapTeamToResponse } from "../teams/team.mapper.js";
import { mapSeasonToResponse } from "./season.mapper.js";
import { seasonYearParamsSchema } from "./season.schemas.js";
import {
  findSeasonByYear,
  findSeasonTeamsByYear,
  listSeasons,
} from "./season.service.js";

export async function registerSeasonRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/seasons",
    {
      schema: {
        tags: ["seasons"],
        summary: "List seasons",
        response: {
          200: {
            type: "array",
            items: seasonResponseSchema,
          },
        },
      },
    },
    async () => {
    const seasons = await listSeasons();

    return seasons.map(mapSeasonToResponse);
    },
  );

  app.get<{
    Params: {
      year: string;
    };
  }>(
    "/seasons/:year/teams",
    {
      schema: {
        tags: ["seasons"],
        summary: "List teams participating in a season",
        params: {
          type: "object",
          required: ["year"],
          properties: {
            year: {
              type: "string",
              description: "Season year greater than or equal to 2003.",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: teamResponseSchema,
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
    const { year } = validateRequest(seasonYearParamsSchema, request.params);
    const season = await findSeasonTeamsByYear(year);

    if (!season) {
      throw new HttpError(404, "Season not found.");
    }

    return season.seasonTeams.map((seasonTeam) =>
      mapTeamToResponse(seasonTeam.team),
    );
    },
  );

  app.get<{
    Params: {
      year: string;
    };
  }>(
    "/seasons/:year",
    {
      schema: {
        tags: ["seasons"],
        summary: "Get a season by year",
        params: {
          type: "object",
          required: ["year"],
          properties: {
            year: {
              type: "string",
              description: "Season year greater than or equal to 2003.",
            },
          },
        },
        response: {
          200: seasonResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
    const { year } = validateRequest(seasonYearParamsSchema, request.params);
    const season = await findSeasonByYear(year);

    if (!season) {
      throw new HttpError(404, "Season not found.");
    }

    return mapSeasonToResponse(season);
    },
  );
}
