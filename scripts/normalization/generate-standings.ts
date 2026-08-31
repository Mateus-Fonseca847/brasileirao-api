import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { parseCzeksterStandingsFile } from "../parsers/czekster-standings.js";

type TeamEntry = {
  slug: string;
  name: string;
};

type SeasonTeamEntry = {
  season: number;
  teams: string[];
};

type StandingAdjustmentEntry = {
  season: number;
  team: string;
  adjustment: number;
  provenance: "DERIVED_FROM_FINAL_POINTS";
  source: "czekster";
  reason: null;
};

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

const rankingPath = resolve(
  "data/raw/czekster/ranking-2003-2019.txt",
);

const aliasesPath = resolve(
  "data/mappings/team-aliases.json",
);

const teamsPath = resolve(
  "data/mappings/teams.json",
);

const seasonTeamsPath = resolve(
  "data/normalized/season-teams.json",
);

const standingsAdjustmentsPath = resolve(
  "data/mappings/standings-adjustments.json",
);

const outputPath = resolve(
  "data/normalized/standings.json",
);

const expectedRowsBySeason = new Map([
  [2003, 24],
  [2004, 24],
  [2005, 22],
  [2006, 20],
  [2007, 20],
  [2008, 20],
  [2009, 20],
  [2010, 20],
  [2011, 20],
  [2012, 20],
  [2013, 20],
  [2014, 20],
  [2015, 20],
  [2016, 20],
  [2017, 20],
  [2018, 20],
  [2019, 20],
]);

function getKey(season: number, value: string | number): string {
  return `${season}|${value}`;
}

function getAdjustmentKey(season: number, team: string): string {
  return getKey(season, team);
}

function readJsonFile<T>(path: string): Promise<T> {
  return readFile(path, "utf-8").then((content) => JSON.parse(content) as T);
}

function countBySeason(
  standings: NormalizedStanding[],
): Array<{ season: number; rows: number }> {
  return [...expectedRowsBySeason.keys()].map((season) => ({
    season,
    rows: standings.filter((standing) => standing.season === season).length,
  }));
}

function validateStandings(
  standings: NormalizedStanding[],
  teams: TeamEntry[],
  seasonTeams: SeasonTeamEntry[],
  adjustments: StandingAdjustmentEntry[],
): {
  totalRecords: number;
  seasons: number[];
  rowsPerSeason: Array<{ season: number; rows: number }>;
  duplicateSeasonTeams: string[];
  duplicateSeasonPositions: string[];
  teamsMissingFromCatalog: string[];
  teamsOutsideSeasonTeams: Array<{ season: number; team: string }>;
  invalidPlayedFormula: Array<{ season: number; team: string }>;
  invalidGoalDifferenceFormula: Array<{ season: number; team: string }>;
  invalidPointsFormula: Array<{ season: number; team: string }>;
  nonZeroPointsAdjustmentCount: number;
  adjustmentMappingsCount: number;
  missingAdjustmentMappings: Array<{ season: number; team: string }>;
  extraAdjustmentMappings: Array<{ season: number; team: string }>;
  mismatchedAdjustmentMappings: Array<{
    season: number;
    team: string;
    standingAdjustment: number;
    mappedAdjustment: number;
  }>;
} {
  const teamSlugs = new Set(teams.map((team) => team.slug));
  const seasonTeamMap = new Map(
    seasonTeams.map((entry) => [
      entry.season,
      new Set(entry.teams),
    ]),
  );
  const adjustmentMap = new Map(
    adjustments.map((entry) => [
      getAdjustmentKey(entry.season, entry.team),
      entry,
    ]),
  );
  const seasonTeamCounts = new Map<string, number>();
  const seasonPositionCounts = new Map<string, number>();

  for (const standing of standings) {
    const teamKey = getKey(standing.season, standing.team);
    const positionKey = getKey(standing.season, standing.position);
    seasonTeamCounts.set(teamKey, (seasonTeamCounts.get(teamKey) ?? 0) + 1);
    seasonPositionCounts.set(
      positionKey,
      (seasonPositionCounts.get(positionKey) ?? 0) + 1,
    );
  }

  const duplicateSeasonTeams = [...seasonTeamCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const duplicateSeasonPositions = [...seasonPositionCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const teamsMissingFromCatalog = [
    ...new Set(
      standings
        .filter((standing) => !teamSlugs.has(standing.team))
        .map((standing) => standing.team),
    ),
  ].sort();
  const teamsOutsideSeasonTeams = standings
    .filter(
      (standing) =>
        !seasonTeamMap.get(standing.season)?.has(standing.team),
    )
    .map((standing) => ({
      season: standing.season,
      team: standing.team,
    }));
  const invalidPlayedFormula = standings
    .filter(
      (standing) =>
        standing.played !==
        standing.wins + standing.draws + standing.losses,
    )
    .map((standing) => ({
      season: standing.season,
      team: standing.team,
    }));
  const invalidGoalDifferenceFormula = standings
    .filter(
      (standing) =>
        standing.goalDifference !==
        standing.goalsFor - standing.goalsAgainst,
    )
    .map((standing) => ({
      season: standing.season,
      team: standing.team,
    }));
  const invalidPointsFormula = standings
    .filter(
      (standing) =>
        standing.points !==
        standing.wins * 3 + standing.draws + standing.pointsAdjustment,
    )
    .map((standing) => ({
      season: standing.season,
      team: standing.team,
    }));
  const adjustedStandings = standings.filter(
    (standing) => standing.pointsAdjustment !== 0,
  );
  const adjustedStandingMap = new Map(
    adjustedStandings.map((standing) => [
      getAdjustmentKey(standing.season, standing.team),
      standing,
    ]),
  );
  const missingAdjustmentMappings = adjustedStandings
    .filter(
      (standing) =>
        !adjustmentMap.has(getAdjustmentKey(standing.season, standing.team)),
    )
    .map((standing) => ({
      season: standing.season,
      team: standing.team,
    }));
  const extraAdjustmentMappings = adjustments
    .filter(
      (entry) =>
        !adjustedStandingMap.has(getAdjustmentKey(entry.season, entry.team)),
    )
    .map((entry) => ({
      season: entry.season,
      team: entry.team,
    }));
  const mismatchedAdjustmentMappings = adjustments.flatMap((entry) => {
    const standing = adjustedStandingMap.get(
      getAdjustmentKey(entry.season, entry.team),
    );

    if (!standing || standing.pointsAdjustment === entry.adjustment) {
      return [];
    }

    return [
      {
        season: entry.season,
        team: entry.team,
        standingAdjustment: standing.pointsAdjustment,
        mappedAdjustment: entry.adjustment,
      },
    ];
  });

  return {
    totalRecords: standings.length,
    seasons: [...new Set(standings.map((standing) => standing.season))].sort(
      (first, second) => first - second,
    ),
    rowsPerSeason: countBySeason(standings),
    duplicateSeasonTeams,
    duplicateSeasonPositions,
    teamsMissingFromCatalog,
    teamsOutsideSeasonTeams,
    invalidPlayedFormula,
    invalidGoalDifferenceFormula,
    invalidPointsFormula,
    nonZeroPointsAdjustmentCount: adjustedStandings.length,
    adjustmentMappingsCount: adjustments.length,
    missingAdjustmentMappings,
    extraAdjustmentMappings,
    mismatchedAdjustmentMappings,
  };
}

function assertValidation(
  validation: ReturnType<typeof validateStandings>,
): void {
  const expectedSeasons = [...expectedRowsBySeason.keys()];
  const invalidRowsPerSeason = validation.rowsPerSeason.filter(
    ({ season, rows }) => rows !== expectedRowsBySeason.get(season),
  );
  const hasUnexpectedResult =
    validation.totalRecords !== 350 ||
    JSON.stringify(validation.seasons) !== JSON.stringify(expectedSeasons) ||
    invalidRowsPerSeason.length > 0 ||
    validation.duplicateSeasonTeams.length > 0 ||
    validation.duplicateSeasonPositions.length > 0 ||
    validation.teamsMissingFromCatalog.length > 0 ||
    validation.teamsOutsideSeasonTeams.length > 0 ||
    validation.invalidPlayedFormula.length > 0 ||
    validation.invalidGoalDifferenceFormula.length > 0 ||
    validation.invalidPointsFormula.length > 0 ||
    validation.nonZeroPointsAdjustmentCount !== 11 ||
    validation.adjustmentMappingsCount !== 11 ||
    validation.missingAdjustmentMappings.length > 0 ||
    validation.extraAdjustmentMappings.length > 0 ||
    validation.mismatchedAdjustmentMappings.length > 0;

  if (hasUnexpectedResult) {
    console.error(JSON.stringify(validation, null, 2));
    throw new Error("Normalized standings validation failed.");
  }
}

async function main(): Promise<void> {
  const parsedFile = await parseCzeksterStandingsFile(
    rankingPath,
    aliasesPath,
  );
  const teams = await readJsonFile<TeamEntry[]>(teamsPath);
  const seasonTeams = await readJsonFile<SeasonTeamEntry[]>(seasonTeamsPath);
  const adjustments = await readJsonFile<StandingAdjustmentEntry[]>(
    standingsAdjustmentsPath,
  );
  const adjustmentMap = new Map(
    adjustments.map((entry) => [
      getAdjustmentKey(entry.season, entry.team),
      entry,
    ]),
  );
  const standings: NormalizedStanding[] = parsedFile.standings.map((row) => {
    if (!row.canonicalTeam) {
      throw new Error(`Unresolved team: ${row.sourceTeam}`);
    }

    const adjustment =
      adjustmentMap.get(getAdjustmentKey(row.season, row.canonicalTeam))
        ?.adjustment ?? 0;

    return {
      source: "czekster",
      season: row.season,
      team: row.canonicalTeam,
      position: row.ranking,
      points: row.points,
      played: row.matches,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalBalance,
      pointsAdjustment: adjustment,
      adjustmentProvenance:
        adjustment !== 0 ? "DERIVED_FROM_FINAL_POINTS" : null,
    };
  });
  const validation = validateStandings(
    standings,
    teams,
    seasonTeams,
    adjustments,
  );

  assertValidation(validation);

  await mkdir(dirname(outputPath), {
    recursive: true,
  });
  await writeFile(
    outputPath,
    `${JSON.stringify(standings, null, 2)}\n`,
    "utf-8",
  );

  console.log(
    JSON.stringify(
      {
        outputFile: outputPath,
        recordStructure: [
          "source",
          "season",
          "team",
          "position",
          "points",
          "played",
          "wins",
          "draws",
          "losses",
          "goalsFor",
          "goalsAgainst",
          "goalDifference",
          "pointsAdjustment",
          "adjustmentProvenance",
        ],
        validation,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error("Failed to generate normalized standings:");
  console.error(error);
  process.exitCode = 1;
});
