import type { Point } from '@nexadrop/core';
/** Expo Go on iOS only contains MapKit; keys cannot add a missing native SDK. */
export function supportsGoogleMap(
  platform: string,
  environment: string,
  hasIosKey: boolean,
) {
  return (
    platform === 'android' ||
    (platform === 'ios' && environment !== 'storeClient' && hasIosKey)
  );
}
export function visibleMapPadding(
  height: number,
  bottomInset: number,
  fullscreen: boolean,
  topInset = 110,
) {
  const top = Math.min(topInset, Math.max(20, height / 3));
  return {
    top,
    left: 35,
    right: 35,
    bottom: fullscreen
      ? Math.max(20, Math.min(bottomInset + 12, height - top - 60))
      : 30,
  };
}
export function googleDirectionsUrl(
  origin: Point,
  destination: Point,
  stops: Point[] = [],
) {
  const p = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  });
  if (stops.length)
    p.set(
      'waypoints',
      stops.map((s) => `${s.latitude},${s.longitude}`).join('|'),
    );
  return 'https://www.google.com/maps/dir/?' + p;
}
