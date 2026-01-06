import React, { useState, useEffect } from 'react';
import AdminPanel from './AdminPanel';
import PublicSearch from './PublicSearch';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

// Move Navbar OUTSIDE App component
const Navbar = ({ currentView, setCurrentView, isAuthenticated, currentUser, handleLogout }) => (
  <nav className="bg-blue-600 text-white shadow-lg">
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex justify-between items-center h-16">
        <div className="flex items-center">
          <h1 className="text-xl font-bold">SACCO Management System</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentView('search')}
            className={`px-4 py-2 rounded transition ${
              currentView === 'search'
                ? 'bg-blue-700'
                : 'hover:bg-blue-500'
            }`}
          >
            Member Search
          </button>
          {!isAuthenticated ? (
            <button
              onClick={() => setCurrentView('admin-login')}
              className={`px-4 py-2 rounded transition ${
                currentView === 'admin-login'
                  ? 'bg-blue-700'
                  : 'hover:bg-blue-500'
              }`}
            >
              Admin Login
            </button>
          ) : (
            <>
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-4 py-2 rounded transition ${
                  currentView === 'admin'
                    ? 'bg-blue-700'
                    : 'hover:bg-blue-500'
                }`}
              >
                Admin Panel
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-sm">
                  Welcome, <span className="font-semibold">{currentUser?.username}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </nav>
);

// Move AdminLogin OUTSIDE App component
const AdminLogin = ({ loginData, loginError, loading, handleLoginChange, handleKeyPress, handleLogin }) => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Admin Login
      </h2>
      
      {loginError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {loginError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            type="text"
            name="username"
            value={loginData.username}
            onChange={handleLoginChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter username"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={loginData.password}
            onChange={handleLoginChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter password"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-gray-600 text-center">
            <strong>Default credentials:</strong><br />
            Username: admin<br />
            Password: admin123
          </p>
        </div>
      </div>
    </div>
  </div>
);

function App() {
  const [currentView, setCurrentView] = useState('search');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

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
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    setLoading(true);

    if (!loginData.username || !loginData.password) {
      setLoginError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        setLoginData({ username: '', password: '' });
        
        // Wait a moment to ensure cookie is properly set before switching views
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setCurrentView('admin');
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentView('search');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="App">
      <Navbar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        handleLogout={handleLogout}
      />
      
      {currentView === 'search' && <PublicSearch />}
      
      {currentView === 'admin-login' && (
        <AdminLogin 
          loginData={loginData}
          loginError={loginError}
          loading={loading}
          handleLoginChange={handleLoginChange}
          handleKeyPress={handleKeyPress}
          handleLogin={handleLogin}
        />
      )}
      
      {currentView === 'admin' && isAuthenticated && <AdminPanel />}
      
      {currentView === 'admin' && !isAuthenticated && (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-4">Please log in to access the admin panel</p>
            <button
              onClick={() => setCurrentView('admin-login')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;