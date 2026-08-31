type EnvironmentConfig = {
  host: string;
  port: number;
};

function readPort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function readHost(value: string | undefined): string {
  if (value === undefined) {
    return "127.0.0.1";
  }

  const host = value.trim();

  if (host.length === 0) {
    throw new Error("HOST must not be empty.");
  }

  return host;
}

export function loadEnvironment(): EnvironmentConfig {
  return {
    host: readHost(process.env.HOST),
    port: readPort(process.env.PORT),
  };
}
