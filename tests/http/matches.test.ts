import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";

type PublicMatch = {
  id: string;
  season: number;
  round: number | null;
  matchDate: string | null;
  kickoffTime: string | null;
  stadium: string | null;
  status: string;
  officialScore: {
    home: number | null;
    away: number | null;
  };
  playedScore: {
    home: number | null;
    away: number | null;
  } | null;
  homeTeam: {
    slug: string;
    name: string;
    shortName: string | null;
    state: string | null;
  };
  awayTeam: {
    slug: string;
    name: string;
    shortName: string | null;
    state: string | null;
  };
};

type PublicMatchStats = {
  matchId: string;
  home: PublicTeamStats;
  away: PublicTeamStats;
};

type PublicTeamStats = {
  team: PublicMatch["homeTeam"];
  shots: number | null;
  possession: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

type PaginatedMatchesResponse = {
  data: PublicMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function expectNoInternalMatchFields(match: Record<string, unknown>): void {
  expect(match).not.toHaveProperty("seasonId");
  expect(match).not.toHaveProperty("homeTeamId");
  expect(match).not.toHaveProperty("awayTeamId");
  expect(match).not.toHaveProperty("createdAt");
  expect(match).not.toHaveProperty("updatedAt");
  expect(match.homeTeam).not.toHaveProperty("id");
  expect(match.homeTeam).not.toHaveProperty("createdAt");
  expect(match.homeTeam).not.toHaveProperty("updatedAt");
  expect(match.awayTeam).not.toHaveProperty("id");
  expect(match.awayTeam).not.toHaveProperty("createdAt");
  expect(match.awayTeam).not.toHaveProperty("updatedAt");
}

function expectNoInternalStatsFields(stats: PublicMatchStats): void {
  expect(stats.home).not.toHaveProperty("id");
  expect(stats.home).not.toHaveProperty("createdAt");
  expect(stats.home).not.toHaveProperty("updatedAt");
  expect(stats.away).not.toHaveProperty("id");
  expect(stats.away).not.toHaveProperty("createdAt");
  expect(stats.away).not.toHaveProperty("updatedAt");
  expect(stats.home.team).not.toHaveProperty("id");
  expect(stats.home.team).not.toHaveProperty("createdAt");
  expect(stats.home.team).not.toHaveProperty("updatedAt");
  expect(stats.away.team).not.toHaveProperty("id");
  expect(stats.away.team).not.toHaveProperty("createdAt");
  expect(stats.away.team).not.toHaveProperty("updatedAt");
}

describe("match routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns 2024 matches filtered by season", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(50);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 380,
      totalPages: 8,
    });
    expect(body.data.every((match) => match.season === 2024)).toBe(true);
    expectNoInternalMatchFields(
      body.data[0] as unknown as Record<string, unknown>,
    );
  });

  it("returns 2016 matches filtered by season", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2016",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<PaginatedMatchesResponse>().pagination.total).toBe(379);
  });

  it("returns matches filtered by team", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?team=flamengo",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every(
        (match) =>
          match.homeTeam.slug === "flamengo" ||
          match.awayTeam.slug === "flamengo",
      ),
    ).toBe(true);
  });

  it("returns 2024 Flamengo matches", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&team=flamengo",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(38);
    expect(body.pagination.total).toBe(38);
    expect(
      body.data.every(
        (match) =>
          match.season === 2024 &&
          (match.homeTeam.slug === "flamengo" ||
            match.awayTeam.slug === "flamengo"),
      ),
    ).toBe(true);
  });

  it("returns 2024 first round matches", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&round=1",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(10);
    expect(body.pagination.total).toBe(10);
    expect(
      body.data.every((match) => match.season === 2024 && match.round === 1),
    ).toBe(true);
  });

  it("combines season, team and round filters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&team=flamengo&round=1",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every(
        (match) =>
          match.season === 2024 &&
          match.round === 1 &&
          (match.homeTeam.slug === "flamengo" ||
            match.awayTeam.slug === "flamengo"),
      ),
    ).toBe(true);
  });

  it("returns an empty list when filters match no persisted matches", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&team=flamengo&round=999",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<PaginatedMatchesResponse>()).toMatchObject({
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it("uses the default page and limit", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(50);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 380,
      totalPages: 8,
    });
  });

  it("returns the requested limit", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&limit=10",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(10);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 380,
      totalPages: 38,
    });
  });

  it("returns the requested page", async () => {
    const firstPageResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2024&limit=10",
    });
    const secondPageResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2024&limit=10&page=2",
    });
    const firstPage = firstPageResponse.json<PaginatedMatchesResponse>();
    const secondPage = secondPageResponse.json<PaginatedMatchesResponse>();

    expect(secondPageResponse.statusCode).toBe(200);
    expect(secondPage.data).toHaveLength(10);
    expect(secondPage.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 380,
      totalPages: 38,
    });
    expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0]?.id);
  });

  it("combines filters with pagination", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&team=flamengo&limit=10&page=2",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(10);
    expect(body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 38,
      totalPages: 4,
    });
    expect(
      body.data.every(
        (match) =>
          match.season === 2024 &&
          (match.homeTeam.slug === "flamengo" ||
            match.awayTeam.slug === "flamengo"),
      ),
    ).toBe(true);
  });

  it("returns an empty page beyond the available range", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&limit=100&page=99",
    });
    const body = response.json<PaginatedMatchesResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination).toEqual({
      page: 99,
      limit: 100,
      total: 380,
      totalPages: 4,
    });
  });

  it.each([
    ["/matches?season=abc", "Season year must be a valid integer."],
    ["/matches?round=0", "Round must be a positive integer."],
    ["/matches?team=Flamengo", "Team slug must be a lowercase kebab-case string."],
    ["/matches?limit=101", "Limit must be less than or equal to 100."],
    ["/matches?page=0", "Page must be a positive integer."],
  ])("returns bad request for invalid query %s", async (url, message) => {
    const response = await app.inject({
      method: "GET",
      url,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: message,
      statusCode: 400,
    });
  });

  it("returns not found for an unknown valid team filter", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?team=unknown-team",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Team not found.",
      statusCode: 404,
    });
  });

  it("returns not found for an unknown season filter", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=9999",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Season not found.",
      statusCode: 404,
    });
  });

  it("returns a match by id", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2024&round=1",
    });
    const [match] = listResponse.json<PaginatedMatchesResponse>().data;
    const response = await app.inject({
      method: "GET",
      url: `/matches/${match?.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(match);
  });

  it("returns not found for an unknown match id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches/00000000-0000-4000-8000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Match not found.",
      statusCode: 404,
    });
  });

  it("returns bad request for a malformed match id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches/not-a-uuid",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Match id must be a valid UUID.",
      statusCode: 400,
    });
  });

  it("returns match stats with home and away teams", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2024&round=1",
    });
    const [match] = listResponse.json<PaginatedMatchesResponse>().data;
    const response = await app.inject({
      method: "GET",
      url: `/matches/${match?.id}/stats`,
    });
    const body = response.json<PublicMatchStats>();

    expect(response.statusCode).toBe(200);
    expect(body.matchId).toBe(match?.id);
    expect(body.home.team).toEqual(match?.homeTeam);
    expect(body.away.team).toEqual(match?.awayTeam);
    expectNoInternalStatsFields(body);
  });

  it("returns bad request for malformed stats match id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches/not-a-uuid/stats",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Match id must be a valid UUID.",
      statusCode: 400,
    });
  });

  it("returns not found for an unknown stats match id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches/00000000-0000-4000-8000-000000000000/stats",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Match not found.",
      statusCode: 404,
    });
  });

  it("returns unavailable 2003 stats as null", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2003&round=1",
    });
    const [match] = listResponse.json<PaginatedMatchesResponse>().data;
    const response = await app.inject({
      method: "GET",
      url: `/matches/${match?.id}/stats`,
    });
    const body = response.json<PublicMatchStats>();

    expect(response.statusCode).toBe(200);
    expect(body.home).toMatchObject({
      shots: null,
      possession: null,
      yellowCards: null,
      redCards: null,
    });
    expect(body.away).toMatchObject({
      shots: null,
      possession: null,
      yellowCards: null,
      redCards: null,
    });
  });

  it("preserves 2024 shots and possession as null while card values are available", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2024&round=1",
    });
    const [match] = listResponse.json<PaginatedMatchesResponse>().data;
    const response = await app.inject({
      method: "GET",
      url: `/matches/${match?.id}/stats`,
    });
    const body = response.json<PublicMatchStats>();

    expect(response.statusCode).toBe(200);
    expect(body.home.shots).toBeNull();
    expect(body.home.possession).toBeNull();
    expect(body.away.shots).toBeNull();
    expect(body.away.possession).toBeNull();
    expect(body.home.yellowCards).not.toBeNull();
    expect(body.home.redCards).not.toBeNull();
    expect(body.away.yellowCards).not.toBeNull();
    expect(body.away.redCards).not.toBeNull();
  });

  it("returns validated shots and possession when available", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/matches?season=2015&round=1&team=fluminense",
    });
    const [match] = listResponse.json<PaginatedMatchesResponse>().data;
    const response = await app.inject({
      method: "GET",
      url: `/matches/${match?.id}/stats`,
    });
    const body = response.json<PublicMatchStats>();

    expect(response.statusCode).toBe(200);
    expect(body.home).toMatchObject({
      team: {
        slug: "fluminense",
      },
      shots: 26,
      possession: 74,
      yellowCards: 2,
      redCards: 0,
    });
    expect(body.away).toMatchObject({
      team: {
        slug: "joinville",
      },
      shots: 3,
      possession: 26,
      yellowCards: 1,
      redCards: 1,
    });
  });
});
