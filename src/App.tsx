import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginForm } from './components/LoginForm'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Dashboard } from './pages/Dashboard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useStorageInitializer } from './hooks/useStorageInitializer'

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const storageStatus = useStorageInitializer();

  console.log('AppRoutes Debug:', {
    user,
    isLoading,
    storageStatus
  });

  if (isLoading || storageStatus.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isLoading ? 'Carregando...' : 'Inicializando storage...'}
          </p>
          {storageStatus.usingIndexedDB && (
            <p className="text-green-400 text-sm mt-2">IndexedDB disponível</p>
          )}
        </div>
      </div>
    );
  }

  try {
    return (
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginForm />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  } catch (error) {
    console.error('AppRoutes render error:', error);
    return (
      <div className="min-h-screen bg-red-900 text-white p-8">
        <h1>Application Error</h1>
        <p>Error in routing: {String(error)}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-700 rounded"
        >
          Reload
        </button>
      </div>
    );
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#f3f4f6',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#f3f4f6',
              },
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
