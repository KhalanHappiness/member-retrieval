import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}