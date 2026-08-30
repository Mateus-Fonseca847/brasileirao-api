import {
  readFile,
  mkdir,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
  resolve,
} from "node:path";

import {
  fileURLToPath,
} from "node:url";

interface RelatorioComparacao {
  temporada: number;

  aliasesNaoEncontrados: string[];
}

interface AliasConsolidado {
  alias: string;

  temporadas: number[];

  quantidadeTemporadas: number;
}

interface ResumoTemporada {
  temporada: number;

  quantidadeAliases: number;

  aliases: string[];
}

const caminhoArquivoAtual =
  fileURLToPath(
    import.meta.url,
  );

const diretorioArquivoAtual =
  dirname(
    caminhoArquivoAtual,
  );

const raizProjeto =
  resolve(
    diretorioArquivoAtual,
    "../..",
  );

const argumentoInicio =
  process.argv[2];

const argumentoFim =
  process.argv[3];

const temporadaInicial =
  argumentoInicio
    ? Number(
        argumentoInicio,
      )
    : 2006;

const temporadaFinal =
  argumentoFim
    ? Number(
        argumentoFim,
      )
    : 2016;

if (
  Number.isNaN(
    temporadaInicial,
  ) ||
  Number.isNaN(
    temporadaFinal,
  )
) {
  throw new Error(
    "As temporadas precisam ser números válidos.",
  );
}

if (
  temporadaInicial < 2003 ||
  temporadaFinal > 2024
) {
  throw new Error(
    "O intervalo precisa estar entre 2003 e 2024.",
  );
}

if (
  temporadaInicial >
  temporadaFinal
) {
  throw new Error(
    "A temporada inicial não pode ser maior que a temporada final.",
  );
}

const caminhoRelatorioFinal =
  resolve(
    raizProjeto,
    `data/audit/team-aliases-summary-${temporadaInicial}-${temporadaFinal}.json`,
  );

async function carregarRelatorio(
  temporada: number,
): Promise<RelatorioComparacao> {
  const caminho =
    resolve(
      raizProjeto,
      `data/audit/source-comparison-${temporada}.json`,
    );

  const conteudo =
    await readFile(
      caminho,
      "utf-8",
    );

  return JSON.parse(
    conteudo,
  ) as RelatorioComparacao;
}

async function executar():
  Promise<void> {
  console.log(
    `Auditando aliases de ${temporadaInicial} a ${temporadaFinal}...\n`,
  );

  const resumoPorTemporada:
    ResumoTemporada[] = [];

  const mapaAliases =
    new Map<
      string,
      Set<number>
    >();

  for (
    let temporada =
      temporadaInicial;
    temporada <=
      temporadaFinal;
    temporada += 1
  ) {
    const relatorio =
      await carregarRelatorio(
        temporada,
      );

    const aliases =
      [
        ...new Set(
          relatorio
            .aliasesNaoEncontrados,
        ),
      ].sort(
        (
          aliasA,
          aliasB,
        ) =>
          aliasA.localeCompare(
            aliasB,
            "pt-BR",
          ),
      );

    resumoPorTemporada.push({
      temporada,

      quantidadeAliases:
        aliases.length,

      aliases,
    });

    for (
      const alias
      of aliases
    ) {
      const temporadas =
        mapaAliases.get(
          alias,
        ) ??
        new Set<number>();

      temporadas.add(
        temporada,
      );

      mapaAliases.set(
        alias,
        temporadas,
      );
    }
  }

  const aliasesConsolidados:
    AliasConsolidado[] =
      [...mapaAliases.entries()]
        .map(
          (
            [
              alias,
              temporadas,
            ],
          ) => ({
            alias,

            temporadas:
              [...temporadas]
                .sort(
                  (a, b) =>
                    a - b,
                ),

            quantidadeTemporadas:
              temporadas.size,
          }),
        )
        .sort(
          (
            aliasA,
            aliasB,
          ) => {
            if (
              aliasA
                .quantidadeTemporadas !==
              aliasB
                .quantidadeTemporadas
            ) {
              return (
                aliasB
                  .quantidadeTemporadas -
                aliasA
                  .quantidadeTemporadas
              );
            }

            return aliasA
              .alias
              .localeCompare(
                aliasB.alias,
                "pt-BR",
              );
          },
        );

  const relatorioFinal = {
    intervalo: {
      inicio:
        temporadaInicial,

      fim:
        temporadaFinal,
    },

    geradoEm:
      new Date()
        .toISOString(),

    resumo: {
      temporadasAnalisadas:
        resumoPorTemporada.length,

      aliasesUnicos:
        aliasesConsolidados.length,

      temporadasComAliases:
        resumoPorTemporada
          .filter(
            (temporada) =>
              temporada
                .quantidadeAliases >
              0,
          )
          .length,
    },

    porTemporada:
      resumoPorTemporada,

    aliasesConsolidados,
  };

  await mkdir(
    dirname(
      caminhoRelatorioFinal,
    ),
    {
      recursive: true,
    },
  );

  await writeFile(
    caminhoRelatorioFinal,

    JSON.stringify(
      relatorioFinal,
      null,
      2,
    ),

    "utf-8",
  );

  console.log(
    "Aliases pendentes por temporada:\n",
  );

  console.table(
    resumoPorTemporada.map(
      (resultado) => ({
        temporada:
          resultado.temporada,

        quantidade:
          resultado
            .quantidadeAliases,

        aliases:
          resultado.aliases
            .join(", "),
      }),
    ),
  );

  console.log(
    "\nAliases consolidados:\n",
  );

  console.table(
    aliasesConsolidados.map(
      (resultado) => ({
        alias:
          resultado.alias,

        temporadas:
          resultado.temporadas
            .join(", "),

        quantidadeTemporadas:
          resultado
            .quantidadeTemporadas,
      }),
    ),
  );

  console.log(
    "\nTotais:",
  );

  console.table([
    {
      temporadasAnalisadas:
        resumoPorTemporada.length,

      temporadasComAliases:
        resumoPorTemporada
          .filter(
            (resultado) =>
              resultado
                .quantidadeAliases >
              0,
          )
          .length,

      aliasesUnicos:
        aliasesConsolidados.length,
    },
  ]);

  console.log(
    "\nAuditoria de aliases concluída.",
  );

  console.log(
    `Relatório salvo em: ${caminhoRelatorioFinal}`,
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha durante a auditoria de aliases:",
    );

    console.error(
      erro,
    );

    process.exitCode = 1;
  },
);