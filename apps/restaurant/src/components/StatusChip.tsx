import { Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useThemeMode } from '../context/ThemeContext';
import { orderStatusKind, statusSoft, statusStrong, type StatusKind } from '../theme/tokens';

interface Props {
  status: string;
  kind?: StatusKind;
  size?: 'small' | 'medium';
}

/** Theme-aware status pill (replaces hardcoded success/warning hex spreads). */
export default function StatusChip({ status, kind, size = 'small' }: Props) {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const k = kind || orderStatusKind(status);
  return (
    <Chip
      label={status}
      size={size}
      sx={{
        bgcolor: statusSoft(k, mode),
        color: statusStrong(k, mode),
        fontWeight: 700,
        border: `1px solid ${theme.palette.divider}`,
      }}
    />
  );
}
