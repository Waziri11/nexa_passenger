import React from 'react';
import { SvgXml } from 'react-native-svg';
import { primary, reversed } from './brand-assets';
import { useTheme } from './theme';
export function BrandMark({ size = 44 }: { size?: number }) {
  const { scheme } = useTheme();
  return (
    <SvgXml
      xml={scheme === 'dark' ? reversed : primary}
      width={Math.max(94, size * 2.4)}
      height={size}
      accessibilityLabel="Nexadrop"
    />
  );
}
