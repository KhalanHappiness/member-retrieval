import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import chunaLogo from '../assets/chuna.png'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function Navbar({ isAuthenticated, currentUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <nav className="bg-white text-green-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold hover:text-green-100">
              <img 
              src={chunaLogo} 
              alt="Chuna DT Sacco Logo" 
              className="h-10 sm:h-10 lg:h-14 w-auto hover:opacity-90 transition-opacity"
            />
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="px-4 py-2 rounded transition hover:bg-green-500"
            >
              Member Search
            </Link>
            {!isAuthenticated ? (
              <Link
                to="/admin/login"
                className="px-4 py-2 rounded transition hover:bg-green-500"
              >
                Admin Login
              </Link>
            ) : (
              <>
                <Link
                  to="/admin"
                  className="px-4 py-2 rounded transition hover:bg-green-500"
                >
                  Admin Panel
                </Link>
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
}