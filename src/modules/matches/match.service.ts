import type { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../database/prisma.js";

export type MatchFilters = {
  season?: number;
  team?: string;
  round?: number;
};

const matchInclude = {
  season: true,
  homeTeam: true,
  awayTeam: true,
} satisfies Prisma.MatchInclude;

const matchStatsInclude = {
  homeTeam: true,
  awayTeam: true,
  teamStats: true,
} satisfies Prisma.MatchInclude;

export type MatchListResult =
  | {
      status: "ok";
      matches: Prisma.MatchGetPayload<{ include: typeof matchInclude }>[];
    }
  | {
      status: "season_not_found" | "team_not_found";
    };

export async function listMatches(
  filters: MatchFilters,
): Promise<MatchListResult> {
  const where: Prisma.MatchWhereInput = {};

  if (filters.season !== undefined) {
    const season = await prisma.season.findUnique({
      where: {
        year: filters.season,
      },
      select: {
        id: true,
      },
    });

    if (!season) {
      return {
        status: "season_not_found",
      };
    }

    where.seasonId = season.id;
  }

  if (filters.team !== undefined) {
    const team = await prisma.team.findUnique({
      where: {
        slug: filters.team,
      },
      select: {
        id: true,
      },
    });

    if (!team) {
      return {
        status: "team_not_found",
      };
    }

    where.OR = [
      {
        homeTeamId: team.id,
      },
      {
        awayTeamId: team.id,
      },
    ];
  }

  if (filters.round !== undefined) {
    where.round = filters.round;
  }

  return {
    status: "ok",
    matches: await prisma.match.findMany({
      where,
      include: matchInclude,
      orderBy: [
        {
          matchDate: "asc",
        },
        {
          kickoffTime: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
  };
}

export function findMatchById(id: string) {
  return prisma.match.findUnique({
    where: {
      id,
    },
    include: matchInclude,
  });
}

export function findMatchStatsById(id: string) {
  return prisma.match.findUnique({
    where: {
      id,
    },
    include: matchStatsInclude,
  });
}
