import { useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet } from '../services/api';
import { PageHeader, StatCard, LoadingSkeleton, ErrorState } from '../components/ui';
import { ChartTooltip, SeriesToggle } from '../components/charts';
import { brand } from '../theme';
import { fmtINR } from '../hooks';

const PIE_COLORS = [brand.primary, '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#64748b'];

export default function Dashboard() {
  const nav = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['stats'], queryFn: apiGet.stats });
  const [flowSeries, setFlowSeries] = useState<string[]>(['orders', 'gmv']);
  const [regSeries, setRegSeries] = useState<string[]>(['customers', 'restaurants']);
  const [pieActive, setPieActive] = useState<number | undefined>(undefined);

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (isError || !data) return <ErrorState message="Failed to load platform stats." onRetry={refetch} />;

  return (
    <Box>
      <PageHeader title="Dashboard" sub="Live platform overview — every figure from the backend. Click charts to drill in." />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}><StatCard value={data.customers} label={`Customers (${data.activeCustomers} active)`} /></Grid>
        <Grid item xs={6} md={3}><StatCard value={data.owners} label="Restaurant owners" /></Grid>
        <Grid item xs={6} md={3}><StatCard value={data.restaurants} label={`Restaurants (${data.activeRestaurants} live)`} /></Grid>
        <Grid item xs={6} md={3}><StatCard value={data.pendingApprovals} label="Pending approvals" highlight={data.pendingApprovals > 0} /></Grid>
        <Grid item xs={6} md={3}><StatCard value={data.orders} label={`Orders (${data.openOrders} awaiting action)`} /></Grid>
        <Grid item xs={6} md={3}><StatCard value={fmtINR(data.gmv)} label="Gross order value" /></Grid>
        <Grid item xs={6} md={3}><StatCard value={fmtINR(data.platformFees)} label="Platform revenue" /></Grid>
        <Grid item xs={6} md={3}>
          <Link to="/approvals" style={{ textDecoration: 'none' }}>
            <StatCard value={`${data.pendingApprovals}`} label="Review approvals →" highlight={data.pendingApprovals > 0} />
          </Link>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 330 }}>
            <b>Orders & GMV — last 30 days</b>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Toggle series • drag below to zoom
            </Typography>
            <SeriesToggle
              options={[
                { key: 'orders', label: 'Orders', color: brand.primary },
                { key: 'gmv', label: 'GMV ₹', color: '#22c55e' },
              ]}
              active={flowSeries}
              onChange={setFlowSeries}
            />
            <ResponsiveContainer width="100%" height="68%">
              <AreaChart data={data.ordersByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                {flowSeries.includes('orders') && (
                  <Area yAxisId="l" type="monotone" dataKey="orders" stroke={brand.primary} fill="#FFE8DE" name="Orders" animationDuration={400} />
                )}
                {flowSeries.includes('gmv') && (
                  <Area yAxisId="r" type="monotone" dataKey="gmv" stroke="#22c55e" fill="#DCFCE7" name="GMV ₹" animationDuration={400} />
                )}
                <Brush dataKey="date" height={20} stroke="#D6D3D1" fill="transparent" travellerWidth={10} tickFormatter={(d) => String(d).slice(5)} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 330 }}>
            <b>Order status distribution</b>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Click a slice to open those orders
            </Typography>
            <ResponsiveContainer width="100%" height="78%">
              <PieChart>
                <Pie
                  data={data.statusDist}
                  dataKey="count"
                  nameKey="status"
                  outerRadius={90}
                  label
                  activeIndex={pieActive}
                  onMouseEnter={(_, i) => setPieActive(i)}
                  onMouseLeave={() => setPieActive(undefined)}
                  onClick={(d: any) => d?.status && nav(`/orders?status=${encodeURIComponent(d.status)}`)}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  animationDuration={400}
                >
                  {data.statusDist.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={pieActive === undefined || pieActive === i ? 1 : 0.4} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip moneyKeys={[]} />} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 300 }}>
            <b>Top restaurants by GMV</b>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={data.topRestaurants} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="gmv"
                  fill={brand.primary}
                  name="GMV ₹"
                  onClick={(d: any) => d?._id && nav(`/orders?restaurantId=${d._id}`)}
                  style={{ cursor: 'pointer' }}
                  animationDuration={400}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 300 }}>
            <b>Registrations — last 30 days</b>
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
            <ResponsiveContainer width="100%" height="66%">
              <BarChart data={mergeRegs(data.customerRegsByDay, data.restaurantRegsByDay)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
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

function mergeRegs(cust: any[], rest: any[]) {
  const map = new Map<string, any>();
  for (const d of cust) map.set(d.date, { date: d.date, customers: d.count, restaurants: 0 });
  for (const d of rest) {
    const cur = map.get(d.date) || { date: d.date, customers: 0, restaurants: 0 };
    cur.restaurants = d.count;
    map.set(d.date, cur);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
