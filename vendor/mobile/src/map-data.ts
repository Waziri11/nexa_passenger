import * as Location from 'expo-location';
import type { Language, Point } from '@nexadrop/core';
import { apiOrigin } from './client';
export type MapPlace = Point & { label: string };
export function addressLabel(
  address: Location.LocationGeocodedAddress | undefined,
  point: Point,
) {
  if (!address)
    return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  return (
    [
      ...new Set(
        [
          address.name,
          [address.streetNumber, address.street].filter(Boolean).join(' '),
          address.district,
          address.city,
        ].filter(Boolean),
      ),
    ].join(', ') ||
    `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
  );
}
export async function reverseAddress(point: Point) {
  try {
    return addressLabel((await Location.reverseGeocodeAsync(point))[0], point);
  } catch {
    return addressLabel(undefined, point);
  }
}

export type PlaceSuggestion = {
  placeId: string;
  label: string;
  primaryText: string;
  secondaryText: string;
  distanceMeters?: number;
  location?: Point;
};
async function searchRequest(
  path: string,
  body: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch(apiOrigin + '/v1/maps/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal || AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Maps search unavailable');
  return response.json();
}
export async function findRealPlaces(
  input: string,
  language: Language,
  sessionToken: string,
  origin?: Point,
  signal?: AbortSignal,
): Promise<{ places: PlaceSuggestion[]; limited: boolean }> {
  return searchRequest(
    'autocomplete',
    { input, language, sessionToken, origin },
    signal,
  );
}
export async function resolvePlace(
  suggestion: PlaceSuggestion,
  language: Language,
  sessionToken: string,
): Promise<MapPlace> {
  if (suggestion.location)
    return { ...suggestion.location, label: suggestion.label };
  const result = await searchRequest('place', {
    placeId: suggestion.placeId,
    language,
    sessionToken,
  });
  return { ...result.place, label: suggestion.label };
}
