if (process.env.EAS_BUILD_PROFILE === 'production' && process.env.EXPO_PUBLIC_PREVIEW !== 'false')
  throw new Error('Production requires EXPO_PUBLIC_PREVIEW=false');
import base from './app.json';
import type { ExpoConfig } from 'expo/config';
if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  !process.env.EXPO_PUBLIC_API_URL?.startsWith('https://')
)
  throw new Error('Production requires an HTTPS EXPO_PUBLIC_API_URL');
if (
  ['development', 'production'].includes(process.env.EAS_BUILD_PROFILE || '') &&
  process.env.EAS_BUILD_PLATFORM === 'ios' &&
  !process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
)
  throw new Error(
    'Google Maps iPhone builds require EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY with Maps SDK for iOS enabled. Configure it in the EAS development environment.',
  );
if (
  ['development', 'production'].includes(process.env.EAS_BUILD_PROFILE || '') &&
  process.env.EAS_BUILD_PLATFORM === 'android' &&
  !process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
)
  throw new Error(
    'Google Maps Android builds require EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY with Maps SDK for Android enabled. Configure it in the EAS development environment.',
  );
const config: ExpoConfig = {
  ...(base.expo as ExpoConfig),
  plugins: [
    '@livekit/react-native-expo-plugin',
    [
      '@config-plugins/react-native-webrtc',
      {
        microphonePermission: 'Nexadrop uses the microphone for calls between passengers and drivers.',
      },
    ],
    ...((base.expo.plugins as ExpoConfig['plugins']) || []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || '',
        iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || '',
      },
    ],
  ],
  extra: {
    ...(base.expo as ExpoConfig).extra,
    eas: {
      ...(base.expo as ExpoConfig).extra?.eas,
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID || (base.expo as ExpoConfig).extra?.eas?.projectId,
    },
  },
};
export default config;
