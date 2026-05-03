import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CandidateDashboard from './pages/CandidateDashboard';
import InterviewScreen from './pages/InterviewScreen';
import InterviewDetail from './pages/InterviewDetail';
import AdminDashboard from './pages/AdminDashboard';
import CampaignCreate from './pages/CampaignCreate';
import CandidateReview from './pages/CandidateReview';

function getAuth() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  return { token, role };
}

function PrivateRoute({ children, requiredRole }) {
  const { token, role } = getAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={
          <PrivateRoute requiredRole="candidate"><CandidateDashboard /></PrivateRoute>
        } />
        <Route path="/interview/:invitationId" element={
          <PrivateRoute requiredRole="candidate"><InterviewScreen /></PrivateRoute>
        } />
        <Route path="/application/:invitationId" element={
          <PrivateRoute requiredRole="candidate"><InterviewDetail /></PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute requiredRole="admin"><AdminDashboard /></PrivateRoute>
        } />
        <Route path="/admin/campaigns/new" element={
          <PrivateRoute requiredRole="admin"><CampaignCreate /></PrivateRoute>
        } />
        <Route path="/admin/review/:invitationId" element={
          <PrivateRoute requiredRole="admin"><CandidateReview /></PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
