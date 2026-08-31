import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type NormalizedMatchTeamCard = {
  source: "adaoduque";
  sourceMatchId: number;
  season: number;
  round: number | null;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  team: string;
  yellowCards: number;
  redCards: number;
};

type PersistedMatchComparable = {
  season: number;
  round: number | null;
  matchDate: string | null;
  homeTeam: string;
  awayTeam: string;
};

type StatSnapshot = {
  matchId: string;
  teamId: string;
  shots: number | null;
  possession: string | null;
};

type CardResolution = {
  matchId: string;
  teamId: string;
  card: NormalizedMatchTeamCard;
};

const matchTeamCardsPath = new URL(
  "../../data/normalized/match-team-cards.json",
  import.meta.url,
);

const batchSize = 500;
const expectedRowsBySeason = new Map([
  [2014, 760],
  [2015, 760],
  [2016, 758],
  [2017, 760],
  [2018, 760],
  [2019, 760],
  [2020, 760],
  [2021, 760],
  [2022, 760],
  [2023, 760],
  [2024, 760],
]);

function isNormalizedMatchTeamCards(
  value: unknown,
): value is NormalizedMatchTeamCard[] {
  return (
    Array.isArray(value) &&
    value.every((card) => {
      if (typeof card !== "object" || card === null) {
        return false;
      }

      const candidate = card as Partial<NormalizedMatchTeamCard>;

      return (
        candidate.source === "adaoduque" &&
        typeof candidate.sourceMatchId === "number" &&
        typeof candidate.season === "number" &&
        (typeof candidate.round === "number" || candidate.round === null) &&
        (typeof candidate.date === "string" || candidate.date === null) &&
        typeof candidate.homeTeam === "string" &&
        typeof candidate.awayTeam === "string" &&
        typeof candidate.team === "string" &&
        typeof candidate.yellowCards === "number" &&
        candidate.yellowCards >= 0 &&
        typeof candidate.redCards === "number" &&
        candidate.redCards >= 0
      );
    })
  );
}

function formatDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function createMatchSignature(match: PersistedMatchComparable): string {
  return JSON.stringify(match);
}

function toComparableMatch(card: NormalizedMatchTeamCard): PersistedMatchComparable {
  return {
    season: card.season,
    round: card.round,
    matchDate: card.date,
    homeTeam: card.homeTeam,
    awayTeam: card.awayTeam,
  };
}

function getMatchTeamKey(matchId: string, teamId: string): string {
  return `${matchId}:${teamId}`;
}

function getCardSourceKey(card: NormalizedMatchTeamCard): string {
  return `${card.sourceMatchId}:${card.team}`;
}

function decimalToString(value: { toString(): string } | null): string | null {
  return value?.toString() ?? null;
}

async function getStatSnapshots(): Promise<Map<string, StatSnapshot>> {
  const rows = await prisma.matchTeamStat.findMany({
    select: {
      matchId: true,
      teamId: true,
      shots: true,
      possession: true,
    },
  });

  return new Map(
    rows.map((row) => [
      getMatchTeamKey(row.matchId, row.teamId),
      {
        matchId: row.matchId,
        teamId: row.teamId,
        shots: row.shots,
        possession: decimalToString(row.possession),
      },
    ]),
  );
}

async function resolveMatchesAndTeams(
  cards: NormalizedMatchTeamCard[],
): Promise<CardResolution[]> {
  const persistedMatches = await prisma.match.findMany({
    select: {
      id: true,
      round: true,
      matchDate: true,
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
      homeTeam: match.homeTeam.slug,
      awayTeam: match.awayTeam.slug,
    });
    const matches = matchesBySignature.get(signature) ?? [];
    matches.push(match.id);
    matchesBySignature.set(signature, matches);
  }

  const teamSlugs = [...new Set(cards.map((card) => card.team))];
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
  const invalidMatchTeams: string[] = [];
  const resolutions: CardResolution[] = [];

  if (missingTeams.length > 0) {
    throw new Error(`Missing teams: ${missingTeams.join(", ")}`);
  }

  for (const card of cards) {
    const signature = createMatchSignature(toComparableMatch(card));
    const matches = matchesBySignature.get(signature) ?? [];
    const teamId = teamIdsBySlug.get(card.team);

    if (matches.length === 0) {
      missingMatches.push(`${card.source}:${card.sourceMatchId}:${signature}`);
      continue;
    }

    if (matches.length > 1) {
      ambiguousMatches.push(`${card.source}:${card.sourceMatchId}:${signature}`);
      continue;
    }

    if (!teamId) {
      throw new Error(`Missing team: ${card.team}`);
    }

    if (card.team !== card.homeTeam && card.team !== card.awayTeam) {
      invalidMatchTeams.push(`${card.sourceMatchId}:${card.team}`);
      continue;
    }

    resolutions.push({
      matchId: matches[0] ?? "",
      teamId,
      card,
    });
  }

  if (
    missingMatches.length > 0 ||
    ambiguousMatches.length > 0 ||
    invalidMatchTeams.length > 0
  ) {
    throw new Error(
      [
        missingMatches.length > 0
          ? `Missing matches: ${missingMatches.slice(0, 10).join("; ")}`
          : null,
        ambiguousMatches.length > 0
          ? `Ambiguous matches: ${ambiguousMatches.slice(0, 10).join("; ")}`
          : null,
        invalidMatchTeams.length > 0
          ? `Teams not in resolved match: ${invalidMatchTeams
              .slice(0, 10)
              .join("; ")}`
          : null,
      ]
        .filter((message) => message !== null)
        .join("\n"),
    );
  }

  return resolutions;
}

function compareSnapshots(
  before: Map<string, StatSnapshot>,
  after: Map<string, StatSnapshot>,
): string[] {
  return [...before.entries()]
    .filter(([, snapshot]) => snapshot.shots !== null || snapshot.possession !== null)
    .filter(([key, snapshot]) => {
      const current = after.get(key);

      return (
        current === undefined ||
        current.shots !== snapshot.shots ||
        current.possession !== snapshot.possession
      );
    })
    .map(([key]) => key);
}

function assertNoDuplicateCards(cards: NormalizedMatchTeamCard[]): void {
  const counts = new Map<string, number>();

  for (const card of cards) {
    const key = getCardSourceKey(card);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate normalized match-team cards: ${duplicates.join(", ")}`);
  }
}

async function auditDatabase(
  cards: NormalizedMatchTeamCard[],
  resolutions: CardResolution[],
  beforeSnapshots: Map<string, StatSnapshot>,
): Promise<{
  totalRows: number;
  distinctMatchesRepresented: number;
  seasonsRepresented: number[];
  rowCountsBySeason: Array<{ season: number; rows: number }>;
  matchesWithInvalidTeamRecordCount: number;
  duplicateMatchTeams: number;
  orphanReferences: number;
  teamsNotInHomeAway: number;
  rowsWithNullCards: number;
  totalYellowCards: number;
  totalRedCards: number;
  valuesExactlyMatchDataset: boolean;
  changedShotsOrPossessionRows: number;
  rowsWithExistingShotsOrPossession: number;
  cardOnlyRowsWithShotsOrPossession: number;
}> {
  const rows = await prisma.matchTeamStat.findMany({
    select: {
      matchId: true,
      teamId: true,
      shots: true,
      possession: true,
      yellowCards: true,
      redCards: true,
      match: {
        select: {
          round: true,
          matchDate: true,
          season: {
            select: {
              year: true,
            },
          },
          homeTeamId: true,
          awayTeamId: true,
        },
      },
      team: {
        select: {
          slug: true,
        },
      },
    },
  });
  const rowCountsBySeason = [...expectedRowsBySeason.keys()].map((season) => ({
    season,
    rows: rows.filter((row) => row.match.season.year === season).length,
  }));
  const matchCounts = new Map<string, number>();
  const matchTeamCounts = new Map<string, number>();

  for (const row of rows) {
    matchCounts.set(row.matchId, (matchCounts.get(row.matchId) ?? 0) + 1);
    matchTeamCounts.set(
      getMatchTeamKey(row.matchId, row.teamId),
      (matchTeamCounts.get(getMatchTeamKey(row.matchId, row.teamId)) ?? 0) + 1,
    );
  }

  const expectedByResolvedKey = new Map(
    resolutions.map(({ matchId, teamId, card }) => [
      getMatchTeamKey(matchId, teamId),
      card,
    ]),
  );
  const persistedBySourceKey = new Map(
    rows.map((row) => [
      JSON.stringify({
        season: row.match.season.year,
        round: row.match.round,
        date: formatDate(row.match.matchDate),
        team: row.team.slug,
      }),
      {
        yellowCards: row.yellowCards,
        redCards: row.redCards,
      },
    ]),
  );
  const valuesExactlyMatchDataset = cards.every((card) => {
    const current = persistedBySourceKey.get(
      JSON.stringify({
        season: card.season,
        round: card.round,
        date: card.date,
        team: card.team,
      }),
    );

    return (
      current?.yellowCards === card.yellowCards &&
      current.redCards === card.redCards
    );
  });
  const afterSnapshots = await getStatSnapshots();
  const changedShotsOrPossessionRows = compareSnapshots(
    beforeSnapshots,
    afterSnapshots,
  ).length;
  const rowsWithExistingShotsOrPossession = rows.filter(
    (row) => row.shots !== null || row.possession !== null,
  ).length;
  const cardOnlyRowsWithShotsOrPossession = rows.filter((row) => {
    const key = getMatchTeamKey(row.matchId, row.teamId);

    return (
      !beforeSnapshots.has(key) &&
      (row.shots !== null || row.possession !== null)
    );
  }).length;

  return {
    totalRows: rows.length,
    distinctMatchesRepresented: new Set(rows.map((row) => row.matchId)).size,
    seasonsRepresented: [
      ...new Set(rows.map((row) => row.match.season.year)),
    ].sort((first, second) => first - second),
    rowCountsBySeason,
    matchesWithInvalidTeamRecordCount: [...matchCounts.values()].filter(
      (count) => count !== 2,
    ).length,
    duplicateMatchTeams: [...matchTeamCounts.values()].filter((count) => count > 1)
      .length,
    orphanReferences: rows.filter((row) => row.match === null || row.team === null)
      .length,
    teamsNotInHomeAway: rows.filter(
      (row) => row.teamId !== row.match.homeTeamId && row.teamId !== row.match.awayTeamId,
    ).length,
    rowsWithNullCards: rows.filter(
      (row) => row.yellowCards === null || row.redCards === null,
    ).length,
    totalYellowCards: rows.reduce(
      (total, row) => total + (row.yellowCards ?? 0),
      0,
    ),
    totalRedCards: rows.reduce((total, row) => total + (row.redCards ?? 0), 0),
    valuesExactlyMatchDataset:
      valuesExactlyMatchDataset &&
      [...expectedByResolvedKey.keys()].every((key) => {
        const row = rows.find(
          (entry) => getMatchTeamKey(entry.matchId, entry.teamId) === key,
        );

        return row !== undefined;
      }),
    changedShotsOrPossessionRows,
    rowsWithExistingShotsOrPossession,
    cardOnlyRowsWithShotsOrPossession,
  };
}

function assertDatabaseAudit(
  audit: Awaited<ReturnType<typeof auditDatabase>>,
): void {
  const expectedSeasons = [...expectedRowsBySeason.keys()];
  const invalidRowsBySeason = audit.rowCountsBySeason.filter(
    ({ season, rows }) => rows !== expectedRowsBySeason.get(season),
  );
  const hasUnexpectedResult =
    audit.totalRows !== 8358 ||
    audit.distinctMatchesRepresented !== 4179 ||
    JSON.stringify(audit.seasonsRepresented) !== JSON.stringify(expectedSeasons) ||
    invalidRowsBySeason.length > 0 ||
    audit.matchesWithInvalidTeamRecordCount > 0 ||
    audit.duplicateMatchTeams > 0 ||
    audit.orphanReferences > 0 ||
    audit.teamsNotInHomeAway > 0 ||
    audit.rowsWithNullCards > 0 ||
    audit.totalYellowCards !== 19867 ||
    audit.totalRedCards !== 1086 ||
    !audit.valuesExactlyMatchDataset ||
    audit.changedShotsOrPossessionRows > 0 ||
    audit.rowsWithExistingShotsOrPossession !== 6820 ||
    audit.cardOnlyRowsWithShotsOrPossession > 0;

  if (hasUnexpectedResult) {
    console.error(JSON.stringify(audit, null, 2));
    throw new Error("Imported match-team cards database audit failed.");
  }
}

async function importMatchTeamCards(): Promise<void> {
  const fileContent = await readFile(matchTeamCardsPath, "utf8");
  const cards: unknown = JSON.parse(fileContent);

  if (!isNormalizedMatchTeamCards(cards)) {
    throw new Error("Invalid normalized match-team cards dataset.");
  }

  assertNoDuplicateCards(cards);

  const rowsBeforeImport = await prisma.matchTeamStat.count();
  const beforeSnapshots = await getStatSnapshots();
  const resolutions = await resolveMatchesAndTeams(cards);

  await prisma.$transaction(
    async (tx) => {
      for (let index = 0; index < resolutions.length; index += batchSize) {
        const batch = resolutions.slice(index, index + batchSize);

        await Promise.all(
          batch.map(({ matchId, teamId, card }) =>
            tx.matchTeamStat.upsert({
              where: {
                matchId_teamId: {
                  matchId,
                  teamId,
                },
              },
              create: {
                matchId,
                teamId,
                shots: null,
                possession: null,
                yellowCards: card.yellowCards,
                redCards: card.redCards,
              },
              update: {
                yellowCards: card.yellowCards,
                redCards: card.redCards,
              },
            }),
          ),
        );
      }
    },
    {
      timeout: 60_000,
    },
  );

  const rowsAfterImport = await prisma.matchTeamStat.count();
  const audit = await auditDatabase(cards, resolutions, beforeSnapshots);

  assertDatabaseAudit(audit);

  console.log(
    JSON.stringify(
      {
        rowsBeforeImport,
        rowsAfterImport,
        newlyCreatedMatchTeamStatRows: rowsAfterImport - rowsBeforeImport,
        previousShotsAndPossessionValuesPreserved:
          audit.changedShotsOrPossessionRows === 0,
        audit,
      },
      null,
      2,
    ),
  );
}

importMatchTeamCards()
  .catch((error: unknown) => {
    console.error("Failed to import match-team cards:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
