import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const CONFIG_PATH = '/etc/hiddenite/config.yaml';

export interface LibraryFolderConfig {
  path: string;
  webdav: {
    enable: boolean;
    username: string;
    name: string;
  };
}

export interface Config {
  server: {
    port: number;
    baseUrls: string[];
  };
  database: {
    path: string;
  };
  library: {
    folders: LibraryFolderConfig[];
  };
}

const DEFAULT_FOLDER_WEBDAV: LibraryFolderConfig['webdav'] = {
  enable: false,
  username: 'hiddenite',
  name: 'music',
};

const DEFAULT_CONFIG: Config = {
  server: {
    port: 8484,
    baseUrls: [],
  },
  database: {
    path: '/var/lib/hiddenite/library.sqlite',
  },
  library: {
    folders: [],
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

function normalizeFolder(raw: unknown): LibraryFolderConfig {
  const folder = isPlainObject(raw) ? raw : {};
  return {
    path: typeof folder.path === 'string' ? folder.path : '',
    webdav: mergeDefaults(DEFAULT_FOLDER_WEBDAV, folder.webdav),
  };
}

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  const raw = parse(readFileSync(CONFIG_PATH, 'utf8'));
  const loaded = mergeDefaults(DEFAULT_CONFIG, raw);
  const rawFolders = isPlainObject(raw) && isPlainObject(raw.library) ? raw.library.folders : undefined;
  loaded.library.folders = Array.isArray(rawFolders) ? rawFolders.map(normalizeFolder) : [];
  return loaded;
}

export const config: Config = loadConfig();
