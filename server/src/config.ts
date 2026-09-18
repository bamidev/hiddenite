import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const CONFIG_PATH = '/etc/hiddenite/config.yaml';

export interface Config {
  database: {
    path: string;
  };
  library: {
    paths: string[];
  };
}

const DEFAULT_CONFIG: Config = {
  database: {
    path: '/var/lib/hiddenite/library.sqlite',
  },
  library: {
    paths: [],
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDefaults<T>(defaults: T, loaded: unknown): T {
  if (!isPlainObject(defaults)) {
    return (loaded ?? defaults) as T;
  }

  const result = { ...defaults } as Record<string, unknown>;
  const loadedObj = isPlainObject(loaded) ? loaded : {};
  for (const key of Object.keys(defaults as Record<string, unknown>)) {
    result[key] = mergeDefaults((defaults as Record<string, unknown>)[key], loadedObj[key]);
  }
  return result as T;
}

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  const raw = parse(readFileSync(CONFIG_PATH, 'utf8'));
  return mergeDefaults(DEFAULT_CONFIG, raw);
}

export const config: Config = loadConfig();
