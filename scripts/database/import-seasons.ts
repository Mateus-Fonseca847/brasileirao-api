import { readFile } from "node:fs/promises";

import { prisma } from "../../src/database/prisma.js";

type HistoricalValidationSeason = {
  temporada: number;
  status: string;
};

type HistoricalValidationSummary = {
  temporadas: HistoricalValidationSeason[];
};

const summaryPath = new URL(
  "../../data/audit/historical-validation-summary-2003-2024.json",
  import.meta.url,
);

function isHistoricalValidationSummary(
  value: unknown,
): value is HistoricalValidationSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { temporadas } = value as { temporadas?: unknown };

  return (
    Array.isArray(temporadas) &&
    temporadas.every(
      (temporada) =>
        typeof temporada === "object" &&
        temporada !== null &&
        typeof (temporada as { temporada?: unknown }).temporada === "number" &&
        typeof (temporada as { status?: unknown }).status === "string",
    )
  );
}

async function importarTemporadas(): Promise<void> {
  const fileContent = await readFile(summaryPath, "utf8");
  const summary: unknown = JSON.parse(fileContent);

  if (!isHistoricalValidationSummary(summary)) {
    throw new Error("Resumo de validação histórica está em formato inválido.");
  }

  const temporadasValidadas = summary.temporadas.filter(
    (temporada) => temporada.status === "VALIDATED",
  );

  await prisma.$transaction(
    temporadasValidadas.map((temporada) =>
      prisma.season.upsert({
        where: {
          year: temporada.temporada,
        },
        create: {
          year: temporada.temporada,
          status: "FINISHED",
          startDate: null,
          endDate: null,
          teamsCount: null,
        },
        update: {
          status: "FINISHED",
          startDate: null,
          endDate: null,
          teamsCount: null,
        },
      }),
    ),
  );

  console.log(`Temporadas validadas importadas: ${temporadasValidadas.length}`);
  console.log(
    `Intervalo: ${temporadasValidadas[0]?.temporada ?? "nenhum"}-${
      temporadasValidadas.at(-1)?.temporada ?? "nenhum"
    }`,
  );
}

importarTemporadas()
  .catch((erro: unknown) => {
    console.error("Falha ao importar temporadas históricas:");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
