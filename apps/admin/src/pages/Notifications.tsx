import { Box, Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, apiGet } from '../services/api';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';
import { fmtDate } from '../hooks';

export default function Notifications() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: apiGet.stats });
  const failed = useQuery({
    queryKey: ['notif-failed'],
    queryFn: () => api.get('/admin/payments', { params: { status: 'FAILED', limit: 10 } }).then((r) => r.data),
  });

  if (stats.isLoading) return <LoadingSkeleton />;
  if (stats.isError) return <ErrorState message="Failed to load notifications." onRetry={stats.refetch} />;

  const items: { kind: 'warning' | 'error' | 'info'; text: string; at?: string; link?: string; linkLabel?: string }[] = [];
  if (stats.data.pendingApprovals > 0) {
    items.push({ kind: 'warning', text: `${stats.data.pendingApprovals} restaurant${stats.data.pendingApprovals === 1 ? '' : 's'} awaiting approval`, link: '/approvals', linkLabel: 'Review queue' });
  }
  if (stats.data.openOrders > 0) {
    items.push({ kind: 'info', text: `${stats.data.openOrders} orders currently in kitchen flow (paid/accepted/preparing)` });
  }
  for (const p of failed.data?.data || []) {
    items.push({ kind: 'error', text: `Payment failed: ${p.razorpayPaymentId || p._id} • ₹${p.amount} • ${p.restaurantId?.name || ''}`, at: p.createdAt });
  }

  return (
    <Box>
      <PageHeader title="Notifications" sub="Operational alerts computed live from platform data. No push inbox backend exists yet — this page is the alert surface." />
      {!items.length && <EmptyState message="All clear." hint="No pending approvals, stuck orders, or failed payments." />}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {items.map((n, i) => (
          <Box key={i} sx={{ border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: n.kind === 'error' ? '#ef4444' : n.kind === 'warning' ? '#f59e0b' : '#3b82f6', borderRadius: 2, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box>
              <Box>{n.text}</Box>
              {n.at && <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(n.at)}</Box>}
            </Box>
            {n.link && <Button size="small" variant="outlined" component={Link} to={n.link}>{n.linkLabel || 'Open'}</Button>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
