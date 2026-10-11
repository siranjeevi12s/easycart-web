/** Status pill: semantic soft-background chip for order/payment states. */
import { Chip as PaperChip, useTheme } from 'react-native-paper';
import { orderStatusKind, palette, type StatusKind } from '../theme/tokens';
import { useAppThemeMode } from '../theme/ThemeContext';

interface Props {
  status: string;
  kind?: StatusKind;
  compact?: boolean;
}

export function StatusChip({ status, kind, compact = true }: Props) {
  const theme = useTheme();
  const { mode } = useAppThemeMode();
  const k = kind || orderStatusKind(status);
  const p = palette[mode];
  const bg: Record<StatusKind, string> = {
    success: p.successSoft,
    warning: p.warningSoft,
    error: p.errorSoft,
    info: p.infoSoft,
    muted: theme.colors.surfaceVariant,
  };
  const fg: Record<StatusKind, string> = {
    success: p.success,
    warning: p.warning,
    error: p.error,
    info: p.info,
    muted: p.muted,
  };
  return (
    <PaperChip compact={compact} style={{ backgroundColor: bg[k] }} textStyle={{ color: fg[k], fontSize: 11, fontWeight: '700' }}>
      {status}
    </PaperChip>
  );
}
