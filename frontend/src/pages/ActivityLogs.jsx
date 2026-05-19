import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  RefreshCw, Search, FileText, User, Clock, 
  LogIn, LogOut, Edit, Upload, ArrowRightLeft, ChevronLeft, ChevronRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_logs: 0, unique_users: 0, users: [], action_counts: {} });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchUser, setSearchUser] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/activity/logs?page=${pageNum}&per_page=50`;
      if (searchUser) url += `&username=${encodeURIComponent(searchUser)}`;
      if (filterAction) url += `&action=${encodeURIComponent(filterAction)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.total_pages || 1);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/activity/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [searchUser, filterAction]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'LOGIN': return <LogIn className="w-4 h-4 text-green-500" />;
      case 'LOGOUT': return <LogOut className="w-4 h-4 text-gray-500" />;
      case 'UPDATE_ITEM': return <Edit className="w-4 h-4 text-blue-500" />;
      case 'BULK_UPDATE': return <ArrowRightLeft className="w-4 h-4 text-purple-500" />;
      case 'UPLOAD': return <Upload className="w-4 h-4 text-amber-500" />;
      case 'PRICELIST_UPLOAD': return <Upload className="w-4 h-4 text-orange-500" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionBadge = (action) => {
    const colors = {
      'LOGIN': 'bg-green-100 text-green-700',
      'LOGOUT': 'bg-gray-100 text-gray-700',
      'UPDATE_ITEM': 'bg-blue-100 text-blue-700',
      'BULK_UPDATE': 'bg-purple-100 text-purple-700',
      'UPLOAD': 'bg-amber-100 text-amber-700',
      'PRICELIST_UPLOAD': 'bg-orange-100 text-orange-700',
      'PRICE_UPDATE': 'bg-indigo-100 text-indigo-700',
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-500 mt-1">Track all user activities and changes</p>
        </div>
        <Button onClick={() => { fetchLogs(page); fetchStats(); }} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_logs}</p>
                <p className="text-sm text-gray-500">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unique_users}</p>
                <p className="text-sm text-gray-500">Unique Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Edit className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.action_counts?.UPDATE_ITEM || 0}</p>
                <p className="text-sm text-gray-500">Item Updates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <LogIn className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.action_counts?.LOGIN || 0}</p>
                <p className="text-sm text-gray-500">Logins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by username..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="border rounded px-3 py-2 text-sm min-w-[150px]"
            >
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="UPDATE_ITEM">Item Update</option>
              <option value="BULK_UPDATE">Bulk Update</option>
              <option value="PRICELIST_UPLOAD">Pricelist Upload</option>
              <option value="UPLOAD">Upload</option>
              <option value="PRICE_UPDATE">Price Update</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Activity Log ({logs.length} shown)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="animate-pulse h-12 bg-gray-100 rounded"></div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No activity logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Time
                      </div>
                    </th>
                    <th className="text-left p-3 font-semibold">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        User
                      </div>
                    </th>
                    <th className="text-left p-3 font-semibold">Action</th>
                    <th className="text-left p-3 font-semibold">Details</th>
                    <th className="text-left p-3 font-semibold">Item</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-gray-800">{log.username}</span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getActionBadge(log.action)}`}>
                          {getActionIcon(log.action)}
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-sm max-w-md truncate">
                        {log.details}
                      </td>
                      <td className="p-3">
                        {log.item_name ? (
                          <span className="text-xs text-gray-500">
                            {log.item_name}
                            {log.item_id && (
                              <span className="text-gray-400 ml-1">({log.item_id.slice(-6)})</span>
                            )}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
