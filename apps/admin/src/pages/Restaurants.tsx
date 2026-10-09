import { useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet } from '../services/api';
import { ConfirmDialog, DataTable, ErrorState, LoadingSkeleton, PageHeader, SearchFilterBar, StatusChip } from '../components/ui';
import { useSnack } from '../components/useSnack';
import { fmtDate, useAdminList } from '../hooks';

const APPROVALS = ['pending', 'under_review', 'approved', 'rejected', 'suspended'];

export default function Restaurants({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const list = useAdminList('restaurants', apiGet.restaurants, { extra: pendingOnly ? { status: 'pending' } : {} });
  const [action, setAction] = useState<{ target: any; kind: 'approve' | 'review' | 'reject' | 'suspend' | 'toggle' | 'delete' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { showError, host: snackHost } = useSnack();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['restaurants'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const run = useMutation({
    mutationFn: async () => {
      if (!action) return;
      const { target, kind } = action;
      if (kind === 'toggle') {
        await api.patch(`/admin/restaurants/${target._id}/toggle`);
      } else if (kind === 'delete') {
        await api.delete(`/admin/restaurants/${target._id}`, { data: { reason: reason || undefined } });
      } else {
        const status = kind === 'approve' ? 'approved' : kind === 'review' ? 'under_review' : kind === 'reject' ? 'rejected' : 'suspended';
        await api.patch(`/admin/restaurants/${target._id}/approval`, { status, reason: reason || undefined });
      }
    },
    onSuccess: () => {
      setAction(null);
      setReason('');
      invalidate();
    },
    onError: (e: any) => {
      showError(e.response?.data?.message || 'Action failed');
    },
  });

  const titles: Record<string, { title: string; confirm: string; danger: boolean; needReason: boolean; body: string }> = {
    approve: { title: 'Approve restaurant?', confirm: 'Approve', danger: false, needReason: false, body: 'It becomes publicly visible immediately.' },
    review: { title: 'Mark under review?', confirm: 'Mark reviewing', danger: false, needReason: false, body: 'Signals that verification is in progress.' },
    reject: { title: 'Reject application?', confirm: 'Reject', danger: true, needReason: true, body: 'The owner is not notified automatically in this version — record the reason for the file.' },
    suspend: { title: 'Suspend restaurant?', confirm: 'Suspend', danger: true, needReason: true, body: 'It disappears from public listings and cannot take orders until re-approved.' },
    toggle: { title: 'Toggle visibility?', confirm: 'Toggle', danger: false, needReason: false, body: 'Flips the active flag (manual hide/show, independent of approval).' },
    delete: { title: 'Delete restaurant?', confirm: 'Delete forever', danger: true, needReason: false, body: 'PERMANENT: the restaurant row and its menu items are physically removed. Past orders stay but show an unknown restaurant. Blocked while live kitchen orders exist.' },
  };
  const t = action ? titles[action.kind] : null;

  return (
    <Box>
      <PageHeader
        title={pendingOnly ? 'Restaurant Approvals' : 'Restaurants'}
        sub={pendingOnly ? 'Pending queue — approve, review, or reject with a recorded reason.' : `${list.total} restaurants — approval gates public visibility (backend-enforced).`}
      />
      <SearchFilterBar search={list.search} onSearch={list.setSearch} placeholder="Search name, address…">
        {!pendingOnly && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Approval</InputLabel>
            <Select value={list.filters.status || ''} label="Approval" onChange={(e) => list.setFilter('status', e.target.value || undefined)}>
              <MenuItem value="">All</MenuItem>
              {APPROVALS.map((a) => (
                <MenuItem key={a} value={a}>{a}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </SearchFilterBar>
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load restaurants." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'name', label: 'Restaurant', value: (r: any) => <b>{r.name}</b> },
            { key: 'owner', label: 'Owner', value: (r: any) => r.ownerId?.email || '—' },
            { key: 'addr', label: 'Location', value: (r: any) => (r.address || '').slice(0, 40) },
            { key: 'created', label: 'Registered', value: (r: any) => fmtDate(r.createdAt) },
            { key: 'approval', label: 'Approval', render: (r: any) => <StatusChip status={r.approvalStatus || 'pending'} /> },
            { key: 'active', label: 'Live', render: (r: any) => <StatusChip status={r.isActive ? 'Active' : 'Hidden'} /> },
            {
              key: 'actions', label: 'Actions', render: (r: any) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {r.approvalStatus !== 'approved' && <Button size="small" variant="contained" color="success" onClick={() => setAction({ target: r, kind: 'approve' })}>Approve</Button>}
                  {r.approvalStatus === 'pending' && <Button size="small" variant="outlined" onClick={() => setAction({ target: r, kind: 'review' })}>Review</Button>}
                  {!['rejected'].includes(r.approvalStatus) && <Button size="small" variant="outlined" color="error" onClick={() => setAction({ target: r, kind: 'reject' })}>Reject</Button>}
                  {r.approvalStatus !== 'suspended' && <Button size="small" variant="outlined" color="error" onClick={() => setAction({ target: r, kind: 'suspend' })}>Suspend</Button>}
                  {['rejected', 'suspended'].includes(r.approvalStatus) && <Button size="small" variant="outlined" onClick={() => setAction({ target: r, kind: 'approve' })}>Re-approve</Button>}
                  <Button size="small" onClick={() => setAction({ target: r, kind: 'toggle' })}>Toggle</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => setAction({ target: r, kind: 'delete' })}>Delete</Button>
                </Box>
              ),
            },
          ]}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.onPage}
          rowKey={(r: any) => r._id}
          empty={pendingOnly ? 'Approval queue is clear.' : 'No restaurants match.'}
        />
      )}

      <ConfirmDialog
        open={!!action}
        title={t ? `${t.title} — ${action?.target?.name}` : ''}
        body={t?.body || ''}
        confirmLabel={t?.confirm}
        danger={t?.danger}
        busy={busy}
        reasonRequired={t?.needReason}
        reason={reason}
        onReason={setReason}
        onClose={() => { setAction(null); setReason(''); }}
        onConfirm={() => { setBusy(true); run.mutate(undefined, { onSettled: () => setBusy(false) }); }}
      />
      {snackHost}
    </Box>
  );
}
