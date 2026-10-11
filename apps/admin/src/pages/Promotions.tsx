import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import axios from 'axios';
import { api, getApiErrorMessage, type Page } from '../services/api';
import { DataTable, EmptyState, ErrorState, LoadingSkeleton, PageHeader, StatusChip } from '../components/ui';

const EMPTY = { name: '', description: '', durationDays: 7, price: 499, priority: 5 };

export default function Promotions() {
  const [page, setPage] = useState<Page<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<any[]>('/promos/admin/packages');
      setPage({ data, page: 1, limit: data.length || 20, total: data.length, pages: 1 });
    } catch (e) {
      // 404 here almost always means the backend predates the promos API —
      // say so explicitly instead of a generic "not found".
      setError(
        axios.isAxiosError(e) && e.response?.status === 404
          ? 'Promotions API not found on this server (404) — deploy the latest server build (easycart-server-deploy.zip), then retry.'
          : getApiErrorMessage(e)
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const startAdd = () => { setForm(EMPTY); setEditing(null); setOpen(true); };
  const startEdit = (p: any) => {
    setForm({ name: p.name, description: p.description || '', durationDays: p.durationDays, price: p.price, priority: p.priority });
    setEditing(p._id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.patch(`/promos/admin/packages/${editing}`, form);
      else await api.post('/promos/admin/packages', form);
      setOpen(false);
      load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: any) => {
    try {
      await api.patch(`/promos/admin/packages/${p._id}`, { isActive: !p.isActive });
      load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <Box>
      <PageHeader
        title="Promo Packages"
        sub="Owners buy these to feature restaurants in the customer app carousel. Edits never rewrite past campaign snapshots."
        action={<Button variant="contained" onClick={startAdd}>+ New package</Button>}
      />
      {error && <Box sx={{ mb: 2 }}><ErrorState message={error} onRetry={load} /></Box>}
      {page && page.data.length === 0 && !error && <EmptyState message="No packages yet." hint="Create the first promotional package." />}
      {page && page.data.length > 0 && (
        <DataTable
          cols={[
            { key: 'name', label: 'Package', render: (p) => <b>{p.name}</b> },
            { key: 'dur', label: 'Duration', value: (p) => `${p.durationDays} days` },
            { key: 'price', label: 'Price', value: (p) => `₹${p.price}` },
            { key: 'pri', label: 'Priority', value: (p) => p.priority },
            { key: 'status', label: 'Status', render: (p) => <StatusChip status={p.isActive ? 'Active' : 'Disabled'} /> },
            {
              key: 'actions', label: 'Actions', render: (p) => (
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => startEdit(p)}>Edit</Button>
                  <Button size="small" variant="outlined" color={p.isActive ? 'warning' : 'success'} onClick={() => toggle(p)}>
                    {p.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </Stack>
              ),
            },
          ]}
          rows={page.data}
          total={page.total}
          page={1}
          limit={page.total || 20}
          onPage={() => {}}
          rowKey={(p) => p._id}
        />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{editing ? 'Edit Package' : 'New Package'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Duration (days) *" type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} fullWidth inputProps={{ min: 1, max: 365 }} />
              <TextField label="Price (₹) *" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} fullWidth inputProps={{ min: 0 }} />
              <TextField label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} fullWidth helperText="Higher ranks first" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ minHeight: 40 }}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving} sx={{ minHeight: 40 }}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
