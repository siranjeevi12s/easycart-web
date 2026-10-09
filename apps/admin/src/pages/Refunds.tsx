import { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet } from '../services/api';
import { ConfirmDialog, DataTable, ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';
import { fmtDate, fmtINR, useAdminList } from '../hooks';

export default function Refunds() {
  // Potentially refundable = PAID payments; history = already-refunded ones
  const [tab, setTab] = useState<'eligible' | 'history'>('eligible');
  const eligible = useAdminList('payments-eligible', (p) => apiGet.payments({ ...p, status: 'PAID' }));
  const history = useAdminList('payments-refunded', (p) => apiGet.payments({ ...p, status: 'REFUNDED' }));
  const list = tab === 'eligible' ? eligible : history;
  const [target, setTarget] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const refund = useMutation({
    mutationFn: async () => {
      // Resolve the app order behind this payment, then use the authorized flow
      const orderId = target.orderId?._id;
      if (!orderId) throw new Error('Payment has no linked order');
      const amt = amount.trim() ? Number(amount) : undefined;
      if (amt !== undefined && !(amt > 0 && amt <= Number(target.amount))) throw new Error('Amount must be within the charged total');
      await api.post('/payments/refund', { orderId, amount: amt, reason: reason || 'admin refund' });
    },
    onSuccess: () => {
      setTarget(null);
      setAmount('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['payments-eligible'] });
      qc.invalidateQueries({ queryKey: ['payments-refunded'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (e: any) => {
      alert(e.response?.data?.message || e.message || 'Refund failed — nothing was charged back');
    },
  });

  return (
    <Box>
      <PageHeader
        title="Refunds"
        sub="Only the authorized backend flow moves money. Nothing is reported successful before the gateway confirms."
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant={tab === 'eligible' ? 'contained' : 'outlined'} onClick={() => setTab('eligible')}>Eligible (PAID)</Button>
            <Button variant={tab === 'history' ? 'contained' : 'outlined'} onClick={() => setTab('history')}>History</Button>
          </Box>
        }
      />
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'order', label: 'Order', value: (p: any) => <b>{p.orderId?.orderNumber || '—'}</b> },
            { key: 'rest', label: 'Restaurant', value: (p: any) => p.restaurantId?.name || '—' },
            { key: 'amount', label: 'Charged', value: (p: any) => fmtINR(p.amount) },
            { key: 'date', label: 'Paid at', value: (p: any) => fmtDate(p.createdAt) },
            {
              key: 'ref', label: 'Refund ref', value: (p: any) => p.refundId ? <code style={{ fontSize: 11 }}>{p.refundId}</code> : '—',
            },
            {
              key: 'actions', label: '', render: (p: any) => tab === 'eligible' ? (
                <Button size="small" variant="outlined" color="error" onClick={() => { setTarget(p); setAmount(''); setReason(''); }}>Refund…</Button>
              ) : <></>,
            },
          ]}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.onPage}
          rowKey={(p: any) => p._id}
          empty={tab === 'eligible' ? 'No refundable payments.' : 'No refunds yet.'}
        />
      )}

      <ConfirmDialog
        open={!!target}
        title={`Refund ${target?.orderId?.orderNumber || ''}?`}
        body={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>Charged <b>{fmtINR(target?.amount)}</b> via {target?.razorpayPaymentId || 'gateway'}. Leave amount empty for a full refund, or enter a partial amount in rupees.</Box>
            <TextField
              label="Refund amount ₹ (empty = full)"
              placeholder={`Full: ₹${target?.amount}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              fullWidth
              size="small"
              inputProps={{ inputMode: 'decimal' }}
            />
          </Box>
        }
        confirmLabel="Issue refund"
        danger
        busy={busy}
        reasonRequired
        reason={reason}
        onReason={setReason}
        onClose={() => setTarget(null)}
        onConfirm={() => { setBusy(true); refund.mutate(undefined, { onSettled: () => setBusy(false) }); }}
      />
    </Box>
  );
}
