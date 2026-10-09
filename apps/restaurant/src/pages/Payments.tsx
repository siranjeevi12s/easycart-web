import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControl, InputLabel,
  MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusChip from '../components/StatusChip';
import EmptyState from '../components/EmptyState';
import { useSnack } from '../components/useSnack';
import { brand } from '../theme/tokens';

export default function Payments() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'UPI' | 'BANK'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [payout, setPayout] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [linkedAccount, setLinkedAccount] = useState('');
  const [routeBusy, setRouteBusy] = useState(false);
  const [pan, setPan] = useState('');
  const { show, fail, host } = useSnack();

  const loadRestaurants = async () => {
    const { data } = await api.get('/restaurants/my');
    setRestaurants(data);
    if (data.length > 0 && !selectedId) setSelectedId(data[0]._id);
    setLoading(false);
  };

  const loadPayout = async (id: string) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/restaurants/${id}/payout`);
      setPayout(data);
      setMode(data.payoutMode || 'UPI');
      setUpiId(data.payoutUpiId || '');
      setHolder(data.payoutAccountHolder || '');
      setAccount(data.payoutAccountNumber || '');
      setIfsc(data.payoutIfsc || '');
      setBankName(data.payoutBankName || '');
      setLinkedAccount(data.razorpayLinkedAccountId || '');
      const s = await api.get(`/restaurants/${id}/settlements`);
      setSettlements(s.data);
    } catch (e: any) {
      fail(e, 'Failed to load payout details');
    }
  };

  useEffect(() => { loadRestaurants(); }, []);
  useEffect(() => { if (selectedId) loadPayout(selectedId); }, [selectedId]);

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const body = mode === 'UPI'
        ? { payoutMode: 'UPI', payoutUpiId: upiId.trim(), razorpayLinkedAccountId: linkedAccount.trim() }
        : { payoutMode: 'BANK', payoutAccountHolder: holder.trim(), payoutAccountNumber: account.replace(/\s/g, ''), payoutIfsc: ifsc.trim().toUpperCase(), payoutBankName: bankName.trim(), razorpayLinkedAccountId: linkedAccount.trim() };
      const { data } = await api.put(`/restaurants/${selectedId}/payout`, body);
      show(data.message);
      loadPayout(selectedId);
      loadRestaurants();
    } catch (e: any) {
      fail(e, 'Save failed — check UPI / IFSC format');
    } finally { setSaving(false); }
  };

  const onboardRoute = async () => {
    if (!selectedId) return;
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(pan.trim())) {
      show('Enter a valid 10-character PAN for Route KYC first', 'error');
      return;
    }
    setRouteBusy(true);
    try {
      const { data } = await api.post(`/restaurants/${selectedId}/route-account`, { pan: pan.trim().toUpperCase() });
      show(data.message);
      loadPayout(selectedId);
    } catch (e: any) {
      fail(e, 'Route onboarding failed');
    } finally { setRouteBusy(false); }
  };

  const markSettled = async (orderId: string) => {
    if (!selectedId) return;
    setSettlingId(orderId);
    try {
      await api.patch(`/restaurants/${selectedId}/settlements/${orderId}`, { settlementRef: `UPI-${Date.now()}` });
      show('Marked settled — amount transferred to your account');
      loadPayout(selectedId);
    } catch (e: any) {
      fail(e, 'Failed');
    } finally { setSettlingId(null); }
  };

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress color="primary" /></Box>;

  if (restaurants.length === 0)
    return <EmptyState severity="warning" message="No restaurant profile yet." hint="Create a restaurant profile first (Profile page), then configure payouts here." />;

  const selected = restaurants.find((r) => r._id === selectedId);

  return (
    <Box>
      <PageHeader
        title="Payments & Payouts"
        sub="Collect your payment details once — every order amount settles here. Razorpay collects from customer → transfers to your account below."
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Restaurant</InputLabel>
        <Select value={selectedId} label="Restaurant" onChange={(e) => setSelectedId(e.target.value)}>
          {restaurants.map((r) => (
            <MenuItem key={r._id} value={r._id}>{r.name} — {r.payoutEnabled ? 'Payouts on' : 'Payouts off'}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {selected && !selected.payoutEnabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <b>{selected.name}</b> cannot receive orders yet — customers see “payouts not configured”. Complete the form below to go live and receive order amounts.
        </Alert>
      )}
      {payout?.payoutEnabled && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Payouts active — {payout.payoutMode === 'UPI' ? `settling to UPI ${payout.payoutUpiId}` : `settling to ${payout.payoutBankName} ****${(payout.payoutAccountNumber || '').slice(-4)}`}
          {payout.settlementMode === 'ROUTE_AUTO' ? ' • Razorpay Route auto-split ON' : ' • Settlement queued (platform settles to the above account)'}
        </Alert>
      )}

      {/* Earnings */}
      {payout?.earnings && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <Box sx={{ flex: 1 }}><StatCard highlight value={`₹${payout.earnings.totalReceived}`} label={`Total received (${payout.earnings.paidOrders} paid orders)`} /></Box>
          <Box sx={{ flex: 1 }}><StatCard value={`₹${payout.earnings.pendingSettlement}`} label={`Pending settlement (${payout.earnings.pendingCount})`} /></Box>
          <Box sx={{ flex: 1 }}><StatCard value={`₹${payout.earnings.settled}`} label={`Settled (${payout.earnings.settledCount})`} /></Box>
          <Box sx={{ flex: 1 }}><StatCard value={`₹${payout.earnings.platformFees ?? 0}`} label={`EasyCart fee (${payout.platformFeePercent ?? 0}%)`} /></Box>
        </Stack>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <AccountBalanceIcon sx={{ color: brand.primary }} />
            <Typography fontWeight={700}>Where should order money go?</Typography>
            {payout && <StatusChip status={payout.payoutEnabled ? 'Enabled' : 'Not configured'} kind={payout.payoutEnabled ? 'success' : 'warning'} />}
          </Box>

          <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} sx={{ mb: 2 }} aria-label="payout mode">
            <ToggleButton value="UPI" sx={{ px: 3, minHeight: 44 }}>UPI (instant)</ToggleButton>
            <ToggleButton value="BANK" sx={{ px: 3, minHeight: 44 }}>Bank account</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'UPI' ? (
            <Stack spacing={2}>
              <TextField label="UPI ID *" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@okhdfcbank" helperText="This is where all order amounts settle. Double-check — wrong UPI = lost payouts." fullWidth />
            </Stack>
          ) : (
            <Stack spacing={2}>
              <TextField label="Account holder name *" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As per bank records" fullWidth />
              <TextField label="Account number *" value={account} onChange={(e) => setAccount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="9–18 digits" inputProps={{ inputMode: 'numeric' }} fullWidth />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="IFSC *" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="HDFC0001234" fullWidth />
                <TextField label="Bank name *" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" fullWidth />
              </Stack>
            </Stack>
          )}

          <Button variant="contained" onClick={save} disabled={saving} sx={{ mt: 2, bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 48 }} fullWidth>
            {saving ? <CircularProgress size={22} color="inherit" /> : payout?.payoutEnabled ? 'Update payment details' : 'Save & enable payouts'}
          </Button>
          <TextField
            label="Razorpay Route linked account (optional)"
            value={linkedAccount}
            onChange={(e) => setLinkedAccount(e.target.value.trim())}
            placeholder="acc_XXXX (from Razorpay Route dashboard after KYC)"
            helperText="Only if Razorpay Route is activated. Enables automatic split on every payment; otherwise settlements queue and the platform settles to your UPI/bank above."
            fullWidth
            sx={{ mt: 2 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            By saving you confirm this account belongs to the restaurant owner. In production this triggers penny-drop verification via Razorpay Route/X.
          </Typography>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Typography fontWeight={700}>Razorpay Route account</Typography>
            {payout?.razorpayLinkedAccountId
              ? <Chip size="small" label={`Linked • ${payout.razorpayLinkedAccountId}`} color="success" />
              : <Chip size="small" label="Not linked" color="warning" />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            One-time onboarding with your payout details above (PAN required for KYC). After this, every Razorpay payment auto-splits their share on capture — no manual settlement.
          </Typography>
          <TextField
            label="PAN (for Route KYC) *"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            placeholder="ABCDE1234F"
            helperText="Required by Razorpay to verify the seller. Must match the payout account holder."
            fullWidth
            sx={{ mb: 1 }}
          />
          <Button variant="contained" onClick={onboardRoute} disabled={routeBusy || !payout?.payoutEnabled} sx={{ bgcolor: '#7C3AED', minHeight: 44 }}>
            {routeBusy ? <CircularProgress size={20} color="inherit" /> : payout?.razorpayLinkedAccountId ? 'Route account linked ✓' : 'Create Razorpay Route account'}
          </Button>
        </CardContent>
      </Card>

      <Typography fontWeight={700} sx={{ mb: 1 }}>Settlement history — mark amounts after you transfer / confirm receipt</Typography>
      <Card variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell><b>Order</b></TableCell><TableCell><b>Total</b></TableCell><TableCell><b>Your share</b></TableCell><TableCell><b>Fee</b></TableCell><TableCell><b>Date</b></TableCell><TableCell><b>Status</b></TableCell><TableCell><b>Action</b></TableCell>
          </TableRow></TableHead>
          <TableBody>
            {settlements.map((o: any) => {
              const status = o.settlementStatus || o.payoutStatus;
              const settled = status === 'SETTLED';
              return (
                <TableRow key={o._id}>
                  <TableCell>{o.orderNumber}</TableCell>
                  <TableCell>₹{o.totalAmount}</TableCell>
                  <TableCell>₹{o.restaurantAmount ?? o.totalAmount}</TableCell>
                  <TableCell>₹{o.platformFee ?? 0}</TableCell>
                  <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><StatusChip status={status} kind={settled ? 'success' : status === 'REVERSED' || status === 'FAILED' ? 'error' : 'warning'} /></TableCell>
                  <TableCell>
                    {!settled && status !== 'REVERSED'
                      ? <Button size="small" variant="outlined" disabled={settlingId === o._id} onClick={() => markSettled(o._id)} sx={{ borderColor: '#22c55e', color: '#16a34a' }}>{settlingId === o._id ? '…' : 'Mark settled'}</Button>
                      : <Typography variant="caption" color="text.secondary">{o.transferId || o.settlementRef || ''}</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
            {settlements.length === 0 && <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" sx={{ py: 2 }}>No paid orders yet — settlements appear here.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <Divider sx={{ my: 3 }} />
      <Alert severity="info">
        <b>Real-world flow:</b> 1) Add live Razorpay keys on server (<code>RAZORPAY_KEY_ID=rzp_live_…</code>). 2) Customer pays via Razorpay Checkout. 3) Money hits platform account → auto/manually settled to the UPI/bank above. For instant direct settlement, connect Razorpay Route with linked accounts per restaurant.
      </Alert>
      {host}
    </Box>
  );
}
