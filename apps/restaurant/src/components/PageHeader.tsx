import { Typography, Box } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  sub?: string;
  action?: ReactNode;
}

/** Consistent page heading + subline + optional action row. */
export default function PageHeader({ title, sub, action }: Props) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        {sub && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {sub}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
