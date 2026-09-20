import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Link as MuiLink } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('restaurant@test.com');
  const [password, setPassword] = useState('password123');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.role !== 'restaurant' && data.user.role !== 'admin') setErr('Only restaurant/admin can login here');
      else nav('/');
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Login failed');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#FFF8F5', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(255,107,53,0.15)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>Restaurant Login</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>Order before they arrive. Pick up without waiting.</Typography>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Box component="form" onSubmit={submit} className="flex flex-col gap-4">
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" size="large" sx={{ bgcolor: '#FF6B35', '&:hover': { bgcolor: '#E55A2B' } }}>Login</Button>
            <Typography variant="body2" textAlign="center">No account? <MuiLink component={Link} to="/register">Register Restaurant</MuiLink></Typography>
            <Box sx={{ bgcolor: '#FFF2EC', p: 1.5, borderRadius: 2, fontSize: 12 }}>
              Demo: restaurant@test.com / password123
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
