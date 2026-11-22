import { Text } from './themed-primitives';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type Language } from '@nexadrop/core';
import { api, preview } from './client';
import { useTheme } from './theme';
import { Button } from './ui';
export const accountWords = {
  sw: {
    settings: 'Mipangilio ya akaunti',
    back: 'Rudi kwenye akaunti',
    language: 'Lugha chaguomsingi',
    devices: 'Vifaa vilivyoingia',
    current: 'Kifaa hiki',
    revoke: 'Ondoa kifaa',
    signed: 'Iliingia',
    seen: 'Ilitumika mwisho',
    unknown: 'Kifaa kisichojulikana',
    deactivate: 'Zima akaunti kwa muda',
    deactivateHelp:
      'Utatoka kwenye vifaa vyote. Thibitisha namba yako kwa OTP kuifungua tena.',
    delete: 'Futa akaunti kabisa',
    deleteHelp:
      'Wasifu na nyaraka zako zitaondolewa. Rekodi za safari na malipo zinazohitajika kuhifadhiwa zitaendelea kuwepo. Hatua hii haiwezi kubatilishwa.',
    cancel: 'Ghairi',
    retry: 'Jaribu tena',
    error: 'Imeshindikana kupakia vifaa.',
    preview: 'Akaunti hii ya majaribio imehifadhiwa kwenye kifaa hiki pekee.',
    revokeHelp: 'Kifaa hiki kitaondolewa kwenye akaunti yako.',
    edit: 'Hariri',
    logout: 'Ondoka',
    active: 'Maliza au ghairi safari yako kwanza.',
  },
  en: {
    settings: 'Account settings',
    back: 'Back to account',
    language: 'Default language',
    devices: 'Signed-in devices',
    current: 'This device',
    revoke: 'Revoke device',
    signed: 'Signed in',
    seen: 'Last used',
    unknown: 'Unknown device',
    deactivate: 'Deactivate account',
    deactivateHelp:
      'You will be signed out on all devices. Verify your phone with an OTP to reactivate.',
    delete: 'Permanently delete account',
    deleteHelp:
      'Your profile and documents will be removed. Trip and payment records that must be retained will remain. This cannot be undone.',
    cancel: 'Cancel',
    retry: 'Try again',
    error: 'Could not load devices.',
    preview: 'This preview account is stored on this device only.',
    revokeHelp: 'This device will be signed out of your account.',
    edit: 'Edit',
    logout: 'Log out',
    active: 'Finish or cancel your active ride first.',
  },
};
export function AccountSettings({
  lang,
  changeLanguage,
  close,
  remove,
}: {
  lang: Language;
  changeLanguage: (l: Language) => void;
  close: () => void;
  remove: (kind: 'deactivate' | 'delete') => void;
}) {
  const { s, colors, preference, setPreference } = useTheme();
  const t = accountWords[lang];
  const [devices, setDevices] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  async function refresh() {
    if (preview) return;
    setLoading(true);
    setError(false);
    try {
      setDevices(await api('/sessions'));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <View style={{ gap: 18 }}>
      <Pressable style={s.row} onPress={close}>
        <Ionicons name="arrow-back" size={23} color={colors.blue} />
        <Text style={s.link}>{t.back}</Text>
      </Pressable>
      <View style={s.card}>
        <Text style={s.heading}>
          {lang === 'sw' ? 'Muonekano' : 'Appearance'}
        </Text>
        {(['system', 'light', 'dark'] as const).map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityState={{ checked: preference === choice }}
            style={[
              s.typeChip,
              s.rowBetween,
              preference === choice && s.selected,
            ]}
            onPress={() =>
              void setPreference(choice).catch(() =>
                Alert.alert(
                  lang === 'sw'
                    ? 'Imeshindikana kuhifadhi muonekano'
                    : 'Could not save appearance',
                ),
              )
            }
          >
            <View style={s.row}>
              <Ionicons
                name={
                  choice === 'system'
                    ? 'phone-portrait-outline'
                    : choice === 'light'
                      ? 'sunny-outline'
                      : 'moon-outline'
                }
                size={23}
                color={colors.blue}
              />
              <Text style={s.bold}>
                {choice === 'system'
                  ? lang === 'sw'
                    ? 'Tumia mipangilio ya kifaa'
                    : 'Use device settings'
                  : choice === 'light'
                    ? lang === 'sw'
                      ? 'Mwanga'
                      : 'Light'
                    : lang === 'sw'
                      ? 'Giza'
                      : 'Dark'}
              </Text>
            </View>
            <Ionicons
              name={
                preference === choice ? 'radio-button-on' : 'radio-button-off'
              }
              size={22}
              color={colors.blue}
            />
          </Pressable>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.heading}>{t.language}</Text>
        <View style={s.row}>
          {(['sw', 'en'] as const).map((l) => (
            <Pressable
              key={l}
              onPress={() => changeLanguage(l)}
              style={[s.typeChip, lang === l && s.selected]}
            >
              <Text style={s.bold}>{l === 'sw' ? 'Kiswahili' : 'English'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>{t.devices}</Text>
        {preview && <Text style={s.small}>{t.preview}</Text>}
        {loading && <ActivityIndicator color={colors.blue} />}
        {error && (
          <>
            <Text style={s.small}>{t.error}</Text>
            <Button title={t.retry} onPress={() => void refresh()} />
          </>
        )}
        {devices.map((d) => (
          <View key={d.id} style={s.photoSection}>
            <View style={s.row}>
              <Ionicons
                name="phone-portrait-outline"
                size={24}
                color={colors.blue}
              />
              <Text style={s.bold}>
                {d.device_name === 'Unknown device' ? t.unknown : d.device_name}
                {d.current ? ` · ${t.current}` : ''}
              </Text>
            </View>
            <Text style={s.small}>
              {t.signed}:{' '}
              {new Date(d.created_at).toLocaleString(
                lang === 'sw' ? 'sw-TZ' : 'en-TZ',
                {
                  timeZone: 'Africa/Dar_es_Salaam',
                },
              )}
            </Text>
            <Text style={s.small}>
              {t.seen}:{' '}
              {new Date(d.last_seen_at).toLocaleString(
                lang === 'sw' ? 'sw-TZ' : 'en-TZ',
                {
                  timeZone: 'Africa/Dar_es_Salaam',
                },
              )}
            </Text>
            {!d.current && (
              <Button
                title={t.revoke}
                secondary
                onPress={() =>
                  Alert.alert(t.revoke, t.revokeHelp, [
                    { text: t.cancel, style: 'cancel' },
                    {
                      text: t.revoke,
                      style: 'destructive',
                      onPress: () =>
                        void (async () => {
                          try {
                            await api('/sessions/' + d.id, undefined, 'DELETE');
                            await refresh();
                          } catch {
                            setError(true);
                          }
                        })(),
                    },
                  ])
                }
              />
            )}
          </View>
        ))}
      </View>
      <Button
        title={t.deactivate}
        secondary
        onPress={() =>
          Alert.alert(t.deactivate, t.deactivateHelp, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.deactivate,
              style: 'destructive',
              onPress: () => remove('deactivate'),
            },
          ])
        }
      />
      <Button
        title={t.delete}
        danger
        onPress={() =>
          Alert.alert(t.delete, t.deleteHelp, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.delete,
              style: 'destructive',
              onPress: () => remove('delete'),
            },
          ])
        }
      />
    </View>
  );
}
