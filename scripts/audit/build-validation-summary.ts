import {
  readFile,
  writeFile,
} from "node:fs/promises";

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
  placaresDivergentes: number;
  somenteAdaoduque: number;
  somenteOpenFootball: number;
  aliasesNaoEncontrados: number;
  linhasOpenFootballNaoInterpretadas: number;
}

interface RelatorioComparacao {
  temporada: number;

  fontes: string[];

  geradoEm: string;

  resumo: ResumoComparacao;
}

interface TemporadaConsolidada {
  temporada: number;

  partidasAdaoduque: number;
  partidasOpenFootball: number;

  correspondentes: number;
  placaresIguais: number;

  divergencias: number;

  somenteAdaoduque: number;
  somenteOpenFootball: number;

  aliasesPendentes: number;
  linhasNaoInterpretadas: number;

  status: "VERIFIED" | "REVIEW_REQUIRED";
}

const caminhoArquivoAtual =
  fileURLToPath(import.meta.url);

const diretorioArquivoAtual =
  dirname(caminhoArquivoAtual);

const raizProjeto = resolve(
  diretorioArquivoAtual,
  "../..",
);

const temporadas = [
  2018,
  2019,
  2020,
  2021,
  2022,
  2023,
  2024,
];

const caminhoRelatorioFinal = resolve(
  raizProjeto,
  "data/audit/source-comparison-summary-2018-2024.json",
);

function determinarStatus(
  resumo: ResumoComparacao,
): "VERIFIED" | "REVIEW_REQUIRED" {
  const completamenteCorrespondente =
    resumo.partidasAdaoduque ===
      resumo.partidasOpenFootball &&
    resumo.partidasCorrespondentes ===
      resumo.partidasAdaoduque;

  const semProblemas =
    resumo.placaresDivergentes === 0 &&
    resumo.somenteAdaoduque === 0 &&
    resumo.somenteOpenFootball === 0 &&
    resumo.aliasesNaoEncontrados === 0 &&
    resumo.linhasOpenFootballNaoInterpretadas === 0;

  const todosPlacaresIguais =
    resumo.placaresIguais ===
    resumo.partidasCorrespondentes;

  if (
    completamenteCorrespondente &&
    semProblemas &&
    todosPlacaresIguais
  ) {
    return "VERIFIED";
  }

  return "REVIEW_REQUIRED";
}

async function lerRelatorio(
  temporada: number,
): Promise<RelatorioComparacao> {
  const caminho = resolve(
    raizProjeto,
    `data/audit/source-comparison-${temporada}.json`,
  );

  const conteudo = await readFile(
    caminho,
    "utf-8",
  );

  return JSON.parse(
    conteudo,
  ) as RelatorioComparacao;
}

async function executar(): Promise<void> {
  console.log(
    "Construindo relatório consolidado de validação...\n",
  );

  const resultados:
    TemporadaConsolidada[] = [];

  for (const temporada of temporadas) {
    const relatorio =
      await lerRelatorio(
        temporada,
      );

    const resumo =
      relatorio.resumo;

    resultados.push({
      temporada,

      partidasAdaoduque:
        resumo.partidasAdaoduque,

      partidasOpenFootball:
        resumo.partidasOpenFootball,

      correspondentes:
        resumo.partidasCorrespondentes,

      placaresIguais:
        resumo.placaresIguais,

      divergencias:
        resumo.placaresDivergentes,

      somenteAdaoduque:
        resumo.somenteAdaoduque,

      somenteOpenFootball:
        resumo.somenteOpenFootball,

      aliasesPendentes:
        resumo.aliasesNaoEncontrados,

      linhasNaoInterpretadas:
        resumo.linhasOpenFootballNaoInterpretadas,

      status:
        determinarStatus(
          resumo,
        ),
    });
  }

  const totais = resultados.reduce(
    (acumulador, temporada) => {
      acumulador.partidas +=
        temporada.correspondentes;

      acumulador.placaresIguais +=
        temporada.placaresIguais;

      acumulador.divergencias +=
        temporada.divergencias;

      if (
        temporada.status === "VERIFIED"
      ) {
        acumulador.temporadasVerificadas += 1;
      }

      return acumulador;
    },
    {
      temporadasAnalisadas:
        temporadas.length,

      temporadasVerificadas: 0,

      partidas: 0,

      placaresIguais: 0,

      divergencias: 0,
    },
  );

  const todasVerificadas =
    totais.temporadasVerificadas ===
    totais.temporadasAnalisadas;

  const relatorioFinal = {
    intervalo: {
      inicio: 2018,
      fim: 2024,
    },

    fontes: [
      "adaoduque_brasileirao",
      "openfootball",
    ],

    geradoEm:
      new Date().toISOString(),

    status:
      todasVerificadas
        ? "VERIFIED"
        : "REVIEW_REQUIRED",

    totais,

    temporadas: resultados,
  };

  await writeFile(
    caminhoRelatorioFinal,

    JSON.stringify(
      relatorioFinal,
      null,
      2,
    ),

    "utf-8",
  );

  console.table(
    resultados.map(
      (resultado) => ({
        temporada:
          resultado.temporada,

        partidas:
          resultado.correspondentes,

        placaresIguais:
          resultado.placaresIguais,

        divergencias:
          resultado.divergencias,

        aliasesPendentes:
          resultado.aliasesPendentes,

        status:
          resultado.status,
      }),
    ),
  );

  console.log(
    "\nResumo geral:",
  );

  console.table([
    {
      temporadas:
        totais.temporadasAnalisadas,

      verificadas:
        totais.temporadasVerificadas,

      partidas:
        totais.partidas,

      placaresIguais:
        totais.placaresIguais,

      divergencias:
        totais.divergencias,

      status:
        relatorioFinal.status,
    },
  ]);

  console.log(
    "\nRelatório consolidado criado.",
  );

  console.log(
    `Arquivo: ${caminhoRelatorioFinal}`,
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha ao construir o relatório consolidado:",
    );

    console.error(erro);

    process.exitCode = 1;
  },
);