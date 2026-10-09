/** Typography primitive bound to the token scale + active palette. */
import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { type } from '../theme/tokens';

type Variant = keyof typeof type;
type Tone = 'text' | 'muted' | 'faint' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'onPrimary';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  children: React.ReactNode;
  style?: TextStyle;
}

export function AppText({ variant = 'body', tone = 'text', children, style, ...rest }: Props) {
  const theme = useTheme();
  const colors: Record<Tone, string> = {
    text: theme.colors.onBackground,
    muted: theme.colors.onSurfaceVariant,
    faint: '#9CA3AF',
    primary: theme.colors.primary,
    success: '#16A34A',
    warning: '#B45309',
    error: theme.colors.error,
    info: '#1D4ED8',
    onPrimary: theme.colors.onPrimary,
  };
  return (
    <RNText style={[{ ...type[variant] } as TextStyle, { color: colors[tone] }, style]} {...rest}>
      {children}
    </RNText>
  );
}
