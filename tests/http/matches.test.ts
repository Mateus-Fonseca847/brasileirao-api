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
    const body = response.json<PublicMatch[]>();

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(380);
    expect(body.every((match) => match.season === 2024)).toBe(true);
    expectNoInternalMatchFields(body[0] as unknown as Record<string, unknown>);
  });

  it("returns 2016 matches filtered by season", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2016",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(379);
  });

  it("returns matches filtered by team", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?team=flamengo",
    });
    const body = response.json<PublicMatch[]>();

    expect(response.statusCode).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(
      body.every(
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
    const body = response.json<PublicMatch[]>();

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(38);
    expect(
      body.every(
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
    const body = response.json<PublicMatch[]>();

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(10);
    expect(body.every((match) => match.season === 2024 && match.round === 1)).toBe(
      true,
    );
  });

  it("combines season, team and round filters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/matches?season=2024&team=flamengo&round=1",
    });
    const body = response.json<PublicMatch[]>();

    expect(response.statusCode).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(
      body.every(
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
    expect(response.json()).toEqual([]);
  });

  it.each([
    ["/matches?season=abc", "Season year must be a valid integer."],
    ["/matches?round=0", "Round must be a positive integer."],
    ["/matches?team=Flamengo", "Team slug must be a lowercase kebab-case string."],
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
    const [match] = listResponse.json<PublicMatch[]>();
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
});
