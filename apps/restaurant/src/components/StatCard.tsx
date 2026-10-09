import { Card, CardContent, Typography } from '@mui/material';
import { brand } from '../theme/tokens';

interface Props {
  value: number | string;
  label: string;
  highlight?: boolean;
}

/** Dashboard metric card; highlight uses the brand fill. */
export default function StatCard({ value, label, highlight = false }: Props) {
  return (
    <Card sx={highlight ? { bgcolor: brand.primary, color: 'white' } : undefined}>
      <CardContent>
        <Typography variant="h3" fontWeight={800}>
          {value}
        </Typography>
        <Typography color={highlight ? 'white' : 'text.secondary'}>{label}</Typography>
      </CardContent>
    </Card>
  );
}
