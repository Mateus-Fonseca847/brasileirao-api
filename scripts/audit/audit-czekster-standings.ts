import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseCzeksterStandingsFile,
  type ParsedCzeksterStanding,
  type RawCzeksterStandingRow,
} from "../parsers/czekster-standings.js";

type SeasonTeamEntry = {
  season: number;
  teams: string[];
};

type StandingAdjustmentEntry = {
  season: number;
  team: string;
  adjustment: number;
  provenance: string;
  source: string;
  reason: string | null;
};

const rankingPath = resolve(
  "data/raw/czekster/ranking-2003-2019.txt",
);

const aliasesPath = resolve(
  "data/mappings/team-aliases.json",
);

const seasonTeamsPath = resolve(
  "data/normalized/season-teams.json",
);

const standingsAdjustmentsPath = resolve(
  "data/mappings/standings-adjustments.json",
);

const expectedColumns = [
  "YEAR",
  "RANKING",
  "TEAM",
  "POINTS",
  "WIN",
  "DRAW",
  "LOSE",
  "GOAL-BALANCE",
  "GOALS-PRO",
  "GOALS-AGAINST",
  "MATCHES",
  "PERFORMANCE-SCORE",
];

const requiredColumns = [
  "YEAR",
  "RANKING",
  "TEAM",
  "POINTS",
  "WIN",
  "DRAW",
  "LOSE",
  "GOALS-PRO",
  "GOALS-AGAINST",
  "MATCHES",
];

function getRowsBySeason(
  rows: ParsedCzeksterStanding[],
): Map<number, ParsedCzeksterStanding[]> {
  const bySeason = new Map<number, ParsedCzeksterStanding[]>();

  for (const row of rows) {
    bySeason.set(row.season, [
      ...(bySeason.get(row.season) ?? []),
      row,
    ]);
  }

  return bySeason;
}

function getSeasonTeamMap(entries: SeasonTeamEntry[]): Map<number, Set<string>> {
  return new Map(
    entries.map((entry) => [
      entry.season,
      new Set(entry.teams),
    ]),
  );
}

function findDuplicateCanonicalTeamSeasonRows(
  rows: ParsedCzeksterStanding[],
): Array<{ season: number; canonicalTeam: string; count: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.canonicalTeam) {
      continue;
    }

    const key = `${row.season}|${row.canonicalTeam}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [season, canonicalTeam] = key.split("|");

      return {
        season: Number(season),
        canonicalTeam: canonicalTeam ?? "",
        count,
      };
    });
}

function findMissingValues(
  rows: RawCzeksterStandingRow[],
  columns: string[],
): Record<string, number> {
  return Object.fromEntries(
    columns.map((column) => [
      column,
      rows.filter((row) => row[column]?.trim() === "").length,
    ]),
  );
}

function auditRankingPositions(
  rows: ParsedCzeksterStanding[],
): {
  sequentialAndUnique: boolean;
  failures: Array<{
    season: number;
    expectedRanking: number;
    actualRanking: number;
    canonicalTeam: string | null;
  }>;
} {
  const failures: Array<{
    season: number;
    expectedRanking: number;
    actualRanking: number;
    canonicalTeam: string | null;
  }> = [];

  for (const [season, seasonRows] of getRowsBySeason(rows)) {
    const seenRankings = new Set<number>();

    seasonRows.forEach((row, index) => {
      const expectedRanking = index + 1;

      if (
        row.ranking !== expectedRanking ||
        seenRankings.has(row.ranking)
      ) {
        failures.push({
          season,
          expectedRanking,
          actualRanking: row.ranking,
          canonicalTeam: row.canonicalTeam,
        });
      }

      seenRankings.add(row.ranking);
    });
  }

  return {
    sequentialAndUnique: failures.length === 0,
    failures,
  };
}

function compareParticipants(
  rows: ParsedCzeksterStanding[],
  seasonTeams: Map<number, Set<string>>,
): Array<{
  season: number;
  missingInCzekster: string[];
  extraInCzekster: string[];
}> {
  return [...seasonTeams.entries()]
    .filter(([season]) => season >= 2003 && season <= 2019)
    .map(([season, expectedTeams]) => {
      const czeksterTeams = new Set(
        rows
          .filter((row) => row.season === season && row.canonicalTeam !== null)
          .map((row) => row.canonicalTeam as string),
      );

      return {
        season,
        missingInCzekster: [...expectedTeams]
          .filter((team) => !czeksterTeams.has(team))
          .sort(),
        extraInCzekster: [...czeksterTeams]
          .filter((team) => !expectedTeams.has(team))
          .sort(),
      };
    });
}

function getAdjustmentKey(season: number, team: string): string {
  return `${season}|${team}`;
}

function auditMappedAdjustments(
  derivedAdjustments: Array<{
    season: number;
    canonicalTeam: string | null;
    derivedPointsAdjustment: number;
  }>,
  mappedAdjustments: StandingAdjustmentEntry[],
): {
  derivedAdjustmentsCount: number;
  matchedMappingsCount: number;
  missingMappings: Array<{
    season: number;
    team: string | null;
    adjustment: number;
  }>;
  extraMappings: StandingAdjustmentEntry[];
  mismatchedValues: Array<{
    season: number;
    team: string;
    derivedAdjustment: number;
    mappedAdjustment: number;
  }>;
  duplicateMappings: StandingAdjustmentEntry[];
  invalidMappingEntries: StandingAdjustmentEntry[];
} {
  const mappedCounts = new Map<string, number>();

  for (const entry of mappedAdjustments) {
    const key = getAdjustmentKey(entry.season, entry.team);
    mappedCounts.set(key, (mappedCounts.get(key) ?? 0) + 1);
  }

  const derivedByKey = new Map(
    derivedAdjustments
      .filter((entry) => entry.canonicalTeam !== null)
      .map((entry) => [
        getAdjustmentKey(entry.season, entry.canonicalTeam as string),
        entry,
      ]),
  );
  const mappedByKey = new Map(
    mappedAdjustments.map((entry) => [
      getAdjustmentKey(entry.season, entry.team),
      entry,
    ]),
  );

  const missingMappings = derivedAdjustments
    .filter((entry) => {
      if (entry.canonicalTeam === null) {
        return true;
      }

      return !mappedByKey.has(getAdjustmentKey(entry.season, entry.canonicalTeam));
    })
    .map((entry) => ({
      season: entry.season,
      team: entry.canonicalTeam,
      adjustment: entry.derivedPointsAdjustment,
    }));

  const extraMappings = mappedAdjustments.filter(
    (entry) => !derivedByKey.has(getAdjustmentKey(entry.season, entry.team)),
  );

  const mismatchedValues = mappedAdjustments
    .flatMap((entry) => {
      const derived = derivedByKey.get(getAdjustmentKey(entry.season, entry.team));

      if (
        !derived ||
        derived.derivedPointsAdjustment === entry.adjustment
      ) {
        return [];
      }

      return [
        {
          season: entry.season,
          team: entry.team,
          derivedAdjustment: derived.derivedPointsAdjustment,
          mappedAdjustment: entry.adjustment,
        },
      ];
    });

  const duplicateMappings = mappedAdjustments.filter(
    (entry) => (mappedCounts.get(getAdjustmentKey(entry.season, entry.team)) ?? 0) > 1,
  );

  const invalidMappingEntries = mappedAdjustments.filter(
    (entry) =>
      entry.provenance !== "DERIVED_FROM_FINAL_POINTS" ||
      entry.source !== "czekster" ||
      entry.reason !== null,
  );

  return {
    derivedAdjustmentsCount: derivedAdjustments.length,
    matchedMappingsCount:
      derivedAdjustments.length -
      missingMappings.length -
      mismatchedValues.length,
    missingMappings,
    extraMappings,
    mismatchedValues,
    duplicateMappings,
    invalidMappingEntries,
  };
}

async function runAudit(): Promise<void> {
  const parsedFile = await parseCzeksterStandingsFile(
    rankingPath,
    aliasesPath,
  );
  const seasonTeams = JSON.parse(
    await readFile(seasonTeamsPath, "utf-8"),
  ) as SeasonTeamEntry[];
  const mappedAdjustments = JSON.parse(
    await readFile(standingsAdjustmentsPath, "utf-8"),
  ) as StandingAdjustmentEntry[];

  const { columns, rawRows, standings } = parsedFile;
  const seasons = [
    ...new Set(standings.map((row) => row.season)),
  ].sort((first, second) => first - second);

  const additionalFields = columns.filter(
    (column) => !requiredColumns.includes(column),
  );

  const rankingAudit = auditRankingPositions(standings);
  const seasonTeamMap = getSeasonTeamMap(seasonTeams);
  const participantComparison = compareParticipants(
    standings,
    seasonTeamMap,
  );

  const nonZeroDerivedPointAdjustments = standings
    .map((row) => {
      const expectedPointsWithoutAdjustment = row.wins * 3 + row.draws;
      const derivedPointsAdjustment =
        row.points - expectedPointsWithoutAdjustment;

      return {
        season: row.season,
        canonicalTeam: row.canonicalTeam,
        ranking: row.ranking,
        officialPoints: row.points,
        wins: row.wins,
        draws: row.draws,
        expectedPointsWithoutAdjustment,
        derivedPointsAdjustment,
      };
    })
    .filter((row) => row.derivedPointsAdjustment !== 0);
  const mappedAdjustmentsAudit = auditMappedAdjustments(
    nonZeroDerivedPointAdjustments,
    mappedAdjustments,
  );

  if (
    mappedAdjustmentsAudit.missingMappings.length > 0 ||
    mappedAdjustmentsAudit.extraMappings.length > 0 ||
    mappedAdjustmentsAudit.mismatchedValues.length > 0 ||
    mappedAdjustmentsAudit.duplicateMappings.length > 0 ||
    mappedAdjustmentsAudit.invalidMappingEntries.length > 0
  ) {
    console.error(
      JSON.stringify(
        {
          failedValidation: "standings adjustments mapping mismatch",
          mappedAdjustmentsAudit,
        },
        null,
        2,
      ),
    );
    throw new Error("Standings adjustments mapping does not match audit.");
  }

  const auditSummary = {
    sourceFile: rankingPath,
    encoding: parsedFile.encoding,
    delimiter: parsedFile.delimiter,
    detectedColumns: columns,
    expectedColumnsMatch:
      JSON.stringify(columns) === JSON.stringify(expectedColumns),
    totalRows: rawRows.length,
    rowsPerSeason: [...getRowsBySeason(standings).entries()]
      .map(([season, seasonRows]) => ({
        season,
        rows: seasonRows.length,
      }))
      .sort((first, second) => first.season - second.season),
    seasonsPresent: seasons,
    expectedCoverageOnly2003To2019:
      seasons.length === 17 &&
      seasons[0] === 2003 &&
      seasons[seasons.length - 1] === 2019,
    uniqueTeamsPerSeason: [...getRowsBySeason(standings).entries()]
      .map(([season, seasonRows]) => ({
        season,
        uniqueTeams: new Set(
          seasonRows.map((row) => row.canonicalTeam ?? row.sourceTeam),
        ).size,
      }))
      .sort((first, second) => first.season - second.season),
    duplicatedCanonicalTeamSeasonRows:
      findDuplicateCanonicalTeamSeasonRows(standings),
    missingValues: findMissingValues(rawRows, columns),
    explicitFields: {
      position: columns.includes("RANKING"),
      points: columns.includes("POINTS"),
      played: columns.includes("MATCHES"),
      wins: columns.includes("WIN"),
      draws: columns.includes("DRAW"),
      losses: columns.includes("LOSE"),
      goalsFor: columns.includes("GOALS-PRO"),
      goalsAgainst: columns.includes("GOALS-AGAINST"),
    },
    additionalFields,
    pointAdjustments: {
      explicitPointAdjustmentField: false,
      containsOnlyFinalPoints: columns.includes("POINTS"),
      derivedPointAdjustmentsAreSourceProvided: false,
      nonZeroDerivedPointAdjustments,
      mappedAdjustmentsAudit,
    },
    orderingRepresentsFinalClassification:
      rankingAudit.sequentialAndUnique,
    rankingPositions: rankingAudit,
    rowValidations: {
      unresolvedTeams: standings
        .filter((row) => row.canonicalTeam === null)
        .map((row) => ({
          season: row.season,
          sourceTeam: row.sourceTeam,
          normalizedTeamName: row.normalizedTeamName,
          resolutionInput: row.resolutionInput,
        })),
      invalidMatchesFormula: standings
        .filter((row) => row.matches !== row.wins + row.draws + row.losses)
        .map((row) => ({
          season: row.season,
          canonicalTeam: row.canonicalTeam,
          matches: row.matches,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
        })),
      invalidGoalBalanceFormula: standings
        .filter(
          (row) =>
            row.goalBalance !== row.goalsFor - row.goalsAgainst,
        )
        .map((row) => ({
          season: row.season,
          canonicalTeam: row.canonicalTeam,
          goalBalance: row.goalBalance,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
        })),
      teamsOutsideSeasonTeams: standings
        .filter(
          (row) =>
            row.canonicalTeam !== null &&
            !seasonTeamMap.get(row.season)?.has(row.canonicalTeam),
        )
        .map((row) => ({
          season: row.season,
          canonicalTeam: row.canonicalTeam,
        })),
    },
    participantComparison,
  };

  console.log(JSON.stringify(auditSummary, null, 2));
}

runAudit().catch((error: unknown) => {
  console.error("Failed to audit Czekster standings:");
  console.error(error);
  process.exitCode = 1;
});
