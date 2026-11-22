import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './client';
export async function registerNotifications(
  language: 'sw' | 'en' = 'sw',
  saveToken?: (token: string) => Promise<unknown>,
) {
  if (Constants.executionEnvironment === 'storeClient') return false;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return false;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('rides', {
      name: language === 'sw' ? 'Maombi ya safari' : 'Ride requests',
      importance: Notifications.AndroidImportance.HIGH,
    });
  const p = await Notifications.requestPermissionsAsync();
  if (p.status !== 'granted') return false;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (saveToken) await saveToken(token);
  else await api('/devices', { token, platform: Platform.OS });
  return true;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function ringOffer(language: 'sw' | 'en') {
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status === 'undetermined')
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nexadrop',
      body:
        language === 'sw'
          ? 'Ombi la safari karibu nawe'
          : 'Nearby ride request',
      sound: 'default',
    },
    trigger: null,
  });
}

export function listenForChatNotifications(open: (rideId: string) => void) {
  if (Constants.executionEnvironment === 'storeClient') return () => {};
  let disposed = false;
  const receive = (response: Notifications.NotificationResponse | null) => {
    const id = response?.notification.request.content.data?.chatRideId;
    if (!disposed && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) {
      open(id);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  };
  const subscription =
    Notifications.addNotificationResponseReceivedListener(receive);
  void Notifications.getLastNotificationResponseAsync()
    .then(receive)
    .catch(() => {});
  return () => {
    disposed = true;
    subscription.remove();
  };
}
