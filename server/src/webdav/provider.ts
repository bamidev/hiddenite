import { Logger } from '@nestjs/common';
import { v2 as webdav } from 'webdav-server';
import { config, type LibraryFolderConfig } from '../config';

const PASSWORD_ENV_VAR = 'HIDDENITE_WEBDAV_PASSWORD';
const REALM = 'Hiddenite';
const MOUNT_PREFIX = '/webdav';

const logger = new Logger('WebdavProvider');

type Middleware = (req: any, res: any, next: any) => void;

function isWebdavRequest(url: string | undefined): boolean {
  if (!url) return false;
  return url === MOUNT_PREFIX || url.startsWith(`${MOUNT_PREFIX}/`);
}

function extractBasicAuthUsername(req: any): string | null {
  const header: string | undefined = req.headers?.authorization;
  if (!header?.startsWith('Basic ')) return null;

  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  return separatorIndex === -1 ? null : decoded.slice(0, separatorIndex);
}

function uniqueMountName(name: string, used: Set<string>): string {
  let mountName = name;
  let suffix = 2;
  while (used.has(mountName)) {
    mountName = `${name}-${suffix}`;
    suffix += 1;
  }
  used.add(mountName);
  return mountName;
}

function groupFoldersByUsername(folders: LibraryFolderConfig[]): Map<string, LibraryFolderConfig[]> {
  const foldersByUsername = new Map<string, LibraryFolderConfig[]>();
  for (const folder of folders) {
    if (!foldersByUsername.has(folder.webdav.username)) {
      foldersByUsername.set(folder.webdav.username, []);
    }
    foldersByUsername.get(folder.webdav.username)!.push(folder);
  }
  return foldersByUsername;
}

/**
 * Builds a WebDAVServer scoped to a single user's own folders. Each user gets a fully
 * separate server instance, rather than one shared server with per-path privileges: the
 * webdav-server library's privilege checks for directory listings are unreliable (denied
 * siblings can abort the whole listing before other entries finish rendering), so isolation
 * is enforced structurally by never mounting another user's folder in the same server.
 */
function createUserServer(username: string, password: string, folders: LibraryFolderConfig[]): Middleware {
  const userManager = new webdav.SimpleUserManager();
  userManager.addUser(username, password, true);

  const server = new webdav.WebDAVServer({
    requireAuthentification: true,
    httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, REALM),
  });

  const usedNames = new Set<string>();
  for (const folder of folders) {
    const mountName = uniqueMountName(folder.webdav.name, usedNames);
    server.setFileSystemSync(`/${mountName}`, new webdav.PhysicalFileSystem(folder.path));
  }

  return webdav.extensions.express(MOUNT_PREFIX, server);
}

export function createWebdavMiddleware(): Middleware | null {
  const enabledFolders = config.library.folders.filter((folder) => folder.webdav.enable);
  if (enabledFolders.length === 0) {
    return null;
  }

  const password = process.env[PASSWORD_ENV_VAR];
  if (!password) {
    logger.warn(
      `WebDAV is enabled for one or more library folders, but not started: set the ${PASSWORD_ENV_VAR} environment variable.`,
    );
    return null;
  }

  const foldersByUsername = groupFoldersByUsername(enabledFolders);
  const middlewareByUsername = new Map<string, Middleware>();
  for (const [username, folders] of foldersByUsername) {
    middlewareByUsername.set(username, createUserServer(username, password, folders));
  }

  logger.log(
    `WebDAV enabled at ${MOUNT_PREFIX} for ${middlewareByUsername.size} user(s), serving ${enabledFolders.length} folder(s).`,
  );

  return (req, res, next) => {
    if (!isWebdavRequest(req.url)) {
      next();
      return;
    }

    const username = extractBasicAuthUsername(req);
    const userMiddleware = username ? middlewareByUsername.get(username) : undefined;
    if (!userMiddleware) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', `Basic realm="${REALM}"`);
      res.end();
      return;
    }

    userMiddleware(req, res, next);
  };
}
