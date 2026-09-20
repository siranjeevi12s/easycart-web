import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Link as MuiLink } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/register', { ...form, role: 'restaurant' });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      nav('/');
    } catch (e: any) {
      setErr(e.response?.data?.message || e.response?.data?.errors?.[0]?.msg || 'Failed');
    }
  };
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#FFF8F5', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700}>Create Restaurant Account</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Start receiving pre-orders in minutes.</Typography>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Box component="form" onSubmit={submit} className="flex flex-col gap-4">
            <TextField label="Owner Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <Button type="submit" variant="contained" sx={{ bgcolor: '#FF6B35' }}>Create Account</Button>
            <Typography variant="body2" textAlign="center"><MuiLink component={Link} to="/login">Already have account? Login</MuiLink></Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
