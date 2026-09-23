/**
 * Shared identity shape for a playable song, used across the desktop and server
 * packages wherever only the minimal identifying fields (not full metadata) are needed.
 */

/**
 * Minimal identity of a playable song.
 */
export interface Song {
  /** Library-assigned identifier for the song (its database row id, as a string). */
  id: string;
  /** Source type of the song, e.g. `'file'`, `'youtube'`, or `'bandcamp'`. */
  kind: string;
  /** Location of the song: a filesystem path for local files, or a URL for streamed sources. */
  path: string;
}

// Punctuation/keywords that only appear in Liqe query syntax (field:value, boolean/unary operators,
// grouping, quoting, ranges, wildcards, regex) and never in an ordinary free-text search term.
const LIQE_OPERATOR_PATTERN = /[:()[\]{}"'*?~/]|(?:^|\s)-\S|\b(?:AND|OR|NOT)\b/;

/**
 * Checks whether a filter string uses Liqe query syntax (https://github.com/gajus/liqe), e.g.
 * `artist:radiohead`, `year:>2000`, `NOT genre:pop`, rather than being a plain free-text search
 * term. Used by both the sqlite-backed library and the client's song table so they apply the
 * same free-text-vs-query heuristic.
 *
 * @param filter The filter string as typed by the user.
 * @returns True if `filter` looks like it uses Liqe operators.
 */
export function hasLiqeOperators(filter: string): boolean {
  return LIQE_OPERATOR_PATTERN.test(filter);
}
