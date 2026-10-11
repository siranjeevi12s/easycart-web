/** Screen container: themed background + safe-area-aware padding. */
import React from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

interface Props {
  children: React.ReactNode;
  padded?: boolean;
  topPad?: number;
  scroll?: boolean;
  refreshControl?: React.ReactElement;
  style?: ViewStyle;
}

export function Screen({ children, padded = true, topPad = 16, scroll = true, refreshControl, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View
      style={[
        { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + topPad, paddingBottom: insets.bottom + 16 },
        padded && { paddingHorizontal: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!scroll) return body;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl as any}
    >
      {body}
    </ScrollView>
  );
}
