import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { interpretarOpenFootballTxt } from "../parsers/openfootball-txt.js";

const caminhoArquivoAtual = fileURLToPath(import.meta.url);
const diretorioArquivoAtual = dirname(caminhoArquivoAtual);

const raizProjeto = resolve(
  diretorioArquivoAtual,
  "../..",
);

const caminhoFonte = resolve(
  raizProjeto,
  "data/raw/openfootball/2024_br1.txt",
);

const caminhoRelatorio = resolve(
  raizProjeto,
  "data/audit/openfootball-2024-audit.json",
);

async function executarAuditoria(): Promise<void> {
  console.log(
    "Iniciando auditoria do OpenFootball 2024...\n",
  );

  const conteudo = await readFile(
    caminhoFonte,
    "utf-8",
  );

  const resultado =
    interpretarOpenFootballTxt(conteudo);

  const partidas = resultado.partidas;

  const equipes = new Set<string>();
  const rodadas = new Set<number>();

  let totalGols = 0;

  for (const partida of partidas) {
    equipes.add(partida.mandante);
    equipes.add(partida.visitante);

    rodadas.add(partida.rodada);

    totalGols +=
      partida.golsMandante +
      partida.golsVisitante;
  }

  const partidasPorRodada = new Map<
    number,
    number
  >();

  for (const partida of partidas) {
    const quantidadeAtual =
      partidasPorRodada.get(partida.rodada) ?? 0;

    partidasPorRodada.set(
      partida.rodada,
      quantidadeAtual + 1,
    );
  }

  const relatorio = {
    fonte: "openfootball",
    temporada: 2024,
    geradoEm: new Date().toISOString(),

    resumo: {
      partidas: partidas.length,
      equipes: equipes.size,
      rodadas: rodadas.size,
      gols: totalGols,
      linhasNaoInterpretadas:
        resultado.linhasNaoInterpretadas.length,
    },

    equipes: [...equipes].sort(),

    partidasPorRodada: [
      ...partidasPorRodada.entries(),
    ]
      .sort(([rodadaA], [rodadaB]) => {
        return rodadaA - rodadaB;
      })
      .map(([rodada, quantidade]) => ({
        rodada,
        quantidade,
      })),

    linhasNaoInterpretadas:
      resultado.linhasNaoInterpretadas,
  };

  await mkdir(
    dirname(caminhoRelatorio),
    {
      recursive: true,
    },
  );

  await writeFile(
    caminhoRelatorio,
    JSON.stringify(relatorio, null, 2),
    "utf-8",
  );

  console.table([
    {
      temporada: 2024,
      partidas: partidas.length,
      equipes: equipes.size,
      rodadas: rodadas.size,
      gols: totalGols,
      naoInterpretadas:
        resultado.linhasNaoInterpretadas.length,
    },
  ]);

  console.log(
    "\nEquipes encontradas:",
  );

  console.log(
    [...equipes].sort().join("\n"),
  );

  console.log(
    "\nAuditoria concluída.",
  );

  console.log(
    `Relatório salvo em: ${caminhoRelatorio}`,
  );
}

executarAuditoria().catch((erro) => {
  console.error(
    "\nFalha durante a auditoria do OpenFootball:",
  );

  console.error(erro);

  process.exitCode = 1;
});