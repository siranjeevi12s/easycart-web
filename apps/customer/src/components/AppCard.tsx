/** Card primitive: themed surface, consistent radius + padding. */
import React from 'react';
import { Image } from 'react-native';
import { Card as PaperCard, useTheme } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function AppCard({ children, onPress, padded = true, outlined = false, style, accessibilityLabel }: Props) {
  const theme = useTheme();
  return (
    <PaperCard
      mode={outlined ? 'outlined' : 'elevated'}
      onPress={onPress}
      style={[
        { borderRadius: 14, marginBottom: 12, backgroundColor: theme.colors.surface },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      <PaperCard.Content style={padded ? { padding: 14 } : { padding: 0 }}>{children}</PaperCard.Content>
    </PaperCard>
  );
}

/** Fixed-size cover image for horizontal cards (rounded on the left edge). */
export function CoverImage({ uri, width = 110, height = 110 }: { uri?: string; width?: number; height?: number }) {
  if (!uri) return <></>;
  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}
      accessibilityRole="image"
    />
  );
}
