import type { Season } from "../../../generated/prisma/client.js";

export type SeasonResponse = {
  year: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  teamsCount: number | null;
};

function formatDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function mapSeasonToResponse(season: Season): SeasonResponse {
  return {
    year: season.year,
    status: season.status,
    startDate: formatDate(season.startDate),
    endDate: formatDate(season.endDate),
    teamsCount: season.teamsCount,
  };
}
