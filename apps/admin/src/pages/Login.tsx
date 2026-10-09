import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, saveSession } from '../services/api';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: 'admin@easycart.local', password: '' } });

  const submit = async (f: Form) => {
    setErr('');
    try {
      const { data } = await api.post('/auth/login', f);
      if (data.user?.role !== 'admin') {
        setErr('This console is for administrators only');
        return;
      }
      saveSession(data.token, data.refreshToken, data.user);
      nav('/');
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Login failed');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(255,107,53,0.15)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            EasyCart <Box component="span" sx={{ color: '#FF6B35' }}>Admin</Box>
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            Platform operations console. Admin credentials only.
          </Typography>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Box component="form" onSubmit={handleSubmit(submit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Email" fullWidth autoComplete="username" error={!!errors.email} helperText={errors.email?.message} {...register('email')} />
            <TextField label="Password" type="password" fullWidth autoComplete="current-password" error={!!errors.password} helperText={errors.password?.message} {...register('password')} />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting} sx={{ bgcolor: '#FF6B35', '&:hover': { bgcolor: '#E55A2B' }, minHeight: 48 }}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
