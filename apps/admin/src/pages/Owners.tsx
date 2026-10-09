import { useState } from 'react';
import { Box, Button, Chip, Drawer, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet } from '../services/api';
import { ConfirmDialog, DataTable, ErrorState, LoadingSkeleton, PageHeader, SearchFilterBar, StatusChip } from '../components/ui';
import { fmtDate, useAdminList } from '../hooks';

export default function Owners() {
  const list = useAdminList('owners', apiGet.owners);
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
      qc.invalidateQueries({ queryKey: ['owners'] });
    },
  });

  return (
    <Box>
      <PageHeader title="Restaurant Owners" sub={`${list.total} owners — account status is separate from restaurant approval.`} />
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
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load owners." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'name', label: 'Owner', value: (o: any) => <b>{o.name}</b> },
            { key: 'email', label: 'Email', value: (o: any) => o.email },
            { key: 'count', label: 'Restaurants', value: (o: any) => <Chip size="small" label={`${o.restaurantCount} (${(o.restaurants || []).filter((r: any) => r.approvalStatus === 'approved').length} live)`} /> },
            { key: 'created', label: 'Registered', value: (o: any) => fmtDate(o.createdAt) },
            { key: 'status', label: 'Account', render: (o: any) => <StatusChip status={o.isSuspended ? 'suspended' : 'Active'} /> },
            {
              key: 'actions', label: 'Actions', render: (o: any) => (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => setDetail(o)}>View</Button>
                  <Button size="small" variant="outlined" color={o.isSuspended ? 'success' : 'error'} onClick={() => setSuspendTarget(o)}>
                    {o.isSuspended ? 'Reactivate' : 'Suspend'}
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
          rowKey={(o: any) => o._id}
          empty="No owners match."
        />
      )}

      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)} PaperProps={{ sx: { width: { xs: '90vw', sm: 420 } } }}>
        {detail && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700}>{detail.name}</Typography>
            <Typography color="text.secondary" variant="body2">{detail.email} • {detail.phone || 'no phone'}</Typography>
            <Box sx={{ mt: 1 }}><StatusChip status={detail.isSuspended ? 'suspended' : 'Active'} /></Box>
            <Typography fontWeight={700} sx={{ mt: 3, mb: 1 }}>Associated restaurants ({detail.restaurantCount})</Typography>
            {(detail.restaurants || []).map((r: any) => (
              <Box key={r._id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2"><b>{r.name}</b></Typography>
                <StatusChip status={r.approvalStatus} />
              </Box>
            ))}
            {!detail.restaurants?.length && <Typography color="text.secondary">No restaurants yet.</Typography>}
          </Box>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!suspendTarget}
        title={suspendTarget?.isSuspended ? 'Reactivate owner?' : 'Suspend owner?'}
        body={<Typography>Suspending <b>{suspendTarget?.email}</b> signs them out everywhere; their restaurants stop being manageable by them (listings unchanged — use restaurant Suspend to delist).</Typography>}
        confirmLabel={suspendTarget?.isSuspended ? 'Reactivate' : 'Suspend'}
        danger={!suspendTarget?.isSuspended}
        busy={busy}
        reasonRequired={!suspendTarget?.isSuspended}
        reason={reason}
        onReason={setReason}
        onClose={() => { setSuspendTarget(null); setReason(''); }}
        onConfirm={() => { setBusy(true); suspend.mutate(undefined, { onSettled: () => setBusy(false) }); }}
      />
    </Box>
  );
}
