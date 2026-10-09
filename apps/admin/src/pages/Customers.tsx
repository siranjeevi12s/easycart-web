import { useEffect, useState } from 'react';
import { Box, Button, Chip, Drawer, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet } from '../services/api';
import { ConfirmDialog, DataTable, EmptyState, ErrorState, LoadingSkeleton, PageHeader, SearchFilterBar, StatusChip } from '../components/ui';
import { fmtDate, useAdminList } from '../hooks';

export default function Customers() {
  const list = useAdminList('customers', apiGet.customers);
  const [detail, setDetail] = useState<any | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const suspend = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/users/${suspendTarget._id}/suspend`, { suspend: !suspendTarget.isSuspended, reason: suspendTarget.isSuspended ? undefined : reason });
    },
    onSuccess: () => {
      setSuspendTarget(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const confirmSuspend = () => {
    setBusy(true);
    suspend.mutate(undefined, { onSettled: () => setBusy(false) });
  };

  return (
    <Box>
      <PageHeader title="Customers" sub={`${list.total} accounts — search, filter, inspect, suspend.`} />
      <SearchFilterBar search={list.search} onSearch={list.setSearch} placeholder="Search name, email…">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={list.filters.status || ''} label="Status" onChange={(e) => list.setFilter('status', e.target.value || undefined)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
          </Select>
        </FormControl>
      </SearchFilterBar>
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load customers." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'name', label: 'Name', value: (u: any) => <b>{u.name}</b> },
            { key: 'email', label: 'Email', value: (u: any) => u.email },
            { key: 'phone', label: 'Phone', value: (u: any) => u.phone || '—' },
            { key: 'created', label: 'Registered', value: (u: any) => fmtDate(u.createdAt) },
            { key: 'status', label: 'Status', render: (u: any) => <StatusChip status={u.isSuspended ? 'suspended' : 'Active'} /> },
            {
              key: 'actions', label: 'Actions', render: (u: any) => (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => setDetail(u)}>View</Button>
                  <Button size="small" variant="outlined" color={u.isSuspended ? 'success' : 'error'} onClick={() => setSuspendTarget(u)}>
                    {u.isSuspended ? 'Reactivate' : 'Suspend'}
                  </Button>
                </Box>
              ),
            },
          ]}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.onPage}
          rowKey={(u: any) => u._id}
          empty="No customers match."
        />
      )}

      {/* Detail drawer: profile + order history */}
      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)} PaperProps={{ sx: { width: { xs: '90vw', sm: 420 } } }}>
        {detail && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700}>{detail.name}</Typography>
            <Typography color="text.secondary" variant="body2">{detail.email} • {detail.phone || 'no phone'}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <StatusChip status={detail.isSuspended ? 'suspended' : 'Active'} />
              <Chip size="small" label={`Registered ${fmtDate(detail.createdAt)}`} />
            </Box>
            <Typography fontWeight={700} sx={{ mt: 3, mb: 1 }}>Order history</Typography>
            <CustomerOrders id={detail._id} />
          </Box>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!suspendTarget}
        title={suspendTarget?.isSuspended ? 'Reactivate account?' : 'Suspend account?'}
        body={<Typography>Are you sure you want to {suspendTarget?.isSuspended ? 'reactivate' : 'suspend'} <b>{suspendTarget?.email}</b>? {!suspendTarget?.isSuspended && 'They will be signed out everywhere immediately.'}</Typography>}
        confirmLabel={suspendTarget?.isSuspended ? 'Reactivate' : 'Suspend'}
        danger={!suspendTarget?.isSuspended}
        busy={busy}
        reasonRequired={!suspendTarget?.isSuspended}
        reason={reason}
        onReason={setReason}
        onClose={() => { setSuspendTarget(null); setReason(''); }}
        onConfirm={confirmSuspend}
      />
    </Box>
  );
}

function CustomerOrders({ id }: { id: string }) {
  const { data, isLoading } = useAdminOrdersFor(id);
  if (isLoading) return <Typography color="text.secondary">Loading…</Typography>;
  if (!data.length) return <EmptyState message="No orders yet." />;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {data.map((o: any) => (
        <Box key={o._id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2"><b>{o.orderNumber}</b> • ₹{o.totalAmount}</Typography>
          <StatusChip status={o.orderStatus} />
        </Box>
      ))}
    </Box>
  );
}

function useAdminOrdersFor(id: string) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // No customer-scoped admin endpoint; filter the admin list page
        const res = await api.get('/admin/orders', { params: { limit: 100 } });
        if (live) setData((res.data.data || []).filter((o: any) => String(o.customerId?._id || o.customerId) === String(id)).slice(0, 20));
      } catch {
        if (live) setData([]);
      } finally {
        if (live) setIsLoading(false);
      }
    })();
    return () => { live = false; };
  }, [id]);
  return { data, isLoading };
}
