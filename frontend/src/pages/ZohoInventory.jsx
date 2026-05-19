import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  RefreshCw, Search, Package, Filter, X, 
  ShoppingCart, Tag, Boxes, TrendingUp, CheckCircle, Factory, Edit, Save, BookOpen
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ZohoInventory() {
  const [allItems, setAllItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fuzzySearch, setFuzzySearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Edit modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

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

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/zoho/accounts`);
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  useEffect(() => {
    fetchAllItems();
    fetchAccounts();
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

  // Get unique brands
  const brands = useMemo(() => {
    const brandSet = new Set();
    allItems.forEach(item => {
      if (item.brand) brandSet.add(item.brand);
    });
    return Array.from(brandSet).sort();
  }, [allItems]);

  // Filter accounts by type for dropdowns
  const salesAccounts = useMemo(() => 
    accounts.filter(a => a.account_type === 'income' || a.account_type === 'other_income' || a.account_name.toLowerCase().includes('sales')),
    [accounts]
  );
  
  const purchaseAccounts = useMemo(() => 
    accounts.filter(a => a.account_type === 'expense' || a.account_type === 'cost_of_goods_sold' || a.account_name.toLowerCase().includes('cost') || a.account_name.toLowerCase().includes('purchase')),
    [accounts]
  );

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

  // Edit functions
  const openEditModal = async (item) => {
    setEditingItem(item);
    setLoadingDetails(true);
    setSaveMessage(null);
    
    try {
      const res = await fetch(`${API_URL}/api/zoho/items/${item.item_id}`);
      const data = await res.json();
      setEditForm({
        name: data.name || '',
        sku: data.sku || '',
        description: data.description || '',
        rate: data.rate || 0,
        purchase_rate: data.purchase_rate || 0,
        brand: data.brand || '',
        manufacturer: data.manufacturer || '',
        unit: data.unit || '',
        reorder_level: data.reorder_level || 0,
        // Account info
        account_id: data.account_id || '',
        account_name: data.account_name || '',
        purchase_account_id: data.purchase_account_id || '',
        purchase_account_name: data.purchase_account_name || '',
        inventory_account_name: data.inventory_account_name || '',
        tax_name: data.tax_name || '',
        tax_percentage: data.tax_percentage || 0,
        purchase_tax_name: data.purchase_tax_name || '',
        purchase_tax_percentage: data.purchase_tax_percentage || 0,
      });
    } catch (err) {
      console.error('Failed to fetch item details:', err);
      setEditForm({
        name: item.name || '',
        sku: item.sku || '',
        description: item.description || '',
        rate: item.rate || 0,
        purchase_rate: item.purchase_rate || 0,
        brand: item.brand || '',
        manufacturer: item.manufacturer || '',
        unit: item.unit || '',
        reorder_level: item.reorder_level || 0,
        account_id: item.account_id || '',
        account_name: item.account_name || '',
        purchase_account_id: item.purchase_account_id || '',
        purchase_account_name: item.purchase_account_name || '',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm({});
    setSaveMessage(null);
  };

  const saveItem = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const updateData = {
        name: editForm.name,
        sku: editForm.sku,
        description: editForm.description,
        rate: parseFloat(editForm.rate) || 0,
        purchase_rate: parseFloat(editForm.purchase_rate) || 0,
        brand: editForm.brand,
        manufacturer: editForm.manufacturer,
        unit: editForm.unit,
        reorder_level: parseFloat(editForm.reorder_level) || 0,
      };
      
      // Only include account IDs if they were changed
      if (editForm.account_id) {
        updateData.account_id = editForm.account_id;
      }
      if (editForm.purchase_account_id) {
        updateData.purchase_account_id = editForm.purchase_account_id;
      }
      
      const res = await fetch(`${API_URL}/api/zoho/items/${editingItem.item_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const result = await res.json();
      
      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Item updated successfully in Zoho!' });
        // Update local state
        setAllItems(prev => prev.map(item => 
          item.item_id === editingItem.item_id 
            ? { 
                ...item, 
                ...editForm, 
                rate: parseFloat(editForm.rate), 
                purchase_rate: parseFloat(editForm.purchase_rate),
                account_name: accounts.find(a => a.account_id === editForm.account_id)?.account_name || editForm.account_name,
                purchase_account_name: accounts.find(a => a.account_id === editForm.purchase_account_id)?.account_name || editForm.purchase_account_name,
              }
            : item
        ));
        setTimeout(() => closeEditModal(), 1500);
      } else {
        setSaveMessage({ type: 'error', text: result.detail || 'Failed to update item' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to update item' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zoho Inventory</h1>
          <p className="text-gray-500 mt-1">Manage and view your inventory products</p>
        </div>
        <Button onClick={() => { fetchAllItems(); fetchAccounts(); }} disabled={loading} variant="outline">
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
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold w-10">Edit</th>
                    <th className="text-left p-3 font-semibold">SKU</th>
                    <th className="text-left p-3 font-semibold">Product Name</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">Brand</th>
                    <th className="text-left p-3 font-semibold bg-indigo-50">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Sales Account
                      </div>
                    </th>
                    <th className="text-left p-3 font-semibold bg-orange-50">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Purchase Account
                      </div>
                    </th>
                    <th className="text-right p-3 font-semibold bg-blue-50">Cost Price</th>
                    <th className="text-right p-3 font-semibold bg-green-50">Selling Price</th>
                    <th className="text-right p-3 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.slice(0, 100).map((item) => (
                    <tr key={item.item_id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </td>
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
                        ) : '-'}
                      </td>
                      <td className="p-3 bg-indigo-50/30">
                        <span className="text-xs text-indigo-700 font-medium">
                          {item.account_name || '-'}
                        </span>
                      </td>
                      <td className="p-3 bg-orange-50/30">
                        <span className="text-xs text-orange-700 font-medium">
                          {item.purchase_account_name || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-700 bg-blue-50/30">
                        {formatCurrency(item.purchase_rate)}
                      </td>
                      <td className="p-3 text-right font-medium text-green-600 bg-green-50/30">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-medium ${
                          item.stock_on_hand > 0 ? 'text-green-600' : 'text-red-500'
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
                  Showing first 100 of {filteredItems.length.toLocaleString()} results.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Edit Product</h2>
                <Button variant="ghost" size="sm" onClick={closeEditModal}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {loadingDetails ? (
              <div className="p-6 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="mt-2 text-gray-500">Loading item details...</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Save Message */}
                {saveMessage && (
                  <div className={`p-3 rounded ${
                    saveMessage.type === 'success' 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    {saveMessage.text}
                  </div>
                )}

                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Product Name</label>
                      <Input
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">SKU</label>
                      <Input
                        value={editForm.sku || ''}
                        onChange={(e) => setEditForm({...editForm, sku: e.target.value})}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                      <textarea
                        className="w-full border rounded-md p-2 text-sm"
                        rows={2}
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Cost Price (Purchase Rate)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.purchase_rate || 0}
                        onChange={(e) => setEditForm({...editForm, purchase_rate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Selling Price (Rate)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.rate || 0}
                        onChange={(e) => setEditForm({...editForm, rate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* GL Accounts */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    GL Accounts
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Sales Account</label>
                      <select
                        className="w-full border rounded-md p-2 text-sm"
                        value={editForm.account_id || ''}
                        onChange={(e) => setEditForm({...editForm, account_id: e.target.value})}
                      >
                        <option value="">-- Keep Current ({editForm.account_name || 'None'}) --</option>
                        {accounts.map(acc => (
                          <option key={acc.account_id} value={acc.account_id}>
                            {acc.account_code ? `[${acc.account_code}] ` : ''}{acc.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Purchase Account</label>
                      <select
                        className="w-full border rounded-md p-2 text-sm"
                        value={editForm.purchase_account_id || ''}
                        onChange={(e) => setEditForm({...editForm, purchase_account_id: e.target.value})}
                      >
                        <option value="">-- Keep Current ({editForm.purchase_account_name || 'None'}) --</option>
                        {accounts.map(acc => (
                          <option key={acc.account_id} value={acc.account_id}>
                            {acc.account_code ? `[${acc.account_code}] ` : ''}{acc.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Brand</label>
                      <Input
                        value={editForm.brand || ''}
                        onChange={(e) => setEditForm({...editForm, brand: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Manufacturer</label>
                      <Input
                        value={editForm.manufacturer || ''}
                        onChange={(e) => setEditForm({...editForm, manufacturer: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Unit</label>
                      <Input
                        value={editForm.unit || ''}
                        onChange={(e) => setEditForm({...editForm, unit: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Reorder Level</label>
                      <Input
                        type="number"
                        value={editForm.reorder_level || 0}
                        onChange={(e) => setEditForm({...editForm, reorder_level: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Info (Read-only) */}
                {(editForm.tax_name || editForm.purchase_tax_name) && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">Tax Information</h3>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Sales Tax</label>
                        <p className="text-sm font-medium">
                          {editForm.tax_name ? `${editForm.tax_name} (${editForm.tax_percentage}%)` : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Purchase Tax</label>
                        <p className="text-sm font-medium">
                          {editForm.purchase_tax_name ? `${editForm.purchase_tax_name} (${editForm.purchase_tax_percentage}%)` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button onClick={saveItem} disabled={saving || loadingDetails}>
                {saving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save to Zoho
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
