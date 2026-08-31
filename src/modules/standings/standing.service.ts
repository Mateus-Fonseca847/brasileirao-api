import { prisma } from "../../database/prisma.js";

export function findSeasonStandingsByYear(year: number) {
  return prisma.season.findUnique({
    where: {
      year,
    },
    include: {
      standings: {
        include: {
          team: true,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}
