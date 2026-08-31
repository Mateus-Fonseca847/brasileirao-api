import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";

import {
  carregarAliasesDeEquipes,
  encontrarIdCanonico,
} from "../normalization/team-names.js";
import { extrairTemporadaBrasileirao } from "../normalization/seasons.js";

export type CsvRow = Record<string, string>;

export type NormalizedMatch = {
  source: string;
  sourceId: number;
  season: number;
  round: number | null;
  date: string | null;
  kickoffTime: string | null;
  stadium: string | null;
  homeTeam: string;
  awayTeam: string;
  officialScore: {
    home: number | null;
    away: number | null;
  };
  playedScore: {
    home: number | null;
    away: number | null;
  } | null;
  status: string;
};

type LegacyAdaoduqueAudit = {
  temporadas: Array<{
    temporada: number;
    eventosDeCartao: number;
  }>;
};

export type ZeroEventValidation = {
  season: number;
  sourceMatchId: number;
  homeTeam: string;
  awayTeam: string;
  yellowCardsHome: number;
  yellowCardsAway: number;
  redCardsHome: number;
  redCardsAway: number;
  validationStatus: "EXTERNALLY_CONFIRMED_ZERO";
  sourceName: string;
  sourceUrl: string;
};

export type ResolvedCardEvent = {
  row: CsvRow;
  season: number;
  sourceMatchId: number;
  canonicalTeam: string | null;
  match: NormalizedMatch | null;
  matchResolutionStatus: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
};

type ResolvedStatisticsRow = {
  row: CsvRow;
  season: number;
  sourceMatchId: number;
  canonicalTeam: string | null;
  match: NormalizedMatch | null;
  matchResolutionStatus: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
  yellowCards: number | null;
  redCards: number | null;
};

export type RawMatchValidationFailure = {
  sourceMatchId: number;
  field: string;
  rawValue: string | number | null;
  normalizedValue: string | number | null;
};

type EventAggregate = {
  season: number;
  sourceMatchId: number;
  round: number | null;
  homeTeam: string;
  awayTeam: string;
  team: string;
  yellow: number;
  red: number;
  other: number;
  events: Array<{
    cardType: string;
    player: string;
    minute: string;
    shirtNumber: string;
    position: string;
  }>;
};

type PairComparison = {
  season: number;
  sourceMatchId: number;
  round: number | null;
  homeTeam: string;
  awayTeam: string;
  team: string;
  eventYellow: number;
  eventRed: number;
  statsYellow: number;
  statsRed: number;
  yellowDelta: number;
  redDelta: number;
  hasEventRows: boolean;
  hasStatisticsRow: boolean;
  classification:
    | "EXACT_MATCH"
    | "EVENTS_GREATER"
    | "STATS_GREATER"
    | "EVENTS_ONLY"
    | "STATS_ONLY"
    | "BOTH_ZERO"
    | "MIXED_DELTA";
  events: EventAggregate["events"];
  statisticsRow: CsvRow | null;
};

const cardsPath = resolve(
  "data/raw/adaoduque/campeonato-brasileiro-cartoes.csv",
);
const statisticsPath = resolve(
  "data/raw/adaoduque/campeonato-brasileiro-estatisticas-full.csv",
);
const rawMatchesPath = resolve(
  "data/raw/adaoduque/campeonato-brasileiro-full.csv",
);
const matchesPath = resolve("data/normalized/matches.json");
const aliasesPath = resolve("data/mappings/team-aliases.json");
const legacyAuditPath = resolve("data/audit/adaoduque-audit.json");
const zeroEventValidationsPath = resolve(
  "data/mappings/card-zero-event-validations.json",
);

const expectedCardColumns = [
  "partida_id",
  "rodata",
  "clube",
  "cartao",
  "atleta",
  "num_camisa",
  "posicao",
  "minuto",
];

function detectEncoding(bytes: Buffer): string {
  try {
    new TextDecoder("utf-8", {
      fatal: true,
    }).decode(bytes);

    return "utf-8";
  } catch {
    return "iso-8859-1";
  }
}

function readCsv(content: string): CsvRow[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

function getColumns(content: string): string[] {
  const [header] = content.split(/\r?\n/);

  if (!header) {
    throw new Error("CSV file is empty.");
  }

  return parse(header, {
    relaxQuotes: true,
  })[0] as string[];
}

export async function readRawCsv(path: string): Promise<{
  encoding: string;
  delimiter: string;
  columns: string[];
  rows: CsvRow[];
}> {
  const bytes = await readFile(path);
  const encoding = detectEncoding(bytes);
  const content = new TextDecoder(encoding).decode(bytes);

  return {
    encoding,
    delimiter: ",",
    columns: getColumns(content),
    rows: readCsv(content),
  };
}

function countValues(rows: CsvRow[], column: string): Record<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = row[column] ?? "";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
}

function countMissingValues(
  rows: CsvRow[],
  columns: string[],
): Record<string, number> {
  return Object.fromEntries(
    columns.map((column) => [
      column,
      rows.filter((row) => (row[column] ?? "").trim() === "").length,
    ]),
  );
}

function getRawMatchSeason(row: CsvRow): number {
  return extrairTemporadaBrasileirao(row.data ?? "");
}

function getRowsBySeason<T>(
  rows: T[],
  getSeason: (row: T) => number,
): Array<{ season: number; rows: number }> {
  const counts = new Map<number, number>();

  for (const row of rows) {
    const season = getSeason(row);
    counts.set(season, (counts.get(season) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([season, rowCount]) => ({
      season,
      rows: rowCount,
    }))
    .sort((first, second) => first.season - second.season);
}

export function getCardCategory(cardType: string): "yellow" | "red" | "other" {
  if (cardType === "Amarelo") {
    return "yellow";
  }

  if (cardType === "Vermelho") {
    return "red";
  }

  return "other";
}

function parseIntegerValue(value: string | undefined): number | null {
  const trimmedValue = (value ?? "").trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return null;
  }

  return Number(trimmedValue);
}

function getValueFormatSummary(values: Record<string, number>): {
  distinctValues: Record<string, number>;
  format: string;
} {
  const entries = Object.keys(values);
  const format = entries.every((value) => /^\d+$/.test(value))
    ? "non-negative integer strings"
    : "mixed or non-integer strings";

  return {
    distinctValues: values,
    format,
  };
}

function getCardCountsBySeason(
  events: ResolvedCardEvent[],
): Array<{
  season: number;
  yellow: number;
  red: number;
  other: number;
}> {
  const counts = new Map<
    number,
    {
      yellow: number;
      red: number;
      other: number;
    }
  >();

  for (const event of events) {
    const current =
      counts.get(event.season) ??
      {
        yellow: 0,
        red: 0,
        other: 0,
      };
    const category = getCardCategory(event.row.cartao ?? "");
    current[category] += 1;
    counts.set(event.season, current);
  }

  return [...counts.entries()]
    .map(([season, values]) => ({
      season,
      ...values,
    }))
    .sort((first, second) => first.season - second.season);
}

function findExactDuplicateRows(rows: CsvRow[]): Array<{
  row: CsvRow;
  count: number;
}> {
  const counts = new Map<string, { row: CsvRow; count: number }>();

  for (const row of rows) {
    const key = JSON.stringify(row);
    const current =
      counts.get(key) ??
      {
        row,
        count: 0,
      };
    current.count += 1;
    counts.set(key, current);
  }

  return [...counts.values()].filter((entry) => entry.count > 1);
}

function findDuplicateLookingRows(
  rows: CsvRow[],
  columns: string[],
): Array<{
  ignoredColumn: string;
  groups: number;
  rows: number;
  examples: CsvRow[][];
}> {
  return columns
    .map((ignoredColumn) => {
      const groups = new Map<string, CsvRow[]>();

      for (const row of rows) {
        const key = JSON.stringify(
          Object.fromEntries(
            columns
              .filter((column) => column !== ignoredColumn)
              .map((column) => [column, row[column] ?? ""]),
          ),
        );
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }

      const duplicateGroups = [...groups.values()].filter((group) => {
        const distinctValues = new Set(
          group.map((row) => row[ignoredColumn] ?? ""),
        );

        return group.length > 1 && distinctValues.size > 1;
      });

      return {
        ignoredColumn,
        groups: duplicateGroups.length,
        rows: duplicateGroups.reduce((total, group) => total + group.length, 0),
        examples: duplicateGroups.slice(0, 5),
      };
    })
    .filter((entry) => entry.groups > 0);
}

function createMatchesBySourceId(
  matches: NormalizedMatch[],
): Map<number, NormalizedMatch[]> {
  const bySourceId = new Map<number, NormalizedMatch[]>();

  for (const match of matches.filter((entry) => entry.source === "adaoduque")) {
    bySourceId.set(match.sourceId, [
      ...(bySourceId.get(match.sourceId) ?? []),
      match,
    ]);
  }

  return bySourceId;
}

function resolveSourceRow(
  row: CsvRow,
  rawMatchesById: Map<string, CsvRow>,
  matchesBySourceId: Map<number, NormalizedMatch[]>,
  aliases: Map<string, string>,
  rawMatchValidationFailures: RawMatchValidationFailure[],
): {
  season: number;
  sourceMatchId: number;
  canonicalTeam: string | null;
  match: NormalizedMatch | null;
  matchResolutionStatus: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
} {
  const sourceMatchId = Number(row.partida_id);
  const rawMatch = rawMatchesById.get(row.partida_id ?? "");
  const season = rawMatch ? getRawMatchSeason(rawMatch) : Number.NaN;
  const canonicalTeam = encontrarIdCanonico(row.clube ?? "", aliases);
  const matches = matchesBySourceId.get(sourceMatchId) ?? [];
  const match =
    matches.length === 1
      ? matches[0] ?? null
      : null;

  if (rawMatch && match) {
    const rawHomeTeam = encontrarIdCanonico(rawMatch.mandante ?? "", aliases);
    const rawAwayTeam = encontrarIdCanonico(rawMatch.visitante ?? "", aliases);
    const rawRound = Number(rawMatch.rodata);

    [
      {
        field: "season",
        rawValue: season,
        normalizedValue: match.season,
      },
      {
        field: "round",
        rawValue: rawRound,
        normalizedValue: match.round,
      },
      {
        field: "homeTeam",
        rawValue: rawHomeTeam,
        normalizedValue: match.homeTeam,
      },
      {
        field: "awayTeam",
        rawValue: rawAwayTeam,
        normalizedValue: match.awayTeam,
      },
    ]
      .filter((comparison) => comparison.rawValue !== comparison.normalizedValue)
      .forEach((comparison) => {
        rawMatchValidationFailures.push({
          sourceMatchId,
          field: comparison.field,
          rawValue: comparison.rawValue,
          normalizedValue: comparison.normalizedValue,
        });
      });
  }

  const matchResolutionStatus =
    matches.length === 1
      ? "RESOLVED"
      : matches.length === 0
        ? "UNRESOLVED"
        : "AMBIGUOUS";

  return {
    season,
    sourceMatchId,
    canonicalTeam,
    match,
    matchResolutionStatus,
  };
}

export function resolveEvents(
  cardRows: CsvRow[],
  rawMatches: CsvRow[],
  normalizedMatches: NormalizedMatch[],
  aliases: Map<string, string>,
): {
  events: ResolvedCardEvent[];
  rawMatchValidationFailures: RawMatchValidationFailure[];
} {
  const rawMatchesById = new Map(rawMatches.map((row) => [row.ID, row]));
  const matchesBySourceId = createMatchesBySourceId(normalizedMatches);
  const rawMatchValidationFailures: RawMatchValidationFailure[] = [];

  const events = cardRows.map((row) => {
    const resolvedRow = resolveSourceRow(
      row,
      rawMatchesById,
      matchesBySourceId,
      aliases,
      rawMatchValidationFailures,
    );

    return {
      row,
      ...resolvedRow,
    };
  });

  return {
    events,
    rawMatchValidationFailures,
  };
}

function resolveStatisticsRows(
  statisticsRows: CsvRow[],
  rawMatches: CsvRow[],
  normalizedMatches: NormalizedMatch[],
  aliases: Map<string, string>,
): {
  rows: ResolvedStatisticsRow[];
  rawMatchValidationFailures: RawMatchValidationFailure[];
} {
  const rawMatchesById = new Map(rawMatches.map((row) => [row.ID, row]));
  const matchesBySourceId = createMatchesBySourceId(normalizedMatches);
  const rawMatchValidationFailures: RawMatchValidationFailure[] = [];
  const rows = statisticsRows.map((row) => {
    const resolvedRow = resolveSourceRow(
      row,
      rawMatchesById,
      matchesBySourceId,
      aliases,
      rawMatchValidationFailures,
    );

    return {
      row,
      ...resolvedRow,
      yellowCards: parseIntegerValue(row.cartao_amarelo),
      redCards: parseIntegerValue(row.cartao_vermelho),
    };
  });

  return {
    rows,
    rawMatchValidationFailures,
  };
}

function getMatchTeamKey(sourceMatchId: number, canonicalTeam: string): string {
  return `${sourceMatchId}:${canonicalTeam}`;
}

function getMatchKey(season: number, sourceMatchId: number): string {
  return `${season}:${sourceMatchId}`;
}

function aggregateCardEvents(events: ResolvedCardEvent[]): Map<
  string,
  EventAggregate
> {
  const counts = new Map<string, EventAggregate>();

  for (const event of events) {
    if (
      event.matchResolutionStatus !== "RESOLVED" ||
      event.canonicalTeam === null ||
      event.match === null
    ) {
      continue;
    }

    const key = getMatchTeamKey(event.sourceMatchId, event.canonicalTeam);
    const current =
      counts.get(key) ??
      {
        season: event.season,
        sourceMatchId: event.sourceMatchId,
        round: event.match.round,
        homeTeam: event.match.homeTeam,
        awayTeam: event.match.awayTeam,
        team: event.canonicalTeam,
        yellow: 0,
        red: 0,
        other: 0,
        events: [],
      };
    const category = getCardCategory(event.row.cartao ?? "");
    current[category] += 1;
    current.events.push({
      cardType: event.row.cartao ?? "",
      player: event.row.atleta ?? "",
      minute: event.row.minuto ?? "",
      shirtNumber: event.row.num_camisa ?? "",
      position: event.row.posicao ?? "",
    });
    counts.set(key, current);
  }

  return counts;
}

function getMatchesBySeason(matches: NormalizedMatch[]): Map<number, number> {
  const counts = new Map<number, number>();

  for (const match of matches) {
    counts.set(match.season, (counts.get(match.season) ?? 0) + 1);
  }

  return counts;
}

function getSeasonRange(startSeason: number, endSeason: number): number[] {
  return Array.from(
    {
      length: endSeason - startSeason + 1,
    },
    (_, index) => startSeason + index,
  );
}

function getDeltaFrequency(comparisons: PairComparison[]): {
  yellow: Record<string, number>;
  red: Record<string, number>;
} {
  const yellow = new Map<number, number>();
  const red = new Map<number, number>();

  for (const comparison of comparisons) {
    yellow.set(
      comparison.yellowDelta,
      (yellow.get(comparison.yellowDelta) ?? 0) + 1,
    );
    red.set(
      comparison.redDelta,
      (red.get(comparison.redDelta) ?? 0) + 1,
    );
  }

  const format = (entries: Map<number, number>) =>
    Object.fromEntries(
      [...entries.entries()]
        .sort(([first], [second]) => first - second)
        .map(([delta, count]) => [
          delta > 0 ? `+${delta}` : String(delta),
          count,
        ]),
    );

  return {
    yellow: format(yellow),
    red: format(red),
  };
}

function getDeltaSummary(
  comparisons: PairComparison[],
  color: "yellow" | "red",
): {
  eventsGreaterPairs: number;
  statsGreaterPairs: number;
  equalPairs: number;
  positiveDeltaSum: number;
  negativeDeltaSum: number;
  maximumAbsoluteDelta: number;
} {
  const deltas = comparisons.map((comparison) =>
    color === "yellow" ? comparison.yellowDelta : comparison.redDelta,
  );

  return {
    eventsGreaterPairs: deltas.filter((delta) => delta > 0).length,
    statsGreaterPairs: deltas.filter((delta) => delta < 0).length,
    equalPairs: deltas.filter((delta) => delta === 0).length,
    positiveDeltaSum: deltas
      .filter((delta) => delta > 0)
      .reduce((total, delta) => total + delta, 0),
    negativeDeltaSum: deltas
      .filter((delta) => delta < 0)
      .reduce((total, delta) => total + delta, 0),
    maximumAbsoluteDelta: Math.max(0, ...deltas.map((delta) => Math.abs(delta))),
  };
}

function classifyPair(
  eventYellow: number,
  eventRed: number,
  statsYellow: number,
  statsRed: number,
  hasEventRows: boolean,
): PairComparison["classification"] {
  const eventTotal = eventYellow + eventRed;
  const statsTotal = statsYellow + statsRed;

  if (eventTotal === 0 && statsTotal === 0) {
    return "BOTH_ZERO";
  }

  if (eventYellow === statsYellow && eventRed === statsRed) {
    return "EXACT_MATCH";
  }

  if (hasEventRows && statsTotal === 0) {
    return "EVENTS_ONLY";
  }

  if (!hasEventRows && statsTotal > 0) {
    return "STATS_ONLY";
  }

  if (eventTotal > statsTotal) {
    return "EVENTS_GREATER";
  }

  if (statsTotal > eventTotal) {
    return "STATS_GREATER";
  }

  return "MIXED_DELTA";
}

function createPairComparisons(
  events: ResolvedCardEvent[],
  statisticsRows: ResolvedStatisticsRow[],
): PairComparison[] {
  const eventCounts = aggregateCardEvents(events);
  const statisticsRowsWithTotals = statisticsRows.filter(
    (row) =>
      row.matchResolutionStatus === "RESOLVED" &&
      row.canonicalTeam !== null &&
      row.match !== null &&
      row.yellowCards !== null &&
      row.redCards !== null &&
      row.season >= 2014 &&
      row.season <= 2024,
  );
  const statisticsCounts = new Map(
    statisticsRowsWithTotals.map((row) => [
      getMatchTeamKey(row.sourceMatchId, row.canonicalTeam ?? ""),
      row,
    ]),
  );
  const keys = new Set<string>([
    ...statisticsCounts.keys(),
    ...[...eventCounts.values()]
      .filter((entry) => entry.season >= 2014 && entry.season <= 2024)
      .map((entry) => getMatchTeamKey(entry.sourceMatchId, entry.team)),
  ]);

  return [...keys]
    .map((key) => {
      const eventEntry = eventCounts.get(key);
      const statisticsRow = statisticsCounts.get(key);
      const match = statisticsRow?.match ?? eventEntry;
      const team = statisticsRow?.canonicalTeam ?? eventEntry?.team ?? "";
      const season = statisticsRow?.season ?? eventEntry?.season ?? Number.NaN;
      const sourceMatchId =
        statisticsRow?.sourceMatchId ?? eventEntry?.sourceMatchId ?? Number.NaN;
      const eventYellow = eventEntry?.yellow ?? 0;
      const eventRed = eventEntry?.red ?? 0;
      const statsYellow = statisticsRow?.yellowCards ?? 0;
      const statsRed = statisticsRow?.redCards ?? 0;
      const yellowDelta = eventYellow - statsYellow;
      const redDelta = eventRed - statsRed;
      const hasEventRows = eventEntry !== undefined;

      return {
        season,
        sourceMatchId,
        round: statisticsRow?.match?.round ?? eventEntry?.round ?? null,
        homeTeam: match?.homeTeam ?? "",
        awayTeam: match?.awayTeam ?? "",
        team,
        eventYellow,
        eventRed,
        statsYellow,
        statsRed,
        yellowDelta,
        redDelta,
        hasEventRows,
        hasStatisticsRow: statisticsRow !== undefined,
        classification: classifyPair(
          eventYellow,
          eventRed,
          statsYellow,
          statsRed,
          hasEventRows,
        ),
        events: eventEntry?.events ?? [],
        statisticsRow: statisticsRow?.row ?? null,
      };
    })
    .sort((first, second) =>
      first.season - second.season ||
      first.sourceMatchId - second.sourceMatchId ||
      first.team.localeCompare(second.team),
    );
}

function parseMinuteValue(minute: string): number | null {
  const match = /^(\d+)(?:\+(\d+))?$/.exec(minute.trim());

  if (!match) {
    return null;
  }

  return Number(match[1]) * 100 + Number(match[2] ?? 0);
}

function analyzeRedTiming(
  yellowMinutes: string[],
  redMinutes: string[],
): {
  sameMinuteAsYellow: number;
  afterYellow: number;
  beforeYellow: number;
  minuteUnavailableOrUnparseable: number;
} {
  const parsedYellowMinutes = yellowMinutes.map(parseMinuteValue);
  const parsedRedMinutes = redMinutes.map(parseMinuteValue);
  const summary = {
    sameMinuteAsYellow: 0,
    afterYellow: 0,
    beforeYellow: 0,
    minuteUnavailableOrUnparseable: 0,
  };

  for (const redMinute of parsedRedMinutes) {
    const validYellowMinutes = parsedYellowMinutes.filter(
      (minute): minute is number => minute !== null,
    );

    if (redMinute === null || validYellowMinutes.length === 0) {
      summary.minuteUnavailableOrUnparseable += 1;
    } else if (validYellowMinutes.includes(redMinute)) {
      summary.sameMinuteAsYellow += 1;
    } else if (validYellowMinutes.some((yellowMinute) => redMinute > yellowMinute)) {
      summary.afterYellow += 1;
    } else if (validYellowMinutes.every((yellowMinute) => redMinute < yellowMinute)) {
      summary.beforeYellow += 1;
    }
  }

  return summary;
}

function analyzeYellowDeltaSemantics(comparisons: PairComparison[]): {
  perSeason: Array<{
    season: number;
    mismatchedPairs: number;
    totalYellowDelta: number;
    hypothesisAExactMatches: number;
    hypothesisBExactMatches: number;
    hypothesisCExactMatches: number;
    unexplainedPairs: number;
    athletePatternCounts: {
      onlyYellow: number;
      onlyRed: number;
      bothYellowAndRed: number;
      multipleYellows: number;
      multipleYellowsAndRed: number;
    };
    redTimingForAthletesWithYellowAndRed: {
      sameMinuteAsYellow: number;
      afterYellow: number;
      beforeYellow: number;
      minuteUnavailableOrUnparseable: number;
    };
  }>;
  unexplainedExamples: Array<{
    season: number;
    sourceMatchId: number;
    homeTeam: string;
    awayTeam: string;
    team: string;
    statsYellow: number;
    statsRed: number;
    eventYellow: number;
    eventRed: number;
    yellowDelta: number;
    redDelta: number;
    athleteCardSequence: Array<{
      athlete: string;
      cards: Array<{
        cardType: string;
        minute: string;
        shirtNumber: string;
        position: string;
      }>;
    }>;
  }>;
} {
  const seasons = getSeasonRange(2015, 2023);
  const unexplainedExamples: Array<{
    season: number;
    sourceMatchId: number;
    homeTeam: string;
    awayTeam: string;
    team: string;
    statsYellow: number;
    statsRed: number;
    eventYellow: number;
    eventRed: number;
    yellowDelta: number;
    redDelta: number;
    athleteCardSequence: Array<{
      athlete: string;
      cards: Array<{
        cardType: string;
        minute: string;
        shirtNumber: string;
        position: string;
      }>;
    }>;
  }> = [];

  const perSeason = seasons.map((season) => {
    const mismatchedComparisons = comparisons.filter(
      (comparison) =>
        comparison.season === season &&
        (comparison.yellowDelta !== 0 || comparison.redDelta !== 0),
    );
    const athletePatternCounts = {
      onlyYellow: 0,
      onlyRed: 0,
      bothYellowAndRed: 0,
      multipleYellows: 0,
      multipleYellowsAndRed: 0,
    };
    const redTimingForAthletesWithYellowAndRed = {
      sameMinuteAsYellow: 0,
      afterYellow: 0,
      beforeYellow: 0,
      minuteUnavailableOrUnparseable: 0,
    };
    let hypothesisAExactMatches = 0;
    let hypothesisBExactMatches = 0;
    let hypothesisCExactMatches = 0;
    let unexplainedPairs = 0;

    for (const comparison of mismatchedComparisons) {
      const athletes = new Map<string, EventAggregate["events"]>();

      for (const event of comparison.events) {
        const athlete = event.player.trim() || "(missing athlete)";
        athletes.set(athlete, [...(athletes.get(athlete) ?? []), event]);
      }

      const athleteCardSequence = [...athletes.entries()]
        .map(([athlete, cards]) => ({
          athlete,
          cards: cards
            .map((card) => ({
              cardType: card.cardType,
              minute: card.minute,
              shirtNumber: card.shirtNumber,
              position: card.position,
            }))
            .sort((first, second) => {
              const firstMinute = parseMinuteValue(first.minute);
              const secondMinute = parseMinuteValue(second.minute);

              return (
                (firstMinute ?? Number.MAX_SAFE_INTEGER) -
                (secondMinute ?? Number.MAX_SAFE_INTEGER)
              );
            }),
        }))
        .sort((first, second) => first.athlete.localeCompare(second.athlete));

      const athleteSummaries = athleteCardSequence.map((entry) => {
        const yellowCards = entry.cards.filter(
          (card) => getCardCategory(card.cardType) === "yellow",
        );
        const redCards = entry.cards.filter(
          (card) => getCardCategory(card.cardType) === "red",
        );

        return {
          athlete: entry.athlete,
          yellowCards,
          redCards,
        };
      });
      const athletesWithYellowAndRed = athleteSummaries.filter(
        (entry) => entry.yellowCards.length > 0 && entry.redCards.length > 0,
      );
      const athletesWithMultipleYellows = athleteSummaries.filter(
        (entry) => entry.yellowCards.length > 1,
      );
      const athletesWithMultipleYellowsAndRed = athleteSummaries.filter(
        (entry) => entry.yellowCards.length > 1 && entry.redCards.length > 0,
      );

      athletePatternCounts.onlyYellow += athleteSummaries.filter(
        (entry) => entry.yellowCards.length > 0 && entry.redCards.length === 0,
      ).length;
      athletePatternCounts.onlyRed += athleteSummaries.filter(
        (entry) => entry.yellowCards.length === 0 && entry.redCards.length > 0,
      ).length;
      athletePatternCounts.bothYellowAndRed += athletesWithYellowAndRed.length;
      athletePatternCounts.multipleYellows += athletesWithMultipleYellows.length;
      athletePatternCounts.multipleYellowsAndRed +=
        athletesWithMultipleYellowsAndRed.length;

      for (const athlete of athletesWithYellowAndRed) {
        const timing = analyzeRedTiming(
          athlete.yellowCards.map((card) => card.minute),
          athlete.redCards.map((card) => card.minute),
        );
        redTimingForAthletesWithYellowAndRed.sameMinuteAsYellow +=
          timing.sameMinuteAsYellow;
        redTimingForAthletesWithYellowAndRed.afterYellow += timing.afterYellow;
        redTimingForAthletesWithYellowAndRed.beforeYellow += timing.beforeYellow;
        redTimingForAthletesWithYellowAndRed.minuteUnavailableOrUnparseable +=
          timing.minuteUnavailableOrUnparseable;
      }

      const hypothesisAValue = athletesWithYellowAndRed.length;
      const hypothesisBValue = athletesWithYellowAndRed.reduce(
        (total, athlete) => total + athlete.yellowCards.length,
        0,
      );
      const hypothesisCValue = athleteSummaries.reduce(
        (total, athlete) => total + Math.max(0, athlete.yellowCards.length - 1),
        0,
      );
      const hypothesisAMatches = comparison.yellowDelta === hypothesisAValue;
      const hypothesisBMatches = comparison.yellowDelta === hypothesisBValue;
      const hypothesisCMatches = comparison.yellowDelta === hypothesisCValue;

      if (hypothesisAMatches) {
        hypothesisAExactMatches += 1;
      }

      if (hypothesisBMatches) {
        hypothesisBExactMatches += 1;
      }

      if (hypothesisCMatches) {
        hypothesisCExactMatches += 1;
      }

      if (!hypothesisAMatches && !hypothesisBMatches && !hypothesisCMatches) {
        unexplainedPairs += 1;

        if (unexplainedExamples.length < 20) {
          unexplainedExamples.push({
            season,
            sourceMatchId: comparison.sourceMatchId,
            homeTeam: comparison.homeTeam,
            awayTeam: comparison.awayTeam,
            team: comparison.team,
            statsYellow: comparison.statsYellow,
            statsRed: comparison.statsRed,
            eventYellow: comparison.eventYellow,
            eventRed: comparison.eventRed,
            yellowDelta: comparison.yellowDelta,
            redDelta: comparison.redDelta,
            athleteCardSequence,
          });
        }
      }
    }

    return {
      season,
      mismatchedPairs: mismatchedComparisons.length,
      totalYellowDelta: mismatchedComparisons.reduce(
        (total, comparison) => total + comparison.yellowDelta,
        0,
      ),
      hypothesisAExactMatches,
      hypothesisBExactMatches,
      hypothesisCExactMatches,
      unexplainedPairs,
      athletePatternCounts,
      redTimingForAthletesWithYellowAndRed,
    };
  });

  return {
    perSeason,
    unexplainedExamples,
  };
}

function summarizeNonCardStatistics(row: CsvRow | null): {
  fields: Record<
    string,
    {
      value: string;
      hasValue: boolean;
      isNonZeroNumeric: boolean;
    }
  >;
  hasAnyNonCardValue: boolean;
  hasAnyNonZeroNumericValue: boolean;
  looksLikePlaceholder: boolean;
} {
  const ignoredColumns = new Set([
    "partida_id",
    "rodata",
    "clube",
    "cartao_amarelo",
    "cartao_vermelho",
  ]);
  const entries = Object.entries(row ?? {}).filter(
    ([column]) => !ignoredColumns.has(column),
  );
  const fields = Object.fromEntries(
    entries.map(([column, value]) => {
      const trimmedValue = value.trim();

      return [
        column,
        {
          value,
          hasValue: trimmedValue !== "",
          isNonZeroNumeric:
            /^-?\d+(?:[.,]\d+)?$/.test(trimmedValue) &&
            Number(trimmedValue.replace(",", ".")) !== 0,
        },
      ];
    }),
  );
  const values = Object.values(fields);
  const hasAnyNonCardValue = values.some((field) => field.hasValue);
  const hasAnyNonZeroNumericValue = values.some(
    (field) => field.isNonZeroNumeric,
  );

  return {
    fields,
    hasAnyNonCardValue,
    hasAnyNonZeroNumericValue,
    looksLikePlaceholder: !hasAnyNonZeroNumericValue,
  };
}

function getContiguousRanges(values: number[]): Array<{
  start: number;
  end: number;
  count: number;
}> {
  const sortedValues = [...new Set(values)].sort((first, second) => first - second);
  const ranges: Array<{
    start: number;
    end: number;
    count: number;
  }> = [];

  for (const value of sortedValues) {
    const current = ranges.at(-1);

    if (current && value === current.end + 1) {
      current.end = value;
      current.count += 1;
    } else {
      ranges.push({
        start: value,
        end: value,
        count: 1,
      });
    }
  }

  return ranges;
}

function analyzeAggregateCoverageGaps(comparisons: PairComparison[]): {
  perSeason: Array<{
    season: number;
    matchesWithCompleteCardAggregates: number;
    matchesWhereOnlyOneTeamCardAggregateAppearsMissing: number;
    matchesWhereBothTeamsCardAggregatesAppearMissing: number;
    affectedMatches: number;
    affectedRounds: Record<string, number>;
    contiguousSourceMatchIdRanges: Array<{
      start: number;
      end: number;
      count: number;
    }>;
    affectedRowsWithValidOtherStatistics: number;
    affectedRowsThatLookLikeFullStatisticPlaceholders: number;
  }>;
  matches: Array<{
    season: number;
    sourceMatchId: number;
    round: number | null;
    homeTeam: string;
    awayTeam: string;
    teamsWithZeroAggregateCardsAndEvents: "ONE_TEAM" | "BOTH_TEAMS";
    home: {
      eventYellow: number;
      eventRed: number;
      statsYellow: number;
      statsRed: number;
      otherStatistics: ReturnType<typeof summarizeNonCardStatistics>;
    };
    away: {
      eventYellow: number;
      eventRed: number;
      statsYellow: number;
      statsRed: number;
      otherStatistics: ReturnType<typeof summarizeNonCardStatistics>;
    };
  }>;
  conclusion: string;
} {
  const relevantComparisons = comparisons.filter(
    (comparison) =>
      comparison.season >= 2015 &&
      comparison.season <= 2023 &&
      comparison.hasStatisticsRow,
  );
  const comparisonsByMatch = new Map<string, PairComparison[]>();

  for (const comparison of relevantComparisons) {
    const key = `${comparison.season}:${comparison.sourceMatchId}`;
    comparisonsByMatch.set(key, [
      ...(comparisonsByMatch.get(key) ?? []),
      comparison,
    ]);
  }

  const gapMatches = [...comparisonsByMatch.values()]
    .map((matchComparisons) => {
      const [firstComparison] = matchComparisons;

      if (!firstComparison) {
        return null;
      }

      const homeComparison = matchComparisons.find(
        (comparison) => comparison.team === firstComparison.homeTeam,
      );
      const awayComparison = matchComparisons.find(
        (comparison) => comparison.team === firstComparison.awayTeam,
      );

      if (!homeComparison || !awayComparison) {
        return null;
      }

      const homeHasZeroAggregateGap =
        homeComparison.statsYellow === 0 &&
        homeComparison.statsRed === 0 &&
        (homeComparison.eventYellow > 0 || homeComparison.eventRed > 0);
      const awayHasZeroAggregateGap =
        awayComparison.statsYellow === 0 &&
        awayComparison.statsRed === 0 &&
        (awayComparison.eventYellow > 0 || awayComparison.eventRed > 0);

      if (!homeHasZeroAggregateGap && !awayHasZeroAggregateGap) {
        return null;
      }

      return {
        season: firstComparison.season,
        sourceMatchId: firstComparison.sourceMatchId,
        round: firstComparison.round,
        homeTeam: firstComparison.homeTeam,
        awayTeam: firstComparison.awayTeam,
        teamsWithZeroAggregateCardsAndEvents:
          homeHasZeroAggregateGap && awayHasZeroAggregateGap
            ? "BOTH_TEAMS" as const
            : "ONE_TEAM" as const,
        home: {
          eventYellow: homeComparison.eventYellow,
          eventRed: homeComparison.eventRed,
          statsYellow: homeComparison.statsYellow,
          statsRed: homeComparison.statsRed,
          otherStatistics: summarizeNonCardStatistics(
            homeComparison.statisticsRow,
          ),
        },
        away: {
          eventYellow: awayComparison.eventYellow,
          eventRed: awayComparison.eventRed,
          statsYellow: awayComparison.statsYellow,
          statsRed: awayComparison.statsRed,
          otherStatistics: summarizeNonCardStatistics(
            awayComparison.statisticsRow,
          ),
        },
      };
    })
    .filter((match): match is NonNullable<typeof match> => match !== null)
    .sort((first, second) =>
      first.season - second.season ||
      first.sourceMatchId - second.sourceMatchId,
    );

  const perSeason = getSeasonRange(2015, 2023).map((season) => {
    const seasonMatches = [...comparisonsByMatch.values()].filter(
      (matchComparisons) => matchComparisons[0]?.season === season,
    );
    const seasonGapMatches = gapMatches.filter(
      (match) => match.season === season,
    );
    const completeMatches = seasonMatches.length - seasonGapMatches.length;
    const affectedRounds = new Map<string, number>();

    for (const match of seasonGapMatches) {
      const round = match.round === null ? "null" : String(match.round);
      affectedRounds.set(round, (affectedRounds.get(round) ?? 0) + 1);
    }

    const affectedRows = seasonGapMatches.flatMap((match) => [
      match.home.otherStatistics,
      match.away.otherStatistics,
    ]);

    return {
      season,
      matchesWithCompleteCardAggregates: completeMatches,
      matchesWhereOnlyOneTeamCardAggregateAppearsMissing:
        seasonGapMatches.filter(
          (match) => match.teamsWithZeroAggregateCardsAndEvents === "ONE_TEAM",
        ).length,
      matchesWhereBothTeamsCardAggregatesAppearMissing:
        seasonGapMatches.filter(
          (match) => match.teamsWithZeroAggregateCardsAndEvents === "BOTH_TEAMS",
        ).length,
      affectedMatches: seasonGapMatches.length,
      affectedRounds: Object.fromEntries(
        [...affectedRounds.entries()].sort(
          ([first], [second]) => Number(first) - Number(second),
        ),
      ),
      contiguousSourceMatchIdRanges: getContiguousRanges(
        seasonGapMatches.map((match) => match.sourceMatchId),
      ),
      affectedRowsWithValidOtherStatistics: affectedRows.filter(
        (row) => row.hasAnyNonZeroNumericValue,
      ).length,
      affectedRowsThatLookLikeFullStatisticPlaceholders: affectedRows.filter(
        (row) => row.looksLikePlaceholder,
      ).length,
    };
  });

  return {
    perSeason,
    matches: gapMatches,
    conclusion:
      "Unexplained mismatches are consistent with localized missing aggregate-card values when zero aggregate cards coexist with resolved card events, while other statistics are often present in the same rows.",
  };
}

export function analyzeZeroEventMatchesForPlaceholderSeasons(
  events: ResolvedCardEvent[],
  normalizedMatches: NormalizedMatch[],
  zeroEventValidations: ZeroEventValidation[],
): {
  perSeason: Array<{
    season: number;
    totalMatches: number;
    matchesWithAtLeastOneCardEvent: number;
    matchesWithZeroCardEvents: number;
  }>;
  matches: Array<{
    season: number;
    sourceMatchId: number;
    round: number | null;
    date: string | null;
    homeTeam: string;
    awayTeam: string;
    officialScore: NormalizedMatch["officialScore"];
    playedScore: NormalizedMatch["playedScore"];
    validationStatus:
      | "EXTERNALLY_CONFIRMED_ZERO"
      | "NEEDS_EXTERNAL_VALIDATION";
    validationSourceName: string | null;
    validationSourceUrl: string | null;
  }>;
  validationMappingAudit: {
    zeroEventMatchesDetected: number;
    validationMappingsMatched: number;
    missing: Array<{
      season: number;
      sourceMatchId: number;
      homeTeam: string;
      awayTeam: string;
    }>;
    extra: Array<{
      season: number;
      sourceMatchId: number;
      homeTeam: string;
      awayTeam: string;
    }>;
    mismatched: Array<{
      season: number;
      sourceMatchId: number;
      issues: string[];
    }>;
  };
} {
  const eventMatchIds = new Set(
    events
      .filter((event) => event.matchResolutionStatus === "RESOLVED")
      .map((event) => event.sourceMatchId),
  );
  const seasons = [2014, 2024];
  const validationsByKey = new Map<string, ZeroEventValidation>();
  const duplicateValidationKeys = new Set<string>();

  for (const validation of zeroEventValidations) {
    const key = getMatchKey(validation.season, validation.sourceMatchId);

    if (validationsByKey.has(key)) {
      duplicateValidationKeys.add(key);
    }

    validationsByKey.set(key, validation);
  }

  const matches = normalizedMatches
    .filter(
      (match) =>
        seasons.includes(match.season) &&
        match.source === "adaoduque" &&
        !eventMatchIds.has(match.sourceId),
    )
    .map((match) => {
      const validation = validationsByKey.get(
        getMatchKey(match.season, match.sourceId),
      );

      return {
        season: match.season,
        sourceMatchId: match.sourceId,
        round: match.round,
        date: match.date,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        officialScore: match.officialScore,
        playedScore: match.playedScore,
        validationStatus: validation
          ? ("EXTERNALLY_CONFIRMED_ZERO" as const)
          : ("NEEDS_EXTERNAL_VALIDATION" as const),
        validationSourceName: validation?.sourceName ?? null,
        validationSourceUrl: validation?.sourceUrl ?? null,
      };
    })
    .sort((first, second) =>
      first.season - second.season ||
      (first.round ?? 0) - (second.round ?? 0) ||
      first.sourceMatchId - second.sourceMatchId,
    );
  const zeroEventKeys = new Set(
    matches.map((match) => getMatchKey(match.season, match.sourceMatchId)),
  );
  const missing = matches
    .filter(
      (match) =>
        !validationsByKey.has(getMatchKey(match.season, match.sourceMatchId)),
    )
    .map((match) => ({
      season: match.season,
      sourceMatchId: match.sourceMatchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
    }));
  const extra = zeroEventValidations
    .filter(
      (validation) =>
        !zeroEventKeys.has(
          getMatchKey(validation.season, validation.sourceMatchId),
        ),
    )
    .map((validation) => ({
      season: validation.season,
      sourceMatchId: validation.sourceMatchId,
      homeTeam: validation.homeTeam,
      awayTeam: validation.awayTeam,
    }));
  const mismatched = zeroEventValidations
    .map((validation) => {
      const match = matches.find(
        (entry) =>
          entry.season === validation.season &&
          entry.sourceMatchId === validation.sourceMatchId,
      );
      const issues: string[] = [];
      const key = getMatchKey(validation.season, validation.sourceMatchId);

      if (duplicateValidationKeys.has(key)) {
        issues.push("duplicate validation entry");
      }

      if (match !== undefined) {
        if (validation.homeTeam !== match.homeTeam) {
          issues.push("homeTeam does not match the normalized match");
        }

        if (validation.awayTeam !== match.awayTeam) {
          issues.push("awayTeam does not match the normalized match");
        }
      }

      if (
        validation.yellowCardsHome !== 0 ||
        validation.yellowCardsAway !== 0 ||
        validation.redCardsHome !== 0 ||
        validation.redCardsAway !== 0
      ) {
        issues.push("validated card counts must all be zero");
      }

      if (validation.validationStatus !== "EXTERNALLY_CONFIRMED_ZERO") {
        issues.push("validationStatus must be EXTERNALLY_CONFIRMED_ZERO");
      }

      if (validation.sourceName.trim() === "") {
        issues.push("sourceName must be present");
      }

      if (validation.sourceUrl.trim() === "") {
        issues.push("sourceUrl must be present");
      }

      return {
        season: validation.season,
        sourceMatchId: validation.sourceMatchId,
        issues,
      };
    })
    .filter((entry) => entry.issues.length > 0);
  const validationMappingsMatched = matches.length - missing.length;
  const validationMappingAudit = {
    zeroEventMatchesDetected: matches.length,
    validationMappingsMatched,
    missing,
    extra,
    mismatched,
  };

  if (missing.length > 0 || extra.length > 0 || mismatched.length > 0) {
    throw new Error("Zero-event validation mapping audit failed.");
  }

  return {
    perSeason: seasons.map((season) => {
      const seasonMatches = normalizedMatches.filter(
        (match) => match.season === season && match.source === "adaoduque",
      );
      const matchesWithAtLeastOneCardEvent = seasonMatches.filter((match) =>
        eventMatchIds.has(match.sourceId),
      ).length;

      return {
        season,
        totalMatches: seasonMatches.length,
        matchesWithAtLeastOneCardEvent,
        matchesWithZeroCardEvents:
          seasonMatches.length - matchesWithAtLeastOneCardEvent,
      };
    }),
    matches,
    validationMappingAudit,
  };
}

function compareAggregateCards(
  events: ResolvedCardEvent[],
  statisticsRows: ResolvedStatisticsRow[],
  normalizedMatches: NormalizedMatch[],
  zeroEventValidations: ZeroEventValidation[],
): {
  statisticsFileContainsAggregatedCardFields: boolean;
  aggregatedCardColumns: {
    yellow: string | null;
    red: string | null;
  };
  perSeason: Array<{
    season: number;
    totalMatches: number;
    totalMatchTeamPairsExpected: number;
    statisticsRowsContainingCardTotals: number;
    eventDerivedYellowCards: number;
    statisticsYellowCards: number;
    eventDerivedRedCards: number;
    statisticsRedCards: number;
    exactMatchingMatchTeamPairs: number;
    mismatchedPairs: number;
    pairsMissingFromEventRepresentation: number;
    pairsMissingFromStatisticsRepresentation: number;
    pairClassifications: Record<PairComparison["classification"], number>;
    yellowDeltaSummary: ReturnType<typeof getDeltaSummary>;
    redDeltaSummary: ReturnType<typeof getDeltaSummary>;
    yellowDeltaFrequencies: Record<string, number>;
    redDeltaFrequencies: Record<string, number>;
    pairsWithNoEventsButPositiveStats: number;
    pairsWithEventsButZeroAggregateCards: number;
    pairsWhereOnlyYellowDiffers: number;
    pairsWhereOnlyRedDiffers: number;
    pairsWhereBothDiffer: number;
  }>;
  placeholderInvestigation: Array<{
    season: number;
    statisticsRowsContainingCardTotals: number;
    zeroYellowStatisticsRows: number;
    zeroRedStatisticsRows: number;
    zeroBothStatisticsRows: number;
    eventPairsWithCards: number;
    mismatchedPairs: number;
    likelyUnavailableOrPlaceholder: boolean;
    rationale: string;
  }>;
  yellowDeltaSemanticAnalysis: ReturnType<typeof analyzeYellowDeltaSemantics>;
  localizedAggregateCoverageGaps: ReturnType<
    typeof analyzeAggregateCoverageGaps
  >;
  zeroEventMatchesForAggregatePlaceholderSeasons: ReturnType<
    typeof analyzeZeroEventMatchesForPlaceholderSeasons
  >;
  explicitZeroAggregateWithoutEventRowsExists: boolean;
  unresolvedStatisticsTeams: string[];
  unresolvedStatisticsMatches: number[];
  ambiguousStatisticsMatchResolutions: number[];
  statisticsRowsWhoseTeamIsNotHomeOrAway: Array<{
    sourceMatchId: number;
    team: string;
    homeTeam: string;
    awayTeam: string;
  }>;
  mismatchedPairExamples: Array<{
    season: number;
    sourceMatchId: number;
    homeTeam: string;
    awayTeam: string;
    team: string;
    eventYellowCards: number;
    statisticsYellowCards: number;
    eventRedCards: number;
    statisticsRedCards: number;
    yellowDelta: number;
    redDelta: number;
    individualEvents: EventAggregate["events"];
  }>;
  pairsMissingFromStatisticsExamples: Array<{
    season: number;
    sourceMatchId: number;
    team: string;
  }>;
  recommendation:
    | "SAFE_TO_AGGREGATE_WITH_ZERO"
    | "PARTIAL_COVERAGE"
    | "NEEDS_REVIEW";
} {
  const pairComparisons = createPairComparisons(events, statisticsRows);
  const eventCounts = aggregateCardEvents(events);
  const matchesBySeason = getMatchesBySeason(normalizedMatches);
  const statisticsRowsWithTotals = statisticsRows.filter(
    (row) => row.yellowCards !== null && row.redCards !== null,
  );
  const statisticsCounts = new Map(
    statisticsRowsWithTotals
      .filter(
        (row) =>
          row.matchResolutionStatus === "RESOLVED" &&
          row.canonicalTeam !== null,
      )
      .map((row) => [
        getMatchTeamKey(row.sourceMatchId, row.canonicalTeam ?? ""),
        row,
      ]),
  );
  const seasons = getSeasonRange(2014, 2024);
  const mismatchedPairExamples: Array<{
    season: number;
    sourceMatchId: number;
    homeTeam: string;
    awayTeam: string;
    team: string;
    eventYellowCards: number;
    statisticsYellowCards: number;
    eventRedCards: number;
    statisticsRedCards: number;
    yellowDelta: number;
    redDelta: number;
    individualEvents: EventAggregate["events"];
  }> = [];
  const pairsMissingFromStatisticsExamples: Array<{
    season: number;
    sourceMatchId: number;
    team: string;
  }> = [];
  let explicitZeroAggregateWithoutEventRowsExists = false;

  const perSeason = seasons.map((season) => {
    const seasonComparisons = pairComparisons.filter(
      (comparison) => comparison.season === season,
    );
    const seasonStatisticsRows = statisticsRowsWithTotals.filter(
      (row) => row.season === season,
    );
    const seasonEventEntries = [...eventCounts.values()].filter(
      (entry) => entry.season === season,
    );
    const seasonStatisticsKeys = new Set(
      seasonStatisticsRows
        .filter(
          (row) =>
            row.matchResolutionStatus === "RESOLVED" &&
            row.canonicalTeam !== null,
        )
        .map((row) => getMatchTeamKey(row.sourceMatchId, row.canonicalTeam ?? "")),
    );
    const seasonEventKeys = new Set(
      seasonEventEntries.map((entry) =>
        getMatchTeamKey(entry.sourceMatchId, entry.team),
      ),
    );
    let exactMatchingMatchTeamPairs = 0;
    let mismatchedPairs = 0;
    const pairClassifications: Record<
      PairComparison["classification"],
      number
    > = {
      EXACT_MATCH: 0,
      EVENTS_GREATER: 0,
      STATS_GREATER: 0,
      EVENTS_ONLY: 0,
      STATS_ONLY: 0,
      BOTH_ZERO: 0,
      MIXED_DELTA: 0,
    };

    for (const comparison of seasonComparisons) {
      pairClassifications[comparison.classification] += 1;

      if (
        !comparison.hasEventRows &&
        comparison.statsYellow === 0 &&
        comparison.statsRed === 0
      ) {
        explicitZeroAggregateWithoutEventRowsExists = true;
      }

      if (
        comparison.eventYellow === comparison.statsYellow &&
        comparison.eventRed === comparison.statsRed
      ) {
        exactMatchingMatchTeamPairs += 1;
      } else {
        mismatchedPairs += 1;
        if (mismatchedPairExamples.length < 20) {
          mismatchedPairExamples.push({
            season,
            sourceMatchId: comparison.sourceMatchId,
            homeTeam: comparison.homeTeam,
            awayTeam: comparison.awayTeam,
            team: comparison.team,
            eventYellowCards: comparison.eventYellow,
            statisticsYellowCards: comparison.statsYellow,
            eventRedCards: comparison.eventRed,
            statisticsRedCards: comparison.statsRed,
            yellowDelta: comparison.yellowDelta,
            redDelta: comparison.redDelta,
            individualEvents: comparison.events,
          });
        }
      }
    }

    for (const eventEntry of seasonEventEntries) {
      const key = getMatchTeamKey(eventEntry.sourceMatchId, eventEntry.team);

      if (!statisticsCounts.has(key)) {
        pairsMissingFromStatisticsExamples.push({
          season,
          sourceMatchId: eventEntry.sourceMatchId,
          team: eventEntry.team,
        });
      }
    }

    return {
      season,
      totalMatches: matchesBySeason.get(season) ?? 0,
      totalMatchTeamPairsExpected: (matchesBySeason.get(season) ?? 0) * 2,
      statisticsRowsContainingCardTotals: seasonStatisticsRows.length,
      eventDerivedYellowCards: seasonEventEntries.reduce(
        (total, entry) => total + entry.yellow,
        0,
      ),
      statisticsYellowCards: seasonStatisticsRows.reduce(
        (total, row) => total + (row.yellowCards ?? 0),
        0,
      ),
      eventDerivedRedCards: seasonEventEntries.reduce(
        (total, entry) => total + entry.red,
        0,
      ),
      statisticsRedCards: seasonStatisticsRows.reduce(
        (total, row) => total + (row.redCards ?? 0),
        0,
      ),
      exactMatchingMatchTeamPairs,
      mismatchedPairs,
      pairsMissingFromEventRepresentation: [...seasonStatisticsKeys].filter(
        (key) => !seasonEventKeys.has(key),
      ).length,
      pairsMissingFromStatisticsRepresentation: [...seasonEventKeys].filter(
        (key) => !seasonStatisticsKeys.has(key),
      ).length,
      pairClassifications,
      yellowDeltaSummary: getDeltaSummary(seasonComparisons, "yellow"),
      redDeltaSummary: getDeltaSummary(seasonComparisons, "red"),
      yellowDeltaFrequencies: getDeltaFrequency(seasonComparisons).yellow,
      redDeltaFrequencies: getDeltaFrequency(seasonComparisons).red,
      pairsWithNoEventsButPositiveStats: seasonComparisons.filter(
        (comparison) =>
          !comparison.hasEventRows &&
          (comparison.statsYellow > 0 || comparison.statsRed > 0),
      ).length,
      pairsWithEventsButZeroAggregateCards: seasonComparisons.filter(
        (comparison) =>
          comparison.hasEventRows &&
          comparison.statsYellow === 0 &&
          comparison.statsRed === 0,
      ).length,
      pairsWhereOnlyYellowDiffers: seasonComparisons.filter(
        (comparison) =>
          comparison.yellowDelta !== 0 && comparison.redDelta === 0,
      ).length,
      pairsWhereOnlyRedDiffers: seasonComparisons.filter(
        (comparison) =>
          comparison.yellowDelta === 0 && comparison.redDelta !== 0,
      ).length,
      pairsWhereBothDiffer: seasonComparisons.filter(
        (comparison) =>
          comparison.yellowDelta !== 0 && comparison.redDelta !== 0,
      ).length,
    };
  });
  const placeholderInvestigation = [2014, 2024].map((season) => {
    const seasonComparisons = pairComparisons.filter(
      (comparison) => comparison.season === season,
    );
    const zeroYellowStatisticsRows = seasonComparisons.filter(
      (comparison) => comparison.statsYellow === 0,
    ).length;
    const zeroRedStatisticsRows = seasonComparisons.filter(
      (comparison) => comparison.statsRed === 0,
    ).length;
    const zeroBothStatisticsRows = seasonComparisons.filter(
      (comparison) => comparison.statsYellow === 0 && comparison.statsRed === 0,
    ).length;
    const eventPairsWithCards = seasonComparisons.filter(
      (comparison) => comparison.hasEventRows,
    ).length;
    const mismatchedPairs = seasonComparisons.filter(
      (comparison) =>
        comparison.yellowDelta !== 0 || comparison.redDelta !== 0,
    ).length;
    const likelyUnavailableOrPlaceholder =
      zeroBothStatisticsRows / Math.max(seasonComparisons.length, 1) > 0.9 &&
      eventPairsWithCards > 0 &&
      mismatchedPairs / Math.max(seasonComparisons.length, 1) > 0.5;

    return {
      season,
      statisticsRowsContainingCardTotals: seasonComparisons.length,
      zeroYellowStatisticsRows,
      zeroRedStatisticsRows,
      zeroBothStatisticsRows,
      eventPairsWithCards,
      mismatchedPairs,
      likelyUnavailableOrPlaceholder,
      rationale: likelyUnavailableOrPlaceholder
        ? "Aggregate card columns are mostly zero while event rows contain many cards."
        : "Aggregate card columns contain non-zero values often enough to require row-level review.",
    };
  });

  const unresolvedStatisticsTeams = [
    ...new Set(
      statisticsRows
        .filter((row) => row.canonicalTeam === null)
        .map((row) => row.row.clube ?? ""),
    ),
  ].sort();
  const unresolvedStatisticsMatches = [
    ...new Set(
      statisticsRows
        .filter((row) => row.matchResolutionStatus === "UNRESOLVED")
        .map((row) => row.sourceMatchId),
    ),
  ].sort((first, second) => first - second);
  const ambiguousStatisticsMatchResolutions = [
    ...new Set(
      statisticsRows
        .filter((row) => row.matchResolutionStatus === "AMBIGUOUS")
        .map((row) => row.sourceMatchId),
    ),
  ].sort((first, second) => first - second);
  const statisticsRowsWhoseTeamIsNotHomeOrAway = statisticsRows
    .filter(
      (row) =>
        row.match !== null &&
        row.canonicalTeam !== null &&
        row.canonicalTeam !== row.match.homeTeam &&
        row.canonicalTeam !== row.match.awayTeam,
    )
    .map((row) => ({
      sourceMatchId: row.sourceMatchId,
      team: row.canonicalTeam ?? "",
      homeTeam: row.match?.homeTeam ?? "",
      awayTeam: row.match?.awayTeam ?? "",
    }));
  const hasFullCoverage = perSeason.every(
    (entry) =>
      entry.statisticsRowsContainingCardTotals ===
        entry.totalMatchTeamPairsExpected &&
      entry.pairsMissingFromStatisticsRepresentation === 0,
  );
  const hasNoResolutionIssues =
    unresolvedStatisticsTeams.length === 0 &&
    unresolvedStatisticsMatches.length === 0 &&
    ambiguousStatisticsMatchResolutions.length === 0 &&
    statisticsRowsWhoseTeamIsNotHomeOrAway.length === 0;
  const hasNoMismatches = perSeason.every(
    (entry) => entry.mismatchedPairs === 0,
  );
  const recommendation =
    hasFullCoverage &&
    hasNoResolutionIssues &&
    hasNoMismatches &&
    explicitZeroAggregateWithoutEventRowsExists
      ? "SAFE_TO_AGGREGATE_WITH_ZERO"
      : hasNoResolutionIssues && hasNoMismatches
        ? "PARTIAL_COVERAGE"
        : "NEEDS_REVIEW";

  return {
    statisticsFileContainsAggregatedCardFields:
      statisticsRows.length > 0 &&
      statisticsRows[0] !== undefined &&
      "cartao_amarelo" in statisticsRows[0].row &&
      "cartao_vermelho" in statisticsRows[0].row,
    aggregatedCardColumns: {
      yellow: "cartao_amarelo",
      red: "cartao_vermelho",
    },
    perSeason,
    placeholderInvestigation,
    yellowDeltaSemanticAnalysis: analyzeYellowDeltaSemantics(pairComparisons),
    localizedAggregateCoverageGaps:
      analyzeAggregateCoverageGaps(pairComparisons),
    zeroEventMatchesForAggregatePlaceholderSeasons:
      analyzeZeroEventMatchesForPlaceholderSeasons(
        events,
        normalizedMatches,
        zeroEventValidations,
      ),
    explicitZeroAggregateWithoutEventRowsExists,
    unresolvedStatisticsTeams,
    unresolvedStatisticsMatches,
    ambiguousStatisticsMatchResolutions,
    statisticsRowsWhoseTeamIsNotHomeOrAway,
    mismatchedPairExamples,
    pairsMissingFromStatisticsExamples: pairsMissingFromStatisticsExamples.slice(
      0,
      20,
    ),
    recommendation,
  };
}

function compareWithLegacyAudit(
  events: ResolvedCardEvent[],
  legacyAudit: LegacyAdaoduqueAudit,
): Array<{
  season: number;
  currentTotal: number;
  legacyTotal: number;
  difference: number;
}> {
  const currentRowsBySeason = new Map(
    getRowsBySeason(events, (event) => event.season).map((entry) => [
      entry.season,
      entry.rows,
    ]),
  );

  return legacyAudit.temporadas
    .map((seasonAudit) => {
      const currentTotal = currentRowsBySeason.get(seasonAudit.temporada) ?? 0;

      return {
        season: seasonAudit.temporada,
        currentTotal,
        legacyTotal: seasonAudit.eventosDeCartao,
        difference: currentTotal - seasonAudit.eventosDeCartao,
      };
    })
    .filter((entry) => entry.difference !== 0);
}

async function runAudit(): Promise<void> {
  const [
    cardsFile,
    statisticsFile,
    rawMatchesFile,
    aliases,
    matchesContent,
    legacyContent,
    zeroEventValidationsContent,
  ] =
    await Promise.all([
      readRawCsv(cardsPath),
      readRawCsv(statisticsPath),
      readRawCsv(rawMatchesPath),
      carregarAliasesDeEquipes(aliasesPath),
      readFile(matchesPath, "utf-8"),
      readFile(legacyAuditPath, "utf-8"),
      readFile(zeroEventValidationsPath, "utf-8"),
    ]);
  const normalizedMatches = JSON.parse(matchesContent) as NormalizedMatch[];
  const legacyAudit = JSON.parse(legacyContent) as LegacyAdaoduqueAudit;
  const zeroEventValidations = JSON.parse(
    zeroEventValidationsContent,
  ) as ZeroEventValidation[];
  const { events, rawMatchValidationFailures } = resolveEvents(
    cardsFile.rows,
    rawMatchesFile.rows,
    normalizedMatches,
    aliases,
  );
  const {
    rows: statisticsRows,
    rawMatchValidationFailures: statisticsRawMatchValidationFailures,
  } = resolveStatisticsRows(
    statisticsFile.rows,
    rawMatchesFile.rows,
    normalizedMatches,
    aliases,
  );
  const unresolvedTeams = [
    ...new Set(
      events
        .filter((event) => event.canonicalTeam === null)
        .map((event) => event.row.clube ?? ""),
    ),
  ].sort();
  const unresolvedMatches = events
    .filter((event) => event.matchResolutionStatus === "UNRESOLVED")
    .map((event) => event.sourceMatchId);
  const ambiguousMatchResolutions = events
    .filter((event) => event.matchResolutionStatus === "AMBIGUOUS")
    .map((event) => event.sourceMatchId);
  const cardsWhoseTeamIsNotHomeOrAway = events
    .filter(
      (event) =>
        event.match !== null &&
        event.canonicalTeam !== null &&
        event.canonicalTeam !== event.match.homeTeam &&
        event.canonicalTeam !== event.match.awayTeam,
    )
    .map((event) => ({
      sourceMatchId: event.sourceMatchId,
      team: event.canonicalTeam,
      homeTeam: event.match?.homeTeam,
      awayTeam: event.match?.awayTeam,
    }));
  const matchesWithCardsBySeason = [
    ...events.reduce((map, event) => {
      if (event.matchResolutionStatus !== "RESOLVED") {
        return map;
      }

      const matches = map.get(event.season) ?? new Set<number>();
      matches.add(event.sourceMatchId);
      map.set(event.season, matches);

      return map;
    }, new Map<number, Set<number>>()),
  ]
    .map(([season, matches]) => ({
      season,
      matches: matches.size,
    }))
    .sort((first, second) => first.season - second.season);

  const auditSummary = {
    sourceFile: cardsPath,
    encoding: cardsFile.encoding,
    delimiter: cardsFile.delimiter,
    exactColumns: cardsFile.columns,
    expectedColumnsMatch:
      JSON.stringify(cardsFile.columns) === JSON.stringify(expectedCardColumns),
    totalRawRows: cardsFile.rows.length,
    seasonsRepresented: [
      ...new Set(events.map((event) => event.season)),
    ].sort((first, second) => first - second),
    rowsPerSeason: getRowsBySeason(events, (event) => event.season),
    rawCardTypeValues: countValues(cardsFile.rows, "cartao"),
    availableEventFields: cardsFile.columns,
    missingValuesPerColumn: countMissingValues(
      cardsFile.rows,
      cardsFile.columns,
    ),
    unresolvedTeamNames: unresolvedTeams,
    unresolvedMatches: {
      count: unresolvedMatches.length,
      sourceMatchIds: [...new Set(unresolvedMatches)].sort((first, second) => first - second),
    },
    ambiguousMatchResolutions: {
      count: ambiguousMatchResolutions.length,
      sourceMatchIds: [...new Set(ambiguousMatchResolutions)].sort((first, second) => first - second),
    },
    rawMatchValidationFailures,
    cardsWhoseTeamIsNotHomeOrAway,
    exactDuplicateRawRows: findExactDuplicateRows(cardsFile.rows),
    duplicateLookingEventsThatDifferOnlyByOneField: findDuplicateLookingRows(
      cardsFile.rows,
      cardsFile.columns,
    ),
    coverageBySeason: getRowsBySeason(events, (event) => event.season).map(
      (entry) => ({
        season: entry.season,
        cardEvents: entry.rows,
        matchesWithAtLeastOneCardEvent:
          matchesWithCardsBySeason.find((match) => match.season === entry.season)
            ?.matches ?? 0,
      }),
    ),
    cardEventsBySeasonAfterUnderstandingRawTypes: getCardCountsBySeason(events),
    aggregateCardConsistencyCheck: {
      sourceFile: statisticsPath,
      encoding: statisticsFile.encoding,
      delimiter: statisticsFile.delimiter,
      exactColumns: statisticsFile.columns,
      detectedAggregatedCardColumns: {
        yellow: statisticsFile.columns.includes("cartao_amarelo")
          ? "cartao_amarelo"
          : null,
        red: statisticsFile.columns.includes("cartao_vermelho")
          ? "cartao_vermelho"
          : null,
      },
      rawValueFormats: {
        yellow: getValueFormatSummary(
          countValues(statisticsFile.rows, "cartao_amarelo"),
        ),
        red: getValueFormatSummary(
          countValues(statisticsFile.rows, "cartao_vermelho"),
        ),
      },
      missingValuesPerColumn: countMissingValues(
        statisticsFile.rows,
        statisticsFile.columns,
      ),
      rawMatchValidationFailures: statisticsRawMatchValidationFailures,
      ...compareAggregateCards(
        events,
        statisticsRows,
        normalizedMatches,
        zeroEventValidations,
      ),
    },
    eventLevelInformationAvailability: {
      playerName: cardsFile.columns.includes("atleta"),
      minute: cardsFile.columns.includes("minuto"),
      shirtNumber: cardsFile.columns.includes("num_camisa"),
      position: cardsFile.columns.includes("posicao"),
      additionalFields: cardsFile.columns.filter(
        (column) => !expectedCardColumns.includes(column),
      ),
    },
    legacyAuditComparisonDivergences: compareWithLegacyAudit(
      events,
      legacyAudit,
    ),
  };

  console.log(JSON.stringify(auditSummary, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runAudit().catch((error: unknown) => {
    console.error("Failed to audit Adão Duque card events:");
    console.error(error);
    process.exitCode = 1;
  });
}
