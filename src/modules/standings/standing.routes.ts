import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import { errorResponseSchema, standingResponseSchema } from "../../http/openapi.js";
import { validateRequest } from "../../http/validation.js";
import { seasonYearParamsSchema } from "../seasons/season.schemas.js";
import { mapStandingToResponse } from "./standing.mapper.js";
import { findSeasonStandingsByYear } from "./standing.service.js";

export async function registerStandingRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{
    Params: {
      year: string;
    };
  }>(
    "/seasons/:year/standings",
    {
      schema: {
        tags: ["standings"],
        summary: "List official final standings for a season",
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
            items: standingResponseSchema,
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
    const { year } = validateRequest(seasonYearParamsSchema, request.params);
    const season = await findSeasonStandingsByYear(year);

    if (!season) {
      throw new HttpError(404, "Season not found.");
    }

    return season.standings.map(mapStandingToResponse);
    },
  );
}
