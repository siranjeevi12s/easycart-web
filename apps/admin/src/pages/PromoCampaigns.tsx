import { useEffect, useState } from 'react';
import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { api, getApiErrorMessage, type Page } from '../services/api';
import { ConfirmDialog, DataTable, ErrorState, LoadingSkeleton, PageHeader, StatusChip } from '../components/ui';

const FILTERS = ['all', 'awaiting_approval', 'active', 'scheduled', 'paused', 'expired', 'rejected', 'refunded', 'cancelled'];

export default function PromoCampaigns() {
  const [page, setPage] = useState<Page<any> | null>(null);
  const [pg, setPg] = useState(1);
  const [filter, setFilter] = useState('awaiting_approval');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decide, setDecide] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const load = async (p = pg, f = filter) => {
    setLoading(true);
    setError('');
    try {
      const params: any = { page: p, limit: 20 };
      if (f !== 'all') params.status = f;
      const { data } = await api.get<Page<any>>('/promos/admin/campaigns', { params });
      setPage(data);
      setPg(data.page);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(1, filter); }, [filter]);
  useEffect(() => { load(); }, []);

  const submitDecide = async () => {
    if (!decide) return;
    setBusy(true);
    try {
      await api.post(`/promos/admin/campaigns/${decide.id}/decide`, { action: decide.action, note });
      setDecide(null);
      setNote('');
      load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async (c: any) => {
    try {
      await api.post(`/promos/admin/campaigns/${c._id}/pause`, { paused: c.status === 'active' });
      setDetail(null);
      load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const openDetail = async (id: string) => {
    try {
      const { data } = await api.get(`/promos/admin/campaigns/${id}`);
      setDetail(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  if (loading && !page) return <LoadingSkeleton rows={6} />;

  return (
    <Box>
      <PageHeader title="Sponsored Campaigns" sub="Approve paid campaigns to go live. Rejections refund automatically." />
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filter} label="Status" onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => <MenuItem key={f} value={f}>{f === 'all' ? 'All' : f}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={() => load()} /></Box>}
      {page && (
        <DataTable
          cols={[
            { key: 'rest', label: 'Restaurant', render: (c) => <b>{c.restaurantId?.name || '—'}</b> },
            { key: 'pkg', label: 'Package', value: (c) => `${c.snapshot?.name} • ₹${c.snapshot?.price}` },
            {
              key: 'perf', label: 'Views / Clicks', value: (c) => `${c.metrics?.impressions || 0} / ${c.metrics?.clicks || 0}`,
            },
            {
              key: 'dates', label: 'Window', value: (c) => c.schedule?.startDate
                ? `${new Date(c.schedule.startDate).toLocaleDateString()} → ${c.schedule?.endDate ? new Date(c.schedule.endDate).toLocaleDateString() : ''}`
                : '—',
            },
            { key: 'status', label: 'Status', render: (c) => <StatusChip status={c.status} /> },
            {
              key: 'actions', label: 'Actions', render: (c) => (
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => openDetail(c._id)}>View</Button>
                  {c.status === 'awaiting_approval' && (
                    <>
                      <Button size="small" variant="contained" color="success" onClick={() => setDecide({ id: c._id, action: 'approve' })}>Approve</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => setDecide({ id: c._id, action: 'reject' })}>Reject</Button>
                    </>
                  )}
                </Stack>
              ),
            },
          ]}
          rows={page.data}
          total={page.total}
          page={page.page}
          limit={page.limit}
          onPage={(p, l) => { setPg(p); load(p, filter); void l; }}
          rowKey={(c) => c._id}
          empty="No campaigns for this filter."
        />
      )}

      {detail && (
        <Box sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
            <Typography fontWeight={800} sx={{ flex: 1 }}>{detail.campaign.restaurantId?.name} — {detail.campaign.snapshot?.name}</Typography>
            <StatusChip status={detail.campaign.status} />
            <Button size="small" onClick={() => setDetail(null)}>Close</Button>
          </Stack>
          {!!detail.campaign.offerText && <Typography sx={{ mb: 1 }}>“{detail.campaign.offerText}”</Typography>}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
            <Chip label={`${detail.analytics.impressions} views`} size="small" />
            <Chip label={`${detail.analytics.clicks} clicks`} size="small" />
            <Chip label={`${((detail.analytics.ctr || 0) * 100).toFixed(1)}% CTR`} size="small" />
            <Chip label={`${detail.analytics.attributedOrders} orders • ₹${detail.analytics.attributedRevenue}`} size="small" color="success" />
          </Stack>
          {['active', 'paused'].includes(detail.campaign.status) && (
            <Button size="small" variant="outlined" color="warning" onClick={() => togglePause(detail.campaign)}>
              {detail.campaign.status === 'active' ? 'Pause' : 'Resume'}
            </Button>
          )}
        </Box>
      )}

      <ConfirmDialog
        open={!!decide}
        title={decide?.action === 'approve' ? 'Approve campaign' : 'Reject campaign'}
        body={decide?.action === 'approve'
          ? 'The campaign goes live immediately for its package duration.'
          : 'The paid amount is refunded to the owner automatically.'}
        confirmLabel={decide?.action === 'approve' ? 'Approve & go live' : 'Reject & refund'}
        danger={decide?.action === 'reject'}
        busy={busy}
        reasonRequired={decide?.action === 'reject'}
        reason={note}
        onReason={setNote}
        onClose={() => { setDecide(null); setNote(''); }}
        onConfirm={submitDecide}
      />
    </Box>
  );
}
