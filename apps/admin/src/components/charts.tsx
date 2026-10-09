import { Box, Chip, Typography } from '@mui/material';

/** Shared rich tooltip: formatted label + ₹ values, themed surface. */
export function ChartTooltip({ active, payload, label, moneyKeys = ['gmv'] }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1, boxShadow: 3 }}>
      {!!label && <Typography variant="caption" fontWeight={700}>{label}</Typography>}
      {payload.map((p: any, i: number) => (
        <Typography key={i} variant="caption" display="block" sx={{ color: p.color || p.payload?.fill || 'text.primary' }}>
          {p.name}: <b>{moneyKeys.includes(p.dataKey) ? `₹${Number(p.value || 0).toLocaleString('en-IN')}` : p.value}</b>
        </Typography>
      ))}
    </Box>
  );
}

/** Series on/off toggle chips for multi-metric charts. */
export function SeriesToggle({ options, active, onChange }: { options: { key: string; label: string; color: string }[]; active: string[]; onChange: (next: string[]) => void }) {
  const flip = (k: string) =>
    onChange(active.includes(k) ? active.filter((x) => x !== k) : [...active, k]);
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
      {options.map((o) => {
        const on = active.includes(o.key);
        return (
          <Chip
            key={o.key}
            size="small"
            label={o.label}
            onClick={() => flip(o.key)}
            sx={{
              fontWeight: 700,
              borderLeft: `4px solid ${o.color}`,
              opacity: on ? 1 : 0.45,
            }}
            aria-pressed={on}
          />
        );
      })}
    </Box>
  );
}
