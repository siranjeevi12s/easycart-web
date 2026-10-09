import { Box, Grid } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { apiGet } from '../services/api';
import { PageHeader, StatCard, LoadingSkeleton, ErrorState } from '../components/ui';
import { fmtINR } from '../hooks';

const PIE_COLORS = ['#FF6B35', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#64748b'];

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['stats'], queryFn: apiGet.stats });

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (isError || !data) return <ErrorState message="Failed to load platform stats." onRetry={refetch} />;

  return (
    <Box>
      <PageHeader title="Dashboard" sub="Live platform overview — every figure from the backend." />
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
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 300 }}>
            <b>Orders & GMV — last 30 days</b>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={data.ordersByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area yAxisId="l" type="monotone" dataKey="orders" stroke="#FF6B35" fill="#FFE8DE" name="Orders" />
                <Area yAxisId="r" type="monotone" dataKey="gmv" stroke="#22c55e" fill="#DCFCE7" name="GMV ₹" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 300 }}>
            <b>Order status distribution</b>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie data={data.statusDist} dataKey="count" nameKey="status" outerRadius={90} label>
                  {data.statusDist.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 280 }}>
            <b>Top restaurants by GMV</b>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={data.topRestaurants} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="gmv" fill="#FF6B35" name="GMV ₹" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2, height: 280 }}>
            <b>Registrations — last 30 days</b>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={mergeRegs(data.customerRegsByDay, data.restaurantRegsByDay)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
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
