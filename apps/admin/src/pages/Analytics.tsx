import { useState } from 'react';
import { Box, Grid, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiGet } from '../services/api';
import { ErrorState, LoadingSkeleton, PageHeader } from '../components/ui';
import { ChartTooltip, SeriesToggle } from '../components/charts';
import { brand } from '../theme';

type Range = 7 | 30;
function sliceDays(rows: any[], days: Range): any[] {
  return (rows || []).slice(-days);
}

export default function Analytics() {
  const [range, setRange] = useState<Range>(30);
  const [countSeries, setCountSeries] = useState<string[]>(['orders']);
  const [regSeries, setRegSeries] = useState<string[]>(['customers', 'restaurants']);
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
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 340 }}>
            <b>Revenue trend (GMV of paid orders)</b>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Drag the brush to zoom a window
            </Typography>
            <ResponsiveContainer width="100%" height="86%">
              <AreaChart data={orders}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="gmv" stroke="#22c55e" fill="#DCFCE7" name="GMV ₹" animationDuration={400} />
                <Brush dataKey="date" height={24} stroke="#22c55e" travellerWidth={10} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 320 }}>
            <b>Orders per day</b>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Toggle GMV overlay • brush to zoom
            </Typography>
            <SeriesToggle
              options={[{ key: 'gmv', label: 'GMV ₹ overlay', color: '#22c55e' }]}
              active={countSeries}
              onChange={setCountSeries}
            />
            <ResponsiveContainer width="100%" height="68%">
              <BarChart data={orders}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="orders" fill={brand.primary} name="Orders" animationDuration={400} />
                {countSeries.includes('gmv') && <Bar dataKey="gmv" fill="#22c55e" name="GMV ₹" animationDuration={400} />}
                <Brush dataKey="date" height={20} stroke={brand.primary} travellerWidth={10} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 320 }}>
            <b>Registrations per day</b>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Toggle series to compare
            </Typography>
            <SeriesToggle
              options={[
                { key: 'customers', label: 'Customers', color: '#3b82f6' },
                { key: 'restaurants', label: 'Restaurants', color: brand.primary },
              ]}
              active={regSeries}
              onChange={setRegSeries}
            />
            <ResponsiveContainer width="100%" height="68%">
              <BarChart data={regs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip moneyKeys={[]} />} />
                {regSeries.includes('customers') && <Bar dataKey="customers" fill="#3b82f6" name="Customers" animationDuration={400} />}
                {regSeries.includes('restaurants') && <Bar dataKey="restaurants" fill={brand.primary} name="Restaurants" animationDuration={400} />}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
