import { FleetManager } from './FleetManager';
import {
  ServiceChoice,
  CargoFields,
  CargoSummary,
  parseCargo,
  emptyCargo,
  type CargoDraft,
} from './DeliveryFlow';
import { RideChat } from './RideChat';
import { ThemeProvider, useTheme } from './theme';
import { Text, TextInput } from './themed-primitives';
import { BrandMark } from './BrandMark';
import { DriverSubscriptionCard } from './DriverSubscriptionCard';
import { mergeTripHistory, belongsToPreviewHistory } from './trip-history';
import { AccountSettings, accountWords } from './AccountSettings';
import { TripHistory } from './TripHistory';
import { SubscriptionPayments } from './SubscriptionPayments';
import { previewSession, previewApi } from './preview-client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Switch,
  View,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { io } from 'socket.io-client';
import {
  passengerCancelCodes,
  money,
  rideCategories,
  cargoOnly,
  type ServiceKind,
  type RideCategory,
  fare,
  tariffs,
  subscriptions,
  distance,
  phoneSchema,
  registrationSchema,
  type Category,
  type SubscriptionMonths,
  type Language,
  type Point,
} from '@nexadrop/core';
import {
  api,
  book,
  loadSession,
  saveSession,
  preview,
  uuid,
  sessionToken,
  apiOrigin,
  onSessionExpired,
} from './client';
import { configureTracking, enqueueLocation } from './tracking';
import {
  registerNotifications,
  ringOffer,
  listenForChatNotifications,
} from './notifications';
import { LiveMap } from './LiveMap';
import { Button, Field } from './ui';
import {
  findRealPlaces,
  resolvePlace,
  reverseAddress,
  type PlaceSuggestion,
} from './map-data';
import { supportsGoogleMap, googleDirectionsUrl } from './map-model';
import { copy, localizeError, rideStatus } from './copy';
type Place = Point & {
  label: string;
  current?: boolean;
  placeholder?: boolean;
};
type User = {
  id?: string;
  full_name: string;
  phone: string;
  email: string;
  role: string;
  language?: Language;
};
type Tab = 'home' | 'trips' | 'account' | 'towing' | 'fleet';
const places: Place[] = [
  { label: 'Posta, Dar es Salaam', latitude: -6.816, longitude: 39.289 },
  { label: 'Mlimani City, Dar es Salaam', latitude: -6.772, longitude: 39.219 },
  { label: 'Masaki, Dar es Salaam', latitude: -6.754, longitude: 39.276 },
  { label: 'Kariakoo, Dar es Salaam', latitude: -6.821, longitude: 39.274 },
];
const categories: Category[] = [
  'boda',
  'bajaji',
  'car',
  'toyo',
  'kirikuu',
  'truck',
];
const icons = {
  boda: 'bicycle-outline',
  bajaji: 'bus-outline',
  car: 'car-sport-outline',
  toyo: 'bus-outline',
  kirikuu: 'car-outline',
  truck: 'cube-outline',
} as const;
const photoKeys = [
  'profilePhoto',
  'vehiclePhoto',
  'licenceFront',
  'licenceBack',
] as const;
const terminal = (r: any) =>
  !r || ['completed', 'cancelled'].includes(r.status);
export function NexadropApp({ role }: { role: 'passenger' | 'driver' }) {
  return (
    <SafeAreaProvider>
      <ThemeProvider role={role}>
        <App role={role} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
function App({ role }: { role: 'passenger' | 'driver' }) {
  const { s, colors, scheme } = useTheme();
  const [lang, setLang] = useState<Language>('sw'),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<Tab>('home'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(''),
    [notice, setNotice] = useState<keyof typeof copy.sw | null>(null),
    [otpHint, setOtpHint] = useState('');
  const [chatRide, setChatRide] = useState<any>(null);
  const [callTarget, setCallTarget] = useState<any>(null),
    [voiceCall, setVoiceCall] = useState<any>(null),
    [incomingCall, setIncomingCall] = useState<any>(null);
  const voiceRef = useRef<any>(null);
  voiceRef.current = voiceCall;
  useEffect(
    () =>
      onSessionExpired(() => {
        setChatRide(null);
        setUser(null);
        setRide(null);
        setOffers([]);
        setHistory([]);
        setProfile(null);
        setAuthSent(false);
        setCallTarget(null);
        setIncomingCall(null);
        setVoiceCall(null);
        setTab('home');
      }),
    [],
  );
  const t = copy[lang];
  const [historyDetail, setHistoryDetail] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (tab !== 'trips') setHistoryDetail(false);
    if (tab !== 'account') setSettingsOpen(false);
  }, [tab]);
  const languageRef = useRef<Language>(lang);
  languageRef.current = lang;
  const { height } = useWindowDimensions();
  const [name, setName] = useState(''),
    [phone, setPhone] = useState('+255'),
    [email, setEmail] = useState(''),
    [marketing, setMarketing] = useState(false),
    [authSent, setAuthSent] = useState(false),
    [otp, setOtp] = useState('');
  const [serviceKind, setServiceKind] = useState<ServiceKind>('ride');
  const [isFleetOwner, setIsFleetOwner] = useState(false);
  const [serviceChooser, setServiceChooser] = useState(false);
  const [vehicleLimits, setVehicleLimits] = useState<
    Record<string, number | null>
  >({});
  const [deliveryStep, setDeliveryStep] = useState<'cargo' | 'vehicle'>(
    'cargo',
  );
  const [cargoDraft, setCargoDraft] = useState<CargoDraft>(emptyCargo);
  const [billingMonths, setBillingMonths] = useState<SubscriptionMonths>(1);
  const [profile, setProfile] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [ride, setRide] = useState<any>(null),
    [offers, setOffers] = useState<any[]>([]),
    [subscription, setSubscription] = useState<any>(null),
    [towing, setTowing] = useState<any[]>([]);
  const [pickupKnown, setPickupKnown] = useState(false),
    [locationGranted, setLocationGranted] = useState(false);
  const [pickup, setPickup] = useState<Place>(places[0]),
    [destination, setDestination] = useState<Place | null>(null),
    [stops, setStops] = useState<Place[]>([]),
    [routeReady, setRouteReady] = useState(false),
    [quotes, setQuotes] = useState<Record<string, any>>({}),
    [category, setCategory] = useState<Category>('boda'),
    [confirmation, setConfirmation] = useState(false),
    [paymentOpen, setPaymentOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [searchTarget, setSearchTarget] = useState<
      'pickup' | 'destination' | number
    >('destination'),
    [search, setSearch] = useState(''),
    [results, setResults] = useState<PlaceSuggestion[]>([]),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [limitedSearch, setLimitedSearch] = useState(false),
    [searchingPlaces, setSearchingPlaces] = useState(false),
    [selectingPlace, setSelectingPlace] = useState(false),
    [locating, setLocating] = useState(false);
  const [editing, setEditing] = useState(false),
    [editName, setEditName] = useState(''),
    [editPhone, setEditPhone] = useState(''),
    [editEmail, setEditEmail] = useState(''),
    [phoneVerify, setPhoneVerify] = useState(false),
    [phoneCode, setPhoneCode] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false),
    [plate, setPlate] = useState(''),
    [vehicleColor, setVehicleColor] = useState(''),
    [licence, setLicence] = useState(''),
    [expiry, setExpiry] = useState(''),
    [docs, setDocs] = useState<Record<string, string>>({}),
    [identityStarted, setIdentityStarted] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false),
    [reason, setReason] = useState(''),
    [cancelCode, setCancelCode] = useState(''),
    [stars, setStars] = useState(5),
    [comment, setComment] = useState(''),
    [payment, setPayment] = useState<'cash' | 'mobile_money'>('cash'),
    [expanded, setExpanded] = useState(false);
  const closedRideIds = useRef(new Set<string>());
  const [unavailableCategory, setUnavailableCategory] =
    useState<Category | null>(null);
  const locationAttempted = useRef(false),
    pickupManuallyChanged = useRef(false);
  const [frequentSearches, setFrequentSearches] = useState<
    { query: string; count: number; lastUsed: number }[]
  >([]);
  const [savedPlaces, setSavedPlaces] = useState<
    (Place & { nickname: string })[]
  >([]);
  const [labelOpen, setLabelOpen] = useState(false),
    [placeNickname, setPlaceNickname] = useState('');
  const savedOwner = useRef<string | null>(null);
  useEffect(() => {
    savedOwner.current = null;
    setSavedPlaces([]);
    setLabelOpen(false);
    if (!user?.id || role !== 'passenger') return;
    const id = user.id;
    let cancelled = false;
    void AsyncStorage.getItem(`flash.savedPlaces.${id}`).then((raw) => {
      if (cancelled) return;
      try {
        const rows = JSON.parse(raw || '[]');
        if (Array.isArray(rows))
          setSavedPlaces(
            rows
              .filter(
                (p) =>
                  typeof p.nickname === 'string' &&
                  typeof p.label === 'string' &&
                  Number.isFinite(p.latitude) &&
                  Number.isFinite(p.longitude),
              )
              .slice(0, 20),
          );
      } catch {}
      savedOwner.current = id;
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  async function savePlaceLabel() {
    if (
      !destination ||
      !user?.id ||
      savedOwner.current !== user.id ||
      !placeNickname.trim()
    )
      return;
    const nickname = placeNickname.trim();
    const rows = [
      { ...destination, nickname },
      ...savedPlaces.filter(
        (p) => p.nickname.toLowerCase() !== nickname.toLowerCase(),
      ),
    ].slice(0, 20);
    await AsyncStorage.setItem(
      `flash.savedPlaces.${user.id}`,
      JSON.stringify(rows),
    );
    setSavedPlaces(rows);
    setLabelOpen(false);
    setPlaceNickname('');
  }
  async function removeSavedPlace(nickname: string) {
    const rows = savedPlaces.filter((p) => p.nickname !== nickname);
    await AsyncStorage.setItem(
      `flash.savedPlaces.${user!.id}`,
      JSON.stringify(rows),
    );
    setSavedPlaces(rows);
  }
  function openSavedPlace(place: Place) {
    setDestination(place);
    setQuotes({});
    setRouteReady(false);
    setSearch('');
    setResults([]);
    setDrafts({
      pickup: pickupKnown ? pickup.label : '',
      destination: place.label,
    });
    setStops([]);
    setSearchTarget('destination');
    setSearchOpen(true);
    if (!pickupKnown) void useCurrent();
  }
  const driverAvailableRef = useRef(true);
  const frequentOwner = useRef<string | null>(null);
  useEffect(() => {
    const owner = user?.id || null;
    frequentOwner.current = null;
    setFrequentSearches([]);
    if (!owner || role !== 'passenger') return;
    let cancelled = false;
    void AsyncStorage.getItem(`flash.searches.${owner}`).then((raw) => {
      if (cancelled) return;
      let saved: unknown = [];
      try {
        saved = JSON.parse(raw || '[]');
      } catch {}
      setFrequentSearches(
        Array.isArray(saved)
          ? saved
              .filter(
                (p) =>
                  typeof p?.query === 'string' &&
                  typeof p?.count === 'number' &&
                  typeof p?.lastUsed === 'number',
              )
              .slice(0, 20)
          : [],
      );
      frequentOwner.current = owner;
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, role]);
  async function rememberSearch(query: string) {
    if (!user?.id || role !== 'passenger' || frequentOwner.current !== user.id)
      return;
    const text = query.trim();
    if (text.length < 2) return;
    const old = frequentSearches.find(
      (p) => p.query.toLowerCase() === text.toLowerCase(),
    );
    const next = [
      ...frequentSearches.filter((p) => p !== old),
      { query: text, count: (old?.count || 0) + 1, lastUsed: Date.now() },
    ]
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      .slice(0, 20);
    setFrequentSearches(next);
    await AsyncStorage.setItem(
      `flash.searches.${user.id}`,
      JSON.stringify(next),
    );
  }
  const gpsSearchOrigin = useRef<Point | undefined>(undefined);
  const searchSession = useRef(uuid()),
    searchRevision = useRef(0);
  const bookingKey = useRef(uuid()),
    orderKey = useRef(uuid()),
    rideRef = useRef<any>(null),
    historyRef = useRef<any[]>([]),
    userRef = useRef<User | null>(null),
    profileRef = useRef<any>(null),
    offerIds = useRef(new Set<string>());
  rideRef.current = ride;
  historyRef.current = history;
  userRef.current = user;
  profileRef.current = profile;
  const navigationRequest = useRef({ key: '', at: 0 });
  const applicationHydrated = useRef<string | null>(null);
  useEffect(() => {
    const key = user?.id || user?.phone;
    if (!profile || !key || applicationHydrated.current === key) return;
    applicationHydrated.current = key;
    setPlate(profile.plate || '');
    setVehicleColor(profile.vehicle_color || '');
    setLicence(profile.licence_number || '');
    setExpiry(profile.licence_expiry?.slice(0, 10) || '');
    setDocs(profile.documents || {});
    setIdentityStarted(!!profile.persona_id);
  }, [user?.id, user?.phone, profile]);
  const mapHome = !!user && tab === 'home';
  const snap = (value: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(value);
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -25) snap(true);
        if (g.dy > 25) snap(false);
      },
    }),
  ).current;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const previewAccountKey = (number: string) =>
    `flash.preview.account.${role}.${number}`;
  async function saveUser(next: User) {
    const previous = userRef.current;
    setUser(next);
    if (preview) {
      await SecureStore.setItemAsync(
        `flash.demo.${role}`,
        JSON.stringify(next),
      );
      await AsyncStorage.setItem(
        previewAccountKey(next.phone),
        JSON.stringify(next),
      );
      if (previous && previous.phone !== next.phone)
        await AsyncStorage.removeItem(previewAccountKey(previous.phone));
    }
  }
  async function restorePreview(next: User, legacy = false) {
    const account = { ...next, id: next.id || uuid() };
    const suffix = legacy ? role : `${role}.${account.id}`;
    const keys = [
      `flash.history.${suffix}`,
      `flash.active.${suffix}`,
      `flash.profile.${suffix}`,
    ];
    const saved = await AsyncStorage.multiGet(keys);
    const currentHistory = JSON.parse(saved[0][1] || '[]');
    const localKeys = (await AsyncStorage.getAllKeys()).filter(
      (key) =>
        key.startsWith(`flash.history.${role}`) ||
        key.startsWith(`flash.active.${role}`),
    );
    const cached = await AsyncStorage.multiGet(localKeys);
    const recovered: any[] = [];
    for (const [, value] of cached) {
      try {
        const parsed = JSON.parse(value || 'null');
        recovered.push(
          ...(Array.isArray(parsed) ? parsed : [parsed]).filter((r) =>
            belongsToPreviewHistory(r, account, role),
          ),
        );
      } catch {
        /* Leave unreadable old caches intact. */
      }
    }
    const restored = mergeTripHistory(recovered, currentHistory);
    // Preserve source caches; explicitly write before migrating legacy keys.
    await AsyncStorage.setItem(
      `flash.history.${role}.${account.id}`,
      JSON.stringify(restored),
    );
    setHistory(restored);
    const active = JSON.parse(saved[1][1] || 'null');
    setRide(active && !terminal(active) ? active : null);
    const p = JSON.parse(saved[2][1] || 'null');
    setProfile(p);
    setCategory(p?.category || 'boda');
    await saveUser(account);
    // Legacy caches are retained as a recovery source, scoped by account on future reads.
  }
  const rememberRide = (next: any) => {
    if (terminal(next) && next)
      setHistory((h) => [
        {
          ...next,
          my_feedback:
            next.my_feedback ?? h.find((r) => r.id === next.id)?.my_feedback,
        },
        ...h.filter((r) => r.id !== next.id),
      ]);
    if (role === 'passenger' && next?.status === 'cancelled') {
      closedRideIds.current.add(next.id);
      setRide(null);
      setTab('home');
      setExpanded(false);
      setCancelOpen(false);
      setConfirmation(false);
      setReason('');
      setCancelCode('');
      if (
        next.cancel_reason_code === 'no_driver' ||
        next.cancel_reason === 'No driver available'
      )
        setUnavailableCategory(next.category);
      else {
        setRouteReady(false);
        setQuotes({});
        setDestination(null);
        setStops([]);
        setUnavailableCategory(null);
      }
      return;
    }
    if (!next || !closedRideIds.current.has(next.id)) setRide(next);
  };
  useEffect(() => {
    (async () => {
      try {
        const language = await SecureStore.getItemAsync('flash.language');
        setLang(language === 'en' ? 'en' : 'sw');
        if (preview) {
          const stored = await SecureStore.getItemAsync(`flash.demo.${role}`);
          if (stored) {
            const next = JSON.parse(stored);
            await restorePreview(next, !next.id);
          }
        } else if (await loadSession()) {
          const me = await api('/me');
          if (me.user.role !== role) throw new Error('Session expired');
          setUser(me.user);
          setProfile(me.driver);
          setIsFleetOwner(!!me.fleetOwner);
          if (!language && me.user.language) setLang(me.user.language);
          if (me.driver) setCategory(me.driver.category);
        }
      } catch (e) {
        setError(e);
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (ready && preview && user?.id) {
      void AsyncStorage.setItem(
        `flash.history.${role}.${user.id}`,
        JSON.stringify(history),
      );
      void AsyncStorage.setItem(
        `flash.active.${role}.${user.id}`,
        JSON.stringify(ride),
      );
      void AsyncStorage.setItem(
        `flash.profile.${role}.${user.id}`,
        JSON.stringify(profile),
      );
    }
  }, [ready, user?.id, history, ride, profile]);
  async function fetchRideDetail(id: string, status: string) {
    const key = id + ':' + status,
      now = Date.now();
    const navigation =
      navigationRequest.current.key !== key ||
      now - navigationRequest.current.at >= 60000;
    if (navigation) navigationRequest.current = { key, at: now };
    const next = await api(
      '/rides/' + id + (navigation ? '?navigation=1' : ''),
    );
    const previous = rideRef.current;
    if (!navigation && previous?.id === id && previous.status === next.status) {
      next.tripRoute = previous.tripRoute;
      if (
        next.driver?.latitude != null &&
        !next.driverLocationStale &&
        !next.etaUnavailable
      ) {
        next.navigationRoute = previous.navigationRoute;
        next.pickupRoute = previous.pickupRoute;
        next.arrivalEtaSeconds = previous.arrivalEtaSeconds;
        next.remainingSeconds = previous.remainingSeconds;
      }
    }
    return next;
  }
  const refresh = useCallback(async () => {
    if (preview || !userRef.current) return;
    const [rows, me] = await Promise.all([api('/rides'), api('/me')]);
    setHistory(rows);
    setProfile(me.driver);
    const active = rows.find((r: any) => !terminal(r));
    if (active && !closedRideIds.current.has(active.id))
      rememberRide(await fetchRideDetail(active.id, active.status));
    else if (rideRef.current && !terminal(rideRef.current))
      rememberRide(
        await fetchRideDetail(rideRef.current.id, rideRef.current.status),
      );
    if (role === 'driver' && me.driver) {
      setCategory(me.driver.category);
      setSubscription(await api('/subscriptions'));
      if (
        me.driver.approval === 'approved' &&
        me.driver.online &&
        driverAvailableRef.current
      )
        try {
          const incoming = await api('/offers');
          for (const offer of incoming) {
            if (!offerIds.current.has(offer.id)) {
              offerIds.current.add(offer.id);
              void ringOffer(languageRef.current).catch(() => {});
            }
          }
          setOffers(incoming);
        } catch {
          setOffers([]);
        }
    }
  }, [role]);
  useEffect(() => {
    if (!user || preview) return;
    void refresh().catch(setError);
    void registerNotifications(lang).catch(() => {});
    const socket = io(apiOrigin, {
      transports: ['websocket'],
      auth: { token: sessionToken() },
    });
    socket.on('ride:changed', () => void refresh().catch(setError));
    socket.on('chat:message', (event) => {
      if (event.message?.sender_id !== user.id)
        setRide((r: any) =>
          r?.id === event.rideId
            ? { ...r, chat_unread: (r.chat_unread || 0) + 1 }
            : r,
        );
    });

    socket.on('call:incoming', (event) => {
      if (Constants.executionEnvironment !== 'storeClient')
        setIncomingCall(event);
    });
    socket.on('call:ended', (event) => {
      setIncomingCall((c: any) => (c?.id === event.id ? null : c));
      setVoiceCall((c: any) => (c?.id === event.id ? null : c));
    });
    const callTimer = setInterval(() => {
      if (Constants.executionEnvironment !== 'storeClient' && !voiceRef.current)
        void api('/calls/incoming')
          .then(setIncomingCall)
          .catch(() => {});
    }, 5000);

    socket.on('ride:offer', (event) => {
      if (!driverAvailableRef.current) return;
      if (!offerIds.current.has(event.id)) {
        offerIds.current.add(event.id);
        void ringOffer(lang).catch(() => {});
      }
      void refresh().catch(setError);
    });
    socket.on('ride:location', (event) => {
      if (role === 'passenger')
        setRide((r: any) =>
          r?.id === event.id
            ? {
                ...r,
                driver: {
                  ...r.driver,
                  ...event.point,
                  location_at: event.recordedAt,
                },
                driverLocationStale: false,
              }
            : r,
        );
    });
    const timer = setInterval(
      () =>
        void refresh()
          .then(() => {
            socket.auth = { token: sessionToken() };
            if (!socket.connected) socket.connect();
          })
          .catch(() => {}),
      5000,
    );
    return () => {
      clearInterval(callTimer);
      clearInterval(timer);
      socket.disconnect();
    };
  }, [user?.id, user?.phone, refresh, lang]);
  useEffect(() => {
    if (user && tab === 'home' && !locationAttempted.current && !ride) {
      locationAttempted.current = true;
      void useCurrent();
    }
  }, [user?.id, user?.phone, tab]);
  async function position(): Promise<Point> {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') {
      setLocationGranted(false);
      throw new Error(t.locationRequired);
    }
    setLocationGranted(true);
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  }
  const [driverAvailable, setDriverAvailable] = useState(true);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  driverAvailableRef.current =
    driverAvailable &&
    !cargoOnly(category) &&
    (preview || profile?.approval === 'approved');
  useEffect(() => {
    if (role === 'driver' && cargoOnly(category)) {
      setDriverAvailable(false);
      setOffers([]);
    }
  }, [category, role]);
  useEffect(() => {
    setAvailabilityLoaded(false);
    if (!user?.id) return;
    let cancelled = false;
    void AsyncStorage.getItem(`flash.available.${user.id}`).then((value) => {
      if (!cancelled) {
        setDriverAvailable(value !== 'false');
        setAvailabilityLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  async function toggleAvailability() {
    if (cargoOnly(category)) {
      setDriverAvailable(false);
      return;
    }
    const online = !driverAvailable;
    if (!preview)
      await api(
        '/drivers/availability',
        { online, ...(online ? { location: await position() } : {}) },
        'PUT',
      );
    else
      await previewApi('/availability', {
        online,
        category,
        ...(online ? { point: await position() } : {}),
      });
    setDriverAvailable(online);
    setOffers([]);
    setProfile((p: any) => (p ? { ...p, online } : p));
    await AsyncStorage.setItem(`flash.available.${user!.id}`, String(online));
    if (!online) await configureTracking({ online: false, language: lang });
  }
  useEffect(() => {
    if (!preview || !user || !availabilityLoaded) return;
    let cancelled = false,
      working = false;
    let auth: { id: string; secret: string } | undefined;
    let lastPoint = 0,
      trackingReady = false;
    async function sync() {
      if (working || cancelled) return;
      working = true;
      try {
        if (!auth) {
          const session = await previewSession(
            { ...user!, id: user!.id! },
            role,
          );
          const recoverable = historyRef.current.filter((r) =>
            belongsToPreviewHistory(r, user!, role),
          );
          for (let index = 0; index < recoverable.length; index += 100)
            await previewApi('/history/restore', {
              rides: recoverable.slice(index, index + 100),
            }).catch(setError);
          auth = session;
          if (role === 'driver')
            void registerNotifications(lang, (token) =>
              previewApi('/device', { token }),
            ).catch(() => {});
        }
        if (role === 'driver') {
          let point: Point | undefined;
          if (driverAvailable && Date.now() - lastPoint >= 5000) {
            point = await position();
            lastPoint = Date.now();
          }
          if (cancelled) return;
          await previewApi('/availability', {
            online: driverAvailable && !cargoOnly(category),
            category,
            point,
            ...(profileRef.current?.vehicle_color
              ? { vehicleColor: profileRef.current.vehicle_color }
              : {}),
            ...(profileRef.current?.plate
              ? { plate: profileRef.current.plate }
              : {}),
          });
          if (cancelled) return;
          if (
            !trackingReady &&
            Constants.executionEnvironment !== 'storeClient'
          ) {
            await configureTracking({
              online: driverAvailable && !cargoOnly(category),
              language: lang,
              previewAuth: auth,
              category,
            });
            trackingReady = true;
          }
        }
        if (cancelled) return;
        const state = await previewApi('/state');
        if (cancelled) return;
        setOffers(state.offers);
        const completed = state.rides.filter((r: any) => terminal(r));
        if (completed.length)
          setHistory((old) => {
            const merged = mergeTripHistory(old, completed);
            return JSON.stringify(merged) === JSON.stringify(old)
              ? old
              : merged;
          });
        for (const offer of state.offers)
          if (!offerIds.current.has(offer.id)) {
            offerIds.current.add(offer.id);
            void ringOffer(lang).catch(() => {});
          }
        const active = state.rides.find((r: any) => !terminal(r));
        const previous = rideRef.current;
        const next =
          active || state.rides.find((r: any) => r.id === previous?.id);
        if (next) {
          if (terminal(next)) {
            if (previous?.status !== next.status) rememberRide(next);
          } else if (!closedRideIds.current.has(next.id))
            setRide((old: any) => ({ ...old, ...next }));
        } else if (previous && !terminal(previous)) setRide(null);
      } catch (e) {
        if (String(e).includes('Session expired')) auth = undefined;
        if (!cancelled) setError(e);
      } finally {
        working = false;
      }
    }
    void sync();
    const timer = setInterval(() => void sync(), 2000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      listener.remove();
    };
  }, [user?.id, preview, availabilityLoaded, driverAvailable, category, lang]);
  const autoOnline = useCallback(async () => {
    if (
      preview ||
      role !== 'driver' ||
      !userRef.current ||
      !availabilityLoaded ||
      !driverAvailable
    )
      return;
    const p = profileRef.current;
    if (p?.approval !== 'approved') return;
    try {
      const location = await position();
      if (!driverAvailableRef.current) return;
      await api('/drivers/availability', { online: true, location }, 'PUT');
      setProfile((current: any) =>
        current ? { ...current, online: true } : current,
      );
    } catch (e) {
      setError(e);
    }
  }, [role, availabilityLoaded, driverAvailable]);
  useEffect(() => {
    if (!user || role !== 'driver') return;
    void autoOnline();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void autoOnline();
    });
    return () => listener.remove();
  }, [
    user?.phone,
    profile?.approval,
    profile?.paid_until,
    profile?.trial_ends_at,
    autoOnline,
  ]);
  useEffect(() => {
    if (!user || role !== 'driver' || preview) return;
    const active = !terminal(ride);
    void configureTracking({
      online: profile?.approval === 'approved' && !!profile?.online,
      language: lang,
      rideId: active ? ride.id : undefined,
    }).catch(setError);
  }, [
    user?.phone,
    profile?.approval,
    profile?.online,
    ride?.id,
    ride?.status,
    lang,
  ]);
  useEffect(() => {
    if (preview || !user) return;
    if (role === 'passenger' && (terminal(ride) || ride.status === 'requested'))
      return;
    if (role === 'driver' && terminal(ride) && !profile?.online) return;
    let watcher: Location.LocationSubscription | undefined,
      cancelled = false;
    if (role === 'driver' && Constants.executionEnvironment !== 'storeClient')
      return;
    if (role === 'passenger' && ride.status === 'in_progress') return;
    const id = ride?.id;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          if (
            cancelled ||
            (location.coords.accuracy != null && location.coords.accuracy > 75)
          )
            return;
          const point = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          if (role === 'driver')
            void enqueueLocation(point, location.timestamp).catch(() => {});
          else
            void api(`/rides/${id}/location`, {
              point,
              recordedAt: new Date(location.timestamp).toISOString(),
              eventId: uuid(),
            }).catch(() => {});
        },
      );
      if (cancelled) watcher.remove();
    })();
    return () => {
      cancelled = true;
      watcher?.remove();
    };
  }, [user?.phone, profile?.online, ride?.id, ride?.status]);
  useEffect(() => {
    if (!preview || role !== 'driver' || !user || terminal(ride)) return;
    let stopped = false,
      watcher: Location.LocationSubscription | undefined;
    const id = ride.id,
      status = ride.status;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      setLocationGranted(true);
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          if (
            stopped ||
            (location.coords.accuracy != null && location.coords.accuracy > 75)
          )
            return;
          const point = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setRide((r: any) =>
            r?.id === id
              ? {
                  ...r,
                  driver: { ...r.driver, ...point },
                  driverLocationStale: false,
                }
              : r,
          );
          const key = 'preview:' + id + ':' + status,
            now = Date.now();
          if (
            navigationRequest.current.key === key &&
            now - navigationRequest.current.at < 60000
          )
            return;
          navigationRequest.current = { key, at: now };
          const pickup = {
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            },
            destination = { latitude: ride.dest_lat, longitude: ride.dest_lng };
          void Promise.allSettled([
            api('/maps/route', {
              pickup,
              destination,
              stops: ride.stops || [],
            }),
            status === 'arrived'
              ? Promise.resolve(undefined)
              : api('/maps/route', {
                  pickup: point,
                  destination: status === 'in_progress' ? destination : pickup,
                  stops: status === 'in_progress' ? ride.stops || [] : [],
                }),
          ])
            .then(([trip, leg]) => {
              if (stopped) return;
              setRide((r: any) => {
                if (r?.id !== id || r.status !== status) return r;
                const next = { ...r };
                if (trip.status === 'fulfilled') {
                  next.tripRoute = trip.value;
                  next.estimate = {
                    route: trip.value,
                    fare: fare(
                      tariffs[r.category as RideCategory],
                      trip.value.meters,
                      trip.value.seconds,
                    ),
                  };
                }
                if (leg.status === 'fulfilled' && leg.value) {
                  next.navigationRoute = leg.value.coordinates;
                  if (status === 'accepted') {
                    next.pickupRoute = leg.value;
                    next.arrivalEtaSeconds = leg.value.seconds;
                  } else next.remainingSeconds = leg.value.seconds;
                }
                return next;
              });
              if (trip.status === 'rejected') setError(trip.reason);
            })
            .catch((e) => {
              if (!stopped) setError(e);
            });
        },
      );
      if (stopped) watcher.remove();
    })().catch((e) => {
      if (!stopped) setError(e);
    });
    return () => {
      stopped = true;
      watcher?.remove();
    };
  }, [user?.id, user?.phone, ride?.id, ride?.status]);
  useEffect(() => {
    setResults([]);
    setLimitedSearch(false);
    if (!searchOpen || search.trim().length < 2) {
      setSearchingPlaces(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setSearchingPlaces(true);
    const timer = setTimeout(() => {
      void findRealPlaces(
        search,
        lang,
        searchSession.current,
        searchTarget === 'pickup'
          ? gpsSearchOrigin.current
          : pickupKnown
            ? pickup
            : gpsSearchOrigin.current,
        controller.signal,
      )
        .then((rows) => {
          if (!cancelled) {
            setResults(rows.places);
            setLimitedSearch(rows.limited);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e);
        })
        .finally(() => {
          if (!cancelled) setSearchingPlaces(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    search,
    searchOpen,
    searchTarget,
    lang,
    pickupKnown,
    pickup.latitude,
    pickup.longitude,
  ]);
  async function changeLanguage(next: Language) {
    setLang(next);
    await SecureStore.setItemAsync('flash.language', next);
    if (user && !preview) await api('/me/language', { language: next }, 'PUT');
  }
  async function auth() {
    phoneSchema.parse(phone);
    if (!authSent) {
      const response = preview
        ? { demoCode: '123456' }
        : await api('/auth/otp', { phone });
      setAuthSent(true);
      setOtpHint(response.demoCode || '');
      return;
    }
    if (preview) {
      registrationSchema.parse({ fullName: name, email, role });
      if (otp !== '123456') throw new Error('Invalid or expired code');
      const existing = await AsyncStorage.getItem(previewAccountKey(phone));
      await restorePreview(
        existing
          ? JSON.parse(existing)
          : { id: uuid(), full_name: name, phone, email, role },
      );
    } else {
      const result = await api('/auth/verify', {
        phone,
        code: otp,
        deviceName: `${Platform.OS === 'ios' ? 'iPhone / iPad' : 'Android'} (${Platform.Version})`,
        registration: {
          fullName: name,
          email,
          role,
          marketingConsent: marketing,
        },
      });
      if (result.user.role !== role) throw new Error('Session expired');
      await saveSession(result);
      await saveUser(result.user);
    }
    setOtpHint('');
    setNotice(null);
  }
  async function useCurrent() {
    pickupManuallyChanged.current = false;
    setLocating(true);
    try {
      const point = await position();
      gpsSearchOrigin.current = point;
      const label = await reverseAddress(point);
      if (!pickupManuallyChanged.current) {
        setPickupKnown(true);
        setDrafts((rows) => ({ ...rows, pickup: label }));
        setPickup({
          ...point,
          label,
          current: false,
        });
      }
      setRouteReady(false);
    } catch (e) {
      setError(e);
      setNotice('locationFailed');
    } finally {
      setLocating(false);
    }
  }
  async function openSearch(query = '') {
    searchRevision.current++;
    searchSession.current = uuid();
    setError('');
    setDrafts({
      pickup: pickupKnown ? pickup.label : '',
      destination: destination?.label || '',
      ...Object.fromEntries(
        stops.map((p, i) => [i, p.placeholder ? '' : p.label]),
      ),
    });
    if (query) {
      setDrafts((rows) => ({ ...rows, destination: query }));
      setDestination(null);
      setQuotes({});
      setRouteReady(false);
    }
    setSearchOpen(true);
    setSearchTarget('destination');
    setSearch(query);
    setResults([]);
    if (!locationAttempted.current) {
      locationAttempted.current = true;
      await useCurrent();
    }
  }
  function editPlace(target: 'pickup' | 'destination' | number, text: string) {
    searchRevision.current++;
    setSearchTarget(target);
    setDrafts((rows) => ({ ...rows, [target]: text }));
    setSearch(text);
    setError('');
    setResults([]);
    setQuotes({});
    setRouteReady(false);
    if (target === 'pickup') {
      pickupManuallyChanged.current = true;
      setPickupKnown(false);
    } else if (target === 'destination') setDestination(null);
    else
      setStops((rows) =>
        rows.map((p, i) => (i === target ? { ...p, placeholder: true } : p)),
      );
  }
  async function chooseSuggestion(suggestion: PlaceSuggestion) {
    const revision = searchRevision.current;
    setSelectingPlace(true);
    setError('');
    try {
      const place = await resolvePlace(suggestion, lang, searchSession.current);
      if (revision !== searchRevision.current) return;
      const searchedQuery = suggestion.label;
      selectPlace(place);
      searchSession.current = uuid();
      void rememberSearch(searchedQuery).catch(() => {});
    } catch (e) {
      if (revision === searchRevision.current) setError(e);
    } finally {
      setSelectingPlace(false);
    }
  }
  function focusPlace(target: 'pickup' | 'destination' | number) {
    searchRevision.current++;
    setSearchTarget(target);
    const selected =
      target === 'pickup'
        ? pickupKnown
        : target === 'destination'
          ? !!destination
          : !stops[target]?.placeholder;
    setSearch(selected ? '' : drafts[target] || '');
    setResults([]);
    setError('');
  }
  function selectPlace(place: Place) {
    setDrafts((rows) => ({ ...rows, [searchTarget]: place.label }));
    if (searchTarget === 'pickup') {
      pickupManuallyChanged.current = true;
      setPickupKnown(true);
      setPickup(place);
    } else if (searchTarget === 'destination') setDestination(place);
    else
      setStops((rows) =>
        rows.map((p, i) =>
          i === searchTarget ? { ...place, placeholder: false } : p,
        ),
      );
    setQuotes({});
    setRouteReady(false);
    setSearch('');
  }
  async function calculateQuotes(kind: ServiceKind = serviceKind) {
    if (!destination) throw new Error(t.destination);
    const body = {
      pickup,
      destination,
      pickupLabel: pickup.label,
      destinationLabel: destination.label,
      stops,
    };
    if (!pickupKnown) throw new Error(t.locationRequired);
    let entries;
    if (preview || kind === 'delivery') {
      const routed = await api('/maps/route', { pickup, destination, stops });
      if (routed.simulated) throw new Error(t.mapsUnavailable);
      entries = (kind === 'ride' ? rideCategories : categories).map((c) => [
        c,
        {
          fare:
            kind === 'delivery'
              ? null
              : fare(tariffs[c as RideCategory], routed.meters, routed.seconds),
          route: routed,
        },
      ]);
    } else
      entries = await Promise.all(
        rideCategories.map(async (c) => [
          c,
          await api('/estimates', {
            ...body,
            category: c,
            serviceKind: 'ride',
          }),
        ]),
      );
    setQuotes(Object.fromEntries(entries));
    setRouteReady(true);
    setExpanded(false);
    setUnavailableCategory(null);
    setSearchOpen(false);
  }
  async function request() {
    if (serviceKind === 'delivery')
      throw new Error(
        lang === 'sw'
          ? 'Bei za usafirishaji bado hazijawekwa.'
          : 'Delivery pricing is not configured yet.',
      );
    if (!destination) return;
    setUnavailableCategory(null);
    const body = {
      pickup,
      destination,
      pickupLabel: pickup.label,
      destinationLabel: destination.label,
      stops,
      category,
      serviceKind,
    };
    if (preview)
      setRide(
        await previewApi('/rides', {
          ...body,
          id: bookingKey.current,
          estimate: quotes[category],
        }),
      );
    else {
      const r = await book(body, bookingKey.current);
      setRide(await api('/rides/' + r.id));
    }
    bookingKey.current = uuid();
    setConfirmation(false);
    setExpanded(false);
  }
  async function accept(offer: any) {
    if (preview) setRide(await previewApi(`/rides/${offer.id}/accept`, {}));
    else {
      await api(`/rides/${offer.id}/accept`, {});
      setRide(await api('/rides/' + offer.id));
    }
    setOffers([]);
  }
  async function transition(action: string) {
    const passengerCancelling = action === 'cancel' && role === 'passenger';
    const reasonCode = passengerCancelling ? cancelCode : undefined;
    if (
      action === 'cancel' &&
      ((passengerCancelling && !cancelCode) ||
        ((!passengerCancelling || cancelCode === 'other') &&
          reason.trim().length < 3))
    )
      throw new Error(t.reasonRequired);
    if (preview) {
      rememberRide(
        await previewApi(`/rides/${ride.id}/${action}`, {
          reason: reason || undefined,
          reasonCode,
          payment,
        }),
      );
      setCancelOpen(false);
      return;
    }
    const location = ['arrive', 'start', 'complete'].includes(action)
      ? await position()
      : undefined;
    await api(`/rides/${ride.id}/transition`, {
      action,
      location,
      reason: reason || undefined,
      reasonCode,
      paymentMethod: payment,
    });
    const next = await api('/rides/' + ride.id);
    rememberRide(next);
    setCancelOpen(false);
  }
  useEffect(() => {
    if (!user || preview) return;
    return listenForChatNotifications((id) => {
      void api('/rides/' + id)
        .then((detail) => {
          if (detail.driver_id)
            setChatRide({
              id: detail.id,
              contact: role === 'passenger' ? detail.driver : detail.passenger,
            });
        })
        .catch(() => {});
    });
  }, [user?.id, role]);
  async function callContact(contact: any, rideId = ride?.id) {
    Keyboard.dismiss();
    setCallTarget({ contact, rideId });
  }
  async function endVoiceCall() {
    const current = voiceRef.current;
    setVoiceCall(null);
    setIncomingCall(null);
    if (current) {
      voiceRef.current = null;
      await api(`/calls/${current.id}/end`, {});
    }
  }
  async function startVoiceCall(rideId: string, incomingId?: string) {
    if (preview || Constants.executionEnvironment === 'storeClient') {
      Alert.alert(
        lang === 'sw' ? 'Simu ndani ya programu' : 'In-app call',
        lang === 'sw'
          ? 'Simu ndani ya programu inahitaji toleo la Nexadrop lililosakinishwa na huduma ya simu iliyosanidiwa. Unaweza kupiga kwa simu ya kawaida.'
          : 'In-app calls require an installed Nexadrop development build and a configured voice service. You can call by phone instead.',
      );
      return;
    }
    try {
      const connected = await api(
        incomingId ? `/calls/${incomingId}/join` : `/rides/${rideId}/calls`,
        {},
      );
      setIncomingCall(null);
      setCallTarget(null);
      setVoiceCall(connected);
    } catch {
      Alert.alert(
        lang === 'sw' ? 'Simu haipatikani' : 'Call unavailable',
        lang === 'sw'
          ? 'Imeshindikana kuanza simu ndani ya programu. Jaribu kupiga kwa simu ya kawaida.'
          : 'Could not start the in-app call. Please try calling by phone.',
      );
    }
  }

  function beginEdit() {
    setEditName(user!.full_name);
    setEditPhone(user!.phone);
    setEditEmail(user!.email);
    setEditing(true);
    setPhoneCode('');
    setOtpHint('');
  }
  async function finishEdit() {
    const valid = registrationSchema
      .pick({ fullName: true, email: true })
      .safeParse({ fullName: editName, email: editEmail });
    if (!valid.success || !phoneSchema.safeParse(editPhone).success)
      throw new Error(t.invalidDetails);
    if (editPhone !== user!.phone && !phoneVerify) {
      if (preview) {
        const existing = await AsyncStorage.getItem(
          previewAccountKey(editPhone),
        );
        if (existing && JSON.parse(existing).id !== user!.id)
          throw new Error('Phone number already registered');
      }
      const result = preview
        ? { demoCode: '123456' }
        : await api('/me/phone/otp', { phone: editPhone });
      setOtpHint(result.demoCode || '');
      setPhoneVerify(true);
      return;
    }
    let next: User;
    if (phoneVerify) {
      if (preview) {
        if (phoneCode !== '123456') throw new Error('Invalid or expired code');
      } else
        await api('/me/phone/verify', { phone: editPhone, code: phoneCode });
    }
    if (preview)
      next = {
        ...user!,
        full_name: editName,
        phone: editPhone,
        email: editEmail,
      };
    else
      next = (await api('/me', { fullName: editName, email: editEmail }, 'PUT'))
        .user;
    await saveUser(next);
    setEditing(false);
    setPhoneVerify(false);
    setOtpHint('');
    setNotice('saved');
  }
  async function photo(key: string, camera: boolean) {
    let result: ImagePicker.ImagePickerResult;
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') throw new Error(t.cameraPermission);
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.6,
      });
    } else
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.6,
      });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (preview) setDocs((d) => ({ ...d, [key]: asset.uri }));
    else {
      const image = await api('/uploads', {
        mime: asset.base64?.startsWith('iVBOR')
          ? 'image/png'
          : asset.base64?.startsWith('/9j/')
            ? 'image/jpeg'
            : asset.mimeType || 'image/jpeg',
        base64: asset.base64,
      });
      setDocs((d) => ({ ...d, [key]: image.id }));
    }
  }
  function application() {
    if (
      !plate.trim() ||
      vehicleColor.trim().length < 2 ||
      !licence.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
      new Date(expiry).getTime() <= Date.now()
    )
      throw new Error(t.invalidVehicle);
    if (photoKeys.some((k) => !docs[k])) throw new Error(t.photoRequired);
    return {
      category,
      plate,
      vehicleColor: vehicleColor.trim(),
      licenceNumber: licence,
      licenceExpiry: expiry,
      ...docs,
    };
  }
  async function identity() {
    const body = application();
    if (preview) {
      setIdentityStarted(true);
      setNotice('previewIdentity');
      return;
    }
    await api('/drivers/application/draft', body, 'PUT');
    const result = await api('/drivers/identity', {});
    setIdentityStarted(true);
    if (result.url) {
      await Linking.openURL(result.url);
      setNotice('personaStarted');
    } else setNotice('identityPending');
  }
  async function submitApplication() {
    const body = application();
    if (!identityStarted) throw new Error(t.identityRequired);
    if (preview)
      setProfile({
        category,
        plate,
        vehicle_color: vehicleColor.trim(),
        licence_number: licence,
        licence_expiry: expiry,
        documents: docs,
        submitted_at: new Date().toISOString(),
        approval: 'pending',
        identity_status: 'manual_review',
      });
    else {
      await api('/drivers/application', body);
      await refresh();
    }
    setVerificationOpen(false);
    setNotice('applicationSent');
  }
  async function removeAccount(kind: 'deactivate' | 'delete') {
    if (ride && !terminal(ride)) throw new Error(accountWords[lang].active);
    if (!preview) {
      if (kind === 'delete') await api('/me', undefined, 'DELETE');
      else await api('/me/deactivate', {});
    } else if (user?.id) {
      if (role === 'driver')
        await previewApi('/availability', { online: false, category });
      if (kind === 'delete')
        await AsyncStorage.multiRemove([
          previewAccountKey(user.phone),
          `flash.history.${role}.${user.id}`,
          `flash.active.${role}.${user.id}`,
          `flash.profile.${role}.${user.id}`,
        ]);
    }
    if (role === 'driver') await configureTracking({ online: false });
    await saveSession(null);
    await SecureStore.deleteItemAsync(`flash.demo.${role}`);
    setCallTarget(null);
    setIncomingCall(null);
    setVoiceCall(null);
    setChatRide(null);
    setUser(null);
    setRide(null);
    setOffers([]);
    setHistory([]);
    setProfile(null);
    setSettingsOpen(false);
    setAuthSent(false);
    setTab('home');
  }
  async function logout() {
    if (preview && role === 'driver') {
      await previewApi('/availability', { online: false, category });
      await configureTracking({ online: false, language: lang });
    }
    if (!preview) {
      if (role === 'driver') {
        await configureTracking({ online: false });
        try {
          await api('/drivers/availability', { online: false }, 'PUT');
        } catch {}
      }
      await api('/auth/logout', {});
    }
    await saveSession(null);
    await SecureStore.deleteItemAsync(`flash.demo.${role}`);
    setCallTarget(null);
    setIncomingCall(null);
    setVoiceCall(null);
    setChatRide(null);
    setUser(null);
    setRide(null);
    setOffers([]);
    setHistory([]);
    setProfile(null);
    applicationHydrated.current = null;
    setDocs({});
    setPlate('');
    setVehicleColor('');
    closedRideIds.current.clear();
    setUnavailableCategory(null);
    setLicence('');
    setExpiry('');
    setVerificationOpen(false);
    setIdentityStarted(false);
    setAuthSent(false);
    setTab('home');
  }
  async function feedback(report = false) {
    if (report && !comment.trim()) throw new Error(t.comment);
    if (!preview)
      await api(`/rides/${ride.id}/feedback`, { stars, comment, report });
    setNotice(report ? 'reportSent' : 'thanks');
    if (!report) {
      const updated = { ...ride, my_feedback: { stars, comment } };
      if (preview)
        void previewApi('/history/restore', { rides: [updated] }).catch(
          () => {},
        );
      setHistory((rows) => [updated, ...rows.filter((r) => r.id !== ride.id)]);
      setRide(null);
    }
  }
  async function share() {
    if (preview) {
      setNotice('sharePreview');
      return;
    }
    const result = await api(`/rides/${ride.id}/share`, {});
    await Share.share({ message: result.url });
  }
  const googleOverlay = supportsGoogleMap(
    Platform.OS,
    Constants.executionEnvironment,
    !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY,
  );
  const selectedQuote = quotes[category];
  const active = !terminal(ride);
  const verificationNeeded =
    (!profile?.submitted_at || profile?.approval === 'rejected') &&
    profile?.standalone !== false &&
    !(isFleetOwner && !profile);
  const vehicleLabel = (c: Category) => t[c];
  const placeLabel = (p: Place) =>
    p.current ? t.current : p.placeholder ? t.stop : p.label;
  const openDirections = () => {
    const approaching =
      active &&
      ['accepted', 'arrived'].includes(ride.status) &&
      ride.driver?.latitude != null;
    return Linking.openURL(
      googleDirectionsUrl(
        approaching
          ? { latitude: ride.driver.latitude, longitude: ride.driver.longitude }
          : active
            ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
            : pickup,
        approaching
          ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
          : active
            ? { latitude: ride.dest_lat, longitude: ride.dest_lng }
            : destination || pickup,
        approaching ? [] : active ? ride.stops || [] : stops,
      ),
    );
  };
  const compatibilityNotice = () =>
    role === 'driver' && !googleOverlay ? (
      <View style={{ gap: 8 }}>
        <Text style={s.small}>{t.nativeGoogleRequired}</Text>
        <Button
          title={t.openGoogleRoute}
          secondary
          onPress={() =>
            void run(async () => {
              await openDirections();
            })
          }
        />
      </View>
    ) : null;
  const chatButton = () =>
    ride?.driver_id &&
    ['accepted', 'arrived', 'in_progress'].includes(ride.status) ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${lang === 'sw' ? 'Ujumbe' : 'Chat'}${ride.chat_unread ? ` (${ride.chat_unread})` : ''}`}
        onPress={() =>
          setChatRide({
            id: ride.id,
            contact: role === 'passenger' ? ride.driver : ride.passenger,
          })
        }
        style={s.callButton}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={23}
          color={colors.blue}
        />
        {!!ride.chat_unread && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 19,
              height: 19,
              paddingHorizontal: 4,
              borderRadius: 10,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: colors.onPrimary,
                fontWeight: '700',
              }}
            >
              {ride.chat_unread > 99 ? '99+' : ride.chat_unread}
            </Text>
          </View>
        )}
      </Pressable>
    ) : null;
  const routeSummary = (r: any) => (
    <View style={{ gap: 10 }}>
      <Text style={s.bold}>{r.pickup_label}</Text>
      {(r.stops || []).map((p: Place, i: number) => (
        <Text key={i} style={s.small}>
          {t.stop} {i + 1} · {p.label}
        </Text>
      ))}
      <Text style={s.bold}>{r.destination_label}</Text>
      <CargoSummary cargo={r.cargo} language={lang} />
    </View>
  );
  if (!ready)
    return (
      <SafeAreaView style={s.center}>
        <BrandMark size={90} />
        <ActivityIndicator color={colors.blue} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.root}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {!mapHome && (
        <View style={s.header}>
          <View
            style={{ width: 106, alignItems: 'flex-start' }}
            accessible
            accessibilityLabel="Nexadrop"
          >
            <BrandMark size={44} />
          </View>
          {!!user && (
            <Text
              style={[
                s.heading,
                { flex: 1, textAlign: 'center', fontSize: 23, lineHeight: 29 },
              ]}
            >
              {tab === 'trips'
                ? historyDetail
                  ? lang === 'sw'
                    ? 'Maelezo ya safari'
                    : 'Trip details'
                  : lang === 'sw'
                    ? 'Safari zilizopita'
                    : 'Trip history'
                : tab === 'account'
                  ? settingsOpen
                    ? accountWords[lang].settings
                    : t.account
                  : tab === 'fleet'
                    ? t.fleet
                    : tab === 'towing'
                      ? t.towing
                      : ''}
            </Text>
          )}
          <Pressable
            accessibilityLabel={t.language}
            onPress={() => void changeLanguage(lang === 'sw' ? 'en' : 'sw')}
            style={[s.language, { width: 44, alignItems: 'center' }]}
          >
            <Text style={s.bold}>{lang === 'sw' ? 'EN' : 'SW'}</Text>
          </Pressable>
        </View>
      )}
      <Modal
        visible={!!callTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setCallTarget(null)}
      >
        <Pressable style={s.modalScrim} onPress={() => setCallTarget(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.heading}>
              {callTarget?.contact?.full_name || t.callDriver}
            </Text>
            <Button
              title={lang === 'sw' ? 'Piga kwa simu' : 'Call by phone'}
              disabled={
                !phoneSchema.safeParse(callTarget?.contact?.phone).success
              }
              secondary
              onPress={() =>
                void run(async () => {
                  const phone = callTarget?.contact?.phone;
                  if (!phoneSchema.safeParse(phone).success) {
                    setNotice('unavailable');
                    return;
                  }
                  setCallTarget(null);
                  await Linking.openURL('tel:' + phone);
                })
              }
            />
            <Button
              title={lang === 'sw' ? 'Piga ndani ya programu' : 'Call in app'}
              onPress={() => void run(() => startVoiceCall(callTarget?.rideId))}
            />
            <Button
              title={t.cancelChoice}
              secondary
              onPress={() => setCallTarget(null)}
            />
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={!!incomingCall && !voiceCall}
        transparent
        onRequestClose={() => setIncomingCall(null)}
      >
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <Text style={s.heading}>{incomingCall?.caller_name}</Text>
            <Text>{lang === 'sw' ? 'Simu inayoingia' : 'Incoming call'}</Text>
            <Button
              title={lang === 'sw' ? 'Jibu' : 'Answer'}
              onPress={() =>
                void run(() =>
                  startVoiceCall(incomingCall.ride_id, incomingCall.id),
                )
              }
            />
            <Button
              title={lang === 'sw' ? 'Kataa' : 'Decline'}
              danger
              onPress={() =>
                void run(async () => {
                  const id = incomingCall.id;
                  setIncomingCall(null);
                  await api(`/calls/${id}/end`, {});
                })
              }
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!voiceCall}
        onRequestClose={() => void run(endVoiceCall)}
      >
        <SafeAreaView
          style={[s.center, { flex: 1, backgroundColor: colors.background }]}
        >
          {voiceCall &&
            React.createElement(require('./VoiceCall').VoiceCall, {
              call: voiceCall,
              lang,
              end: () => void run(endVoiceCall),
            })}
        </SafeAreaView>
      </Modal>
      {!!chatRide && !!user?.id && (
        <RideChat
          key={chatRide.id}
          rideId={chatRide.id}
          userId={user.id}
          contact={chatRide.contact}
          language={lang}
          focused={!callTarget && !voiceCall && !incomingCall}
          close={() => setChatRide(null)}
          call={() => void callContact(chatRide.contact, chatRide.id)}
          onRead={() =>
            setRide((r: any) =>
              r?.id === chatRide.id ? { ...r, chat_unread: 0 } : r,
            )
          }
        />
      )}
      <View style={s.screenBody}>
        {mapHome && (
          <>
            <View style={StyleSheet.absoluteFill}>
              <LiveMap
                fullscreen
                tripSummary={
                  role === 'passenger' && routeReady && !active
                    ? selectedQuote?.route
                    : undefined
                }
                showPickup={active || pickupKnown}
                locationGranted={locationGranted}
                bottomInset={Math.min(
                  height *
                    (expanded
                      ? 0.83
                      : role === 'passenger' && !ride
                        ? routeReady
                          ? 0.48
                          : 0.4
                        : 0.57),
                  expanded ? 850 : 520,
                )}
                tripRouteCoordinates={
                  active
                    ? ride.tripRoute?.coordinates ||
                      ride.estimate?.route?.coordinates ||
                      selectedQuote?.route?.coordinates ||
                      []
                    : selectedQuote?.route?.coordinates || []
                }
                pickupRouteCoordinates={
                  active
                    ? ride.pickupRoute?.coordinates ||
                      (['accepted', 'arrived'].includes(ride.status)
                        ? ride.navigationRoute
                        : []) ||
                      []
                    : []
                }
                approaching={
                  active && ['accepted', 'arrived'].includes(ride.status)
                }
                routeCoordinates={
                  ride?.navigationRoute ||
                  ride?.estimate?.route?.coordinates ||
                  selectedQuote?.route?.coordinates ||
                  []
                }
                language={lang}
                pickup={
                  active
                    ? { latitude: ride.pickup_lat, longitude: ride.pickup_lng }
                    : pickup
                }
                destination={
                  active
                    ? { latitude: ride.dest_lat, longitude: ride.dest_lng }
                    : destination || pickup
                }
                stops={active ? ride.stops : stops}
                driver={
                  ride?.driver?.latitude
                    ? {
                        latitude: ride.driver.latitude,
                        longitude: ride.driver.longitude,
                      }
                    : undefined
                }
              />
            </View>
            <View style={s.mapToolbar}>
              <View style={s.brandPill}>
                <BrandMark size={32} />
              </View>
              <Pressable
                accessibilityLabel={t.account}
                onPress={() => setTab('account')}
                style={s.mapAvatar}
              >
                <Ionicons name="person-outline" size={22} color={colors.navy} />
              </Pressable>
            </View>
            {role === 'passenger' && !active && (
              <Pressable
                accessibilityRole="search"
                accessibilityLabel={t.destination}
                onPress={() => void openSearch()}
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  top: 76,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 17,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  elevation: 4,
                }}
              >
                <Ionicons name="search" size={23} color={colors.blue} />
                <Text numberOfLines={1} style={[s.bold, { flex: 1 }]}>
                  {routeReady && destination
                    ? `${placeLabel(pickup).split(',')[0]} → ${placeLabel(destination).split(',')[0]}`
                    : destination
                      ? placeLabel(destination)
                      : t.where}
                </Text>
              </Pressable>
            )}
          </>
        )}
        <KeyboardAvoidingView
          pointerEvents="box-none"
          style={[s.screenBody, mapHome && s.sheetDock]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={
              mapHome
                ? [
                    s.mobileSheet,
                    {
                      height: Math.min(
                        height *
                          (expanded
                            ? 0.83
                            : role === 'passenger' && !routeReady && !ride
                              ? 0.4
                              : 0.57),
                        expanded ? 850 : 520,
                      ),
                    },
                  ]
                : s.screenBody
            }
          >
            {mapHome && (
              <View {...pan.panHandlers} style={s.handleArea}>
                <Pressable
                  accessibilityLabel={t.details}
                  onPress={() => snap(!expanded)}
                  hitSlop={12}
                >
                  <View style={s.sheetHandle} />
                </Pressable>
              </View>
            )}
            <ScrollView
              style={s.screenBody}
              contentContainerStyle={[s.content, mapHome && s.sheetContent]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!!error && (
                <Text accessibilityRole="alert" style={s.error}>
                  {localizeError(error, lang)}
                </Text>
              )}
              {notice && <Text style={s.notice}>{t[notice]}</Text>}
              {!user ? (
                <>
                  <Text style={s.eyebrow}>
                    {role === 'driver' ? t.driver : t.passenger}
                  </Text>
                  <Text style={s.title}>{t.welcome}</Text>
                  <Text style={s.subtitle}>
                    {role === 'driver' ? t.noCommission : t.tagline}
                  </Text>
                  <View style={s.authForm}>
                    <Field label={t.name} value={name} onChange={setName} />
                    <Field
                      label={t.phone}
                      value={phone}
                      onChange={setPhone}
                      keyboard="phone-pad"
                    />
                    <Field
                      label={t.email}
                      value={email}
                      onChange={setEmail}
                      keyboard="email-address"
                    />
                    <View style={s.row}>
                      <Switch
                        value={marketing}
                        onValueChange={setMarketing}
                        trackColor={{
                          false: colors.border,
                          true: colors.primary,
                        }}
                        thumbColor={colors.onPrimary}
                      />
                      <Text style={[s.small, { flex: 1 }]}>{t.marketing}</Text>
                    </View>
                    {authSent && (
                      <>
                        <Field
                          label={t.otp}
                          value={otp}
                          onChange={setOtp}
                          keyboard="number-pad"
                        />
                        {!!otpHint && (
                          <Text style={s.small}>
                            {t.demoOtp}: {otpHint}
                          </Text>
                        )}
                      </>
                    )}
                    <Button
                      disabled={busy}
                      title={authSent ? t.verify : t.continue}
                      onPress={() => void run(auth)}
                    />
                  </View>
                  <Text style={s.small}>{t.company}</Text>
                </>
              ) : (
                <>
                  {tab === 'home' && (
                    <>
                      {!ride ? (
                        <>
                          <View style={s.sheetHeading}>
                            <Text style={s.welcomeLine}>
                              {t.hello}, {user.full_name.split(' ')[0]}
                            </Text>
                            <Text style={s.sheetTitle}>
                              {role === 'driver'
                                ? t.driverReady
                                : routeReady
                                  ? t.chooseRide
                                  : t.where}
                            </Text>
                          </View>
                          {role === 'passenger' ? (
                            <>
                              {unavailableCategory && (
                                <View style={s.card}>
                                  <Text style={s.heading}>
                                    {t.noDriverFound}
                                  </Text>
                                  <Text style={s.small}>
                                    {t.categoryUnavailable.replace(
                                      '{category}',
                                      vehicleLabel(unavailableCategory),
                                    )}
                                  </Text>
                                  <Button
                                    secondary
                                    title={t.chooseAnother}
                                    onPress={() => {
                                      setUnavailableCategory(null);
                                      if (!routeReady) void openSearch();
                                    }}
                                  />
                                </View>
                              )}
                              {!routeReady ? (
                                <>
                                  <Text style={s.subtitle}>{t.tagline}</Text>
                                  {!!savedPlaces.length && (
                                    <View style={{ gap: 8 }}>
                                      <Text style={s.eyebrow}>
                                        {t.savedPlaces}
                                      </Text>
                                      {savedPlaces.map((place) => (
                                        <Pressable
                                          key={place.nickname}
                                          style={s.searchResult}
                                          onPress={() => openSavedPlace(place)}
                                          onLongPress={() =>
                                            Alert.alert(
                                              t.removeSavedPlace,
                                              place.nickname,
                                              [
                                                {
                                                  text: t.close,
                                                  style: 'cancel',
                                                },
                                                {
                                                  text: t.delete,
                                                  style: 'destructive',
                                                  onPress: () =>
                                                    void run(() =>
                                                      removeSavedPlace(
                                                        place.nickname,
                                                      ),
                                                    ),
                                                },
                                              ],
                                            )
                                          }
                                        >
                                          <Ionicons
                                            name="bookmark-outline"
                                            size={22}
                                            color={colors.blue}
                                          />
                                          <View style={{ flex: 1 }}>
                                            <Text style={s.bold}>
                                              {place.nickname}
                                            </Text>
                                            <Text
                                              style={s.small}
                                              numberOfLines={1}
                                            >
                                              {place.label}
                                            </Text>
                                          </View>
                                        </Pressable>
                                      ))}
                                    </View>
                                  )}

                                  {!!frequentSearches.length && (
                                    <View style={{ gap: 4 }}>
                                      <Text style={s.eyebrow}>
                                        {t.frequentPlaces}
                                      </Text>
                                      {frequentSearches
                                        .slice(0, 4)
                                        .map((place) => (
                                          <Pressable
                                            key={place.query.toLowerCase()}
                                            onPress={() =>
                                              void openSearch(place.query)
                                            }
                                            style={s.searchResult}
                                          >
                                            <Ionicons
                                              name="time-outline"
                                              size={21}
                                              color={colors.muted}
                                            />
                                            <Text
                                              numberOfLines={1}
                                              style={[s.bold, { flex: 1 }]}
                                            >
                                              {place.query}
                                            </Text>
                                            <Ionicons
                                              name="arrow-up-outline"
                                              size={18}
                                              color={colors.muted}
                                            />
                                          </Pressable>
                                        ))}
                                    </View>
                                  )}
                                </>
                              ) : (
                                <>
                                  <View style={s.rowBetween}>
                                    <Text style={s.heading}>
                                      {serviceKind === 'delivery'
                                        ? lang === 'sw'
                                          ? 'Usafirishaji wa mzigo'
                                          : 'Delivery'
                                        : lang === 'sw'
                                          ? 'Safari ya abiria'
                                          : 'Passenger ride'}
                                    </Text>
                                    <Pressable
                                      onPress={() => setServiceChooser(true)}
                                    >
                                      <Text style={s.link}>
                                        {lang === 'sw' ? 'Badilisha' : 'Change'}
                                      </Text>
                                    </Pressable>
                                  </View>
                                  {selectedQuote && (
                                    <View style={s.card}>
                                      <Text style={s.heading}>
                                        {t.tripDistance}:{' '}
                                        {(
                                          selectedQuote.route.meters / 1000
                                        ).toFixed(2)}{' '}
                                        km
                                      </Text>
                                      <Text style={s.small}>
                                        {Math.ceil(
                                          selectedQuote.route.seconds / 60,
                                        )}{' '}
                                        {t.minutes}
                                      </Text>
                                      {compatibilityNotice()}
                                    </View>
                                  )}
                                  {serviceKind === 'delivery' &&
                                  deliveryStep === 'cargo' ? (
                                    <>
                                      <CargoFields
                                        value={cargoDraft}
                                        onChange={setCargoDraft}
                                        language={lang}
                                      />
                                      <Button
                                        title={
                                          lang === 'sw'
                                            ? 'Chagua usafiri'
                                            : 'Select transport'
                                        }
                                        disabled={
                                          !parseCargo(cargoDraft).success ||
                                          busy
                                        }
                                        onPress={() => {
                                          void run(async () => {
                                            const result = await api(
                                              '/delivery/options',
                                              {
                                                pickup,
                                                estimatedWeightKg: Number(
                                                  cargoDraft.weight.replace(
                                                    ',',
                                                    '.',
                                                  ),
                                                ),
                                              },
                                            );
                                            setVehicleLimits(
                                              Object.fromEntries(
                                                result.options.map((o: any) => [
                                                  o.category,
                                                  o.maxPayloadKg,
                                                ]),
                                              ),
                                            );
                                            setDeliveryStep('vehicle');
                                            setExpanded(true);
                                          });
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      {serviceKind === 'delivery' && (
                                        <>
                                          <CargoSummary
                                            cargo={
                                              parseCargo(cargoDraft).success
                                                ? {
                                                    description:
                                                      cargoDraft.description,
                                                    estimatedWeightKg: Number(
                                                      cargoDraft.weight.replace(
                                                        ',',
                                                        '.',
                                                      ),
                                                    ),
                                                    fragile: cargoDraft.fragile,
                                                  }
                                                : undefined
                                            }
                                            language={lang}
                                          />
                                          <Pressable
                                            onPress={() =>
                                              setDeliveryStep('cargo')
                                            }
                                          >
                                            <Text style={s.link}>
                                              {lang === 'sw'
                                                ? 'Hariri maelezo ya mzigo'
                                                : 'Edit cargo details'}
                                            </Text>
                                          </Pressable>
                                          <Text style={s.heading}>
                                            {lang === 'sw'
                                              ? 'Chagua usafiri'
                                              : 'Select transport'}
                                          </Text>
                                          <Text style={s.small}>
                                            {lang === 'sw'
                                              ? 'Uzito wa mzigo lazima uendane na uwezo uliothibitishwa wa gari. Mapendekezo ya uwezo na bei bado hayajawezeshwa.'
                                              : 'Cargo weight must fit the vehicle’s verified payload. Capacity matching and pricing are not enabled yet.'}
                                          </Text>
                                        </>
                                      )}
                                      {(serviceKind === 'ride'
                                        ? rideCategories
                                        : categories
                                      ).map((c) => (
                                        <Pressable
                                          key={c}
                                          accessibilityRole="radio"
                                          accessibilityState={{
                                            checked: category === c,
                                          }}
                                          disabled={
                                            serviceKind === 'delivery' &&
                                            vehicleLimits[c] != null &&
                                            Number(
                                              cargoDraft.weight.replace(
                                                ',',
                                                '.',
                                              ),
                                            ) > vehicleLimits[c]!
                                          }
                                          onPress={() => setCategory(c)}
                                          style={[
                                            s.rideOption,
                                            category === c &&
                                              s.rideOptionSelected,
                                          ]}
                                        >
                                          <Ionicons
                                            name={icons[c]}
                                            size={33}
                                            color={colors.navy}
                                          />
                                          <View style={{ flex: 1, gap: 4 }}>
                                            <Text style={s.heading}>
                                              {vehicleLabel(c)}
                                            </Text>
                                            <Text style={s.small}>
                                              {(
                                                (quotes[c]?.route.meters || 0) /
                                                1000
                                              ).toFixed(2)}{' '}
                                              km ·{' '}
                                              {Math.ceil(
                                                (quotes[c]?.route.seconds ||
                                                  0) / 60,
                                              )}{' '}
                                              {t.minutes}
                                            </Text>
                                            {serviceKind === 'delivery' && (
                                              <Text style={s.small}>
                                                {vehicleLimits[c] != null
                                                  ? `${lang === 'sw' ? 'Uwezo uliothibitishwa' : 'Verified payload'}: ${vehicleLimits[c]} kg`
                                                  : lang === 'sw'
                                                    ? 'Uwezo wa gari bado haujathibitishwa'
                                                    : 'No verified vehicle capacity available'}
                                              </Text>
                                            )}
                                          </View>
                                          {serviceKind === 'ride' && (
                                            <Text style={s.optionPrice}>
                                              {quotes[c]?.fare
                                                ? money(quotes[c].fare.total)
                                                : '—'}
                                            </Text>
                                          )}
                                          <Ionicons
                                            name={
                                              category === c
                                                ? 'radio-button-on'
                                                : 'radio-button-off'
                                            }
                                            size={21}
                                            color={
                                              category === c
                                                ? colors.blue
                                                : colors.muted
                                            }
                                          />
                                        </Pressable>
                                      ))}

                                      {serviceKind === 'delivery' && (
                                        <Text style={s.small}>
                                          {lang === 'sw'
                                            ? 'Bei itategemea umbali na usafiri unaofaa mzigo wako. Bei za usafirishaji bado hazijawekwa.'
                                            : 'Pricing will depend on distance and transport suitable for your cargo. Delivery rates have not been configured.'}
                                        </Text>
                                      )}
                                    </>
                                  )}
                                  <Pressable onPress={() => void openSearch()}>
                                    <Text style={s.link}>
                                      {t.pickup}: {placeLabel(pickup)} →{' '}
                                      {destination?.label}
                                    </Text>
                                  </Pressable>
                                  {serviceKind === 'ride' && (
                                    <Text style={s.small}>{t.waiting}</Text>
                                  )}
                                  {(serviceKind === 'ride' ||
                                    deliveryStep === 'vehicle') && (
                                    <Text style={s.small}>
                                      {t.fareRounding}
                                    </Text>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <View style={s.rowBetween}>
                                <Text style={s.bold}>
                                  {driverAvailable && !cargoOnly(category)
                                    ? t.driverOnline
                                    : t.driverOffline}
                                </Text>
                                <Button
                                  title={
                                    driverAvailable ? t.goOffline : t.goOnline
                                  }
                                  secondary
                                  disabled={busy || cargoOnly(category)}
                                  onPress={() => void run(toggleAvailability)}
                                />
                              </View>
                              <Text style={s.subtitle}>
                                {cargoOnly(category)
                                  ? lang === 'sw'
                                    ? 'Huduma ya usafirishaji inasubiri bei. Hakuna usajili unaotozwa au maombi yanayopokelewa bado.'
                                    : 'Delivery pricing is pending. No subscription is being charged and no requests can be received yet.'
                                  : !driverAvailable
                                    ? t.offlineHelp
                                    : profile?.approval === 'approved' ||
                                        preview
                                      ? t.waitingRequests
                                      : t.verificationNeeded}
                              </Text>
                              {offers.map((offer) => (
                                <View key={offer.id} style={s.card}>
                                  <Text style={s.eyebrow}>{t.nearby}</Text>
                                  {routeSummary(offer)}
                                  <Text style={s.dockFare}>
                                    {money(offer.estimate.fare.total)}
                                  </Text>
                                  <Button
                                    title={t.accept}
                                    disabled={busy}
                                    onPress={() =>
                                      void run(() => accept(offer))
                                    }
                                  />
                                </View>
                              ))}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <Text style={s.eyebrow}>
                            {ride.status === 'requested' &&
                            ride.matchingStage === 'notified'
                              ? t.notified
                              : rideStatus(ride.status, lang)}
                          </Text>
                          {role === 'passenger' &&
                          ride.status === 'requested' ? (
                            <View style={s.matchingPanel}>
                              <ActivityIndicator
                                size="large"
                                color={colors.blue}
                              />
                              <Text style={s.heading}>
                                {ride.matchingStage === 'notified'
                                  ? t.notified
                                  : t.searching}
                              </Text>
                              <Text style={s.subtitle}>
                                {ride.matchingStage === 'notified'
                                  ? t.awaitingAcceptance
                                  : t.waitingRequests}
                              </Text>
                            </View>
                          ) : (
                            <>
                              {role === 'driver' && ride.passenger && (
                                <View style={s.contactRow}>
                                  <View style={s.avatar}>
                                    <Ionicons
                                      name="person"
                                      color={colors.blue}
                                      size={24}
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.small}>{t.passenger}</Text>
                                    <Text style={s.heading}>
                                      {ride.passenger.full_name}
                                    </Text>
                                  </View>
                                  {chatButton()}
                                  {['arrived', 'in_progress'].includes(
                                    ride.status,
                                  ) && (
                                    <Pressable
                                      accessibilityRole="button"
                                      accessibilityLabel={t.callPassenger}
                                      style={s.callButton}
                                      onPress={() =>
                                        void callContact(ride.passenger)
                                      }
                                    >
                                      <Ionicons
                                        name="call"
                                        size={22}
                                        color={colors.blue}
                                      />
                                    </Pressable>
                                  )}
                                </View>
                              )}
                              {role === 'passenger' && ride.driver && (
                                <View style={s.contactRow}>
                                  <View style={s.avatar}>
                                    <Ionicons
                                      name="car"
                                      color={colors.blue}
                                      size={24}
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.heading}>
                                      {ride.driver.full_name}
                                    </Text>
                                    <Text style={s.small}>
                                      {[
                                        ride.driver.plate,
                                        ride.driver.vehicle_color,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </Text>
                                  </View>
                                  {chatButton()}
                                  <Pressable
                                    accessibilityLabel={t.callDriver}
                                    onPress={() =>
                                      void run(() => callContact(ride.driver))
                                    }
                                    style={s.callButton}
                                  >
                                    <Ionicons
                                      name="call"
                                      size={21}
                                      color={colors.blue}
                                    />
                                  </Pressable>
                                </View>
                              )}
                              {role === 'passenger' &&
                                ride.status === 'accepted' && (
                                  <Text style={s.heading}>
                                    {ride.arrivalEtaSeconds != null
                                      ? `${t.arrival} ${Math.ceil(ride.arrivalEtaSeconds / 60)} ${t.minutes}`
                                      : t.etaPending}
                                  </Text>
                                )}
                            </>
                          )}
                          {routeSummary(ride)}
                          {active && compatibilityNotice()}
                          {(ride.tripRoute?.meters ??
                            (ride.estimate?.route?.simulated === false
                              ? ride.estimate.route.meters
                              : undefined)) != null && (
                            <Text style={s.heading}>
                              {t.tripDistance}:{' '}
                              {(
                                (ride.tripRoute?.meters ??
                                  ride.estimate?.route?.meters) / 1000
                              ).toFixed(2)}{' '}
                              km
                            </Text>
                          )}
                          {ride.pickupRoute && (
                            <Text style={s.small}>
                              {t.driverToPickup}:{' '}
                              {(ride.pickupRoute.meters / 1000).toFixed(2)} km ·{' '}
                              {Math.ceil(ride.pickupRoute.seconds / 60)}{' '}
                              {t.minutes}
                            </Text>
                          )}
                          <Text style={s.dockFare}>
                            {money(
                              ride.final_fare?.total ??
                                ride.estimate?.fare.total ??
                                0,
                            )}
                          </Text>
                          {!!ride.final_fare?.roundingAdjustment &&
                            ride.final_fare?.roundingIncrement === 500 && (
                              <Text style={s.small}>
                                {t.roundingAdjustment}:{' '}
                                {money(ride.final_fare.roundingAdjustment)}
                              </Text>
                            )}
                          {(ride.final_fare?.roundingIncrement ??
                            ride.estimate?.fare.roundingIncrement) === 500 && (
                            <Text style={s.small}>{t.fareRounding}</Text>
                          )}
                          <Text style={s.small}>{t.payment}</Text>
                          {role === 'driver' && ride.status === 'accepted' && (
                            <View style={s.row}>
                              <View style={{ flex: 1 }}>
                                <Button
                                  title={t.arrived}
                                  disabled={busy}
                                  onPress={() =>
                                    void run(() => transition('arrive'))
                                  }
                                />
                              </View>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t.callPassenger}
                                onPress={() =>
                                  void run(() => callContact(ride.passenger))
                                }
                                style={s.callButton}
                              >
                                <Ionicons
                                  name="call"
                                  size={22}
                                  color={colors.blue}
                                />
                              </Pressable>
                            </View>
                          )}
                          {role === 'driver' && ride.status === 'arrived' && (
                            <>
                              <Button
                                title={t.start}
                                disabled={busy}
                                onPress={() =>
                                  void run(() => transition('start'))
                                }
                              />
                            </>
                          )}
                          {role === 'driver' &&
                            ride.status === 'in_progress' && (
                              <>
                                <View style={s.row}>
                                  {(['cash', 'mobile_money'] as const).map(
                                    (method) => (
                                      <Pressable
                                        key={method}
                                        onPress={() => setPayment(method)}
                                      >
                                        <Text style={s.link}>
                                          {payment === method ? '● ' : ''}
                                          {method === 'cash'
                                            ? t.cash
                                            : t.mobileMoney}
                                        </Text>
                                      </Pressable>
                                    ),
                                  )}
                                </View>
                                <Button
                                  title={t.finish}
                                  disabled={busy}
                                  onPress={() =>
                                    void run(() => transition('complete'))
                                  }
                                />
                              </>
                            )}
                          {role === 'passenger' &&
                            active &&
                            ride.status !== 'requested' && (
                              <Button
                                title={t.share}
                                secondary
                                onPress={() => void run(share)}
                              />
                            )}
                          {active && ride.status !== 'in_progress' && (
                            <Button
                              title={t.cancel}
                              danger
                              onPress={() => {
                                setReason('');
                                setCancelCode('');
                                setCancelOpen(true);
                              }}
                            />
                          )}
                          {ride.status === 'in_progress' && (
                            <>
                              <Field
                                label={t.comment}
                                value={comment}
                                onChange={setComment}
                              />
                              <Button
                                title={t.report}
                                secondary
                                onPress={() =>
                                  void run(async () => {
                                    if (comment.trim().length < 3)
                                      throw new Error(t.comment);
                                    if (!preview)
                                      await api(
                                        `/rides/${ride.id}/transition`,
                                        {
                                          action: 'exception',
                                          reason: comment,
                                        },
                                      );
                                    setNotice('reportSent');
                                  })
                                }
                              />
                            </>
                          )}
                          {preview &&
                            role === 'passenger' &&
                            ['accepted', 'arrived', 'in_progress'].includes(
                              ride.status,
                            ) && (
                              <Button
                                title={t.finishPreview}
                                secondary
                                onPress={() =>
                                  rememberRide({
                                    ...ride,
                                    status: 'completed',
                                    final_fare: ride.estimate.fare,
                                  })
                                }
                              />
                            )}
                          {ride.status === 'completed' && (
                            <>
                              <Text style={s.heading}>{t.rating}</Text>
                              <View style={s.row}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Pressable
                                    key={n}
                                    accessibilityLabel={`${n}`}
                                    onPress={() => setStars(n)}
                                  >
                                    <Ionicons
                                      name={
                                        n <= stars ? 'star' : 'star-outline'
                                      }
                                      size={32}
                                      color={colors.rating}
                                    />
                                  </Pressable>
                                ))}
                              </View>
                              <Field
                                label={t.comment}
                                value={comment}
                                onChange={setComment}
                                multiline
                              />
                              <Button
                                title={t.submit}
                                onPress={() => void run(() => feedback())}
                              />
                              <Button
                                title={t.report}
                                secondary
                                onPress={() => void run(() => feedback(true))}
                              />
                            </>
                          )}
                          {terminal(ride) && (
                            <Button
                              title={t.home}
                              secondary
                              onPress={() => {
                                setRide(null);
                                setRouteReady(false);
                                setQuotes({});
                                setDestination(null);
                              }}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                  {tab === 'trips' && role === 'passenger' && (
                    <TripHistory
                      history={history}
                      lang={lang}
                      load={async (r) =>
                        preview ? r : await api('/rides/' + r.id)
                      }
                      contact={(driver, rideId) =>
                        void run(() => callContact(driver, rideId))
                      }
                      onDetailChange={setHistoryDetail}
                    />
                  )}
                  {tab === 'trips' && role === 'driver' && (
                    <>
                      {!history.length && (
                        <Text style={s.subtitle}>{t.empty}</Text>
                      )}
                      {history.map((r) => (
                        <Pressable
                          key={r.id}
                          style={s.card}
                          onPress={() =>
                            void run(async () => {
                              setRide(
                                preview ? r : await api('/rides/' + r.id),
                              );
                              setTab('home');
                            })
                          }
                        >
                          <View style={s.rowBetween}>
                            <Text style={s.eyebrow}>
                              {r.cancel_reason_code === 'no_driver'
                                ? t.noDriverFound
                                : rideStatus(r.status, lang)}
                            </Text>
                            <Text style={s.small}>
                              {r.created_at
                                ? new Date(r.created_at).toLocaleDateString(
                                    lang === 'sw' ? 'sw-TZ' : 'en-TZ',
                                  )
                                : ''}
                            </Text>
                          </View>
                          {routeSummary(r)}
                          <Text style={s.heading}>
                            {money(
                              r.final_fare?.total ??
                                r.estimate?.fare?.total ??
                                0,
                            )}
                          </Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                  {tab === 'fleet' && role === 'driver' && (
                    <FleetManager
                      language={lang}
                      phone={user.phone}
                      onOwnership={setIsFleetOwner}
                      onActivated={() => {
                        if (!preview) void refresh().catch(setError);
                      }}
                    />
                  )}
                  {tab === 'towing' && role === 'driver' && (
                    <>
                      {!towing.length && (
                        <Text style={s.subtitle}>{t.noTowing}</Text>
                      )}
                      {towing.map((company) => (
                        <View key={company.id} style={s.card}>
                          <Text style={s.heading}>{company.name}</Text>
                          <Button
                            title={company.phone}
                            onPress={() =>
                              void Linking.openURL('tel:' + company.phone)
                            }
                          />
                        </View>
                      ))}
                    </>
                  )}
                  {tab === 'account' && settingsOpen && (
                    <AccountSettings
                      lang={lang}
                      close={() => setSettingsOpen(false)}
                      changeLanguage={(l) => void run(() => changeLanguage(l))}
                      remove={(kind) => void run(() => removeAccount(kind))}
                    />
                  )}
                  {tab === 'account' && !settingsOpen && (
                    <>
                      <View style={s.card}>
                        <View style={s.rowBetween}>
                          <Text style={[s.heading, { flex: 1 }]}>
                            {user.full_name}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={beginEdit}
                          >
                            <Text style={s.link}>{t.edit}</Text>
                          </Pressable>
                        </View>
                        <Text style={s.subtitle}>{user.phone}</Text>
                        <Text style={s.small}>{user.email}</Text>
                        {role === 'driver' && profile?.plate && (
                          <Text style={s.small}>
                            {[profile.plate, profile.vehicle_color]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        )}
                      </View>
                      {role === 'driver' && (
                        <View style={s.card}>
                          <Text style={s.small}>
                            {lang === 'sw'
                              ? 'Unamiliki magari bila kuendesha? Tumia Magari kusajili magari na kualika madereva. Leseni yako inahitajika tu kama wewe utaendesha.'
                              : 'Own vehicles without driving? Use Fleet to register them and invite drivers. Your personal licence is needed only if you drive.'}
                          </Text>
                          <Button
                            secondary
                            title={t.fleet}
                            onPress={() => setTab('fleet')}
                          />
                        </View>
                      )}
                      {role === 'driver' && (
                        <>
                          {verificationNeeded && (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() =>
                                setVerificationOpen(!verificationOpen)
                              }
                            >
                              <Text style={s.verificationPrompt}>
                                {t.verificationNeeded} ›
                              </Text>
                            </Pressable>
                          )}
                          {profile?.submitted_at && (
                            <Text style={s.small}>
                              {profile.approval === 'approved'
                                ? t.approved
                                : t.underReview}
                            </Text>
                          )}
                          {verificationNeeded && verificationOpen && (
                            <>
                              <Text style={s.heading}>
                                {t.verificationTitle}
                              </Text>
                              <Text style={s.subtitle}>
                                {t.verificationHelp}
                              </Text>
                              <Text style={s.label}>{t.vehicleType}</Text>
                              <View style={[s.row, { flexWrap: 'wrap' }]}>
                                {categories.map((c) => (
                                  <Pressable
                                    key={c}
                                    onPress={() => setCategory(c)}
                                    style={[
                                      s.typeChip,
                                      category === c && s.selected,
                                    ]}
                                  >
                                    <Text style={s.bold}>
                                      {vehicleLabel(c)}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                              <Field
                                label={t.vehicleNumber}
                                value={plate}
                                onChange={setPlate}
                              />
                              <Field
                                label={t.vehicleColor}
                                value={vehicleColor}
                                onChange={(text) =>
                                  setVehicleColor(text.slice(0, 40))
                                }
                              />
                              <Field
                                label={t.licenceNumber}
                                value={licence}
                                onChange={setLicence}
                              />
                              <Field
                                label={t.licenceExpiry}
                                value={expiry}
                                onChange={setExpiry}
                              />
                              <View style={s.card}>
                                <Text style={s.heading}>{t.photos}</Text>
                                {photoKeys.map((key) => (
                                  <View key={key} style={s.photoSection}>
                                    <View style={s.rowBetween}>
                                      <Text style={s.bold}>{t[key]}</Text>
                                      {!!docs[key] && (
                                        <Ionicons
                                          name="checkmark-circle"
                                          color={colors.green}
                                          size={22}
                                        />
                                      )}
                                    </View>
                                    {preview && docs[key] && (
                                      <Image
                                        source={{ uri: docs[key] }}
                                        style={{
                                          height: 100,
                                          borderRadius: 12,
                                        }}
                                      />
                                    )}
                                    <View style={s.row}>
                                      <View style={{ flex: 1 }}>
                                        <Button
                                          title={t.camera}
                                          secondary
                                          onPress={() =>
                                            void run(() => photo(key, true))
                                          }
                                        />
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <Button
                                          title={t.upload}
                                          secondary
                                          onPress={() =>
                                            void run(() => photo(key, false))
                                          }
                                        />
                                      </View>
                                    </View>
                                  </View>
                                ))}
                              </View>
                              <Button
                                title={t.persona}
                                secondary
                                disabled={busy}
                                onPress={() => void run(identity)}
                              />
                              <Button
                                title={t.submit}
                                disabled={busy}
                                onPress={() => void run(submitApplication)}
                              />
                            </>
                          )}
                          {!(isFleetOwner && !profile) && (
                            <DriverSubscriptionCard
                              driver={
                                subscription?.driver || profile || { category }
                              }
                              language={lang}
                              period={billingMonths}
                              onPeriod={setBillingMonths}
                              currentPeriod={
                                subscription?.currentPeriodMonths ?? 1
                              }
                              pay={() => {
                                if (preview) setNotice('previewPayment');
                                else setPaymentOpen(true);
                              }}
                            />
                          )}
                        </>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setSettingsOpen(true)}
                        style={[s.card, s.rowBetween]}
                      >
                        <View style={s.row}>
                          <Ionicons
                            name="settings-outline"
                            size={23}
                            color={colors.blue}
                          />
                          <Text style={s.heading}>
                            {accountWords[lang].settings}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={21}
                          color={colors.blue}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={accountWords[lang].logout}
                        onPress={() => void run(logout)}
                        style={[
                          s.button,
                          { backgroundColor: colors.dangerTint },
                        ]}
                      >
                        <Text
                          style={[s.buttonText, { color: colors.dangerText }]}
                        >
                          {accountWords[lang].logout}
                        </Text>
                      </Pressable>
                      <Text style={s.small}>{t.company}</Text>
                    </>
                  )}
                </>
              )}
              {busy && <ActivityIndicator color={colors.blue} />}
            </ScrollView>
            {mapHome &&
              role === 'passenger' &&
              routeReady &&
              !ride &&
              (serviceKind === 'ride' || deliveryStep === 'vehicle') && (
                <View style={s.bookingDock}>
                  <Button
                    title={
                      serviceKind === 'delivery'
                        ? lang === 'sw'
                          ? 'Bei za usafirishaji hazijawekwa'
                          : 'Delivery pricing pending'
                        : t.confirmRide
                    }
                    disabled={
                      !selectedQuote || busy || serviceKind === 'delivery'
                    }
                    onPress={() => setConfirmation(true)}
                  />
                  <Text style={[s.small, { textAlign: 'center' }]}>
                    {t.payment}
                  </Text>
                </View>
              )}
          </View>
        </KeyboardAvoidingView>
      </View>
      {user && (
        <View accessibilityRole="tablist" style={s.tabs}>
          {(role === 'driver'
            ? (['home', 'trips', 'fleet', 'towing', 'account'] as const)
            : (['home', 'trips', 'account'] as const)
          ).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={t[key]}
              accessibilityState={{ selected: tab === key }}
              onPress={() => {
                setTab(key);
                setExpanded(false);
                setError('');
                setNotice(null);
                if (key === 'towing')
                  void run(async () => {
                    setTowing(preview ? [] : await api('/towing'));
                  });
                else if (!preview) void refresh().catch(setError);
              }}
              style={s.tab}
            >
              <View style={[s.tabIcon, tab === key && s.tabIconSelected]}>
                <Ionicons
                  name={
                    (
                      {
                        home: 'navigate-outline',
                        trips: 'time-outline',
                        account: 'person-outline',
                        towing: 'construct-outline',
                        fleet: 'car-outline',
                      } as const
                    )[key]
                  }
                  size={23}
                  color={tab === key ? colors.blue : colors.muted}
                />
              </View>
              <Text
                style={[
                  s.small,
                  tab === key && { color: colors.blue, fontWeight: '700' },
                ]}
              >
                {key === 'towing'
                  ? lang === 'sw'
                    ? 'Kuvuta gari'
                    : 'Towing'
                  : t[key]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {user && role === 'driver' && !preview && (
        <SubscriptionPayments
          visible={paymentOpen}
          periodMonths={billingMonths}
          onPeriodChange={setBillingMonths}
          onClose={() => setPaymentOpen(false)}
          language={lang}
          phone={user.phone}
          onPaid={refresh}
        />
      )}
      <Modal
        visible={searchOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          searchRevision.current++;
          setSearchOpen(false);
        }}
      >
        <SafeAreaView style={s.root}>
          <KeyboardAvoidingView
            style={s.screenBody}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={s.searchToolbar}>
              <Pressable
                accessibilityLabel={t.back}
                onPress={() => {
                  searchRevision.current++;
                  setSearchOpen(false);
                }}
              >
                <Ionicons name="arrow-back" size={25} color={colors.navy} />
              </Pressable>
              <Text style={s.heading}>{t.where}</Text>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {!!error && (
                  <Text style={s.error}>{localizeError(error, lang)}</Text>
                )}
                <View
                  style={[
                    s.searchRouteField,
                    searchTarget === 'pickup' && {
                      borderWidth: 1,
                      borderColor: colors.blue,
                    },
                  ]}
                >
                  <Ionicons
                    name="radio-button-on"
                    size={18}
                    color={colors.blue}
                  />
                  <TextInput
                    accessibilityLabel={t.pickup}
                    placeholder={locating ? t.locating : t.pickup}
                    value={drafts.pickup || ''}
                    onFocus={() => focusPlace('pickup')}
                    onChangeText={(text) => editPlace('pickup', text)}
                    style={[s.searchInput, { minWidth: 0 }]}
                    autoCorrect={false}
                    maxLength={150}
                  />
                  {!!drafts.pickup && (
                    <Pressable
                      accessibilityLabel={`${t.clear} ${t.pickup}`}
                      hitSlop={10}
                      onPress={() => editPlace('pickup', '')}
                    >
                      <Ionicons
                        name="close-circle"
                        size={21}
                        color={colors.muted}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityLabel={t.current}
                    hitSlop={8}
                    onPress={() => {
                      focusPlace('pickup');
                      void useCurrent();
                    }}
                  >
                    <Ionicons
                      name="locate-outline"
                      size={22}
                      color={colors.blue}
                    />
                  </Pressable>
                </View>
                {stops.map((stop, i) => (
                  <View key={i} style={s.row}>
                    <View
                      style={[
                        s.searchRouteField,
                        { flex: 1 },
                        searchTarget === i && {
                          borderWidth: 1,
                          borderColor: colors.blue,
                        },
                      ]}
                    >
                      <Ionicons
                        name="ellipse-outline"
                        size={17}
                        color={colors.muted}
                      />
                      <TextInput
                        autoFocus
                        accessibilityLabel={`${t.stop} ${i + 1}`}
                        placeholder={`${t.stop} ${i + 1}`}
                        value={drafts[i] || ''}
                        onFocus={() => focusPlace(i)}
                        onChangeText={(text) => editPlace(i, text)}
                        style={[s.searchInput, { minWidth: 0 }]}
                        autoCorrect={false}
                        maxLength={150}
                      />
                      {!!drafts[i] && (
                        <Pressable
                          accessibilityLabel={`${t.clear} ${t.stop} ${i + 1}`}
                          hitSlop={10}
                          onPress={() => editPlace(i, '')}
                        >
                          <Ionicons
                            name="close-circle"
                            size={21}
                            color={colors.muted}
                          />
                        </Pressable>
                      )}
                    </View>
                    <Pressable
                      accessibilityLabel={t.removeStop}
                      hitSlop={8}
                      onPress={() => {
                        searchRevision.current++;
                        const next = stops.filter((_, n) => n !== i);
                        setStops(next);
                        setDrafts((rows) => ({
                          ...rows,
                          ...Object.fromEntries(
                            next.map((p, n) => [
                              n,
                              p.placeholder ? '' : p.label,
                            ]),
                          ),
                        }));
                        setSearchTarget('destination');
                        setSearch('');
                        setRouteReady(false);
                        setQuotes({});
                      }}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={24}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                ))}
                <View style={s.row}>
                  <View
                    style={[
                      s.searchRouteField,
                      { flex: 1 },
                      searchTarget === 'destination' && {
                        borderWidth: 1,
                        borderColor: colors.blue,
                      },
                    ]}
                  >
                    <Ionicons name="location" size={19} color={colors.navy} />
                    <TextInput
                      accessibilityLabel={t.destination}
                      placeholder={t.destination}
                      value={drafts.destination || ''}
                      onFocus={() => focusPlace('destination')}
                      onChangeText={(text) => editPlace('destination', text)}
                      style={[s.searchInput, { minWidth: 0 }]}
                      autoFocus
                      autoCorrect={false}
                      maxLength={150}
                    />
                    {!!drafts.destination && (
                      <Pressable
                        accessibilityLabel={`${t.clear} ${t.destination}`}
                        hitSlop={10}
                        onPress={() => editPlace('destination', '')}
                      >
                        <Ionicons
                          name="close-circle"
                          size={21}
                          color={colors.muted}
                        />
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    accessibilityLabel={t.addStop}
                    hitSlop={8}
                    onPress={() => {
                      if (stops.length >= 3) {
                        setNotice('stopLimit');
                        return;
                      }
                      setDrafts((rows) => ({ ...rows, [stops.length]: '' }));
                      setStops((rows) => [
                        ...rows,
                        {
                          ...pickup,
                          label: t.stop,
                          current: false,
                          placeholder: true,
                        },
                      ]);
                      focusPlace(stops.length);
                      setRouteReady(false);
                      setQuotes({});
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={26}
                      color={colors.blue}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={t.routeOptions}
                    hitSlop={8}
                    onPress={() =>
                      Alert.alert(t.routeOptions, '', [
                        {
                          text: t.swap,
                          onPress: () => {
                            if (!destination || !pickupKnown) return;
                            searchRevision.current++;
                            pickupManuallyChanged.current = true;
                            const next = [...stops].reverse();
                            setPickup(destination);
                            setDestination(pickup);
                            setStops(next);
                            setDrafts({
                              pickup: destination.label,
                              destination: pickup.label,
                              ...Object.fromEntries(
                                next.map((p, i) => [
                                  i,
                                  p.placeholder ? '' : p.label,
                                ]),
                              ),
                            });
                            setRouteReady(false);
                            setQuotes({});
                            setSearch('');
                          },
                        },
                        { text: t.close, style: 'cancel' },
                      ])
                    }
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={24}
                      color={colors.navy}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                {(searchingPlaces || selectingPlace) && (
                  <ActivityIndicator
                    style={{ padding: 16 }}
                    color={colors.blue}
                  />
                )}
                {limitedSearch && !searchingPlaces && (
                  <Text style={s.small}>{t.addressSearchHint}</Text>
                )}
                {results.map((place) => (
                  <Pressable
                    key={place.placeId}
                    disabled={selectingPlace}
                    onPress={() => void chooseSuggestion(place)}
                    style={s.searchResult}
                  >
                    <Ionicons
                      name="location-outline"
                      size={22}
                      color={colors.navy}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.bold}>{place.primaryText}</Text>
                      {!!place.secondaryText && (
                        <Text style={s.small}>{place.secondaryText}</Text>
                      )}
                      {place.distanceMeters !== undefined && (
                        <Text style={s.small}>
                          ≈{' '}
                          {(place.distanceMeters / 1000).toLocaleString(
                            lang === 'sw' ? 'sw-TZ' : 'en-TZ',
                            { maximumFractionDigits: 1 },
                          )}{' '}
                          km · {t.straightLine}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="arrow-up-outline"
                      size={19}
                      color={colors.muted}
                    />
                  </Pressable>
                ))}
                {!!results.length && (
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      paddingVertical: 16,
                    }}
                  >
                    Google Maps
                  </Text>
                )}
                {!results.length &&
                  !searchingPlaces &&
                  !selectingPlace &&
                  !error && (
                    <Text style={s.subtitle}>
                      {search.trim().length >= 2 ? t.noResults : t.searchHint}
                    </Text>
                  )}
              </View>
            </ScrollView>
            <View style={s.bookingDock}>
              {destination && (
                <View style={{ gap: 8 }}>
                  <Button
                    secondary
                    title={t.savePlace}
                    onPress={() => {
                      setPlaceNickname('');
                      setLabelOpen(true);
                    }}
                  />
                  {labelOpen && (
                    <View style={{ gap: 8 }}>
                      <Text style={s.small}>{t.placeLabelHelp}</Text>
                      <TextInput
                        accessibilityLabel={t.placeLabel}
                        placeholder={t.placeLabel}
                        value={placeNickname}
                        onChangeText={setPlaceNickname}
                        maxLength={40}
                        style={s.input}
                      />
                      <View style={s.row}>
                        {[t.homePlace, t.workPlace, t.schoolPlace].map(
                          (label) => (
                            <Pressable
                              key={label}
                              onPress={() => setPlaceNickname(label)}
                              style={{
                                padding: 10,
                                backgroundColor: colors.background,
                                borderRadius: 10,
                              }}
                            >
                              <Text>{label}</Text>
                            </Pressable>
                          ),
                        )}
                      </View>
                      <Button
                        title={t.save}
                        disabled={!placeNickname.trim()}
                        onPress={() => void run(savePlaceLabel)}
                      />
                    </View>
                  )}
                </View>
              )}
              <Button
                title={t.confirmLocations}
                disabled={
                  !pickupKnown ||
                  !destination ||
                  busy ||
                  locating ||
                  selectingPlace ||
                  stops.some((p) => p.placeholder)
                }
                onPress={() => {
                  setSearchOpen(false);
                  setTimeout(() => setServiceChooser(true), 400);
                }}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <ServiceChoice
        visible={serviceChooser}
        language={lang}
        close={() => setServiceChooser(false)}
        choose={(kind) => {
          setServiceKind(kind);
          if (kind === 'delivery') setDeliveryStep('cargo');
          if (kind === 'ride' && cargoOnly(category)) setCategory('boda');
          setServiceChooser(false);
          void run(() => calculateQuotes(kind));
        }}
      />
      <Modal
        visible={confirmation}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setConfirmation(false);
        }}
      >
        <View style={s.modalScrim}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.back}
            disabled={busy}
            onPress={() => setConfirmation(false)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={s.modalCard}>
            <Text style={s.heading}>{t.reviewRide}</Text>
            <Text style={s.bold}>
              {placeLabel(pickup)} → {destination?.label}
            </Text>
            {stops.map((stop, i) => (
              <Text key={i} style={s.small}>
                {t.stop} {i + 1}: {stop.label}
              </Text>
            ))}
            <Text style={s.fare}>
              {selectedQuote?.fare ? money(selectedQuote.fare.total) : ''}
            </Text>
            {selectedQuote?.fare?.roundingIncrement === 500 && (
              <Text style={s.small}>{t.fareRounding}</Text>
            )}
            <Text style={s.small}>{t.payment}</Text>
            {!!error && (
              <Text style={s.error}>{localizeError(error, lang)}</Text>
            )}
            <Button
              title={t.confirmAgain}
              disabled={busy}
              onPress={() => void run(request)}
            />
          </SafeAreaView>
        </View>
      </Modal>
      <Modal
        visible={cancelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalScrim}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={[s.modalCard, { maxHeight: '90%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16 }}
            >
              <Text style={s.heading}>{t.cancelTitle}</Text>
              <Text style={s.subtitle}>{t.cancelHelp}</Text>
              {role === 'passenger' && (
                <View style={{ gap: 8 }}>
                  {passengerCancelCodes.map((code, i) => (
                    <Pressable
                      key={code}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: cancelCode === code }}
                      onPress={() => {
                        setCancelCode(code);
                        setReason('');
                      }}
                      style={[
                        s.searchRouteField,
                        cancelCode === code && {
                          borderWidth: 1,
                          borderColor: colors.blue,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          cancelCode === code
                            ? 'radio-button-on'
                            : 'radio-button-off'
                        }
                        size={21}
                        color={colors.blue}
                      />
                      <Text style={{ flex: 1 }}>
                        {
                          [
                            t.cancelAccidental,
                            t.cancelTooLong,
                            t.cancelAlternative,
                            t.cancelOther,
                          ][i]
                        }
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {(role === 'driver' || cancelCode === 'other') && (
                <Field
                  label={t.reason}
                  value={reason}
                  onChange={setReason}
                  multiline
                  placeholder={t.reasonPlaceholder}
                />
              )}
              {!!error && (
                <Text style={s.error}>{localizeError(error, lang)}</Text>
              )}
              <Button
                title={t.cancel}
                danger
                disabled={
                  busy ||
                  (role === 'passenger'
                    ? !cancelCode ||
                      (cancelCode === 'other' && reason.trim().length < 3)
                    : reason.trim().length < 3)
                }
                onPress={() => void run(() => transition('cancel'))}
              />
              <Button
                title={t.keepRide}
                secondary
                onPress={() => setCancelOpen(false)}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setEditing(false);
          setPhoneVerify(false);
        }}
      >
        <SafeAreaView style={s.root}>
          <KeyboardAvoidingView
            style={s.screenBody}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.rowBetween}>
                <Text style={s.heading}>
                  {phoneVerify ? t.newPhone : t.accountDetails}
                </Text>
                <Pressable
                  accessibilityLabel={t.close}
                  onPress={() => {
                    setEditing(false);
                    setPhoneVerify(false);
                  }}
                >
                  <Ionicons name="close" size={25} color={colors.navy} />
                </Pressable>
              </View>
              {!!error && (
                <Text style={s.error}>{localizeError(error, lang)}</Text>
              )}
              {phoneVerify ? (
                <>
                  <Text style={s.subtitle}>{t.phoneHelp}</Text>
                  <Text style={s.bold}>{editPhone}</Text>
                  <Field
                    label={t.otp}
                    value={phoneCode}
                    onChange={setPhoneCode}
                    keyboard="number-pad"
                  />
                  {!!otpHint && (
                    <Text style={s.small}>
                      {t.demoOtp}: {otpHint}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Field
                    label={t.name}
                    value={editName}
                    onChange={setEditName}
                  />
                  <Field
                    label={t.email}
                    value={editEmail}
                    onChange={setEditEmail}
                    keyboard="email-address"
                  />
                  <Field
                    label={t.phone}
                    value={editPhone}
                    onChange={setEditPhone}
                    keyboard="phone-pad"
                  />
                </>
              )}
              <Button
                title={phoneVerify ? t.verify : t.save}
                disabled={busy}
                onPress={() => void run(finishEdit)}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
