import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type SeasonTeamsEntry = {
  season: number;
  teams: string[];
};

const seasonTeamsPath = new URL(
  "../../data/normalized/season-teams.json",
  import.meta.url,
);

function isSeasonTeams(value: unknown): value is SeasonTeamsEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { season?: unknown }).season === "number" &&
        Array.isArray((entry as { teams?: unknown }).teams) &&
        (entry as { teams: unknown[] }).teams.every(
          (team) => typeof team === "string",
        ),
    )
  );
}

async function importarEquipesPorTemporada(): Promise<void> {
  const fileContent = await readFile(seasonTeamsPath, "utf8");
  const seasonTeams: unknown = JSON.parse(fileContent);

  if (!isSeasonTeams(seasonTeams)) {
    throw new Error(
      "Catálogo de equipes por temporada está em formato inválido.",
    );
  }

  const years = seasonTeams.map((entry) => entry.season);
  const slugs = [...new Set(seasonTeams.flatMap((entry) => entry.teams))];

  const totalVinculos = seasonTeams.reduce(
    (total, entry) => total + entry.teams.length,
    0,
  );

  const seasons = await prisma.season.findMany({
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

  const teams = await prisma.team.findMany({
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
          ? `Temporadas não encontradas: ${missingSeasons.join(", ")}`
          : null,
        missingTeams.length > 0
          ? `Equipes não encontradas: ${missingTeams.join(", ")}`
          : null,
      ]
        .filter((message) => message !== null)
        .join(" | "),
    );
  }

  const data = seasonTeams.flatMap((entry) => {
    const seasonId = seasonIdsByYear.get(entry.season);

    if (!seasonId) {
      throw new Error(`Temporada não encontrada: ${entry.season}`);
    }

    return entry.teams.map((slug) => {
      const teamId = teamIdsBySlug.get(slug);

      if (!teamId) {
        throw new Error(`Equipe não encontrada: ${slug}`);
      }

      return {
        seasonId,
        teamId,
      };
    });
  });

  await prisma.seasonTeam.createMany({
    data,
    skipDuplicates: true,
  });

  console.log(`Vínculos de equipes por temporada importados: ${totalVinculos}`);
}

importarEquipesPorTemporada()
  .catch((erro: unknown) => {
    console.error("Falha ao importar equipes por temporada:");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });