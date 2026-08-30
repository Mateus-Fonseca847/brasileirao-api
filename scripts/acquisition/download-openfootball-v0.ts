import {
  access,
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

const argumentoTemporada =
  process.argv[2];

const temporada =
  Number(argumentoTemporada);

if (
  !argumentoTemporada ||
  Number.isNaN(temporada)
) {
  throw new Error(
    "Informe uma temporada. Exemplo: npm run data:download:openfootball-v0 -- 2017",
  );
}

if (
  temporada < 2003 ||
  temporada > 2019
) {
  throw new Error(
    `Temporada não disponível no intervalo histórico configurado: ${temporada}`,
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

const diretorioDestino = resolve(
  raizProjeto,
  "data/raw/openfootball-v0",
);

const caminhoDestino = resolve(
  diretorioDestino,
  `${temporada}_br1.txt`,
);

const url =
  "https://raw.githubusercontent.com/" +
  "openfootball/v0-format/master/" +
  `brazil/${temporada}/brasileirao-seriea.txt`;

async function arquivoExiste(
  caminho: string,
): Promise<boolean> {
  try {
    await access(caminho);

    return true;
  } catch {
    return false;
  }
}

async function executar():
  Promise<void> {
  console.log(
    `Preparando aquisição do OpenFootball V0 — ${temporada}...\n`,
  );

  await mkdir(
    diretorioDestino,
    {
      recursive: true,
    },
  );

  if (
    await arquivoExiste(
      caminhoDestino,
    )
  ) {
    console.log(
      `${temporada}: arquivo já existe — nenhuma alteração realizada.`,
    );

    return;
  }

  console.log(
    `${temporada}: baixando arquivo histórico...`,
  );

  const resposta =
    await fetch(url);

  if (!resposta.ok) {
    throw new Error(
      `Falha ao baixar ${temporada}: HTTP ${resposta.status}`,
    );
  }

  const conteudo =
    await resposta.text();

  await writeFile(
    caminhoDestino,
    conteudo,
    "utf-8",
  );

  console.log(
    `${temporada}: download concluído.`,
  );

  console.log(
    `Arquivo: ${caminhoDestino}`,
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha durante a aquisição histórica:",
    );

    console.error(erro);

    process.exitCode = 1;
  },
);