import { expect, test } from 'bun:test';
import {
  filterTrips,
  tripDay,
  validTripDay,
  mergeTripHistory,
  belongsToPreviewHistory,
} from './trip-history';
const trips = [
  {
    id: '1',
    created_at: '2026-11-16T22:30:00Z',
    pickup_label: 'Aga Khan',
    destination_label: 'Masaki',
    driver_name: 'Asha Juma',
    stops: [{ label: 'Posta' }],
  },
  {
    id: '2',
    created_at: '2026-11-18T08:00:00Z',
    pickup_label: 'Mlimani',
    destination_label: 'Kariakoo',
    driver_name: 'John',
  },
];
test('history searches places, stops and driver names without case sensitivity', () => {
  expect(filterTrips(trips, 'ASHA masaki').map((r) => r.id)).toEqual(['1']);
  expect(filterTrips(trips, 'posta').map((r) => r.id)).toEqual(['1']);
  expect(filterTrips(trips, 'missing')).toEqual([]);
});
test('history dates use inclusive Tanzania calendar days and validate calendar dates', () => {
  expect(tripDay(trips[0].created_at)).toBe('2026-11-17');
  expect(
    filterTrips(trips, '', '2026-11-17', '2026-11-17').map((r) => r.id),
  ).toEqual(['1']);
  expect(filterTrips(trips, '', '2026-11-17', '2026-11-18')).toHaveLength(2);
  expect(validTripDay('2026-02-30')).toBe(false);
  expect(validTripDay('2026-11-17')).toBe(true);
  expect(validTripDay('17/11/2026')).toBe(false);
});

test('recovery preserves feedback and only selects the matching account records', () => {
  const account = { id: 'passenger-1', phone: '+255700000001' };
  const complete = {
    id: 'ride-1',
    status: 'completed',
    created_at: '2026-11-17T08:00:00Z',
    passenger_id: account.id,
    my_feedback: { stars: 4, comment: 'Good' },
  };
  expect(belongsToPreviewHistory(complete, account, 'passenger')).toBe(true);
  expect(
    belongsToPreviewHistory(
      { ...complete, passenger_id: 'someone-else' },
      account,
      'passenger',
    ),
  ).toBe(false);
  expect(
    belongsToPreviewHistory(
      { ...complete, status: 'accepted' },
      account,
      'passenger',
    ),
  ).toBe(false);
  expect(
    belongsToPreviewHistory(
      {
        ...complete,
        passenger_id: 'old-id',
        passenger: { phone: account.phone },
      },
      account,
      'passenger',
    ),
  ).toBe(true);
  const merged = mergeTripHistory(
    [complete],
    [{ ...complete, my_feedback: null }],
  );
  expect(merged).toHaveLength(1);
  expect(merged[0].my_feedback.comment).toBe('Good');
});
