// Date filters use Tanzania's calendar day, independent of the device timezone.
export function tripDay(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time)
    ? new Date(time + 3 * 3600000).toISOString().slice(0, 10)
    : '';
}
export function validTripDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  );
}
export function filterTrips(trips: any[], search: string, from = '', to = '') {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return trips.filter((r) => {
    const text = [
      r.pickup_label,
      r.destination_label,
      r.driver?.full_name,
      r.driver_name,
      r.passenger?.full_name,
      r.passenger_name,
      ...(r.stops || []).map((s: any) => s.label),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    const day = tripDay(r.created_at);
    return (
      words.every((word) => text.includes(word)) &&
      (!from || day >= from) &&
      (!to || (!!day && day <= to))
    );
  });
}

export function mergeTripHistory(...groups: any[][]) {
  const merged = new Map<string, any>();
  for (const rows of groups)
    for (const ride of rows) {
      if (!ride?.id || !['completed', 'cancelled'].includes(ride.status))
        continue;
      const old = merged.get(ride.id);
      merged.set(ride.id, {
        ...old,
        ...ride,
        my_feedback: ride.my_feedback ?? old?.my_feedback,
      });
    }
  return [...merged.values()].sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
}
export function belongsToPreviewHistory(
  ride: any,
  account: { id?: string; phone: string },
  role: 'passenger' | 'driver',
) {
  if (!ride || !['completed', 'cancelled'].includes(ride.status)) return false;
  return !!(
    (account.id &&
      ride[role === 'passenger' ? 'passenger_id' : 'driver_id'] ===
        account.id) ||
    (ride[role]?.phone && ride[role].phone === account.phone)
  );
}
