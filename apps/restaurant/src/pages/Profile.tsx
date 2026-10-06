import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Switch, FormControlLabel, Stack, Alert } from '@mui/material';
import { api } from '../services/api';

export default function Profile() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '', address: '', phone: '', image: '' });
  const [msg, setMsg] = useState('');
  const load = async () => {
    const { data } = await api.get('/restaurants/my');
    setRestaurants(data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post('/restaurants', form);
      setMsg('Restaurant profile created');
      setForm({ name: '', description: '', address: '', phone: '', image: '' });
      load();
    } catch (e: any) { setMsg(e.response?.data?.message || 'Failed'); }
  };
  const toggle = async (r: any, field: 'isOpen' | 'isActive') => {
    await api.put(`/restaurants/${r._id}`, { [field]: !r[field] });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>Restaurant Profile</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Only active restaurants appear to customers. Closed restaurants cannot receive new orders.</Typography>
      {msg && <Alert sx={{ mb: 2 }}>{msg}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography fontWeight={700} gutterBottom>Create / Add Restaurant</Typography>
          <Stack spacing={2}>
            <TextField label="Restaurant Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <TextField label="Address (text only, no maps in MVP)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            <Button variant="contained" sx={{ bgcolor: '#FF6B35' }} onClick={create}>Create Profile</Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography fontWeight={700} sx={{ mb: 1 }}>Your Restaurants</Typography>
      <Stack spacing={2}>
        {restaurants.map((r) => (
          <Card key={r._id} variant="outlined" sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography fontWeight={700} sx={{ wordBreak: 'break-word' }}>{r.name} — {r.isActive ? 'Active' : 'Deactivated'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>{r.address} • {r.phone}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }} sx={{ mt: 1 }}>
                <FormControlLabel control={<Switch checked={r.isOpen} onChange={() => toggle(r, 'isOpen')} />} label={r.isOpen ? 'Open' : 'Closed'} />
                <FormControlLabel control={<Switch checked={r.isActive} onChange={() => toggle(r, 'isActive')} />} label={r.isActive ? 'Visible to Customers' : 'Hidden'} />
              </Stack>
            </CardContent>
          </Card>
        ))}
        {restaurants.length === 0 && <Typography color="text.secondary">No profiles yet.</Typography>}
      </Stack>
    </Box>
  );
}
