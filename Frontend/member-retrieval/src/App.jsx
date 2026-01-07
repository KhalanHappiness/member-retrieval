import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

// Wrapper component to handle conditional navbar rendering
function AppContent({ isAuthenticated, currentUser, handleLoginSuccess }) {
  const location = useLocation();
  
  // Hide navbar on home page (public search)
  const showNavbar = location.pathname !== '/' && location.pathname !== '/admin/login';

  return (
    <div className="App">
      {showNavbar && <Navbar isAuthenticated={isAuthenticated} currentUser={currentUser} />}
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route 
          path="/admin/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/admin" replace />
            ) : (
              <AdminLogin onLoginSuccess={handleLoginSuccess} />
            )
          } 
        />
        
        {/* Protected Admin Route */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user) => {
    console.log('📝 Setting user in App.jsx:', user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent 
        isAuthenticated={isAuthenticated} 
        currentUser={currentUser} 
        handleLoginSuccess={handleLoginSuccess}
      />
    </BrowserRouter>
  );
}

export default App;