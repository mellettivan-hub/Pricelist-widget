import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { UploadSimple, FileXls, X, Check, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Upload = () => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${API}/vendors`);
      setVendors(response.data);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.xlsx') && 
        !selectedFile.name.endsWith('.xls')) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    
    setFile(selectedFile);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    
    if (!selectedVendor) {
      toast.error("Please select a vendor");
      return;
    }

    const vendor = vendors.find(v => v.id === selectedVendor);
    if (!vendor) {
      toast.error("Invalid vendor selected");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${API}/upload?vendor_id=${selectedVendor}&vendor_name=${encodeURIComponent(vendor.name)}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      setUploadResult({
        success: true,
        message: response.data.message,
        products: response.data.products_imported
      });
      
      toast.success(`Successfully imported ${response.data.products_imported} products`);
      setFile(null);
      
    } catch (error) {
      console.error("Upload failed:", error);
      const errorMessage = error.response?.data?.detail || "Upload failed";
      setUploadResult({
        success: false,
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div data-testid="upload-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Upload Price List</h1>
        <p className="page-subtitle">Import vendor price lists from Excel files</p>
      </div>

      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          {/* Vendor Selection */}
          <div className="card mb-6">
            <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
              Select Vendor
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="search-input w-full"
              data-testid="vendor-select"
            >
              <option value="">-- Choose a vendor --</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            
            {vendors.length === 0 && (
              <p className="text-sm text-zinc-500 mt-2">
                No vendors found. Please add a vendor first.
              </p>
            )}
          </div>

          {/* File Upload Zone */}
          <div className="card mb-6">
            <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
              Price List File
            </label>
            
            <div
              className={`dropzone ${dragActive ? "active" : ""} ${file ? "border-green-500 bg-green-50" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="file-input"
              />
              
              {file ? (
                <div className="flex items-center gap-4">
                  <FileXls size={40} weight="light" className="text-green-600" />
                  <div className="flex-1 text-left">
                    <p className="font-mono text-sm font-semibold">{file.name}</p>
                    <p className="text-xs text-zinc-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="p-2 hover:bg-zinc-100"
                    data-testid="clear-file"
                  >
                    <X size={20} className="text-zinc-500" />
                  </button>
                </div>
              ) : (
                <>
                  <UploadSimple size={40} weight="light" className="text-zinc-400 mx-auto mb-4" />
                  <p className="font-mono text-sm text-zinc-600">
                    DROP EXCEL FILE HERE
                  </p>
                  <p className="text-xs text-zinc-400 mt-2">
                    or click to browse (.xlsx, .xls)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div 
              className={`card mb-6 ${uploadResult.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}
              data-testid="upload-result"
            >
              <div className="flex items-start gap-3">
                {uploadResult.success ? (
                  <Check size={24} weight="bold" className="text-green-600 flex-shrink-0" />
                ) : (
                  <Warning size={24} weight="bold" className="text-red-600 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-semibold ${uploadResult.success ? "text-green-700" : "text-red-700"}`}>
                    {uploadResult.message}
                  </p>
                  {uploadResult.products && (
                    <p className="text-sm text-green-600 mt-1">
                      {uploadResult.products} products imported successfully
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || !selectedVendor || uploading}
            className="btn-primary w-full flex items-center justify-center gap-2"
            data-testid="upload-button"
          >
            {uploading ? (
              <span className="font-mono">UPLOADING...</span>
            ) : (
              <>
                <UploadSimple size={20} weight="bold" />
                Upload Price List
              </>
            )}
          </button>

          {/* Format Info */}
          <div className="mt-8 p-4 bg-zinc-100 border border-zinc-200">
            <h3 className="font-heading font-bold text-sm mb-2">SUPPORTED FORMATS</h3>
            <ul className="text-xs text-zinc-600 space-y-1 font-mono">
              <li>+ HIKVISION SA Reseller Price Guide format</li>
              <li>+ Sensor Security Systems format</li>
              <li>+ Generic Excel with columns: Product Code, Description, Price</li>
            </ul>
            <p className="text-xs text-zinc-500 mt-3">
              The system will automatically detect the file format and extract product data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
