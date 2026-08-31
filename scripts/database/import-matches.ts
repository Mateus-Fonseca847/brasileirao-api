import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type Score = {
  home: number | null;
  away: number | null;
};

type NormalizedMatch = {
  season: number;
  round: number | null;
  date: string | null;
  kickoffTime: string | null;
  stadium: string | null;
  homeTeam: string;
  awayTeam: string;
  officialScore: Score;
  playedScore: Score | null;
  status: "FINISHED";
};

type PersistedMatchComparable = {
  season: number;
  round: number | null;
  matchDate: string | null;
  kickoffTime: string | null;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  playedHomeGoals: number | null;
  playedAwayGoals: number | null;
  stadium: string | null;
  status: string;
};

const matchesPath = new URL("../../data/normalized/matches.json", import.meta.url);
const batchSize = 500;

function isScore(value: unknown): value is Score {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const score = value as { home?: unknown; away?: unknown };

  return (
    (typeof score.home === "number" || score.home === null) &&
    (typeof score.away === "number" || score.away === null)
  );
}

function isNormalizedMatches(value: unknown): value is NormalizedMatch[] {
  return (
    Array.isArray(value) &&
    value.every((match) => {
      if (typeof match !== "object" || match === null) {
        return false;
      }

      const candidate = match as Partial<NormalizedMatch>;

      return (
        typeof candidate.season === "number" &&
        (typeof candidate.round === "number" || candidate.round === null) &&
        (typeof candidate.date === "string" || candidate.date === null) &&
        (typeof candidate.kickoffTime === "string" ||
          candidate.kickoffTime === null) &&
        (typeof candidate.stadium === "string" || candidate.stadium === null) &&
        typeof candidate.homeTeam === "string" &&
        typeof candidate.awayTeam === "string" &&
        isScore(candidate.officialScore) &&
        (isScore(candidate.playedScore) || candidate.playedScore === null) &&
        candidate.status === "FINISHED"
      );
    })
  );
}

function toDate(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function toTime(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  return new Date(`1970-01-01T${value}:00.000Z`);
}

function formatDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function formatTime(value: Date | null): string | null {
  return value?.toISOString().slice(11, 16) ?? null;
}

function createSignature(match: PersistedMatchComparable): string {
  return JSON.stringify(match);
}

function countSignatures(matches: PersistedMatchComparable[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const match of matches) {
    const signature = createSignature(match);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  return counts;
}

function compareMultisets(
  expected: PersistedMatchComparable[],
  actual: PersistedMatchComparable[],
): { equivalent: boolean; missing: string[]; extra: string[] } {
  const expectedCounts = countSignatures(expected);
  const actualCounts = countSignatures(actual);
  const missing: string[] = [];
  const extra: string[] = [];

  for (const [signature, count] of expectedCounts) {
    const actualCount = actualCounts.get(signature) ?? 0;

    if (actualCount < count) {
      missing.push(`${signature} x${count - actualCount}`);
    }
  }

  for (const [signature, count] of actualCounts) {
    const expectedCount = expectedCounts.get(signature) ?? 0;

    if (expectedCount < count) {
      extra.push(`${signature} x${count - expectedCount}`);
    }
  }

  return {
    equivalent: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

function toComparableMatch(
  match: NormalizedMatch,
): PersistedMatchComparable {
  return {
    season: match.season,
    round: match.round,
    matchDate: match.date,
    kickoffTime: match.kickoffTime,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeGoals: match.officialScore.home,
    awayGoals: match.officialScore.away,
    playedHomeGoals: match.playedScore?.home ?? null,
    playedAwayGoals: match.playedScore?.away ?? null,
    stadium: match.stadium,
    status: match.status,
  };
}

async function importarPartidas(): Promise<void> {
  const fileContent = await readFile(matchesPath, "utf8");
  const matches: unknown = JSON.parse(fileContent);

  if (!isNormalizedMatches(matches)) {
    throw new Error("Dataset normalizado de partidas está em formato inválido.");
  }

  const expectedComparableMatches = matches.map(toComparableMatch);
  const existingMatchesCount = await prisma.match.count();

  if (existingMatchesCount > 0) {
    const persistedMatches = await prisma.match.findMany({
      select: {
        round: true,
        matchDate: true,
        kickoffTime: true,
        homeGoals: true,
        awayGoals: true,
        playedHomeGoals: true,
        playedAwayGoals: true,
        stadium: true,
        status: true,
        season: {
          select: {
            year: true,
          },
        },
        homeTeam: {
          select: {
            slug: true,
          },
        },
        awayTeam: {
          select: {
            slug: true,
          },
        },
      },
    });

    const actualComparableMatches = persistedMatches.map((match) => ({
      season: match.season.year,
      round: match.round,
      matchDate: formatDate(match.matchDate),
      kickoffTime: formatTime(match.kickoffTime),
      homeTeam: match.homeTeam.slug,
      awayTeam: match.awayTeam.slug,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      playedHomeGoals: match.playedHomeGoals,
      playedAwayGoals: match.playedAwayGoals,
      stadium: match.stadium,
      status: match.status,
    }));

    const comparison = compareMultisets(
      expectedComparableMatches,
      actualComparableMatches,
    );

    if (!comparison.equivalent) {
      throw new Error(
        [
          "Tabela matches já contém dados diferentes do dataset normalizado.",
          `Faltantes: ${comparison.missing.slice(0, 10).join("; ") || "0"}`,
          `Extras: ${comparison.extra.slice(0, 10).join("; ") || "0"}`,
        ].join("\n"),
      );
    }

    console.log(
      `Dataset de partidas já importado: ${existingMatchesCount} registros.`,
    );
    return;
  }

  const years = [...new Set(matches.map((match) => match.season))];
  const slugs = [
    ...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam])),
  ];

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

    const createManyData = matches.map((match) => {
      const seasonId = seasonIdsByYear.get(match.season);
      const homeTeamId = teamIdsBySlug.get(match.homeTeam);
      const awayTeamId = teamIdsBySlug.get(match.awayTeam);

      if (!seasonId) {
        throw new Error(`Temporada não encontrada: ${match.season}`);
      }

      if (!homeTeamId) {
        throw new Error(`Equipe mandante não encontrada: ${match.homeTeam}`);
      }

      if (!awayTeamId) {
        throw new Error(`Equipe visitante não encontrada: ${match.awayTeam}`);
      }

      return {
        seasonId,
        round: match.round,
        matchDate: toDate(match.date),
        kickoffTime: toTime(match.kickoffTime),
        homeTeamId,
        awayTeamId,
        homeGoals: match.officialScore.home,
        awayGoals: match.officialScore.away,
        playedHomeGoals: match.playedScore?.home ?? null,
        playedAwayGoals: match.playedScore?.away ?? null,
        stadium: match.stadium,
        status: match.status,
      };
    });

    for (let index = 0; index < createManyData.length; index += batchSize) {
      await tx.match.createMany({
        data: createManyData.slice(index, index + batchSize),
      });
    }
  }, {
    timeout: 120_000,
  });

  console.log(`Partidas normalizadas importadas: ${matches.length}`);
}

importarPartidas()
  .catch((erro: unknown) => {
    console.error("Falha ao importar partidas normalizadas:");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
