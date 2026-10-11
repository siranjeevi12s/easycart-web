import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

/**
 * Catches render-time crashes anywhere below it so a single bad chart/row
 * can never blank-screen the whole admin console in production.
 */
interface State {
  hasError: boolean;
  errorId: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, errorId: '' };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, errorId: Math.random().toString(36).slice(2, 8).toUpperCase() };
  }

  componentDidCatch(error: unknown) {
    // Keep console noise out of production; still traceable via errorId.
    if (import.meta.env.DEV) {
      console.error('[Admin ErrorBoundary]', error);
    }
  }

  private reload = () => {
    this.setState({ hasError: false, errorId: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Box sx={{ maxWidth: 520, width: '100%' }}>
          <Alert
            severity="error"
            action={
              <Button size="small" onClick={this.reload}>
                Reload
              </Button>
            }
          >
            <Typography fontWeight={700}>Something went wrong.</Typography>
            <Typography variant="body2">
              The page crashed unexpectedly{this.state.errorId ? ` (ref ${this.state.errorId})` : ''}. Your
              session is safe — reloading usually fixes it.
            </Typography>
          </Alert>
        </Box>
      </Box>
    );
  }
}
