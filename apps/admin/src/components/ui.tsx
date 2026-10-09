import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useThemeMode } from '../theme';

/* ---------- StatusChip: theme-aware pill ---------- */
const KIND: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  PAID: 'success', READY: 'success', SETTLED: 'success', ACCEPTED: 'success', approved: 'success', Enabled: 'success', Active: 'success', Available: 'success',
  PREPARING: 'warning', PROCESSING: 'warning', PENDING: 'warning', pending: 'warning', under_review: 'warning',
  FAILED: 'error', CANCELLED: 'error', REFUNDED: 'error', REVERSED: 'error', rejected: 'error', suspended: 'error',
  PICKED_UP: 'info',
};
export function StatusChip({ status }: { status: string }) {
  return <Chip label={status} size="small" color={KIND[status] || 'default'} sx={{ fontWeight: 700 }} />;
}

/* ---------- PageHeader ---------- */
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        {sub && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{sub}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({ value, label, highlight }: { value: ReactNode; label: string; highlight?: boolean }) {
  const { mode } = useThemeMode();
  void mode;
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2.5, bgcolor: highlight ? '#FF6B35' : 'background.paper', color: highlight ? 'white' : 'text.primary', height: '100%' }}>
      <Typography variant="h4" fontWeight={800}>{value}</Typography>
      <Typography color={highlight ? 'white' : 'text.secondary'} variant="body2">{label}</Typography>
    </Box>
  );
}

/* ---------- DataTable: bordered table + server pagination ---------- */
interface Col<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => ReactNode;
}
interface TableProps<T> {
  cols: Col<T>[];
  rows: T[];
  total: number;
  page: number;
  limit: number;
  onPage: (page: number, limit: number) => void;
  rowKey: (row: T) => string;
  empty?: string;
}
export function DataTable<T>({ cols, rows, total, page, limit, onPage, rowKey, empty = 'No records.' }: TableProps<T>) {
  return (
    <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {cols.map((c) => (
              <TableCell key={c.key}><b>{c.label}</b></TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)} hover>
              {cols.map((c) => (
                <TableCell key={c.key}>{c.render ? c.render(r) : c.value?.(r)}</TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={cols.length} align="center"><Typography color="text.secondary" sx={{ py: 2 }}>{empty}</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        rowsPerPage={limit}
        rowsPerPageOptions={[10, 20, 50]}
        onPageChange={(_, p) => onPage(p + 1, limit)}
        onRowsPerPageChange={(e) => onPage(1, parseInt(e.target.value, 10))}
      />
    </TableContainer>
  );
}

/* ---------- SearchFilterBar ---------- */
export function SearchFilterBar({ search, onSearch, children, placeholder = 'Search…' }: { search: string; onSearch: (v: string) => void; children?: ReactNode; placeholder?: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
      <TextField size="small" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)} sx={{ minWidth: 220 }} aria-label="Search" />
      {children}
    </Box>
  );
}

/* ---------- ConfirmDialog ---------- */
interface ConfirmProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  reasonRequired?: boolean;
  reason?: string;
  onReason?: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger = false, busy = false, reasonRequired = false, reason = '', onReason, onClose, onConfirm }: ConfirmProps) {
  const valid = !reasonRequired || reason.trim().length > 0;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={700}>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: reasonRequired ? 2 : 0 }}>{body}</Box>
        {reasonRequired && (
          <TextField label="Reason (required)" value={reason} onChange={(e) => onReason?.(e.target.value)} fullWidth multiline rows={2} error={reasonRequired && !reason.trim()} helperText={reasonRequired && !reason.trim() ? 'A reason is required' : ''} />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ minHeight: 40, flex: 1 }}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color={danger ? 'error' : 'primary'} disabled={busy || !valid} sx={{ minHeight: 40, flex: 1 }}>
          {busy ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- States ---------- */
export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={52} />
      ))}
    </Box>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert severity="error" action={onRetry ? <Button size="small" onClick={onRetry}>Retry</Button> : undefined}>
      {message}
    </Alert>
  );
}
export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <Alert severity="info">
      {message}
      {hint && <Typography variant="body2" sx={{ mt: 0.5 }}>{hint}</Typography>}
    </Alert>
  );
}
