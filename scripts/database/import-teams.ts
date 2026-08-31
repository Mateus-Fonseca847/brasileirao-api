import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type CanonicalTeam = {
  slug: string;
  name: string;
};

const teamsPath = new URL("../../data/mappings/teams.json", import.meta.url);

function isCanonicalTeams(value: unknown): value is CanonicalTeam[] {
  return (
    Array.isArray(value) &&
    value.every(
      (team) =>
        typeof team === "object" &&
        team !== null &&
        typeof (team as { slug?: unknown }).slug === "string" &&
        typeof (team as { name?: unknown }).name === "string",
    )
  );
}

async function importarEquipes(): Promise<void> {
  const fileContent = await readFile(teamsPath, "utf8");
  const teams: unknown = JSON.parse(fileContent);

  if (!isCanonicalTeams(teams)) {
    throw new Error("Catálogo canônico de equipes está em formato inválido.");
  }

  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        slug: team.slug,
      },
      create: {
        slug: team.slug,
        name: team.name,
      },
      update: {
        name: team.name,
      },
    });
  }

  console.log(`Equipes canônicas importadas: ${teams.length}`);
}

importarEquipes()
  .catch((erro: unknown) => {
    console.error("Falha ao importar equipes canônicas:");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });