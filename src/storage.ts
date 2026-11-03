import { tokenStorageKey } from './config';

export function readToken(): string | null {
  try {
    const value = localStorage.getItem(tokenStorageKey);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  localStorage.setItem(tokenStorageKey, token);
}

export function clearToken(): void {
  localStorage.removeItem(tokenStorageKey);
}

export function cleanToken(raw: string): string {
  return raw.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
}
