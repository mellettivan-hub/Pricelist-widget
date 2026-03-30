import { useState, useCallback } from "react";
import axios from "axios";
import { Trophy, CaretDown, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sortField, setSortField] = useState("price");
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Always use fuzzy/smart match
      const response = await axios.get(`${API}/search`, {
        params: { q: query, fuzzy: true }
      });
      setResults(response.data.results);
      
      if (response.data.count === 0) {
        toast.info("No products found");
      } else {
        toast.success(`Found ${response.data.count} products`);
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? 
      <CaretUp size={14} weight="bold" /> : 
      <CaretDown size={14} weight="bold" />;
  };

  return (
    <div data-testid="search-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Price Search</h1>
        <p className="page-subtitle">Search across all vendor price lists</p>
      </div>

      <div className="p-6">
        {/* Search Box */}
        <div className="card mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter product code or description..."
              className="flex-1 border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              data-testid="search-input"
              autoComplete="off"
            />
            
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="btn-primary px-8 flex items-center gap-2"
              data-testid="search-button"
            >
              <MagnifyingGlass size={20} weight="bold" />
              {loading ? "..." : "Search"}
            </button>
            
            {query && (
              <button
                onClick={clearSearch}
                className="btn-secondary px-4"
                data-testid="clear-search"
              >
                Clear
              </button>
            )}
          </div>
          
          <p className="text-xs text-zinc-500 mt-3">
            Smart matching enabled - finds similar products even with different code formats
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-bar mb-4">
            <div className="loading-bar-inner" />
          </div>
        )}

        {/* No Results */}
        {searched && !loading && results.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <p className="empty-state-title">No products found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-sm font-semibold">
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </span>
              <span className="text-xs text-zinc-500">
                Sorted by selling price (lowest first)
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full data-table" data-testid="results-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th 
                      className="text-left cursor-pointer hover:bg-zinc-100"
                      onClick={() => handleSort("product_code")}
                    >
                      <div className="flex items-center gap-1">
                        Product Code
                        <SortIcon field="product_code" />
                      </div>
                    </th>
                    <th 
                      className="text-left cursor-pointer hover:bg-zinc-100"
                      onClick={() => handleSort("description")}
                    >
                      <div className="flex items-center gap-1">
                        Description
                        <SortIcon field="description" />
                      </div>
                    </th>
                    <th 
                      className="text-left cursor-pointer hover:bg-zinc-100"
                      onClick={() => handleSort("vendor_name")}
                    >
                      <div className="flex items-center gap-1">
                        Vendor
                        <SortIcon field="vendor_name" />
                      </div>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:bg-zinc-100"
                      onClick={() => handleSort("cost_price")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Cost Price
                        <SortIcon field="cost_price" />
                      </div>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:bg-zinc-100"
                      onClick={() => handleSort("price")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Selling Price
                        <SortIcon field="price" />
                      </div>
                    </th>
                    <th className="text-right w-20">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((product, index) => (
                    <tr 
                      key={`${product.product_code}-${product.vendor_id}-${index}`}
                      className={product.is_cheapest ? "cheapest-row" : ""}
                      data-testid={product.is_cheapest ? "cheapest-result" : "result-row"}
                    >
                      <td className="text-center">
                        {product.is_cheapest && (
                          <Trophy size={18} weight="fill" className="text-green-600 mx-auto" />
                        )}
                      </td>
                      <td className="font-mono text-sm">
                        {product.product_code}
                      </td>
                      <td className="max-w-md">
                        <span className="line-clamp-2 text-sm">
                          {product.description}
                        </span>
                        {product.category && (
                          <span className="text-xs text-zinc-400 block mt-1">
                            {product.category}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-success text-xs">
                          {product.vendor_name}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono text-sm text-zinc-500">
                          R {(product.cost_price || product.price).toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={`price font-bold ${product.is_cheapest ? "price-cheapest" : ""}`}>
                          R {product.price.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </span>
                        {product.markup_percent > 0 && (
                          <span className="text-xs text-green-600 block">
                            +{product.markup_percent}%
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className={`text-xs font-mono ${product.match_score >= 80 ? 'text-green-600' : product.match_score >= 60 ? 'text-yellow-600' : 'text-zinc-500'}`}>
                          {product.match_score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
