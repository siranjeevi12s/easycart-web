/** Button primitive: primary / secondary / outline / text / destructive + loading. */
import { Button as PaperButton, useTheme } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline' | 'text' | 'destructive';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accessibilityLabel?: string;
}

const modeFor: Record<Variant, 'contained' | 'outlined' | 'text' | 'contained-tonal'> = {
  primary: 'contained',
  secondary: 'contained-tonal',
  outline: 'outlined',
  text: 'text',
  destructive: 'contained',
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  compact = false,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const destructive = variant === 'destructive';
  return (
    <PaperButton
      mode={modeFor[variant]}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      compact={compact}
      contentStyle={{ minHeight: compact ? 36 : 48 }}
      style={[
        { borderRadius: 12 },
        destructive && { backgroundColor: theme.colors.error },
        style,
      ]}
      accessibilityLabel={accessibilityLabel || title}
    >
      {title}
    </PaperButton>
  );
}
