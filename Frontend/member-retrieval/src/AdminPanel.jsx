import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function AdminPanel() {
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ total_members: 0, total_zones: 0 });
  const [formData, setFormData] = useState({
    name: '',
    member_number: '',
    id_number: '',
    zone: '',
    status: 'active'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('add');
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(50);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Bulk delete state
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const authCheck = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        });
        
        if (authCheck.ok) {
          await Promise.all([fetchMembers(), fetchStats()]);
        } else {
          setError('Session expired. Please login again.');
          setLoading(false);
        }
      } catch (err) {
        setError('Authentication error. Please login again.');
        setLoading(false);
      }
    };
    
    initializeData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchMembers();
      setSelectedMembers([]); // Clear selection when page changes
      setSelectAll(false);
    }
  }, [currentPage, searchFilter]);

  const fetchMembers = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        per_page: itemsPerPage,
        search: searchFilter
      });
      
      const response = await fetch(`${API_URL}/admin/members?${params}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || data);
        if (data.total) {
          setTotalPages(Math.ceil(data.total / itemsPerPage));
        }
        setLoading(false);
      } else if (response.status === 401) {
        setError('Session expired. Please login again.');
        setLoading(false);
      } else {
        setError('Failed to fetch members');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error. Failed to fetch members');
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
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
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (response.ok) {
        setSuccess('Member added successfully!');
        setFormData({ name: '', member_number: '', id_number: '', zone: '', status: 'active' });
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
        credentials: 'include'
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
      const response = await fetch(`${API_URL}/admin/members/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        fetchMembers();
        fetchStats();
        setSuccess('Member deleted successfully!');
      } else {
        setError('Failed to delete member');
      }
    } catch (err) {
      setError('Failed to delete member');
    }
  };

  // NEW: Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedMembers.length === 0) {
      setError('Please select members to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedMembers.length} member(s)?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/members/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: selectedMembers }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully deleted ${data.deleted} member(s)`);
        setSelectedMembers([]);
        setSelectAll(false);
        fetchMembers();
        fetchStats();
      } else {
        setError(data.error || 'Failed to delete members');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // NEW: Toggle individual member selection
  const toggleMemberSelection = (memberId) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  // NEW: Toggle select all members on current page
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map(m => m.id));
    }
    setSelectAll(!selectAll);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSearchChange = (e) => {
    setSearchFilter(e.target.value);
    setCurrentPage(1);
  };

  const downloadTemplate = () => {
    const csvContent = "name,member_number,id_number,zone,status\nJohn Doe,M001,12345678,Zone A,active\nJane Smith,M002,87654321,Zone B,active";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'member_template.csv';
    a.click();
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // NEW: Status badge component
  const StatusBadge = ({ status }) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      dormant: 'bg-gray-100 text-gray-800',
      closed: 'bg-yellow-100 text-yellow-800',
      deceased: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.active}`}>
        {status}
      </span>
    );
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

          {activeTab === 'add' && (
            <div>
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
                    required
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
                    required
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
                    required
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
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* NEW: Status dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="dormanr">Dormant</option>
                    <option value="closed">Closed</option>
                    <option value="deceased">Deceased</option>
                  </select>
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
            </div>
          )}

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
                  Your Excel file should have these columns: <strong>name</strong>, <strong>member_number</strong>, <strong>id_number</strong>, <strong>zone</strong>, <strong>status</strong> (optional, defaults to 'active')
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

        {/* Members List with Search, Bulk Actions, and Pagination */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">All Members ({stats.total_members})</h2>
            
            {/* Search Filter */}
            <div className="w-64">
              <input
                type="text"
                placeholder="Search by name or number..."
                value={searchFilter}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* NEW: Bulk Actions Bar */}
          {selectedMembers.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex justify-between items-center">
              <span className="text-sm font-medium text-blue-800">
                {selectedMembers.length} member(s) selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition"
              >
                Delete Selected
              </button>
            </div>
          )}
          
          {members.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No members found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      {/* NEW: Select All checkbox */}
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Member #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ID Number</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Zone</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-t border-gray-200 hover:bg-gray-50">
                        {/* NEW: Individual checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => toggleMemberSelection(member.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">{member.name}</td>
                        <td className="px-4 py-3 text-sm">{member.member_number}</td>
                        <td className="px-4 py-3 text-sm">{member.id_number}</td>
                        <td className="px-4 py-3 text-sm">{member.zone}</td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={member.status} />
                        </td>
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

              {/* Pagination Controls */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>

               </>
      )}
    </div>
  </div>
</div>
);
}