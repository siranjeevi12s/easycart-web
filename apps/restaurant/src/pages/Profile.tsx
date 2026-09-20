import { useEffect, useState, useRef } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Switch, FormControlLabel, Stack, Alert } from '@mui/material';
import { api } from '../services/api';

export default function Profile() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '', address: '', phone: '', image: '' });
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      load();
    } catch (e: any) { setMsg(e.response?.data?.message || 'Failed'); }
  };
  const toggle = async (r: any, field: 'isOpen' | 'isActive') => {
    await api.put(`/restaurants/${r._id}`, { [field]: !r[field] });
    load();
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setForm((f) => ({ ...f, image: url }));
      setPreview(url);
    };
    reader.readAsDataURL(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
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
            <TextField
              label="Image URL"
              value={form.image}
              onChange={(e) => {
                setForm({
                  ...form,
                  image: e.target.value
                });
                setPreview(e.target.value || null);
              }}
              fullWidth
              placeholder="https://... or use Browse below"
            />
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: isDragging ? '#FF6B35' : '#FFE8DE',
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
                bgcolor: isDragging ? '#FFF3EE' : '#FFF8F5',
                transition: 'all 0.2s ease'
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    borderColor: '#FF6B35',
                    color: '#FF6B35',
                    minHeight: 40
                  }}
                >
                  Browse local file
                </Button>
                <Typography variant="body2" color="text.secondary">
                  or drag image here • Max 2MB • JPG/PNG
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFile}
                />
              </Box>
            </Box>
            {(preview || form.image) && (
              <Box
                sx={{
                  position: 'relative',
                  border: '1px solid #FFE8DE',
                  borderRadius: 2,
                  overflow: 'hidden',
                  height: 160,
                  bgcolor: '#FFF8F5'
                }}
              >
                <Box
                  component="img"
                  src={preview || form.image}
                  alt="preview"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <Button
                  size="small"
                  onClick={() => {
                    setForm({
                      ...form,
                      image: ''
                    });
                    setPreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    minWidth: 0,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.8)'
                    }
                  }}
                >
                  ✕ Clear
                </Button>
              </Box>
            )}
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

