/**
 * Event emitted by the server when a background library folder rescan (started via
 * `LibraryService.rescan`) finishes, successfully or not. Streamed to clients over SSE
 * so they can refresh their song list once a rescan they (or another client) triggered
 * actually completes, rather than blocking the triggering request until it's done.
 */
export type LibraryRescanEvent =
  | { folder: string; status: 'complete'; count: number }
  | { folder: string; status: 'failed'; error: string };
