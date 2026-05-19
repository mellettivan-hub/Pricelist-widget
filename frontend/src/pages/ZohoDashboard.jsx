import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { RefreshCw, Package, Upload, ArrowRightLeft, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ZohoDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/zoho/sync-status`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Zoho Inventory Price Management</p>
        </div>
        <Button onClick={fetchStatus} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            {status?.zoho_connected ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            Zoho Inventory Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
          ) : status?.zoho_connected ? (
            <p className="text-green-600 font-medium">Connected and ready</p>
          ) : (
            <p className="text-red-600">{status?.error || 'Not connected'}</p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Zoho Items</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '...' : (status?.zoho_items_available || 0)}{status?.zoho_items_has_more ? '+' : ''}
                </p>
              </div>
              <Package className="w-10 h-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Uploaded Products</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '...' : (status?.uploaded_products || 0)}
                </p>
              </div>
              <Upload className="w-10 h-10 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Vendors</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '...' : (status?.vendors || 0)}
                </p>
              </div>
              <ArrowRightLeft className="w-10 h-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Price Lists</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '...' : (status?.pricelists || 0)}
                </p>
              </div>
              <Upload className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/inventory" className="block">
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                <Package className="w-8 h-8 text-blue-500 mb-2" />
                <h3 className="font-semibold">View Inventory</h3>
                <p className="text-sm text-gray-500">Browse Zoho Inventory items</p>
              </div>
            </a>
            <a href="/upload" className="block">
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                <Upload className="w-8 h-8 text-emerald-500 mb-2" />
                <h3 className="font-semibold">Upload Pricelist</h3>
                <p className="text-sm text-gray-500">Import vendor price lists</p>
              </div>
            </a>
            <a href="/match" className="block">
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                <ArrowRightLeft className="w-8 h-8 text-purple-500 mb-2" />
                <h3 className="font-semibold">Match & Update</h3>
                <p className="text-sm text-gray-500">Find best prices & update Zoho</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 text-center p-4 bg-blue-50 rounded-lg">
              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">1</div>
              <h4 className="font-semibold">Upload Pricelists</h4>
              <p className="text-sm text-gray-600 mt-1">Upload Excel files from your vendors</p>
            </div>
            <div className="flex-1 text-center p-4 bg-purple-50 rounded-lg">
              <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">2</div>
              <h4 className="font-semibold">Match Products</h4>
              <p className="text-sm text-gray-600 mt-1">System matches SKUs with Zoho items</p>
            </div>
            <div className="flex-1 text-center p-4 bg-emerald-50 rounded-lg">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">3</div>
              <h4 className="font-semibold">Update Prices</h4>
              <p className="text-sm text-gray-600 mt-1">Push cheapest prices to Zoho Inventory</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
