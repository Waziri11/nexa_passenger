import { test, expect } from 'bun:test';
import {
  supportsGoogleMap,
  visibleMapPadding,
  googleDirectionsUrl,
} from './map-model';
test('iPhone Expo Go never selects the unsupported Google native provider', () => {
  expect(supportsGoogleMap('ios', 'storeClient', false)).toBe(false);
  expect(supportsGoogleMap('ios', 'storeClient', true)).toBe(false);
  expect(supportsGoogleMap('ios', 'standalone', true)).toBe(true);
  expect(supportsGoogleMap('ios', 'standalone', false)).toBe(false);
});
test('map camera padding leaves visible space even with the bottom sheet expanded', () => {
  const p = visibleMapPadding(550, 700, true);
  expect(p.top + p.bottom).toBeLessThan(550);
  expect(p.bottom).toBeGreaterThan(0);
});
test('preview directions preserve exact origin, destination and stop ordering', () => {
  const url = new URL(
    googleDirectionsUrl(
      { latitude: -6.8, longitude: 39.2 },
      { latitude: -6.7, longitude: 39.3 },
      [{ latitude: -6.75, longitude: 39.25 }],
    ),
  );
  expect(url.searchParams.get('origin')).toBe('-6.8,39.2');
  expect(url.searchParams.get('destination')).toBe('-6.7,39.3');
  expect(url.searchParams.get('waypoints')).toBe('-6.75,39.25');
});

test('route preview camera leaves room for the search bar, metrics and vehicle sheet', () => {
  const p = visibleMapPadding(700, 405, true, 210);
  expect(p.top).toBe(210);
  expect(p.top + p.bottom).toBeLessThan(700);
  expect(700 - p.bottom).toBeLessThanOrEqual(295);
});
