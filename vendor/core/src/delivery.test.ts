import { test, expect } from 'bun:test';
import {
  categories,
  rideCategories,
  requestSchema,
  cargoSchema,
  subscriptionAmount,
  cargoOnly,
  deliveryBookingEnabled,
} from './index';
const base = {
  pickup: { latitude: -6.81, longitude: 39.28 },
  destination: { latitude: -6.8, longitude: 39.3 },
  pickupLabel: 'Posta',
  destinationLabel: 'Kariakoo',
};
test('all six delivery vehicles have fixed subscriptions and existing passenger prices stay unchanged', () => {
  expect(categories).toEqual([
    'boda',
    'bajaji',
    'car',
    'toyo',
    'kirikuu',
    'truck',
  ]);
  expect(rideCategories).toEqual(['boda', 'bajaji', 'car']);
  for (const [category, price] of [
    ['boda', 20000],
    ['bajaji', 30000],
    ['car', 40000],
    ['toyo', 40000],
    ['kirikuu', 50000],
    ['truck', 70000],
  ] as const) {
    expect(subscriptionAmount(category)).toBe(price);
    expect(subscriptionAmount(category, 12)).toBe(price * 12);
  }
  expect(deliveryBookingEnabled).toBe(false);
});
test('delivery requires real description, positive finite kilos and an explicit fragile choice', () => {
  for (const category of categories) {
    const cargo = {
      description: 'Cartons of goods',
      estimatedWeightKg: 42.5,
      fragile: false,
    };
    expect(
      requestSchema.parse({ ...base, category, serviceKind: 'delivery', cargo })
        .cargo,
    ).toEqual(cargo);
    expect(
      requestSchema.safeParse({ ...base, category, serviceKind: 'delivery' })
        .success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ ...base, category, serviceKind: 'ride' })
        .success,
    ).toBe(!cargoOnly(category));
  }
  for (const estimatedWeightKg of [0, -1, NaN, Infinity])
    expect(
      cargoSchema.safeParse({
        description: 'Boxes',
        estimatedWeightKg,
        fragile: true,
      }).success,
    ).toBe(false);
  expect(
    cargoSchema.safeParse({
      description: '  ',
      estimatedWeightKg: 2,
      fragile: false,
    }).success,
  ).toBe(false);
  expect(
    cargoSchema.safeParse({ description: 'Boxes', estimatedWeightKg: 2 })
      .success,
  ).toBe(false);
});
test('legacy passenger payloads default to rides and cannot hide delivery data', () => {
  expect(requestSchema.parse({ ...base, category: 'boda' }).serviceKind).toBe(
    'ride',
  );
  expect(
    requestSchema.safeParse({
      ...base,
      category: 'car',
      cargo: { description: 'Boxes', estimatedWeightKg: 2, fragile: false },
    }).success,
  ).toBe(false);
});
