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

  linhasIgnoradas: string[];
}

function normalizarEspacos(
  valor: string,
): string {
  return valor
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairDataDoFinalDaRodada(
  valor: string | undefined,
): string | null {
  if (!valor) {
    return null;
  }

  const texto =
    normalizarEspacos(valor);

  if (
    /^\d{1,2}\/\d{1,2}\/\d{4}/.test(
      texto,
    )
  ) {
    return texto;
  }

  return null;
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

  const linhasIgnoradas:
    string[] = [];

  let rodadaAtual:
    number | null = null;

  let dataAtual:
    string | null = null;

  /*
   * Formatos de rodada identificados:
   *
   * Rodada 1
   * 1ª Rodada
   * 1 Rodada
   * 7 ª Rodada
   * Matchday 1
   *
   * Também existem casos em que a data
   * está colada na rodada:
   *
   * 2ª Rodada17/05/2007 - Sábado
   */

  const regexRodadaPadrao =
    /^Rodada\s+(\d+)\b(.*)$/i;

  const regexRodadaHistorica =
    /^(\d+)\s*[ªºa]?\s*Rodada(.*)$/i;

  const regexMatchday =
    /^Matchday\s+(\d+)\b(.*)$/i;

  /*
   * Formatos de data:
   *
   * [Sáb, 13/Maio]
   *
   * 29/03/2003 - Sábado
   */

  const regexDataColchetes =
    /^\[(.+)\]$/;

  const regexDataNumerica =
    /^\d{1,2}\/\d{1,2}\/\d{4}\b.*$/;

  for (
    const linhaOriginal
    of linhas
  ) {
    const linha =
      normalizarEspacos(
        linhaOriginal,
      );

    if (
      linha === ""
    ) {
      continue;
    }

    /*
     * Rodada no formato:
     *
     * Rodada 1
     */

    const resultadoRodadaPadrao =
      linha.match(
        regexRodadaPadrao,
      );

    if (
      resultadoRodadaPadrao
    ) {
      rodadaAtual =
        Number(
          resultadoRodadaPadrao[1],
        );

      dataAtual =
        extrairDataDoFinalDaRodada(
          resultadoRodadaPadrao[2],
        );

      continue;
    }

    /*
     * Rodadas nos formatos:
     *
     * 1ª Rodada
     * 1 Rodada
     * 7 ª Rodada
     *
     * Também reconhece:
     *
     * 2ª Rodada17/05/2007 - Sábado
     */

    const resultadoRodadaHistorica =
      linha.match(
        regexRodadaHistorica,
      );

    if (
      resultadoRodadaHistorica
    ) {
      rodadaAtual =
        Number(
          resultadoRodadaHistorica[1],
        );

      dataAtual =
        extrairDataDoFinalDaRodada(
          resultadoRodadaHistorica[2],
        );

      continue;
    }

    /*
     * Formato utilizado em algumas
     * temporadas:
     *
     * Matchday 1
     */

    const resultadoMatchday =
      linha.match(
        regexMatchday,
      );

    if (
      resultadoMatchday
    ) {
      rodadaAtual =
        Number(
          resultadoMatchday[1],
        );

      dataAtual =
        extrairDataDoFinalDaRodada(
          resultadoMatchday[2],
        );

      continue;
    }

    /*
     * Data no formato:
     *
     * [Sáb, 13/Maio]
     */

    const resultadoDataColchetes =
      linha.match(
        regexDataColchetes,
      );

    if (
      resultadoDataColchetes &&
      rodadaAtual !== null
    ) {
      dataAtual =
        resultadoDataColchetes[1];

      continue;
    }

    /*
     * Data no formato:
     *
     * 29/03/2003 - Sábado
     */

    if (
      regexDataNumerica.test(
        linha,
      ) &&
      rodadaAtual !== null
    ) {
      dataAtual = linha;

      continue;
    }

    /*
     * Antes da primeira rodada podem
     * existir títulos e outros metadados.
     */

    if (
      rodadaAtual === null
    ) {
      continue;
    }

    let linhaPartida =
      linha;

    /*
     * Alguns anos utilizam:
     *
     * 16h00 - Botafogo 1x4 Goiás - Caio Martins
     *
     * Nesse formato:
     *
     * - o horário é metadado;
     * - o primeiro "-" separa o horário;
     * - o último "-" separa o estádio.
     */

    const possuiHorarioComSeparador =
      /^\d{1,2}h\d{2}\s*-\s*/i.test(
        linhaPartida,
      );

    if (
      possuiHorarioComSeparador
    ) {
      linhaPartida =
        linhaPartida.replace(
          /^\d{1,2}h\d{2}\s*-\s*/i,
          "",
        );
    } else {
      /*
       * Outros arquivos antigos utilizam:
       *
       * 16h00 Guarani 4x2 Vasco @ Brinco de Ouro
       */

      linhaPartida =
        linhaPartida.replace(
          /^\d{1,2}h\d{2}\s+/i,
          "",
        );
    }

    /*
     * Remove estádio no formato:
     *
     * @ Brinco de Ouro
     */

    const indiceArroba =
      linhaPartida.indexOf(
        " @ ",
      );

    if (
      indiceArroba >= 0
    ) {
      linhaPartida =
        linhaPartida
          .slice(
            0,
            indiceArroba,
          )
          .trim();
    }

    /*
     * Procuramos o placar antes de tentar
     * separar os nomes dos clubes.
     *
     * Isso permite interpretar:
     *
     * Guarani 4x2 Vasco
     *
     * Paraná 0 - 2 Goiás
     *
     * Juventude1x0 Atlético-PR
     *
     * Atlético - MG 4 - 1 Figueirense
     */


    /*
 * Alguns arquivos históricos possuem
 * placares envolvidos por asteriscos.
 *
 * Exemplo:
 *
 * São Paulo *0x0* São Caetano
 *
 * Esses valores representam marcadores
 * históricos e não um resultado final
 * disputado.
 *
 * A linha deve ser preservada na
 * auditoria, mas não transformada em
 * partida.
 */

    const possuiPlacarMarcado =
      /\*\s*\d+\s*(?:x|-)\s*\d+\s*\*/i.test(
      linhaPartida,
     );

    if (
     possuiPlacarMarcado
    )  {
      linhasIgnoradas.push(
      linha,
    );

      continue;
    }
    const resultadoPlacar =
      linhaPartida.match(
        /(\d+)\s*(?:x|-)\s*(\d+)/i,
      );

    if (
      resultadoPlacar &&
      resultadoPlacar.index !==
        undefined
    ) {
      const inicioPlacar =
        resultadoPlacar.index;

      const fimPlacar =
        inicioPlacar +
        resultadoPlacar[0].length;

      const mandante =
        linhaPartida
          .slice(
            0,
            inicioPlacar,
          )
          .trim();

      let visitante =
        linhaPartida
          .slice(
            fimPlacar,
          )
          .trim();

      /*
       * Nos formatos com:
       *
       * 16h00 - PARTIDA - ESTÁDIO
       *
       * removemos somente o último
       * separador.
       *
       * Isso é importante porque existem
       * nomes como:
       *
       * Atlético - MG
       *
       * e esse hífen faz parte da
       * representação do clube.
       */

      if (
        possuiHorarioComSeparador
      ) {
        const indiceEstadio =
          visitante.lastIndexOf(
            " - ",
          );

        if (
          indiceEstadio >= 0
        ) {
          visitante =
            visitante
              .slice(
                0,
                indiceEstadio,
              )
              .trim();
        }
      }
      visitante =
      visitante
      .replace(
        /\s*-\s*$/,
       "",
      )
    .trim();

      if (
        mandante !== "" &&
        visitante !== ""
      ) {
        partidas.push({
          rodada:
            rodadaAtual,

          dataTexto:
            dataAtual,

          mandante,

          visitante,

          golsMandante:
            Number(
              resultadoPlacar[1],
            ),

          golsVisitante:
            Number(
              resultadoPlacar[2],
            ),
        });

        continue;
      }
    }

    /*
     * Qualquer linha que aparente conter
     * um placar mas não tenha sido
     * interpretada precisa ser registrada.
     *
     * O parser nunca deve ocultar
     * silenciosamente uma mudança de
     * formato.
     */

    const parecePartida =
      /\d+\s*(?:x|-)\s*\d+/i.test(
        linhaPartida,
      );

    if (
      parecePartida
    ) {
      linhasNaoInterpretadas.push(
        linha,
      );
    }
  }

  return {
    partidas,
    linhasNaoInterpretadas,
    linhasIgnoradas,
  };
}