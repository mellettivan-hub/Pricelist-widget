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
    sheet_name: str

class UploadWithMapping(BaseModel):
    vendor_id: str
    vendor_name: str
    file_id: str
    mapping: ColumnMapping


# Temporary storage for uploaded files awaiting column mapping
temp_files: Dict[str, bytes] = {}


def normalize_product_code(code: str) -> str:
    """Normalize product code for fuzzy matching"""
    if not code:
        return ""
    # Remove common variations: spaces, parentheses, dashes variations, suffixes
    normalized = code.upper()
    normalized = re.sub(r'[\s\(\)\-\_]+', '', normalized)  # Remove spaces, parens, dashes
    normalized = re.sub(r'OSTD|O\-STD|BLACK|WHITE', '', normalized)  # Remove common suffixes
    normalized = re.sub(r'MM$', '', normalized)  # Remove trailing MM
    return normalized


def extract_base_code(code: str) -> str:
    """Extract the base product code (e.g., DS-2CD2047G3 from DS-2CD2047G3-LIY(2.8mm))"""
    if not code:
        return ""
    # Match the main product code pattern (e.g., DS-2CD2047G3)
    match = re.match(r'(DS-?\d*[A-Z]*\d+[A-Z]*\d*)', code.upper().replace(' ', ''))
    if match:
        return match.group(1)
    return code.upper()[:15]  # Return first 15 chars as fallback


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


# Excel Preview for Column Mapping
@api_router.post("/upload/preview")
async def preview_excel(file: UploadFile = File(...)):
    """Upload Excel and return column preview for mapping"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    content = await file.read()
    file_id = str(uuid.uuid4())
    
    # Store file temporarily
    temp_files[file_id] = content
    
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        sheets_data = []
        
        for sheet_name in xl.sheet_names:
            try:
                # Read first 10 rows to preview
                df = pd.read_excel(xl, sheet_name=sheet_name, nrows=10)
                
                # Get column info
                columns = []
                for col in df.columns:
                    col_name = str(col).strip()
                    # Get sample values (first 5 non-null)
                    sample_values = df[col].dropna().head(5).tolist()
                    sample_values = [str(v)[:50] for v in sample_values]  # Truncate long values
                    
                    columns.append({
                        "name": col_name,
                        "samples": sample_values
                    })
                
                if columns:
                    sheets_data.append({
                        "sheet_name": sheet_name,
                        "columns": columns,
                        "row_count": len(df)
                    })
            except Exception as e:
                logging.warning(f"Error reading sheet {sheet_name}: {e}")
                continue
        
        return {
            "file_id": file_id,
            "file_name": file.filename,
            "sheets": sheets_data
        }
        
    except Exception as e:
        logging.error(f"Error parsing Excel: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")


# Upload with manual column mapping
@api_router.post("/upload/mapped")
async def upload_with_mapping(data: UploadWithMapping):
    """Process upload with user-specified column mapping"""
    file_id = data.file_id
    
    if file_id not in temp_files:
        raise HTTPException(status_code=400, detail="File not found. Please upload again.")
    
    content = temp_files[file_id]
    price_list_id = str(uuid.uuid4())
    
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        df = pd.read_excel(xl, sheet_name=data.mapping.sheet_name)
        
        products = []
        
        for idx, row in df.iterrows():
            try:
                # Get values using mapped columns
                product_code = str(row.get(data.mapping.product_code_col, '')).strip()
                
                if data.mapping.description_col:
                    description = str(row.get(data.mapping.description_col, '')).strip()
                else:
                    description = product_code
                
                price_val = row.get(data.mapping.price_col)
                
                # Skip invalid rows
                if not product_code or product_code.lower() in ['nan', 'none', '']:
                    continue
                
                if pd.isna(price_val):
                    continue
                
                try:
                    price = float(str(price_val).replace(',', '').replace('R', '').replace(' ', ''))
                    if price <= 0:
                        continue
                except:
                    continue
                
                # Clean description
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
                    'category': data.mapping.sheet_name,
                    'upload_date': datetime.now(timezone.utc).isoformat()
                }
                products.append(product)
                
            except Exception as e:
                logging.warning(f"Error parsing row {idx}: {e}")
                continue
        
        if not products:
            raise HTTPException(status_code=400, detail="No valid products found with the specified columns")
        
        # Create price list record
        price_list = {
            'id': price_list_id,
            'vendor_id': data.vendor_id,
            'vendor_name': data.vendor_name,
            'file_name': f"mapped_upload_{price_list_id[:8]}.xlsx",
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
        del temp_files[file_id]
        
        return {
            "message": "Price list uploaded successfully",
            "price_list_id": price_list_id,
            "products_imported": len(products)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing mapped upload: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")


# Legacy upload (auto-detect) - keep for backward compatibility
@api_router.post("/upload")
async def upload_price_list(
    file: UploadFile = File(...),
    vendor_id: str = Query(...),
    vendor_name: str = Query(...)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    content = await file.read()
    price_list_id = str(uuid.uuid4())
    
    # Parse the Excel file (auto-detect)
    products = parse_excel_file_auto(content, file.filename, vendor_id, vendor_name, price_list_id)
    
    if not products:
        raise HTTPException(status_code=400, detail="No valid products found. Try using column mapping.")
    
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
    
    if products:
        await db.products.insert_many(products)
        
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
    
    return {
        "message": "Price list uploaded successfully",
        "price_list_id": price_list_id,
        "products_imported": len(products)
    }


def parse_excel_file_auto(file_content: bytes, file_name: str, vendor_id: str, vendor_name: str, price_list_id: str) -> List[dict]:
    """Auto-detect columns and parse Excel file"""
    products = []
    
    try:
        xl = pd.ExcelFile(io.BytesIO(file_content))
        
        for sheet_name in xl.sheet_names:
            try:
                skip_sheets = ['home page', 'index', 'services', 'notes', 'co. details', 'co. details ', 'quote', 'in stock pricelist']
                if sheet_name.lower().strip() in skip_sheets:
                    continue
                
                df_raw = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=15)
                
                header_row = None
                for idx, row in df_raw.iterrows():
                    row_str = ' '.join([str(v).lower() for v in row.values if pd.notna(v)])
                    if any(term in row_str for term in ['product code', 'product name', 'sensor product', 'sap code', 'description']):
                        header_row = idx
                        break
                
                if header_row is None:
                    header_row = 0
                
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row)
                df.columns = [str(col).strip().lower() for col in df.columns]
                
                code_col = None
                desc_col = None
                price_col = None
                
                for col in df.columns:
                    col_lower = col.lower()
                    if code_col is None and any(x in col_lower for x in ['sensor product code', 'product name', 'sap code', 'product code', 'model']):
                        code_col = col
                    if desc_col is None and 'description' in col_lower:
                        desc_col = col
                    if any(x in col_lower for x in ['sub-d', 'unit price']):
                        price_col = col
                    elif price_col is None and any(x in col_lower for x in ['price', 'retail', 'cost']):
                        price_col = col
                
                if not code_col or not price_col:
                    continue
                
                for idx, row in df.iterrows():
                    try:
                        product_code = str(row.get(code_col, '')).strip() if pd.notna(row.get(code_col)) else ''
                        description = str(row.get(desc_col, '')).strip() if desc_col and pd.notna(row.get(desc_col)) else ''
                        price_val = row.get(price_col)
                        
                        if not product_code or product_code.lower() in ['nan', 'none', '']:
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
                        
                    except Exception as e:
                        continue
                        
            except Exception as e:
                continue
                
    except Exception as e:
        logging.error(f"Error parsing Excel file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    
    return products


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
    fuzzy: bool = Query(False, description="Enable fuzzy matching for product codes")
):
    """Search products with optional fuzzy matching"""
    
    if fuzzy:
        # Fuzzy search - find similar product codes
        return await fuzzy_search(q)
    else:
        # Regular regex search
        query_regex = {"$regex": q, "$options": "i"}
        filter_query = {"$or": [{"product_code": query_regex}, {"description": query_regex}]}
        
        products = await db.products.find(filter_query, {"_id": 0}).to_list(500)
        
        products.sort(key=lambda x: x.get('price', float('inf')))
        
        if products:
            min_price = products[0]['price']
            for p in products:
                p['is_cheapest'] = p['price'] == min_price
        
        return {"results": products, "count": len(products)}


async def fuzzy_search(query: str):
    """Perform fuzzy search on product codes"""
    
    # Normalize the search query
    query_normalized = normalize_product_code(query)
    query_base = extract_base_code(query)
    
    # Get all products
    all_products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    if not all_products:
        return {"results": [], "count": 0}
    
    # Score each product
    scored_products = []
    for product in all_products:
        # Calculate similarity scores
        code = product.get('product_code', '')
        code_normalized = product.get('product_code_normalized', normalize_product_code(code))
        code_base = product.get('product_code_base', extract_base_code(code))
        
        # Multiple matching strategies
        score1 = fuzz.ratio(query_normalized, code_normalized)  # Full normalized match
        score2 = fuzz.ratio(query_base, code_base)  # Base code match
        score3 = fuzz.partial_ratio(query.upper(), code.upper())  # Partial match
        score4 = fuzz.token_sort_ratio(query.upper(), code.upper())  # Token match
        
        # Weighted score
        final_score = max(score1, score2) * 0.5 + score3 * 0.3 + score4 * 0.2
        
        # Also check description
        desc_score = fuzz.partial_ratio(query.upper(), product.get('description', '').upper())
        if desc_score > final_score:
            final_score = desc_score * 0.8  # Slightly lower weight for description matches
        
        if final_score >= 50:  # Threshold
            product['match_score'] = round(final_score, 1)
            scored_products.append(product)
    
    # Sort by match score (highest first), then by price (lowest first)
    scored_products.sort(key=lambda x: (-x.get('match_score', 0), x.get('price', float('inf'))))
    
    # Take top 100 results
    results = scored_products[:100]
    
    # Mark cheapest among top matches
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
