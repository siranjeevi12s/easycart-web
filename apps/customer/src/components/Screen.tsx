/** Screen container: themed background + safe-area-aware padding. */
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

interface Props {
  children: React.ReactNode;
  padded?: boolean;
  topPad?: number;
  style?: ViewStyle;
}

export function Screen({ children, padded = true, topPad = 16, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + topPad },
        padded && { paddingHorizontal: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
