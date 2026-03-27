import { useState, useEffect } from "react";
import axios from "axios";
import { ChartLine, MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PriceHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState([]);

  useEffect(() => {
    fetchRecentHistory();
  }, []);

  const fetchRecentHistory = async () => {
    try {
      const response = await axios.get(`${API}/price-history?limit=100`);
      setHistory(response.data.history);
    } catch (error) {
      console.error("Failed to fetch price history:", error);
      toast.error("Failed to load price history");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await axios.get(`${API}/price-history/${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data.history);
      
      if (response.data.history.length > 0) {
        // Group by vendor to show price changes
        const productCode = response.data.history[0].product_code;
        setSelectedProduct(productCode);
        
        // Process data for chart
        const chartData = processChartData(response.data.history);
        setProductHistory(chartData);
      } else {
        toast.info("No history found for this product");
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Search failed");
    }
  };

  const processChartData = (historyData) => {
    // Group by date and vendor
    const grouped = {};
    
    historyData.forEach(item => {
      const date = new Date(item.recorded_at).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = { date };
      }
      grouped[date][item.vendor_name] = item.price;
    });
    
    return Object.values(grouped).reverse();
  };

  const getUniqueVendors = () => {
    const vendors = new Set();
    searchResults.forEach(item => vendors.add(item.vendor_name));
    return Array.from(vendors);
  };

  const vendorColors = {
    0: "#002FA7",
    1: "#16A34A",
    2: "#D97706",
    3: "#7C3AED",
    4: "#DC2626"
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
    <div data-testid="price-history-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Price History</h1>
        <p className="page-subtitle">Track price changes over time</p>
      </div>

      <div className="p-6">
        {/* Search */}
        <div className="card mb-6">
          <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
            Search Product History
          </label>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlass 
                size={20} 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Enter product code (e.g., DS-2CD2047G3)"
                className="search-input pl-12"
                data-testid="history-search-input"
              />
            </div>
            <button
              onClick={handleSearch}
              className="btn-primary"
              data-testid="history-search-btn"
            >
              Search
            </button>
          </div>
        </div>

        {/* Chart */}
        {selectedProduct && productHistory.length > 0 && (
          <div className="card mb-6">
            <h2 className="font-heading font-bold text-lg mb-4">
              Price Trend: <span className="font-mono text-[#002FA7]">{selectedProduct}</span>
            </h2>
            <div className="h-80" data-testid="price-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={productHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: "#52525B" }}
                    tickLine={{ stroke: "#E4E4E7" }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: "#52525B" }}
                    tickLine={{ stroke: "#E4E4E7" }}
                    tickFormatter={(value) => `R${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: "#FFFFFF", 
                      border: "1px solid #E4E4E7",
                      borderRadius: 0
                    }}
                    formatter={(value) => [`R ${value.toFixed(2)}`, ""]}
                  />
                  <Legend />
                  {getUniqueVendors().map((vendor, index) => (
                    <Line
                      key={vendor}
                      type="linear"
                      dataKey={vendor}
                      stroke={vendorColors[index % 5]}
                      strokeWidth={2}
                      dot={{ fill: vendorColors[index % 5], r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Search Results Table */}
        {searchResults.length > 0 && (
          <div className="card p-0 overflow-hidden mb-6">
            <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
              <span className="text-sm font-semibold">
                History for: <span className="font-mono">{selectedProduct}</span>
              </span>
            </div>
            <table className="w-full data-table" data-testid="history-results-table">
              <thead>
                <tr>
                  <th className="text-left">Product Code</th>
                  <th className="text-left">Description</th>
                  <th className="text-left">Vendor</th>
                  <th className="text-right">Price</th>
                  <th className="text-left">Recorded Date</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="font-mono text-sm">{item.product_code}</td>
                    <td className="max-w-xs truncate text-sm">{item.description}</td>
                    <td>
                      <span className="badge badge-success">{item.vendor_name}</span>
                    </td>
                    <td className="text-right font-mono">
                      R {item.price.toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </td>
                    <td className="text-zinc-500 text-sm">
                      {new Date(item.recorded_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent History */}
        <div className="card p-0 overflow-hidden">
          <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
            <span className="text-sm font-semibold">Recent Price Records</span>
          </div>
          
          {history.length > 0 ? (
            <table className="w-full data-table" data-testid="recent-history-table">
              <thead>
                <tr>
                  <th className="text-left">Product Code</th>
                  <th className="text-left">Description</th>
                  <th className="text-left">Vendor</th>
                  <th className="text-right">Price</th>
                  <th className="text-left">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="font-mono text-sm">{item.product_code}</td>
                    <td className="max-w-xs truncate text-sm">{item.description}</td>
                    <td>
                      <span className="badge badge-success text-xs">{item.vendor_name}</span>
                    </td>
                    <td className="text-right font-mono text-sm">
                      R {item.price.toFixed(2)}
                    </td>
                    <td className="text-zinc-500 text-xs">
                      {new Date(item.recorded_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <ChartLine size={48} className="empty-state-icon mx-auto" />
              <p className="empty-state-title">No price history yet</p>
              <p className="text-sm">Price history will appear after uploading price lists</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceHistory;
