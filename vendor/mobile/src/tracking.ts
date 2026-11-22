import { previewApi } from './preview-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { api, loadSession, uuid } from './client';
const TASK = 'flash-driver-tracking';
const KEY = 'flash.tracking.context';
const QUEUE = 'flash.tracking.queue';
type Context = {
  rideId?: string;
  online: boolean;
  language?: 'sw' | 'en';
  previewAuth?: { id: string; secret: string };
  category?: 'boda' | 'bajaji' | 'car';
};
let flushing = false;
export async function enqueueLocation(
  point: { latitude: number; longitude: number },
  timestamp: number,
) {
  const context: Context | null = JSON.parse(
    (await AsyncStorage.getItem(KEY)) || 'null',
  );
  if (!context?.online && !context?.rideId) return;
  if (context.previewAuth) {
    await previewApi(
      '/availability',
      {
        online: context.online,
        point,
        category: context.category || 'boda',
        recordedAt: new Date(timestamp).toISOString(),
      },
      context.previewAuth,
    );
    return;
  }
  if (!context.rideId) {
    await api('/drivers/location', { point });
    return;
  }
  const queue = JSON.parse((await AsyncStorage.getItem(QUEUE)) || '[]');
  queue.push({
    rideId: context.rideId,
    point,
    recordedAt: new Date(timestamp).toISOString(),
    eventId: uuid(),
  });
  await AsyncStorage.setItem(QUEUE, JSON.stringify(queue.slice(-1000)));
  await flushLocations();
}
export async function flushLocations() {
  if (flushing) return;
  flushing = true;
  try {
    await loadSession();
    let queue = JSON.parse((await AsyncStorage.getItem(QUEUE)) || '[]');
    while (queue.length) {
      const event = queue[0];
      try {
        await api(`/rides/${event.rideId}/location`, event);
      } catch (e) {
        if (/closed|ended|denied|Invalid location timestamp/.test(String(e))) {
          queue.shift();
          await AsyncStorage.setItem(QUEUE, JSON.stringify(queue));
          continue;
        }
        break;
      }
      queue.shift();
      await AsyncStorage.setItem(QUEUE, JSON.stringify(queue));
    }
  } finally {
    flushing = false;
  }
}
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data) return;
  await loadSession();
  for (const location of (data as { locations: Location.LocationObject[] })
    .locations) {
    if (location.coords.accuracy != null && location.coords.accuracy > 75)
      continue;
    await enqueueLocation(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      location.timestamp,
    );
  }
});
export async function configureTracking(context: Context) {
  await AsyncStorage.setItem(KEY, JSON.stringify(context));
  if (Constants.executionEnvironment === 'storeClient') return false;
  if (!context.online && !context.rideId) {
    if (await Location.hasStartedLocationUpdatesAsync(TASK))
      await Location.stopLocationUpdatesAsync(TASK);
    return true;
  }
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') return false;
  if (!(await Location.hasStartedLocationUpdatesAsync(TASK)))
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Nexadrop Driver',
        notificationBody:
          context.language === 'en'
            ? 'Location sharing while available or on a trip'
            : 'Nexadrop inashiriki eneo lako kupokea maombi na kufuatilia safari',
      },
    });
  return true;
}
