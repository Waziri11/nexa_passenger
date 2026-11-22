import { z } from 'zod';
export const passengerCancelCodes = [
  'accidental_request',
  'driver_too_long',
  'better_alternative',
  'other',
] as const;
export const passengerCancelSchema = z.enum(passengerCancelCodes);
export function passengerCancellation(code: unknown, reason?: string) {
  const selected = passengerCancelSchema.parse(code || 'other');
  const fixed = {
    accidental_request: 'Accidental request',
    driver_too_long: 'Driver took too long',
    better_alternative: 'Found a better alternative',
  };
  return {
    code: selected,
    reason:
      selected === 'other'
        ? z.string().trim().min(3).max(1000).parse(reason)
        : fixed[selected],
  };
}
export const DRIVER_SEARCH_SECONDS = 60;
export function rideSearchExpired(
  status: string,
  createdAt: string | Date,
  now = Date.now(),
) {
  return (
    status === 'requested' &&
    now - new Date(createdAt).getTime() >= DRIVER_SEARCH_SECONDS * 1000
  );
}
