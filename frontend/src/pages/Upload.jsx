import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { UploadSimple, FileXls, Check, Warning, ArrowRight, Table, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Upload = () => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);
  
  // Column mapping state
  const [previewData, setPreviewData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    product_code_col: "",
    description_col: "",
    price_col: ""
  });
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 3: Done

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

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    
    setFile(selectedFile);
    setUploadResult(null);
    setStep(1);
    setPreviewData(null);
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    
    if (!selectedVendor) {
      toast.error("Please select a vendor");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API}/upload/preview`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setPreviewData(response.data);
      setStep(2);
      toast.success(`Found ${response.data.total_sheets} sheets to import`);
      
    } catch (error) {
      console.error("Preview failed:", error);
      toast.error(error.response?.data?.detail || "Failed to preview file");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadMapped = async () => {
    if (!columnMapping.product_code_col || !columnMapping.price_col) {
      toast.error("Please select Product Code and Price columns");
      return;
    }

    const vendor = vendors.find(v => v.id === selectedVendor);
    if (!vendor) {
      toast.error("Invalid vendor");
      return;
    }

    setUploading(true);

    try {
      const response = await axios.post(`${API}/upload/mapped`, {
        vendor_id: selectedVendor,
        vendor_name: vendor.name,
        file_id: previewData.file_id,
        mapping: {
          product_code_col: columnMapping.product_code_col,
          description_col: columnMapping.description_col || null,
          price_col: columnMapping.price_col
        }
      });

      setUploadResult({
        success: true,
        message: response.data.message,
        products: response.data.products_imported,
        sheets: response.data.sheets_processed
      });
      
      toast.success(`Successfully imported ${response.data.products_imported} products from ${response.data.sheets_processed.length} sheets`);
      setStep(3);
      
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setPreviewData(null);
    setUploadResult(null);
    setStep(1);
    setColumnMapping({ product_code_col: "", description_col: "", price_col: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div data-testid="upload-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Upload Price List</h1>
        <p className="page-subtitle">Import ALL sheets from vendor price lists</p>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-zinc-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-zinc-200'}`}>1</div>
              <span className="ml-2 font-medium">Upload</span>
            </div>
            <ArrowRight size={20} className="mx-4 text-zinc-300" />
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-zinc-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-zinc-200'}`}>2</div>
              <span className="ml-2 font-medium">Map Columns</span>
            </div>
            <ArrowRight size={20} className="mx-4 text-zinc-300" />
            <div className={`flex items-center ${step >= 3 ? 'text-green-600' : 'text-zinc-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-green-600 text-white' : 'bg-zinc-200'}`}>3</div>
              <span className="ml-2 font-medium">Done</span>
            </div>
          </div>

          {/* Step 1: Select File & Vendor */}
          {step === 1 && (
            <>
              <div className="card mb-6">
                <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                  1. Select Vendor
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:border-blue-600"
                  data-testid="vendor-select"
                >
                  <option value="">-- Choose a vendor --</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="card mb-6">
                <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                  2. Select Excel File
                </label>
                
                <div 
                  className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${file ? 'border-green-500 bg-green-50' : 'border-zinc-300 hover:border-blue-500'}`}
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
                    <div className="flex items-center justify-center gap-4">
                      <FileXls size={40} weight="light" className="text-green-600" />
                      <div className="text-left">
                        <p className="font-mono text-sm font-semibold">{file.name}</p>
                        <p className="text-xs text-zinc-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <UploadSimple size={40} className="text-zinc-400 mx-auto mb-4" />
                      <p className="font-medium text-zinc-600">Click to select Excel file</p>
                      <p className="text-xs text-zinc-400 mt-2">(.xlsx, .xls)</p>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handlePreview}
                disabled={!file || !selectedVendor || uploading}
                className="btn-primary w-full flex items-center justify-center gap-2"
                data-testid="preview-button"
              >
                {uploading ? "Loading..." : "Next: Map Columns"}
                <ArrowRight size={20} />
              </button>
            </>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && previewData && (
            <>
              <div className="card mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Table size={24} className="text-blue-600" />
                  <h2 className="font-bold text-lg">Map Your Columns</h2>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Found {previewData.total_sheets} sheets</strong> in this file. 
                    Select the column names once - we'll apply this mapping to ALL sheets automatically.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewData.sheets.slice(0, 10).map((sheet, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1">
                        {sheet.sheet_name}
                      </span>
                    ))}
                    {previewData.sheets.length > 10 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1">
                        +{previewData.sheets.length - 10} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Column Mapping */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                      Product Code Column *
                    </label>
                    <select
                      value={columnMapping.product_code_col}
                      onChange={(e) => setColumnMapping({...columnMapping, product_code_col: e.target.value})}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm"
                      data-testid="product-code-col"
                    >
                      <option value="">-- Select --</option>
                      {previewData.columns?.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                      Description Column
                    </label>
                    <select
                      value={columnMapping.description_col}
                      onChange={(e) => setColumnMapping({...columnMapping, description_col: e.target.value})}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm"
                      data-testid="description-col"
                    >
                      <option value="">-- Optional --</option>
                      {previewData.columns?.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 block">
                      Price Column *
                    </label>
                    <select
                      value={columnMapping.price_col}
                      onChange={(e) => setColumnMapping({...columnMapping, price_col: e.target.value})}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm"
                      data-testid="price-col"
                    >
                      <option value="">-- Select --</option>
                      {previewData.columns?.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Column Preview */}
                {previewData.columns && previewData.columns.length > 0 && (
                  <div className="bg-zinc-50 border border-zinc-200 p-4 overflow-x-auto">
                    <p className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-3">
                      Sample Data Preview
                    </p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-300">
                          {previewData.columns.map((col) => (
                            <th key={col.name} className="text-left py-2 px-2 font-semibold text-zinc-700">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2].map((rowIdx) => (
                          <tr key={rowIdx} className="border-b border-zinc-200">
                            {previewData.columns.map((col) => (
                              <td key={col.name} className="py-2 px-2 text-zinc-600 font-mono text-xs">
                                {col.samples[rowIdx] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={resetUpload}
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleUploadMapped}
                  disabled={!columnMapping.product_code_col || !columnMapping.price_col || uploading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  data-testid="upload-button"
                >
                  {uploading ? "Importing from all sheets..." : "Import All Products"}
                  <Check size={20} />
                </button>
              </div>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && uploadResult && (
            <div className="card">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={40} weight="fill" className="text-green-600" />
                </div>
                <h2 className="font-bold text-xl mb-2">Upload Successful!</h2>
                <p className="text-zinc-600 mb-6">
                  Imported <strong>{uploadResult.products}</strong> products from <strong>{uploadResult.sheets?.length || 0}</strong> sheets
                </p>
              </div>
              
              {/* Sheets breakdown */}
              {uploadResult.sheets && uploadResult.sheets.length > 0 && (
                <div className="border-t border-zinc-200 pt-4 mb-6">
                  <p className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-3">
                    Import Summary
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200">
                          <th className="text-left py-2">Sheet</th>
                          <th className="text-right py-2">Products</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.sheets.map((sheet, idx) => (
                          <tr key={idx} className="border-b border-zinc-100">
                            <td className="py-2">{sheet.sheet}</td>
                            <td className="text-right font-mono">{sheet.products}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <button
                onClick={resetUpload}
                className="btn-primary w-full"
              >
                Upload Another File
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Upload;
