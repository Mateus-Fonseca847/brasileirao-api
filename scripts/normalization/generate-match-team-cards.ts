import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  analyzeZeroEventMatchesForPlaceholderSeasons,
  getCardCategory,
  type NormalizedMatch,
  readRawCsv,
  resolveEvents,
  type ResolvedCardEvent,
  type ZeroEventValidation,
} from "../audit/audit-adaoduque-cards.js";
import { carregarAliasesDeEquipes } from "./team-names.js";

type TeamEntry = {
  slug: string;
  name: string;
};

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

const cardsPath = resolve(
  "data/raw/adaoduque/campeonato-brasileiro-cartoes.csv",
);
const rawMatchesPath = resolve(
  "data/raw/adaoduque/campeonato-brasileiro-full.csv",
);
const matchesPath = resolve("data/normalized/matches.json");
const aliasesPath = resolve("data/mappings/team-aliases.json");
const teamsPath = resolve("data/mappings/teams.json");
const zeroEventValidationsPath = resolve(
  "data/mappings/card-zero-event-validations.json",
);
const outputPath = resolve("data/normalized/match-team-cards.json");

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

function readJsonFile<T>(path: string): Promise<T> {
  return readFile(path, "utf-8").then((content) => JSON.parse(content) as T);
}

function getMatchTeamKey(sourceMatchId: number, team: string): string {
  return `${sourceMatchId}:${team}`;
}

function getSeasonRange(start: number, end: number): number[] {
  return Array.from(
    {
      length: end - start + 1,
    },
    (_, index) => start + index,
  );
}

function getResolvedEventCounts(events: ResolvedCardEvent[]): Map<
  string,
  {
    yellowCards: number;
    redCards: number;
  }
> {
  const counts = new Map<
    string,
    {
      yellowCards: number;
      redCards: number;
    }
  >();

  for (const event of events) {
    if (
      event.matchResolutionStatus !== "RESOLVED" ||
      event.canonicalTeam === null
    ) {
      continue;
    }

    const key = getMatchTeamKey(event.sourceMatchId, event.canonicalTeam);
    const current =
      counts.get(key) ??
      {
        yellowCards: 0,
        redCards: 0,
      };
    const category = getCardCategory(event.row.cartao ?? "");

    if (category === "yellow") {
      current.yellowCards += 1;
    } else if (category === "red") {
      current.redCards += 1;
    }

    counts.set(key, current);
  }

  return counts;
}

function getEventTotalsBySeason(events: ResolvedCardEvent[]): Array<{
  season: number;
  yellowCards: number;
  redCards: number;
}> {
  return getSeasonRange(2014, 2024).map((season) => {
    const seasonEvents = events.filter((event) => event.season === season);

    return {
      season,
      yellowCards: seasonEvents.filter(
        (event) => getCardCategory(event.row.cartao ?? "") === "yellow",
      ).length,
      redCards: seasonEvents.filter(
        (event) => getCardCategory(event.row.cartao ?? "") === "red",
      ).length,
    };
  });
}

function getCardTotalsBySeason(
  cards: NormalizedMatchTeamCard[],
): Array<{
  season: number;
  yellowCards: number;
  redCards: number;
}> {
  return getSeasonRange(2014, 2024).map((season) => {
    const seasonCards = cards.filter((card) => card.season === season);

    return {
      season,
      yellowCards: seasonCards.reduce(
        (total, card) => total + card.yellowCards,
        0,
      ),
      redCards: seasonCards.reduce(
        (total, card) => total + card.redCards,
        0,
      ),
    };
  });
}

function countRowsBySeason(
  cards: NormalizedMatchTeamCard[],
): Array<{ season: number; rows: number }> {
  return [...expectedRowsBySeason.keys()].map((season) => ({
    season,
    rows: cards.filter((card) => card.season === season).length,
  }));
}

function validateCards(
  cards: NormalizedMatchTeamCard[],
  events: ResolvedCardEvent[],
  normalizedMatches: NormalizedMatch[],
  teams: TeamEntry[],
  zeroEventValidations: ZeroEventValidation[],
): {
  totalRecords: number;
  rowsPerSeason: Array<{ season: number; rows: number }>;
  matchesWithInvalidTeamRecordCount: Array<{
    sourceMatchId: number;
    teams: number;
  }>;
  duplicateMatchTeams: string[];
  teamsMissingFromCatalog: string[];
  teamsNotInHomeAway: Array<{
    sourceMatchId: number;
    team: string;
    homeTeam: string;
    awayTeam: string;
  }>;
  negativeYellowCards: number;
  negativeRedCards: number;
  totalYellowCards: number;
  totalRedCards: number;
  eventTotalsBySeason: Array<{
    season: number;
    yellowCards: number;
    redCards: number;
  }>;
  normalizedTotalsBySeason: Array<{
    season: number;
    yellowCards: number;
    redCards: number;
  }>;
  perSeasonEventTotalsMatchAudit: boolean;
  zeroEventValidation: ReturnType<
    typeof analyzeZeroEventMatchesForPlaceholderSeasons
  >;
  zeroEventMatchesWithNonZeroCards: Array<{
    season: number;
    sourceMatchId: number;
    team: string;
    yellowCards: number;
    redCards: number;
  }>;
} {
  const teamSlugs = new Set(teams.map((team) => team.slug));
  const expectedMatchIds = new Set(
    normalizedMatches
      .filter(
        (match) =>
          match.source === "adaoduque" &&
          expectedRowsBySeason.has(match.season),
      )
      .map((match) => match.sourceId),
  );
  const matchTeamCounts = new Map<string, number>();
  const matchRecordCounts = new Map<number, number>();

  for (const card of cards) {
    const key = getMatchTeamKey(card.sourceMatchId, card.team);
    matchTeamCounts.set(key, (matchTeamCounts.get(key) ?? 0) + 1);
    matchRecordCounts.set(
      card.sourceMatchId,
      (matchRecordCounts.get(card.sourceMatchId) ?? 0) + 1,
    );
  }

  const duplicateMatchTeams = [...matchTeamCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const matchesWithInvalidTeamRecordCount = [...expectedMatchIds]
    .map((sourceMatchId) => ({
      sourceMatchId,
      teams: matchRecordCounts.get(sourceMatchId) ?? 0,
    }))
    .filter((entry) => entry.teams !== 2);
  const teamsMissingFromCatalog = [
    ...new Set(
      cards
        .filter((card) => !teamSlugs.has(card.team))
        .map((card) => card.team),
    ),
  ].sort();
  const teamsNotInHomeAway = cards
    .filter((card) => card.team !== card.homeTeam && card.team !== card.awayTeam)
    .map((card) => ({
      sourceMatchId: card.sourceMatchId,
      team: card.team,
      homeTeam: card.homeTeam,
      awayTeam: card.awayTeam,
    }));
  const eventTotalsBySeason = getEventTotalsBySeason(events);
  const normalizedTotalsBySeason = getCardTotalsBySeason(cards);
  const zeroEventValidation = analyzeZeroEventMatchesForPlaceholderSeasons(
    events,
    normalizedMatches,
    zeroEventValidations,
  );
  const zeroEventIds = new Set(
    zeroEventValidation.matches.map((match) => match.sourceMatchId),
  );
  const zeroEventMatchesWithNonZeroCards = cards
    .filter(
      (card) =>
        zeroEventIds.has(card.sourceMatchId) &&
        (card.yellowCards !== 0 || card.redCards !== 0),
    )
    .map((card) => ({
      season: card.season,
      sourceMatchId: card.sourceMatchId,
      team: card.team,
      yellowCards: card.yellowCards,
      redCards: card.redCards,
    }));

  return {
    totalRecords: cards.length,
    rowsPerSeason: countRowsBySeason(cards),
    matchesWithInvalidTeamRecordCount,
    duplicateMatchTeams,
    teamsMissingFromCatalog,
    teamsNotInHomeAway,
    negativeYellowCards: cards.filter((card) => card.yellowCards < 0).length,
    negativeRedCards: cards.filter((card) => card.redCards < 0).length,
    totalYellowCards: cards.reduce((total, card) => total + card.yellowCards, 0),
    totalRedCards: cards.reduce((total, card) => total + card.redCards, 0),
    eventTotalsBySeason,
    normalizedTotalsBySeason,
    perSeasonEventTotalsMatchAudit:
      JSON.stringify(eventTotalsBySeason) ===
      JSON.stringify(normalizedTotalsBySeason),
    zeroEventValidation,
    zeroEventMatchesWithNonZeroCards,
  };
}

function assertValidation(validation: ReturnType<typeof validateCards>): void {
  const invalidRowsPerSeason = validation.rowsPerSeason.filter(
    ({ season, rows }) => rows !== expectedRowsBySeason.get(season),
  );
  const hasUnexpectedResult =
    validation.totalRecords !== 8358 ||
    invalidRowsPerSeason.length > 0 ||
    validation.matchesWithInvalidTeamRecordCount.length > 0 ||
    validation.duplicateMatchTeams.length > 0 ||
    validation.teamsMissingFromCatalog.length > 0 ||
    validation.teamsNotInHomeAway.length > 0 ||
    validation.negativeYellowCards > 0 ||
    validation.negativeRedCards > 0 ||
    validation.totalYellowCards !== 19867 ||
    validation.totalRedCards !== 1086 ||
    !validation.perSeasonEventTotalsMatchAudit ||
    validation.zeroEventValidation.validationMappingAudit
      .zeroEventMatchesDetected !== 10 ||
    validation.zeroEventValidation.validationMappingAudit
      .validationMappingsMatched !== 10 ||
    validation.zeroEventValidation.validationMappingAudit.missing.length > 0 ||
    validation.zeroEventValidation.validationMappingAudit.extra.length > 0 ||
    validation.zeroEventValidation.validationMappingAudit.mismatched.length > 0 ||
    validation.zeroEventMatchesWithNonZeroCards.length > 0;

  if (hasUnexpectedResult) {
    console.error(JSON.stringify(validation, null, 2));
    throw new Error("Normalized match-team cards validation failed.");
  }
}

async function main(): Promise<void> {
  const [
    cardsFile,
    rawMatchesFile,
    normalizedMatches,
    aliases,
    teams,
    zeroEventValidations,
  ] = await Promise.all([
    readRawCsv(cardsPath),
    readRawCsv(rawMatchesPath),
    readJsonFile<NormalizedMatch[]>(matchesPath),
    carregarAliasesDeEquipes(aliasesPath),
    readJsonFile<TeamEntry[]>(teamsPath),
    readJsonFile<ZeroEventValidation[]>(zeroEventValidationsPath),
  ]);
  const { events, rawMatchValidationFailures } = resolveEvents(
    cardsFile.rows,
    rawMatchesFile.rows,
    normalizedMatches,
    aliases,
  );
  const unresolvedEvents = events.filter(
    (event) =>
      event.matchResolutionStatus !== "RESOLVED" ||
      event.canonicalTeam === null ||
      event.match === null,
  );
  const otherCardEvents = events.filter(
    (event) => getCardCategory(event.row.cartao ?? "") === "other",
  );

  if (rawMatchValidationFailures.length > 0) {
    throw new Error("Raw match validation failed for card events.");
  }

  if (unresolvedEvents.length > 0) {
    throw new Error("Card event resolution failed.");
  }

  if (otherCardEvents.length > 0) {
    throw new Error("Unexpected card type found.");
  }

  const eventCounts = getResolvedEventCounts(events);
  const matches = normalizedMatches
    .filter(
      (match) =>
        match.source === "adaoduque" && expectedRowsBySeason.has(match.season),
    )
    .sort(
      (first, second) =>
        first.season - second.season ||
        (first.round ?? 0) - (second.round ?? 0) ||
        (first.date ?? "").localeCompare(second.date ?? "") ||
        first.sourceId - second.sourceId,
    );
  const cards: NormalizedMatchTeamCard[] = matches.flatMap((match) =>
    [match.homeTeam, match.awayTeam].map((team) => {
      const counts =
        eventCounts.get(getMatchTeamKey(match.sourceId, team)) ??
        {
          yellowCards: 0,
          redCards: 0,
        };

      return {
        source: "adaoduque",
        sourceMatchId: match.sourceId,
        season: match.season,
        round: match.round,
        date: match.date,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        team,
        yellowCards: counts.yellowCards,
        redCards: counts.redCards,
      };
    }),
  );
  const validation = validateCards(
    cards,
    events,
    normalizedMatches,
    teams,
    zeroEventValidations,
  );

  assertValidation(validation);

  await mkdir(dirname(outputPath), {
    recursive: true,
  });
  await writeFile(outputPath, `${JSON.stringify(cards, null, 2)}\n`, "utf-8");

  console.log(
    JSON.stringify(
      {
        outputFile: outputPath,
        recordStructure: [
          "source",
          "sourceMatchId",
          "season",
          "round",
          "date",
          "homeTeam",
          "awayTeam",
          "team",
          "yellowCards",
          "redCards",
        ],
        validation,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error("Failed to generate normalized match-team cards:");
  console.error(error);
  process.exitCode = 1;
});
