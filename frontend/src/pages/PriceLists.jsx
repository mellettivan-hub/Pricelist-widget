import { useState, useEffect } from "react";
import axios from "axios";
import { Files, Trash, FileXls, MagnifyingGlass, Package, Tag, ArrowDown } from "@phosphor-icons/react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PriceLists = () => {
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [fuzzySearch, setFuzzySearch] = useState(false);

  useEffect(() => {
    fetchPriceLists();
  }, []);

  const fetchPriceLists = async () => {
    try {
      const response = await axios.get(`${API}/price-lists`);
      setPriceLists(response.data);
    } catch (error) {
      console.error("Failed to fetch price lists:", error);
      toast.error("Failed to load price lists");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (priceListId, fileName) => {
    setDeleteConfirm({ id: priceListId, fileName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${API}/price-lists/${deleteConfirm.id}`);
      setPriceLists(priceLists.filter(p => p.id !== deleteConfirm.id));
      toast.success("Price list deleted successfully");
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete price list:", error);
      toast.error("Failed to delete price list");
    } finally {
      setDeleting(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    
    setSearching(true);
    try {
      const response = await axios.get(`${API}/price-lists/search?q=${encodeURIComponent(searchQuery)}&fuzzy=${fuzzySearch}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="loading-bar">
          <div className="loading-bar-inner" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="price-lists-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Price Lists</h1>
        <p className="page-subtitle">Manage uploaded vendor price lists</p>
      </div>

      <div className="p-6">
        {/* Search Section */}
        <div className="card mb-6">
          <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <MagnifyingGlass size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products across all price lists..."
                className="w-full pl-10 pr-4 py-3 border border-zinc-300 focus:border-blue-500 focus:outline-none text-sm"
                data-testid="search-input"
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 border border-zinc-300 bg-white cursor-pointer hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={fuzzySearch}
                onChange={(e) => setFuzzySearch(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm font-medium text-zinc-700">Fuzzy Search</span>
            </label>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="btn-primary px-6"
              data-testid="search-btn"
            >
              {searching ? "Searching..." : "Search"}
            </button>
            {searchResults && (
              <button
                type="button"
                onClick={clearSearch}
                className="btn-secondary px-4"
              >
                Clear
              </button>
            )}
          </form>
          <p className="text-xs text-zinc-500 mt-2">
            {fuzzySearch 
              ? "Fuzzy search enabled - finds similar product codes even with slight differences" 
              : "Exact search - matches product codes and descriptions containing your search term"}
          </p>
        </div>

        {/* Search Results */}
        {searchResults && (
          <div className="card mb-6" data-testid="search-results">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Package size={20} className="text-blue-600" />
                Search Results for "{searchResults.query}"
              </h2>
              <span className="text-sm text-zinc-500">
                {searchResults.total_results} products found
              </span>
            </div>

            {searchResults.results.length > 0 ? (
              <div className="space-y-6 max-h-[600px] overflow-y-auto">
                {searchResults.results.map((product, idx) => (
                  <div key={idx} className="border border-zinc-200 rounded-lg overflow-hidden">
                    {/* Product Header */}
                    <div className="bg-zinc-100 p-3 border-b border-zinc-200">
                      <h3 className="font-mono font-bold text-blue-600 text-lg">{product.product_code}</h3>
                      <p className="text-sm text-zinc-600">{product.description}</p>
                    </div>
                    
                    {/* All Vendors/Pricelists Table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200">
                          <th className="text-left p-3 font-semibold">Vendor / Pricelist</th>
                          <th className="text-right p-3 font-semibold">Cost Price</th>
                          <th className="text-right p-3 font-semibold">Selling Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.vendors.map((vendor, vIdx) => (
                          <tr 
                            key={vIdx} 
                            className={`border-b border-zinc-100 ${vIdx === 0 ? 'bg-green-50' : 'hover:bg-zinc-50'}`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${vIdx === 0 ? 'text-green-700' : 'text-zinc-700'}`}>
                                  {vendor.vendor_name}
                                </span>
                                {vIdx === 0 && (
                                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold">
                                    CHEAPEST
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={`p-3 text-right font-mono ${vIdx === 0 ? 'font-bold text-green-700 text-base' : 'text-zinc-700'}`}>
                              R {vendor.price?.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono text-zinc-500">
                              R {vendor.selling_price?.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <MagnifyingGlass size={40} className="mx-auto mb-2 text-zinc-300" />
                <p>No products found matching "{searchResults.query}"</p>
              </div>
            )}
          </div>
        )}

        {/* Price Lists Table */}
        {priceLists.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="w-full data-table" data-testid="price-lists-table">
              <thead>
                <tr>
                  <th className="text-left">File Name</th>
                  <th className="text-left">Vendor</th>
                  <th className="text-right">Products</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Upload Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {priceLists.map((list) => (
                  <tr key={list.id} data-testid="price-list-row">
                    <td>
                      <div className="flex items-center gap-2">
                        <FileXls size={18} className="text-green-600" />
                        <span className="font-mono text-sm">{list.file_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-success">{list.vendor_name}</span>
                    </td>
                    <td className="text-right font-mono">
                      {list.product_count.toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${list.status === "active" ? "badge-success" : "badge-warning"}`}>
                        {list.status}
                      </span>
                    </td>
                    <td className="text-zinc-500 text-sm">
                      {new Date(list.upload_date).toLocaleString()}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDelete(list.id, list.file_name)}
                        className="p-2 text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete price list"
                        data-testid="delete-price-list-btn"
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <Files size={48} className="empty-state-icon mx-auto" />
              <p className="empty-state-title">No price lists uploaded</p>
              <p className="text-sm">Upload vendor price lists to compare prices</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="delete-confirm-modal">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Price List?</h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <strong>"{deleteConfirm.fileName}"</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will also remove all products from this price list. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                disabled={deleting}
                data-testid="confirm-delete-btn"
              >
                {deleting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceLists;
