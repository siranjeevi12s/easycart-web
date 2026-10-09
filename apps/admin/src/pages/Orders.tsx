import { useState } from 'react';
import { Box, Button, Chip, Drawer, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { apiGet } from '../services/api';
import { DataTable, ErrorState, LoadingSkeleton, PageHeader, SearchFilterBar, StatusChip } from '../components/ui';
import { fmtDate, fmtINR, useAdminList } from '../hooks';

const STATUSES = ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'];
const PAYMENTS = ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const initialExtra: Record<string, any> = {};
  const pStatus = params.get('status');
  const pRest = params.get('restaurantId');
  if (pStatus) initialExtra.status = pStatus;
  if (pRest) initialExtra.restaurantId = pRest;
  const list = useAdminList('orders', apiGet.orders, { limit: 20, extra: initialExtra });
  const [detail, setDetail] = useState<any | null>(null);

  // Keep the URL in sync so chart drill-downs are shareable/bookmarkable
  const syncUrl = (next: Record<string, any>) => {
    const q: Record<string, string> = {};
    if (next.status) q.status = next.status;
    if (next.restaurantId) q.restaurantId = next.restaurantId;
    setParams(q, { replace: true });
  };
  const setFilterSync = (k: string, v: any) => {
    const next = { ...list.filters, [k]: v };
    if (!v) delete next[k];
    list.setFilter(k, v);
    syncUrl(next);
  };

  return (
    <Box>
      <PageHeader title="Orders" sub={`${list.total} orders — fulfilment and payment states stay separate.`} />
      <SearchFilterBar search={list.search} onSearch={list.setSearch} placeholder="Search order # (e.g. FD-)…">
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={list.filters.status || ''} label="Status" onChange={(e) => setFilterSync('status', e.target.value || undefined)}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Payment</InputLabel>
          <Select value={list.filters.payment || ''} label="Payment" onChange={(e) => setFilterSync('payment', e.target.value || undefined)}>
            <MenuItem value="">All</MenuItem>
            {PAYMENTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        {list.filters.restaurantId && (
          <Chip label={`Restaurant: ${String(list.filters.restaurantId).slice(-6)}`} onDelete={() => setFilterSync('restaurantId', undefined)} size="small" />
        )}
      </SearchFilterBar>
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load orders." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'num', label: 'Order', value: (o: any) => <b>{o.orderNumber}</b> },
            { key: 'cust', label: 'Customer', value: (o: any) => o.customerId?.email || '—' },
            { key: 'rest', label: 'Restaurant', value: (o: any) => o.restaurantId?.name || '—' },
            { key: 'date', label: 'Date', value: (o: any) => fmtDate(o.createdAt) },
            { key: 'total', label: 'Total', value: (o: any) => fmtINR(o.totalAmount) },
            { key: 'pay', label: 'Payment', render: (o: any) => <StatusChip status={o.paymentStatus} /> },
            { key: 'status', label: 'Fulfilment', render: (o: any) => <StatusChip status={o.orderStatus} /> },
            { key: 'actions', label: '', render: (o: any) => <Button size="small" variant="outlined" onClick={() => setDetail(o)}>Details</Button> },
          ]}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.onPage}
          rowKey={(o: any) => o._id}
          empty="No orders match."
        />
      )}

      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)} PaperProps={{ sx: { width: { xs: '92vw', sm: 460 } } }}>
        {detail && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700}>{detail.orderNumber}</Typography>
            <Typography color="text.secondary" variant="body2">{fmtDate(detail.createdAt)} • {detail.customerId?.email}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <StatusChip status={detail.paymentStatus} />
              <StatusChip status={detail.orderStatus} />
            </Box>
            <Typography fontWeight={700} sx={{ mt: 3, mb: 1 }}>Items</Typography>
            {(detail.items || []).map((it: any, i: number) => (
              <Typography key={i} variant="body2">{it.quantity} × {it.name} @ ₹{it.price} = ₹{it.subtotal}</Typography>
            ))}
            <Typography fontWeight={800} sx={{ mt: 2 }}>Sub ₹{detail.subtotal} + Tax ₹{detail.tax} = ₹{detail.totalAmount}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Fee ₹{detail.platformFee ?? 0} • Restaurant ₹{detail.restaurantAmount ?? detail.totalAmount}
            </Typography>
            {detail.paymentId && <Typography variant="body2" sx={{ mt: 1 }}>Gateway payment: <code>{detail.paymentId}</code></Typography>}
            {detail.refundId && <Typography variant="body2">Refund: <code>{detail.refundId}</code> ({detail.refundStatus})</Typography>}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Status changes happen in the restaurant portal; refunds via Payments → Refunds. Admins never mark orders paid directly.
            </Typography>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
