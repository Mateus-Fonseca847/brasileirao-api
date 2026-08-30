import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

type RegistroCsv = Record<string, string>;

interface AuditoriaTemporada {
  temporada: number;
  partidas: number;
  golsNoPlacar: number;
  linhasEstatisticas: number;
  partidasComRegistroEstatistico: number;
  linhasComPosseValida: number;
  linhasComChutesPositivos: number;
  eventosDeGol: number;
  eventosDeCartao: number;
}

const caminhoArquivoAtual = fileURLToPath(import.meta.url);
const diretorioArquivoAtual = dirname(caminhoArquivoAtual);

const raizProjeto = resolve(diretorioArquivoAtual, "../..");

const caminhos = {
  partidas: resolve(
    raizProjeto,
    "data/raw/adaoduque/campeonato-brasileiro-full.csv",
  ),

  estatisticas: resolve(
    raizProjeto,
    "data/raw/adaoduque/campeonato-brasileiro-estatisticas-full.csv",
  ),

  gols: resolve(
    raizProjeto,
    "data/raw/adaoduque/campeonato-brasileiro-gols.csv",
  ),

  cartoes: resolve(
    raizProjeto,
    "data/raw/adaoduque/campeonato-brasileiro-cartoes.csv",
  ),

  relatorio: resolve(
    raizProjeto,
    "data/audit/adaoduque-audit.json",
  ),
};

async function lerCsv(caminho: string): Promise<RegistroCsv[]> {
  const conteudo = await readFile(caminho, "utf-8");

  return parse(conteudo, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function extrairTemporada(data: string): number {
  const partes = data.split("/");

  if (partes.length !== 3) {
    throw new Error(`Data inválida encontrada: ${data}`);
  }

  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (Number.isNaN(mes) || Number.isNaN(ano)) {
    throw new Error(`Não foi possível interpretar a data: ${data}`);
  }

  // O Brasileirão 2020 foi concluído em fevereiro de 2021
  // devido às alterações de calendário provocadas pela pandemia.
  if (ano === 2021 && mes <= 2) {
    return 2020;
  }

  return ano;
}

function valorEstaDisponivel(valor: string | undefined): boolean {
  if (valor === undefined) {
    return false;
  }

  const valorNormalizado = valor.trim().toLowerCase();

  const valoresAusentes = [
    "",
    "none",
    "null",
    "nan",
    "n/a",
  ];

  return !valoresAusentes.includes(valorNormalizado);
}

async function executarAuditoria(): Promise<void> {
  console.log("Iniciando auditoria do dataset de Adão Duque...\n");

  const [partidas, estatisticas, gols, cartoes] = await Promise.all([
    lerCsv(caminhos.partidas),
    lerCsv(caminhos.estatisticas),
    lerCsv(caminhos.gols),
    lerCsv(caminhos.cartoes),
  ]);

  const anoPorPartida = new Map<string, number>();

  const auditoriaPorAno = new Map<number, AuditoriaTemporada>();

  function obterAuditoria(ano: number): AuditoriaTemporada {
    const existente = auditoriaPorAno.get(ano);

    if (existente) {
      return existente;
    }

    const novaAuditoria: AuditoriaTemporada = {
      temporada: ano,
      partidas: 0,
      golsNoPlacar: 0,
      linhasEstatisticas: 0,
      partidasComRegistroEstatistico: 0,
      linhasComPosseValida: 0,
      linhasComChutesPositivos: 0,
      eventosDeGol: 0,
      eventosDeCartao: 0,
    };

    auditoriaPorAno.set(ano, novaAuditoria);

    return novaAuditoria;
  }

  for (const partida of partidas) {
    const id = partida.ID;
    const ano = extrairTemporada(partida.data);

    anoPorPartida.set(id, ano);

    const auditoria = obterAuditoria(ano);

    auditoria.partidas += 1;

    const golsMandante = Number(partida.mandante_Placar || 0);
    const golsVisitante = Number(partida.visitante_Placar || 0);

    auditoria.golsNoPlacar += golsMandante + golsVisitante;
  }

  const partidasComEstatisticaPorAno = new Map<number, Set<string>>();

  for (const estatistica of estatisticas) {
    const partidaId = estatistica.partida_id;
    const ano = anoPorPartida.get(partidaId);

    if (!ano) {
      continue;
    }

    const auditoria = obterAuditoria(ano);

    auditoria.linhasEstatisticas += 1;

    if (!partidasComEstatisticaPorAno.has(ano)) {
      partidasComEstatisticaPorAno.set(ano, new Set());
    }

    partidasComEstatisticaPorAno.get(ano)?.add(partidaId);

    if (valorEstaDisponivel(estatistica.posse_de_bola)) {
      auditoria.linhasComPosseValida += 1;
    }

    const chutes = Number(estatistica.chutes);

    if (!Number.isNaN(chutes) && chutes > 0) {
      auditoria.linhasComChutesPositivos += 1;
    }
  }

  for (const [ano, partidasComEstatistica] of partidasComEstatisticaPorAno) {
    const auditoria = obterAuditoria(ano);

    auditoria.partidasComRegistroEstatistico =
      partidasComEstatistica.size;
  }

  for (const gol of gols) {
    const ano = anoPorPartida.get(gol.partida_id);

    if (!ano) {
      continue;
    }

    obterAuditoria(ano).eventosDeGol += 1;
  }

  for (const cartao of cartoes) {
    const ano = anoPorPartida.get(cartao.partida_id);

    if (!ano) {
      continue;
    }

    obterAuditoria(ano).eventosDeCartao += 1;
  }

  const temporadas = [...auditoriaPorAno.values()].sort(
    (a, b) => a.temporada - b.temporada,
  );

  const relatorio = {
    fonte: "adaoduque_brasileirao",
    geradoEm: new Date().toISOString(),

    arquivos: {
      partidas: partidas.length,
      estatisticas: estatisticas.length,
      gols: gols.length,
      cartoes: cartoes.length,
    },

    temporadas,
  };

  await mkdir(dirname(caminhos.relatorio), {
    recursive: true,
  });

  await writeFile(
    caminhos.relatorio,
    JSON.stringify(relatorio, null, 2),
    "utf-8",
  );

  console.table(
    temporadas.map((temporada) => ({
      ano: temporada.temporada,
      partidas: temporada.partidas,
      golsPlacar: temporada.golsNoPlacar,
      stats: temporada.partidasComRegistroEstatistico,
      posseValida: temporada.linhasComPosseValida,
      chutesPositivos:
        temporada.linhasComChutesPositivos,
      golsRegistrados: temporada.eventosDeGol,
      cartoes: temporada.eventosDeCartao,
    })),
  );

  console.log(
    "\nAuditoria concluída.",
  );

  console.log(
    `Relatório salvo em: ${caminhos.relatorio}`,
  );
}

executarAuditoria().catch((erro) => {
  console.error("\nFalha durante a auditoria:");
  console.error(erro);

  process.exitCode = 1;
});