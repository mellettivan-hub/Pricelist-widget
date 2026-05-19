import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash, Storefront } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newVendor, setNewVendor] = useState({ name: "", contact_email: "", contact_phone: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {id, name}
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${API}/vendors`);
      setVendors(response.data);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVendor = async () => {
    if (!newVendor.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API}/vendors`, newVendor);
      setVendors([...vendors, response.data]);
      setNewVendor({ name: "", contact_email: "", contact_phone: "" });
      setDialogOpen(false);
      toast.success("Vendor added successfully");
    } catch (error) {
      console.error("Failed to add vendor:", error);
      toast.error("Failed to add vendor");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (vendorId, vendorName) => {
    setDeleteConfirm({ id: vendorId, name: vendorName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${API}/vendors/${deleteConfirm.id}`);
      setVendors(vendors.filter(v => v.id !== deleteConfirm.id));
      toast.success("Vendor deleted successfully");
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete vendor:", error);
      toast.error("Failed to delete vendor");
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
    <div data-testid="vendors-page">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">Manage your vendor list</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="btn-primary flex items-center gap-2" data-testid="add-vendor-btn">
              <Plus size={18} weight="bold" />
              Add Vendor
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Add New Vendor</DialogTitle>
              <DialogDescription>
                Add a new vendor to upload price lists from.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="search-input w-full"
                  placeholder="e.g., Sensor Security, HIKVISION SA"
                  data-testid="vendor-name-input"
                />
              </div>
              
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={newVendor.contact_email}
                  onChange={(e) => setNewVendor({ ...newVendor, contact_email: e.target.value })}
                  className="search-input w-full"
                  placeholder="vendor@email.com"
                  data-testid="vendor-email-input"
                />
              </div>
              
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={newVendor.contact_phone}
                  onChange={(e) => setNewVendor({ ...newVendor, contact_phone: e.target.value })}
                  className="search-input w-full"
                  placeholder="+27 11 123 4567"
                  data-testid="vendor-phone-input"
                />
              </div>
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <button className="btn-secondary">Cancel</button>
              </DialogClose>
              <button 
                onClick={handleAddVendor} 
                disabled={saving}
                className="btn-primary"
                data-testid="save-vendor-btn"
              >
                {saving ? "Saving..." : "Add Vendor"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-6">
        {vendors.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="w-full data-table" data-testid="vendors-table">
              <thead>
                <tr>
                  <th className="text-left">Vendor Name</th>
                  <th className="text-left">Contact Email</th>
                  <th className="text-left">Contact Phone</th>
                  <th className="text-left">Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} data-testid="vendor-row">
                    <td>
                      <div className="flex items-center gap-2">
                        <Storefront size={18} className="text-zinc-400" />
                        <span className="font-semibold">{vendor.name}</span>
                      </div>
                    </td>
                    <td className="text-zinc-600">{vendor.contact_email || "-"}</td>
                    <td className="text-zinc-600">{vendor.contact_phone || "-"}</td>
                    <td className="text-zinc-500 text-sm">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                        className="p-2 text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete vendor"
                        data-testid="delete-vendor-btn"
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
              <Storefront size={48} className="empty-state-icon mx-auto" />
              <p className="empty-state-title">No vendors yet</p>
              <p className="text-sm mb-4">Add your first vendor to start uploading price lists</p>
              <button 
                onClick={() => setDialogOpen(true)}
                className="btn-primary"
              >
                Add Your First Vendor
              </button>
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
              <h3 className="text-lg font-semibold text-gray-900">Delete Vendor?</h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will also delete all associated price lists and products. This action cannot be undone.
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

export default Vendors;
