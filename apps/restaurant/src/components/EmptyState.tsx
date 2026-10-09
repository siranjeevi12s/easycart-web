import { Alert, Typography, Box } from '@mui/material';

interface Props {
  message: string;
  hint?: string;
  severity?: 'info' | 'warning';
}

/** Friendly empty-list placeholder (info/warning alert + optional hint). */
export default function EmptyState({ message, hint, severity = 'info' }: Props) {
  return (
    <Box>
      <Alert severity={severity}>{message}</Alert>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
