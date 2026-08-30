export function extrairTemporadaBrasileirao(
  data: string,
): number {
  const partes = data.split("/");

  if (partes.length !== 3) {
    throw new Error(
      `Data inválida encontrada: ${data}`,
    );
  }

  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (
    Number.isNaN(mes) ||
    Number.isNaN(ano)
  ) {
    throw new Error(
      `Não foi possível interpretar a data: ${data}`,
    );
  }

  /*
   * O Brasileirão 2020 terminou em fevereiro
   * de 2021 devido à alteração do calendário
   * provocada pela pandemia.
   */
  if (
    ano === 2021 &&
    mes <= 2
  ) {
    return 2020;
  }

  return ano;
}