import { useState, useEffect } from "react";
import axios from "axios";
import { Files, Trash, FileXls } from "@phosphor-icons/react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PriceLists = () => {
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (!window.confirm(`Delete "${fileName}"? This will also remove all products from this price list.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/price-lists/${priceListId}`);
      setPriceLists(priceLists.filter(p => p.id !== priceListId));
      toast.success("Price list deleted");
    } catch (error) {
      console.error("Failed to delete price list:", error);
      toast.error("Failed to delete price list");
    }
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
    </div>
  );
};

export default PriceLists;
