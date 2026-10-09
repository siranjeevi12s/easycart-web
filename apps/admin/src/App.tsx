import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Owners from './pages/Owners';
import Restaurants from './pages/Restaurants';
import MenuAdmin from './pages/MenuAdmin';
import Orders from './pages/Orders';
import Payments from './pages/Payments';
import Refunds from './pages/Refunds';
import Reviews from './pages/Reviews';
import Notifications from './pages/Notifications';
import Analytics from './pages/Analytics';
import Admins from './pages/Admins';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import AdminLayout from './components/AdminLayout';
import { getAccessToken } from './services/api';

function Protected({ children }: { children: React.ReactNode }) {
  const token = getAccessToken();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
}

export default function App() {
  return (
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
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/admins" element={<Protected><Admins /></Protected>} />
      <Route path="/audit" element={<Protected><Audit /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
