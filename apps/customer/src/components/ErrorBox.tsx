/** Inline error card with message + retry action. */
import { View } from 'react-native';
import { Icon } from 'react-native-paper';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { useAppThemeMode } from '../theme/ThemeContext';
import { palette } from '../theme/tokens';

interface Props {
  message: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorBox({ message, detail, onRetry, retryLabel = 'Retry' }: Props) {
  const { mode } = useAppThemeMode();
  const p = palette[mode];
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: p.errorSoft,
        borderWidth: 1,
        borderColor: p.error,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon source="alert-circle" size={20} color={p.error} />
        <AppText variant="bodyBold" tone="error" style={{ flex: 1 }}>
          {message}
        </AppText>
      </View>
      {!!detail && (
        <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {detail}
        </AppText>
      )}
      {!!onRetry && (
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <AppButton title={retryLabel} onPress={onRetry} compact variant="primary" />
        </View>
      )}
    </View>
  );
}
