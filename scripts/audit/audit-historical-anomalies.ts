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
  parse,
} from "csv-parse/sync";

import {
  interpretarOpenFootballV0,
} from "../parsers/openfootball-v0.js";

import {
  extrairTemporadaBrasileirao,
} from "../normalization/seasons.js";

import {
  carregarAliasesDeEquipes,
  encontrarIdCanonico,
} from "../normalization/team-names.js";

type RegistroCsv =
  Record<string, string>;

interface PartidaAuditoria {
  rodada: number;

  mandante: string;
  visitante: string;

  golsMandante: number;
  golsVisitante: number;
}

interface ResumoRodada {
  rodada: number;

  partidasAdaoduque: number;
  partidasOpenFootball: number;

  golsAdaoduque: number;
  golsOpenFootball: number;

  diferencaPartidas: number;
  diferencaGols: number;
}

interface ConfrontoRepetido {
  chave: string;

  quantidade: number;

  partidas: {
    rodada: number;
    mandante: string;
    visitante: string;
    placar: string;
  }[];
}

interface PartidaAnulada {
  round: number;

  homeTeam: string;
  awayTeam: string;

  annulledScore: {
    home: number;
    away: number;
  };

  replayScore: {
    home: number;
    away: number;
  };

  status: "ANNULLED";
}

interface RegistroPartidasAnuladas {
  season: number;

  reason: string;
  decision: string;

  matches: PartidaAnulada[];
}

const argumentoTemporada =
  process.argv[2];

const temporada =
  Number(argumentoTemporada);

if (
  !argumentoTemporada ||
  Number.isNaN(temporada)
) {
  throw new Error(
    "Informe uma temporada. Exemplo: npm run audit:historical-anomalies -- 2005",
  );
}

if (
  temporada < 2003 ||
  temporada > 2017
) {
  throw new Error(
    `Temporada fora do intervalo histórico suportado: ${temporada}`,
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

const caminhos = {
  adaoduque: resolve(
    raizProjeto,
    "data/raw/adaoduque/campeonato-brasileiro-full.csv",
  ),

  openfootball: resolve(
    raizProjeto,
    `data/raw/openfootball-v0/${temporada}_br1.txt`,
  ),

  relatorio: resolve(
    raizProjeto,
    `data/audit/historical-anomalies-${temporada}.json`,
  ),

  aliases: resolve(
    raizProjeto,
    "data/mappings/team-aliases.json",
  ),

  partidasAnuladas: resolve(
    raizProjeto,
    "data/mappings/annulled-matches.json",
  ),
};

function normalizarNome(
  valor: string,
): string {
  return valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .toLowerCase();
}

function somarGols(
  partidas: PartidaAuditoria[],
): number {
  return partidas.reduce(
    (
      total,
      partida,
    ) => {
      return (
        total +
        partida.golsMandante +
        partida.golsVisitante
      );
    },
    0,
  );
}

function agruparPorRodada(
  partidas: PartidaAuditoria[],
): Map<number, PartidaAuditoria[]> {
  const mapa =
    new Map<
      number,
      PartidaAuditoria[]
    >();

  for (
    const partida
    of partidas
  ) {
    const partidasRodada =
      mapa.get(
        partida.rodada,
      ) ?? [];

    partidasRodada.push(
      partida,
    );

    mapa.set(
      partida.rodada,
      partidasRodada,
    );
  }

  return mapa;
}

function encontrarConfrontosRepetidos(
  partidas: PartidaAuditoria[],
  aliases: Map<string, string>,
): ConfrontoRepetido[] {
  const mapa =
    new Map<
      string,
      PartidaAuditoria[]
    >();

  for (
    const partida
    of partidas
  ) {
    const mandante =
  encontrarIdCanonico(
    partida.mandante,
    aliases,
  ) ??
  normalizarNome(
    partida.mandante,
  );

const visitante =
  encontrarIdCanonico(
    partida.visitante,
    aliases,
  ) ??
  normalizarNome(
    partida.visitante,
  );

    /*
     * A rodada não entra na chave.
     *
     * Assim conseguimos identificar
     * confrontos com o mesmo mandante
     * e visitante que aparecem mais de
     * uma vez na temporada.
     */

    const chave =
      `${mandante}|${visitante}`;

    const existentes =
      mapa.get(
        chave,
      ) ?? [];

    existentes.push(
      partida,
    );

    mapa.set(
      chave,
      existentes,
    );
  }

  const repetidos:
    ConfrontoRepetido[] = [];

  for (
    const [
      chave,
      confrontos,
    ]
    of mapa
  ) {
    if (
      confrontos.length <= 1
    ) {
      continue;
    }

    repetidos.push({
      chave,

      quantidade:
        confrontos.length,

      partidas:
        confrontos.map(
          (partida) => ({
            rodada:
              partida.rodada,

            mandante:
              partida.mandante,

            visitante:
              partida.visitante,

            placar:
              `${partida.golsMandante}-${partida.golsVisitante}`,
          }),
        ),
    });
  }

  return repetidos.sort(
    (
      confrontoA,
      confrontoB,
    ) =>
      confrontoA.chave.localeCompare(
        confrontoB.chave,
      ),
  );
}

async function lerAdaoduque():
  Promise<PartidaAuditoria[]> {
  const conteudo =
    await readFile(
      caminhos.adaoduque,
      "utf-8",
    );

  const registros =
    parse(
      conteudo,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      },
    ) as RegistroCsv[];

  const partidas:
    PartidaAuditoria[] = [];

  for (
    const registro
    of registros
  ) {
    const temporadaRegistro =
      extrairTemporadaBrasileirao(
        registro.data,
      );

    if (
      temporadaRegistro !==
      temporada
    ) {
      continue;
    }

    partidas.push({
      rodada:
        Number(
          registro.rodata,
        ),

      mandante:
        registro.mandante,

      visitante:
        registro.visitante,

      golsMandante:
        Number(
          registro.mandante_Placar,
        ),

      golsVisitante:
        Number(
          registro.visitante_Placar,
        ),
    });
  }

  return partidas;
}

async function lerOpenFootball():
  Promise<PartidaAuditoria[]> {
  const conteudo =
    await readFile(
      caminhos.openfootball,
      "utf-8",
    );

  const resultado =
    interpretarOpenFootballV0(
      conteudo,
    );

  return resultado.partidas.map(
    (partida) => ({
      rodada:
        partida.rodada,

      mandante:
        partida.mandante,

      visitante:
        partida.visitante,

      golsMandante:
        partida.golsMandante,

      golsVisitante:
        partida.golsVisitante,
    }),
  );
}

async function lerPartidasAnuladas():
  Promise<PartidaAnulada[]> {
  if (
    temporada !== 2005
  ) {
    return [];
  }

  const conteudo =
    await readFile(
      caminhos.partidasAnuladas,
      "utf-8",
    );

  const registro =
    JSON.parse(
      conteudo,
    ) as RegistroPartidasAnuladas;

  if (
    registro.season !== temporada
  ) {
    throw new Error(
      `O arquivo de partidas anuladas pertence à temporada ${registro.season}, mas a auditoria está analisando ${temporada}.`,
    );
  }

  return registro.matches;
}

async function executar():
  Promise<void> {
  console.log(
    `Auditando anomalias históricas — ${temporada}...\n`,
  );

  const aliases =
   await carregarAliasesDeEquipes(
      caminhos.aliases,
  );

  const [
    partidasAdao,
    partidasOpenFootball,
  ] = await Promise.all([
    lerAdaoduque(),
    lerOpenFootball(),
  ]);

  const partidasAnuladas =
    await lerPartidasAnuladas();

  const partidasOpenFootballOficiais =
    partidasOpenFootball.length -
    partidasAnuladas.length;

  const rodadasAdao =
    agruparPorRodada(
      partidasAdao,
    );

  const rodadasOpenFootball =
    agruparPorRodada(
      partidasOpenFootball,
    );

  const todasRodadas =
    new Set<number>([
      ...rodadasAdao.keys(),
      ...rodadasOpenFootball.keys(),
    ]);

  const resumoRodadas:
    ResumoRodada[] = [];

  for (
    const rodada
    of [...todasRodadas].sort(
      (a, b) => a - b,
    )
  ) {
    const jogosAdao =
      rodadasAdao.get(
        rodada,
      ) ?? [];

    const jogosOpenFootball =
      rodadasOpenFootball.get(
        rodada,
      ) ?? [];

    const golsAdao =
      somarGols(
        jogosAdao,
      );

    const golsOpenFootball =
      somarGols(
        jogosOpenFootball,
      );

    resumoRodadas.push({
      rodada,

      partidasAdaoduque:
        jogosAdao.length,

      partidasOpenFootball:
        jogosOpenFootball.length,

      golsAdaoduque:
        golsAdao,

      golsOpenFootball:
        golsOpenFootball,

      diferencaPartidas:
        jogosOpenFootball.length -
        jogosAdao.length,

      diferencaGols:
        golsOpenFootball -
        golsAdao,
    });
  }

  const rodadasDivergentes =
    resumoRodadas.filter(
      (rodada) =>
        rodada.diferencaPartidas !== 0 ||
        rodada.diferencaGols !== 0,
    );

  const confrontosRepetidosAdao =
  encontrarConfrontosRepetidos(
    partidasAdao,
    aliases,
  );

const confrontosRepetidosOpenFootball =
  encontrarConfrontosRepetidos(
    partidasOpenFootball,
    aliases,
  );

  const detalhesRodadasDivergentes =
    rodadasDivergentes.map(
      (resumo) => ({
        resumo,

        adaoduque:
          (
            rodadasAdao.get(
              resumo.rodada,
            ) ?? []
          ).map(
            (partida) => ({
              mandante:
                partida.mandante,

              visitante:
                partida.visitante,

              placar:
                `${partida.golsMandante}-${partida.golsVisitante}`,
            }),
          ),

        openfootball:
          (
            rodadasOpenFootball.get(
              resumo.rodada,
            ) ?? []
          ).map(
            (partida) => ({
              mandante:
                partida.mandante,

              visitante:
                partida.visitante,

              placar:
                `${partida.golsMandante}-${partida.golsVisitante}`,
            }),
          ),
      }),
    );

  const relatorio = {
    temporada,

    geradoEm:
      new Date().toISOString(),

    totais: {
      adaoduque: {
        partidas:
          partidasAdao.length,

        gols:
          somarGols(
            partidasAdao,
          ),
      },

      openfootball: {
        partidasFisicas:
          partidasOpenFootball.length,

        partidasAnuladas:
          partidasAnuladas.length,

        partidasOficiais:
          partidasOpenFootballOficiais,

        gols:
          somarGols(
            partidasOpenFootball,
          ),
      },
    },

    rodadasDivergentes:
      rodadasDivergentes.length,

    confrontosRepetidos: {
      adaoduque:
        confrontosRepetidosAdao,

      openfootball:
        confrontosRepetidosOpenFootball,
    },

    partidasAnuladas,

    detalhesRodadasDivergentes,
  };

  await mkdir(
    dirname(
      caminhos.relatorio,
    ),
    {
      recursive: true,
    },
  );

  await writeFile(
    caminhos.relatorio,

    JSON.stringify(
      relatorio,
      null,
      2,
    ),

    "utf-8",
  );

  console.log(
    "Totais:",
  );

  console.table([
    {
      fonte:
        "Adão Duque",

      partidas:
        partidasAdao.length,

      gols:
        somarGols(
          partidasAdao,
        ),

      confrontosRepetidos:
        confrontosRepetidosAdao.length,
    },

    {
      fonte:
        "OpenFootball V0",

      partidas:
        partidasOpenFootball.length,

      gols:
        somarGols(
          partidasOpenFootball,
        ),

      confrontosRepetidos:
        confrontosRepetidosOpenFootball.length,
    },
  ]);

  if (
    partidasAnuladas.length > 0
  ) {
    console.log(
      "\nTratamento histórico de partidas anuladas:",
    );

    console.table([
      {
        temporada,

        partidasFisicas:
          partidasOpenFootball.length,

        anuladas:
          partidasAnuladas.length,

        partidasOficiais:
          partidasOpenFootballOficiais,

        referenciaAdaoduque:
          partidasAdao.length,
      },
    ]);
  }

  console.log(
    "\nRodadas com diferenças:",
  );

  if (
    rodadasDivergentes.length === 0
  ) {
    console.log(
      "Nenhuma diferença encontrada nos totais por rodada.",
    );
  } else {
    console.table(
      rodadasDivergentes,
    );
  }

  console.log(
    "\nConfrontos repetidos no OpenFootball:",
  );

  if (
    confrontosRepetidosOpenFootball.length === 0
  ) {
    console.log(
      "Nenhum confronto repetido encontrado.",
    );
  } else {
    for (
      const confronto
      of confrontosRepetidosOpenFootball
    ) {
      console.log(
        `\n${confronto.chave}`,
      );

      console.table(
        confronto.partidas,
      );
    }
  }

  console.log(
    "\nAuditoria concluída.",
  );

  console.log(
    `Relatório salvo em: ${caminhos.relatorio}`,
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha durante a auditoria de anomalias:",
    );

    console.error(
      erro,
    );

    process.exitCode = 1;
  },
);