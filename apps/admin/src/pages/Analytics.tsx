import { useState } from 'react';
import { Box, Grid, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiGet } from '../services/api';
import { ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';

type Range = 7 | 30;
function sliceDays(rows: any[], days: Range): any[] {
  return (rows || []).slice(-days);
}

export default function Analytics() {
  const [range, setRange] = useState<Range>(30);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['stats'], queryFn: apiGet.stats });

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (isError || !data) return <ErrorState message="Failed to load analytics." onRetry={refetch} />;

  const orders = sliceDays(data.ordersByDay || [], range);
  const regs = (() => {
    const map = new Map<string, any>();
    for (const d of sliceDays(data.customerRegsByDay || [], range)) map.set(d.date, { date: d.date, customers: d.count, restaurants: 0 });
    for (const d of sliceDays(data.restaurantRegsByDay || [], range)) {
      const cur = map.get(d.date) || { date: d.date, customers: 0, restaurants: 0 };
      cur.restaurants = d.count;
      map.set(d.date, cur);
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  })();

  return (
    <Box>
      <PageHeader
        title="Analytics"
        sub="Aggregated live from orders, users, and restaurants."
        action={
          <ToggleButtonGroup value={range} exclusive onChange={(_, v) => v && setRange(v)} size="small" aria-label="date range">
            <ToggleButton value={7}>7 days</ToggleButton>
            <ToggleButton value={30}>30 days</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 320 }}>
            <b>Revenue trend (GMV of paid orders)</b>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={orders}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="gmv" stroke="#22c55e" fill="#DCFCE7" name="GMV ₹" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 300 }}>
            <b>Orders per day</b>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={orders}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#FF6B35" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 300 }}>
            <b>Registrations per day</b>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={regs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="customers" fill="#3b82f6" name="Customers" />
                <Bar dataKey="restaurants" fill="#FF6B35" name="Restaurants" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
