export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeScheme = 'light' | 'dark';
export function parseTheme(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveTheme(
  preference: ThemePreference,
  device: string | null | undefined,
): ThemeScheme {
  return preference === 'system'
    ? device === 'dark'
      ? 'dark'
      : 'light'
    : preference;
}
export const lightPalette = {
  blue: '#B83B0F',
  brandAccent: '#FF5A1F',
  primary: '#C94010',
  navy: '#17212B',
  muted: '#5E6872',
  background: '#F5F6F7',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  input: '#FAFAF9',
  border: '#E1E4E7',
  green: '#13865A',
  blueTint: '#FFF0E8',
  blueBorder: '#F4D2C1',
  selection: '#F4C0A7',
  onPrimary: '#FFFFFF',
  danger: '#C32E40',
  dangerText: '#A52121',
  dangerTint: '#FBEAEC',
  warning: '#806125',
  warningTint: '#FFF0CB',
  noticeText: '#9A330E',
  noticeTint: '#FFF0E8',
  scrim: 'rgba(16,33,59,.4)',
  shadow: '#17212B',
  routeCasing: '#FFFFFF',
  rating: '#99630A',
};
export type ThemePalette = typeof lightPalette;
export const darkPalette: ThemePalette = {
  blue: '#FFAA85',
  brandAccent: '#FF5A1F',
  primary: '#C94010',
  navy: '#EEF3FC',
  muted: '#AAB8CE',
  background: '#11181F',
  surface: '#17212B',
  elevated: '#202C36',
  input: '#141D25',
  border: '#35414B',
  green: '#59D7AC',
  blueTint: '#3A251D',
  blueBorder: '#694333',
  selection: '#674333',
  onPrimary: '#FFFFFF',
  danger: '#C32E40',
  dangerText: '#FFADB5',
  dangerTint: '#3D2029',
  warning: '#F1CE84',
  warningTint: '#3A301B',
  noticeText: '#FFC2A6',
  noticeTint: '#3A251D',
  scrim: 'rgba(0,0,0,.65)',
  shadow: '#000000',
  routeCasing: '#11181F',
  rating: '#F2C35C',
};
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#182538' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#B8C7DA' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141D25' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#42526A' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1D3040' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#17382F' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#35465D' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#182538' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#52647D' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#29374A' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#071A2B' }],
  },
];
