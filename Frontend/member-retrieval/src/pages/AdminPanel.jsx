import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default function AdminPanel() {
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [searchLogs, setSearchLogs] = useState([]);
  const [stats, setStats] = useState({ total_members: 0, total_zones: 0, total_verifications: 0, pending_corrections: 0, total_searches: 0, successful_searches: 0 });
  const [formData, setFormData] = useState({ name: '', member_number: '', id_number: '', zone: '', status: 'active' });
  const [userFormData, setUserFormData] = useState({ username: '', email: '', password: '', role: 'member_manager' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('add');
  const [mainSection, setMainSection] = useState('members');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(50);
  const [searchFilter, setSearchFilter] = useState('');
  const [verificationPage, setVerificationPage] = useState(1);
  const [verificationPages, setVerificationPages] = useState(1);
  const [correctionPage, setCorrectionPage] = useState(1);
  const [correctionPages, setCorrectionPages] = useState(1);
  const [correctionFilter, setCorrectionFilter] = useState('all');
  const [searchLogPage, setSearchLogPage] = useState(1);
  const [searchLogPages, setSearchLogPages] = useState(1);
  const [searchLogFilter, setSearchLogFilter] = useState('all');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [correctionSearchFilter, setCorrectionSearchFilter] = useState('');



  const roles = [
    { value: 'super_admin', label: 'Super Admin', description: 'Full access to all features' },
    { value: 'member_manager', label: 'Member Manager', description: 'Manage members, view verifications and corrections' },
    { value: 'verification_viewer', label: 'Verification Viewer', description: 'View verification records only' },
    { value: 'correction_viewer', label: 'Correction Viewer', description: 'View and manage correction requests' }
  ];

useEffect(() => {
  const initializeData = async () => {
    try {
      const authCheck = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      if (authCheck.ok) {
        const userData = await authCheck.json();
        setCurrentUser(userData);
        
        // Set the initial section based on user permissions
        const permissions = {
          'super_admin': 'members',
          'member_manager': 'members',
          'verification_viewer': 'verifications',
          'correction_viewer': 'corrections'
        };
        setMainSection(permissions[userData.role] || 'search-logs');
        
        setLoading(false);
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
  if (!currentUser || loading) return;
  
  // Fetch stats on initial load and when section changes
  fetchStats();
  
  // Fetch data based on current section and permissions
  if (mainSection === 'members' && hasPermission('manage_members')) {
    fetchMembers();
  } else if (mainSection === 'users' && hasPermission('manage_users')) {
    fetchUsers();
  } else if (mainSection === 'verifications' && hasPermission('view_verifications')) {
    fetchVerifications();
  } else if (mainSection === 'corrections' && hasPermission('view_corrections')) {
    fetchCorrections();
  } else if (mainSection === 'search-logs') {
    fetchSearchLogs();
  }
  
  setSelectedMembers([]);
  setSelectAll(false);
}, [currentUser, currentPage, searchFilter, mainSection, verificationPage, correctionPage, correctionFilter, correctionSearchFilter, searchLogPage, searchLogFilter]);  const hasPermission = (permission) => {
    if (!currentUser) return false;
    const permissions = {
      'super_admin': ['manage_users', 'manage_members', 'view_verifications', 'view_corrections', 'manage_corrections'],
      'member_manager': ['manage_members', 'view_verifications', 'view_corrections'],
      'verification_viewer': ['view_verifications'],
      'correction_viewer': ['view_corrections', 'manage_corrections']
    };
    return permissions[currentUser.role]?.includes(permission) || false;
  };

  const fetchMembers = async () => {
    if (!hasPermission('manage_members')) return;
    try {
      const params = new URLSearchParams({ page: currentPage, per_page: itemsPerPage, search: searchFilter });
      const response = await fetch(`${API_URL}/admin/members?${params}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || data);
        if (data.total) setTotalPages(Math.ceil(data.total / itemsPerPage));
      } else if (response.status === 401) {
        setError('Session expired. Please login again.');
      } else if (response.status === 403) {
        setError('You do not have permission to view members');
      } else {
        setError('Failed to fetch members');
      }
    } catch (err) {
      setError('Network error. Failed to fetch members');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!hasPermission('manage_users')) return;
    try {
      const response = await fetch(`${API_URL}/admin/users`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  const fetchVerifications = async () => {
    if (!hasPermission('view_verifications')) return;
    try {
      const params = new URLSearchParams({ page: verificationPage, per_page: 20 });
      const response = await fetch(`${API_URL}/admin/verifications?${params}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications || []);
        setVerificationPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch verifications');
    }
  };

  const fetchCorrections = async () => {
      if (!hasPermission('view_corrections')) return;
      try {
        const params = new URLSearchParams({ 
          page: correctionPage, 
          per_page: 20, 
          status: correctionFilter,
          search: correctionSearchFilter  
        });
        const response = await fetch(`${API_URL}/admin/corrections?${params}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setCorrections(data.corrections || []);
          setCorrectionPages(data.pages || 1);
        }
      } catch (err) {
        console.error('Failed to fetch corrections');
      }
    };

  const fetchSearchLogs = async () => {
    try {
      const params = new URLSearchParams({ page: searchLogPage, per_page: 50, success: searchLogFilter });
      const response = await fetch(`${API_URL}/admin/search-logs?${params}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSearchLogs(data.logs || []);
        setSearchLogPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch search logs');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData),
        credentials: 'include',
      });
      if (response.ok) {
        setSuccess('User created successfully!');
        setUserFormData({ username: '', email: '', password: '', role: 'member_manager' });
        setShowUserModal(false);
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      if (response.ok) {
        setSuccess('User deleted successfully!');
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const handleResolveCorrection = async (correctionId) => {
    if (!window.confirm('Mark this correction request as resolved?')) return;
    try {
      const response = await fetch(`${API_URL}/admin/corrections/${correctionId}/resolve`, { method: 'POST', credentials: 'include' });
      if (response.ok) {
        setSuccess('Correction marked as resolved!');
        fetchCorrections();
        fetchStats();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to resolve correction');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_URL}/admin/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${API_URL}/admin/members/bulk-upload`, { method: 'POST', body: formData, credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        let message = `Successfully added ${data.added} members`;
        if (data.skipped > 0) message += `, skipped ${data.skipped} records`;
        setSuccess(message);
        if (data.errors && data.errors.length > 0) setError(`Some errors occurred:\n${data.errors.slice(0, 5).join('\n')}`);
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
      const response = await fetch(`${API_URL}/admin/members/${id}`, { method: 'DELETE', credentials: 'include' });
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

  const handleBulkDelete = async () => {
    if (selectedMembers.length === 0) {
      setError('Please select members to delete');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedMembers.length} member(s)?`)) return;
    try {
      const response = await fetch(`${API_URL}/admin/members/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleDownloadCorrectionPDF = async (correctionId) => {
  try {
    const response = await fetch(`${API_URL}/admin/corrections/${correctionId}/download-pdf`, {
      credentials: 'include',
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `correction_${correctionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      setError('Failed to download PDF');
    }
  } catch (err) {
    setError('Error downloading PDF');
  }
  };

  const handleDownloadAllCorrectionsPDF = async () => {
  try {
    const params = new URLSearchParams({ status: correctionFilter });
    const response = await fetch(`${API_URL}/admin/corrections/download-all-pdf?${params}`, {
      credentials: 'include',
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_corrections_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      setError('Failed to download PDF');
    }
  } catch (err) {
    setError('Error downloading PDF');
  }
  };

  const toggleMemberSelection = (memberId) => {
    setSelectedMembers(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map(m => m.id));
    }
    setSelectAll(!selectAll);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUserFormChange = (e) => {
    setUserFormData({ ...userFormData, [e.target.name]: e.target.value });
  };

  const handleSearchChange = (e) => {
    setSearchFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleBulkUpdateFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  setError('');
  setSuccess('');
  setUploading(true);
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_URL}/admin/members/bulk-update`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      let message = `Successfully updated ${data.updated} member(s)`;
      if (data.not_found > 0) {
        message += `, ${data.not_found} member(s) not found`;
      }
      if (data.errors > 0) {
        message += `, ${data.errors} error(s)`;
      }
      
      setSuccess(message);
      
      if (data.error_details && data.error_details.length > 0) {
        setError(`Some errors occurred:\n${data.error_details.slice(0, 10).join('\n')}`);
      }
      
      fetchMembers();
      fetchStats();
    } else {
      setError(data.error || 'Failed to update members');
    }
  } catch (err) {
    setError('Network error. Please try again.');
  } finally {
    setUploading(false);
    e.target.value = '';
  }
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

  const downloadBulkUpdateTemplate = () => {
    const csvContent = "member_number,name,id_number,zone,status\nM001,John Doe Updated,,Zone C,\nM002,,,Zone D,active\nM003,Jane Smith,98765432,,dormant";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_update_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
};

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      dormant: 'bg-gray-100 text-gray-800',
      closed: 'bg-yellow-100 text-yellow-800',
      deceased: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.active}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Admin Panel</h1>
          {currentUser && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">{currentUser.username}</span>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{currentUser.role.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          {hasPermission('manage_members') && (
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <h3 className="text-gray-500 text-xs md:text-sm font-medium">Total Members</h3>
              <p className="text-2xl md:text-3xl font-bold text-green-600">{stats.total_members}</p>
            </div>
          )}
          {hasPermission('view_verifications') && (
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6 cursor-pointer hover:bg-gray-50" onClick={() => setMainSection('verifications')}>
              <h3 className="text-gray-500 text-xs md:text-sm font-medium">Verifications</h3>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">{stats.total_verifications}</p>
            </div>
          )}
          {hasPermission('view_corrections') && (
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6 cursor-pointer hover:bg-gray-50" onClick={() => setMainSection('corrections')}>
              <h3 className="text-gray-500 text-xs md:text-sm font-medium">Pending Corrections</h3>
              <p className="text-2xl md:text-3xl font-bold text-orange-600">{stats.pending_corrections}</p>
            </div>
          )}
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 cursor-pointer hover:bg-gray-50" onClick={() => setMainSection('search-logs')}>
            <h3 className="text-gray-500 text-xs md:text-sm font-medium">Total Searches</h3>
            <p className="text-2xl md:text-3xl font-bold text-purple-600">{stats.total_searches}</p>
          </div>
        </div>

        <div className="flex flex-wrap border-b mb-6 bg-white rounded-t-lg overflow-x-auto">
          {hasPermission('manage_members') && (
            <button onClick={() => setMainSection('members')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${mainSection === 'members' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Members
            </button>
          )}
          {hasPermission('manage_users') && (
            <button onClick={() => setMainSection('users')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${mainSection === 'users' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Users
            </button>
          )}
          {hasPermission('view_verifications') && (
            <button onClick={() => setMainSection('verifications')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${mainSection === 'verifications' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Verifications
              {stats.total_verifications > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">{stats.total_verifications}</span>
              )}
            </button>
          )}
          {hasPermission('view_corrections') && (
            <button onClick={() => setMainSection('corrections')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${mainSection === 'corrections' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Corrections
              {stats.pending_corrections > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">{stats.pending_corrections}</span>
              )}
            </button>
          )}
          <button onClick={() => setMainSection('search-logs')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${mainSection === 'search-logs' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
            Search Logs
          </button>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"><pre className="whitespace-pre-wrap text-sm">{error}</pre></div>}
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

        {/* User Creation Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Create New User</h3>
              <form onSubmit={handleCreateUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input type="text" name="username" value={userFormData.username} onChange={handleUserFormChange} required className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" name="email" value={userFormData.email} onChange={handleUserFormChange} required className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input type="password" name="password" value={userFormData.password} onChange={handleUserFormChange} required className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select name="role" value={userFormData.role} onChange={handleUserFormChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{roles.find(r => r.value === userFormData.role)?.description}</p>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700">Create</button>
                  <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Section */}
        {mainSection === 'users' && hasPermission('manage_users') && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg md:text-xl font-semibold">User Management</h2>
              <button onClick={() => setShowUserModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                Create User
              </button>
            </div>

            {users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Username</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Last Login</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{user.username}</td>
                        <td className="px-4 py-3 text-sm">{user.email}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{user.role.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
                        </td>
                        <td className="px-4 py-3 text-sm">{user.last_login ? formatDate(user.last_login) : 'Never'}</td>
                        <td className="px-4 py-3 text-sm">
                          {user.id !== currentUser.id && (
                            <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-800">
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Search Logs Section */}
        {mainSection === 'search-logs' && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-lg md:text-xl font-semibold">Search Activity Logs</h2>
              <select value={searchLogFilter} onChange={(e) => setSearchLogFilter(e.target.value)} className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
                <option value="all">All Searches</option>
                <option value="successful">Successful Only</option>
                <option value="failed">Failed Only</option>
              </select>
            </div>

            {searchLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No search logs found.</p>
            ) : (
              <>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Member #</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">ID Number</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Result</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">IP Address</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Searched At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchLogs.map((log) => (
                        <tr key={log.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{log.member_number}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{log.id_number}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">
                            {log.search_successful ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Success</span>
                            ) : (
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Failed</span>
                            )}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{log.ip_address}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{formatDate(log.searched_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">Page {searchLogPage} of {searchLogPages}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setSearchLogPage(p => Math.max(1, p - 1))} disabled={searchLogPage === 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                    <button onClick={() => setSearchLogPage(p => Math.min(searchLogPages, p + 1))} disabled={searchLogPage === searchLogPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Members Section */}
        {mainSection === 'members' && hasPermission('manage_members') && (
          <>
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8">
              
              <div className="flex border-b mb-6 overflow-x-auto">
                <button onClick={() => setActiveTab('add')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${activeTab === 'add' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Add Single Member</button>
                <button onClick={() => setActiveTab('bulk')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${activeTab === 'bulk' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Bulk Upload</button>
                <button onClick={() => setActiveTab('bulk-update')} className={`px-4 md:px-6 py-3 font-medium text-sm md:text-base whitespace-nowrap ${activeTab === 'bulk-update' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Bulk Update</button>
              </div>

              {activeTab === 'add' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Member Number</label>
                    <input type="text" name="member_number" value={formData.member_number} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
                    <input type="text" name="id_number" value={formData.id_number} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Working Station</label>
                    <input type="text" name="zone" value={formData.zone} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="active">Active</option>
                      <option value="dormant">Dormant</option>
                      <option value="closed">Closed</option>
                      <option value="deceased">Deceased</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button onClick={handleSubmit} className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition duration-200">Add Member</button>
                  </div>
                </div>
              )}

              {activeTab === 'bulk' && (
                <div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 text-center">
                    <svg className="mx-auto h-10 md:h-12 w-10 md:w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="mt-4">
                      <label className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">{uploading ? 'Uploading...' : 'Click to upload Excel file'}</span>
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                      </label>
                      <p className="mt-1 text-xs text-gray-500">Excel files (.xlsx, .xls) only</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <h3 className="font-medium text-gray-700 mb-2">Excel File Format:</h3>
                    <p className="text-sm text-gray-600 mb-3">Your Excel file should have these columns: <strong>name</strong>, <strong>member_number</strong>, <strong>id_number</strong>, <strong>zone</strong>, <strong>status</strong></p>
                    <button onClick={downloadTemplate} className="text-green-600 hover:text-green-800 text-sm font-medium">Download Template (CSV)</button>
                  </div>
                </div>
              )}

              {/* NEW BULK UPDATE TAB */}
              {activeTab === 'bulk-update' && (
                <div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 text-center">
                    <svg className="mx-auto h-10 md:h-12 w-10 md:w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="mt-4">
                      <label className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          {uploading ? 'Updating...' : 'Click to upload Excel file for bulk update'}
                        </span>
                        <input 
                          type="file" 
                          accept=".xlsx,.xls" 
                          onChange={handleBulkUpdateFileUpload} 
                          disabled={uploading} 
                          className="hidden" 
                        />
                      </label>
                      <p className="mt-1 text-xs text-gray-500">Excel files (.xlsx, .xls) only</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <h3 className="font-medium text-gray-700 mb-2">Excel File Format for Updates:</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Your Excel file must include <strong>member_number</strong> column to identify members. 
                      Other columns are optional: <strong>name</strong>, <strong>id_number</strong>, <strong>zone</strong>, <strong>status</strong>
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-blue-900 mb-2">💡 How it works:</h4>
                      <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li><strong>member_number</strong> is required to find the member to update</li>
                        <li>Only include columns you want to update (leave others blank or omit them)</li>
                        <li>Empty cells will be ignored (won't overwrite existing data)</li>
                        <li>Members not found will be reported in the results</li>
                      </ul>
                    </div>
                    <button 
                      onClick={downloadBulkUpdateTemplate} 
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Download Update Template (CSV)
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-lg md:text-xl font-semibold">All Members ({stats.total_members})</h2>
                <div className="w-full md:w-64">
                  <input type="text" placeholder="Search..." value={searchFilter} onChange={handleSearchChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                </div>
              </div>

              {selectedMembers.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <span className="text-sm font-medium text-green-800">{selectedMembers.length} member(s) selected</span>
                  <button onClick={handleBulkDelete} className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition">Delete Selected</button>
                </div>
              )}
              
              {members.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No members found.</p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <table className="w-full min-w-max">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 md:px-4 py-3 text-left"><input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" /></th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Name</th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Member #</th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">ID Number</th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Working Station</th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Status</th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-3 md:px-4 py-3"><input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={() => toggleMemberSelection(member.id)} className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" /></td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{member.name}</td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{member.member_number}</td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{member.id_number}</td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{member.zone}</td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm"><StatusBadge status={member.status} /></td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm"><button onClick={() => handleDelete(member.id)} className="text-red-600 hover:text-red-800">Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">Page {currentPage} of {totalPages}</div>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">First</button>
                      <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
                      <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                      <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Last</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Verifications Section */}
        {mainSection === 'verifications' && hasPermission('view_verifications') && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-6">Member Verifications</h2>
            {verifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No verifications yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Member Name</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Member #</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">ID Number</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Working Station</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-700">Verified At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifications.map((v) => (
                        <tr key={v.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{v.member_name}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{v.member_number}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{v.id_number}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{v.zone}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{formatDate(v.verified_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">Page {verificationPage} of {verificationPages}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setVerificationPage(p => Math.max(1, p - 1))} disabled={verificationPage === 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                    <button onClick={() => setVerificationPage(p => Math.min(verificationPages, p + 1))} disabled={verificationPage === verificationPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Corrections Section */}
      {/* Corrections Section */}
        {mainSection === 'corrections' && hasPermission('view_corrections') && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
            {/* Search and Filter Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <h2 className="text-lg md:text-xl font-semibold">Correction Requests</h2>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search by member #, ID, name..."
                  value={correctionSearchFilter}
                  onChange={(e) => {
                    setCorrectionSearchFilter(e.target.value);
                    setCorrectionPage(1);
                  }}
                  className="flex-1 sm:w-64 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                
                {/* Status Filter */}
                <select 
                  value={correctionFilter} 
                  onChange={(e) => {
                    setCorrectionFilter(e.target.value);
                    setCorrectionPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
                
                {/* Download All PDF Button */}
                {corrections.length > 0 && (
                  <button
                    onClick={handleDownloadAllCorrectionsPDF}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download All PDF
                  </button>
                )}
              </div>
            </div>

            {/* Search Results Info */}
            {correctionSearchFilter && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Searching for:</span> "{correctionSearchFilter}"
                  {corrections.length > 0 ? (
                    <span> - Found {corrections.length} result(s)</span>
                  ) : (
                    <span> - No results found</span>
                  )}
                </p>
                <button
                  onClick={() => {
                    setCorrectionSearchFilter('');
                    setCorrectionPage(1);
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {corrections.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {correctionSearchFilter ? 'No correction requests found matching your search.' : 'No correction requests.'}
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {corrections.map((c) => (
                    <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-800">Member #{c.member_number}</h3>
                          <p className="text-sm text-gray-500">ID: {c.id_number}</p>
                          <p className="text-sm text-gray-500">Submitted: {formatDate(c.submitted_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={c.status} />
                          {c.status === 'pending' && hasPermission('manage_corrections') && (
                            <button onClick={() => handleResolveCorrection(c.id)} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition">Mark Resolved</button>
                          )}
                          <button
                            onClick={() => handleDownloadCorrectionPDF(c.id)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <h4 className="font-semibold text-sm text-red-800 mb-2">Current Details</h4>
                          <p className="text-sm"><span className="font-medium">Name:</span> {c.current_name}</p>
                          <p className="text-sm"><span className="font-medium">Working Station:</span> {c.current_zone}</p>
                          <p className="text-sm"><span className="font-medium">Status:</span> {c.current_status}</p>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <h4 className="font-semibold text-sm text-green-800 mb-2">Requested Corrections</h4>
                          <p className="text-sm"><span className="font-medium">Name:</span> {c.correct_name}</p>
                          <p className="text-sm"><span className="font-medium">Working Station:</span> {c.correct_zone}</p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Contact Information</h4>
                        <p className="text-sm"><span className="font-medium">Email:</span> {c.email || 'Not provided'}</p>
                        <p className="text-sm"><span className="font-medium">Phone:</span> {c.phone || 'Not provided'}</p>
                        {c.additional_notes && (
                          <div className="mt-2">
                            <p className="font-medium text-sm">Additional Notes:</p>
                            <p className="text-sm text-gray-600 mt-1">{c.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">Page {correctionPage} of {correctionPages}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setCorrectionPage(p => Math.max(1, p - 1))} disabled={correctionPage === 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                    <button onClick={() => setCorrectionPage(p => Math.min(correctionPages, p + 1))} disabled={correctionPage === correctionPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}