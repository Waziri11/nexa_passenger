import { useTheme } from './theme';
import { darkMapStyle } from './theme-colors';
import { Text } from './themed-primitives';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { type Point, type Language } from '@nexadrop/core';
import {
  googleDirectionsUrl,
  supportsGoogleMap,
  visibleMapPadding,
} from './map-model';
export function LiveMap({
  pickup,
  destination,
  driver,
  fullscreen = false,
  language = 'sw',
  stops = [],
  routeCoordinates = [],
  tripRouteCoordinates = [],
  pickupRouteCoordinates = [],
  approaching = false,
  showPickup = true,
  locationGranted = false,
  bottomInset = 260,
  tripSummary,
}: {
  pickup: Point;
  destination: Point;
  driver?: Point;
  fullscreen?: boolean;
  language?: Language;
  stops?: (Point & { label: string })[];
  routeCoordinates?: Point[];
  tripRouteCoordinates?: Point[];
  pickupRouteCoordinates?: Point[];
  approaching?: boolean;
  showPickup?: boolean;
  locationGranted?: boolean;
  bottomInset?: number;
  tripSummary?: { meters: number; seconds: number };
}) {
  const { colors, scheme } = useTheme();
  const map = useRef<MapView>(null),
    location = useRef<Point | null>(null),
    firstLocation = useRef(false),
    panned = useRef(false),
    journey = useRef('');
  const [ready, setReady] = useState(false),
    [loaded, setLoaded] = useState(false),
    [timedOut, setTimedOut] = useState(false),
    [attempt, setAttempt] = useState(0),
    [mapHeight, setMapHeight] = useState(700);
  const google = supportsGoogleMap(
    Platform.OS,
    Constants.executionEnvironment,
    !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY,
  );
  const initial = useRef({
    latitude: pickup.latitude,
    longitude: pickup.longitude,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  });
  const clean = (points: Point[]) =>
    points.filter(
      (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
    );
  const trip = clean(
      tripRouteCoordinates.length
        ? tripRouteCoordinates
        : !approaching
          ? routeCoordinates
          : [],
    ),
    approach = clean(pickupRouteCoordinates),
    remaining = clean(!approaching ? routeCoordinates : []);
  const path = [...trip, ...approach, ...remaining];
  const routeKey = JSON.stringify([
      showPickup ? pickup : null,
      destination,
      stops,
      path,
      driver,
    ]),
    journeyKey = JSON.stringify([
      showPickup ? pickup : null,
      destination,
      stops,
    ]);
  useEffect(() => {
    setReady(false);
    setLoaded(false);
    setTimedOut(false);
    firstLocation.current = false;
    const timer = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [attempt, google]);
  useEffect(() => {
    if (!ready) return;
    if (journey.current !== journeyKey) {
      journey.current = journeyKey;
      panned.current = false;
    }
    if (panned.current) return;
    const points = [
      ...(showPickup ? [pickup] : []),
      ...stops,
      ...(google ? path : []),
      ...(driver ? [driver] : []),
      ...(destination.latitude !== pickup.latitude ||
      destination.longitude !== pickup.longitude
        ? [destination]
        : []),
    ];
    if (points.length > 1)
      map.current?.fitToCoordinates(points, {
        edgePadding: visibleMapPadding(
          mapHeight,
          bottomInset,
          fullscreen,
          tripSummary ? 210 : 110,
        ),
        animated: true,
      });
    else if (points.length)
      map.current?.animateToRegion(
        { ...points[0], latitudeDelta: 0.018, longitudeDelta: 0.018 },
        600,
      );
  }, [
    routeKey,
    ready,
    bottomInset,
    mapHeight,
    google,
    tripSummary?.meters,
    tripSummary?.seconds,
  ]);
  const sw = language === 'sw';
  const labels = {
    pickup: sw ? 'Mahali pa kuchukuliwa' : 'Pickup',
    destination: sw ? 'Unakoenda' : 'Destination',
    driver: sw ? 'Dereva' : 'Driver',
    recenter: sw ? 'Rudi kwenye eneo langu' : 'Recenter on my location',
    loading: sw ? 'Ramani inapakia…' : 'Loading map…',
    retry: sw ? 'Jaribu tena' : 'Retry',
    error: sw
      ? 'Ramani haikupakia. Hakikisha mtandao unapatikana.'
      : 'Map could not load. Check your connection.',
    external: sw
      ? 'Fungua njia kwenye Google Maps'
      : 'Open route in Google Maps',
    preview: sw
      ? 'Google Maps ndani ya Nexadrop inahitaji development build kwenye iPhone.'
      : 'Google Maps inside Nexadrop requires a development build on iPhone.',
  };
  return (
    <View
      style={
        fullscreen
          ? { flex: 1 }
          : { height: 260, borderRadius: 24, overflow: 'hidden' }
      }
    >
      <MapView
        key={(google ? 'google' : 'native') + '-' + attempt}
        ref={map}
        provider={google && Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        userInterfaceStyle={scheme}
        customMapStyle={
          google ? (scheme === 'dark' ? darkMapStyle : []) : undefined
        }
        initialRegion={initial.current}
        onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}
        onMapReady={() => {
          setReady(true);
          if (!google) setLoaded(true);
        }}
        onMapLoaded={() => setLoaded(true)}
        onPanDrag={() => {
          panned.current = true;
        }}
        loadingEnabled={false}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        showsTraffic
        showsCompass
        onUserLocationChange={(event) => {
          const point = event.nativeEvent.coordinate;
          if (!point) return;
          location.current = {
            latitude: point.latitude,
            longitude: point.longitude,
          };
          if (!firstLocation.current && !showPickup && !panned.current) {
            firstLocation.current = true;
            map.current?.animateToRegion(
              {
                ...location.current,
                latitudeDelta: 0.018,
                longitudeDelta: 0.018,
              },
              700,
            );
          }
        }}
      >
        {showPickup && (
          <Marker
            coordinate={pickup}
            title={labels.pickup}
            pinColor={colors.blue}
          />
        )}
        {(destination.latitude !== pickup.latitude ||
          destination.longitude !== pickup.longitude) && (
          <Marker
            coordinate={destination}
            title={labels.destination}
            pinColor={colors.green}
          />
        )}
        {driver && (
          <Marker coordinate={driver} title={labels.driver}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                padding: 10,
                borderWidth: 2,
                borderColor: colors.blue,
              }}
            >
              <Ionicons name="car-sport" size={24} color={colors.blue} />
            </View>
          </Marker>
        )}
        {stops.map((stop, i) => (
          <Marker
            key={i}
            coordinate={stop}
            title={stop.label}
            pinColor="#E09E22"
          />
        ))}
        {google && trip.length > 1 && (
          <Polyline
            coordinates={trip}
            strokeColor={colors.routeCasing}
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {google && trip.length > 1 && (
          <Polyline
            coordinates={trip}
            strokeColor={colors.blue}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {google && approach.length > 1 && (
          <Polyline
            coordinates={approach}
            strokeColor={colors.green}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {google && remaining.length > 1 && (
          <Polyline
            coordinates={remaining}
            strokeColor={colors.blue}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
      {!loaded && (
        <View
          style={{
            position: 'absolute',
            top: '25%',
            alignSelf: 'center',
            maxWidth: '85%',
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            gap: 8,
            alignItems: 'center',
          }}
        >
          {!timedOut ? (
            <>
              <ActivityIndicator color={colors.blue} />
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {labels.loading}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: colors.navy }}>
                {labels.error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((n) => n + 1)}
              >
                <Text
                  style={{ color: colors.blue, fontWeight: '700', padding: 8 }}
                >
                  {labels.retry}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
      {tripSummary && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 148,
            left: 20,
            right: 76,
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 12,
            gap: 4,
            elevation: 4,
            shadowColor: colors.shadow,
            shadowOpacity: 0.12,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {language === 'sw'
              ? 'Safari hadi unakoenda'
              : 'Journey to destination'}
          </Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: colors.navy }}>
            {(tripSummary.meters / 1000).toFixed(1)} km ·{' '}
            {Math.ceil(tripSummary.seconds / 60)}{' '}
            {language === 'sw' ? 'dakika' : 'min'}
          </Text>
        </View>
      )}
      {!tripSummary && google && path.length > 1 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 170,
            left: 20,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 10,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.blue }}>
            ● {labels.pickup} → {labels.destination}
          </Text>
          {approach.length > 1 && (
            <Text style={{ fontSize: 11, color: colors.green }}>
              ● {labels.driver} → {labels.pickup}
            </Text>
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labels.recenter}
        onPress={() => {
          const point = location.current || (showPickup ? pickup : null);
          if (point) {
            panned.current = true;
            map.current?.animateToRegion(
              { ...point, latitudeDelta: 0.015, longitudeDelta: 0.015 },
              600,
            );
          }
        }}
        style={{
          position: 'absolute',
          right: 18,
          bottom: fullscreen
            ? Math.max(16, Math.min(bottomInset + 16, mapHeight - 56))
            : 16,
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        }}
      >
        <Ionicons name="locate" size={23} color={colors.blue} />
      </Pressable>
    </View>
  );
}
