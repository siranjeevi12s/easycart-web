import { useState } from 'react';
import { Button, TextField, Typography, Link as MuiLink } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import AuthCard from '../components/AuthCard';
import { useSnack } from '../components/useSnack';
import { brand } from '../theme/tokens';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { show, fail, host } = useSnack();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) { show('Name, email and password required', 'error'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', { ...form, role: 'restaurant' });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      nav('/');
    } catch (e: any) {
      fail(e, e.response?.data?.errors?.[0]?.msg || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthCard title="Create Restaurant Account" sub="Start receiving pre-orders in minutes." onSubmit={submit}>
        <TextField label="Owner Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth autoComplete="name" />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required fullWidth autoComplete="email" />
        <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth autoComplete="tel" />
        <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required fullWidth autoComplete="new-password" />
        <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 48 }}>
          {busy ? 'Creating…' : 'Create Account'}
        </Button>
        <Typography variant="body2" textAlign="center"><MuiLink component={Link} to="/login">Already have account? Login</MuiLink></Typography>
      </AuthCard>
      {host}
    </>
  );
}
