import React, { useState } from 'react';
import chunaLogo from './assets/chuna.png'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function PublicSearch() {
  const [searchData, setSearchData] = useState({
    member_number: '',
    id_number: ''
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    correct_name: '',
    correct_zone: '',
    email: '',
    phone: '',
    additional_notes: ''
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSearch = async () => {
    setError('');
    setResult(null);
    setSearching(true);
    setSuccessMessage('');

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

  const handleVerifyCorrect = async () => {
    setVerifying(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/verify-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: result.id,
          member_number: result.member_number,
          id_number: searchData.id_number,
          verified: true
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage('Thank you! Your details have been verified successfully.');
      } else {
        setError(data.error || 'Failed to verify details');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenCorrectionModal = () => {
    setCorrectionData({
      correct_name: result.name,
      correct_zone: '',
      email: '',
      phone: '',
      additional_notes: ''
    });
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = async () => {
    setSubmittingCorrection(true);
    setError('');
    
    if (!correctionData.email.trim() && !correctionData.phone.trim()) {
      setError('Please provide either an email or phone number for contact');
      setSubmittingCorrection(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/submit-correction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: result.id,
          member_number: result.member_number,
          id_number: searchData.id_number,
          current_name: result.name,
          current_zone: result.zone,
          current_status: result.status,
          ...correctionData
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage('Your correction request has been sent to the admin. You will be contacted soon.');
        setShowCorrectionModal(false);
        setCorrectionData({
          correct_name: '',
          correct_zone: '',
          email: '',
          phone: '',
          additional_notes: ''
        });
      } else {
        setError(data.error || 'Failed to submit correction');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const handleChange = (e) => {
    setSearchData({
      ...searchData,
      [e.target.name]: e.target.value
    });
  };

  const handleCorrectionChange = (e) => {
    setCorrectionData({
      ...correctionData,
      [e.target.name]: e.target.value
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
           <img 
              src={chunaLogo} 
              alt="Chuna DT Sacco Logo" 
              className="h-10 sm:h-10 lg:h-14 w-auto hover:opacity-90 transition-opacity"
            />
        </div>
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">Chuna Sacco Member details Verification Portal</p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition duration-200 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
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

          {/* Success Message */}
          {successMessage && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <p className="text-sm">{successMessage}</p>
            </div>
          )}

          {/* Result Display */}
          {result && !successMessage && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="bg-green-500 rounded-full p-2 mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800">Member Found!</h3>
              </div>
              
              <div className="space-y-2 mb-6">
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
                  <span className="text-gray-900 capitalize">{result.status}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-700">Working Station:</span>
                  <span className="text-gray-900">{result.zone}</span>
                </div>
              </div>

              {/* Verification Buttons */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Are these details correct?</p>
                <button
                  onClick={handleVerifyCorrect}
                  disabled={verifying}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition duration-200 font-medium disabled:bg-gray-400"
                >
                  {verifying ? 'Verifying...' : '✓ Yes, Details are Correct'}
                </button>
                <button
                  onClick={handleOpenCorrectionModal}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200 font-medium"
                >
                  ✗ No, Submit Correction
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Submit Correction</h2>
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Please provide the correct information and your contact details. Our admin will review and contact you.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correct Name
                  </label>
                  <input
                    type="text"
                    name="correct_name"
                    value={correctionData.correct_name}
                    onChange={handleCorrectionChange}
                    placeholder="Enter correct name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correct Working Station
                  </label>
                  <input
                    type="text"
                    name="correct_zone"
                    value={correctionData.correct_zone}
                    onChange={handleCorrectionChange}
                    placeholder="Enter correct Working Station"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={correctionData.email}
                    onChange={handleCorrectionChange}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={correctionData.phone}
                    onChange={handleCorrectionChange}
                    placeholder="+254..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    name="additional_notes"
                    value={correctionData.additional_notes}
                    onChange={handleCorrectionChange}
                    placeholder="Any additional information..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <p className="text-xs text-gray-500">* At least one contact method is required</p>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCorrectionModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitCorrection}
                    disabled={submittingCorrection}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition duration-200 disabled:bg-gray-400"
                  >
                    {submittingCorrection ? 'Sending...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}