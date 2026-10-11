import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import App from './App';
import { AdminThemeProvider } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Don't hammer the server on client/auth errors — retry only on
      // network failures and 5xx.
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        if (axios.isAxiosError(error)) {
          const s = error.response?.status;
          if (!error.response) return true;
          if (s !== undefined && s >= 500) return true;
          return false;
        }
        return false;
      },
    },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AdminThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
