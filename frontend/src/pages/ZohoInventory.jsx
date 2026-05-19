import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  RefreshCw, Search, Package, Filter, X, 
  ShoppingCart, Tag, Boxes, TrendingUp, CheckCircle, Factory
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ZohoInventory() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fuzzySearch, setFuzzySearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchAllItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/zoho/items/all`);
      const data = await res.json();
      setAllItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllItems();
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalProducts = allItems.length;
    const totalValue = allItems.reduce((sum, item) => sum + (item.rate * item.stock_on_hand), 0);
    const inStock = allItems.filter(item => item.stock_on_hand > 0).length;
    const outOfStock = allItems.filter(item => item.stock_on_hand === 0).length;
    const goods = allItems.filter(item => item.product_type === 'goods').length;
    const services = allItems.filter(item => item.product_type === 'service').length;
    const sellable = allItems.filter(item => item.is_sales_item).length;
    const purchasable = allItems.filter(item => item.is_purchase_item).length;
    
    return { totalProducts, totalValue, inStock, outOfStock, goods, services, sellable, purchasable };
  }, [allItems]);

  // Get unique brands and manufacturers for filters
  const { brands, manufacturers } = useMemo(() => {
    const brandSet = new Set();
    const mfgSet = new Set();
    allItems.forEach(item => {
      if (item.brand) brandSet.add(item.brand);
      if (item.manufacturer) mfgSet.add(item.manufacturer);
    });
    return {
      brands: Array.from(brandSet).sort(),
      manufacturers: Array.from(mfgSet).sort()
    };
  }, [allItems]);

  // Fuzzy match function
  const fuzzyMatch = (text, query) => {
    if (!text || !query) return false;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (textLower.includes(queryLower)) return true;
    
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    if (queryIndex === queryLower.length) return true;
    
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    return queryWords.every(qWord => 
      textWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))
    );
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (brandFilter !== 'all' && item.brand !== brandFilter) return false;
      if (typeFilter === 'goods' && item.product_type !== 'goods') return false;
      if (typeFilter === 'service' && item.product_type !== 'service') return false;
      if (typeFilter === 'instock' && item.stock_on_hand <= 0) return false;
      if (typeFilter === 'outofstock' && item.stock_on_hand > 0) return false;
      
      if (searchTerm.length >= 2) {
        if (fuzzySearch) {
          return (
            fuzzyMatch(item.name, searchTerm) ||
            fuzzyMatch(item.sku, searchTerm) ||
            fuzzyMatch(item.description, searchTerm) ||
            fuzzyMatch(item.brand, searchTerm) ||
            fuzzyMatch(item.manufacturer, searchTerm)
          );
        } else {
          const term = searchTerm.toLowerCase();
          return (
            item.name?.toLowerCase().includes(term) ||
            item.sku?.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term) ||
            item.brand?.toLowerCase().includes(term) ||
            item.manufacturer?.toLowerCase().includes(term)
          );
        }
      }
      
      return true;
    });
  }, [allItems, searchTerm, fuzzySearch, statusFilter, brandFilter, typeFilter]);

  const formatCurrency = (val) => {
    return `R ${(val || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setBrandFilter('all');
    setTypeFilter('all');
    setFuzzySearch(false);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || brandFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zoho Inventory</h1>
          <p className="text-gray-500 mt-1">Manage and view your inventory products</p>
        </div>
        <Button onClick={fetchAllItems} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : stats.totalProducts.toLocaleString()}</p>
                <p className="text-sm text-blue-100">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : stats.inStock.toLocaleString()}</p>
                <p className="text-sm text-green-100">In Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : stats.sellable.toLocaleString()}</p>
                <p className="text-sm text-amber-100">Sellable</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.totalValue).replace('R ', '')}</p>
                <p className="text-sm text-purple-100">Stock Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={typeFilter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('all')}
        >
          All ({stats.totalProducts})
        </Button>
        <Button 
          variant={typeFilter === 'goods' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('goods')}
        >
          <Package className="w-3 h-3 mr-1" />
          Goods ({stats.goods})
        </Button>
        <Button 
          variant={typeFilter === 'service' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('service')}
        >
          <Tag className="w-3 h-3 mr-1" />
          Services ({stats.services})
        </Button>
        <Button 
          variant={typeFilter === 'instock' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('instock')}
          className={typeFilter === 'instock' ? 'bg-green-600' : ''}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          In Stock ({stats.inStock})
        </Button>
        <Button 
          variant={typeFilter === 'outofstock' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('outofstock')}
          className={typeFilter === 'outofstock' ? 'bg-red-600' : ''}
        >
          Out of Stock ({stats.outOfStock})
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, SKU, description, brand, manufacturer..."
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
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50' : ''}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

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
                  <option value="all">All Brands ({brands.length})</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {fuzzySearch && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded">
              🔍 Fuzzy search enabled - finds partial matches and similar terms
            </p>
          )}
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Products ({filteredItems.length.toLocaleString()} {hasActiveFilters ? 'filtered' : 'total'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">Brand</th>
                    <th className="text-left p-3 font-semibold">Manufacturer</th>
                    <th className="text-center p-3 font-semibold">Status</th>
                    <th className="text-center p-3 font-semibold">Sellable</th>
                    <th className="text-center p-3 font-semibold">Purchasable</th>
                    <th className="text-right p-3 font-semibold bg-blue-50">Cost Price</th>
                    <th className="text-right p-3 font-semibold bg-green-50">Selling Price</th>
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
                        {item.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs" title={item.description}>
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.product_type === 'goods' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.product_type === 'goods' ? '📦 Goods' : '🔧 Service'}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.brand ? (
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                            {item.brand}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.manufacturer ? (
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Factory className="w-3 h-3" />
                            {item.manufacturer}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {item.is_sales_item ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.is_purchase_item ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium text-gray-700 bg-blue-50/30">
                        {formatCurrency(item.purchase_rate)}
                      </td>
                      <td className="p-3 text-right font-medium text-green-600 bg-green-50/30">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-medium ${
                          item.stock_on_hand > 0 
                            ? 'text-green-600' 
                            : 'text-red-500'
                        }`}>
                          {item.stock_on_hand}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredItems.length > 100 && (
                <div className="text-center py-4 text-gray-500 text-sm border-t">
                  Showing first 100 of {filteredItems.length.toLocaleString()} results. Use search to narrow down.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
