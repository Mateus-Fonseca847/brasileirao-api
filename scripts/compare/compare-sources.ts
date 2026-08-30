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
  interpretarOpenFootballV0,
} from "../parsers/openfootball-v0.js";

import {
  carregarAliasesDeEquipes,
  encontrarIdCanonico,
} from "../normalization/team-names.js";

import {
  extrairTemporadaBrasileirao,
} from "../normalization/seasons.js";

type RegistroCsv =
  Record<string, string>;

type FonteOpenFootball =
  | "openfootball"
  | "openfootball_v0";

interface PartidaComparavel {
  fonte:
    | "adaoduque"
    | FonteOpenFootball;

  rodada: number;

  mandanteOriginal: string;
  visitanteOriginal: string;

  mandante: string;
  visitante: string;

  golsMandante: number;
  golsVisitante: number;
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

interface ResultadoAdministrativo {
  season: number;
  round: number;

  homeTeam: string;
  awayTeam: string;

  playedScore: {
    home: number;
    away: number;
  };

  officialScore: {
    home: number;
    away: number;
  };

  status:
    "ADMINISTRATIVE_OVERRIDE";

  authority: string;

  replayRequired: boolean;
}

interface RegistroResultadosAdministrativos {
  results:
    ResultadoAdministrativo[];
}

interface CorrecaoFonte {
  season: number;

  source: FonteOpenFootball;

  homeTeam: string;
  awayTeam: string;

  sourceScore: {
    home: number;
    away: number;
  };

  verifiedScore: {
    home: number;
    away: number;
  };

  status:
    "SOURCE_CORRECTION";

  reason: string;
}

interface RegistroCorrecoesFonte {
  corrections:
    CorrecaoFonte[];
}

interface PartidaOpenFootballComparavel {
  rodada: number;

  mandante: string;
  visitante: string;

  golsMandante: number;
  golsVisitante: number;
}

interface ResultadoLeituraOpenFootball {
  fonte: FonteOpenFootball;

  partidas:
    PartidaOpenFootballComparavel[];

  linhasNaoInterpretadas:
    string[];
}

interface DivergenciaPlacar {
  chave: string;

  adaoduque: {
    confronto: string;
    placar: string;
  };

  openfootball: {
    confronto: string;
    placar: string;
  };
}

interface ResultadoAdministrativoReconhecido {
  chave: string;

  autoridade: string;

  rodadaConfigurada: number;

  placarEmCampo: string;

  placarOficial: string;
}

interface CorrecaoFonteReconhecida {
  chave: string;

  fonte: FonteOpenFootball;

  placarNaFonte: string;

  placarVerificado: string;

  motivo: string;
}

const argumentoTemporada =
  process.argv[2];

const temporada =
  Number(
    argumentoTemporada,
  );

if (
  !argumentoTemporada ||
  Number.isNaN(
    temporada,
  )
) {
  throw new Error(
    "Informe uma temporada. Exemplo: npm run compare:season -- 2017",
  );
}

if (
  temporada < 2003 ||
  temporada > 2024
) {
  throw new Error(
    `Temporada fora do intervalo de comparação disponível: ${temporada}`,
  );
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

const caminhos = {
  adaoduque: resolve(
    raizProjeto,
    "data/raw/adaoduque/campeonato-brasileiro-full.csv",
  ),

  aliases: resolve(
    raizProjeto,
    "data/mappings/team-aliases.json",
  ),

  partidasAnuladas: resolve(
    raizProjeto,
    "data/mappings/annulled-matches.json",
  ),

  resultadosAdministrativos: resolve(
    raizProjeto,
    "data/mappings/administrative-results.json",
  ),

  correcoesFonte: resolve(
    raizProjeto,
    "data/mappings/source-corrections.json",
  ),

  relatorio: resolve(
    raizProjeto,
    `data/audit/source-comparison-${temporada}.json`,
  ),
};

function criarChaveConfronto(
  partida: PartidaComparavel,
): string {
  return [
    partida.mandante,
    partida.visitante,
  ]
    .sort()
    .join("|");
}

function obterGolsEquipe(
  partida: PartidaComparavel,
  equipe: string,
): number | null {
  if (
    partida.mandante ===
    equipe
  ) {
    return partida
      .golsMandante;
  }

  if (
    partida.visitante ===
    equipe
  ) {
    return partida
      .golsVisitante;
  }

  return null;
}

function criarAssinaturaPlacar(
  partida: PartidaComparavel,
): string {
  const equipes =
    [
      partida.mandante,
      partida.visitante,
    ].sort();

  const [
    equipeA,
    equipeB,
  ] = equipes;

  const golsEquipeA =
    obterGolsEquipe(
      partida,
      equipeA,
    );

  const golsEquipeB =
    obterGolsEquipe(
      partida,
      equipeB,
    );

  return [
    `${equipeA}:${golsEquipeA}`,
    `${equipeB}:${golsEquipeB}`,
  ].join("|");
}

function formatarConfronto(
  partida: PartidaComparavel,
): string {
  return (
    `${partida.mandante}` +
    "|" +
    `${partida.visitante}`
  );
}

function formatarPlacar(
  partida: PartidaComparavel,
): string {
  return (
    `${partida.golsMandante}` +
    "-" +
    `${partida.golsVisitante}`
  );
}

function mesmoParDeEquipes(
  partida: PartidaComparavel,
  equipeA: string,
  equipeB: string,
): boolean {
  return (
    (
      partida.mandante ===
        equipeA &&
      partida.visitante ===
        equipeB
    ) ||
    (
      partida.mandante ===
        equipeB &&
      partida.visitante ===
        equipeA
    )
  );
}

function correspondePlacarPorEquipe(
  partida: PartidaComparavel,
  equipeMandanteConfigurada:
    string,
  equipeVisitanteConfigurada:
    string,
  golsMandanteConfigurado:
    number,
  golsVisitanteConfigurado:
    number,
): boolean {
  if (
    !mesmoParDeEquipes(
      partida,
      equipeMandanteConfigurada,
      equipeVisitanteConfigurada,
    )
  ) {
    return false;
  }

  const golsMandante =
    obterGolsEquipe(
      partida,
      equipeMandanteConfigurada,
    );

  const golsVisitante =
    obterGolsEquipe(
      partida,
      equipeVisitanteConfigurada,
    );

  return (
    golsMandante ===
      golsMandanteConfigurado &&
    golsVisitante ===
      golsVisitanteConfigurado
  );
}

function correspondeResultadoAdministrativo(
  partidaAdao:
    PartidaComparavel,
  partidaOpenFootball:
    PartidaComparavel,
  resultado:
    ResultadoAdministrativo,
): boolean {
  const oficialCorresponde =
    correspondePlacarPorEquipe(
      partidaAdao,

      resultado.homeTeam,
      resultado.awayTeam,

      resultado
        .officialScore
        .home,

      resultado
        .officialScore
        .away,
    );

  if (
    !oficialCorresponde
  ) {
    return false;
  }

  return correspondePlacarPorEquipe(
    partidaOpenFootball,

    resultado.homeTeam,
    resultado.awayTeam,

    resultado
      .playedScore
      .home,

    resultado
      .playedScore
      .away,
  );
}

function correspondeCorrecaoFonte(
  partidaAdao:
    PartidaComparavel,
  partidaOpenFootball:
    PartidaComparavel,
  correcao:
    CorrecaoFonte,
): boolean {
  const verificadoCorresponde =
    correspondePlacarPorEquipe(
      partidaAdao,

      correcao.homeTeam,
      correcao.awayTeam,

      correcao
        .verifiedScore
        .home,

      correcao
        .verifiedScore
        .away,
    );

  if (
    !verificadoCorresponde
  ) {
    return false;
  }

  return correspondePlacarPorEquipe(
    partidaOpenFootball,

    correcao.homeTeam,
    correcao.awayTeam,

    correcao
      .sourceScore
      .home,

    correcao
      .sourceScore
      .away,
  );
}

function criarChavePartidaAnulada(
  rodada: number,
  mandante: string,
  visitante: string,
  golsMandante: number,
  golsVisitante: number,
): string {
  return [
    rodada,
    mandante,
    visitante,
    `${golsMandante}-${golsVisitante}`,
  ].join("|");
}

function agruparPartidasPorConfronto(
  partidas:
    PartidaComparavel[],
): Map<
  string,
  PartidaComparavel[]
> {
  const mapa =
    new Map<
      string,
      PartidaComparavel[]
    >();

  for (
    const partida
    of partidas
  ) {
    const chave =
      criarChaveConfronto(
        partida,
      );

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

  return mapa;
}

async function lerCsv(
  caminho: string,
): Promise<RegistroCsv[]> {
  const conteudo =
    await readFile(
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

async function lerOpenFootball():
  Promise<ResultadoLeituraOpenFootball> {
  if (
    temporada <= 2017
  ) {
    const caminho =
      resolve(
        raizProjeto,
        `data/raw/openfootball-v0/${temporada}_br1.txt`,
      );

    const conteudo =
      await readFile(
        caminho,
        "utf-8",
      );

    const resultado =
      interpretarOpenFootballV0(
        conteudo,
      );

    return {
      fonte:
        "openfootball_v0",

      partidas:
        resultado.partidas.map(
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
        ),

      linhasNaoInterpretadas:
        resultado
          .linhasNaoInterpretadas,
    };
  }

  const caminho =
    resolve(
      raizProjeto,
      `data/raw/openfootball/${temporada}_br1.txt`,
    );

  const conteudo =
    await readFile(
      caminho,
      "utf-8",
    );

  const resultado =
    interpretarOpenFootballTxt(
      conteudo,
    );

  return {
    fonte:
      "openfootball",

    partidas:
      resultado.partidas.map(
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
      ),

    linhasNaoInterpretadas:
      resultado
        .linhasNaoInterpretadas,
  };
}

async function carregarPartidasAnuladas():
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
    registro.season !==
    temporada
  ) {
    throw new Error(
      `Registro de partidas anuladas pertence à temporada ${registro.season}.`,
    );
  }

  return registro.matches;
}

async function carregarResultadosAdministrativos():
  Promise<
    ResultadoAdministrativo[]
  > {
  const conteudo =
    await readFile(
      caminhos
        .resultadosAdministrativos,
      "utf-8",
    );

  const registro =
    JSON.parse(
      conteudo,
    ) as RegistroResultadosAdministrativos;

  return registro.results.filter(
    (resultado) =>
      resultado.season ===
      temporada,
  );
}

async function carregarCorrecoesFonte(
  fonte: FonteOpenFootball,
): Promise<CorrecaoFonte[]> {
  const conteudo =
    await readFile(
      caminhos.correcoesFonte,
      "utf-8",
    );

  const registro =
    JSON.parse(
      conteudo,
    ) as RegistroCorrecoesFonte;

  return registro.corrections.filter(
    (correcao) =>
      correcao.season ===
        temporada &&
      correcao.source ===
        fonte,
  );
}

function criarMapaDeAnulacoes(
  partidasAnuladas:
    PartidaAnulada[],
): Map<string, number> {
  const mapa =
    new Map<
      string,
      number
    >();

  for (
    const partida
    of partidasAnuladas
  ) {
    const chave =
      criarChavePartidaAnulada(
        partida.round,
        partida.homeTeam,
        partida.awayTeam,
        partida
          .annulledScore
          .home,
        partida
          .annulledScore
          .away,
      );

    const quantidadeAtual =
      mapa.get(
        chave,
      ) ?? 0;

    mapa.set(
      chave,
      quantidadeAtual + 1,
    );
  }

  return mapa;
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

  const resultadoOpenFootball =
    await lerOpenFootball();

  console.log(
    `Formato OpenFootball utilizado: ${resultadoOpenFootball.fonte}\n`,
  );

  const partidasAnuladas =
    await carregarPartidasAnuladas();

  const anulacoesPendentes =
    criarMapaDeAnulacoes(
      partidasAnuladas,
    );

  const resultadosAdministrativos =
    await carregarResultadosAdministrativos();

  const correcoesFonte =
    await carregarCorrecoesFonte(
      resultadoOpenFootball.fonte,
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
      temporadaRegistro !==
      temporada
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

    if (
      !mandante
    ) {
      aliasesNaoEncontrados.add(
        registro.mandante,
      );
    }

    if (
      !visitante
    ) {
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
      fonte:
        "adaoduque",

      rodada:
        Number(
          registro.rodata,
        ),

      mandanteOriginal:
        registro.mandante,

      visitanteOriginal:
        registro.visitante,

      mandante,
      visitante,

      golsMandante:
        Number(
          registro
            .mandante_Placar,
        ),

      golsVisitante:
        Number(
          registro
            .visitante_Placar,
        ),
    });
  }

  const partidasOpenFootball:
    PartidaComparavel[] = [];

  let partidasAnuladasFiltradas =
    0;

  for (
    const partida
    of resultadoOpenFootball
      .partidas
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

    if (
      !mandante
    ) {
      aliasesNaoEncontrados.add(
        partida.mandante,
      );
    }

    if (
      !visitante
    ) {
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

    const chaveAnulacao =
      criarChavePartidaAnulada(
        partida.rodada,
        mandante,
        visitante,
        partida.golsMandante,
        partida.golsVisitante,
      );

    const quantidadePendente =
      anulacoesPendentes.get(
        chaveAnulacao,
      ) ?? 0;

    if (
      quantidadePendente > 0
    ) {
      partidasAnuladasFiltradas +=
        1;

      if (
        quantidadePendente === 1
      ) {
        anulacoesPendentes.delete(
          chaveAnulacao,
        );
      } else {
        anulacoesPendentes.set(
          chaveAnulacao,
          quantidadePendente - 1,
        );
      }

      continue;
    }

    partidasOpenFootball.push({
      fonte:
        resultadoOpenFootball.fonte,

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

  const gruposAdao =
    agruparPartidasPorConfronto(
      partidasAdao,
    );

  const gruposOpenFootball =
    agruparPartidasPorConfronto(
      partidasOpenFootball,
    );

  const todasChaves =
    new Set<string>([
      ...gruposAdao.keys(),
      ...gruposOpenFootball.keys(),
    ]);

  let partidasCorrespondentes =
    0;

  let placaresIguais =
    0;

  const divergenciasPlacares:
    DivergenciaPlacar[] = [];

  const resultadosAdministrativosReconhecidos:
    ResultadoAdministrativoReconhecido[] =
      [];

  const correcoesFonteReconhecidas:
    CorrecaoFonteReconhecida[] =
      [];

  const indicesAdministrativosReconhecidos =
    new Set<number>();

  const indicesCorrecoesReconhecidas =
    new Set<number>();

  const somenteAdao:
    string[] = [];

  const somenteOpenFootball:
    string[] = [];

  for (
    const chave
    of [...todasChaves].sort()
  ) {
    const partidasGrupoAdao =
      gruposAdao.get(
        chave,
      ) ?? [];

    const partidasGrupoOpenFootball =
      gruposOpenFootball.get(
        chave,
      ) ?? [];

    const usadosAdao =
      new Set<number>();

    const usadosOpenFootball =
      new Set<number>();

    /*
     * Primeiro procuramos partidas cujo
     * resultado por clube é exatamente
     * igual.
     *
     * A ordem mandante/visitante não é
     * relevante para esta comparação.
     */

    for (
      let indiceAdao = 0;
      indiceAdao <
      partidasGrupoAdao.length;
      indiceAdao += 1
    ) {
      const partidaAdao =
        partidasGrupoAdao[
          indiceAdao
        ];

      const assinaturaAdao =
        criarAssinaturaPlacar(
          partidaAdao,
        );

      let indiceEncontrado =
        -1;

      for (
        let indiceOpen = 0;
        indiceOpen <
        partidasGrupoOpenFootball.length;
        indiceOpen += 1
      ) {
        if (
          usadosOpenFootball.has(
            indiceOpen,
          )
        ) {
          continue;
        }

        const partidaOpenFootball =
          partidasGrupoOpenFootball[
            indiceOpen
          ];

        const assinaturaOpenFootball =
          criarAssinaturaPlacar(
            partidaOpenFootball,
          );

        if (
          assinaturaAdao ===
          assinaturaOpenFootball
        ) {
          indiceEncontrado =
            indiceOpen;

          break;
        }
      }

      if (
        indiceEncontrado === -1
      ) {
        continue;
      }

      usadosAdao.add(
        indiceAdao,
      );

      usadosOpenFootball.add(
        indiceEncontrado,
      );

      partidasCorrespondentes +=
        1;

      placaresIguais +=
        1;
    }

    /*
     * Depois dos placares iguais,
     * verificamos exceções históricas
     * conhecidas.
     */

    for (
      let indiceAdao = 0;
      indiceAdao <
      partidasGrupoAdao.length;
      indiceAdao += 1
    ) {
      if (
        usadosAdao.has(
          indiceAdao,
        )
      ) {
        continue;
      }

      const partidaAdao =
        partidasGrupoAdao[
          indiceAdao
        ];

      let encontrouExcecao =
        false;

      for (
        let indiceOpen = 0;
        indiceOpen <
        partidasGrupoOpenFootball.length;
        indiceOpen += 1
      ) {
        if (
          usadosOpenFootball.has(
            indiceOpen,
          )
        ) {
          continue;
        }

        const partidaOpenFootball =
          partidasGrupoOpenFootball[
            indiceOpen
          ];

        let indiceAdministrativo =
          -1;

        for (
          let indice = 0;
          indice <
          resultadosAdministrativos.length;
          indice += 1
        ) {
          if (
            indicesAdministrativosReconhecidos.has(
              indice,
            )
          ) {
            continue;
          }

          const resultado =
            resultadosAdministrativos[
              indice
            ];

          if (
            correspondeResultadoAdministrativo(
              partidaAdao,
              partidaOpenFootball,
              resultado,
            )
          ) {
            indiceAdministrativo =
              indice;

            break;
          }
        }

        if (
          indiceAdministrativo !==
          -1
        ) {
          const resultado =
            resultadosAdministrativos[
              indiceAdministrativo
            ];

          indicesAdministrativosReconhecidos.add(
            indiceAdministrativo,
          );

          usadosAdao.add(
            indiceAdao,
          );

          usadosOpenFootball.add(
            indiceOpen,
          );

          partidasCorrespondentes +=
            1;

          resultadosAdministrativosReconhecidos.push({
            chave,

            autoridade:
              resultado.authority,

            rodadaConfigurada:
              resultado.round,

            placarEmCampo:
              `${resultado.playedScore.home}-${resultado.playedScore.away}`,

            placarOficial:
              `${resultado.officialScore.home}-${resultado.officialScore.away}`,
          });

          encontrouExcecao =
            true;

          break;
        }

        let indiceCorrecao =
          -1;

        for (
          let indice = 0;
          indice <
          correcoesFonte.length;
          indice += 1
        ) {
          if (
            indicesCorrecoesReconhecidas.has(
              indice,
            )
          ) {
            continue;
          }

          const correcao =
            correcoesFonte[
              indice
            ];

          if (
            correspondeCorrecaoFonte(
              partidaAdao,
              partidaOpenFootball,
              correcao,
            )
          ) {
            indiceCorrecao =
              indice;

            break;
          }
        }

        if (
          indiceCorrecao !==
          -1
        ) {
          const correcao =
            correcoesFonte[
              indiceCorrecao
            ];

          indicesCorrecoesReconhecidas.add(
            indiceCorrecao,
          );

          usadosAdao.add(
            indiceAdao,
          );

          usadosOpenFootball.add(
            indiceOpen,
          );

          partidasCorrespondentes +=
            1;

          correcoesFonteReconhecidas.push({
            chave,

            fonte:
              correcao.source,

            placarNaFonte:
              `${correcao.sourceScore.home}-${correcao.sourceScore.away}`,

            placarVerificado:
              `${correcao.verifiedScore.home}-${correcao.verifiedScore.away}`,

            motivo:
              correcao.reason,
          });

          encontrouExcecao =
            true;

          break;
        }
      }

      if (
        encontrouExcecao
      ) {
        continue;
      }
    }

    /*
     * Tudo que ainda restar no mesmo
     * confronto é considerado uma
     * partida correspondente com
     * placar divergente.
     *
     * Partidas extras de uma fonte
     * ficam classificadas como
     * somente naquela fonte.
     */

    const indicesAdaoRestantes =
      partidasGrupoAdao
        .map(
          (
            _,
            indice,
          ) =>
            indice,
        )
        .filter(
          (indice) =>
            !usadosAdao.has(
              indice,
            ),
        );

    const indicesOpenRestantes =
      partidasGrupoOpenFootball
        .map(
          (
            _,
            indice,
          ) =>
            indice,
        )
        .filter(
          (indice) =>
            !usadosOpenFootball.has(
              indice,
            ),
        );

    const quantidadeCorrespondente =
      Math.min(
        indicesAdaoRestantes.length,
        indicesOpenRestantes.length,
      );

    for (
      let indice = 0;
      indice <
      quantidadeCorrespondente;
      indice += 1
    ) {
      const partidaAdao =
        partidasGrupoAdao[
          indicesAdaoRestantes[
            indice
          ]
        ];

      const partidaOpenFootball =
        partidasGrupoOpenFootball[
          indicesOpenRestantes[
            indice
          ]
        ];

      partidasCorrespondentes +=
        1;

      divergenciasPlacares.push({
        chave,

        adaoduque: {
          confronto:
            formatarConfronto(
              partidaAdao,
            ),

          placar:
            formatarPlacar(
              partidaAdao,
            ),
        },

        openfootball: {
          confronto:
            formatarConfronto(
              partidaOpenFootball,
            ),

          placar:
            formatarPlacar(
              partidaOpenFootball,
            ),
        },
      });
    }

    for (
      let indice =
        quantidadeCorrespondente;
      indice <
      indicesAdaoRestantes.length;
      indice += 1
    ) {
      const partida =
        partidasGrupoAdao[
          indicesAdaoRestantes[
            indice
          ]
        ];

      somenteAdao.push(
        `${chave} [${formatarConfronto(partida)} ${formatarPlacar(partida)}]`,
      );
    }

    for (
      let indice =
        quantidadeCorrespondente;
      indice <
      indicesOpenRestantes.length;
      indice += 1
    ) {
      const partida =
        partidasGrupoOpenFootball[
          indicesOpenRestantes[
            indice
          ]
        ];

      somenteOpenFootball.push(
        `${chave} [${formatarConfronto(partida)} ${formatarPlacar(partida)}]`,
      );
    }
  }

  const anulacoesNaoEncontradas =
    [...anulacoesPendentes.values()]
      .reduce(
        (
          total,
          quantidade,
        ) =>
          total +
          quantidade,
        0,
      );

  const administrativosNaoEncontrados =
    resultadosAdministrativos.length -
    indicesAdministrativosReconhecidos.size;

  const correcoesFonteNaoEncontradas =
    correcoesFonte.length -
    indicesCorrecoesReconhecidas.size;

  const resultadosValidados =
    placaresIguais +
    resultadosAdministrativosReconhecidos.length +
    correcoesFonteReconhecidas.length;

  const relatorio = {
    temporada,

    fontes: [
      "adaoduque_brasileirao",
      resultadoOpenFootball.fonte,
    ],

    geradoEm:
      new Date()
        .toISOString(),

    resumo: {
      partidasAdaoduque:
        partidasAdao.length,

      partidasOpenFootball:
        partidasOpenFootball.length,

      partidasCorrespondentes,

      placaresIguais,

      resultadosAdministrativosReconhecidos:
        resultadosAdministrativosReconhecidos.length,

      correcoesFonteReconhecidas:
        correcoesFonteReconhecidas.length,

      resultadosValidados,

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

      partidasAnuladasConfiguradas:
        partidasAnuladas.length,

      partidasAnuladasFiltradas,

      anulacoesNaoEncontradas,

      resultadosAdministrativosConfigurados:
        resultadosAdministrativos.length,

      administrativosNaoEncontrados,

      correcoesFonteConfiguradas:
        correcoesFonte.length,

      correcoesFonteNaoEncontradas,
    },

    aliasesNaoEncontrados:
      [...aliasesNaoEncontrados]
        .sort(),

    resultadosAdministrativosReconhecidos,

    correcoesFonteReconhecidas,

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

      administrativos:
        resultadosAdministrativosReconhecidos.length,

      correcoesFonte:
        correcoesFonteReconhecidas.length,

      resultadosValidados,

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

      anuladasConfiguradas:
        partidasAnuladas.length,

      anuladasFiltradas:
        partidasAnuladasFiltradas,

      anulacoesNaoEncontradas,

      administrativosConfigurados:
        resultadosAdministrativos.length,

      administrativosNaoEncontrados,

      correcoesFonteConfiguradas:
        correcoesFonte.length,

      correcoesFonteNaoEncontradas,
    },
  ]);

  if (
    resultadosAdministrativosReconhecidos.length >
    0
  ) {
    console.log(
      "\nResultados administrativos reconhecidos:",
    );

    console.table(
      resultadosAdministrativosReconhecidos,
    );
  }

  if (
    correcoesFonteReconhecidas.length >
    0
  ) {
    console.log(
      "\nCorreções conhecidas de fonte:",
    );

    console.table(
      correcoesFonteReconhecidas,
    );
  }

  if (
    aliasesNaoEncontrados.size >
    0
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
    divergenciasPlacares.length >
    0
  ) {
    console.log(
      "\nPlacares divergentes não explicados:",
    );

    console.table(
      divergenciasPlacares,
    );
  }

  if (
    somenteAdao.length >
    0
  ) {
    console.log(
      "\nPartidas encontradas somente em Adão Duque:",
    );

    console.log(
      somenteAdao
        .sort()
        .join("\n"),
    );
  }

  if (
    somenteOpenFootball.length >
    0
  ) {
    console.log(
      "\nPartidas encontradas somente no OpenFootball:",
    );

    console.log(
      somenteOpenFootball
        .sort()
        .join("\n"),
    );
  }

  if (
    anulacoesNaoEncontradas >
    0
  ) {
    console.log(
      "\nAtenção: existem partidas anuladas configuradas que não foram encontradas na fonte.",
    );
  }

  if (
    administrativosNaoEncontrados >
    0
  ) {
    console.log(
      "\nAtenção: existem resultados administrativos configurados que não foram reconhecidos.",
    );
  }

  if (
    correcoesFonteNaoEncontradas >
    0
  ) {
    console.log(
      "\nAtenção: existem correções de fonte configuradas que não foram reconhecidas.",
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

    console.error(
      erro,
    );

    process.exitCode = 1;
  },
);