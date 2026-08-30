import { readFile } from "node:fs/promises";

type MapaAliases = Record<string, string[]>;

export async function carregarAliasesDeEquipes(
  caminho: string,
): Promise<Map<string, string>> {
  const conteudo = await readFile(
    caminho,
    "utf-8",
  );

  const mapaAliases = JSON.parse(
    conteudo,
  ) as MapaAliases;

  const aliasParaId = new Map<
    string,
    string
  >();

  for (const [
    idCanonico,
    aliases,
  ] of Object.entries(mapaAliases)) {
    for (const alias of aliases) {
      aliasParaId.set(
        normalizarTexto(alias),
        idCanonico,
      );
    }
  }

  return aliasParaId;
}

export function normalizarTexto(
  valor: string,
): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function encontrarIdCanonico(
  nomeEquipe: string,
  aliases: Map<string, string>,
): string | null {
  const nomeNormalizado =
    normalizarTexto(nomeEquipe);

  return aliases.get(nomeNormalizado) ?? null;
}