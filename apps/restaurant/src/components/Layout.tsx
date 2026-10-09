import { AppBar, Toolbar, Typography, Button, Box, Container, Chip, IconButton, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeMode } from '../context/ThemeContext';
import { useTheme } from '@mui/material/styles';
import { clearSession } from '../services/api';

const nav = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Orders', path: '/orders', icon: <ReceiptLongIcon fontSize="small" /> },
  { label: 'Menu', path: '/menu', icon: <MenuBookIcon fontSize="small" /> },
  { label: 'Payments', path: '/payments', icon: <AccountBalanceIcon fontSize="small" /> },
  { label: 'Profile', path: '/profile', icon: <RestaurantIcon fontSize="small" /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { mode, toggle } = useThemeMode();
  const theme = useTheme();
  const logout = () => {
    clearSession();
    navigate('/login');
  };
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, color: 'text.primary' }}>
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box sx={{ bgcolor: '#FF6B35', p: 0.8, borderRadius: 2, display: 'flex', flexShrink: 0 }}>
              <RestaurantIcon sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}>EasyCart <Box component="span" sx={{ color: '#FF6B35', display: { xs: 'none', sm: 'inline' } }}>Restaurant</Box></Typography>
            <Chip label="Pre-Order" size="small" sx={{ ml: 1, bgcolor: mode === 'light' ? '#FFF2EC' : 'rgba(255,107,53,0.15)', color: '#FF6B35', display: { xs: 'none', lg: 'flex' } }} />
          </Box>
          {/* Desktop nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
            {nav.map((n) => (
              <Button key={n.path} component={Link} to={n.path} startIcon={n.icon}
                sx={{ color: loc.pathname === n.path ? '#FF6B35' : 'text.secondary', fontWeight: loc.pathname === n.path ? 700 : 500, bgcolor: loc.pathname === n.path ? (mode === 'light' ? '#FFF2EC' : 'rgba(255,107,53,0.15)') : 'transparent', minHeight: 40, whiteSpace: 'nowrap' }}>
                {n.label}
              </Button>
            ))}
            <IconButton onClick={toggle} sx={{ ml: 0.5, border: `1px solid ${theme.palette.divider}`, color: 'text.primary' }} aria-label="toggle theme" title={mode === 'light' ? 'Switch to dark' : 'Switch to light'}>
              {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
            <Button onClick={logout} variant="outlined" sx={{ ml: 1, borderColor: '#FF6B35', color: '#FF6B35', minHeight: 40 }}>Logout</Button>
          </Box>
          {/* Mobile actions */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1 }}>
            <IconButton onClick={toggle} sx={{ color: 'text.primary', border: `1px solid ${theme.palette.divider}` }} aria-label="toggle theme">
              {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
            <IconButton onClick={() => setOpen(true)} sx={{ color: '#FF6B35', border: `1px solid ${theme.palette.divider}` }} aria-label="menu">
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: '78vw', sm: 300 }, maxWidth: 320, bgcolor: 'background.paper' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography fontWeight={700}>Menu</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={toggle} sx={{ border: `1px solid ${theme.palette.divider}` }}>{mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}</IconButton>
            <IconButton onClick={() => setOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </Box>
        <List sx={{ p: 1 }}>
          {nav.map((n) => (
            <ListItem key={n.path} disablePadding>
              <ListItemButton component={Link} to={n.path} onClick={() => setOpen(false)} selected={loc.pathname === n.path} sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: mode === 'light' ? '#FFF2EC' : 'rgba(255,107,53,0.15)', color: '#FF6B35' } }}>
                <ListItemIcon sx={{ color: loc.pathname === n.path ? '#FF6B35' : 'text.secondary', minWidth: 36 }}>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} primaryTypographyProps={{ fontWeight: loc.pathname === n.path ? 700 : 500 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button fullWidth variant="outlined" startIcon={mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />} onClick={toggle} sx={{ minHeight: 44 }}>{mode === 'light' ? 'Dark mode' : 'Light mode'}</Button>
          <Button fullWidth variant="outlined" startIcon={<LogoutIcon />} onClick={logout} sx={{ borderColor: '#FF6B35', color: '#FF6B35', minHeight: 44 }}>Logout</Button>
        </Box>
      </Drawer>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 2, md: 3 }, overflowX: 'hidden' }}>{children}</Container>
    </Box>
  );
}
