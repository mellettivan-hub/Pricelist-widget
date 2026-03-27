from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import pandas as pd
import io
import re

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

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_code: str
    description: str
    price: float
    vendor_id: str
    vendor_name: str
    price_list_id: str
    category: Optional[str] = None
    lens: Optional[str] = None
    upload_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PriceHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_code: str
    description: str
    price: float
    vendor_id: str
    vendor_name: str
    recorded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SearchResult(BaseModel):
    product_code: str
    description: str
    price: float
    vendor_name: str
    vendor_id: str
    category: Optional[str] = None
    is_cheapest: bool = False

# Helper function to parse Excel files
def parse_excel_file(file_content: bytes, file_name: str, vendor_id: str, vendor_name: str, price_list_id: str) -> List[dict]:
    products = []
    
    try:
        xl = pd.ExcelFile(io.BytesIO(file_content))
        
        for sheet_name in xl.sheet_names:
            try:
                # Skip non-product sheets
                skip_sheets = ['home page', 'index', 'services', 'notes', 'co. details', 'co. details ', 'quote', 'in stock pricelist']
                if sheet_name.lower().strip() in skip_sheets:
                    continue
                
                # Read without header first to find actual header row
                df_raw = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=15)
                
                # Find header row by looking for key terms
                header_row = None
                for idx, row in df_raw.iterrows():
                    row_str = ' '.join([str(v).lower() for v in row.values if pd.notna(v)])
                    if any(term in row_str for term in ['product code', 'product name', 'sensor product', 'sap code', 'description']):
                        header_row = idx
                        break
                
                if header_row is None:
                    # Try to detect based on numeric price patterns
                    for idx, row in df_raw.iterrows():
                        numeric_count = sum(1 for v in row.values if pd.notna(v) and isinstance(v, (int, float)))
                        if numeric_count >= 1:
                            # Check if previous row looks like header
                            if idx > 0:
                                prev_row = df_raw.iloc[idx-1]
                                prev_str = ' '.join([str(v).lower() for v in prev_row.values if pd.notna(v)])
                                if any(term in prev_str for term in ['price', 'sub-d', 'retail', 'unit']):
                                    header_row = idx - 1
                                    break
                
                # Default to row 0 if no header found
                if header_row is None:
                    header_row = 0
                
                # Re-read with correct header
                df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row)
                
                # Normalize column names
                df.columns = [str(col).strip().lower() for col in df.columns]
                
                # Find columns
                code_col = None
                desc_col = None
                price_col = None
                category_col = None
                lens_col = None
                
                for col in df.columns:
                    col_lower = col.lower()
                    # Product code
                    if code_col is None and any(x in col_lower for x in ['sensor product code', 'product name', 'sap code', 'product code', 'model']):
                        code_col = col
                    # Description
                    if desc_col is None and 'description' in col_lower:
                        desc_col = col
                    # Price - prefer sub-d for Sensor, unit price for Hikvision
                    if any(x in col_lower for x in ['sub-d', 'unit price']):
                        price_col = col
                    elif price_col is None and any(x in col_lower for x in ['price', 'retail', 'cost']):
                        price_col = col
                    # Category
                    if category_col is None and any(x in col_lower for x in ['series', 'category']):
                        category_col = col
                    # Lens
                    if lens_col is None and 'lens' in col_lower:
                        lens_col = col
                
                # If no price column found, try finding unnamed numeric columns
                if price_col is None:
                    for col in df.columns:
                        if 'unnamed' in col.lower():
                            try:
                                numeric_vals = pd.to_numeric(df[col], errors='coerce')
                                if numeric_vals.notna().sum() > 5 and numeric_vals.mean() > 10:
                                    price_col = col
                                    break
                            except:
                                continue
                
                if not code_col or not price_col:
                    logging.info(f"Skipping sheet {sheet_name}: code_col={code_col}, price_col={price_col}")
                    continue
                
                current_category = sheet_name  # Use sheet name as default category
                
                for idx, row in df.iterrows():
                    try:
                        product_code = str(row.get(code_col, '')).strip() if pd.notna(row.get(code_col)) else ''
                        description = str(row.get(desc_col, '')).strip() if desc_col and pd.notna(row.get(desc_col)) else ''
                        price_val = row.get(price_col)
                        
                        # Update category if found
                        if category_col and pd.notna(row.get(category_col)):
                            cat_val = str(row.get(category_col)).strip()
                            if cat_val and len(cat_val) > 2 and cat_val.lower() not in ['nan', 'none']:
                                current_category = cat_val
                        
                        # Skip if no valid product code
                        if not product_code or product_code.lower() in ['nan', 'none', '', 'series', 'category', 'supplier code']:
                            continue
                        
                        # Skip header-like rows
                        skip_terms = ['product code', 'sap code', 'sensor product', 'product name', 'series', 'supplier code', 
                                     'analogue', 'turbo camera', 'bullet camera', 'dome camera', 'nvr', 'dvr']
                        if any(x in product_code.lower() for x in skip_terms):
                            # But allow if it looks like a real product code (contains DS-, has numbers)
                            if not (re.search(r'DS-|[0-9]{6,}', product_code)):
                                continue
                        
                        # Parse price
                        if pd.isna(price_val):
                            continue
                        
                        try:
                            price_str = str(price_val).replace(',', '').replace('R', '').replace(' ', '')
                            price = float(price_str)
                            if price <= 0 or price > 10000000:  # Skip invalid prices
                                continue
                        except:
                            continue
                        
                        # Get lens info
                        lens = str(row.get(lens_col, '')).strip() if lens_col and pd.notna(row.get(lens_col)) else None
                        if lens and lens.lower() in ['nan', 'none']:
                            lens = None
                        
                        # Use product code as description if no description
                        if not description or description.lower() in ['nan', 'none']:
                            description = product_code
                        
                        product = {
                            'id': str(uuid.uuid4()),
                            'product_code': product_code,
                            'description': description,
                            'price': round(price, 2),
                            'vendor_id': vendor_id,
                            'vendor_name': vendor_name,
                            'price_list_id': price_list_id,
                            'category': current_category,
                            'lens': lens,
                            'upload_date': datetime.now(timezone.utc).isoformat()
                        }
                        products.append(product)
                        
                    except Exception as e:
                        logging.warning(f"Error parsing row {idx} in sheet {sheet_name}: {e}")
                        continue
                        
            except Exception as e:
                logging.warning(f"Error parsing sheet {sheet_name}: {e}")
                continue
                
    except Exception as e:
        logging.error(f"Error parsing Excel file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    
    logging.info(f"Parsed {len(products)} products from {file_name}")
    return products


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
    # Also delete associated price lists and products
    await db.price_lists.delete_many({"vendor_id": vendor_id})
    await db.products.delete_many({"vendor_id": vendor_id})
    return {"message": "Vendor deleted"}


# Price List Upload Routes
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
    
    # Parse the Excel file
    products = parse_excel_file(content, file.filename, vendor_id, vendor_name, price_list_id)
    
    if not products:
        raise HTTPException(status_code=400, detail="No valid products found in the Excel file")
    
    # Create price list record
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
    
    # Insert products
    if products:
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
    
    return {
        "message": "Price list uploaded successfully",
        "price_list_id": price_list_id,
        "products_imported": len(products)
    }


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


# Search Routes
@api_router.get("/search")
async def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    search_type: str = Query("both", description="Search type: code, description, or both")
):
    query_regex = {"$regex": q, "$options": "i"}
    
    if search_type == "code":
        filter_query = {"product_code": query_regex}
    elif search_type == "description":
        filter_query = {"description": query_regex}
    else:
        filter_query = {"$or": [{"product_code": query_regex}, {"description": query_regex}]}
    
    products = await db.products.find(filter_query, {"_id": 0}).to_list(500)
    
    # Sort by price (lowest to highest)
    products.sort(key=lambda x: x.get('price', float('inf')))
    
    # Mark cheapest product
    if products:
        min_price = products[0]['price']
        for p in products:
            p['is_cheapest'] = p['price'] == min_price
    
    return {"results": products, "count": len(products)}


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
