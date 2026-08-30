export interface PartidaOpenFootball {
  rodada: number;
  dataTexto: string;
  horario: string | null;
  mandante: string;
  visitante: string;
  golsMandante: number;
  golsVisitante: number;
}

export interface ResultadoParserOpenFootball {
  partidas: PartidaOpenFootball[];
  linhasNaoInterpretadas: string[];
}

export function interpretarOpenFootballTxt(
  conteudo: string,
): ResultadoParserOpenFootball {
  const linhas = conteudo.split(/\r?\n/);

  const partidas: PartidaOpenFootball[] = [];
  const linhasNaoInterpretadas: string[] = [];

  let rodadaAtual: number | null = null;
  let dataAtual = "";

  const regexRodada = /^▪\s*Matchday\s+(\d+)$/;

  const regexData =
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}(?:\s+\d{4})?$/;

  const regexPartida =
    /^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(?:\s+\([^)]*\))?$/;

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.trim();

    if (linha === "") {
      continue;
    }

    const resultadoRodada = linha.match(regexRodada);

    if (resultadoRodada) {
      rodadaAtual = Number(resultadoRodada[1]);
      continue;
    }

    if (regexData.test(linha)) {
      dataAtual = linha;
      continue;
    }

    const resultadoPartida = linha.match(regexPartida);

    if (resultadoPartida) {
      if (rodadaAtual === null) {
        throw new Error(
          `Partida encontrada sem rodada definida: ${linha}`,
        );
      }

      const [
        ,
        horario,
        mandante,
        visitante,
        golsMandante,
        golsVisitante,
      ] = resultadoPartida;

      partidas.push({
        rodada: rodadaAtual,
        dataTexto: dataAtual,
        horario: horario ?? null,
        mandante: mandante.trim(),
        visitante: visitante.trim(),
        golsMandante: Number(golsMandante),
        golsVisitante: Number(golsVisitante),
      });

      continue;
    }

    /*
     * Algumas linhas são metadados do formato OpenFootball.
     * Aqui registramos somente linhas que parecem representar
     * partidas mas que não conseguimos interpretar.
     */
    if (linha.includes(" v ")) {
      linhasNaoInterpretadas.push(linha);
    }
  }

  return {
    partidas,
    linhasNaoInterpretadas,
  };
}