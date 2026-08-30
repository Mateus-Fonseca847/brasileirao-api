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
  "data/raw/openfootball",
);

const temporadas = [
  2018,
  2019,
  2020,
  2021,
  2022,
  2023,
  2024,
];

function criarUrl(
  temporada: number,
): string {
  return (
    "https://raw.githubusercontent.com/" +
    "openfootball/south-america/master/" +
    `brazil/${temporada}_br1.txt`
  );
}

function criarCaminhoDestino(
  temporada: number,
): string {
  return resolve(
    diretorioDestino,
    `${temporada}_br1.txt`,
  );
}

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

async function baixarTemporada(
  temporada: number,
): Promise<void> {
  const destino =
    criarCaminhoDestino(temporada);

  if (await arquivoExiste(destino)) {
    console.log(
      `${temporada}: arquivo já existe — ignorado.`,
    );

    return;
  }

  const url = criarUrl(temporada);

  console.log(
    `${temporada}: baixando...`,
  );

  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error(
      `Falha ao baixar ${temporada}: HTTP ${resposta.status}`,
    );
  }

  const conteudo =
    await resposta.text();

  await writeFile(
    destino,
    conteudo,
    "utf-8",
  );

  console.log(
    `${temporada}: concluído.`,
  );
}

async function executar(): Promise<void> {
  console.log(
    "Iniciando aquisição histórica do OpenFootball...\n",
  );

  await mkdir(
    diretorioDestino,
    {
      recursive: true,
    },
  );

  for (const temporada of temporadas) {
    await baixarTemporada(
      temporada,
    );
  }

  console.log(
    "\nAquisição concluída.",
  );
}

executar().catch((erro) => {
  console.error(
    "\nFalha durante a aquisição:",
  );

  console.error(erro);

  process.exitCode = 1;
});