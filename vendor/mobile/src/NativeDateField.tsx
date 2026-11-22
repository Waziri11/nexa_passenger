import { Text } from './themed-primitives';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { type Language } from '@nexadrop/core';
import { useTheme } from './theme';
export function NativeDateField({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lang: Language;
}) {
  const { s, colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + 'T12:00:00') : new Date();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(!open)}
        style={[s.input, s.rowBetween]}
      >
        <Text style={s.bold}>
          {value
            ? date.toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-TZ')
            : lang === 'sw'
              ? 'Chagua tarehe'
              : 'Choose date'}
        </Text>
        <Ionicons name="calendar-outline" size={23} color={colors.blue} />
      </Pressable>
      {open && (
        <>
          <DateTimePicker
            value={date}
            mode="date"
            themeVariant={scheme}
            accentColor={colors.blue}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            locale={lang === 'sw' ? 'sw-TZ' : 'en-TZ'}
            onChange={(event, next) => {
              if (Platform.OS !== 'ios') setOpen(false);
              if (event.type !== 'dismissed' && next)
                onChange(
                  `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
                );
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={() => {
                if (!value)
                  onChange(
                    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                  );
                setOpen(false);
              }}
            >
              <Text style={s.link}>{lang === 'sw' ? 'Sawa' : 'Done'}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}
