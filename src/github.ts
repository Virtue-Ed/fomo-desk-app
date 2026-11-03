import { snapshotRequestUrl } from './config';

export function decodeSnapshotBody(text: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  const parsed: unknown = JSON.parse(trimmed);
  if (!isGithubWrapper(parsed)) return parsed;
  const binary = atob(parsed.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function isGithubWrapper(
  value: unknown,
): value is { content: string; encoding: string; sha: string; path: string } {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    row.encoding === 'base64' &&
    typeof row.content === 'string' &&
    typeof row.sha === 'string' &&
    typeof row.path === 'string'
  );
}

export type FetchResult =
  | { notModified: true; etag: string | null }
  | { notModified: false; raw: unknown; etag: string | null };

export async function fetchSnapshot(token: string, etag: string | null, signal: AbortSignal): Promise<FetchResult> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (etag) headers['If-None-Match'] = etag;

  let response: Response;
  try {
    response = await fetch(snapshotRequestUrl(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Could not reach GitHub. Check the connection and try again.');
  }

  const nextEtag = response.headers.get('ETag');
  if (response.status === 304) return { notModified: true, etag: nextEtag ?? etag };
  if (response.status === 401) {
    throw new Error('GitHub rejected the token (401). Use a fine-grained token with read-only Contents on the data repo.');
  }
  if (response.status === 403) {
    throw new Error('GitHub refused the read (403). The token needs Contents: Read-only, or the rate limit was hit.');
  }
  if (response.status === 404) {
    throw new Error('GitHub returned 404. The token cannot see this private repo, or the path in src/config.ts is wrong.');
  }
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}).`);

  try {
    return { notModified: false, raw: decodeSnapshotBody(await response.text()), etag: nextEtag };
  } catch {
    throw new Error('The snapshot was not valid JSON.');
  }
}
