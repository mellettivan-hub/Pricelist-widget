# Price Check App - Product Requirements Document

## Original Problem Statement
Build a price check app to compare vendor price lists. Users upload Excel price lists from multiple vendors, search products by code/description, and see all vendor prices sorted lowest to highest with the cheapest highlighted. Track price history over time. App will later be migrated to Zoho Creator.

## Architecture

### Backend (FastAPI + MongoDB)
- **API Routes**: `/api/vendors`, `/api/upload`, `/api/search`, `/api/price-lists`, `/api/price-history`, `/api/stats`
- **Database Collections**: `vendors`, `products`, `price_lists`, `price_history`
- **Excel Parser**: Supports HIKVISION SA and Sensor Security formats, auto-detects column structure

### Frontend (React + Tailwind)
- **Pages**: Dashboard, Search, Upload, Vendors, Price Lists, Price History
- **Design**: Swiss/High-Contrast theme, IBM Plex fonts, dense data tables
- **Components**: Shadcn UI components

## User Personas
1. **Procurement Manager**: Searches products, compares prices across vendors
2. **Admin**: Manages vendors, uploads price lists, tracks history

## Core Requirements (Static)
- [ ] Upload Excel price lists from vendors
- [ ] Search by product code OR description
- [ ] Show all prices sorted lowest to highest
- [ ] Highlight cheapest option
- [ ] Track price history over time
- [ ] Manage vendors (CRUD)
- [ ] View/delete uploaded price lists

## What's Been Implemented (2026-03-27)
- [x] Full-stack app with FastAPI backend + React frontend
- [x] Vendor management (add/view/delete)
- [x] Excel file upload with multi-format parser
- [x] Product search with results sorted by price
- [x] Cheapest price highlighting (trophy icon + green background)
- [x] Price history tracking with charts
- [x] Dashboard with stats
- [x] Successfully imported 2,532 products from 2 vendors

## Supported Excel Formats
1. **HIKVISION SA**: Columns - Product name, SAP code, Description, Unit Price (xVAT)
2. **Sensor Security**: Columns - Sensor Product Code, Description, Sub-D price, Retail

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core search functionality
- [x] Price comparison with sorting
- [x] Cheapest highlighting
- [x] Excel upload/parsing

### P1 (Important)
- [ ] Export search results to CSV/PDF
- [ ] Filter by vendor/category
- [ ] Email alerts for price changes

### P2 (Nice to Have)
- [ ] User authentication
- [ ] Bulk vendor upload
- [ ] Price trend analytics
- [ ] API for Zoho Creator integration

## Next Tasks
1. Test with more vendor price list formats
2. Add export functionality for quotes
3. Prepare documentation for Zoho Creator migration
