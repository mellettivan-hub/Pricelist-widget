import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  RefreshCw, Search, ArrowRightLeft, CheckCircle, 
  TrendingDown, TrendingUp, Upload as UploadIcon, AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MatchAndUpdate() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [stats, setStats] = useState({ total_zoho_items: 0, total_matched: 0, total_cheaper: 0 });
  const [markup, setMarkup] = useState(45);
  const [updateResults, setUpdateResults] = useState(null);
  const [filterCheaper, setFilterCheaper] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/zoho/match?markup_percent=${markup}&match_threshold=80`);
      const data = await res.json();
      setMatches(data.matches || []);
      setStats({
        total_zoho_items: data.total_zoho_items || 0,
        total_matched: data.total_matched || 0,
        total_cheaper: data.total_cheaper || 0
      });
      setSelectedItems(new Set());
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  }, [markup]);

  useEffect(() => {
    fetchMatches();
  }, []);

  const filteredMatches = matches.filter(match => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      match.zoho_item_name?.toLowerCase().includes(term) ||
      match.zoho_sku?.toLowerCase().includes(term) ||
      match.matched_vendor?.toLowerCase().includes(term) ||
      match.matched_product_code?.toLowerCase().includes(term)
    );
    
    if (filterCheaper) {
      return matchesSearch && match.is_cheaper;
    }
    return matchesSearch;
  });

  const toggleSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllCheaper = () => {
    const cheaperIds = matches.filter(m => m.is_cheaper).map(m => m.zoho_item_id);
    setSelectedItems(new Set(cheaperIds));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const updateSelectedPrices = async () => {
    if (selectedItems.size === 0) return;
    
    setUpdating(true);
    setUpdateResults(null);
    
    try {
      const updates = matches
        .filter(m => selectedItems.has(m.zoho_item_id))
        .map(m => ({
          item_id: m.zoho_item_id,
          purchase_rate: m.suggested_cost,
          rate: m.suggested_selling
        }));
      
      const res = await fetch(`${API_URL}/api/zoho/items/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const result = await res.json();
      setUpdateResults(result);
      
      if (result.successful > 0) {
        // Refresh matches after update
        setTimeout(() => fetchMatches(), 1500);
      }
    } catch (err) {
      console.error('Failed to update prices:', err);
      setUpdateResults({ error: err.message });
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (val) => {
    return `R ${(val || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Match & Update Prices</h1>
          <p className="text-gray-500 mt-1">Compare Zoho items with uploaded pricelists</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Markup %:</label>
            <Input
              type="number"
              value={markup}
              onChange={(e) => setMarkup(Number(e.target.value))}
              className="w-20"
            />
          </div>
          <Button onClick={fetchMatches} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_matched}</p>
                <p className="text-sm text-gray-500">Matched Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.total_cheaper}</p>
                <p className="text-sm text-gray-500">Cheaper Prices Found</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedItems.size}</p>
                <p className="text-sm text-gray-500">Selected for Update</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Update Results */}
      {updateResults && (
        <Card className={updateResults.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="pt-4">
            {updateResults.error ? (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>Error: {updateResults.error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span>
                  Successfully updated {updateResults.successful} of {updateResults.total} items
                  {updateResults.failed > 0 && ` (${updateResults.failed} failed)`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No matches message */}
      {!loading && matches.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 pb-6 text-center">
            <UploadIcon className="w-12 h-12 mx-auto mb-3 text-amber-400" />
            <h3 className="text-lg font-semibold text-amber-800">No Pricelists Uploaded</h3>
            <p className="text-amber-600 mt-1">
              Upload vendor pricelists first to compare prices with your Zoho Inventory.
            </p>
            <a href="/upload">
              <Button className="mt-4">
                <UploadIcon className="w-4 h-4 mr-2" />
                Upload Pricelist
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Search and Actions */}
      {matches.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, SKU, vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filterCheaper ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterCheaper(!filterCheaper)}
                >
                  <TrendingDown className="w-4 h-4 mr-1" />
                  Cheaper Only
                </Button>
                <Button variant="outline" size="sm" onClick={selectAllCheaper}>
                  Select All Cheaper
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <Button 
                  onClick={updateSelectedPrices} 
                  disabled={selectedItems.size === 0 || updating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {updating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Update {selectedItems.size} Items
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matches Table */}
      {matches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              Price Comparisons ({filteredMatches.length} shown)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-gray-100 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === filteredMatches.length && filteredMatches.length > 0}
                          onChange={() => {
                            if (selectedItems.size === filteredMatches.length) {
                              clearSelection();
                            } else {
                              setSelectedItems(new Set(filteredMatches.map(m => m.zoho_item_id)));
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left p-3 font-semibold">Zoho Item</th>
                      <th className="text-left p-3 font-semibold">Matched Vendor</th>
                      <th className="text-left p-3 font-semibold">Match</th>
                      <th className="text-right p-3 font-semibold">Current Cost</th>
                      <th className="text-right p-3 font-semibold">New Cost</th>
                      <th className="text-right p-3 font-semibold">New Selling</th>
                      <th className="text-right p-3 font-semibold">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map((match) => (
                      <tr 
                        key={match.zoho_item_id} 
                        className={`border-b hover:bg-gray-50 ${match.is_cheaper ? 'bg-green-50' : ''}`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(match.zoho_item_id)}
                            onChange={() => toggleSelection(match.zoho_item_id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{match.zoho_item_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{match.zoho_sku}</div>
                        </td>
                        <td className="p-3">
                          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                            {match.matched_vendor}
                          </span>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{match.matched_product_code}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            match.match_type === 'exact' ? 'bg-green-100 text-green-700' :
                            match.match_type === 'normalized' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {match.match_type} ({match.match_score}%)
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(match.zoho_current_cost)}
                        </td>
                        <td className="p-3 text-right font-medium text-blue-600">
                          {formatCurrency(match.suggested_cost)}
                        </td>
                        <td className="p-3 text-right font-medium text-green-600">
                          {formatCurrency(match.suggested_selling)}
                        </td>
                        <td className="p-3 text-right">
                          {match.is_cheaper ? (
                            <span className="flex items-center justify-end gap-1 text-green-600 font-medium">
                              <TrendingDown className="w-4 h-4" />
                              {formatCurrency(match.price_difference)}
                            </span>
                          ) : match.price_difference < 0 ? (
                            <span className="flex items-center justify-end gap-1 text-red-500">
                              <TrendingUp className="w-4 h-4" />
                              {formatCurrency(Math.abs(match.price_difference))}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
