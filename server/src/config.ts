import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const CONFIG_PATH = '/etc/hiddenite/config.yaml';

export interface Config {
  database: {
    path: string;
  };
}

const DEFAULT_CONFIG: Config = {
  database: {
    path: '/var/lib/hiddenite/library.sqlite',
  },
};

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  const raw = (parse(readFileSync(CONFIG_PATH, 'utf8')) ?? {}) as Partial<Config>;
  return {
    database: {
      path: raw.database?.path ?? DEFAULT_CONFIG.database.path,
    },
  };
}

export const config: Config = loadConfig();
