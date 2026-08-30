import {
  readFile,
  mkdir,
  writeFile,
} from "node:fs/promises";

import {
  spawnSync,
} from "node:child_process";

import {
  dirname,
  resolve,
} from "node:path";

import {
  fileURLToPath,
} from "node:url";

interface ResumoComparacao {
  partidasAdaoduque: number;
  partidasOpenFootball: number;

  partidasCorrespondentes: number;

  placaresIguais: number;

  resultadosAdministrativosReconhecidos: number;

  correcoesFonteReconhecidas: number;

  resultadosValidados: number;

  placaresDivergentes: number;

  somenteAdaoduque: number;
  somenteOpenFootball: number;

  aliasesNaoEncontrados: number;

  linhasOpenFootballNaoInterpretadas: number;

  partidasAnuladasConfiguradas: number;
  partidasAnuladasFiltradas: number;
  anulacoesNaoEncontradas: number;

  resultadosAdministrativosConfigurados: number;
  administrativosNaoEncontrados: number;

  correcoesFonteConfiguradas: number;
  correcoesFonteNaoEncontradas: number;
}

interface RelatorioComparacao {
  temporada: number;

  fontes: string[];

  geradoEm: string;

  resumo: ResumoComparacao;

  aliasesNaoEncontrados: string[];

  divergenciasPlacares: unknown[];

  somenteAdaoduque: string[];

  somenteOpenFootball: string[];

  linhasOpenFootballNaoInterpretadas: string[];
}

interface ResultadoTemporada {
  temporada: number;

  partidasAdaoduque: number;
  partidasOpenFootball: number;

  correspondentes: number;

  resultadosValidados: number;

  divergencias: number;

  somenteAdaoduque: number;
  somenteOpenFootball: number;

  aliasesPendentes: number;

  linhasNaoInterpretadas: number;

  pendenciasHistoricas: number;

  status:
    | "VALIDATED"
    | "REVIEW_REQUIRED";

  motivosRevisao: string[];
}

const caminhoArquivoAtual =
  fileURLToPath(import.meta.url);

const diretorioArquivoAtual =
  dirname(caminhoArquivoAtual);

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
    ? Number(argumentoInicio)
    : 2006;

const temporadaFinal =
  argumentoFim
    ? Number(argumentoFim)
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

const caminhoResumo =
  resolve(
    raizProjeto,
    `data/audit/historical-validation-summary-${temporadaInicial}-${temporadaFinal}.json`,
  );

function executarComparador(
  temporada: number,
): void {
  const caminhoComparador =
    resolve(
      raizProjeto,
      "scripts/compare/compare-sources.ts",
    );

  const resultado =
    spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        caminhoComparador,
        String(
          temporada,
        ),
      ],
      {
        cwd:
          raizProjeto,

        encoding:
          "utf-8",

        stdio:
          "pipe",
      },
    );

  if (
    resultado.error
  ) {
    throw resultado.error;
  }

  if (
    resultado.status !== 0
  ) {
    if (
      resultado.stdout
    ) {
      console.error(
        resultado.stdout,
      );
    }

    if (
      resultado.stderr
    ) {
      console.error(
        resultado.stderr,
      );
    }

    throw new Error(
      `Falha ao comparar a temporada ${temporada}.`,
    );
  }
}

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

function analisarTemporada(
  relatorio:
    RelatorioComparacao,
): ResultadoTemporada {
  const resumo =
    relatorio.resumo;

  const motivosRevisao:
    string[] = [];

  if (
    resumo.partidasAdaoduque !==
    resumo.partidasOpenFootball
  ) {
    motivosRevisao.push(
      "different_match_totals",
    );
  }

  if (
    resumo.partidasCorrespondentes !==
    resumo.partidasAdaoduque
  ) {
    motivosRevisao.push(
      "unmatched_matches",
    );
  }

  if (
    resumo.resultadosValidados !==
    resumo.partidasCorrespondentes
  ) {
    motivosRevisao.push(
      "unvalidated_results",
    );
  }

  if (
    resumo.placaresDivergentes > 0
  ) {
    motivosRevisao.push(
      "score_divergences",
    );
  }

  if (
    resumo.somenteAdaoduque > 0
  ) {
    motivosRevisao.push(
      "matches_only_in_adaoduque",
    );
  }

  if (
    resumo.somenteOpenFootball > 0
  ) {
    motivosRevisao.push(
      "matches_only_in_openfootball",
    );
  }

  if (
    resumo.aliasesNaoEncontrados > 0
  ) {
    motivosRevisao.push(
      "missing_team_aliases",
    );
  }

  if (
    resumo
      .linhasOpenFootballNaoInterpretadas >
    0
  ) {
    motivosRevisao.push(
      "unparsed_openfootball_lines",
    );
  }

  if (
    resumo.anulacoesNaoEncontradas >
    0
  ) {
    motivosRevisao.push(
      "missing_annulled_matches",
    );
  }

  if (
    resumo.administrativosNaoEncontrados >
    0
  ) {
    motivosRevisao.push(
      "missing_administrative_results",
    );
  }

  if (
    resumo.correcoesFonteNaoEncontradas >
    0
  ) {
    motivosRevisao.push(
      "missing_source_corrections",
    );
  }

  const pendenciasHistoricas =
    resumo.anulacoesNaoEncontradas +
    resumo.administrativosNaoEncontrados +
    resumo.correcoesFonteNaoEncontradas;

  return {
    temporada:
      relatorio.temporada,

    partidasAdaoduque:
      resumo.partidasAdaoduque,

    partidasOpenFootball:
      resumo.partidasOpenFootball,

    correspondentes:
      resumo.partidasCorrespondentes,

    resultadosValidados:
      resumo.resultadosValidados,

    divergencias:
      resumo.placaresDivergentes,

    somenteAdaoduque:
      resumo.somenteAdaoduque,

    somenteOpenFootball:
      resumo.somenteOpenFootball,

    aliasesPendentes:
      resumo.aliasesNaoEncontrados,

    linhasNaoInterpretadas:
      resumo
        .linhasOpenFootballNaoInterpretadas,

    pendenciasHistoricas,

    status:
      motivosRevisao.length === 0
        ? "VALIDATED"
        : "REVIEW_REQUIRED",

    motivosRevisao,
  };
}

async function executar():
  Promise<void> {
  console.log(
    `Validando temporadas de ${temporadaInicial} a ${temporadaFinal}...\n`,
  );

  const resultados:
    ResultadoTemporada[] = [];

  for (
    let temporada =
      temporadaInicial;
    temporada <=
      temporadaFinal;
    temporada += 1
  ) {
    console.log(
      `[${temporada}] Executando comparação...`,
    );

    executarComparador(
      temporada,
    );

    const relatorio =
      await carregarRelatorio(
        temporada,
      );

    const resultado =
      analisarTemporada(
        relatorio,
      );

    resultados.push(
      resultado,
    );

    console.log(
      `[${temporada}] ${resultado.status}\n`,
    );
  }

  const validadas =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "VALIDATED",
    );

  const revisar =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "REVIEW_REQUIRED",
    );

  const relatorioFinal = {
    intervalo: {
      inicio:
        temporadaInicial,

      fim:
        temporadaFinal,
    },

    geradoEm:
      new Date().toISOString(),

    resumo: {
      temporadasAnalisadas:
        resultados.length,

      temporadasValidadas:
        validadas.length,

      temporadasParaRevisao:
        revisar.length,
    },

    temporadas:
      resultados,
  };

  await mkdir(
    dirname(
      caminhoResumo,
    ),
    {
      recursive: true,
    },
  );

  await writeFile(
    caminhoResumo,

    JSON.stringify(
      relatorioFinal,
      null,
      2,
    ),

    "utf-8",
  );

  console.log(
    "Resumo da validação histórica:\n",
  );

  console.table(
    resultados.map(
      (resultado) => ({
        temporada:
          resultado.temporada,

        adaoduque:
          resultado.partidasAdaoduque,

        openfootball:
          resultado.partidasOpenFootball,

        correspondentes:
          resultado.correspondentes,

        validados:
          resultado.resultadosValidados,

        divergencias:
          resultado.divergencias,

        somenteAdao:
          resultado.somenteAdaoduque,

        somenteOF:
          resultado.somenteOpenFootball,

        aliases:
          resultado.aliasesPendentes,

        naoInterpretadas:
          resultado.linhasNaoInterpretadas,

        status:
          resultado.status,
      }),
    ),
  );

  console.log(
    "\nTotais:",
  );

  console.table([
    {
      temporadas:
        resultados.length,

      validadas:
        validadas.length,

      revisar:
        revisar.length,
    },
  ]);

  if (
    revisar.length > 0
  ) {
    console.log(
      "\nTemporadas que precisam de revisão:",
    );

    for (
      const resultado
      of revisar
    ) {
      console.log(
        `${resultado.temporada}: ${resultado.motivosRevisao.join(", ")}`,
      );
    }
  }

  console.log(
    "\nAuditoria em lote concluída.",
  );

  console.log(
    `Resumo salvo em: ${caminhoResumo}`,
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha durante a validação histórica em lote:",
    );

    console.error(
      erro,
    );

    process.exitCode = 1;
  },
);