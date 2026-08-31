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

function parseNumber(row: RawCzeksterStandingRow, column: string): number {
  const value = Number(row[column]);

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric value for ${column}: ${row[column]}`);
  }

  return value;
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

function toParsedStanding(
  row: RawCzeksterStandingRow,
  aliases: Map<string, string>,
): ParsedCzeksterStanding {
  const sourceTeam = row.TEAM ?? "";
  const normalizedTeamName = stripBrazilianStateSuffix(sourceTeam);
  const teamResolution = findCanonicalTeam(
    sourceTeam,
    normalizedTeamName,
    aliases,
  );

  return {
    season: parseNumber(row, "YEAR"),
    ranking: parseNumber(row, "RANKING"),
    sourceTeam,
    normalizedTeamName,
    resolutionInput: teamResolution.resolutionInput,
    canonicalTeam: teamResolution.canonicalTeam,
    points: parseNumber(row, "POINTS"),
    wins: parseNumber(row, "WIN"),
    draws: parseNumber(row, "DRAW"),
    losses: parseNumber(row, "LOSE"),
    goalBalance: parseNumber(row, "GOAL-BALANCE"),
    goalsFor: parseNumber(row, "GOALS-PRO"),
    goalsAgainst: parseNumber(row, "GOALS-AGAINST"),
    matches: parseNumber(row, "MATCHES"),
  };
}

export async function parseCzeksterStandingsFile(
  rankingPath: string,
  aliasesPath: string,
): Promise<ParsedCzeksterStandingsFile> {
  const bytes = await readFile(rankingPath);
  const encoding = detectEncoding(bytes);
  const content = decodeFile(bytes, encoding);
  const { columns, rows } = parseRows(content);
  const aliases = await carregarAliasesDeEquipes(aliasesPath);

  return {
    encoding,
    delimiter,
    columns,
    rawRows: rows,
    standings: rows.map((row) => toParsedStanding(row, aliases)),
  };
}
