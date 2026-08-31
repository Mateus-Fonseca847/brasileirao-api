import { prisma } from "../../database/prisma.js";

export function listSeasons() {
  return prisma.season.findMany({
    orderBy: {
      year: "asc",
    },
  });
}

export function findSeasonByYear(year: number) {
  return prisma.season.findUnique({
    where: {
      year,
    },
  });
}
