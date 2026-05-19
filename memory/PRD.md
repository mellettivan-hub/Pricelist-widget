# Price Check App - Product Requirements Document

## Original Problem Statement
Build a price check app that:
1. Uploads vendor price lists (Excel sheets)
2. Searches products and finds the cheapest price across all vendors
3. Tracks price history
4. Manages vendors
5. Integrates with Zoho Inventory for seamless price updates

## Current Implementation (v2.0 - Zoho Inventory Integration)

### Core Features Implemented

#### 1. Zoho Inventory Integration ✅
- **OAuth2 Authentication**: Secure token-based authentication with automatic refresh
- **Pull Active Items**: Fetches all active products from Zoho Inventory
- **View Inventory**: Browse and search Zoho Inventory items with pagination
- **Update Prices**: Push cost price and selling price updates back to Zoho Inventory
- **Bulk Updates**: Update multiple items at once

#### 2. Vendor Pricelist Upload ✅
- Upload Excel files (.xlsx, .xls, .csv)
- Multi-sheet support - processes all sheets from a single Excel file
- Smart column detection for product codes, descriptions, and prices
- Configurable markup percentage (default 45%)
- Stores products with vendor information in MongoDB

#### 3. Product Matching & Price Comparison ✅
- **Exact Match**: 100% SKU/product code match
- **Normalized Match**: Matches after normalizing codes (removing spaces, dashes, etc.)
- **Fuzzy Match**: Configurable threshold (default 80%) for partial matches
- Finds cheapest price across all uploaded vendor pricelists
- Shows savings potential for each matched item

#### 4. Price Update to Zoho ✅
- Select individual items or all cheaper prices
- Bulk update with progress tracking
- Updates both cost price (purchase_rate) and selling price (rate)
- Automatic markup calculation

### Technical Architecture

```
/app/
├── backend/
│   ├── server.py          # FastAPI server with all endpoints
│   ├── zoho_client.py     # Zoho Inventory API client
│   ├── .env               # Environment variables (Zoho credentials)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── ZohoDashboard.jsx    # Dashboard with stats
│       │   ├── ZohoInventory.jsx    # Zoho items browser
│       │   ├── MatchAndUpdate.jsx   # Price matching & updates
│       │   ├── Upload.jsx           # Pricelist upload
│       │   ├── Vendors.jsx          # Vendor management
│       │   └── PriceLists.jsx       # Uploaded pricelists
│       └── components/
└── memory/
    └── PRD.md
```

### API Endpoints

#### Zoho Inventory
- `GET /api/zoho/items` - Get paginated Zoho items
- `GET /api/zoho/items/all` - Get all active Zoho items
- `GET /api/zoho/match` - Match Zoho items with uploaded pricelists
- `PUT /api/zoho/items/{item_id}/price` - Update single item price
- `POST /api/zoho/items/bulk-update` - Bulk update prices
- `GET /api/zoho/sync-status` - Get connection status and counts

#### Pricelists & Vendors
- `POST /api/upload/file` - Upload Excel file
- `POST /api/upload/process-multi` - Process file with column mapping
- `GET /api/vendors` - List all vendors
- `POST /api/vendors` - Create vendor
- `GET /api/price-lists` - List all pricelists
- `GET /api/products/search` - Search products

### Database Schema (MongoDB)

#### zoho_tokens
```json
{
  "_id": "inventory_token",
  "access_token": "string",
  "refresh_token": "string",
  "expires_at": "datetime",
  "updated_at": "datetime"
}
```

#### products
```json
{
  "id": "uuid",
  "product_code": "string",
  "description": "string",
  "cost_price": "number",
  "selling_price": "number",
  "vendor_id": "string",
  "vendor_name": "string",
  "price_list_id": "string"
}
```

#### vendors
```json
{
  "id": "uuid",
  "name": "string",
  "contact_email": "string",
  "contact_phone": "string"
}
```

### Environment Variables (backend/.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
ZOHO_CLIENT_ID=xxx
ZOHO_CLIENT_SECRET=xxx
ZOHO_REFRESH_TOKEN=xxx
ZOHO_ORGANIZATION_ID=xxx
ZOHO_API_DOMAIN=https://www.zohoapis.com
```

## Completed Work
- [x] Zoho Inventory API integration with OAuth2
- [x] Pull active items from Zoho Inventory
- [x] Match products by SKU (exact, normalized, fuzzy)
- [x] Find cheapest prices from uploaded vendor pricelists
- [x] Update Zoho Inventory prices (cost + selling with markup)
- [x] Bulk price update functionality
- [x] Dashboard with connection status and stats
- [x] Zoho Inventory browser with search
- [x] Match & Update page with filtering and selection
- [x] Login system (pseudo-auth with shared password F0rbt3ch)
- [x] Activity Logs page with user action tracking
- [x] **Bulk Edit in Zoho Inventory** - Select multiple items and update Brand/Manufacturer/GL Accounts (Dec 2025)
- [x] **Brand/Manufacturer Dropdowns** - Converted from text inputs to dropdown menus populated with existing values (Dec 2025)
- [x] **Save Verification** - Double-check confirmation after saving that update went through to Zoho (Dec 2025)
- [x] **Pricelist Upload Logging** - Log uploads with file details, product count, sheets processed in Activity Logs (Dec 2025)
- [x] **Price History Tracking** - Save historical cost/selling prices when Zoho items are updated, visible in edit modal (Dec 2025)

## Future Enhancements (Backlog)
- [ ] P2: Export activity logs to Excel
- [ ] P2: Email notifications for bulk price updates
- [ ] P2: Role-based access (admin vs viewer)
- [ ] P2: Refactor server.py into modular route files (1900+ lines currently)
- [ ] P3: Multi-organization Zoho support
- [ ] P3: Custom matching rules per vendor

## Login Credentials
- **Username**: Any name (e.g., Ivan, Admin, etc.)
- **Password**: F0rbt3ch
- Client ID: 1000.Y9885DJCMOUXHU1JLOZYCC255A21PP
- Organization ID: 721559909
- Data Center: US (zoho.com)
- Scopes: ZohoInventory.FullAccess.all
