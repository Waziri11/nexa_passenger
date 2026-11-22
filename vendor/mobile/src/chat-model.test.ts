import { expect, test } from 'bun:test';
import { mergeMessages, type ChatMessage } from './chat-model';
const message = (id: string, body = 'Hello'): ChatMessage => ({
  id,
  body,
  ride_id: 'trip',
  sender_id: 'driver',
  client_id: 'request-' + id,
  created_at: '2026-11-20T10:00:00Z',
});
test('chat merges retries, pagination and socket recovery without duplicate or misordered messages', () => {
  const messages = mergeMessages(
    [message('10'), message('2')],
    [message('2'), message('11')],
  );
  expect(messages.map((m) => m.id)).toEqual(['2', '10', '11']);
  expect(mergeMessages(messages, [message('1')]).map((m) => m.id)).toEqual([
    '1',
    '2',
    '10',
    '11',
  ]);
  expect(messages).toHaveLength(3);
});
