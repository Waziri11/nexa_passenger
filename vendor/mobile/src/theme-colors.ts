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
  blue: '#0C57E8',
  brandAccent: '#1463FF',
  primary: '#1463FF',
  navy: '#10213B',
  muted: '#5F6D83',
  background: '#F3F7FC',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  input: '#FAFCFF',
  border: '#E1E8F2',
  green: '#13865A',
  blueTint: '#EDF3FF',
  blueBorder: '#D5E3FF',
  selection: '#C9DDFF',
  onPrimary: '#FFFFFF',
  danger: '#C32E40',
  dangerText: '#A52121',
  dangerTint: '#FBEAEC',
  warning: '#806125',
  warningTint: '#FFF0CB',
  noticeText: '#1648A0',
  noticeTint: '#E5EFFF',
  scrim: 'rgba(16,33,59,.4)',
  shadow: '#10213B',
  routeCasing: '#FFFFFF',
  rating: '#99630A',
};
export type ThemePalette = typeof lightPalette;
export const darkPalette: ThemePalette = {
  blue: '#D5DEE7',
  brandAccent: '#19212A',
  primary: '#19212A',
  navy: '#EEF3FC',
  muted: '#AAB8CE',
  background: '#11181F',
  surface: '#19212A',
  elevated: '#202C36',
  input: '#141D25',
  border: '#35414B',
  green: '#59D7AC',
  blueTint: '#26323E',
  blueBorder: '#536475',
  selection: '#344554',
  onPrimary: '#FFFFFF',
  danger: '#C32E40',
  dangerText: '#FFADB5',
  dangerTint: '#3D2029',
  warning: '#F1CE84',
  warningTint: '#3A301B',
  noticeText: '#D5DEE7',
  noticeTint: '#26323E',
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
