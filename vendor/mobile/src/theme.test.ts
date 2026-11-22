import { expect, test } from 'bun:test';
import {
  darkPalette,
  lightPalette,
  parseTheme,
  resolveTheme,
} from './theme-colors';
function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test('themes default to device appearance and explicit choices override system changes', () => {
  expect(parseTheme(null)).toBe('system');
  expect(parseTheme('invalid')).toBe('system');
  expect(resolveTheme(parseTheme('system'), 'dark')).toBe('dark');
  expect(resolveTheme('system', 'light')).toBe('light');
  expect(resolveTheme('system', null)).toBe('light');
  expect(resolveTheme(parseTheme('light'), 'dark')).toBe('light');
  expect(resolveTheme(parseTheme('dark'), 'light')).toBe('dark');
});
test('both themes keep key text, secondary labels and action labels readable', () => {
  for (const palette of [lightPalette, darkPalette]) {
    for (const surface of [
      palette.background,
      palette.surface,
      palette.input,
      palette.blueTint,
    ])
      expect(contrast(palette.navy, surface)).toBeGreaterThanOrEqual(4.5);
    for (const surface of [palette.background, palette.surface, palette.input])
      expect(contrast(palette.muted, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.blue, palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.blue, palette.blueTint)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(palette.rating, palette.blueTint)).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrast(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(palette.onPrimary, palette.danger)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrast(palette.dangerText, palette.dangerTint),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(palette.noticeText, palette.noticeTint),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
