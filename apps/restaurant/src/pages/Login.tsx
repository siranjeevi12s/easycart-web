import { useState } from 'react';
import { Alert, Box, Button, TextField, Typography, Link as MuiLink } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import AuthCard from '../components/AuthCard';
import { brand } from '../theme/tokens';

export default function Login() {
  const [email, setEmail] = useState('restaurant@test.com');
  const [password, setPassword] = useState('password123');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.role !== 'restaurant' && data.user.role !== 'admin') setErr('Only restaurant/admin can login here');
      else nav('/');
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Restaurant Login" sub="Order before they arrive. Pick up without waiting." onSubmit={submit}>
      {err && <Alert severity="error">{err}</Alert>}
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required autoComplete="email" />
      <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required autoComplete="current-password" />
      <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 48 }}>
        {busy ? 'Logging in…' : 'Login'}
      </Button>
      <Typography variant="body2" textAlign="center">No account? <MuiLink component={Link} to="/register">Register Restaurant</MuiLink></Typography>
      <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 2, fontSize: 12, textAlign: 'center' }}>
        Demo: restaurant@test.com / password123
      </Box>
    </AuthCard>
  );
}
