/** Static skeleton placeholders for list loading states (no animation deps). */
import { View, type DimensionValue } from 'react-native';
import { useTheme } from 'react-native-paper';

function Bar({ width = '100%', height = 14 }: { width?: DimensionValue; height?: number }) {
  const theme = useTheme();
  return <View style={{ width, height, borderRadius: 7, backgroundColor: theme.colors.surfaceVariant }} />;
}

export function CardSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 90, height: 90, borderRadius: 10, backgroundColor: theme.colors.surfaceVariant }} />
      <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
        <Bar width="70%" height={15} />
        <Bar width="90%" />
        <Bar width="40%" />
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ paddingTop: 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}
