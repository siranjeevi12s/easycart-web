/** Initials avatar (fallback when no photo). */
import { Avatar as PaperAvatar, useTheme } from 'react-native-paper';

interface Props {
  name?: string;
  email?: string;
  size?: number;
}

export function Avatar({ name, email, size = 56 }: Props) {
  const theme = useTheme();
  const label = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (email?.[0] || 'U').toUpperCase();
  return <PaperAvatar.Text size={size} label={label} style={{ backgroundColor: theme.colors.primary }} color={theme.colors.onPrimary} />;
}
