import { useState } from 'react';
import { AppBar, Box, Container, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Typography } from '@mui/material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import StoreIcon from '@mui/icons-material/Store';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ReceiptIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import UndoIcon from '@mui/icons-material/Undo';
import RateReviewIcon from '@mui/icons-material/RateReview';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AdminPanelIcon from '@mui/icons-material/AdminPanelSettings';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { useThemeMode, brand } from '../theme';
import { clearSession, storedAdmin } from '../services/api';

const NAV = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Customers', path: '/customers', icon: <PeopleIcon fontSize="small" /> },
  { label: 'Owners', path: '/owners', icon: <StoreIcon fontSize="small" /> },
  { label: 'Restaurants', path: '/restaurants', icon: <RestaurantIcon fontSize="small" /> },
  { label: 'Approvals', path: '/approvals', icon: <FactCheckIcon fontSize="small" /> },
  { label: 'Menu', path: '/menu', icon: <MenuBookIcon fontSize="small" /> },
  { label: 'Orders', path: '/orders', icon: <ReceiptIcon fontSize="small" /> },
  { label: 'Payments', path: '/payments', icon: <PaymentsIcon fontSize="small" /> },
  { label: 'Refunds', path: '/refunds', icon: <UndoIcon fontSize="small" /> },
  { label: 'Reviews', path: '/reviews', icon: <RateReviewIcon fontSize="small" /> },
  { label: 'Notifications', path: '/notifications', icon: <NotificationsIcon fontSize="small" /> },
  { label: 'Analytics', path: '/analytics', icon: <AnalyticsIcon fontSize="small" /> },
  { label: 'Admins', path: '/admins', icon: <AdminPanelIcon fontSize="small" /> },
  { label: 'Audit Logs', path: '/audit', icon: <HistoryIcon fontSize="small" /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon fontSize="small" /> },
];

const titles: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.path, n.label]));

const noScrollbar = { scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } } as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { mode, toggle } = useThemeMode();
  const admin = storedAdmin();

  const logout = () => {
    clearSession();
    nav('/login');
  };

  const drawer = (
    <>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ bgcolor: brand.primary, borderRadius: 2, p: 0.8, display: 'flex' }}>
          <RestaurantIcon sx={{ color: 'white', fontSize: 20 }} />
        </Box>
            <Typography fontWeight={800}>EasyCart <Box component="span" sx={{ color: brand.primary }}>Admin</Box></Typography>
      </Box>
      <Divider />
      <List sx={{ p: 1 }}>
        {NAV.map((n) => (
          <ListItem key={n.path} disablePadding>
            <ListItemButton component={Link} to={n.path} onClick={() => setOpen(false)} selected={loc.pathname === n.path} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 36, color: loc.pathname === n.path ? brand.primary : 'text.secondary' }}>{n.icon}</ListItemIcon>
              <ListItemText primary={n.label} primaryTypographyProps={{ fontWeight: loc.pathname === n.path ? 700 : 500, fontSize: 14 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: 240 }, flexShrink: 0 }}>
        <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} sx={{ display: { md: 'none' } }} PaperProps={{ sx: { width: 250, ...noScrollbar } }}>
          {drawer}
          <Box sx={{ p: 2 }}><IconButton onClick={() => setOpen(false)} aria-label="close"><CloseIcon /></IconButton></Box>
        </Drawer>
        <Drawer variant="permanent" open sx={{ display: { xs: 'none', md: 'block' } }} PaperProps={{ sx: { width: 240, boxSizing: 'border-box', ...noScrollbar } }}>
          {drawer}
        </Drawer>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar>
            <IconButton onClick={() => setOpen(true)} sx={{ mr: 1, display: { md: 'none' } }} aria-label="menu"><MenuIcon /></IconButton>
            <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>{titles[loc.pathname] || 'Admin'}</Typography>
            <IconButton onClick={toggle} aria-label="toggle theme" title="Toggle theme">
              {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
            <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="profile">
              <AccountCircleIcon />
            </IconButton>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
              <MenuItem disabled>{admin?.email || 'admin'}</MenuItem>
              <MenuItem onClick={logout}><LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
