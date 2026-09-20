import { useEffect, useState, useRef } from 'react';
import { Box, Card, CardContent, Typography, Button, TextField, Grid, CardMedia, Chip, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Alert } from '@mui/material';
import { api } from '../services/api';

export default function Menu() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: 0, category: 'Main', image: '', isAvailable: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRestaurants = async () => {
    const { data } = await api.get('/restaurants/my');
    setRestaurants(data);
    if (data[0]) setSelected(data[0]._id);
  };
  const loadMenu = async () => {
    if (!selected) return;
    const { data } = await api.get(`/restaurants/${selected}/menu`);
    setItems(data);
  };
  useEffect(() => { loadRestaurants(); }, []);
  useEffect(() => { loadMenu(); }, [selected]);

  const save = async () => {
    if (editing) {
      await api.put(`/menu/${editing}`, form);
    } else {
      await api.post(`/restaurants/${selected}/menu`, form);
    }
    setOpen(false); setForm({ name: '', description: '', price: 0, category: 'Main', image: '', isAvailable: true }); setPreview(null); setEditing(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadMenu();
  };
  const del = async (id: string) => { await api.delete(`/menu/${id}`); loadMenu(); };
  const edit = (it: any) => { setForm({ name: it.name, description: it.description, price: it.price, category: it.category, image: it.image, isAvailable: it.isAvailable }); setPreview(it.image || null); setEditing(it._id); setOpen(true); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setForm((f: any) => ({ ...f, image: url }));
      setPreview(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box>
      <Box className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <Box>
          <Typography variant="h5" fontWeight={700}>Menu Management</Typography>
          <Typography color="text.secondary">Add • Edit • Disable — snapshot pricing protects order history.</Typography>
        </Box>
        <Button variant="contained" sx={{ bgcolor: '#FF6B35' }} onClick={() => { setForm({ name: '', description: '', price: 0, category: 'Main', image: '', isAvailable: true }); setPreview(null); setEditing(null); setOpen(true); }}>+ Add Item</Button>
      </Box>

      {restaurants.length === 0 ? <Alert severity="warning">No restaurant profile yet. Create one in Profile.</Alert> :
        <Box sx={{ mb: 2, overflowX: 'auto', pb: 1, WebkitOverflowScrolling: 'touch' }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
            {restaurants.map((r) => (
              <Chip key={r._id} label={r.name} onClick={() => setSelected(r._id)} color={selected === r._id ? 'primary' : 'default'} sx={selected === r._id ? { bgcolor: '#FF6B35', color: 'white', flexShrink: 0 } : { flexShrink: 0 }} />
            ))}
          </Stack>
        </Box>
      }

      <Grid container spacing={2}>
        {items.map((it) => (
          <Grid item xs={12} sm={6} md={4} key={it._id}>
            <Card>
              <CardMedia component="img" height="160" image={it.image} />
              <CardContent>
                <Box className="flex justify-between">
                  <Typography fontWeight={700}>{it.name}</Typography>
                  <Chip label={it.isAvailable ? 'Available' : 'Disabled'} size="small" color={it.isAvailable ? 'success' : 'default'} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 32 }}>{it.description}</Typography>
                <Typography fontWeight={700} sx={{ mt: 1 }}>₹{it.price} <Chip label={it.category} size="small" sx={{ ml: 1 }} /></Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="outlined" onClick={() => edit(it)}>Edit</Button>
                  <Button size="small" color="error" onClick={() => del(it._id)}>Delete</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => { setOpen(false); setPreview(null); setEditing(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 1.5, sm: 2 }, width: { xs: 'calc(100% - 24px)', sm: '100%' }, borderRadius: 3 } }}>
        <DialogTitle>{editing ? 'Edit Item' : 'Add Menu Item'}</DialogTitle>
        <DialogContent className="flex flex-col gap-4" sx={{ pt: 2, gap: 2, display: 'flex', flexDirection: 'column' }}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth />
          <TextField label="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} fullWidth />
          <TextField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth />
          <TextField label="Image URL" value={form.image} onChange={(e) => { setForm({ ...form, image: e.target.value }); setPreview(e.target.value || null); }} fullWidth placeholder="https://... or use Browse below" />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ borderColor: '#FF6B35', color: '#FF6B35', minHeight: 40 }}>Browse local file</Button>
            <Typography variant="body2" color="text.secondary">or drag image here • Max 2MB • JPG/PNG</Typography>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
          </Box>
          {(preview || form.image) && (
            <Box sx={{ position: 'relative', border: '1px solid #FFE8DE', borderRadius: 2, overflow: 'hidden', height: 160, bgcolor: '#FFF8F5' }}>
              <Box component="img" src={preview || form.image} alt="preview" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Button size="small" onClick={() => { setForm({ ...form, image: '' }); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>✕ Clear</Button>
            </Box>
          )}
          <FormControlLabel control={<Switch checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />} label="Available" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setEditing(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancel</Button>
          <Button variant="contained" onClick={save} sx={{ bgcolor: '#FF6B35' }}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
