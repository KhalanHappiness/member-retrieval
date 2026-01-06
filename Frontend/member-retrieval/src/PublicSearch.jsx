import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function PublicSearch() {
  const [searchData, setSearchData] = useState({
    member_number: '',
    id_number: ''
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    setError('');
    setResult(null);
    setSearching(true);

    if (!searchData.member_number.trim() || !searchData.id_number.trim()) {
      setError('Please enter both Member Number and ID Number');
      setSearching(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchData),
      });

      const data = await response.json();
      
      if (data.found) {
        setResult(data.member);
      } else {
        setError(data.message || 'No member found with the provided details');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleChange = (e) => {
    setSearchData({
      ...searchData,
      [e.target.name]: e.target.value
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SACCO Member Lookup</h1>
          <p className="text-gray-600">Search for member information</p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="space-y-4">
            {/* Member Number Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Member Number
              </label>
              <input
                type="text"
                name="member_number"
                value={searchData.member_number}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter member number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* ID Number Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Number
              </label>
              <input
                type="text"
                name="id_number"
                value={searchData.id_number}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter ID number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-200 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="bg-green-500 rounded-full p-2 mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800">Member Found!</h3>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="text-gray-900">{result.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="font-medium text-gray-700">Member Number:</span>
                  <span className="text-gray-900">{result.member_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="text-gray-900">{result.id_number}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-700">Zone:</span>
                  <span className="text-gray-900">{result.zone}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">Enter your credentials to verify membership</p>
        </div>
      </div>
    </div>
  );
}