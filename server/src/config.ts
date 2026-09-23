/**
 * Loads and normalizes the server configuration from
 * `/etc/hiddenite/config.yaml`, filling in defaults for anything missing
 * from the file (or using defaults entirely if the file doesn't exist).
 * Exposes the resulting config as the singleton `config` constant.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'yaml';

const CONFIG_PATH = '/etc/hiddenite/config.yaml';

/** Configuration for a single library folder, including its WebDAV exposure settings. */
export interface LibraryFolderConfig {
  /** Absolute filesystem path to the folder's contents. */
  path: string;
  webdav: {
    /** Whether this folder should be mounted on the WebDAV server. */
    enable: boolean;
    /** Basic-auth username used to access this folder over WebDAV. */
    username: string;
    /** Mount name used as the folder's path segment under `/webdav`. Defaults to the folder's basename when empty. */
    name: string;
  };
}

/** Shape of the server's full configuration file, after defaults have been merged in. */
export interface Config {
  server: {
    /** Port the HTTP server listens on. */
    port: number;
    /** Additional origins (besides `localhost:<port>`) allowed by CORS. */
    baseUrls: string[];
  };
  database: {
    /** Path to the sqlite database file backing the library. */
    path: string;
  };
  library: {
    /** Library folders known to the server, each independently configurable. */
    folders: LibraryFolderConfig[];
  };
}

const DEFAULT_FOLDER_WEBDAV: LibraryFolderConfig['webdav'] = {
  enable: false,
  username: 'hiddenite',
  name: '',
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

/**
 * Type guard checking whether a value is a non-null, non-array object
 * (i.e. suitable for recursive key-by-key default merging).
 * @param value the value to check.
 * @returns true if `value` is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges a loaded (possibly partial/malformed) config value
 * with a set of defaults, using the shape of `defaults` to decide which
 * keys to recurse into. Any key present in `defaults` but missing or
 * invalid in `loaded` falls back to the default value.
 * @param defaults default value/shape to merge into.
 * @param loaded the raw value parsed from the config file (or a sub-value of it).
 * @returns a value with the same shape as `defaults`, with values overridden by `loaded` where present.
 */
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

/**
 * Normalizes a single raw library folder entry from the config file into a
 * well-formed `LibraryFolderConfig`, merging in WebDAV defaults and
 * deriving a mount name from the folder path when none was given.
 * @param raw the raw parsed value for this folder entry (expected to be an object, but not assumed to be).
 * @returns a fully-populated `LibraryFolderConfig`.
 */
function normalizeFolder(raw: unknown): LibraryFolderConfig {
  const folder = isPlainObject(raw) ? raw : {};
  const path = typeof folder.path === 'string' ? folder.path : '';
  const webdav = mergeDefaults(DEFAULT_FOLDER_WEBDAV, folder.webdav);
  if (!webdav.name) {
    webdav.name = basename(path) || 'root';
  }
  return { path, webdav };
}

/**
 * Loads the server configuration from disk, merging it with defaults.
 * If the config file at `CONFIG_PATH` does not exist, the default
 * configuration is returned as-is. Library folders are handled separately
 * from the generic default-merging so each one can get its own normalized
 * WebDAV settings.
 * @returns the fully resolved `Config`.
 */
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
