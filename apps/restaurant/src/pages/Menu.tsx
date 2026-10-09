import { useEffect, useState, useRef } from 'react';
import { Box, Button, Card, CardContent, CardMedia, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, Stack, Switch, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';
import { useSnack } from '../components/useSnack';
import { brand } from '../theme/tokens';

const EMPTY_FORM = { name: '', description: '', price: 0, category: 'Main', image: '', isAvailable: true };

export default function Menu() {
  const theme = useTheme();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show, fail, host } = useSnack();

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

  const closeDialog = () => { setOpen(false); setPreview(null); setEditing(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const save = async () => {
    if (!form.name.trim()) { show('Item name required', 'error'); return; }
    if (!(form.price > 0)) { show('Price must be greater than zero', 'error'); return; }
    try {
      if (editing) await api.put(`/menu/${editing}`, form);
      else await api.post(`/restaurants/${selected}/menu`, form);
      closeDialog();
      setForm(EMPTY_FORM);
      loadMenu();
      show(editing ? 'Item updated' : 'Item created');
    } catch (e: any) {
      fail(e, 'Save failed');
    }
  };
  const del = async (id: string) => {
    try { await api.delete(`/menu/${id}`); loadMenu(); }
    catch (e: any) { fail(e, 'Delete failed'); }
  };
  const edit = (it: any) => { setForm({ name: it.name, description: it.description, price: it.price, category: it.category, image: it.image, isAvailable: it.isAvailable }); setPreview(it.image || null); setEditing(it._id); setOpen(true); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { show('Please select an image file', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { show('Image must be under 2MB', 'error'); return; }
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
      <PageHeader
        title="Menu Management"
        sub="Add • Edit • Disable — snapshot pricing protects order history."
        action={<Button variant="contained" onClick={() => { setForm(EMPTY_FORM); setPreview(null); setEditing(null); setOpen(true); }} sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 40 }}>+ Add Item</Button>}
      />

      {restaurants.length === 0 ? <EmptyState severity="warning" message="No restaurant profile yet." hint="Create one in Profile." /> :
        <Box sx={{ mb: 2, overflowX: 'auto', pb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
            {restaurants.map((r) => (
              <Chip key={r._id} label={r.name} onClick={() => setSelected(r._id)} color={selected === r._id ? 'primary' : 'default'} sx={selected === r._id ? { bgcolor: brand.primary, color: 'white', flexShrink: 0 } : { flexShrink: 0 }} />
            ))}
          </Stack>
        </Box>
      }

      <Grid container spacing={2}>
        {items.map((it) => (
          <Grid item xs={12} sm={6} md={4} key={it._id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {!!it.image && <CardMedia component="img" height="160" image={it.image} alt={it.name} />}
              <CardContent sx={{ flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Typography fontWeight={700}>{it.name}</Typography>
                  <StatusChip status={it.isAvailable ? 'Available' : 'Disabled'} kind={it.isAvailable ? 'success' : 'muted'} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 32 }}>{it.description}</Typography>
                <Typography fontWeight={700} sx={{ mt: 1 }}>₹{it.price} <Chip label={it.category} size="small" sx={{ ml: 1 }} /></Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="outlined" onClick={() => edit(it)} sx={{ minHeight: 36 }}>Edit</Button>
                  <Button size="small" color="error" onClick={() => del(it._id)} sx={{ minHeight: 36 }}>Delete</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {restaurants.length > 0 && items.length === 0 && <EmptyState message="No menu items yet." hint="Add your first item to start receiving orders." />}

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { m: 2, borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{editing ? 'Edit Item' : 'Add Menu Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
            <TextField label="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} fullWidth required inputProps={{ min: 1 }} />
            <TextField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth />
            <TextField label="Image URL" value={form.image} onChange={(e) => { setForm({ ...form, image: e.target.value }); setPreview(e.target.value || null); }} fullWidth placeholder="https://... or use Browse below" />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ borderColor: brand.primary, color: brand.primary, minHeight: 40 }}>Browse local file</Button>
              <Typography variant="body2" color="text.secondary">Max 2MB • JPG/PNG</Typography>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
            </Box>
            {(preview || form.image) && (
              <Box sx={{ position: 'relative', border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden', height: 160, bgcolor: 'background.default' }}>
                <Box component="img" src={preview || form.image} alt="preview" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <Button size="small" onClick={() => { setForm({ ...form, image: '' }); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>✕ Clear</Button>
              </Box>
            )}
            <FormControlLabel control={<Switch checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />} label="Available" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeDialog} sx={{ minHeight: 40 }}>Cancel</Button>
          <Button variant="contained" onClick={save} sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 40 }}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
      {host}
    </Box>
  );
}
