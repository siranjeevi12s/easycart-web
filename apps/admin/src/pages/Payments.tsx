import { useState } from 'react';
import { Box, Button, Drawer, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { apiGet } from '../services/api';
import { DataTable, ErrorState, LoadingSkeleton, PageHeader, SearchFilterBar, StatusChip } from '../components/ui';
import { fmtDate, fmtINR, useAdminList } from '../hooks';

const STATUSES = ['CREATED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];

export default function Payments() {
  const list = useAdminList('payments', apiGet.payments);
  const [detail, setDetail] = useState<any | null>(null);

  return (
    <Box>
      <PageHeader title="Payments" sub="Read-only gateway ledger. Amounts in rupees; paise only at the Razorpay boundary." />
      <SearchFilterBar search={list.search} onSearch={list.setSearch} placeholder="Search Razorpay payment ID…">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={list.filters.status || ''} label="Status" onChange={(e) => list.setFilter('status', e.target.value || undefined)}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </SearchFilterBar>
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load payments." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'order', label: 'Order', value: (p: any) => <b>{p.orderId?.orderNumber || '—'}</b> },
            { key: 'rest', label: 'Restaurant', value: (p: any) => p.restaurantId?.name || '—' },
            { key: 'amount', label: 'Amount', value: (p: any) => fmtINR(p.amount) },
            { key: 'rzp', label: 'Razorpay payment', value: (p: any) => <code style={{ fontSize: 11 }}>{p.razorpayPaymentId || '—'}</code> },
            { key: 'date', label: 'Time', value: (p: any) => fmtDate(p.createdAt) },
            { key: 'status', label: 'Status', render: (p: any) => <StatusChip status={p.status} /> },
            { key: 'refund', label: 'Refund', value: (p: any) => p.refundId ? <StatusChip status="REFUNDED" /> : '—' },
            { key: 'actions', label: '', render: (p: any) => <Button size="small" variant="outlined" onClick={() => setDetail(p)}>Details</Button> },
          ]}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.onPage}
          rowKey={(p: any) => p._id}
          empty="No payments match."
        />
      )}

      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)} PaperProps={{ sx: { width: { xs: '92vw', sm: 440 } } }}>
        {detail && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700}>Payment detail</Typography>
            <Typography color="text.secondary" variant="body2">{fmtDate(detail.createdAt)} • {detail.mode}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <StatusChip status={detail.status} />
              {detail.refundId && <StatusChip status="REFUNDED" />}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>Order: <b>{detail.orderId?.orderNumber}</b> ({fmtINR(detail.orderId?.totalAmount)})</Typography>
            <Typography variant="body2">Restaurant: {detail.restaurantId?.name}</Typography>
            <Typography variant="body2">Charged: {fmtINR(detail.amount)} • Fee ₹{detail.platformFee ?? 0} • Restaurant ₹{detail.restaurantAmount ?? '—'}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Razorpay order: <code style={{ fontSize: 11 }}>{detail.razorpayOrderId || '—'}</code></Typography>
            <Typography variant="body2">Razorpay payment: <code style={{ fontSize: 11 }}>{detail.razorpayPaymentId || '—'}</code></Typography>
            {detail.refundId && (
              <Typography variant="body2" sx={{ mt: 1 }}>Refund: <code style={{ fontSize: 11 }}>{detail.refundId}</code> ({detail.refundStatus})</Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Gateway secrets and webhook signing live server-side only — never exposed here. Refunds are initiated from the Refunds page with confirmation + reason.
            </Typography>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
