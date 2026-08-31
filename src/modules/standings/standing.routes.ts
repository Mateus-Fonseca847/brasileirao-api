import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
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
  }>("/seasons/:year/standings", async (request) => {
    const { year } = validateRequest(seasonYearParamsSchema, request.params);
    const season = await findSeasonStandingsByYear(year);

    if (!season) {
      throw new HttpError(404, "Season not found.");
    }

    return season.standings.map(mapStandingToResponse);
  });
}
