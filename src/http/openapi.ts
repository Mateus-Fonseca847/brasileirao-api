import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export const errorResponseSchema = {
  type: "object",
  required: ["error", "statusCode"],
  properties: {
    error: {
      type: "string",
    },
    statusCode: {
      type: "number",
    },
  },
} as const;

export const teamResponseSchema = {
  type: "object",
  required: ["slug", "name", "shortName", "state"],
  properties: {
    slug: {
      type: "string",
    },
    name: {
      type: "string",
    },
    shortName: {
      type: "string",
      nullable: true,
    },
    state: {
      type: "string",
      nullable: true,
    },
  },
} as const;

export const seasonResponseSchema = {
  type: "object",
  required: ["year", "status", "startDate", "endDate", "teamsCount"],
  properties: {
    year: {
      type: "number",
    },
    status: {
      type: "string",
    },
    startDate: {
      type: "string",
      nullable: true,
    },
    endDate: {
      type: "string",
      nullable: true,
    },
    teamsCount: {
      type: "number",
      nullable: true,
    },
  },
} as const;

const scoreResponseSchema = {
  type: "object",
  required: ["home", "away"],
  properties: {
    home: {
      type: "number",
      nullable: true,
    },
    away: {
      type: "number",
      nullable: true,
    },
  },
} as const;

export const matchResponseSchema = {
  type: "object",
  required: [
    "id",
    "season",
    "round",
    "matchDate",
    "kickoffTime",
    "stadium",
    "status",
    "officialScore",
    "playedScore",
    "homeTeam",
    "awayTeam",
  ],
  properties: {
    id: {
      type: "string",
    },
    season: {
      type: "number",
    },
    round: {
      type: "number",
      nullable: true,
    },
    matchDate: {
      type: "string",
      nullable: true,
    },
    kickoffTime: {
      type: "string",
      nullable: true,
    },
    stadium: {
      type: "string",
      nullable: true,
    },
    status: {
      type: "string",
    },
    officialScore: scoreResponseSchema,
    playedScore: {
      ...scoreResponseSchema,
      nullable: true,
    },
    homeTeam: teamResponseSchema,
    awayTeam: teamResponseSchema,
  },
} as const;

const matchTeamStatsResponseSchema = {
  type: "object",
  required: ["team", "shots", "possession", "yellowCards", "redCards"],
  properties: {
    team: teamResponseSchema,
    shots: {
      type: "number",
      nullable: true,
    },
    possession: {
      type: "number",
      nullable: true,
    },
    yellowCards: {
      type: "number",
      nullable: true,
    },
    redCards: {
      type: "number",
      nullable: true,
    },
  },
} as const;

export const matchStatsResponseSchema = {
  type: "object",
  required: ["matchId", "home", "away"],
  properties: {
    matchId: {
      type: "string",
    },
    home: matchTeamStatsResponseSchema,
    away: matchTeamStatsResponseSchema,
  },
} as const;

export const paginatedMatchesResponseSchema = {
  type: "object",
  required: ["data", "pagination"],
  properties: {
    data: {
      type: "array",
      items: matchResponseSchema,
    },
    pagination: {
      type: "object",
      required: ["page", "limit", "total", "totalPages"],
      properties: {
        page: {
          type: "number",
        },
        limit: {
          type: "number",
        },
        total: {
          type: "number",
        },
        totalPages: {
          type: "number",
        },
      },
    },
  },
} as const;

export const standingResponseSchema = {
  type: "object",
  required: [
    "position",
    "points",
    "played",
    "wins",
    "draws",
    "losses",
    "goalsFor",
    "goalsAgainst",
    "goalDifference",
    "pointsAdjustment",
    "team",
  ],
  properties: {
    position: {
      type: "number",
    },
    points: {
      type: "number",
    },
    played: {
      type: "number",
    },
    wins: {
      type: "number",
    },
    draws: {
      type: "number",
    },
    losses: {
      type: "number",
    },
    goalsFor: {
      type: "number",
    },
    goalsAgainst: {
      type: "number",
    },
    goalDifference: {
      type: "number",
    },
    pointsAdjustment: {
      type: "number",
    },
    team: teamResponseSchema,
  },
} as const;

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Brasileirão API",
        version: "1.0.0",
        description:
          "API histórica do Campeonato Brasileiro Série A com temporadas, equipes, partidas, estatísticas agregadas e classificações oficiais validadas.",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
}
