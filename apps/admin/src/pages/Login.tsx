import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, getApiErrorMessage, saveSession } from '../services/api';
import { brand } from '../theme';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string().min(1, 'Password required').max(128),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const submit = async (f: Form) => {
    setErr('');
    try {
      const { data } = await api.post('/auth/login', f);
      if (data?.user?.role !== 'admin') {
        // Generic message — don't reveal which accounts exist.
        setErr('Invalid credentials or insufficient permissions.');
        return;
      }
      if (!data?.token) {
        setErr('Login failed. Please try again.');
        return;
      }
      saveSession(data.token, data.refreshToken, data.user);
      nav('/', { replace: true });
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Login failed. Please try again.'));
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(255,107,53,0.15)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            EasyCart <Box component="span" sx={{ color: brand.primary }}>Admin</Box>
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            Platform operations console. Authorized administrators only.
          </Typography>
          {err && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {err}
            </Alert>
          )}
          <Box
            component="form"
            onSubmit={handleSubmit(submit)}
            autoComplete="off"
            spellCheck={false}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label="Email"
              type="email"
              fullWidth
              autoComplete="username"
              inputProps={{ maxLength: 254, autoCapitalize: 'none' }}
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              autoComplete="current-password"
              inputProps={{ maxLength: 128 }}
              error={!!errors.password}
              helperText={errors.password?.message}
              {...register('password')}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 48 }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
