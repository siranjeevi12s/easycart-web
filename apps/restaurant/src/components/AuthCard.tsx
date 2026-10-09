import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ReactNode, FormEvent } from 'react';

interface Props {
  title: string;
  sub: string;
  error?: string;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
}

/** Centered auth card (Login + Register share it). */
export default function AuthCard({ title, sub, error, children, onSubmit }: Props) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(255,107,53,0.15)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            {title}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            {sub}
          </Typography>
          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }} role="alert">
              {error}
            </Typography>
          )}
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {children}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
