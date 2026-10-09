import { Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { apiGet } from '../services/api';
import { DataTable, ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';
import { fmtDate, useAdminList } from '../hooks';

const ACTIONS = ['restaurant.approved', 'restaurant.rejected', 'restaurant.suspended', 'restaurant.under_review', 'restaurant.toggle', 'user.suspend', 'user.reactivate', 'user.create', 'refund.admin', 'refund.restaurant'];

export default function Audit() {
  const list = useAdminList('audit', apiGet.audit);

  return (
    <Box>
      <PageHeader title="Audit Logs" sub="Server-generated trail. Frontend can read — never write or modify." />
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Action</InputLabel>
          <Select value={list.filters.action || ''} label="Action" onChange={(e) => list.setFilter('action', e.target.value || undefined)}>
            <MenuItem value="">All actions</MenuItem>
            {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      {list.isLoading ? <LoadingSkeleton /> : list.isError ? <ErrorState message="Failed to load audit log." onRetry={list.refetch} /> : (
        <DataTable
          cols={[
            { key: 'time', label: 'Time', value: (a: any) => fmtDate(a.createdAt) },
            { key: 'admin', label: 'Admin', value: (a: any) => a.adminEmail || a.adminId?.email || '—' },
            { key: 'action', label: 'Action', value: (a: any) => <code style={{ fontSize: 12 }}>{a.action}</code> },
            { key: 'target', label: 'Target', value: (a: any) => `${a.targetType}${a.targetId ? ` • ${String(a.targetId).slice(-6)}` : ''}` },
            { key: 'reason', label: 'Reason', value: (a: any) => a.reason || '—' },
            { key: 'outcome', label: 'Outcome', value: (a: any) => a.outcome },
          ]}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.onPage}
          rowKey={(a: any) => a._id}
          empty="No audit entries yet. Admin actions will appear here."
        />
      )}
    </Box>
  );
}
