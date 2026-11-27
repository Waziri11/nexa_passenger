import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from './themed-primitives';
import { Field, Button } from './ui';
import { useTheme } from './theme';
import { cargoSchema, type ServiceKind, type Language } from '@nexadrop/core';
export type CargoDraft = {
  description: string;
  weight: string;
  fragile: boolean | null;
};
export const emptyCargo: CargoDraft = {
  description: '',
  weight: '',
  fragile: null,
};
export function parseCargo(draft: CargoDraft) {
  return cargoSchema.safeParse({
    description: draft.description,
    estimatedWeightKg: Number(draft.weight.replace(',', '.')),
    fragile: draft.fragile,
  });
}
export function ServiceChoice({
  visible,
  language,
  choose,
  close,
}: {
  visible: boolean;
  language: Language;
  choose: (kind: ServiceKind) => void;
  close: () => void;
}) {
  const { s } = useTheme();
  const sw = language === 'sw';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={s.modalScrim} onPress={close}>
        <Pressable style={s.modalCard} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <Text style={s.title}>
              {sw ? 'Unahitaji huduma gani?' : 'What would you like to book?'}
            </Text>
            <Button
              title={sw ? 'Safari ya abiria' : 'Passenger ride'}
              onPress={() => choose('ride')}
            />
            <Text style={s.small}>
              {sw ? 'Boda, Bajaji au Gari' : 'Boda, Bajaji or Car'}
            </Text>
            <Button
              title={sw ? 'Usafirishaji wa mzigo' : 'Delivery'}
              tone="delivery"
              onPress={() => choose('delivery')}
            />
            <Text style={s.small}>
              {sw
                ? 'Boda, Bajaji, Gari, Toyo, Kirikuu au Lori'
                : 'Boda, Bajaji, Car, Toyo, Kirikuu or Truck'}
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
export function CargoFields({
  value,
  onChange,
  language,
}: {
  value: CargoDraft;
  onChange: (draft: CargoDraft) => void;
  language: Language;
}) {
  const { s } = useTheme();
  const sw = language === 'sw';
  const invalidWeight =
    (!!value.weight &&
      !Number.isFinite(Number(value.weight.replace(',', '.')))) ||
    (!!value.weight && Number(value.weight.replace(',', '.')) <= 0);
  return (
    <View style={s.card}>
      <Text style={s.heading}>{sw ? 'Maelezo ya mzigo' : 'Cargo details'}</Text>
      <Field
        label={sw ? 'Unasafirisha nini? *' : 'What are you transporting? *'}
        value={value.description}
        onChange={(text) =>
          onChange({ ...value, description: text.slice(0, 1000) })
        }
        multiline
        placeholder={
          sw
            ? 'Mfano: maboksi ya bidhaa, samani'
            : 'For example: cartons of goods, furniture'
        }
      />
      <Field
        label={
          sw
            ? 'Uzito wa jumla unaokadiriwa (kg) *'
            : 'Estimated total weight (kg) *'
        }
        value={value.weight}
        onChange={(text) => onChange({ ...value, weight: text })}
        keyboard="decimal-pad"
      />
      {invalidWeight && (
        <Text accessibilityRole="alert" style={s.small}>
          {sw
            ? 'Weka uzito halali ulio zaidi ya sifuri.'
            : 'Enter a valid weight greater than zero.'}
        </Text>
      )}
      <Text style={s.label}>
        {sw
          ? 'Kuna vitu vinavyovunjika kwa urahisi? *'
          : 'Are any items fragile? *'}
      </Text>
      <View style={s.row}>
        {([true, false] as const).map((fragile) => (
          <Pressable
            key={String(fragile)}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.fragile === fragile }}
            style={[s.typeChip, value.fragile === fragile && s.selected]}
            onPress={() => onChange({ ...value, fragile })}
          >
            <Text style={s.bold}>
              {fragile ? (sw ? 'Ndiyo' : 'Yes') : sw ? 'Hapana' : 'No'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function CargoSummary({
  cargo,
  language,
}: {
  cargo: unknown;
  language: Language;
}) {
  const { s } = useTheme();
  const parsed = cargoSchema.safeParse(cargo);
  if (!parsed.success) return null;
  const sw = language === 'sw';
  return (
    <View style={s.card}>
      <Text style={s.heading}>{sw ? 'Mzigo' : 'Cargo'}</Text>
      <Text style={s.bold}>{parsed.data.description}</Text>
      <Text style={s.small}>
        {sw ? 'Uzito unaokadiriwa' : 'Estimated weight'}:{' '}
        {parsed.data.estimatedWeightKg} kg
      </Text>
      <Text style={s.small}>
        {sw ? 'Vitu vinavyovunjika' : 'Fragile items'}:{' '}
        {parsed.data.fragile ? (sw ? 'Ndiyo' : 'Yes') : sw ? 'Hapana' : 'No'}
      </Text>
    </View>
  );
}
