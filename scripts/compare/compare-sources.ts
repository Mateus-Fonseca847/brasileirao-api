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
  interpretarOpenFootballTxt,
} from "../parsers/openfootball-txt.js";

import {
  carregarAliasesDeEquipes,
  encontrarIdCanonico,
} from "../normalization/team-names.js";

import {
  extrairTemporadaBrasileirao,
} from "../normalization/seasons.js";

type RegistroCsv =
  Record<string, string>;

interface PartidaComparavel {
  fonte:
    | "adaoduque"
    | "openfootball";

  rodada: number;

  mandanteOriginal: string;
  visitanteOriginal: string;

  mandante: string;
  visitante: string;

  golsMandante: number;
  golsVisitante: number;
}

interface DivergenciaPlacar {
  chave: string;

  adaoduque: {
    placar: string;
  };

  openfootball: {
    placar: string;
  };
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
    "Informe uma temporada. Exemplo: npm run compare:season -- 2024",
  );
}

if (
  temporada < 2003 ||
  temporada > 2100
) {
  throw new Error(
    `Temporada inválida: ${temporada}`,
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
    `data/raw/openfootball/${temporada}_br1.txt`,
  ),

  aliases: resolve(
    raizProjeto,
    "data/mappings/team-aliases.json",
  ),

  relatorio: resolve(
    raizProjeto,
    `data/audit/source-comparison-${temporada}.json`,
  ),
};

function criarChavePartida(
  partida: PartidaComparavel,
): string {
  return [
    partida.rodada,
    partida.mandante,
    partida.visitante,
  ].join("|");
}

async function lerCsv(
  caminho: string,
): Promise<RegistroCsv[]> {
  const conteudo = await readFile(
    caminho,
    "utf-8",
  );

  return parse(
    conteudo,
    {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    },
  );
}

async function executarComparacao():
  Promise<void> {
  console.log(
    `Iniciando comparação Adão Duque x OpenFootball — ${temporada}...\n`,
  );

  const aliases =
    await carregarAliasesDeEquipes(
      caminhos.aliases,
    );

  const registrosAdao =
    await lerCsv(
      caminhos.adaoduque,
    );

  const conteudoOpenFootball =
    await readFile(
      caminhos.openfootball,
      "utf-8",
    );

  const resultadoOpenFootball =
    interpretarOpenFootballTxt(
      conteudoOpenFootball,
    );

  const aliasesNaoEncontrados =
    new Set<string>();

  const partidasAdao:
    PartidaComparavel[] = [];

  for (
    const registro
    of registrosAdao
  ) {
    const temporadaRegistro =
      extrairTemporadaBrasileirao(
        registro.data,
      );

    if (
      temporadaRegistro !== temporada
    ) {
      continue;
    }

    const mandante =
      encontrarIdCanonico(
        registro.mandante,
        aliases,
      );

    const visitante =
      encontrarIdCanonico(
        registro.visitante,
        aliases,
      );

    if (!mandante) {
      aliasesNaoEncontrados.add(
        registro.mandante,
      );
    }

    if (!visitante) {
      aliasesNaoEncontrados.add(
        registro.visitante,
      );
    }

    if (
      !mandante ||
      !visitante
    ) {
      continue;
    }

    partidasAdao.push({
      fonte: "adaoduque",

      rodada:
        Number(registro.rodata),

      mandanteOriginal:
        registro.mandante,

      visitanteOriginal:
        registro.visitante,

      mandante,
      visitante,

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

  const partidasOpenFootball:
    PartidaComparavel[] = [];

  for (
    const partida
    of resultadoOpenFootball.partidas
  ) {
    const mandante =
      encontrarIdCanonico(
        partida.mandante,
        aliases,
      );

    const visitante =
      encontrarIdCanonico(
        partida.visitante,
        aliases,
      );

    if (!mandante) {
      aliasesNaoEncontrados.add(
        partida.mandante,
      );
    }

    if (!visitante) {
      aliasesNaoEncontrados.add(
        partida.visitante,
      );
    }

    if (
      !mandante ||
      !visitante
    ) {
      continue;
    }

    partidasOpenFootball.push({
      fonte: "openfootball",

      rodada:
        partida.rodada,

      mandanteOriginal:
        partida.mandante,

      visitanteOriginal:
        partida.visitante,

      mandante,
      visitante,

      golsMandante:
        partida.golsMandante,

      golsVisitante:
        partida.golsVisitante,
    });
  }

  const mapaAdao =
    new Map<
      string,
      PartidaComparavel
    >();

  const mapaOpenFootball =
    new Map<
      string,
      PartidaComparavel
    >();

  for (
    const partida
    of partidasAdao
  ) {
    mapaAdao.set(
      criarChavePartida(
        partida,
      ),
      partida,
    );
  }

  for (
    const partida
    of partidasOpenFootball
  ) {
    mapaOpenFootball.set(
      criarChavePartida(
        partida,
      ),
      partida,
    );
  }

  let partidasCorrespondentes = 0;
  let placaresIguais = 0;

  const divergenciasPlacares:
    DivergenciaPlacar[] = [];

  const somenteAdao:
    string[] = [];

  const somenteOpenFootball:
    string[] = [];

  for (
    const [
      chave,
      partidaAdao,
    ]
    of mapaAdao
  ) {
    const partidaOpenFootball =
      mapaOpenFootball.get(
        chave,
      );

    if (!partidaOpenFootball) {
      somenteAdao.push(
        chave,
      );

      continue;
    }

    partidasCorrespondentes += 1;

    const placarIgual =
      partidaAdao.golsMandante ===
        partidaOpenFootball.golsMandante &&
      partidaAdao.golsVisitante ===
        partidaOpenFootball.golsVisitante;

    if (placarIgual) {
      placaresIguais += 1;
      continue;
    }

    divergenciasPlacares.push({
      chave,

      adaoduque: {
        placar:
          `${partidaAdao.golsMandante}-${partidaAdao.golsVisitante}`,
      },

      openfootball: {
        placar:
          `${partidaOpenFootball.golsMandante}-${partidaOpenFootball.golsVisitante}`,
      },
    });
  }

  for (
    const chave
    of mapaOpenFootball.keys()
  ) {
    if (!mapaAdao.has(chave)) {
      somenteOpenFootball.push(
        chave,
      );
    }
  }

  const relatorio = {
    temporada,

    fontes: [
      "adaoduque_brasileirao",
      "openfootball",
    ],

    geradoEm:
      new Date().toISOString(),

    resumo: {
      partidasAdaoduque:
        partidasAdao.length,

      partidasOpenFootball:
        partidasOpenFootball.length,

      partidasCorrespondentes,

      placaresIguais,

      placaresDivergentes:
        divergenciasPlacares.length,

      somenteAdaoduque:
        somenteAdao.length,

      somenteOpenFootball:
        somenteOpenFootball.length,

      aliasesNaoEncontrados:
        aliasesNaoEncontrados.size,

      linhasOpenFootballNaoInterpretadas:
        resultadoOpenFootball
          .linhasNaoInterpretadas
          .length,
    },

    aliasesNaoEncontrados:
      [...aliasesNaoEncontrados]
        .sort(),

    divergenciasPlacares,

    somenteAdaoduque:
      somenteAdao.sort(),

    somenteOpenFootball:
      somenteOpenFootball.sort(),

    linhasOpenFootballNaoInterpretadas:
      resultadoOpenFootball
        .linhasNaoInterpretadas,
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

  console.table([
    {
      temporada,

      adaoduque:
        partidasAdao.length,

      openfootball:
        partidasOpenFootball.length,

      correspondentes:
        partidasCorrespondentes,

      placaresIguais,

      divergencias:
        divergenciasPlacares.length,

      somenteAdao:
        somenteAdao.length,

      somenteOpenFootball:
        somenteOpenFootball.length,

      aliasesPendentes:
        aliasesNaoEncontrados.size,

      linhasNaoInterpretadas:
        resultadoOpenFootball
          .linhasNaoInterpretadas
          .length,
    },
  ]);

  if (
    aliasesNaoEncontrados.size > 0
  ) {
    console.log(
      "\nAliases não encontrados:",
    );

    console.log(
      [...aliasesNaoEncontrados]
        .sort()
        .join("\n"),
    );
  }

  if (
    divergenciasPlacares.length > 0
  ) {
    console.log(
      "\nPlacares divergentes:",
    );

    console.table(
      divergenciasPlacares,
    );
  }

  console.log(
    "\nComparação concluída.",
  );

  console.log(
    `Relatório salvo em: ${caminhos.relatorio}`,
  );
}

executarComparacao().catch(
  (erro) => {
    console.error(
      "\nFalha durante a comparação:",
    );

    console.error(erro);

    process.exitCode = 1;
  },
);