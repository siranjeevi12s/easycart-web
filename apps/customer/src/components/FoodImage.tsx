/** Remote food image with graceful fallback (icon tile when missing/fails). */
import { useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

interface Props {
  uri?: string;
  width: number;
  height: number;
  rounded?: boolean;
  style?: StyleProp<ImageStyle>;
}

export function FoodImage({ uri, width, height, rounded = true, style }: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View
        style={[
          { width, height, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
          rounded && { borderRadius: 10 },
          style,
        ]}
        accessibilityRole="image"
        accessibilityLabel="No image available"
      >
        <Icon source="food" size={Math.min(width, height) * 0.4} color={theme.colors.outline} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={[{ width, height }, rounded && { borderRadius: 10 }, style]}
      accessibilityRole="image"
    />
  );
}
