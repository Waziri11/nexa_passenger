import { z } from 'zod';
export const categories = ['boda', 'bajaji', 'car'] as const;
export type Category = (typeof categories)[number];
export type Role = 'passenger' | 'driver' | 'admin';
export type Point = { latitude: number; longitude: number };
export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export const colors = {
  blue: '#1463FF',
  navy: '#10213B',
  muted: '#69788E',
  background: '#F3F7FC',
  border: '#E1E8F2',
  green: '#13865A',
};
export type Tariff = {
  version: string;
  base: number;
  perKm: number;
  perMinute: number;
  minimum: number;
  waitingPerMinute: number;
  freeWaitingSeconds: number;
  rounding?: 'up_500' | 'whole_tzs';
};
export const tariffs: Record<Category, Tariff> = {
  boda: {
    version: '2026-05-01',
    rounding: 'up_500',
    base: 400,
    perKm: 400,
    perMinute: 90,
    minimum: 1500,
    waitingPerMinute: 90,
    freeWaitingSeconds: 300,
  },
  bajaji: {
    version: '2026-05-01',
    rounding: 'up_500',
    base: 500,
    perKm: 700,
    perMinute: 90,
    minimum: 3000,
    waitingPerMinute: 90,
    freeWaitingSeconds: 300,
  },
  car: {
    version: '2026-05-01',
    rounding: 'up_500',
    base: 1100,
    perKm: 1100,
    perMinute: 120,
    minimum: 4000,
    waitingPerMinute: 90,
    freeWaitingSeconds: 300,
  },
};
export const subscriptions: Record<Category, number> = {
  boda: 20000,
  bajaji: 30000,
  car: 40000,
};
export type SubscriptionMonths = 1 | 12;
export function subscriptionAmount(
  category: Category,
  months: SubscriptionMonths = 1,
) {
  if (months !== 1 && months !== 12)
    throw new Error('Invalid subscription duration');
  return subscriptions[category] * months;
}
export function subscriptionDue(
  driver:
    | {
        trial_ends_at?: string | Date | null;
        paid_until?: string | Date | null;
      }
    | null
    | undefined,
  now = Date.now(),
) {
  const expiry = Math.max(
    0,
    ...[driver?.trial_ends_at, driver?.paid_until].map((value) => {
      const stamp = value ? new Date(value).getTime() : 0;
      return Number.isFinite(stamp) ? stamp : 0;
    }),
  );
  return {
    due: expiry <= now,
    dueAt: expiry ? new Date(expiry).toISOString() : null,
  };
}

// Cash-friendly ride totals only. Do not use this for subscriptions, tax or provider fees.
export function roundRideFare(amount: number) {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error('Invalid fare amount');
  // Remove floating-point noise without discarding meaningful fractions of a shilling.
  return Math.ceil(Math.round(amount * 1e6) / 1e6 / 500) * 500;
}
export function fare(
  t: Tariff,
  meters: number,
  seconds: number,
  waitingSeconds = 0,
) {
  if (
    ![meters, seconds, waitingSeconds].every(
      (n) => Number.isFinite(n) && n >= 0,
    )
  )
    throw new Error('Invalid journey measurements');
  const distance = (meters / 1000) * t.perKm,
    time = (seconds / 60) * t.perMinute;
  const waiting =
    (Math.max(0, waitingSeconds - t.freeWaitingSeconds) / 60) *
    t.waitingPerMinute;
  const subtotal = t.base + distance + time;
  const unroundedTotal =
    Math.round((Math.max(t.minimum, subtotal) + waiting) * 1e6) / 1e6;
  // Missing policy belongs to an older booking snapshot and retains whole-TZS pricing.
  const total =
    t.rounding === 'up_500'
      ? roundRideFare(unroundedTotal)
      : Math.round(unroundedTotal);
  return {
    base: t.base,
    distance,
    time,
    minimumAdjustment: Math.max(0, t.minimum - subtotal),
    waiting,
    unroundedTotal,
    roundingAdjustment: total - unroundedTotal,
    roundingIncrement: t.rounding === 'up_500' ? 500 : 1,
    total,
  };
}
export function addMonth(date: Date) {
  return addMonths(date, 1);
}
export function addMonths(date: Date, months: number) {
  if (!Number.isInteger(months) || months < 1)
    throw new Error('Invalid calendar-month duration');
  // Calendar dates are defined in Tanzania (UTC+3), including month/year end clamping.
  const offset = 3 * 60 * 60 * 1000;
  const result = new Date(date.getTime() + offset);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return new Date(result.getTime() - offset);
}
export function distance(a: Point, b: Point) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const v =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
export const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const phoneSchema = z
  .string()
  .regex(/^\+255[67]\d{8}$/, 'Use +255 followed by your mobile number');
export const registrationSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  email: z.string().email(),
  marketingConsent: z.boolean().default(false),
  role: z.enum(['passenger', 'driver']),
});
export const requestSchema = z.object({
  pickup: pointSchema,
  destination: pointSchema,
  pickupLabel: z.string().min(2).max(200),
  destinationLabel: z.string().min(2).max(200),
  category: z.enum(categories),
  stops: z
    .array(pointSchema.extend({ label: z.string().min(2).max(200) }))
    .max(3)
    .default([]),
});
export const driverSchema = z.object({
  category: z.enum(categories),
  plate: z.string().trim().min(4).max(20),
  vehicleColor: z.string().trim().min(2).max(40),
  licenceNumber: z.string().min(4).max(80),
  licenceExpiry: z.string().date(),
  profilePhoto: z.string().uuid(),
  licenceFront: z.string().uuid(),
  licenceBack: z.string().uuid(),
  vehiclePhoto: z.string().uuid(),
});
export const translations = {
  sw: {
    home: 'Nyumbani',
    trips: 'Safari',
    account: 'Akaunti',
    hello: 'Habari',
    where: 'Unakwenda wapi?',
    pickup: 'Mahali pa kukuchukua',
    destination: 'Unakoenda',
    request: 'Omba safari',
    estimate: 'Makadirio ya nauli',
    driver: 'Dereva',
    passenger: 'Abiria',
    continue: 'Endelea',
    phone: 'Namba ya simu',
    name: 'Jina kamili',
    email: 'Barua pepe',
    verify: 'Thibitisha',
    otp: 'Nambari ya uthibitisho',
    welcome: 'Karibu Flash',
    tagline: 'Safari yako. Kwa urahisi.',
    online: 'Anza kupokea safari',
    offline: 'Acha kupokea safari',
    subscription: 'Usajili wa mwezi',
    earnings: 'Mapato yako',
    noCommission: 'Mapato yote ni yako. Kamisheni 0%.',
    trial: 'Mwezi mmoja bila malipo',
    cancel: 'Ghairi safari',
    reason: 'Sababu ya kughairi',
    arrived: 'Nimefika',
    start: 'Anza safari',
    finish: 'Maliza safari',
    towing: 'Msaada wa kuvuta gari',
    rating: 'Kadiria safari',
    comment: 'Maoni',
    submit: 'Tuma',
    logout: 'Ondoka',
    preview: 'HAKIKI YA MAJARIBIO • Safari na huduma zimeigwa',
    marketing: 'Nakubali kupokea matangazo kwa barua pepe',
    waiting: 'Dakika 5 za kusubiri bure; kisha TZS 90/dakika',
    company: 'Bidhaa ya Stryxis Technologies',
    empty: 'Hakuna safari bado',
    documents: 'Nyaraka za dereva',
    save: 'Hifadhi',
    payment: 'Malipo moja kwa moja kwa dereva',
    report: 'Ripoti tatizo',
    delete: 'Futa akaunti',
  },
  en: {
    home: 'Home',
    trips: 'Trips',
    account: 'Account',
    hello: 'Hello',
    where: 'Where are you going?',
    pickup: 'Pickup location',
    destination: 'Destination',
    request: 'Request a ride',
    estimate: 'Estimated fare',
    driver: 'Driver',
    passenger: 'Passenger',
    continue: 'Continue',
    phone: 'Phone number',
    name: 'Full name',
    email: 'Email address',
    verify: 'Verify',
    otp: 'Verification code',
    welcome: 'Welcome to Flash',
    tagline: 'Your city. Your way.',
    online: 'Go online',
    offline: 'Go offline',
    subscription: 'Monthly subscription',
    earnings: 'Your earnings',
    noCommission: 'Keep every fare. 0% commission.',
    trial: 'One month free',
    cancel: 'Cancel ride',
    reason: 'Cancellation reason',
    arrived: 'I have arrived',
    start: 'Start trip',
    finish: 'End trip',
    towing: 'Roadside towing help',
    rating: 'Rate your trip',
    comment: 'Comment',
    submit: 'Submit',
    logout: 'Sign out',
    preview: 'DEMO PREVIEW • Rides and services are simulated',
    marketing: 'I agree to receive promotional emails',
    waiting: '5 minutes free waiting; then TZS 90/minute',
    company: 'A Stryxis Technologies product',
    empty: 'No trips yet',
    documents: 'Driver documents',
    save: 'Save',
    payment: 'Pay your driver directly',
    report: 'Report an issue',
    delete: 'Delete account',
  },
};
export type Language = keyof typeof translations;
export const money = (amount: number) =>
  `TZS ${Math.round(amount).toLocaleString('en-TZ')}`;

/** Decode Google's encoded polyline format; never draw an invented straight-line route. */
export function decodePolyline(encoded: string): Point[] {
  const points: Point[] = [];
  let index = 0,
    latitude = 0,
    longitude = 0;
  function next() {
    let shift = 0,
      value = 0,
      byte = 0;
    do {
      if (index >= encoded.length || shift > 30)
        throw new Error('Invalid route geometry');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid route geometry');
      value |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  }
  while (index < encoded.length) {
    latitude += next();
    longitude += next();
    const p = { latitude: latitude / 1e5, longitude: longitude / 1e5 };
    if (!pointSchema.safeParse(p).success)
      throw new Error('Invalid route geometry');
    points.push(p);
  }
  return points;
}
export type {
  PaymentEnvironment,
  PaymentMethod,
  SubscriptionPaymentStatus,
  SubscriptionPaymentSummary,
} from './payments';
export {
  passengerCancelCodes,
  passengerCancelSchema,
  passengerCancellation,
  DRIVER_SEARCH_SECONDS,
  rideSearchExpired,
} from './ride-options';
