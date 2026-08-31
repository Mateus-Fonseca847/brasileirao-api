import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import { validateRequest } from "../../http/validation.js";
import { mapSeasonToResponse } from "./season.mapper.js";
import { seasonYearParamsSchema } from "./season.schemas.js";
import { findSeasonByYear, listSeasons } from "./season.service.js";

export async function registerSeasonRoutes(app: FastifyInstance): Promise<void> {
  app.get("/seasons", async () => {
    const seasons = await listSeasons();

    return seasons.map(mapSeasonToResponse);
  });

  app.get<{
    Params: {
      year: string;
    };
  }>("/seasons/:year", async (request) => {
    const { year } = validateRequest(seasonYearParamsSchema, request.params);
    const season = await findSeasonByYear(year);

    if (!season) {
      throw new HttpError(404, "Season not found.");
    }

    return mapSeasonToResponse(season);
  });
}
