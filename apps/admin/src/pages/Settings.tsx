import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';
import { ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';

export default function Settings() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['stats'], queryFn: apiGet.stats });

  return (
    <Box>
      <PageHeader title="Settings" sub="Read-only platform configuration snapshot. Values come from server environment — change them in Azure App settings, never in code." />
      {isLoading ? <LoadingSkeleton rows={4} /> : isError ? <ErrorState message="Failed to load." onRetry={refetch} /> : (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2.5, maxWidth: 560 }}>
          <Row k="Platform fee (current GMV share)" v={`₹${(data.platformFees || 0).toLocaleString('en-IN')} collected • ${data.orders} orders`} />
          <Row k="Role model" v="Single admin role (super/ops/support/finance hierarchy not implemented)" />
          <Row k="Auth" v="JWT access + rotating refresh (existing backend architecture)" />
          <Row k="Gateway" v="Razorpay (test/live by server keys); secrets server-side only" />
          <Row k="Database" v="MongoDB Atlas (config: MONGODB_URI)" />
          <Row k="Approval policy" v="New restaurants start pending; public surface requires approved" />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Tunables (PLATFORM_FEE_PERCENT, RAZORPAY_ROUTE_ENABLED, rate limits, CORS) live in server environment. Editing them here is intentionally unsupported.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">{k}</Typography>
      <Typography variant="body2" fontWeight={600} textAlign="right">{v}</Typography>
    </Box>
  );
}
