import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import Home from './pages/guest/Home';
import ChannelPage from './pages/guest/ChannelPage';
import Radio from './pages/guest/Radio';
import EPG from './pages/guest/EPG';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Studio from './pages/admin/Studio';

export default function App() {
  const { loadMe, accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken) loadMe();
  }, [accessToken]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/channel/:slug" element={<ChannelPage />} />
      <Route path="/radio" element={<Radio />} />
      <Route path="/epg" element={<EPG />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="studio/:slug" element={<Studio />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}