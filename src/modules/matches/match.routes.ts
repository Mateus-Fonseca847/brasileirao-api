import type { FastifyInstance } from "fastify";

import { HttpError } from "../../http/errors.js";
import {
  errorResponseSchema,
  matchResponseSchema,
  matchStatsResponseSchema,
  paginatedMatchesResponseSchema,
} from "../../http/openapi.js";
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
      page?: string;
      limit?: string;
    };
  }>(
    "/matches",
    {
      schema: {
        tags: ["matches"],
        summary: "List matches with filters and pagination",
        querystring: {
          type: "object",
          properties: {
            season: {
              type: "string",
              description: "Season year greater than or equal to 2003.",
            },
            team: {
              type: "string",
              description: "Canonical lowercase kebab-case team slug.",
            },
            round: {
              type: "string",
              description: "Positive round number.",
            },
            page: {
              type: "string",
              description: "Positive page number. Defaults to 1.",
            },
            limit: {
              type: "string",
              description: "Positive page size. Defaults to 50, maximum 100.",
            },
          },
        },
        response: {
          200: paginatedMatchesResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
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

    return {
      data: result.matches.map(mapMatchToResponse),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.limit),
      },
    };
    },
  );

  app.get<{
    Params: {
      id: string;
    };
  }>(
    "/matches/:id/stats",
    {
      schema: {
        tags: ["matches"],
        summary: "Get match team statistics",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Public match UUID.",
            },
          },
        },
        response: {
          200: matchStatsResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
    const { id } = validateRequest(matchIdParamsSchema, request.params);
    const match = await findMatchStatsById(id);

    if (!match) {
      throw new HttpError(404, "Match not found.");
    }

    return mapMatchStatsToResponse(match);
    },
  );

  app.get<{
    Params: {
      id: string;
    };
  }>(
    "/matches/:id",
    {
      schema: {
        tags: ["matches"],
        summary: "Get a match by id",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Public match UUID.",
            },
          },
        },
        response: {
          200: matchResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
    const { id } = validateRequest(matchIdParamsSchema, request.params);
    const match = await findMatchById(id);

    if (!match) {
      throw new HttpError(404, "Match not found.");
    }

    return mapMatchToResponse(match);
    },
  );
}
