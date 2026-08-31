import type { Team } from "../../../generated/prisma/client.js";

export type TeamResponse = {
  slug: string;
  name: string;
  shortName: string | null;
  state: string | null;
};

export function mapTeamToResponse(team: Team): TeamResponse {
  return {
    slug: team.slug,
    name: team.name,
    shortName: team.shortName,
    state: team.state,
  };
}
