type EnvironmentConfig = {
  host: string;
  port: number;
  corsOrigins: string[];
  rateLimitMax: number;
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

function readCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function readRateLimitMax(value: string | undefined): number {
  if (!value) {
    return 100;
  }

  const rateLimitMax = Number(value);

  if (!Number.isInteger(rateLimitMax) || rateLimitMax < 1) {
    throw new Error("RATE_LIMIT_MAX must be a positive integer.");
  }

  return rateLimitMax;
}

export function loadEnvironment(): EnvironmentConfig {
  return {
    host: readHost(process.env.HOST),
    port: readPort(process.env.PORT),
    corsOrigins: readCorsOrigins(process.env.CORS_ORIGIN),
    rateLimitMax: readRateLimitMax(process.env.RATE_LIMIT_MAX),
  };
}
