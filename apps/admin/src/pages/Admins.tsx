import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { ConfirmDialog, DataTable, ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';
import { fmtDate, useAdminList } from '../hooks';
import { brand } from '../theme';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

const schema = z.object({
  name: z.string().min(2, 'Name min 2 chars'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 chars'),
});
type Form = z.infer<typeof schema>;

export default function Admins() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  // Admins are users with role=admin; single-role system in this version.
  const adminsQuery = useAdminList('admins-list', (p) => api.get('/admin/admins', { params: p }).then((r) => r.data));

  const create = useMutation({
    mutationFn: (f: Form) => api.post('/admin/users', { ...f, role: 'admin' }),
    onSuccess: () => {
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ['admins-list'] });
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Create failed'),
  });

  const rows = adminsQuery.rows || [];

  return (
    <Box>
      <PageHeader
        title="Admin Users"
        sub="Single admin role in this version — every admin here has full console access. No public registration exists."
        action={<Button variant="contained" sx={{ bgcolor: brand.primary }} onClick={() => setOpen(true)}>+ New admin</Button>}
      />
      {adminsQuery.isLoading ? <LoadingSkeleton /> : adminsQuery.isError ? <ErrorState message="Failed to load admins." onRetry={adminsQuery.refetch} /> : (
        <DataTable
          cols={[
            { key: 'name', label: 'Name', value: (u: any) => <b>{u.name}</b> },
            { key: 'email', label: 'Email', value: (u: any) => u.email },
            { key: 'created', label: 'Created', value: (u: any) => fmtDate(u.createdAt) },
            { key: 'status', label: 'Status', value: (u: any) => (u.isSuspended ? 'Suspended' : 'Active') },
          ]}
          rows={rows}
          total={adminsQuery.total}
          page={adminsQuery.page}
          limit={adminsQuery.limit}
          onPage={adminsQuery.onPage}
          rowKey={(u: any) => u._id}
          empty="No admins found."
        />
      )}

      <Dialog open={open} onClose={() => setConfirmClose(true)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>New admin user</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit((f) => create.mutate(f))} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" fullWidth error={!!errors.name} helperText={errors.name?.message} {...register('name')} />
            <TextField label="Email" fullWidth error={!!errors.email} helperText={errors.email?.message} {...register('email')} />
            <TextField label="Password" type="password" fullWidth error={!!errors.password} helperText={errors.password?.message} {...register('password')} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmClose(true)} sx={{ minHeight: 40, flex: 1 }} variant="outlined">Cancel</Button>
          <Button onClick={handleSubmit((f) => create.mutate(f))} variant="contained" disabled={isSubmitting || create.isPending} sx={{ minHeight: 40, flex: 1, bgcolor: brand.primary }}>
            Create admin
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        title="Discard new admin?"
        body="Unsaved details will be lost."
        confirmLabel="Discard"
        onClose={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); setOpen(false); reset(); }}
      />
    </Box>
  );
}
