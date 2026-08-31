import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import { mapSeasonToResponse } from "./season.mapper.js";
import { findSeasonByYear, listSeasons } from "./season.service.js";

function parseSeasonYear(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new HttpError(400, "Season year must be a valid integer.");
  }

  const year = Number(value);

  if (!Number.isSafeInteger(year) || year < 2003) {
    throw new HttpError(400, "Season year must be greater than or equal to 2003.");
  }

  return year;
}

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
    const year = parseSeasonYear(request.params.year);
    const season = await findSeasonByYear(year);

    if (!season) {
      throw new HttpError(404, "Season not found.");
    }

    return mapSeasonToResponse(season);
  });
}
