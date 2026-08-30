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

import {
  interpretarOpenFootballV0,
} from "../parsers/openfootball-v0.js";

interface ResumoTemporada {
  temporada: number;
  partidas: number;
  equipes: number;
  rodadas: number;
  gols: number;
  linhasNaoInterpretadas: number;
  linhasIgnoradas: number;
  status: "PARSED" | "REVIEW_REQUIRED";
}

const argumento =
  process.argv[2];

if (!argumento) {
  throw new Error(
    "Informe uma temporada ou 'all'. Exemplos: npm run audit:openfootball-v0 -- 2017 | npm run audit:openfootball-v0 -- all",
  );
}

const PRIMEIRA_TEMPORADA = 2003;
const ULTIMA_TEMPORADA = 2017;

const caminhoArquivoAtual =
  fileURLToPath(import.meta.url);

const diretorioArquivoAtual =
  dirname(caminhoArquivoAtual);

const raizProjeto = resolve(
  diretorioArquivoAtual,
  "../..",
);

function obterTemporadas(): number[] {
  if (
    argumento.toLowerCase() === "all"
  ) {
    const temporadas: number[] = [];

    for (
      let temporada =
        PRIMEIRA_TEMPORADA;
      temporada <=
        ULTIMA_TEMPORADA;
      temporada += 1
    ) {
      temporadas.push(
        temporada,
      );
    }

    return temporadas;
  }

  const temporada =
    Number(argumento);

  if (
    Number.isNaN(temporada)
  ) {
    throw new Error(
      `Argumento inválido: ${argumento}`,
    );
  }

  if (
    temporada <
      PRIMEIRA_TEMPORADA ||
    temporada >
      ULTIMA_TEMPORADA
  ) {
    throw new Error(
      `Temporada fora do intervalo histórico disponível: ${temporada}`,
    );
  }

  return [
    temporada,
  ];
}

function criarCaminhoFonte(
  temporada: number,
): string {
  return resolve(
    raizProjeto,
    `data/raw/openfootball-v0/${temporada}_br1.txt`,
  );
}

function criarCaminhoRelatorio(
  temporada: number,
): string {
  return resolve(
    raizProjeto,
    `data/audit/openfootball-v0-${temporada}-audit.json`,
  );
}

function determinarStatus(
  resumo: Omit<
    ResumoTemporada,
    "status"
  >,
): "PARSED" | "REVIEW_REQUIRED" {
  const estruturaEncontrada =
    resumo.partidas > 0 &&
    resumo.equipes > 0 &&
    resumo.rodadas > 0;

  const semLinhasPendentes =
    resumo.linhasNaoInterpretadas === 0;

  if (
    estruturaEncontrada &&
    semLinhasPendentes
  ) {
    return "PARSED";
  }

  return "REVIEW_REQUIRED";
}

async function auditarTemporada(
  temporada: number,
): Promise<ResumoTemporada> {
  const caminhoFonte =
    criarCaminhoFonte(
      temporada,
    );

  const conteudo =
    await readFile(
      caminhoFonte,
      "utf-8",
    );

  const resultado =
    interpretarOpenFootballV0(
      conteudo,
    );

  const equipes =
    new Set<string>();

  const rodadas =
    new Set<number>();

  let totalGols = 0;

  for (
    const partida
    of resultado.partidas
  ) {
    equipes.add(
      partida.mandante,
    );

    equipes.add(
      partida.visitante,
    );

    rodadas.add(
      partida.rodada,
    );

    totalGols +=
      partida.golsMandante +
      partida.golsVisitante;
  }

  const resumoBase = {
    temporada,

    partidas:
      resultado.partidas.length,

    equipes:
      equipes.size,

    rodadas:
      rodadas.size,

    gols:
      totalGols,

    linhasNaoInterpretadas:
      resultado
        .linhasNaoInterpretadas
        .length,

    linhasIgnoradas:
      resultado
      .linhasIgnoradas
      .length,
  };

  const resumo:
    ResumoTemporada = {
      ...resumoBase,

      status:
        determinarStatus(
          resumoBase,
        ),
    };

  const relatorio = {
    fonte:
      "openfootball_v0",

    temporada,

    geradoEm:
      new Date().toISOString(),

    resumo,

    equipes:
      [...equipes]
        .sort(),

    linhasNaoInterpretadas:
      resultado
        .linhasNaoInterpretadas,
  };

  const caminhoRelatorio =
    criarCaminhoRelatorio(
      temporada,
    );

  await mkdir(
    dirname(
      caminhoRelatorio,
    ),
    {
      recursive: true,
    },
  );

  await writeFile(
    caminhoRelatorio,

    JSON.stringify(
      relatorio,
      null,
      2,
    ),

    "utf-8",
  );

  return resumo;
}

async function salvarResumoHistorico(
  resultados: ResumoTemporada[],
): Promise<void> {
  const caminhoResumo = resolve(
    raizProjeto,
    "data/audit/openfootball-v0-summary-2003-2017.json",
  );

  const temporadasComRevisao =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "REVIEW_REQUIRED",
    );

  const relatorio = {
    fonte:
      "openfootball_v0",

    intervalo: {
      inicio:
        PRIMEIRA_TEMPORADA,

      fim:
        ULTIMA_TEMPORADA,
    },

    geradoEm:
      new Date().toISOString(),

    resumo: {
      temporadasAnalisadas:
        resultados.length,

      temporadasInterpretadas:
        resultados.length -
        temporadasComRevisao.length,

      temporadasComRevisao:
        temporadasComRevisao.length,
    },

    temporadas:
      resultados,
  };

  await writeFile(
    caminhoResumo,

    JSON.stringify(
      relatorio,
      null,
      2,
    ),

    "utf-8",
  );
}

async function executar():
  Promise<void> {
  const temporadas =
    obterTemporadas();

  console.log(
    "Iniciando auditoria histórica do OpenFootball V0...\n",
  );

  console.log(
    `Temporadas: ${temporadas[0]} → ${temporadas[temporadas.length - 1]}\n`,
  );

  const resultados:
    ResumoTemporada[] = [];

  for (
    const temporada
    of temporadas
  ) {
    console.log(
      `${temporada}: auditando...`,
    );

    try {
      const resultado =
        await auditarTemporada(
          temporada,
        );

      resultados.push(
        resultado,
      );

      console.log(
        `${temporada}: ${resultado.status}`,
      );
    } catch (erro) {
      console.error(
        `${temporada}: falha durante a auditoria.`,
      );

      console.error(
        erro,
      );

      resultados.push({
        temporada,
        partidas: 0,
        equipes: 0,
        rodadas: 0,
        gols: 0,
        linhasIgnoradas: 0,
        linhasNaoInterpretadas: 0,
        status:
          "REVIEW_REQUIRED",
      });
    }
  }

  console.log(
    "\nResultado da auditoria:",
  );

  console.table(
    resultados.map(
      (resultado) => ({
        temporada:
          resultado.temporada,

        partidas:
          resultado.partidas,

        equipes:
          resultado.equipes,

        rodadas:
          resultado.rodadas,

        gols:
          resultado.gols,

        naoInterpretadas:
          resultado
            .linhasNaoInterpretadas,

        ignoradas:
          resultado
            .linhasIgnoradas,

        status:
          resultado.status,
      }),
    ),
  );

  if (
    temporadas.length > 1
  ) {
    await salvarResumoHistorico(
      resultados,
    );

    console.log(
      "\nRelatório consolidado salvo em:",
    );

    console.log(
      resolve(
        raizProjeto,
        "data/audit/openfootball-v0-summary-2003-2017.json",
      ),
    );
  }

  const temporadasComRevisao =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "REVIEW_REQUIRED",
    );

  if (
    temporadasComRevisao.length >
    0
  ) {
    console.log(
      "\nTemporadas que exigem revisão:",
    );

    console.log(
      temporadasComRevisao
        .map(
          (resultado) =>
            resultado.temporada,
        )
        .join(", "),
    );

    return;
  }

  console.log(
    "\nTodos os arquivos foram interpretados sem erros estruturais detectados.",
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha inesperada durante a auditoria histórica:",
    );

    console.error(
      erro,
    );

    process.exitCode = 1;
  },
);