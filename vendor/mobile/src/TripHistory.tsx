import { CargoSummary } from './DeliveryFlow';
import { Text, TextInput } from './themed-primitives';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { money, type Language } from '@nexadrop/core';
import { useTheme } from './theme';
import { Button } from './ui';
import { NativeDateField } from './NativeDateField';
import { filterTrips, tripDay, validTripDay } from './trip-history';
import { rideStatus } from './copy';
const labels = {
  sw: {
    title: 'Safari zilizopita',
    search: 'Tafuta eneo au jina',
    filter: 'Chuja kwa tarehe',
    day: 'Siku moja',
    range: 'Kipindi',
    from: 'Kuanzia',
    to: 'Hadi',
    date: 'Tarehe',
    hint: 'YYYY-MM-DD',
    apply: 'Tumia',
    clear: 'Ondoa vichujio',
    back: 'Rudi kwenye safari',
    empty: 'Hakuna safari zinazolingana.',
    driver: 'Dereva',
    vehicle: 'Chombo cha usafiri',
    distance: 'Umbali',
    amount: 'Nauli',
    rating: 'Ukadiriaji wako',
    comment: 'Maoni yako',
    unrated: 'Hukutoa ukadiriaji wa safari hii.',
    contact: 'Wasiliana na dereva',
    unavailable: 'Haipatikani',
    error:
      'Weka tarehe halali. Tarehe ya mwisho iwe baada ya tarehe ya mwanzo.',
    detail: 'Maelezo ya safari',
    retry: 'Jaribu tena',
    loadError: 'Maelezo hayajapakiwa. Tafadhali jaribu tena.',
    noDriver: 'Dereva hajapatikana',
    pickup: 'Ulipopandia',
    destination: 'Ulikokwenda',
    stop: 'Kituo',
  },
  en: {
    title: 'Trip history',
    search: 'Search places or names',
    filter: 'Filter by date',
    day: 'Specific day',
    range: 'Date range',
    from: 'From',
    to: 'To',
    date: 'Date',
    hint: 'YYYY-MM-DD',
    apply: 'Apply',
    clear: 'Clear filters',
    back: 'Back to trips',
    empty: 'No matching trips.',
    driver: 'Driver',
    vehicle: 'Vehicle',
    distance: 'Distance',
    amount: 'Fare',
    rating: 'Your rating',
    comment: 'Your comments',
    unrated: 'You did not rate this trip.',
    contact: 'Contact driver',
    unavailable: 'Unavailable',
    error:
      'Enter valid dates. The end date must be on or after the start date.',
    detail: 'Trip details',
    retry: 'Try again',
    loadError: 'Could not load trip details. Please try again.',
    noDriver: 'Driver not found',
    pickup: 'Pickup',
    destination: 'Destination',
    stop: 'Stop',
  },
};

export function TripHistory({
  history,
  lang,
  load,
  contact,
  onDetailChange,
}: {
  history: any[];
  lang: Language;
  load: (r: any) => Promise<any>;
  contact: (driver: any, rideId?: string) => void;
  onDetailChange: (open: boolean) => void;
}) {
  const { s, colors } = useTheme();
  const blueCard = {
    backgroundColor: colors.blueTint,
    borderColor: colors.blueBorder,
  };
  const t = labels[lang];
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(''),
    [filters, setFilters] = useState(false);
  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '' }),
    [invalid, setInvalid] = useState(false);
  const request = useRef(0);
  async function open(r: any) {
    const current = ++request.current;
    onDetailChange(true);
    setSelected(r);
    setLoading(true);
    setFailed(false);
    try {
      const detail = await load(r);
      if (current === request.current) setSelected(detail);
    } catch {
      if (current === request.current) setFailed(true);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  if (selected) {
    const rating = selected.my_feedback;
    const meters =
      selected.distance_m > 0
        ? selected.distance_m
        : selected.estimate?.route?.meters;
    return (
      <View style={{ gap: 18 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            request.current++;
            setSelected(null);
            onDetailChange(false);
          }}
          style={s.row}
        >
          <Ionicons name="arrow-back" size={23} color={colors.blue} />
          <Text style={s.link}>{t.back}</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.blue} />
        ) : failed ? (
          <View style={s.card}>
            <Text>{t.loadError}</Text>
            <Button title={t.retry} onPress={() => void open(selected)} />
          </View>
        ) : (
          <>
            <View style={[s.card, blueCard]}>
              <Text style={s.eyebrow}>
                {selected.cancel_reason_code === 'no_driver'
                  ? t.noDriver
                  : rideStatus(selected.status, lang)}
              </Text>
              <Text style={s.small}>{tripDay(selected.created_at)}</Text>
              <Text style={s.small}>{t.pickup}</Text>
              <Text style={s.heading}>{selected.pickup_label}</Text>
              {(selected.stops || []).map((stop: any, i: number) => (
                <View key={i}>
                  <Text style={s.small}>
                    {t.stop} {i + 1}
                  </Text>
                  <Text style={s.bold}>{stop.label}</Text>
                </View>
              ))}
              <Text style={s.small}>{t.destination}</Text>
              <Text style={s.heading}>{selected.destination_label}</Text>
              <CargoSummary cargo={selected.cargo} language={lang} />
              <Text style={s.small}>{t.distance}</Text>
              <Text style={s.bold}>
                {meters != null
                  ? `${(meters / 1000).toFixed(2)} km`
                  : t.unavailable}
              </Text>
              <Text style={s.small}>{t.amount}</Text>
              <Text style={s.heading}>
                {money(
                  selected.final_fare?.total ??
                    selected.estimate?.fare?.total ??
                    0,
                )}
              </Text>
            </View>
            <View style={[s.card, blueCard]}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.small}>{t.driver}</Text>
                  <Text style={s.heading}>
                    {selected.driver?.full_name || t.unavailable}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.contact}
                  style={s.callButton}
                  onPress={() => contact(selected.driver, selected.id)}
                >
                  <Ionicons name="call" size={22} color={colors.blue} />
                </Pressable>
              </View>
              <Text style={s.small}>{t.vehicle}</Text>
              <Text style={s.bold}>
                {[
                  selected.driver?.plate,
                  selected.driver?.vehicle_color,
                  (
                    {
                      boda: 'Boda',
                      bajaji: 'Bajaji',
                      car: 'Car Basic',
                      toyo: 'Toyo',
                      kirikuu: 'Kirikuu',
                      truck: lang === 'sw' ? 'Lori' : 'Truck',
                    } as Record<string, string>
                  )[selected.category],
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View style={[s.card, blueCard]}>
              <Text style={s.heading}>{t.rating}</Text>
              {rating ? (
                <>
                  <View
                    style={s.row}
                    accessibilityLabel={`${rating.stars} / 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= rating.stars ? 'star' : 'star-outline'}
                        size={27}
                        color={colors.rating}
                      />
                    ))}
                  </View>
                  <Text style={s.small}>{t.comment}</Text>
                  <Text style={s.bold}>{rating.comment || '—'}</Text>
                </>
              ) : (
                <Text style={s.small}>{t.unrated}</Text>
              )}
            </View>
          </>
        )}
      </View>
    );
  }
  const trips = filterTrips(
    history.filter((r) => ['completed', 'cancelled'].includes(r.status)),
    query,
    applied.from,
    applied.to,
  );
  return (
    <View style={{ gap: 16 }}>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={t.search}
          placeholder={t.search}
          value={query}
          onChangeText={setQuery}
          style={[s.input, { flex: 1 }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.filter}
          accessibilityState={{ expanded: filters }}
          onPress={() => setFilters(!filters)}
          style={[
            s.callButton,
            !!applied.from && { backgroundColor: colors.selection },
          ]}
        >
          <Ionicons name="options-outline" size={23} color={colors.blue} />
        </Pressable>
      </View>
      {filters && (
        <View style={[s.card, blueCard]}>
          <Text style={s.heading}>{t.filter}</Text>
          <View style={s.row}>
            {(['day', 'range'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === m }}
                onPress={() => setMode(m)}
                style={s.typeChip}
              >
                <Text style={s.link}>
                  {mode === m ? '● ' : ''}
                  {t[m]}
                </Text>
              </Pressable>
            ))}
          </View>
          <NativeDateField
            label={mode === 'day' ? t.date : t.from}
            value={from}
            onChange={setFrom}
            lang={lang}
          />
          {mode === 'range' && (
            <NativeDateField
              label={t.to}
              value={to}
              onChange={setTo}
              lang={lang}
            />
          )}
          {invalid && (
            <Text style={{ color: colors.dangerText }}>{t.error}</Text>
          )}
          <Button
            title={t.apply}
            onPress={() => {
              const end = mode === 'day' ? from : to;
              if (!validTripDay(from) || !validTripDay(end) || end < from) {
                setInvalid(true);
                return;
              }
              setApplied({ from, to: end });
              setInvalid(false);
              setFilters(false);
            }}
          />
          <Button
            title={t.clear}
            secondary
            onPress={() => {
              setApplied({ from: '', to: '' });
              setFrom('');
              setTo('');
              setInvalid(false);
              setFilters(false);
            }}
          />
        </View>
      )}
      {!!applied.from && (
        <Text style={s.small}>
          {applied.from}
          {applied.to !== applied.from ? ` → ${applied.to}` : ''}
        </Text>
      )}
      {!trips.length && <Text style={s.subtitle}>{t.empty}</Text>}
      {trips.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          style={[s.card, blueCard]}
          onPress={() => void open(r)}
        >
          <View style={s.rowBetween}>
            <Text style={s.eyebrow}>
              {r.cancel_reason_code === 'no_driver'
                ? t.noDriver
                : rideStatus(r.status, lang)}
            </Text>
            <Text style={s.small}>{tripDay(r.created_at)}</Text>
          </View>
          <Text style={s.heading}>{r.pickup_label}</Text>
          <Ionicons name="arrow-down" size={18} color={colors.blue} />
          <Text style={s.heading}>{r.destination_label}</Text>
          {!!(r.driver?.full_name || r.driver_name) && (
            <Text style={s.small}>{r.driver?.full_name || r.driver_name}</Text>
          )}
          <View style={s.rowBetween}>
            <Text style={s.heading}>
              {money(r.final_fare?.total ?? r.estimate?.fare?.total ?? 0)}
            </Text>
            <Ionicons name="chevron-forward" size={21} color={colors.blue} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
