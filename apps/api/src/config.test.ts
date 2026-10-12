import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_API_TOKEN,
  DEFAULT_DATABASE_URL,
  DEFAULT_PORT,
  loadConfig,
} from './config.ts';

describe('loadConfig', () => {
  it('uses the defaults when nothing is set (development)', () => {
    expect(loadConfig({})).toEqual({
      port: 3650,
      databaseUrl: DEFAULT_DATABASE_URL,
      apiToken: DEFAULT_API_TOKEN,
      production: false,
    });
    expect(DEFAULT_PORT).toBe(3650);
  });

  it('reads PORT, DATABASE_URL and API_TOKEN from the environment', () => {
    const c = loadConfig({
      PORT: '4000',
      DATABASE_URL: 'postgresql://u:p@db:5432/x',
      API_TOKEN: 'a'.repeat(30),
      NODE_ENV: 'production',
    });
    expect(c).toMatchObject({
      port: 4000,
      databaseUrl: 'postgresql://u:p@db:5432/x',
      production: true,
    });
  });

  it('treats empty values as unset', () => {
    expect(loadConfig({ PORT: '', DATABASE_URL: '', API_TOKEN: '' }).port).toBe(3650);
  });

  it.each(['abc', '0', '70000', '3650.5', '-1'])('rejects PORT=%s', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(ConfigError);
  });

  it('rejects a DATABASE_URL that is not a PostgreSQL URL, without echoing it', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://u:secretpw@h/db' })).toThrow(/postgres/);
    try {
      loadConfig({ DATABASE_URL: 'mysql://u:secretpw@h/db' });
    } catch (e) {
      expect(String(e)).not.toContain('secretpw');
    }
    expect(() => loadConfig({ DATABASE_URL: 'not a url' })).toThrow(ConfigError);
  });

  it('production refuses the default or a short API_TOKEN', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/API_TOKEN/);
    expect(() => loadConfig({ NODE_ENV: 'production', API_TOKEN: DEFAULT_API_TOKEN })).toThrow(
      /API_TOKEN/,
    );
    expect(() => loadConfig({ NODE_ENV: 'production', API_TOKEN: 'short' })).toThrow(/API_TOKEN/);
  });

  it('development accepts the default token', () => {
    expect(loadConfig({ NODE_ENV: 'development' }).apiToken).toBe(DEFAULT_API_TOKEN);
  });
});
