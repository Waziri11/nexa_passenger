export type ChatMessage = {
  id: string;
  ride_id: string;
  sender_id: string;
  client_id: string;
  body: string;
  created_at: string;
};
export function mergeMessages(...groups: ChatMessage[][]) {
  const records = new Map<string, ChatMessage>();
  for (const rows of groups)
    for (const message of rows) records.set(message.id, message);
  return [...records.values()].sort((a, b) =>
    BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0,
  );
}
