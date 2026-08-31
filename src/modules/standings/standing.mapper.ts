import type { Standing, Team } from "../../../generated/prisma/client.js";

import { mapTeamToResponse, type TeamResponse } from "../teams/team.mapper.js";

type StandingWithTeam = Standing & {
  team: Team;
};

export type StandingResponse = {
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
  team: TeamResponse;
};

export function mapStandingToResponse(
  standing: StandingWithTeam,
): StandingResponse {
  return {
    position: standing.position,
    points: standing.points,
    played: standing.played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goalsFor: standing.goalsFor,
    goalsAgainst: standing.goalsAgainst,
    goalDifference: standing.goalDifference,
    pointsAdjustment: standing.pointsAdjustment,
    team: mapTeamToResponse(standing.team),
  };
}
