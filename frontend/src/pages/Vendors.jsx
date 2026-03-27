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
    if (!window.confirm(`Delete "${vendorName}"? This will also delete all associated price lists and products.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/vendors/${vendorId}`);
      setVendors(vendors.filter(v => v.id !== vendorId));
      toast.success("Vendor deleted");
    } catch (error) {
      console.error("Failed to delete vendor:", error);
      toast.error("Failed to delete vendor");
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
    </div>
  );
};

export default Vendors;
