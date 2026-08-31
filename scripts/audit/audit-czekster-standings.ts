import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  parseCzeksterStandingsFile,
  type CzeksterSourceCorrection,
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

type DerivedPointAdjustment = {
  season: number;
  canonicalTeam: string | null;
  ranking: number;
  officialPoints: number;
  wins: number;
  draws: number;
  expectedPointsWithoutAdjustment: number;
  derivedPointsAdjustment: number;
};

const previousRankingPath = resolve(
  "data/raw/czekster/ranking-2003-2019.txt",
);

const extendedRankingPath = resolve(
  "data/raw/czekster/ranking-2003-2024.txt",
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

const standingsSourceCorrectionsPath = resolve(
  "data/mappings/standings-source-corrections.json",
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
  firstSeason: number,
  lastSeason: number,
): Array<{
  season: number;
  missingInCzekster: string[];
  extraInCzekster: string[];
}> {
  return [...seasonTeams.entries()]
    .filter(([season]) => season >= firstSeason && season <= lastSeason)
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

function getDerivedPointAdjustments(
  rows: ParsedCzeksterStanding[],
): DerivedPointAdjustment[] {
  return rows
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
}

function auditMappedAdjustments(
  derivedAdjustments: DerivedPointAdjustment[],
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

      return !mappedByKey.has(
        getAdjustmentKey(entry.season, entry.canonicalTeam),
      );
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
      const derived = derivedByKey.get(
        getAdjustmentKey(entry.season, entry.team),
      );

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
    (entry) =>
      (mappedCounts.get(getAdjustmentKey(entry.season, entry.team)) ?? 0) > 1,
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

function compareValidatedRows(
  previousRows: RawCzeksterStandingRow[],
  extendedRows: RawCzeksterStandingRow[],
): {
  comparedRows: number;
  changedBetweenSourceVersions: boolean;
  missingRows: RawCzeksterStandingRow[];
  extraRows: RawCzeksterStandingRow[];
  changedRows: Array<{
    key: string;
    previous: RawCzeksterStandingRow;
    extended: RawCzeksterStandingRow;
  }>;
} {
  const getRowKey = (row: RawCzeksterStandingRow): string =>
    `${row.YEAR}|${row.RANKING}|${row.TEAM}`;
  const previousComparableRows = previousRows.filter(
    (row) => Number(row.YEAR) >= 2003 && Number(row.YEAR) <= 2019,
  );
  const extendedComparableRows = extendedRows.filter(
    (row) => Number(row.YEAR) >= 2003 && Number(row.YEAR) <= 2019,
  );
  const previousByKey = new Map(
    previousComparableRows.map((row) => [getRowKey(row), row]),
  );
  const extendedByKey = new Map(
    extendedComparableRows.map((row) => [getRowKey(row), row]),
  );
  const missingRows = previousComparableRows.filter(
    (row) => !extendedByKey.has(getRowKey(row)),
  );
  const extraRows = extendedComparableRows.filter(
    (row) => !previousByKey.has(getRowKey(row)),
  );
  const changedRows = previousComparableRows.flatMap((row) => {
    const key = getRowKey(row);
    const extended = extendedByKey.get(key);

    if (!extended || JSON.stringify(row) === JSON.stringify(extended)) {
      return [];
    }

    return [
      {
        key,
        previous: row,
        extended,
      },
    ];
  });

  return {
    comparedRows: previousComparableRows.length,
    changedBetweenSourceVersions:
      missingRows.length > 0 ||
      extraRows.length > 0 ||
      changedRows.length > 0,
    missingRows,
    extraRows,
    changedRows,
  };
}

function auditDeclaredGoalColumns(
  rows: ParsedCzeksterStanding[],
): {
  invalidDeclaredGoalDifferenceRows: Array<{
    season: number;
    canonicalTeam: string | null;
    ranking: number;
    declaredGoalBalance: number;
    declaredGoalsFor: number;
    declaredGoalsAgainst: number;
  }>;
  invalidDeclaredGoalDifferenceBySeason: Array<{
    season: number;
    invalidRows: number;
  }>;
  suspectedColumnOrderAnomaly2023: {
    invalidUnderDeclaredHeaderRows: number;
    allRowsMatchGoalsForGoalsAgainstGoalBalanceOrder: boolean;
    analysis: string;
  };
} {
  const invalidDeclaredGoalDifferenceRows = rows
    .filter((row) => row.goalBalance !== row.goalsFor - row.goalsAgainst)
    .map((row) => ({
      season: row.season,
      canonicalTeam: row.canonicalTeam,
      ranking: row.ranking,
      declaredGoalBalance: row.goalBalance,
      declaredGoalsFor: row.goalsFor,
      declaredGoalsAgainst: row.goalsAgainst,
    }));
  const invalidDeclaredGoalDifferenceBySeason = [
    ...getRowsBySeason(rows).entries(),
  ]
    .map(([season, seasonRows]) => ({
      season,
      invalidRows: seasonRows.filter(
        (row) => row.goalBalance !== row.goalsFor - row.goalsAgainst,
      ).length,
    }))
    .filter((entry) => entry.invalidRows > 0)
    .sort((first, second) => first.season - second.season);
  const rows2023 = rows.filter((row) => row.season === 2023);
  const invalid2023Rows = rows2023.filter(
    (row) => row.goalBalance !== row.goalsFor - row.goalsAgainst,
  );
  const allRowsMatchGoalsForGoalsAgainstGoalBalanceOrder =
    rows2023.length > 0 &&
    rows2023.every(
      (row) => row.goalBalance - row.goalsFor === row.goalsAgainst,
    );

  return {
    invalidDeclaredGoalDifferenceRows,
    invalidDeclaredGoalDifferenceBySeason,
    suspectedColumnOrderAnomaly2023: {
      invalidUnderDeclaredHeaderRows: invalid2023Rows.length,
      allRowsMatchGoalsForGoalsAgainstGoalBalanceOrder,
      analysis:
        invalid2023Rows.length === rows2023.length &&
        allRowsMatchGoalsForGoalsAgainstGoalBalanceOrder
          ? "2023 rows fail under declared GOAL-BALANCE;GOALS-PRO;GOALS-AGAINST header, but consistently match GOALS-PRO;GOALS-AGAINST;GOAL-BALANCE ordering."
          : "No consistent 2023 column-order anomaly detected.",
    },
  };
}

function auditSourceCorrections(
  declaredGoalColumnsAudit: ReturnType<typeof auditDeclaredGoalColumns>,
  corrections: CzeksterSourceCorrection[],
): {
  sourceAnomaliesDetected: Array<{
    source: "czekster";
    season: number;
    type: "SOURCE_COLUMN_ORDER_CORRECTION";
    declaredOrder: string[];
    actualOrder: string[];
    affectedRows: number;
  }>;
  correctionsMatched: number;
  missingCorrections: Array<{
    source: "czekster";
    season: number;
    type: "SOURCE_COLUMN_ORDER_CORRECTION";
  }>;
  extraCorrections: CzeksterSourceCorrection[];
  mismatchedCorrections: CzeksterSourceCorrection[];
} {
  const sourceAnomaliesDetected =
    declaredGoalColumnsAudit.suspectedColumnOrderAnomaly2023
      .invalidUnderDeclaredHeaderRows === 20 &&
    declaredGoalColumnsAudit.suspectedColumnOrderAnomaly2023
      .allRowsMatchGoalsForGoalsAgainstGoalBalanceOrder
      ? [
          {
            source: "czekster" as const,
            season: 2023,
            type: "SOURCE_COLUMN_ORDER_CORRECTION" as const,
            declaredOrder: [
              "GOAL-BALANCE",
              "GOALS-PRO",
              "GOALS-AGAINST",
            ],
            actualOrder: [
              "GOALS-PRO",
              "GOALS-AGAINST",
              "GOAL-BALANCE",
            ],
            affectedRows: 20,
          },
        ]
      : [];
  const correctionKey = (correction: {
    source: string;
    season: number;
    type: string;
  }): string => `${correction.source}|${correction.season}|${correction.type}`;
  const anomaliesByKey = new Map(
    sourceAnomaliesDetected.map((anomaly) => [
      correctionKey(anomaly),
      anomaly,
    ]),
  );
  const correctionsByKey = new Map(
    corrections.map((correction) => [
      correctionKey(correction),
      correction,
    ]),
  );
  const missingCorrections = sourceAnomaliesDetected
    .filter((anomaly) => !correctionsByKey.has(correctionKey(anomaly)))
    .map((anomaly) => ({
      source: anomaly.source,
      season: anomaly.season,
      type: anomaly.type,
    }));
  const extraCorrections = corrections.filter(
    (correction) => !anomaliesByKey.has(correctionKey(correction)),
  );
  const mismatchedCorrections = corrections.filter((correction) => {
    const anomaly = anomaliesByKey.get(correctionKey(correction));

    if (!anomaly) {
      return false;
    }

    return (
      JSON.stringify(correction.declaredOrder) !==
        JSON.stringify(anomaly.declaredOrder) ||
      JSON.stringify(correction.actualOrder) !==
        JSON.stringify(anomaly.actualOrder) ||
      correction.affectedRows !== anomaly.affectedRows ||
      correction.reason !==
        "2023 rows consistently use a different column order than the declared header"
    );
  });

  return {
    sourceAnomaliesDetected,
    correctionsMatched:
      sourceAnomaliesDetected.length -
      missingCorrections.length -
      mismatchedCorrections.length,
    missingCorrections,
    extraCorrections,
    mismatchedCorrections,
  };
}

async function getFileMetadata(path: string): Promise<{
  fileSizeBytes: number;
  sha256: string;
}> {
  const [metadata, bytes] = await Promise.all([
    stat(path),
    readFile(path),
  ]);

  return {
    fileSizeBytes: metadata.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function runAudit(): Promise<void> {
  const [
    previousFile,
    declaredExtendedFile,
    correctedExtendedFile,
    fileMetadata,
  ] = await Promise.all([
    parseCzeksterStandingsFile(previousRankingPath, aliasesPath),
    parseCzeksterStandingsFile(extendedRankingPath, aliasesPath),
    parseCzeksterStandingsFile(
      extendedRankingPath,
      aliasesPath,
      standingsSourceCorrectionsPath,
    ),
    getFileMetadata(extendedRankingPath),
  ]);
  const seasonTeams = JSON.parse(
    await readFile(seasonTeamsPath, "utf-8"),
  ) as SeasonTeamEntry[];
  const mappedAdjustments = JSON.parse(
    await readFile(standingsAdjustmentsPath, "utf-8"),
  ) as StandingAdjustmentEntry[];
  const sourceCorrections = JSON.parse(
    await readFile(standingsSourceCorrectionsPath, "utf-8"),
  ) as CzeksterSourceCorrection[];

  const { columns, rawRows, standings } = correctedExtendedFile;
  const seasons = [
    ...new Set(standings.map((row) => row.season)),
  ].sort((first, second) => first - second);
  const rows2020To2024 = standings.filter(
    (row) => row.season >= 2020 && row.season <= 2024,
  );
  const additionalFields = columns.filter(
    (column) => !requiredColumns.includes(column),
  );
  const rankingAudit2020To2024 = auditRankingPositions(rows2020To2024);
  const seasonTeamMap = getSeasonTeamMap(seasonTeams);
  const participantComparison2020To2024 = compareParticipants(
    standings,
    seasonTeamMap,
    2020,
    2024,
  );
  const allDerivedPointAdjustments = getDerivedPointAdjustments(standings);
  const validatedDerivedPointAdjustments = allDerivedPointAdjustments.filter(
    (entry) => entry.season <= 2019,
  );
  const extensionDerivedPointAdjustments = allDerivedPointAdjustments.filter(
    (entry) => entry.season >= 2020 && entry.season <= 2024,
  );
  const mappedAdjustmentsAudit = auditMappedAdjustments(
    validatedDerivedPointAdjustments,
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

  const declaredGoalColumnsAudit = auditDeclaredGoalColumns(
    declaredExtendedFile.standings,
  );
  const sourceCorrectionsAudit = auditSourceCorrections(
    declaredGoalColumnsAudit,
    sourceCorrections,
  );
  const invalidCorrectedGoalDifferenceRows = standings
    .filter((row) => row.goalBalance !== row.goalsFor - row.goalsAgainst)
    .map((row) => ({
      season: row.season,
      canonicalTeam: row.canonicalTeam,
      ranking: row.ranking,
    }));

  if (
    sourceCorrectionsAudit.missingCorrections.length > 0 ||
    sourceCorrectionsAudit.extraCorrections.length > 0 ||
    sourceCorrectionsAudit.mismatchedCorrections.length > 0 ||
    invalidCorrectedGoalDifferenceRows.length > 0
  ) {
    console.error(
      JSON.stringify(
        {
          failedValidation: "standings source corrections mismatch",
          sourceCorrectionsAudit,
          invalidCorrectedGoalDifferenceRows,
        },
        null,
        2,
      ),
    );
    throw new Error("Standings source corrections do not match audit.");
  }

  const auditSummary = {
    sourceFile: extendedRankingPath,
    fileMetadata,
    encoding: correctedExtendedFile.encoding,
    delimiter: correctedExtendedFile.delimiter,
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
    expectedCoverageOnly2003To2024:
      seasons.length === 22 &&
      seasons[0] === 2003 &&
      seasons[seasons.length - 1] === 2024,
    comparisonAgainstValidated2003To2019: compareValidatedRows(
      previousFile.rawRows,
      rawRows,
    ),
    validation2020To2024: {
      totalRows: rows2020To2024.length,
      rowsPerSeason: [...getRowsBySeason(rows2020To2024).entries()]
        .map(([season, seasonRows]) => ({
          season,
          rows: seasonRows.length,
        }))
        .sort((first, second) => first.season - second.season),
      exactly20TeamsPerSeason: [...getRowsBySeason(rows2020To2024).entries()]
        .every(([, seasonRows]) => seasonRows.length === 20),
      rankingPositions: rankingAudit2020To2024,
      uniqueTeamsPerSeason: [...getRowsBySeason(rows2020To2024).entries()]
        .map(([season, seasonRows]) => ({
          season,
          uniqueTeams: new Set(
            seasonRows.map((row) => row.canonicalTeam ?? row.sourceTeam),
          ).size,
        }))
        .sort((first, second) => first.season - second.season),
      duplicatedCanonicalTeamSeasonRows:
        findDuplicateCanonicalTeamSeasonRows(rows2020To2024),
      missingValues: findMissingValues(
        rawRows.filter(
          (row) => Number(row.YEAR) >= 2020 && Number(row.YEAR) <= 2024,
        ),
        columns,
      ),
      unresolvedTeams: rows2020To2024
        .filter((row) => row.canonicalTeam === null)
        .map((row) => ({
          season: row.season,
          sourceTeam: row.sourceTeam,
          normalizedTeamName: row.normalizedTeamName,
          resolutionInput: row.resolutionInput,
        })),
      invalidMatchesFormula: rows2020To2024
        .filter((row) => row.matches !== row.wins + row.draws + row.losses)
        .map((row) => ({
          season: row.season,
          canonicalTeam: row.canonicalTeam,
          matches: row.matches,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
        })),
      participantComparison: participantComparison2020To2024,
      teamsOutsideSeasonTeams: rows2020To2024
        .filter(
          (row) =>
            row.canonicalTeam !== null &&
            !seasonTeamMap.get(row.season)?.has(row.canonicalTeam),
        )
        .map((row) => ({
          season: row.season,
          canonicalTeam: row.canonicalTeam,
        })),
      pointAdjustments: {
        nonZeroDerivedPointAdjustments: extensionDerivedPointAdjustments,
      },
    },
    declaredGoalColumnsAudit,
    sourceCorrectionsAudit,
    correctedGoalColumnsAudit: {
      correctedRows: sourceCorrections
        .filter(
          (correction) =>
            correction.source === "czekster" &&
            correction.type === "SOURCE_COLUMN_ORDER_CORRECTION",
        )
        .reduce((total, correction) => total + correction.affectedRows, 0),
      allParsedRowsSatisfyGoalDifference:
        invalidCorrectedGoalDifferenceRows.length === 0,
      invalidCorrectedGoalDifferenceRows,
    },
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
    mappedAdjustmentsAudit2003To2019: mappedAdjustmentsAudit,
  };

  console.log(JSON.stringify(auditSummary, null, 2));
}

runAudit().catch((error: unknown) => {
  console.error("Failed to audit Czekster standings:");
  console.error(error);
  process.exitCode = 1;
});
