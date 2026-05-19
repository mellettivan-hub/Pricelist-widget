import { useState, useEffect } from "react";
import axios from "axios";
import { Files, Trash, FileXls } from "@phosphor-icons/react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PriceLists = () => {
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {id, fileName}
  const [deleting, setDeleting] = useState(false);

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
