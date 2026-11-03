/**
 * Snapshot source. Change this if the desk publishes somewhere else.
 * Never put a token in this file. The token lives only in the browser.
 */
export const snapshotSource = {
  owner: 'Virtue-Ed',
  repo: 'fomo-desk-data',
  path: 'snapshot.json',
  ref: 'main',
} as const;

/** How often to re-read the snapshot while the page is visible. */
export const pollIntervalMs = 30_000;

/** Warn when generated_at is older than this. */
export const staleAfterMs = 5 * 60 * 1000;

export const timeZone = 'America/Chicago';

export const tokenStorageKey = 'grok-desk.github-token';

/**
 * GET {this URL}
 *   Accept: application/vnd.github.raw
 *   Authorization: Bearer <token from localStorage>
 */
export function snapshotRequestUrl(source = snapshotSource): string {
  const encodedPath = source.path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const base = `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/contents/${encodedPath}`;
  if (!source.ref) return base;
  return `${base}?ref=${encodeURIComponent(source.ref)}`;
}
