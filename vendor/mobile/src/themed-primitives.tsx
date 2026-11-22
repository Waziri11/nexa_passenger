import React from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
} from 'react-native';
import { useTheme } from './theme';
export function Text({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <NativeText {...props} style={[{ color: colors.navy }, style]} />;
}
export function TextInput({ style, ...props }: TextInputProps) {
  const { colors, scheme } = useTheme();
  return (
    <NativeTextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.blue}
      keyboardAppearance={scheme}
      {...props}
      style={[{ color: colors.navy }, style]}
    />
  );
}
