import { test, expect } from 'bun:test';
import {
  fare,
  tariffs,
  addMonth,
  distance,
  roundRideFare,
  addMonths,
  subscriptionAmount,
  subscriptionDue,
} from './index';
test('minimum and traffic pricing', () => {
  expect(fare(tariffs.car, 100, 30).total).toBe(4000);
  expect(fare(tariffs.car, 10000, 1200).total).toBe(14500);
  expect(fare(tariffs.car, 10000, 1800).total).toBe(16000);
});
test('five minute boundary, seconds prorated, no double counting', () => {
  expect(fare(tariffs.boda, 0, 0, 300).waiting).toBe(0);
  expect(fare(tariffs.boda, 0, 0, 330).waiting).toBe(45);
  expect(fare(tariffs.boda, 0, 0, 360).total).toBe(2000);
});
test('tariff snapshot is independent', () => {
  const snapshot = structuredClone(tariffs.car);
  snapshot.perKm = 2000;
  expect(tariffs.car.perKm).toBe(1100);
});
test('invalid measurements fail', () => {
  expect(() => fare(tariffs.car, -1, 0)).toThrow();
  expect(() => fare(tariffs.car, 0, NaN)).toThrow();
});
test('calendar month clamps end dates', () => {
  expect(addMonth(new Date('2027-01-31T10:00:00Z')).toISOString()).toBe(
    '2027-02-28T10:00:00.000Z',
  );
  expect(addMonth(new Date('2028-01-31T10:00:00Z')).getUTCDate()).toBe(29);
});
test('geofence distance', () => {
  expect(
    distance(
      { latitude: -6.8, longitude: 39.2 },
      { latitude: -6.8, longitude: 39.2 },
    ),
  ).toBe(0);
  expect(
    distance(
      { latitude: -6.8, longitude: 39.2 },
      { latitude: -6.81, longitude: 39.2 },
    ),
  ).toBeGreaterThan(1000);
});

test('ride totals round up to TZS 500 without changing itemized time and waiting rates', () => {
  for (const [input, expected] of [
    [1960, 2000],
    [1490, 1500],
    [1345, 1500],
    [2100, 2500],
    [2000, 2000],
    [2000.01, 2500],
    [0, 0],
    [2500, 2500],
  ])
    expect(roundRideFare(input)).toBe(expected);
  expect(roundRideFare(2000.0000000000002)).toBe(2000);
  expect(() => roundRideFare(NaN)).toThrow();
  expect(() => roundRideFare(-1)).toThrow();
  const charged = fare(tariffs.boda, 0, 0, 330);
  expect(charged.waiting).toBe(45);
  expect(charged.unroundedTotal).toBe(1545);
  expect(charged.total).toBe(2000);
  expect(charged.roundingAdjustment).toBe(455);
  expect(
    charged.base +
      charged.distance +
      charged.time +
      charged.minimumAdjustment +
      charged.waiting +
      charged.roundingAdjustment,
  ).toBe(charged.total);
  const old = { ...tariffs.boda };
  delete old.rounding;
  expect(fare(old, 0, 0, 360).total).toBe(1590);
});

test('passenger cancellation choices and one-minute matching boundary', async () => {
  const { passengerCancellation, rideSearchExpired, driverSchema } =
    await import('./index');
  expect(passengerCancellation('accidental_request')).toEqual({
    code: 'accidental_request',
    reason: 'Accidental request',
  });
  expect(passengerCancellation('other', 'Changed my plans')).toEqual({
    code: 'other',
    reason: 'Changed my plans',
  });
  expect(() => passengerCancellation('other', '')).toThrow();
  expect(() => passengerCancellation('unknown')).toThrow();
  const created = '2026-11-17T08:00:00Z',
    at = Date.parse(created);
  expect(rideSearchExpired('requested', created, at + 59999)).toBe(false);
  expect(rideSearchExpired('requested', created, at + 60000)).toBe(true);
  expect(rideSearchExpired('accepted', created, at + 61000)).toBe(false);
  const docs = {
    category: 'boda',
    plate: 'T 123 ABC',
    licenceNumber: 'LIC123',
    licenceExpiry: '2030-01-01',
    profilePhoto: crypto.randomUUID(),
    licenceFront: crypto.randomUUID(),
    licenceBack: crypto.randomUUID(),
    vehiclePhoto: crypto.randomUUID(),
  };
  expect(driverSchema.safeParse(docs).success).toBe(false);
  expect(
    driverSchema.parse({ ...docs, vehicleColor: ' Blue ' }).vehicleColor,
  ).toBe('Blue');
});

test('yearly plans charge twelve months and preserve Tanzania calendar dates', () => {
  expect(subscriptionAmount('boda', 12)).toBe(240000);
  expect(subscriptionAmount('bajaji', 12)).toBe(360000);
  expect(subscriptionAmount('car', 12)).toBe(480000);
  expect(subscriptionAmount('car', 1)).toBe(40000);
  expect(addMonths(new Date('2028-02-29T10:00:00Z'), 12).toISOString()).toBe(
    '2029-02-28T10:00:00.000Z',
  );
  expect(addMonths(new Date('2027-01-30T21:00:00Z'), 1).toISOString()).toBe(
    '2027-02-27T21:00:00.000Z',
  );
  expect(addMonths(new Date('2028-02-28T21:00:00Z'), 12).toISOString()).toBe(
    '2029-02-27T21:00:00.000Z',
  );
});
test('recharge is due only at the later of trial and paid-through expiry', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');
  expect(
    subscriptionDue(
      {
        trial_ends_at: '2026-12-17T10:00:00Z',
        paid_until: '2026-11-16T10:00:00Z',
      },
      now,
    ).due,
  ).toBe(false);
  expect(
    subscriptionDue(
      {
        trial_ends_at: '2026-11-16T10:00:00Z',
        paid_until: '2027-11-17T10:00:00Z',
      },
      now,
    ).dueAt,
  ).toBe('2027-11-17T10:00:00.000Z');
  expect(subscriptionDue({ paid_until: new Date(now) }, now).due).toBe(true);
  expect(subscriptionDue({ paid_until: new Date(now + 1) }, now).due).toBe(
    false,
  );
});
