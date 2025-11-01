import React, { useState, useEffect } from 'react';
import { MdHistory, MdSearch, MdFilterList, MdDownload, MdRefresh, MdPerson, MdSettings, MdSecurity } from 'react-icons/md';
import { BiSolidNotepad } from 'react-icons/bi';
import { useToast, ToastContainer } from '../../../ui';

const AuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Toast notifications
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Mock audit data - In a real app, this would come from an API
  const mockAuditLogs = [
    {
      id: 'AUDIT-001',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      category: 'user_action',
      action: 'Queue Number Called',
      description: 'Admin called queue number 15 at Admissions Window 1',
      userId: 'admin@lvcc.edu',
      userName: 'John Admin',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'info',
      resource: 'Queue Management',
      resourceId: 'queue-15',
      changes: {
        before: { status: 'waiting' },
        after: { status: 'called', calledAt: new Date().toISOString() }
      },
      metadata: {
        windowId: 'window-1',
        queueNumber: 15,
        department: 'admissions'
      }
    },
    {
      id: 'AUDIT-002',
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
      category: 'system_config',
      action: 'Window Settings Updated',
      description: 'Admissions Window 2 service assignment changed from "General Inquiry" to "Application Review"',
      userId: 'admin2@lvcc.edu',
      userName: 'Jane Admin',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'medium',
      resource: 'Window Configuration',
      resourceId: 'window-2',
      changes: {
        before: { serviceId: 'service-1', serviceName: 'General Inquiry' },
        after: { serviceId: 'service-3', serviceName: 'Application Review' }
      },
      metadata: {
        windowId: 'window-2',
        department: 'admissions'
      }
    },
    {
      id: 'AUDIT-003',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      category: 'security',
      action: 'Failed Login Attempt',
      description: 'Failed login attempt for user admin3@lvcc.edu from IP 192.168.1.200',
      userId: 'admin3@lvcc.edu',
      userName: 'Unknown User',
      ipAddress: '192.168.1.200',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'high',
      resource: 'Authentication',
      resourceId: 'login-attempt',
      changes: {
        before: { loginAttempts: 2 },
        after: { loginAttempts: 3, lastFailedAt: new Date().toISOString() }
      },
      metadata: {
        reason: 'Invalid password',
        department: 'admissions'
      }
    },
    {
      id: 'AUDIT-004',
      timestamp: new Date(Date.now() - 22 * 60 * 1000),
      category: 'user_action',
      action: 'Service Added',
      description: 'New service "Document Verification" added to Admissions department',
      userId: 'admin@lvcc.edu',
      userName: 'John Admin',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'info',
      resource: 'Service Management',
      resourceId: 'service-new',
      changes: {
        before: null,
        after: {
          name: 'Document Verification',
          department: 'admissions',
          isActive: true,
          createdAt: new Date().toISOString()
        }
      },
      metadata: {
        department: 'admissions'
      }
    },
    {
      id: 'AUDIT-005',
      timestamp: new Date(Date.now() - 35 * 60 * 1000),
      category: 'system_config',
      action: 'Queue System Enabled',
      description: 'Queue system for Admissions department was enabled',
      userId: 'admin@lvcc.edu',
      userName: 'John Admin',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'medium',
      resource: 'System Settings',
      resourceId: 'queue-system',
      changes: {
        before: { isEnabled: false },
        after: { isEnabled: true, enabledAt: new Date().toISOString() }
      },
      metadata: {
        department: 'admissions'
      }
    },
    {
      id: 'AUDIT-006',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      category: 'user_action',
      action: 'Queue Transferred',
      description: 'Queue number 12 transferred from Window 1 to Window 3',
      userId: 'admin@lvcc.edu',
      userName: 'John Admin',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'info',
      resource: 'Queue Management',
      resourceId: 'queue-12',
      changes: {
        before: { windowId: 'window-1', status: 'serving' },
        after: { windowId: 'window-3', status: 'transferred', transferredAt: new Date().toISOString() }
      },
      metadata: {
        fromWindowId: 'window-1',
        toWindowId: 'window-3',
        queueNumber: 12,
        department: 'admissions'
      }
    },
    {
      id: 'AUDIT-007',
      timestamp: new Date(Date.now() - 55 * 60 * 1000),
      category: 'security',
      action: 'Successful Login',
      description: 'User admin2@lvcc.edu successfully logged in',
      userId: 'admin2@lvcc.edu',
      userName: 'Jane Admin',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      severity: 'info',
      resource: 'Authentication',
      resourceId: 'login-success',
      changes: {
        before: { lastLoginAt: null },
        after: { lastLoginAt: new Date().toISOString(), sessionId: 'sess-12345' }
      },
      metadata: {
        sessionDuration: '8 hours',
        department: 'admissions'
      }
    }
  ];

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [auditLogs, searchTerm, filterCategory, filterSeverity, dateFilter]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real app, this would be an API call to fetch audit logs
      // const response = await fetch('http://localhost:5000/api/audit/admissions');
      // const data = await response.json();

      setAuditLogs(mockAuditLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      showError('Error', 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...auditLogs];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(log => log.category === filterCategory);
    }

    // Apply severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(log => log.severity === filterSeverity);
    }

    // Apply date filter
    const now = new Date();
    if (dateFilter === 'today') {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate.toDateString() === now.toDateString();
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log =>
        new Date(log.timestamp) >= weekAgo
      );
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log =>
        new Date(log.timestamp) >= monthAgo
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'user_action': return <MdPerson className="text-lg" />;
      case 'system_config': return <MdSettings className="text-lg" />;
      case 'security': return <MdSecurity className="text-lg" />;
      case 'data_access': return <BiSolidNotepad className="text-lg" />;
      default: return <MdHistory className="text-lg" />;
    }
  };

  const handleRefresh = () => {
    fetchAuditLogs();
    showSuccess('Refreshed', 'Audit trail updated');
  };

  const handleExport = () => {
    // In a real app, this would generate and download a CSV/PDF report
    const csvContent = [
      ['Audit ID', 'Timestamp', 'Category', 'Action', 'Description', 'User', 'IP Address', 'Severity', 'Resource'],
      ...filteredLogs.map(log => [
        log.id,
        new Date(log.timestamp).toLocaleString(),
        log.category,
        log.action,
        log.description,
        `${log.userName} (${log.userId})`,
        log.ipAddress,
        log.severity,
        log.resource
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admissions-audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showSuccess('Export Complete', 'Audit trail exported successfully');
  };

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="w-20 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, index) => (
              <div key={index}>
                <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200">
            {[...Array(7)].map((_, index) => (
              <div key={index} className="p-6 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                      <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-96 mb-2 animate-pulse"></div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="flex space-x-2">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <MdHistory className="text-3xl text-[#1F3463]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1F3463]">Audit Trail</h1>
            <p className="text-gray-600">Admissions Department Security & Activity Log</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <MdRefresh className="text-lg" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors"
          >
            <MdDownload className="text-lg" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent appearance-none"
            >
              <option value="all">All Categories</option>
              <option value="user_action">User Actions</option>
              <option value="system_config">System Config</option>
              <option value="security">Security</option>
              <option value="data_access">Data Access</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="info">Info</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-center bg-gray-50 rounded-lg px-4 py-2">
            <span className="text-sm text-gray-600">
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {currentLogs.length === 0 ? (
          <div className="text-center py-12">
            <MdHistory className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {currentLogs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      {/* Category Icon */}
                      <div className="flex-shrink-0 text-gray-500">
                        {getCategoryIcon(log.category)}
                      </div>

                      {/* Action & Severity */}
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">{log.action}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(log.severity)}`}>
                          {log.severity.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-700 mb-3">{log.description}</p>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500">User:</span>
                        <p className="text-gray-900">{log.userName}</p>
                        <p className="text-gray-500 text-xs">{log.userId}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Resource:</span>
                        <p className="text-gray-900">{log.resource}</p>
                        {log.resourceId && (
                          <p className="text-gray-500 text-xs font-mono">{log.resourceId}</p>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Source:</span>
                        <p className="text-gray-900">{log.ipAddress}</p>
                        <p className="text-gray-500 text-xs truncate" title={log.userAgent}>
                          {log.userAgent.split(' ')[0]}
                        </p>
                      </div>
                    </div>

                    {/* Changes (if any) */}
                    {log.changes && (log.changes.before || log.changes.after) && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-500 text-sm">Changes:</span>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {log.changes.before && (
                            <div>
                              <span className="font-medium text-red-600">Before:</span>
                              <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                                {JSON.stringify(log.changes.before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.changes.after && (
                            <div>
                              <span className="font-medium text-green-600">After:</span>
                              <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                                {JSON.stringify(log.changes.after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timestamp & ID */}
                  <div className="flex-shrink-0 text-right ml-4">
                    <p className="text-sm text-gray-600">{formatTimestamp(log.timestamp)}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">{log.id}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} audit logs
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === pageNum
                          ? 'text-white bg-[#1F3463]'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default AuditTrail;

