import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type Score = {
  home: number | null;
  away: number | null;
};

type NormalizedStatMatch = {
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

type NormalizedMatchTeamStat = {
  source: string;
  sourceMatchId: number;
  match: NormalizedStatMatch;
  team: string;
  shots: number;
  possession: number;
  yellowCards: null;
  redCards: null;
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

type MatchResolution = {
  matchId: string;
  teamId: string;
  stat: NormalizedMatchTeamStat;
};

const matchTeamStatsPath = new URL(
  "../../data/normalized/match-team-stats.json",
  import.meta.url,
);

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

function isNormalizedStatMatch(value: unknown): value is NormalizedStatMatch {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const match = value as Partial<NormalizedStatMatch>;

  return (
    typeof match.season === "number" &&
    (typeof match.round === "number" || match.round === null) &&
    (typeof match.date === "string" || match.date === null) &&
    (typeof match.kickoffTime === "string" || match.kickoffTime === null) &&
    (typeof match.stadium === "string" || match.stadium === null) &&
    typeof match.homeTeam === "string" &&
    typeof match.awayTeam === "string" &&
    isScore(match.officialScore) &&
    (isScore(match.playedScore) || match.playedScore === null) &&
    match.status === "FINISHED"
  );
}

function isNormalizedMatchTeamStats(
  value: unknown,
): value is NormalizedMatchTeamStat[] {
  return (
    Array.isArray(value) &&
    value.every((stat) => {
      if (typeof stat !== "object" || stat === null) {
        return false;
      }

      const candidate = stat as Partial<NormalizedMatchTeamStat>;

      return (
        typeof candidate.source === "string" &&
        typeof candidate.sourceMatchId === "number" &&
        isNormalizedStatMatch(candidate.match) &&
        typeof candidate.team === "string" &&
        typeof candidate.shots === "number" &&
        typeof candidate.possession === "number" &&
        candidate.yellowCards === null &&
        candidate.redCards === null
      );
    })
  );
}

function formatDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function formatTime(value: Date | null): string | null {
  return value?.toISOString().slice(11, 16) ?? null;
}

function createMatchSignature(match: PersistedMatchComparable): string {
  return JSON.stringify(match);
}

function toComparableMatch(match: NormalizedStatMatch): PersistedMatchComparable {
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

async function resolveMatchesAndTeams(
  stats: NormalizedMatchTeamStat[],
): Promise<MatchResolution[]> {
  const persistedMatches = await prisma.match.findMany({
    select: {
      id: true,
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

  const matchesBySignature = new Map<string, string[]>();

  for (const match of persistedMatches) {
    const signature = createMatchSignature({
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
    });

    const matches = matchesBySignature.get(signature) ?? [];
    matches.push(match.id);
    matchesBySignature.set(signature, matches);
  }

  const teamSlugs = [...new Set(stats.map((stat) => stat.team))];
  const teams = await prisma.team.findMany({
    where: {
      slug: {
        in: teamSlugs,
      },
    },
    select: {
      id: true,
      slug: true,
    },
  });

  const teamIdsBySlug = new Map(teams.map((team) => [team.slug, team.id]));
  const missingTeams = teamSlugs.filter((slug) => !teamIdsBySlug.has(slug));
  const missingMatches: string[] = [];
  const ambiguousMatches: string[] = [];
  const resolutions: MatchResolution[] = [];

  if (missingTeams.length > 0) {
    throw new Error(`Missing teams: ${missingTeams.join(", ")}`);
  }

  for (const stat of stats) {
    const signature = createMatchSignature(toComparableMatch(stat.match));
    const matches = matchesBySignature.get(signature) ?? [];
    const teamId = teamIdsBySlug.get(stat.team);

    if (matches.length === 0) {
      missingMatches.push(
        `${stat.source}:${stat.sourceMatchId}:${signature}`,
      );
      continue;
    }

    if (matches.length > 1) {
      ambiguousMatches.push(
        `${stat.source}:${stat.sourceMatchId}:${signature}`,
      );
      continue;
    }

    if (!teamId) {
      throw new Error(`Missing team: ${stat.team}`);
    }

    resolutions.push({
      matchId: matches[0],
      teamId,
      stat,
    });
  }

  if (missingMatches.length > 0 || ambiguousMatches.length > 0) {
    throw new Error(
      [
        missingMatches.length > 0
          ? `Missing matches: ${missingMatches.slice(0, 10).join("; ")}`
          : null,
        ambiguousMatches.length > 0
          ? `Ambiguous matches: ${ambiguousMatches.slice(0, 10).join("; ")}`
          : null,
      ]
        .filter((message) => message !== null)
        .join("\n"),
    );
  }

  return resolutions;
}

async function importMatchTeamStats(): Promise<void> {
  const fileContent = await readFile(matchTeamStatsPath, "utf8");
  const stats: unknown = JSON.parse(fileContent);

  if (!isNormalizedMatchTeamStats(stats)) {
    throw new Error("Invalid normalized match-team stats dataset.");
  }

  const resolutions = await resolveMatchesAndTeams(stats);

for (let index = 0; index < resolutions.length; index += batchSize) {
  const batch = resolutions.slice(index, index + batchSize);

  await Promise.all(
    batch.map(({ matchId, teamId, stat }) =>
      prisma.matchTeamStat.upsert({
        where: {
          matchId_teamId: {
            matchId,
            teamId,
          },
        },
        create: {
          matchId,
          teamId,
          shots: stat.shots,
          possession: stat.possession,
          yellowCards: null,
          redCards: null,
        },
        update: {
          shots: stat.shots,
          possession: stat.possession,
          yellowCards: null,
          redCards: null,
        },
      }),
    ),
  );
}

  console.log(`Match-team stats imported: ${stats.length}`);
}

importMatchTeamStats()
  .catch((error: unknown) => {
    console.error("Failed to import match-team stats:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
