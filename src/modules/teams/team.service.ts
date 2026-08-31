import { prisma } from "../../database/prisma.js";

export function listTeams() {
  return prisma.team.findMany({
    orderBy: [
      {
        name: "asc",
      },
      {
        slug: "asc",
      },
    ],
  });
}

export function findTeamBySlug(slug: string) {
  return prisma.team.findUnique({
    where: {
      slug,
    },
  });
}
