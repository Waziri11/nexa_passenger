import * as SecureStore from 'expo-secure-store';
import { apiOrigin, uuid } from './client';
let credentials: { id: string; secret: string } | null = null;
export async function previewSession(
  user: { id: string; full_name: string; phone: string },
  role: string,
) {
  const key = 'flash.preview.secret.' + user.id;
  let secret = await SecureStore.getItemAsync(key);
  if (!secret) {
    secret = uuid();
    await SecureStore.setItemAsync(key, secret);
  }
  const response = await fetch(apiOrigin + '/api/v1/preview/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: user.id,
      secret,
      role,
      name: user.full_name,
      phone: user.phone,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Preview dispatch unavailable');
  credentials = { id: user.id, secret };
  return credentials;
}
export async function previewApi(
  path: string,
  body?: unknown,
  auth = credentials,
): Promise<any> {
  if (!auth) throw new Error('Session expired');
  if (path === '/availability' && body)
    body = { recordedAt: new Date().toISOString(), ...(body as object) };
  const response = await fetch(apiOrigin + '/api/v1/preview' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Preview-Id': auth.id,
      'X-Preview-Secret': auth.secret,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Preview dispatch unavailable');
  }
  return response.json();
}
