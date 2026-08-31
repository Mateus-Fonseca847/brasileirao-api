import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import { validateRequest } from "../../http/validation.js";
import { mapMatchStatsToResponse, mapMatchToResponse } from "./match.mapper.js";
import { matchIdParamsSchema, matchQuerySchema } from "./match.schemas.js";
import {
  findMatchById,
  findMatchStatsById,
  listMatches,
} from "./match.service.js";

export async function registerMatchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      season?: string;
      team?: string;
      round?: string;
    };
  }>("/matches", async (request) => {
    const filters = validateRequest(matchQuerySchema, request.query);
    const result = await listMatches(filters);

    if (result.status === "season_not_found") {
      throw new HttpError(404, "Season not found.");
    }

    if (result.status === "team_not_found") {
      throw new HttpError(404, "Team not found.");
    }

    if (result.status !== "ok") {
      throw new HttpError(500, "Unexpected match query result.");
    }

    return result.matches.map(mapMatchToResponse);
  });

  app.get<{
    Params: {
      id: string;
    };
  }>("/matches/:id/stats", async (request) => {
    const { id } = validateRequest(matchIdParamsSchema, request.params);
    const match = await findMatchStatsById(id);

    if (!match) {
      throw new HttpError(404, "Match not found.");
    }

    return mapMatchStatsToResponse(match);
  });

  app.get<{
    Params: {
      id: string;
    };
  }>("/matches/:id", async (request) => {
    const { id } = validateRequest(matchIdParamsSchema, request.params);
    const match = await findMatchById(id);

    if (!match) {
      throw new HttpError(404, "Match not found.");
    }

    return mapMatchToResponse(match);
  });
}
