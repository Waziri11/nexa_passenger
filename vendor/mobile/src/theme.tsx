import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Appearance,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createStyles } from './styles';
import {
  lightPalette,
  darkPalette,
  parseTheme,
  resolveTheme,
  type ThemePreference,
  type ThemeScheme,
  type ThemePalette,
} from './theme-colors';
type ThemeContextValue = {
  colors: ThemePalette;
  s: ReturnType<typeof createStyles>;
  scheme: ThemeScheme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role: 'passenger' | 'driver';
}) {
  const device = useColorScheme();
  const [preference, setChoice] = useState<ThemePreference>('system'),
    [ready, setReady] = useState(false);
  const key = `flash.theme.${role}`;
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(key)
      .then((value) => {
        if (mounted) setChoice(parseTheme(value));
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
      Appearance.setColorScheme('unspecified');
    };
  }, [key]);
  useEffect(() => {
    if (ready)
      Appearance.setColorScheme(
        preference === 'system' ? 'unspecified' : preference,
      );
  }, [preference, ready]);
  const scheme = resolveTheme(preference, device),
    colors = scheme === 'dark' ? darkPalette : lightPalette;
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);
  const value = useMemo(
    () => ({
      colors,
      s: createStyles(colors),
      scheme,
      preference,
      setPreference: async (next: ThemePreference) => {
        await AsyncStorage.setItem(key, next);
        setChoice(next);
      },
    }),
    [colors, scheme, preference, key],
  );
  return (
    <ThemeContext.Provider value={value}>
      {ready ? (
        children
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.blue} />
        </View>
      )}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is required');
  return theme;
}
