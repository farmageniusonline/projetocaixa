import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user } = useAuth();

  // Allow access in development mode for testing purposes
  const isDevelopment = import.meta.env.DEV;

  if (!user && !isDevelopment) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};