import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, FormControlLabel, Stack, Switch, TextField } from '@mui/material';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';
import { useSnack } from '../components/useSnack';
import { brand } from '../theme/tokens';

const EMPTY_FORM = { name: '', description: '', address: '', phone: '', image: '' };

export default function Profile() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const { show, fail, host } = useSnack();

  const load = async () => {
    try {
      const { data } = await api.get('/restaurants/my');
      setRestaurants(data);
    } catch (e: any) {
      fail(e, 'Failed to load restaurants');
    }
  };
  useEffect(() => { load(); }, []);
  // Live status: reflect admin approvals/suspensions without a manual reload —
  // poll quietly + refetch whenever the tab regains focus.
  useEffect(() => {
    const t = setInterval(() => { load().catch(() => {}); }, 20000);
    const onFocus = () => { load().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const create = async () => {
    if (!form.name.trim()) { show('Restaurant name required', 'error'); return; }
    try {
      await api.post('/restaurants', form);
      show('Restaurant profile created');
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) { fail(e, 'Failed'); }
  };
  const toggle = async (r: any, field: 'isOpen' | 'isActive') => {
    try {
      await api.put(`/restaurants/${r._id}`, { [field]: !r[field] });
      load();
    } catch (e: any) { fail(e, 'Update failed'); }
  };

  return (
    <Box>
      <PageHeader
        title="Restaurant Profile"
        sub="Only active restaurants appear to customers. Closed restaurants cannot receive new orders."
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField label="Restaurant Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
            <TextField label="Address (text only, no maps in MVP)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} fullWidth />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} fullWidth />
            <Button variant="contained" sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 44 }} onClick={create}>Create Profile</Button>
          </Stack>
        </CardContent>
      </Card>

      <PageHeader title="Your Restaurants" />
      <Stack spacing={2}>
        {restaurants.map((r) => (
          <Card key={r._id} variant="outlined" sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{r.name}</Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StatusChip status={r.approvalStatus || 'pending'} />
                  <StatusChip status={r.isActive ? 'Active' : 'Deactivated'} kind={r.isActive ? 'success' : 'muted'} />
                </Stack>
              </Stack>
              {(r.approvalStatus === 'pending' || r.approvalStatus === 'under_review') && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {r.approvalStatus === 'pending' ? 'Submitted — waiting for admin approval. It appears publicly once approved.' : 'Under review by the admin team.'}
                </Alert>
              )}
              {(r.approvalStatus === 'rejected' || r.approvalStatus === 'suspended') && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {r.approvalStatus === 'rejected' ? 'Application rejected' : 'Suspended by admin'}
                  {r.approvalNote ? `: ${r.approvalNote}` : ''} — not visible to customers and cannot take orders.
                </Alert>
              )}
              <Box color="text.secondary" sx={{ typography: 'body2', wordBreak: 'break-word', mt: 0.5 }}>{r.address} • {r.phone}</Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }} sx={{ mt: 1 }}>
                <FormControlLabel control={<Switch checked={r.isOpen} onChange={() => toggle(r, 'isOpen')} />} label={r.isOpen ? 'Open' : 'Closed'} />
                <FormControlLabel control={<Switch checked={r.isActive} onChange={() => toggle(r, 'isActive')} />} label={r.isActive ? 'Visible to Customers' : 'Hidden'} />
              </Stack>
            </CardContent>
          </Card>
        ))}
        {restaurants.length === 0 && <EmptyState message="No profiles yet." hint="Create your first restaurant above." />}
      </Stack>
      {host}
    </Box>
  );
}
