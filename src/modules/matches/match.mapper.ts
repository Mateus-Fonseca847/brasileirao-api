import type {
  Match,
  MatchTeamStat,
  Season,
  Team,
} from "../../../generated/prisma/client.js";

import { mapTeamToResponse, type TeamResponse } from "../teams/team.mapper.js";

export type MatchWithRelations = Match & {
  season: Season;
  homeTeam: Team;
  awayTeam: Team;
};

type ScoreResponse = {
  home: number | null;
  away: number | null;
};

export type MatchResponse = {
  id: string;
  season: number;
  round: number | null;
  matchDate: string | null;
  kickoffTime: string | null;
  stadium: string | null;
  status: string;
  officialScore: ScoreResponse;
  playedScore: ScoreResponse | null;
  homeTeam: TeamResponse;
  awayTeam: TeamResponse;
};

export type MatchStatsWithRelations = Match & {
  homeTeam: Team;
  awayTeam: Team;
  teamStats: MatchTeamStat[];
};

type MatchTeamStatsResponse = {
  team: TeamResponse;
  shots: number | null;
  possession: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

export type MatchStatsResponse = {
  matchId: string;
  home: MatchTeamStatsResponse;
  away: MatchTeamStatsResponse;
};

function formatDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function formatTime(value: Date | null): string | null {
  return value?.toISOString().slice(11, 16) ?? null;
}

export function mapMatchToResponse(match: MatchWithRelations): MatchResponse {
  return {
    id: match.id,
    season: match.season.year,
    round: match.round,
    matchDate: formatDate(match.matchDate),
    kickoffTime: formatTime(match.kickoffTime),
    stadium: match.stadium,
    status: match.status,
    officialScore: {
      home: match.homeGoals,
      away: match.awayGoals,
    },
    playedScore:
      match.playedHomeGoals === null && match.playedAwayGoals === null
        ? null
        : {
            home: match.playedHomeGoals,
            away: match.playedAwayGoals,
          },
    homeTeam: mapTeamToResponse(match.homeTeam),
    awayTeam: mapTeamToResponse(match.awayTeam),
  };
}

function mapTeamStatsToResponse(
  team: Team,
  stats: MatchTeamStat | undefined,
): MatchTeamStatsResponse {
  return {
    team: mapTeamToResponse(team),
    shots: stats?.shots ?? null,
    possession: stats?.possession == null ? null : Number(stats.possession),
    yellowCards: stats?.yellowCards ?? null,
    redCards: stats?.redCards ?? null,
  };
}

export function mapMatchStatsToResponse(
  match: MatchStatsWithRelations,
): MatchStatsResponse {
  const homeStats = match.teamStats.find(
    (stats) => stats.teamId === match.homeTeamId,
  );
  const awayStats = match.teamStats.find(
    (stats) => stats.teamId === match.awayTeamId,
  );

  return {
    matchId: match.id,
    home: mapTeamStatsToResponse(match.homeTeam, homeStats),
    away: mapTeamStatsToResponse(match.awayTeam, awayStats),
  };
}
