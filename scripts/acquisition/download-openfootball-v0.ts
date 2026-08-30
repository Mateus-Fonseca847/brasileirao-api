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

const argumento =
  process.argv[2];

if (!argumento) {
  throw new Error(
    "Informe uma temporada ou 'all'. Exemplos: npm run data:download:openfootball-v0 -- 2017 | npm run data:download:openfootball-v0 -- all",
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

const PRIMEIRA_TEMPORADA = 2003;
const ULTIMA_TEMPORADA = 2017;

function obterTemporadas(): number[] {
  if (
    argumento.toLowerCase() === "all"
  ) {
    const temporadas: number[] = [];

    for (
      let temporada =
        PRIMEIRA_TEMPORADA;
      temporada <=
        ULTIMA_TEMPORADA;
      temporada += 1
    ) {
      temporadas.push(
        temporada,
      );
    }

    return temporadas;
  }

  const temporada =
    Number(argumento);

  if (
    Number.isNaN(temporada)
  ) {
    throw new Error(
      `Argumento inválido: ${argumento}`,
    );
  }

  if (
    temporada <
      PRIMEIRA_TEMPORADA ||
    temporada >
      ULTIMA_TEMPORADA
  ) {
    throw new Error(
      `Temporada fora do intervalo disponível: ${temporada}`,
    );
  }

  return [
    temporada,
  ];
}

function criarUrl(
  temporada: number,
): string {
  return (
    "https://raw.githubusercontent.com/" +
    "openfootball/v0-format/master/" +
    `brazil/${temporada}/brasileirao-seriea.txt`
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
    await access(
      caminho,
    );

    return true;
  } catch {
    return false;
  }
}

async function baixarTemporada(
  temporada: number,
): Promise<{
  temporada: number;
  status:
    | "downloaded"
    | "existing"
    | "failed";
}> {
  const caminhoDestino =
    criarCaminhoDestino(
      temporada,
    );

  if (
    await arquivoExiste(
      caminhoDestino,
    )
  ) {
    console.log(
      `${temporada}: arquivo já existe — ignorado.`,
    );

    return {
      temporada,
      status: "existing",
    };
  }

  const url =
    criarUrl(
      temporada,
    );

  console.log(
    `${temporada}: baixando...`,
  );

  try {
    const resposta =
      await fetch(
        url,
      );

    if (
      !resposta.ok
    ) {
      console.error(
        `${temporada}: falha HTTP ${resposta.status}.`,
      );

      return {
        temporada,
        status: "failed",
      };
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

    return {
      temporada,
      status:
        "downloaded",
    };
  } catch (erro) {
    console.error(
      `${temporada}: falha durante o download.`,
    );

    console.error(
      erro,
    );

    return {
      temporada,
      status: "failed",
    };
  }
}

async function executar():
  Promise<void> {
  const temporadas =
    obterTemporadas();

  console.log(
    "Iniciando aquisição histórica do OpenFootball V0...\n",
  );

  console.log(
    `Temporadas solicitadas: ${temporadas[0]} → ${temporadas[temporadas.length - 1]}\n`,
  );

  await mkdir(
    diretorioDestino,
    {
      recursive: true,
    },
  );

  const resultados = [];

  for (
    const temporada
    of temporadas
  ) {
    const resultado =
      await baixarTemporada(
        temporada,
      );

    resultados.push(
      resultado,
    );
  }

  const baixados =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "downloaded",
    ).length;

  const existentes =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "existing",
    ).length;

  const falhas =
    resultados.filter(
      (resultado) =>
        resultado.status ===
        "failed",
    );

  console.log(
    "\nResumo da aquisição:",
  );

  console.table([
    {
      solicitados:
        resultados.length,

      baixados,

      existentes,

      falhas:
        falhas.length,
    },
  ]);

  if (
    falhas.length > 0
  ) {
    console.log(
      "\nTemporadas com falha:",
    );

    console.log(
      falhas
        .map(
          (resultado) =>
            resultado.temporada,
        )
        .join(", "),
    );

    process.exitCode = 1;

    return;
  }

  console.log(
    "\nAquisição histórica concluída com sucesso.",
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nFalha inesperada durante a aquisição histórica:",
    );

    console.error(
      erro,
    );

    process.exitCode = 1;
  },
);