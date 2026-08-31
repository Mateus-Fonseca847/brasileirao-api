import { prisma } from "./database/prisma.js";
import { loadEnvironment } from "./config/environment.js";
import { buildApp } from "./app.js";

async function startServer(): Promise<void> {
  const app = await buildApp();
  const { host, port } = loadEnvironment();
  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    app.log.info({ signal }, "Shutting down server.");

    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Failed to shut down server.");
      process.exit(1);
    }
  }

  process.once("SIGINT", (signal) => {
    void shutdown(signal);
  });
  process.once("SIGTERM", (signal) => {
    void shutdown(signal);
  });

  await app.listen({
    host,
    port,
  });
}

startServer().catch(async (error: unknown) => {
  console.error("Failed to start HTTP server:");
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
