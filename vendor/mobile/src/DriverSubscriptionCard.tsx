import { Text } from './themed-primitives';
import React from 'react';
import { Pressable, View } from 'react-native';
import {
  money,
  cargoOnly,
  subscriptionAmount,
  subscriptionDue,
  type Category,
  type Language,
  type SubscriptionMonths,
} from '@nexadrop/core';
import { useTheme } from './theme';
import { Button } from './ui';
export function DriverSubscriptionCard({
  driver,
  language,
  period,
  onPeriod,
  pay,
  currentPeriod = 1,
}: {
  driver: any;
  language: Language;
  period: SubscriptionMonths;
  onPeriod: (p: SubscriptionMonths) => void;
  pay: () => void;
  currentPeriod?: SubscriptionMonths;
}) {
  const { s, colors } = useTheme();
  const sw = language === 'sw',
    status = subscriptionDue(driver);
  const category: Category = driver?.category || 'boda';
  const months = status.due ? period : currentPeriod;
  const approved = driver?.approval === 'approved';
  return (
    <View style={s.card}>
      <Text style={s.heading}>
        {sw ? 'Usajili wa dereva' : 'Driver subscription'}
      </Text>
      <Text style={s.bold}>
        {
          {
            boda: 'Boda',
            bajaji: 'Bajaji',
            car: 'Car Basic',
            toyo: 'Toyo',
            kirikuu: 'Kirikuu',
            truck: sw ? 'Lori' : 'Truck',
          }[category]
        }
      </Text>
      {status.due && (
        <View style={s.row}>
          {([1, 12] as const).map((n) => (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: period === n }}
              onPress={() => onPeriod(n)}
              style={[s.typeChip, period === n && s.selected]}
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
      <Text style={s.fare}>{money(subscriptionAmount(category, months))}</Text>
      <Text style={s.small}>
        {months === 12
          ? sw
            ? 'Mwaka mmoja'
            : 'One year'
          : sw
            ? 'Mwezi mmoja'
            : 'One month'}{' '}
        · {sw ? 'Kodi imejumuishwa' : 'Tax inclusive'}
      </Text>
      <Text style={s.small}>
        {sw ? 'Hakuna kamisheni kwa safari' : 'Zero commission on rides'}
      </Text>
      {!!status.dueAt && (
        <Text style={s.bold}>
          {sw ? 'Tarehe ya malipo' : 'Payment due'}:{' '}
          {new Date(status.dueAt).toLocaleDateString(sw ? 'sw-TZ' : 'en-TZ', {
            timeZone: 'Africa/Dar_es_Salaam',
          })}
        </Text>
      )}
      {cargoOnly(category) ? (
        <Text style={s.small}>
          {sw
            ? 'Usajili huu haujaanza kutozwa. Malipo na majaribio vitaanza baada ya huduma ya usafirishaji kuwezeshwa.'
            : 'This plan is not being charged yet. Payment and trial activation await delivery launch.'}
        </Text>
      ) : status.due ? (
        approved ? (
          <Button
            title={sw ? 'Lipa usajili' : 'Recharge subscription'}
            onPress={pay}
          />
        ) : (
          <Text style={s.small}>
            {sw
              ? 'Usajili wa kulipia utaanza baada ya kuidhinishwa na kipindi cha majaribio kuisha.'
              : 'Paid subscriptions become available after approval and the free trial.'}
          </Text>
        )
      ) : null}
    </View>
  );
}
