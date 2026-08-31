import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type NormalizedStanding = {
  source: "czekster";
  season: number;
  team: string;
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  pointsAdjustment: number;
  adjustmentProvenance: "DERIVED_FROM_FINAL_POINTS" | null;
};

const standingsPath = new URL(
  "../../data/normalized/standings.json",
  import.meta.url,
);

function isNormalizedStandings(value: unknown): value is NormalizedStanding[] {
  return (
    Array.isArray(value) &&
    value.every(
      (standing) =>
        typeof standing === "object" &&
        standing !== null &&
        (standing as { source?: unknown }).source === "czekster" &&
        typeof (standing as { season?: unknown }).season === "number" &&
        typeof (standing as { team?: unknown }).team === "string" &&
        typeof (standing as { position?: unknown }).position === "number" &&
        typeof (standing as { points?: unknown }).points === "number" &&
        typeof (standing as { played?: unknown }).played === "number" &&
        typeof (standing as { wins?: unknown }).wins === "number" &&
        typeof (standing as { draws?: unknown }).draws === "number" &&
        typeof (standing as { losses?: unknown }).losses === "number" &&
        typeof (standing as { goalsFor?: unknown }).goalsFor === "number" &&
        typeof (standing as { goalsAgainst?: unknown }).goalsAgainst ===
          "number" &&
        typeof (standing as { goalDifference?: unknown }).goalDifference ===
          "number" &&
        typeof (standing as { pointsAdjustment?: unknown })
          .pointsAdjustment === "number" &&
        (
          (standing as { adjustmentProvenance?: unknown })
            .adjustmentProvenance === "DERIVED_FROM_FINAL_POINTS" ||
          (standing as { adjustmentProvenance?: unknown })
            .adjustmentProvenance === null
        ),
    )
  );
}

async function importStandings(): Promise<void> {
  const fileContent = await readFile(standingsPath, "utf8");
  const standings: unknown = JSON.parse(fileContent);

  if (!isNormalizedStandings(standings)) {
    throw new Error("Normalized standings file has an invalid format.");
  }

  const years = [...new Set(standings.map((standing) => standing.season))];
  const slugs = [...new Set(standings.map((standing) => standing.team))];

  await prisma.$transaction(async (tx) => {
    const seasons = await tx.season.findMany({
      where: {
        year: {
          in: years,
        },
      },
      select: {
        id: true,
        year: true,
      },
    });

    const teams = await tx.team.findMany({
      where: {
        slug: {
          in: slugs,
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });

    const seasonIdsByYear = new Map(
      seasons.map((season) => [season.year, season.id]),
    );
    const teamIdsBySlug = new Map(teams.map((team) => [team.slug, team.id]));
    const missingSeasons = years.filter((year) => !seasonIdsByYear.has(year));
    const missingTeams = slugs.filter((slug) => !teamIdsBySlug.has(slug));

    if (missingSeasons.length > 0 || missingTeams.length > 0) {
      throw new Error(
        [
          missingSeasons.length > 0
            ? `Missing seasons: ${missingSeasons.join(", ")}`
            : null,
          missingTeams.length > 0
            ? `Missing teams: ${missingTeams.join(", ")}`
            : null,
        ]
          .filter((message) => message !== null)
          .join(" | "),
      );
    }

    for (const standing of standings) {
      const seasonId = seasonIdsByYear.get(standing.season);
      const teamId = teamIdsBySlug.get(standing.team);

      if (!seasonId) {
        throw new Error(`Missing season: ${standing.season}`);
      }

      if (!teamId) {
        throw new Error(`Missing team: ${standing.team}`);
      }

      await tx.standing.upsert({
        where: {
          seasonId_teamId: {
            seasonId,
            teamId,
          },
        },
        create: {
          seasonId,
          teamId,
          position: standing.position,
          points: standing.points,
          played: standing.played,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
          goalDifference: standing.goalDifference,
          pointsAdjustment: standing.pointsAdjustment,
        },
        update: {
          position: standing.position,
          points: standing.points,
          played: standing.played,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
          goalDifference: standing.goalDifference,
          pointsAdjustment: standing.pointsAdjustment,
        },
      });
    }
  });

  console.log(`Standings imported: ${standings.length}`);
}

importStandings()
  .catch((error: unknown) => {
    console.error("Failed to import standings:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
