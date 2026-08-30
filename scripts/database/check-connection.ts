import { prisma } from "../../src/database/prisma.js";

async function verificarConexao(): Promise<void> {
  const banco = await prisma.$queryRaw<Array<{ database: string }>>`
    SELECT current_database() AS database
  `;

  const quantidadeDeTemporadas = await prisma.season.count();

  console.log("Conexão com PostgreSQL estabelecida.");
  console.log(`Banco: ${banco[0]?.database ?? "desconhecido"}`);
  console.log(`Temporadas cadastradas: ${quantidadeDeTemporadas}`);
}

verificarConexao()
  .catch((erro: unknown) => {
    console.error("Falha ao conectar ao PostgreSQL:");
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });