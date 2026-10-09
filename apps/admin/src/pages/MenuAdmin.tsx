import { useEffect, useState } from 'react';
import { Avatar, Box, Button, FormControl, InputLabel, MenuItem, Select, Switch } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { ConfirmDialog, DataTable, ErrorState, LoadingSkeleton, PageHeader, StatusChip } from '../components/ui';
import { fmtINR } from '../hooks';

export default function MenuAdmin() {
  const [restId, setRestId] = useState('');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [deactivate, setDeactivate] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    api.get('/admin/restaurants', { params: { limit: 100 } }).then((r) => {
      setRestaurants(r.data.data || []);
      if (r.data.data?.[0] && !restId) setRestId(r.data.data[0]._id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menu = useQuery({
    queryKey: ['admin-menu', restId],
    queryFn: () => api.get(`/restaurants/${restId}/menu`).then((r) => r.data),
    enabled: !!restId,
  });

  const toggleAvail = useMutation({
    mutationFn: (it: any) => api.put(`/menu/${it._id}`, { isAvailable: !it.isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-menu'] }),
  });
  const deactivateMut = useMutation({
    mutationFn: () => api.delete(`/menu/${deactivate._id}`),
    onSuccess: () => {
      setDeactivate(null);
      qc.invalidateQueries({ queryKey: ['admin-menu'] });
    },
  });

  return (
    <Box>
      <PageHeader title="Menu Management" sub="Review items per restaurant. Deactivation is soft-delete (recoverable); permanent deletes need an explicit decision." />
      <FormControl size="small" sx={{ minWidth: 260, mb: 2 }}>
        <InputLabel>Restaurant</InputLabel>
        <Select value={restId} label="Restaurant" onChange={(e) => setRestId(e.target.value)}>
          {restaurants.map((r: any) => (
            <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {!restId ? <ErrorState message="No restaurant selected." /> :
        menu.isLoading ? <LoadingSkeleton /> :
        menu.isError ? <ErrorState message="Failed to load menu." onRetry={menu.refetch} /> : (
        <DataTable
          cols={[
            { key: 'img', label: '', render: (it: any) => <Avatar src={it.image} alt={it.name} variant="rounded" sx={{ width: 44, height: 44 }} /> },
            { key: 'name', label: 'Item', value: (it: any) => <b>{it.name}</b> },
            { key: 'cat', label: 'Category', value: (it: any) => it.category || '—' },
            { key: 'price', label: 'Price', value: (it: any) => fmtINR(it.price) },
            { key: 'avail', label: 'Available', render: (it: any) => <StatusChip status={it.isAvailable ? 'Available' : 'Disabled'} /> },
            {
              key: 'actions', label: 'Actions', render: (it: any) => (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Switch size="small" checked={!!it.isAvailable} onChange={() => toggleAvail.mutate(it)} aria-label={`Toggle ${it.name}`} />
                  <Button size="small" color="error" onClick={() => setDeactivate(it)}>Deactivate</Button>
                </Box>
              ),
            },
          ]}
          rows={menu.data || []}
          total={(menu.data || []).length}
          page={1}
          limit={Math.max(10, (menu.data || []).length)}
          onPage={() => {}}
          rowKey={(it: any) => it._id}
          empty="No menu items for this restaurant."
        />
      )}

      <ConfirmDialog
        open={!!deactivate}
        title={`Deactivate “${deactivate?.name}”?`}
        body="The item is soft-deleted (hidden, history preserved) — not destroyed. Use for reported/unsafe items."
        confirmLabel="Deactivate"
        danger
        busy={busy}
        onClose={() => setDeactivate(null)}
        onConfirm={() => { setBusy(true); deactivateMut.mutate(undefined, { onSettled: () => setBusy(false) }); }}
      />
    </Box>
  );
}
