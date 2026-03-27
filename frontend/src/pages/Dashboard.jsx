import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  Storefront, 
  Files, 
  Package,
  MagnifyingGlass,
  ArrowRight
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const [stats, setStats] = useState({ vendors: 0, price_lists: 0, products: 0 });
  const [loading, setLoading] = useState(true);
  const [recentLists, setRecentLists] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, listsRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/price-lists`)
        ]);
        setStats(statsRes.data);
        setRecentLists(listsRes.data.slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    <div data-testid="dashboard">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your vendor price data</p>
      </div>

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="stat-card" data-testid="stat-vendors">
            <div className="flex items-center justify-between">
              <div>
                <div className="stat-card-value">{stats.vendors}</div>
                <div className="stat-card-label">Vendors</div>
              </div>
              <Storefront size={40} weight="light" className="text-zinc-300" />
            </div>
          </div>
          
          <div className="stat-card" data-testid="stat-pricelists">
            <div className="flex items-center justify-between">
              <div>
                <div className="stat-card-value">{stats.price_lists}</div>
                <div className="stat-card-label">Price Lists</div>
              </div>
              <Files size={40} weight="light" className="text-zinc-300" />
            </div>
          </div>
          
          <div className="stat-card" data-testid="stat-products">
            <div className="flex items-center justify-between">
              <div>
                <div className="stat-card-value">{stats.products.toLocaleString()}</div>
                <div className="stat-card-label">Products</div>
              </div>
              <Package size={40} weight="light" className="text-zinc-300" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link to="/search" className="card hover:border-[#002FA7] transition-colors group" data-testid="quick-search">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#002FA7] flex items-center justify-center">
                <MagnifyingGlass size={24} weight="bold" className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-lg">Search Products</h3>
                <p className="text-sm text-zinc-500">Find the cheapest price across all vendors</p>
              </div>
              <ArrowRight size={20} className="text-zinc-400 group-hover:text-[#002FA7] transition-colors" />
            </div>
          </Link>
          
          <Link to="/upload" className="card hover:border-[#002FA7] transition-colors group" data-testid="quick-upload">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center">
                <Files size={24} weight="bold" className="text-zinc-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-lg">Upload Price List</h3>
                <p className="text-sm text-zinc-500">Import a new vendor price list</p>
              </div>
              <ArrowRight size={20} className="text-zinc-400 group-hover:text-[#002FA7] transition-colors" />
            </div>
          </Link>
        </div>

        {/* Recent Price Lists */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-lg">Recent Price Lists</h2>
            <Link to="/price-lists" className="text-sm text-[#002FA7] hover:underline">
              View All
            </Link>
          </div>
          
          {recentLists.length > 0 ? (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">File Name</th>
                  <th className="text-left">Vendor</th>
                  <th className="text-right">Products</th>
                  <th className="text-left">Upload Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLists.map((list) => (
                  <tr key={list.id}>
                    <td className="font-mono text-sm">{list.file_name}</td>
                    <td>{list.vendor_name}</td>
                    <td className="text-right font-mono">{list.product_count}</td>
                    <td className="text-zinc-500 text-sm">
                      {new Date(list.upload_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <Files size={48} className="empty-state-icon mx-auto" />
              <p className="empty-state-title">No price lists yet</p>
              <p className="text-sm">Upload your first price list to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
