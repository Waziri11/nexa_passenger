import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
export const preview = process.env.EXPO_PUBLIC_PREVIEW !== 'false';
const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const origin = process.env.EXPO_PUBLIC_API_URL || `http://${host}:4000`;
let pair: { accessToken: string; refreshToken: string } | null = null;
let refreshing: Promise<void> | null = null;
const expiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}
export async function loadSession() {
  const stored = await SecureStore.getItemAsync('flash.session');
  pair = stored ? JSON.parse(stored) : null;
  return pair;
}
export async function saveSession(value: typeof pair) {
  pair = value;
  if (value)
    await SecureStore.setItemAsync('flash.session', JSON.stringify(value));
  else await SecureStore.deleteItemAsync('flash.session');
}
export async function api(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
  retry = true,
  extraHeaders: Record<string, string> = {},
): Promise<any> {
  const response = await fetch(origin + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(pair ? { Authorization: `Bearer ${pair.accessToken}` } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 && pair && retry) {
    if (!refreshing)
      refreshing = (async () => {
        const r = await fetch(origin + '/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: pair!.refreshToken }),
        });
        if (!r.ok) {
          await saveSession(null);
          for (const listener of expiredListeners) listener();
          throw new Error('Please verify your phone again');
        }
        await saveSession(await r.json());
      })().finally(() => {
        refreshing = null;
      });
    await refreshing;
    return api(path, body, method, false, extraHeaders);
  }
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export async function book(body: unknown, key: string) {
  return api('/rides', body, 'POST', true, { 'Idempotency-Key': key });
}
export const uuid = () => Crypto.randomUUID();
export const sessionToken = () => pair?.accessToken;
export const apiOrigin = origin;
