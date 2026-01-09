
import React from 'react';
import { useNavigate } from 'react-router-dom';
import chunaLogo from '../assets/chuna.png';
import hero from '../assets/herosection.png'


export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-green-50 via-white to-indigo-50 overflow-hidden">
        {/* Logo Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <img 
            src={chunaLogo} 
            alt="Chuna DT Sacco Logo" 
            className="h-12 sm:h-14 lg:h-16 w-auto"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Verify Your
                <span className="block text-green-600">SACCO Membership</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600">
                Easily Check Your Membership Status Online
              </p>
              
              <button
                onClick={() => navigate('/verify')}
                className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Verify Now
              </button>
            </div>

            {/* Right Image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={hero}
                  alt="Students celebrating"
                  className="w-full h-auto"
                />
                {/* Overlay with phone mockup */}
                <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-xl p-2 transform rotate-3">
                  <div className="bg-green-50 rounded p-3 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="font-semibold text-gray-700">Verification Active</span>
                    </div>
                    <div className="text-gray-600">
                      <div className="mb-1">Member: 15709</div>
                      <div className="text-green-600 font-semibold">✓ Verified</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {/* Feature 1 */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Secure Verification</h3>
              <p className="text-gray-600">
                Your data is protected with bank-level security ensuring complete privacy and safety.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Instant Results</h3>
              <p className="text-gray-600">
                Get your membership verification status instantly with real-time database checking.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full">
                <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">24/7 Support</h3>
              <p className="text-gray-600">
                Our support team is available around the clock to assist you with any queries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20 bg-gradient-to-br from-green-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">Simple verification in three easy steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  1
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Enter Details</h3>
                <p className="text-gray-600">
                  Input your Member Number and ID Number in the verification form.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  2
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Verification</h3>
                <p className="text-gray-600">
                  Our system instantly checks your membership status in our database.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  3
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Get Results</h3>
                <p className="text-gray-600">
                  View your membership details and verify or request corrections if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-green-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Verify Your Membership?
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Join thousands of members who have already verified their details online.
          </p>
          <button
            onClick={() => navigate('/verify')}
            className="bg-white text-green-600 px-10 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Start Verification
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white-900 text-black py-8">
         
          <div className=" text-center text-gray-400">
            <p>&copy; 2026      ALL RIGHTS RESERVED           ICT DEPARTMENT. FOR DETAILS PLEASE CONTACT US VIA ICT.CHUNA@UONBI.AC.KE or  ebundi@uonbi.ac.ke </p>
          </div>
      </footer>
    </div>
  );
}