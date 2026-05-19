import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { RefreshCw, Search, Package, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ZohoInventory() {
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fuzzySearch, setFuzzySearch] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const perPage = 50;

  const fetchItems = async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/zoho/items?page=${pageNum}&per_page=${perPage}&status=active`);
      const data = await res.json();
      setItems(data.items || []);
      setHasMore(data.has_more_page || false);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllItems = async () => {
    setLoadingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/zoho/items/all`);
      const data = await res.json();
      setAllItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch all items:', err);
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    fetchItems(1);
    fetchAllItems(); // Load all items for fuzzy search
  }, []);

  // Get unique brands for filter
  const brands = useMemo(() => {
    const brandSet = new Set();
    allItems.forEach(item => {
      if (item.brand) brandSet.add(item.brand);
    });
    return Array.from(brandSet).sort();
  }, [allItems]);

  // Fuzzy match function
  const fuzzyMatch = (text, query) => {
    if (!text || !query) return false;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Direct include check
    if (textLower.includes(queryLower)) return true;
    
    // Fuzzy matching - check if all characters appear in order
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    if (queryIndex === queryLower.length) return true;
    
    // Check for partial word matches
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    return queryWords.every(qWord => 
      textWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))
    );
  };

  // Filter items based on search and filters
  const filteredItems = useMemo(() => {
    const sourceItems = fuzzySearch || searchTerm.length >= 2 ? allItems : items;
    
    return sourceItems.filter(item => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      
      // Brand filter
      if (brandFilter !== 'all' && item.brand !== brandFilter) return false;
      
      // Search filter
      if (searchTerm.length >= 2) {
        if (fuzzySearch) {
          return (
            fuzzyMatch(item.name, searchTerm) ||
            fuzzyMatch(item.sku, searchTerm) ||
            fuzzyMatch(item.description, searchTerm) ||
            fuzzyMatch(item.brand, searchTerm)
          );
        } else {
          const term = searchTerm.toLowerCase();
          return (
            item.name?.toLowerCase().includes(term) ||
            item.sku?.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term) ||
            item.brand?.toLowerCase().includes(term)
          );
        }
      }
      
      return true;
    });
  }, [items, allItems, searchTerm, fuzzySearch, statusFilter, brandFilter]);

  const formatCurrency = (val) => {
    return `R ${(val || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      archived: 'bg-red-100 text-red-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setBrandFilter('all');
    setFuzzySearch(false);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || brandFilter !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zoho Inventory</h1>
          <p className="text-gray-500 mt-1">
            {loadingAll ? 'Loading all products...' : `${allItems.length} total active products`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-blue-50' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button onClick={() => { fetchItems(page); fetchAllItems(); }} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, SKU, description, or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={fuzzySearch ? "default" : "outline"}
              onClick={() => setFuzzySearch(!fuzzySearch)}
              className="whitespace-nowrap"
            >
              {fuzzySearch ? '🔍 Fuzzy ON' : '🔍 Fuzzy OFF'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="flex flex-wrap gap-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Brand:</label>
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm max-w-[200px]"
                >
                  <option value="all">All Brands</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Search hint */}
          {fuzzySearch && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded">
              Fuzzy search enabled - will find partial matches and similar terms
            </p>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Products ({filteredItems.length} {hasActiveFilters ? 'filtered' : 'shown'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !allItems.length ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="animate-pulse h-20 bg-gray-100 rounded"></div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No items found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">SKU</th>
                    <th className="text-left p-3 font-semibold">Product Name</th>
                    <th className="text-left p-3 font-semibold">Description</th>
                    <th className="text-left p-3 font-semibold">Brand</th>
                    <th className="text-center p-3 font-semibold">Status</th>
                    <th className="text-right p-3 font-semibold">Cost Price</th>
                    <th className="text-right p-3 font-semibold">Selling Price</th>
                    <th className="text-right p-3 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.slice(0, 100).map((item) => (
                    <tr key={item.item_id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                          {item.sku || '-'}
                        </code>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-600 text-xs max-w-xs truncate" title={item.description}>
                          {item.description || '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        {item.brand ? (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            {item.brand}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="p-3 text-right font-medium text-gray-700">
                        {formatCurrency(item.purchase_rate)}
                      </td>
                      <td className="p-3 text-right font-medium text-green-600">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-medium ${item.stock_on_hand > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {item.stock_on_hand}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredItems.length > 100 && (
                <div className="text-center py-4 text-gray-500 text-sm border-t">
                  Showing first 100 of {filteredItems.length} results. Use search to narrow down.
                </div>
              )}
            </div>
          )}

          {/* Pagination - only show when not searching */}
          {!searchTerm && !hasActiveFilters && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchItems(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchItems(page + 1)}
                disabled={!hasMore || loading}
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
