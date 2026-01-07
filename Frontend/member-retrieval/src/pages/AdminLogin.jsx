import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function AdminLogin({ onLoginSuccess }) {
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        console.log('✅ Login successful, user:', data.user);
        
        // Call the callback to update parent state
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
        
        setLoginData({ username: '', password: '' });
        
        // Small delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navigate to admin panel
        console.log('🔄 Redirecting to /admin');
        navigate('/admin');
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setLoginError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
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
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter username"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

      
        </div>
      </div>
    </div>
  );
}