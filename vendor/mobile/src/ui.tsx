import { Text, TextInput } from './themed-primitives';
import React from 'react';
import { Pressable, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from './theme';
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { s, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: colors.danger },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && { color: colors.blue },
          danger && { color: colors.onPrimary },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  keyboard = 'default',
  multiline = false,
  placeholder,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: KeyboardTypeOptions;
  multiline?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { s, colors } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          s.input,
          multiline && { height: 120, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
        multiline={multiline}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </View>
  );
}
