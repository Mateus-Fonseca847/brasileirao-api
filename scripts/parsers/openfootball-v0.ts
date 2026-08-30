export interface PartidaOpenFootballV0 {
  rodada: number;

  dataTexto: string | null;

  mandante: string;
  visitante: string;

  golsMandante: number;
  golsVisitante: number;
}

export interface ResultadoParserOpenFootballV0 {
  partidas: PartidaOpenFootballV0[];

  linhasNaoInterpretadas: string[];
}

export function interpretarOpenFootballV0(
  conteudo: string,
): ResultadoParserOpenFootballV0 {
  const linhas =
    conteudo.split(/\r?\n/);

  const partidas:
    PartidaOpenFootballV0[] = [];

  const linhasNaoInterpretadas:
    string[] = [];

  let rodadaAtual:
    number | null = null;

  let dataAtual:
    string | null = null;

  const regexRodada =
    /^Rodada\s+(\d+)$/i;

  const regexData =
    /^\[(.+)\]$/;

  const regexPartida =
    /^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/;

  for (
    const linhaOriginal
    of linhas
  ) {
    const linha =
      linhaOriginal.trim();

    if (linha === "") {
      continue;
    }

    const resultadoRodada =
      linha.match(
        regexRodada,
      );

    if (resultadoRodada) {
      rodadaAtual =
        Number(
          resultadoRodada[1],
        );

      dataAtual = null;

      continue;
    }

    const resultadoData =
      linha.match(
        regexData,
      );

    if (
      resultadoData &&
      rodadaAtual !== null
    ) {
      dataAtual =
        resultadoData[1];

      continue;
    }

    if (
      rodadaAtual === null
    ) {
      continue;
    }

    const resultadoPartida =
      linha.match(
        regexPartida,
      );

    if (
      resultadoPartida
    ) {
      const [
        ,
        mandante,
        golsMandante,
        golsVisitante,
        visitante,
      ] = resultadoPartida;

      partidas.push({
        rodada:
          rodadaAtual,

        dataTexto:
          dataAtual,

        mandante:
          mandante.trim(),

        visitante:
          visitante.trim(),

        golsMandante:
          Number(
            golsMandante,
          ),

        golsVisitante:
          Number(
            golsVisitante,
          ),
      });

      continue;
    }

    if (
      /\d+\s*-\s*\d+/.test(
        linha,
      )
    ) {
      linhasNaoInterpretadas.push(
        linha,
      );
    }
  }

  return {
    partidas,
    linhasNaoInterpretadas,
  };
}