import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import { LoadingSkeleton } from './components/ui';
import { isAuthenticated } from './services/api';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Owners = lazy(() => import('./pages/Owners'));
const Restaurants = lazy(() => import('./pages/Restaurants'));
const MenuAdmin = lazy(() => import('./pages/MenuAdmin'));
const Orders = lazy(() => import('./pages/Orders'));
const Payments = lazy(() => import('./pages/Payments'));
const Refunds = lazy(() => import('./pages/Refunds'));
const Reviews = lazy(() => import('./pages/Reviews'));
const Promotions = lazy(() => import('./pages/Promotions'));
const PromoCampaigns = lazy(() => import('./pages/PromoCampaigns'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Admins = lazy(() => import('./pages/Admins'));
const Audit = lazy(() => import('./pages/Audit'));
const Settings = lazy(() => import('./pages/Settings'));

function Protected({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  // Token presence only — the server is the source of truth for validity/role.
  if (!isAuthenticated()) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <AdminLayout>{children}</AdminLayout>;
}

function NotFound() {
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/customers" element={<Protected><Customers /></Protected>} />
        <Route path="/owners" element={<Protected><Owners /></Protected>} />
        <Route path="/restaurants" element={<Protected><Restaurants /></Protected>} />
        <Route path="/approvals" element={<Protected><Restaurants pendingOnly /></Protected>} />
        <Route path="/menu" element={<Protected><MenuAdmin /></Protected>} />
        <Route path="/orders" element={<Protected><Orders /></Protected>} />
        <Route path="/payments" element={<Protected><Payments /></Protected>} />
        <Route path="/refunds" element={<Protected><Refunds /></Protected>} />
        <Route path="/reviews" element={<Protected><Reviews /></Protected>} />
        <Route path="/promotions" element={<Protected><Promotions /></Protected>} />
        <Route path="/promo-campaigns" element={<Protected><PromoCampaigns /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
        <Route path="/admins" element={<Protected><Admins /></Protected>} />
        <Route path="/audit" element={<Protected><Audit /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
