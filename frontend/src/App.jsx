import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Leave from './pages/Leave.jsx';
import Holidays from './pages/Holidays.jsx';
import Team from './pages/Team.jsx';
import Users from './pages/Users.jsx';
import Templates from './pages/Templates.jsx';
import MyTasks from './pages/MyTasks.jsx';
import Reviews from './pages/Reviews.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="my-tasks" element={<MyTasks />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="leave" element={<Leave />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="team" element={<Team />} />
        <Route path="users" element={<Users />} />
        <Route path="templates" element={<Templates />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
