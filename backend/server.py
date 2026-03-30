from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import pandas as pd
import io
import re
from rapidfuzz import fuzz, process

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Vendor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VendorCreate(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class PriceList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    vendor_name: str
    file_name: str
    upload_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    product_count: int = 0
    status: str = "active"

class ColumnMapping(BaseModel):
    product_code_col: str
    description_col: Optional[str] = None
    price_col: str

class ColumnMappingMulti(BaseModel):
    product_code_cols: List[str]
    description_cols: List[str] = []
    price_cols: List[str]

class UploadWithMapping(BaseModel):
    vendor_id: str
    vendor_name: str
    file_id: str
    mapping: ColumnMapping

class UploadWithMappingMulti(BaseModel):
    vendor_id: str
    vendor_name: str
    file_id: str
    mapping: ColumnMappingMulti


# Use MongoDB for temporary file storage instead of memory
async def store_temp_file(file_id: str, content: bytes, filename: str):
    """Store file temporarily in MongoDB"""
    import base64
    await db.temp_files.delete_many({"file_id": file_id})  # Clean any existing
    await db.temp_files.insert_one({
        "file_id": file_id,
        "content": base64.b64encode(content).decode('utf-8'),
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

async def get_temp_file(file_id: str) -> Optional[bytes]:
    """Retrieve temporary file from MongoDB"""
    import base64
    doc = await db.temp_files.find_one({"file_id": file_id})
    if doc:
        return base64.b64decode(doc["content"])
    return None

async def delete_temp_file(file_id: str):
    """Delete temporary file from MongoDB"""
    await db.temp_files.delete_one({"file_id": file_id})


def normalize_product_code(code: str) -> str:
    """Normalize product code for fuzzy matching"""
    if not code:
        return ""
    normalized = code.upper()
    normalized = re.sub(r'[\s\(\)\-\_]+', '', normalized)
    normalized = re.sub(r'OSTD|O\-STD|BLACK|WHITE', '', normalized)
    normalized = re.sub(r'MM$', '', normalized)
    return normalized


def extract_base_code(code: str) -> str:
    """Extract the base product code"""
    if not code:
        return ""
    match = re.match(r'(DS-?\d*[A-Z]*\d+[A-Z]*\d*)', code.upper().replace(' ', ''))
    if match:
        return match.group(1)
    return code.upper()[:15]


def detect_columns(df):
    """Auto-detect product code, description, and price columns"""
    df.columns = [str(col).strip() for col in df.columns]
    columns_lower = {col: col.lower() for col in df.columns}
    
    code_col = None
    desc_col = None
    price_col = None
    
    for col, col_lower in columns_lower.items():
        # Product code detection - expanded keywords
        if code_col is None:
            if any(x in col_lower for x in ['product code', 'product name', 'sap code', 'sensor product', 
                                             'model', 'sku', 'item code', 'part number', 'part no',
                                             'ef code', 'article', 'item no', 'stock code']):
                code_col = col
        
        # Description detection
        if desc_col is None:
            if 'description' in col_lower or 'desc' in col_lower:
                desc_col = col
        
        # Price detection - prefer selling price columns
        if any(x in col_lower for x in ['suggested selling', 'selling price', 'sell price', 
                                         'sub-d', 'sub d', 'unit price', 'dealer price', 'reseller']):
            price_col = col
        elif price_col is None and any(x in col_lower for x in ['price', 'amount', 'cost', 'retail']):
            price_col = col
    
    # Fallback: try to find numeric column that looks like price
    if price_col is None:
        for col in df.columns:
            col_lower = col.lower()
            if 'unnamed' in col_lower:
                continue  # Skip unnamed columns for price detection
            try:
                numeric_vals = pd.to_numeric(df[col], errors='coerce')
                valid_count = numeric_vals.notna().sum()
                if valid_count > 3:
                    mean_val = numeric_vals.mean()
                    if 10 < mean_val < 1000000:  # Reasonable price range
                        price_col = col
                        break
            except:
                continue
    
    return code_col, desc_col, price_col


# Routes
@api_router.get("/")
async def root():
    return {"message": "Price Check API"}


# Vendor Routes
@api_router.post("/vendors", response_model=Vendor)
async def create_vendor(vendor: VendorCreate):
    vendor_obj = Vendor(**vendor.model_dump())
    doc = vendor_obj.model_dump()
    await db.vendors.insert_one(doc)
    return vendor_obj


@api_router.get("/vendors", response_model=List[Vendor])
async def get_vendors():
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    return vendors


@api_router.get("/vendors/{vendor_id}", response_model=Vendor)
async def get_vendor(vendor_id: str):
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@api_router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str):
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await db.price_lists.delete_many({"vendor_id": vendor_id})
    await db.products.delete_many({"vendor_id": vendor_id})
    return {"message": "Vendor deleted"}


# Helper function to find the actual header row
def find_header_row(xl, sheet_name, max_rows=20):
    """Find the row that contains actual column headers"""
    df_raw = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=max_rows)
    
    # Keywords that indicate a header row
    header_keywords = ['code', 'product', 'description', 'price', 'model', 'sku', 
                       'item', 'name', 'cost', 'selling', 'retail', 'dealer']
    
    best_row = 0
    best_score = 0
    
    for idx, row in df_raw.iterrows():
        row_str = ' '.join([str(v).lower() for v in row.values if pd.notna(v)])
        score = sum(1 for kw in header_keywords if kw in row_str)
        
        # Check if row has multiple non-empty string values (likely headers)
        non_empty_strs = sum(1 for v in row.values if pd.notna(v) and isinstance(v, str) and len(str(v)) > 2)
        score += non_empty_strs * 0.5
        
        if score > best_score:
            best_score = score
            best_row = idx
    
    return best_row if best_score >= 2 else 0


# Excel Preview for Column Mapping
@api_router.post("/upload/preview")
async def preview_excel(file: UploadFile = File(...)):
    """Upload Excel and return column preview for mapping"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    content = await file.read()
    file_id = str(uuid.uuid4())
    
    # Store file in MongoDB (persistent)
    await store_temp_file(file_id, content, file.filename)
    
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        sheets_info = []
        all_columns = set()
        
        # Skip known non-product sheets
        skip_sheets = ['home page', 'index', 'services', 'notes', 'co. details', 'quote', 'in stock pricelist', 'contents']
        
        for sheet_name in xl.sheet_names:
            if sheet_name.lower().strip() in skip_sheets:
                continue
            try:
                # Find the actual header row
                header_row = find_header_row(xl, sheet_name)
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row, nrows=100)
                if len(df) > 0:
                    sheets_info.append({
                        "sheet_name": sheet_name,
                        "row_count": len(df)
                    })
                    for col in df.columns:
                        all_columns.add(str(col).strip())
            except:
                continue
        
        # Collect ALL unique columns from ALL sheets (not just the first one)
        all_unique_columns = {}  # column_name -> sample values
        
        for sheet_name in xl.sheet_names:
            if sheet_name.lower().strip() in skip_sheets:
                continue
            try:
                header_row = find_header_row(xl, sheet_name)
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row, nrows=5)
                for col in df.columns:
                    col_name = str(col).strip()
                    # Skip unnamed columns
                    if 'unnamed' in col_name.lower():
                        continue
                    # Only add if we haven't seen this column yet
                    if col_name not in all_unique_columns:
                        sample_values = df[col].dropna().head(3).tolist()
                        sample_values = [str(v)[:50] for v in sample_values]
                        all_unique_columns[col_name] = sample_values
            except:
                continue
        
        # Convert to list format
        sample_columns = [{"name": name, "samples": samples} for name, samples in all_unique_columns.items()]
        
        return {
            "file_id": file_id,
            "file_name": file.filename,
            "sheets": sheets_info,
            "total_sheets": len(sheets_info),
            "columns": sample_columns
        }
        
    except Exception as e:
        logging.error(f"Error parsing Excel: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")


# Upload with manual column mapping - imports ALL sheets
@api_router.post("/upload/mapped")
async def upload_with_mapping(data: UploadWithMapping):
    """Process upload with user-specified column mapping - imports from ALL sheets"""
    file_id = data.file_id
    
    # Get file from MongoDB
    content = await get_temp_file(file_id)
    if not content:
        raise HTTPException(status_code=400, detail="File not found. Please upload again.")
    
    price_list_id = str(uuid.uuid4())
    
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        products = []
        sheets_processed = []
        
        # Skip known non-product sheets
        skip_sheets = ['home page', 'index', 'services', 'notes', 'co. details', 'quote', 'in stock pricelist', 'contents']
        
        for sheet_name in xl.sheet_names:
            if sheet_name.lower().strip() in skip_sheets:
                continue
                
            try:
                # Find actual header row for this sheet
                header_row = find_header_row(xl, sheet_name)
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row)
                df.columns = [str(col).strip() for col in df.columns]
                
                # Check if mapped columns exist in this sheet
                code_col = None
                desc_col = None
                price_col = None
                
                for col in df.columns:
                    col_lower = col.lower()
                    mapped_code_lower = data.mapping.product_code_col.lower()
                    mapped_price_lower = data.mapping.price_col.lower()
                    
                    # Match columns (flexible matching)
                    if mapped_code_lower in col_lower or col_lower in mapped_code_lower:
                        code_col = col
                    if data.mapping.description_col:
                        mapped_desc_lower = data.mapping.description_col.lower()
                        if mapped_desc_lower in col_lower or col_lower in mapped_desc_lower:
                            desc_col = col
                    if mapped_price_lower in col_lower or col_lower in mapped_price_lower:
                        price_col = col
                
                # If exact match not found, try auto-detect for this sheet
                if not code_col or not price_col:
                    auto_code, auto_desc, auto_price = detect_columns(df)
                    if not code_col:
                        code_col = auto_code
                    if not desc_col:
                        desc_col = auto_desc
                    if not price_col:
                        price_col = auto_price
                
                if not code_col or not price_col:
                    continue
                
                sheet_count = 0
                for idx, row in df.iterrows():
                    try:
                        product_code = str(row.get(code_col, '')).strip() if pd.notna(row.get(code_col)) else ''
                        
                        if desc_col:
                            description = str(row.get(desc_col, '')).strip() if pd.notna(row.get(desc_col)) else ''
                        else:
                            description = product_code
                        
                        price_val = row.get(price_col)
                        
                        # Skip invalid rows
                        if not product_code or product_code.lower() in ['nan', 'none', '']:
                            continue
                        
                        # Skip header-like rows
                        if any(x in product_code.lower() for x in ['product', 'code', 'name', 'model', 'sku', 'description']):
                            continue
                        
                        if pd.isna(price_val):
                            continue
                        
                        try:
                            price = float(str(price_val).replace(',', '').replace('R', '').replace(' ', ''))
                            if price <= 0 or price > 10000000:
                                continue
                        except:
                            continue
                        
                        if not description or description.lower() in ['nan', 'none']:
                            description = product_code
                        
                        product = {
                            'id': str(uuid.uuid4()),
                            'product_code': product_code,
                            'product_code_normalized': normalize_product_code(product_code),
                            'product_code_base': extract_base_code(product_code),
                            'description': description,
                            'price': round(price, 2),
                            'vendor_id': data.vendor_id,
                            'vendor_name': data.vendor_name,
                            'price_list_id': price_list_id,
                            'category': sheet_name,
                            'upload_date': datetime.now(timezone.utc).isoformat()
                        }
                        products.append(product)
                        sheet_count += 1
                        
                    except Exception as e:
                        continue
                
                if sheet_count > 0:
                    sheets_processed.append({"sheet": sheet_name, "products": sheet_count})
                        
            except Exception as e:
                logging.warning(f"Error processing sheet {sheet_name}: {e}")
                continue
        
        if not products:
            raise HTTPException(status_code=400, detail="No valid products found in any sheet")
        
        # Create price list record
        price_list = {
            'id': price_list_id,
            'vendor_id': data.vendor_id,
            'vendor_name': data.vendor_name,
            'file_name': f"upload_{price_list_id[:8]}.xlsx",
            'upload_date': datetime.now(timezone.utc).isoformat(),
            'product_count': len(products),
            'status': 'active'
        }
        
        await db.price_lists.insert_one(price_list)
        await db.products.insert_many(products)
        
        # Record price history
        history_records = []
        for p in products:
            history_records.append({
                'id': str(uuid.uuid4()),
                'product_code': p['product_code'],
                'description': p['description'],
                'price': p['price'],
                'vendor_id': p['vendor_id'],
                'vendor_name': p['vendor_name'],
                'recorded_at': datetime.now(timezone.utc).isoformat()
            })
        await db.price_history.insert_many(history_records)
        
        # Clean up temp file
        await delete_temp_file(file_id)
        
        return {
            "message": "Price list uploaded successfully",
            "price_list_id": price_list_id,
            "products_imported": len(products),
            "sheets_processed": sheets_processed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing mapped upload: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")



# Upload with MULTIPLE column selections - imports ALL sheets
@api_router.post("/upload/mapped-multi")
async def upload_with_mapping_multi(data: UploadWithMappingMulti):
    """Process upload with multiple column selections - imports from ALL sheets"""
    file_id = data.file_id
    
    # Get file from MongoDB
    content = await get_temp_file(file_id)
    if not content:
        raise HTTPException(status_code=400, detail="File not found. Please upload again.")
    
    price_list_id = str(uuid.uuid4())
    
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        products = []
        sheets_processed = []
        
        skip_sheets = ['home page', 'index', 'services', 'notes', 'co. details', 'quote', 'in stock pricelist', 'contents']
        
        for sheet_name in xl.sheet_names:
            if sheet_name.lower().strip() in skip_sheets:
                continue
                
            try:
                # Find actual header row
                header_row = find_header_row(xl, sheet_name)
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row)
                df.columns = [str(col).strip() for col in df.columns]
                
                # Find matching columns from user's selections
                code_col = None
                desc_col = None
                price_col = None
                
                df_cols_lower = {col: col.lower() for col in df.columns}
                
                # Match product code column
                for user_col in data.mapping.product_code_cols:
                    user_col_lower = user_col.lower()
                    for df_col, df_col_lower in df_cols_lower.items():
                        if user_col_lower == df_col_lower or user_col_lower in df_col_lower or df_col_lower in user_col_lower:
                            code_col = df_col
                            break
                    if code_col:
                        break
                
                # Match description column
                for user_col in data.mapping.description_cols:
                    user_col_lower = user_col.lower()
                    for df_col, df_col_lower in df_cols_lower.items():
                        if user_col_lower == df_col_lower or user_col_lower in df_col_lower or df_col_lower in user_col_lower:
                            desc_col = df_col
                            break
                    if desc_col:
                        break
                
                # Match price column
                for user_col in data.mapping.price_cols:
                    user_col_lower = user_col.lower()
                    for df_col, df_col_lower in df_cols_lower.items():
                        if user_col_lower == df_col_lower or user_col_lower in df_col_lower or df_col_lower in user_col_lower:
                            price_col = df_col
                            break
                    if price_col:
                        break
                
                # If not found, try auto-detect
                if not code_col or not price_col:
                    auto_code, auto_desc, auto_price = detect_columns(df)
                    if not code_col:
                        code_col = auto_code
                    if not desc_col:
                        desc_col = auto_desc
                    if not price_col:
                        price_col = auto_price
                
                if not code_col or not price_col:
                    continue
                
                sheet_count = 0
                for idx, row in df.iterrows():
                    try:
                        product_code = str(row.get(code_col, '')).strip() if pd.notna(row.get(code_col)) else ''
                        
                        if desc_col:
                            description = str(row.get(desc_col, '')).strip() if pd.notna(row.get(desc_col)) else ''
                        else:
                            description = product_code
                        
                        price_val = row.get(price_col)
                        
                        if not product_code or product_code.lower() in ['nan', 'none', '']:
                            continue
                        
                        # Skip header-like rows
                        if any(x in product_code.lower() for x in ['product', 'code', 'name', 'model', 'sku', 'description', 'price']):
                            continue
                        
                        if pd.isna(price_val):
                            continue
                        
                        try:
                            price_str = str(price_val).replace(',', '').replace('R', '').replace(' ', '')
                            price = float(price_str)
                            if price <= 0 or price > 10000000:
                                continue
                        except:
                            continue
                        
                        if not description or description.lower() in ['nan', 'none']:
                            description = product_code
                        
                        product = {
                            'id': str(uuid.uuid4()),
                            'product_code': product_code,
                            'product_code_normalized': normalize_product_code(product_code),
                            'product_code_base': extract_base_code(product_code),
                            'description': description,
                            'price': round(price, 2),
                            'vendor_id': data.vendor_id,
                            'vendor_name': data.vendor_name,
                            'price_list_id': price_list_id,
                            'category': sheet_name,
                            'upload_date': datetime.now(timezone.utc).isoformat()
                        }
                        products.append(product)
                        sheet_count += 1
                        
                    except Exception as e:
                        continue
                
                if sheet_count > 0:
                    sheets_processed.append({"sheet": sheet_name, "products": sheet_count})
                        
            except Exception as e:
                logging.warning(f"Error processing sheet {sheet_name}: {e}")
                continue
        
        if not products:
            raise HTTPException(status_code=400, detail="No valid products found in any sheet")
        
        price_list = {
            'id': price_list_id,
            'vendor_id': data.vendor_id,
            'vendor_name': data.vendor_name,
            'file_name': f"upload_{price_list_id[:8]}.xlsx",
            'upload_date': datetime.now(timezone.utc).isoformat(),
            'product_count': len(products),
            'status': 'active'
        }
        
        await db.price_lists.insert_one(price_list)
        await db.products.insert_many(products)
        
        # Record price history
        history_records = [{
            'id': str(uuid.uuid4()),
            'product_code': p['product_code'],
            'description': p['description'],
            'price': p['price'],
            'vendor_id': p['vendor_id'],
            'vendor_name': p['vendor_name'],
            'recorded_at': datetime.now(timezone.utc).isoformat()
        } for p in products]
        await db.price_history.insert_many(history_records)
        
        # Clean up temp file from MongoDB
        await delete_temp_file(file_id)
        
        return {
            "message": "Price list uploaded successfully",
            "price_list_id": price_list_id,
            "products_imported": len(products),
            "sheets_processed": sheets_processed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing multi-mapped upload: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")



# Auto upload - imports ALL sheets with auto column detection
@api_router.post("/upload/auto")
async def upload_auto(
    file: UploadFile = File(...),
    vendor_id: str = Query(...),
    vendor_name: str = Query(...)
):
    """Automatically import from ALL sheets with smart column detection"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    content = await file.read()
    price_list_id = str(uuid.uuid4())
    
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        products = []
        sheets_processed = []
        
        skip_sheets = ['home page', 'index', 'services', 'notes', 'co. details', 'quote', 'in stock pricelist', 'contents']
        
        for sheet_name in xl.sheet_names:
            if sheet_name.lower().strip() in skip_sheets:
                continue
                
            try:
                # Find actual header row for this sheet
                header_row = find_header_row(xl, sheet_name)
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row)
                
                # Auto-detect columns
                code_col, desc_col, price_col = detect_columns(df)
                
                if not code_col or not price_col:
                    continue
                
                sheet_count = 0
                for idx, row in df.iterrows():
                    try:
                        product_code = str(row.get(code_col, '')).strip() if pd.notna(row.get(code_col)) else ''
                        
                        if desc_col:
                            description = str(row.get(desc_col, '')).strip() if pd.notna(row.get(desc_col)) else ''
                        else:
                            description = product_code
                        
                        price_val = row.get(price_col)
                        
                        if not product_code or product_code.lower() in ['nan', 'none', '']:
                            continue
                        
                        if any(x in product_code.lower() for x in ['product', 'code', 'name', 'model', 'sku']):
                            continue
                        
                        if pd.isna(price_val):
                            continue
                        
                        try:
                            price = float(str(price_val).replace(',', '').replace('R', '').replace(' ', ''))
                            if price <= 0 or price > 10000000:
                                continue
                        except:
                            continue
                        
                        if not description or description.lower() in ['nan', 'none']:
                            description = product_code
                        
                        product = {
                            'id': str(uuid.uuid4()),
                            'product_code': product_code,
                            'product_code_normalized': normalize_product_code(product_code),
                            'product_code_base': extract_base_code(product_code),
                            'description': description,
                            'price': round(price, 2),
                            'vendor_id': vendor_id,
                            'vendor_name': vendor_name,
                            'price_list_id': price_list_id,
                            'category': sheet_name,
                            'upload_date': datetime.now(timezone.utc).isoformat()
                        }
                        products.append(product)
                        sheet_count += 1
                        
                    except:
                        continue
                
                if sheet_count > 0:
                    sheets_processed.append({"sheet": sheet_name, "products": sheet_count})
                        
            except Exception as e:
                continue
        
        if not products:
            raise HTTPException(status_code=400, detail="No valid products found. Try manual column mapping.")
        
        price_list = {
            'id': price_list_id,
            'vendor_id': vendor_id,
            'vendor_name': vendor_name,
            'file_name': file.filename,
            'upload_date': datetime.now(timezone.utc).isoformat(),
            'product_count': len(products),
            'status': 'active'
        }
        
        await db.price_lists.insert_one(price_list)
        await db.products.insert_many(products)
        
        history_records = [{
            'id': str(uuid.uuid4()),
            'product_code': p['product_code'],
            'description': p['description'],
            'price': p['price'],
            'vendor_id': p['vendor_id'],
            'vendor_name': p['vendor_name'],
            'recorded_at': datetime.now(timezone.utc).isoformat()
        } for p in products]
        await db.price_history.insert_many(history_records)
        
        return {
            "message": "Price list uploaded successfully",
            "price_list_id": price_list_id,
            "products_imported": len(products),
            "sheets_processed": sheets_processed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed: {str(e)}")


@api_router.get("/price-lists", response_model=List[PriceList])
async def get_price_lists():
    price_lists = await db.price_lists.find({}, {"_id": 0}).to_list(1000)
    return price_lists


@api_router.delete("/price-lists/{price_list_id}")
async def delete_price_list(price_list_id: str):
    result = await db.price_lists.delete_one({"id": price_list_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Price list not found")
    await db.products.delete_many({"price_list_id": price_list_id})
    return {"message": "Price list deleted"}


# Advanced Search with Fuzzy Matching
@api_router.get("/search")
async def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    fuzzy: bool = Query(True, description="Enable fuzzy matching")
):
    """Search products with fuzzy matching"""
    
    # Normalize the search query
    query_normalized = normalize_product_code(q)
    query_base = extract_base_code(q)
    
    # Get all products
    all_products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    if not all_products:
        return {"results": [], "count": 0}
    
    # Score each product
    scored_products = []
    for product in all_products:
        code = product.get('product_code', '')
        code_normalized = product.get('product_code_normalized', normalize_product_code(code))
        code_base = product.get('product_code_base', extract_base_code(code))
        
        # Multiple matching strategies
        score1 = fuzz.ratio(query_normalized, code_normalized)
        score2 = fuzz.ratio(query_base, code_base)
        score3 = fuzz.partial_ratio(q.upper(), code.upper())
        score4 = fuzz.token_sort_ratio(q.upper(), code.upper())
        
        final_score = max(score1, score2) * 0.5 + score3 * 0.3 + score4 * 0.2
        
        # Also check description
        desc_score = fuzz.partial_ratio(q.upper(), product.get('description', '').upper())
        if desc_score > final_score:
            final_score = desc_score * 0.8
        
        if final_score >= 50:
            product['match_score'] = round(final_score, 1)
            scored_products.append(product)
    
    # Sort by match score, then by price
    scored_products.sort(key=lambda x: (-x.get('match_score', 0), x.get('price', float('inf'))))
    
    results = scored_products[:100]
    
    if results:
        min_price = min(p.get('price', float('inf')) for p in results)
        for p in results:
            p['is_cheapest'] = p['price'] == min_price
    
    return {"results": results, "count": len(results), "fuzzy": True}


# Price History Routes
@api_router.get("/price-history/{product_code}")
async def get_price_history(product_code: str):
    history = await db.price_history.find(
        {"product_code": {"$regex": product_code, "$options": "i"}},
        {"_id": 0}
    ).sort("recorded_at", -1).to_list(100)
    return {"history": history}


@api_router.get("/price-history")
async def get_all_price_history(limit: int = Query(100, le=500)):
    history = await db.price_history.find({}, {"_id": 0}).sort("recorded_at", -1).to_list(limit)
    return {"history": history}


# Dashboard Stats
@api_router.get("/stats")
async def get_stats():
    vendor_count = await db.vendors.count_documents({})
    price_list_count = await db.price_lists.count_documents({})
    product_count = await db.products.count_documents({})
    
    return {
        "vendors": vendor_count,
        "price_lists": price_list_count,
        "products": product_count
    }


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
