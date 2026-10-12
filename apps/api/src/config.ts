/** Runtime settings read from environment variables (a local .env file in development, infra/.env on the server). */

export const DEFAULT_PORT = 3650;
export const DEFAULT_DATABASE_URL = 'postgres://cheques_app:cheques_app@localhost:5432/cheques';
export const DEFAULT_API_TOKEN = 'dev-token-change-me';
const MIN_TOKEN_LENGTH = 24;

export type Config = {
  port: number;
  databaseUrl: string;
  apiToken: string;
  production: boolean;
};

export class ConfigError extends Error {}

/** Messages never include the token or the database URL (they carry secrets). */
export const loadConfig = (env: Record<string, string | undefined> = process.env): Config => {
  const production = env['NODE_ENV'] === 'production';

  const rawPort = env['PORT'];
  const port = rawPort === undefined || rawPort === '' ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = env['DATABASE_URL'] || DEFAULT_DATABASE_URL;
  let protocol: string;
  try {
    protocol = new URL(databaseUrl).protocol;
  } catch {
    throw new ConfigError('DATABASE_URL is not a valid URL');
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new ConfigError('DATABASE_URL must start with postgres:// or postgresql://');
  }

  const apiToken = env['API_TOKEN'] || DEFAULT_API_TOKEN;
  if (production && (apiToken === DEFAULT_API_TOKEN || apiToken.length < MIN_TOKEN_LENGTH)) {
    throw new ConfigError(
      `API_TOKEN must be set to a secret of at least ${MIN_TOKEN_LENGTH} characters in production`,
    );
  }

  return { port, databaseUrl, apiToken, production };
};
