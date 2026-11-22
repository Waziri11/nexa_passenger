import { Text, TextInput } from './themed-primitives';
import React, { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  money,
  phoneSchema,
  subscriptionAmount,
  subscriptionDue,
  type Category,
  type SubscriptionMonths,
  type Language,
  type PaymentMethod,
} from '@nexadrop/core';
import { api, uuid } from './client';
import { Button } from './ui';
import { useTheme } from './theme';
export function SubscriptionPayments({
  visible,
  onClose,
  language,
  phone,
  onPaid,
  periodMonths,
  onPeriodChange,
}: {
  visible: boolean;
  onClose: () => void;
  language: Language;
  phone: string;
  onPaid: () => Promise<void>;
  periodMonths: SubscriptionMonths;
  onPeriodChange: (p: SubscriptionMonths) => void;
}) {
  const { s, colors } = useTheme();
  const sw = language === 'sw';
  const [methods, setMethods] = useState<PaymentMethod[]>([]),
    [method, setMethod] = useState(''),
    [payer, setPayer] = useState(phone),
    [orders, setOrders] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [available, setAvailable] = useState(false),
    [mode, setMode] = useState('disabled'),
    [driver, setDriver] = useState<any>(null),
    [coverage, setCoverage] = useState<any>(null);
  const [requestKey, setRequestKey] = useState(uuid());
  const active = orders.find(
    (o) =>
      o.environment === mode &&
      ['creating', 'awaiting_approval', 'processing'].includes(o.status),
  );
  const label = (status: string) =>
    ({
      creating: sw ? 'Tunaandaa malipo' : 'Preparing payment',
      awaiting_approval: sw
        ? 'Thibitisha ombi kwenye simu yako'
        : 'Approve the prompt on your phone',
      processing: sw ? 'Malipo yanachakatwa' : 'Processing payment',
      paid: sw ? 'Imelipwa' : 'Paid',
      failed: sw ? 'Malipo hayakufaulu' : 'Payment unsuccessful',
      cancelled: sw ? 'Malipo yameghairiwa' : 'Payment cancelled',
    })[status] || status;
  const date = (v: string) =>
    new Date(v).toLocaleString(sw ? 'sw-TZ' : 'en-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
    });
  async function refresh() {
    const [capabilities, subscription] = await Promise.all([
      api('/subscriptions/methods'),
      api('/subscriptions'),
    ]);
    setMethods(capabilities.methods);
    setAvailable(capabilities.available);
    setMode(capabilities.mode);
    setDriver(subscription.driver);
    setCoverage(subscription.coverageEstimate);
    const rows = subscription.orders.filter(
      (o: any) => o.provider === 'selcom',
    );
    setOrders(
      rows.map((o: any) => ({
        id: o.id,
        status: o.status,
        environment: o.environment,
        amount: o.amount,
        periodMonths: o.period_months ?? 1,
        checkoutUrl: o.checkout_url,
        coverageStart: o.coverage_start,
        coverageEnd: o.coverage_end,
        reviewRequired: o.review_required,
        paidAt: o.paid_at,
        taxRate: o.tax_rate,
      })),
    );
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch {
      setError(
        sw
          ? 'Huduma ya malipo haipatikani. Hali ya malipo itakaguliwa kabla ya kujaribu tena.'
          : 'Payment service unavailable. Check the existing payment before trying again.',
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!visible) return;
    setPayer(phone);
    setSelected(null);
    void run(refresh);
  }, [visible]);
  useEffect(() => {
    if (!visible || !active) return;
    let stopped = false,
      checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      try {
        const o = await api('/subscriptions/orders/' + active.id);
        if (stopped) return;
        setSelected(o);
        await refresh();
        if (o.status === 'paid') await onPaid();
      } catch {
      } finally {
        checking = false;
      }
    }
    const timer = setInterval(() => void check(), 10000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      listener.remove();
    };
  }, [visible, active?.id]);
  const category: Category = driver?.category || 'boda';
  const months: SubscriptionMonths = active?.periodMonths ?? periodMonths;
  const amount = active?.amount ?? subscriptionAmount(category, months);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.rowBetween}>
            <Text style={s.heading}>
              {sw ? 'Malipo ya usajili' : 'Subscription payment'}
            </Text>
            <Pressable
              accessibilityLabel={sw ? 'Funga' : 'Close'}
              onPress={onClose}
            >
              <Text style={{ fontSize: 26 }}>×</Text>
            </Pressable>
          </View>
          {!active && subscriptionDue(driver).due && (
            <View style={s.row}>
              {([1, 12] as const).map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: periodMonths === n }}
                  onPress={() => {
                    onPeriodChange(n);
                    setRequestKey(uuid());
                  }}
                  style={[s.typeChip, periodMonths === n && s.selected]}
                >
                  <Text style={s.bold}>
                    {n === 1
                      ? sw
                        ? 'Kila mwezi'
                        : 'Monthly'
                      : sw
                        ? 'Kila mwaka'
                        : 'Yearly'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={s.fare}>{money(amount)}</Text>
          <Text style={s.small}>
            {months === 12
              ? sw
                ? 'Mwaka mmoja wa kalenda'
                : 'One calendar year'
              : sw
                ? 'Mwezi mmoja wa kalenda'
                : 'One calendar month'}{' '}
            ·{' '}
            {sw
              ? 'Kodi imejumuishwa. Stryxis hulipa ada za mtoa huduma.'
              : 'Tax inclusive. Stryxis covers gateway fees.'}
          </Text>
          <Text style={s.small}>
            {sw
              ? 'Kipindi huanza baada ya malipo kuthibitishwa au baada ya usajili wa sasa kuisha, kutegemea tarehe ipi ni ya baadaye. Tarehe kamili zitaonekana kwenye risiti.'
              : 'Coverage starts after verified payment or your current coverage ends, whichever is later. Exact dates appear on your receipt.'}
          </Text>
          {coverage && (
            <Text style={s.small}>
              {sw ? 'Makadirio ya kipindi' : 'Estimated coverage'}:{' '}
              {date(coverage.startsAt)} →{' '}
              {date(months === 12 ? coverage.yearlyEndsAt : coverage.endsAt)}
            </Text>
          )}
          {mode === 'sandbox' && (
            <Text style={s.notice}>
              {sw
                ? 'Mazingira ya majaribio. Malipo haya hayaongezi usajili halisi.'
                : 'Sandbox payments do not activate a live subscription.'}
            </Text>
          )}
          {!!error && <Text style={s.error}>{error}</Text>}
          {busy && <ActivityIndicator color={colors.blue} />}
          {!available && (
            <Text style={s.notice}>
              {sw
                ? 'Malipo bado hayajawezeshwa. Tafadhali wasiliana na huduma kwa wateja.'
                : 'Payments are not enabled yet. Please contact customer care.'}
            </Text>
          )}
          {!active && available && subscriptionDue(driver).due && (
            <>
              <Text style={s.bold}>
                {sw ? 'Chagua njia ya malipo' : 'Choose payment method'}
              </Text>
              {!methods.length && (
                <Text style={s.small}>
                  {sw
                    ? 'Hakuna njia iliyothibitishwa bado.'
                    : 'No payment methods have been verified yet.'}
                </Text>
              )}
              {methods.map((m) => (
                <Pressable
                  key={m.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: method === m.code }}
                  onPress={() => setMethod(m.code)}
                  style={[
                    s.card,
                    method === m.code && {
                      borderWidth: 1,
                      borderColor: colors.blue,
                    },
                  ]}
                >
                  <Text style={s.bold}>{m.name}</Text>
                  <Text style={s.small}>
                    {m.kind === 'bank'
                      ? sw
                        ? 'Lipa kupitia benki / TanQR'
                        : 'Bank / TanQR checkout'
                      : sw
                        ? 'Thibitisha ombi la malipo kwenye simu'
                        : 'Approve a mobile payment prompt'}
                  </Text>
                </Pressable>
              ))}
              <Text style={s.label}>
                {sw ? 'Namba ya simu ya kulipia' : 'Payment phone number'}
              </Text>
              <TextInput
                value={payer}
                onChangeText={setPayer}
                keyboardType="phone-pad"
                accessibilityLabel={
                  sw ? 'Namba ya simu ya kulipia' : 'Payment phone number'
                }
                style={s.input}
              />
              <Text style={s.small}>
                {sw
                  ? 'Tumia +255. Nexadrop haitakuomba PIN ya pochi au nenosiri la benki.'
                  : 'Use +255. Nexadrop never asks for your wallet PIN or bank password.'}
              </Text>
              <Button
                disabled={
                  busy ||
                  !method ||
                  !phoneSchema.safeParse(payer).success ||
                  driver?.approval !== 'approved'
                }
                title={sw ? 'Endelea kulipa' : 'Continue to payment'}
                onPress={() =>
                  void run(async () => {
                    const o = await api('/subscriptions/orders', {
                      requestId: requestKey,
                      method,
                      phone: payer,
                      periodMonths,
                    });
                    setSelected(o);
                    setRequestKey(uuid());
                    await refresh();
                  })
                }
              />
            </>
          )}
          {(selected || active) && (
            <View style={s.card}>
              <Text style={s.heading}>
                {label((selected || active).status)}
              </Text>
              {(selected || active).reviewRequired && (
                <Text style={s.notice}>
                  {sw
                    ? 'Malipo yanahitaji ukaguzi. Usilipe tena hadi hali ithibitishwe.'
                    : 'This payment needs review. Do not pay again until its status is confirmed.'}
                </Text>
              )}
              {active && (
                <Button
                  title={sw ? 'Kagua hali ya malipo' : 'Check payment status'}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const o = await api('/subscriptions/orders/' + active.id);
                      setSelected(o);
                      await refresh();
                      if (o.status === 'paid') await onPaid();
                    })
                  }
                />
              )}
              {active?.checkoutUrl && (
                <Button
                  title={
                    sw
                      ? 'Fungua ukurasa salama wa malipo'
                      : 'Open secure checkout'
                  }
                  secondary
                  onPress={() =>
                    void run(async () => {
                      await Linking.openURL(active.checkoutUrl);
                    })
                  }
                />
              )}
              {(selected || active).coverageEnd && (
                <Text style={s.small}>
                  {date((selected || active).coverageStart)} →{' '}
                  {date((selected || active).coverageEnd)}
                </Text>
              )}
            </View>
          )}
          <Text style={s.heading}>
            {sw ? 'Historia na risiti' : 'History and receipts'}
          </Text>
          {orders.map((o) => (
            <Pressable
              style={s.card}
              key={o.id}
              onPress={() =>
                void run(async () =>
                  setSelected(await api('/subscriptions/orders/' + o.id)),
                )
              }
            >
              <Text style={s.bold}>
                {money(o.amount)} ·{' '}
                {o.periodMonths === 12
                  ? sw
                    ? 'Mwaka'
                    : 'Yearly'
                  : sw
                    ? 'Mwezi'
                    : 'Monthly'}{' '}
                · {label(o.status)}
              </Text>
              <Text style={s.small}>{o.id}</Text>
              {o.environment === 'sandbox' && (
                <Text style={s.small}>Sandbox</Text>
              )}
              {o.paidAt && <Text style={s.small}>{date(o.paidAt)}</Text>}
            </Pressable>
          ))}
          {selected?.receipt && (
            <View style={s.card}>
              <Text style={s.bold}>
                {sw ? 'Risiti ya usajili' : 'Subscription receipt'} ·{' '}
                {selected.receipt.number}
              </Text>
              <Text>
                {money(selected.receipt.gross)} ·{' '}
                {selected.receipt.periodMonths === 12
                  ? sw
                    ? 'Mwaka mmoja'
                    : 'One year'
                  : sw
                    ? 'Mwezi mmoja'
                    : 'One month'}
              </Text>
              {selected.receipt.taxPortion !== null && (
                <Text>
                  {sw ? 'Kodi iliyojumuishwa' : 'Included tax'}:{' '}
                  {money(selected.receipt.taxPortion)}
                </Text>
              )}
              <Text>
                {date(selected.receipt.coverageStart)} →{' '}
                {date(selected.receipt.coverageEnd)}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
