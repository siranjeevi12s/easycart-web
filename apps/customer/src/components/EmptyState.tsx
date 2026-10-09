/** Empty-list placeholder: icon + message + optional action. */
import { View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { AppText } from './AppText';

interface Props {
  icon?: string;
  message: string;
  hint?: string;
}

export function EmptyState({ icon = 'tray', message, hint }: Props) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
      <Icon source={icon} size={44} color={theme.colors.outline} />
      <AppText variant="subheading" tone="muted" style={{ marginTop: 12, textAlign: 'center' }}>
        {message}
      </AppText>
      {!!hint && (
        <AppText variant="caption" tone="muted" style={{ marginTop: 4, textAlign: 'center' }}>
          {hint}
        </AppText>
      )}
    </View>
  );
}
