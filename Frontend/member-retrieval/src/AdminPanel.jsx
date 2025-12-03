import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5000';

export default function AdminPanel() {
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ total_members: 0, total_zones: 0 });
  const [formData, setFormData] = useState({
    name: '',
    member_number: '',
    id_number: '',
    zone: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'bulk'

  useEffect(() => {
    fetchMembers();
    fetchStats();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/members`);
      const data = await response.json();
      setMembers(data);
    } catch (err) {
      setError('Failed to fetch members');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess('Member added successfully!');
        setFormData({ name: '', member_number: '', id_number: '', zone: '' });
        fetchMembers();
        fetchStats();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add member');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/admin/members/bulk-upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        let message = `Successfully added ${data.added} members`;
        if (data.skipped > 0) {
          message += `, skipped ${data.skipped} records`;
        }
        setSuccess(message);
        
        if (data.errors && data.errors.length > 0) {
          setError(`Some errors occurred:\n${data.errors.slice(0, 5).join('\n')}`);
        }
        
        fetchMembers();
        fetchStats();
      } else {
        setError(data.error || 'Failed to upload file');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;

    try {
      await fetch(`${API_URL}/admin/members/${id}`, {
        method: 'DELETE',
      });
      fetchMembers();
      fetchStats();
      setSuccess('Member deleted successfully!');
    } catch (err) {
      setError('Failed to delete member');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const downloadTemplate = () => {
    const csvContent = "name,member_number,id_number,zone\nJohn Doe,M001,12345678,Zone A\nJane Smith,M002,87654321,Zone B";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'member_template.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">SACCO Admin Panel</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium">Total Members</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.total_members}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium">Total Zones</h3>
            <p className="text-3xl font-bold text-green-600">{stats.total_zones}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium">Database</h3>
            <p className="text-xl font-bold text-purple-600">SQLite</p>
          </div>
        </div>

        {/* Add Member Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {/* Tabs */}
          <div className="flex border-b mb-6">
            <button
              onClick={() => setActiveTab('add')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'add'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Add Single Member
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'bulk'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bulk Upload (Excel)
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <pre className="whitespace-pre-wrap text-sm">{error}</pre>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {/* Add Single Member Tab */}
          {activeTab === 'add' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Number
                </label>
                <input
                  type="text"
                  name="member_number"
                  value={formData.member_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Number
                </label>
                <input
                  type="text"
                  name="id_number"
                  value={formData.id_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zone
                </label>
                <input
                  type="text"
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={handleSubmit}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200"
                >
                  Add Member
                </button>
              </div>
            </div>
          )}

          {/* Bulk Upload Tab */}
          {activeTab === 'bulk' && (
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      {uploading ? 'Uploading...' : 'Click to upload Excel file'}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Excel files (.xlsx, .xls) only
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-medium text-gray-700 mb-2">Excel File Format:</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Your Excel file should have these columns: <strong>name</strong>, <strong>member_number</strong>, <strong>id_number</strong>, <strong>zone</strong>
                </p>
                <button
                  onClick={downloadTemplate}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Download Template (CSV)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Members List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">All Members ({members.length})</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Member #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ID Number</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Zone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{member.name}</td>
                    <td className="px-4 py-3 text-sm">{member.member_number}</td>
                    <td className="px-4 py-3 text-sm">{member.id_number}</td>
                    <td className="px-4 py-3 text-sm">{member.zone}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}