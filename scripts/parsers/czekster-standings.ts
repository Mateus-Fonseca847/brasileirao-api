import { readFile } from "node:fs/promises";

import {
  carregarAliasesDeEquipes,
  encontrarIdCanonico,
} from "../normalization/team-names.js";

export type RawCzeksterStandingRow = Record<string, string>;

export type ParsedCzeksterStanding = {
  season: number;
  ranking: number;
  sourceTeam: string;
  normalizedTeamName: string;
  resolutionInput: string;
  canonicalTeam: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalBalance: number;
  goalsFor: number;
  goalsAgainst: number;
  matches: number;
};

export type ParsedCzeksterStandingsFile = {
  encoding: string;
  delimiter: string;
  columns: string[];
  rawRows: RawCzeksterStandingRow[];
  standings: ParsedCzeksterStanding[];
};

export type CzeksterSourceCorrection = {
  source: "czekster";
  season: number;
  type: "SOURCE_COLUMN_ORDER_CORRECTION";
  declaredOrder: string[];
  actualOrder: string[];
  affectedRows: number;
  reason: string;
};

const delimiter = ";";

const brazilianStateSuffixPattern =
  /\/(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/u;

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

function decodeFile(bytes: Buffer, encoding: string): string {
  return new TextDecoder(encoding).decode(bytes);
}

function parseRows(content: string): {
  columns: string[];
  rows: RawCzeksterStandingRow[];
} {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const [header, ...dataLines] = lines;

  if (!header) {
    throw new Error("Ranking file is empty.");
  }

  const columns = header.replace(/^#/, "").split(delimiter);
  const rows = dataLines.map((line) => {
    const values = line.split(delimiter);

    if (values.length !== columns.length) {
      throw new Error(`Invalid column count: ${line}`);
    }

    return Object.fromEntries(
      columns.map((column, index) => [column, values[index] ?? ""]),
    );
  });

  return {
    columns,
    rows,
  };
}

function parseNumber(value: string | undefined, column: string): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Invalid numeric value for ${column}: ${value}`);
  }

  return numberValue;
}

function stripBrazilianStateSuffix(team: string): string {
  return team.replace(brazilianStateSuffixPattern, "");
}

function findCanonicalTeam(
  sourceTeam: string,
  normalizedTeamName: string,
  aliases: Map<string, string>,
): {
  resolutionInput: string;
  canonicalTeam: string | null;
} {
  const candidates = [
    normalizedTeamName,
    sourceTeam.replace("/", " "),
    sourceTeam.replace("/", "-"),
  ];

  for (const candidate of candidates) {
    const canonicalTeam = encontrarIdCanonico(candidate, aliases);

    if (canonicalTeam !== null) {
      return {
        resolutionInput: candidate,
        canonicalTeam,
      };
    }
  }

  return {
    resolutionInput: normalizedTeamName,
    canonicalTeam: null,
  };
}

function getCorrectedColumnValue(
  row: RawCzeksterStandingRow,
  column: string,
  correction: CzeksterSourceCorrection | undefined,
): string | undefined {
  if (!correction || !correction.declaredOrder.includes(column)) {
    return row[column];
  }

  const actualIndex = correction.actualOrder.indexOf(column);
  const declaredColumn = correction.declaredOrder[actualIndex];

  if (!declaredColumn) {
    throw new Error(`Correction does not map column: ${column}`);
  }

  return row[declaredColumn];
}

function getCorrectionForSeason(
  season: number,
  corrections: CzeksterSourceCorrection[],
): CzeksterSourceCorrection | undefined {
  return corrections.find(
    (correction) =>
      correction.source === "czekster" &&
      correction.type === "SOURCE_COLUMN_ORDER_CORRECTION" &&
      correction.season === season,
  );
}

function toParsedStanding(
  row: RawCzeksterStandingRow,
  aliases: Map<string, string>,
  corrections: CzeksterSourceCorrection[],
): ParsedCzeksterStanding {
  const sourceTeam = row.TEAM ?? "";
  const normalizedTeamName = stripBrazilianStateSuffix(sourceTeam);
  const season = parseNumber(row.YEAR, "YEAR");
  const correction = getCorrectionForSeason(season, corrections);
  const teamResolution = findCanonicalTeam(
    sourceTeam,
    normalizedTeamName,
    aliases,
  );

  return {
    season,
    ranking: parseNumber(row.RANKING, "RANKING"),
    sourceTeam,
    normalizedTeamName,
    resolutionInput: teamResolution.resolutionInput,
    canonicalTeam: teamResolution.canonicalTeam,
    points: parseNumber(row.POINTS, "POINTS"),
    wins: parseNumber(row.WIN, "WIN"),
    draws: parseNumber(row.DRAW, "DRAW"),
    losses: parseNumber(row.LOSE, "LOSE"),
    goalBalance: parseNumber(
      getCorrectedColumnValue(row, "GOAL-BALANCE", correction),
      "GOAL-BALANCE",
    ),
    goalsFor: parseNumber(
      getCorrectedColumnValue(row, "GOALS-PRO", correction),
      "GOALS-PRO",
    ),
    goalsAgainst: parseNumber(
      getCorrectedColumnValue(row, "GOALS-AGAINST", correction),
      "GOALS-AGAINST",
    ),
    matches: parseNumber(row.MATCHES, "MATCHES"),
  };
}

export async function parseCzeksterStandingsFile(
  rankingPath: string,
  aliasesPath: string,
  correctionsPath?: string,
): Promise<ParsedCzeksterStandingsFile> {
  const bytes = await readFile(rankingPath);
  const encoding = detectEncoding(bytes);
  const content = decodeFile(bytes, encoding);
  const { columns, rows } = parseRows(content);
  const aliases = await carregarAliasesDeEquipes(aliasesPath);
  const corrections = correctionsPath
    ? (JSON.parse(
        await readFile(correctionsPath, "utf-8"),
      ) as CzeksterSourceCorrection[])
    : [];

  return {
    encoding,
    delimiter,
    columns,
    rawRows: rows,
    standings: rows.map((row) => toParsedStanding(row, aliases, corrections)),
  };
}
