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

const argumentoTemporada =
  process.argv[2];

const temporada =
  Number(argumentoTemporada);

if (
  !argumentoTemporada ||
  Number.isNaN(temporada)
) {
  throw new Error(
    "Informe uma temporada. Exemplo: npm run audit:openfootball-v0 -- 2017",
  );
}

const caminhoArquivoAtual =
  fileURLToPath(import.meta.url);

const diretorioArquivoAtual =
  dirname(caminhoArquivoAtual);

const raizProjeto = resolve(
  diretorioArquivoAtual,
  "../..",
);

const caminhoFonte = resolve(
  raizProjeto,
  `data/raw/openfootball-v0/${temporada}_br1.txt`,
);

const caminhoRelatorio =
  resolve(
    raizProjeto,
    `data/audit/openfootball-v0-${temporada}-audit.json`,
  );

async function executar():
  Promise<void> {
  console.log(
    `Iniciando auditoria do OpenFootball V0 — ${temporada}...\n`,
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

  const relatorio = {
    fonte:
      "openfootball_v0",

    temporada,

    geradoEm:
      new Date().toISOString(),

    resumo: {
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
    },

    equipes:
      [...equipes].sort(),

    linhasNaoInterpretadas:
      resultado
        .linhasNaoInterpretadas,
  };

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

  console.table([
    {
      temporada,

      partidas:
        resultado.partidas.length,

      equipes:
        equipes.size,

      rodadas:
        rodadas.size,

      gols:
        totalGols,

      naoInterpretadas:
        resultado
          .linhasNaoInterpretadas
          .length,
    },
  ]);

  console.log(
    "\nEquipes encontradas:",
  );

  console.log(
    [...equipes]
      .sort()
      .join("\n"),
  );

  console.log(
    "\nAuditoria concluída.",
  );

  console.log(
    `Relatório salvo em: ${caminhoRelatorio}`,
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha durante a auditoria histórica:",
    );

    console.error(erro);

    process.exitCode = 1;
  },
);