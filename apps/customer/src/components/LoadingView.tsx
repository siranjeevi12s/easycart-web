/** Full-area loading indicator on the themed background. */
import { View } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { AppText } from './AppText';

interface Props {
  message?: string;
}

export function LoadingView({ message }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: 24 }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {!!message && (
        <AppText variant="caption" tone="muted" style={{ marginTop: 12 }}>
          {message}
        </AppText>
      )}
    </View>
  );
}
