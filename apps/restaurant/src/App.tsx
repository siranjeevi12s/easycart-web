import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function Protected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}
