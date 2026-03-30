# Zoho Creator - Price Check App Setup Guide

## Table of Contents
1. [Application Setup](#1-application-setup)
2. [Create Forms (Database Tables)](#2-create-forms-database-tables)
3. [Create Pages & Reports](#3-create-pages--reports)
4. [Deluge Scripts](#4-deluge-scripts)
5. [Workflows & Automation](#5-workflows--automation)
6. [Testing](#6-testing)

---

## 1. Application Setup

### Step 1: Create New Application
1. Go to [Zoho Creator](https://creator.zoho.com)
2. Click **"Create Application"**
3. Choose **"Create from Scratch"**
4. Name: `Price_Check_App`
5. Click **Create**

---

## 2. Create Forms (Database Tables)

### Form 1: Vendors
**Navigation:** App Settings → Forms → Create New Form

| Field Name | Display Name | Field Type | Properties |
|------------|--------------|------------|------------|
| Vendor_Name | Vendor Name | Single Line | Required, Unique |
| Contact_Email | Contact Email | Email | Optional |
| Contact_Phone | Contact Phone | Phone | Optional |
| Created_Date | Created Date | Date-Time | Default: zoho.currenttime |

**Form Settings:**
- Enable: "Show Add Note"
- Success Message: "Vendor added successfully"

---

### Form 2: Products
**This is the main products table**

| Field Name | Display Name | Field Type | Properties |
|------------|--------------|------------|------------|
| Product_Code | Product Code | Single Line | Required |
| Description | Description | Multi Line | Optional |
| Cost_Price | Cost Price (excl VAT) | Currency | Required, Default: 0 |
| Selling_Price | Selling Price | Currency | Auto-calculated |
| Markup_Percent | Markup % | Decimal | Default: 45 |
| Vendor | Vendor | Lookup | Link to Vendors form |
| Category | Category | Single Line | Optional |
| Upload_Date | Upload Date | Date-Time | Default: zoho.currenttime |

---

### Form 3: Price_Lists
**Tracks uploaded price list files**

| Field Name | Display Name | Field Type | Properties |
|------------|--------------|------------|------------|
| File_Name | File Name | Single Line | Required |
| Vendor | Vendor | Lookup | Link to Vendors form |
| Product_Count | Products Imported | Number | Default: 0 |
| Upload_Date | Upload Date | Date-Time | Default: zoho.currenttime |
| Status | Status | Dropdown | Options: Active, Archived |

---

### Form 4: Price_History
**Tracks price changes over time**

| Field Name | Display Name | Field Type | Properties |
|------------|--------------|------------|------------|
| Product_Code | Product Code | Single Line | Required |
| Description | Description | Multi Line | Optional |
| Cost_Price | Cost Price | Currency | Required |
| Selling_Price | Selling Price | Currency | Required |
| Vendor | Vendor | Lookup | Link to Vendors form |
| Recorded_Date | Recorded Date | Date-Time | Default: zoho.currenttime |

---

### Form 5: Import_Settings
**Store default markup and import settings**

| Field Name | Display Name | Field Type | Properties |
|------------|--------------|------------|------------|
| Default_Markup | Default Markup % | Decimal | Default: 45 |
| Last_Updated | Last Updated | Date-Time | Auto |

---

## 3. Create Pages & Reports

### Page 1: Dashboard
**Create a Page with these widgets:**

1. **Stats Cards** (use HTML Snippet):
```html
<div style="display: flex; gap: 20px;">
  <div style="background: white; padding: 20px; border: 1px solid #ddd; flex: 1;">
    <h3 style="font-size: 32px; margin: 0;">%%=Vendors.count()%%</h3>
    <p style="color: #666;">VENDORS</p>
  </div>
  <div style="background: white; padding: 20px; border: 1px solid #ddd; flex: 1;">
    <h3 style="font-size: 32px; margin: 0;">%%=Price_Lists.count()%%</h3>
    <p style="color: #666;">PRICE LISTS</p>
  </div>
  <div style="background: white; padding: 20px; border: 1px solid #ddd; flex: 1;">
    <h3 style="font-size: 32px; margin: 0;">%%=Products.count()%%</h3>
    <p style="color: #666;">PRODUCTS</p>
  </div>
</div>
```

2. **Quick Search Form** - Link to Search Page
3. **Recent Price Lists** - Report showing last 5 uploads

---

### Page 2: Search Products
**Create a Page with:**
1. Search Input Field
2. Results Report (linked to Products form)

---

### Report 1: Product_Search_Results
**Type:** Grid Report on Products form

**Columns to Display:**
- Product_Code
- Description
- Vendor.Vendor_Name
- Cost_Price
- Selling_Price
- Category

**Default Sort:** Selling_Price (Ascending)

---

## 4. Deluge Scripts

### Script 1: Calculate Markup (Form Workflow)
**Location:** Products Form → Workflow → On Add/Edit

```javascript
// ============================================
// CALCULATE SELLING PRICE WITH MARKUP
// Triggered: On Product form submit
// ============================================

// Get the markup percentage (default 45%)
markup_percent = ifnull(input.Markup_Percent, 45);

// Get cost price
cost_price = ifnull(input.Cost_Price, 0);

// Calculate selling price
if(cost_price > 0)
{
    markup_multiplier = 1 + (markup_percent / 100);
    selling_price = cost_price * markup_multiplier;
    
    // Round to 2 decimal places
    input.Selling_Price = selling_price.round(2);
}

// Log for debugging
info "Product: " + input.Product_Code + " | Cost: " + cost_price + " | Selling: " + input.Selling_Price;
```

---

### Script 2: Search Products (Custom Function)
**Location:** Settings → Functions → Create New Function

**Function Name:** `searchProducts`
**Parameters:** `searchTerm` (String)

```javascript
// ============================================
// SEARCH PRODUCTS WITH SMART MATCHING
// Returns products matching search term
// Sorted by selling price (lowest first)
// ============================================

// Initialize result list
resultList = List();

// Search in Product_Code and Description
searchTermUpper = searchTerm.toUpperCase();

// Get all products
allProducts = Products[ID != 0];

for each product in allProducts
{
    productCode = ifnull(product.Product_Code, "").toUpperCase();
    description = ifnull(product.Description, "").toUpperCase();
    
    // Check if search term matches
    matchScore = 0;
    
    // Exact match in product code
    if(productCode.contains(searchTermUpper))
    {
        matchScore = 100;
    }
    // Partial match in product code (remove dashes/spaces)
    else if(productCode.replaceAll("-", "").replaceAll(" ", "").contains(searchTermUpper.replaceAll("-", "").replaceAll(" ", "")))
    {
        matchScore = 80;
    }
    // Match in description
    else if(description.contains(searchTermUpper))
    {
        matchScore = 60;
    }
    
    // If match found, add to results
    if(matchScore >= 60)
    {
        productMap = Map();
        productMap.put("ID", product.ID);
        productMap.put("Product_Code", product.Product_Code);
        productMap.put("Description", product.Description);
        productMap.put("Vendor", product.Vendor.Vendor_Name);
        productMap.put("Cost_Price", product.Cost_Price);
        productMap.put("Selling_Price", product.Selling_Price);
        productMap.put("Category", product.Category);
        productMap.put("Match_Score", matchScore);
        
        resultList.add(productMap);
    }
}

// Sort by Selling_Price (ascending)
resultList = resultList.sort("Selling_Price", true);

// Mark cheapest
if(resultList.size() > 0)
{
    cheapestPrice = resultList.get(0).get("Selling_Price");
    for each item in resultList
    {
        if(item.get("Selling_Price") == cheapestPrice)
        {
            item.put("Is_Cheapest", true);
        }
        else
        {
            item.put("Is_Cheapest", false);
        }
    }
}

return resultList;
```

---

### Script 3: Fuzzy Search (Advanced Matching)
**Function Name:** `fuzzySearchProducts`
**Parameters:** `searchTerm` (String)

```javascript
// ============================================
// FUZZY SEARCH - Find similar product codes
// Even if vendors use different formats
// ============================================

resultList = List();
searchTermClean = searchTerm.toUpperCase().replaceAll("-", "").replaceAll(" ", "").replaceAll("(", "").replaceAll(")", "");

allProducts = Products[ID != 0];

for each product in allProducts
{
    productCode = ifnull(product.Product_Code, "");
    productCodeClean = productCode.toUpperCase().replaceAll("-", "").replaceAll(" ", "").replaceAll("(", "").replaceAll(")", "");
    description = ifnull(product.Description, "").toUpperCase();
    
    matchScore = 0;
    
    // === MATCHING STRATEGIES ===
    
    // Strategy 1: Clean code contains search term
    if(productCodeClean.contains(searchTermClean))
    {
        matchScore = 90;
    }
    // Strategy 2: Search term contains clean code
    else if(searchTermClean.contains(productCodeClean.subString(0, min(productCodeClean.length(), searchTermClean.length()))))
    {
        matchScore = 75;
    }
    // Strategy 3: First 8 characters match
    else if(productCodeClean.length() >= 8 && searchTermClean.length() >= 8)
    {
        if(productCodeClean.subString(0, 8) == searchTermClean.subString(0, 8))
        {
            matchScore = 70;
        }
    }
    // Strategy 4: Description contains search term
    else if(description.contains(searchTerm.toUpperCase()))
    {
        matchScore = 50;
    }
    
    // Add if score is good enough
    if(matchScore >= 50)
    {
        productMap = Map();
        productMap.put("ID", product.ID);
        productMap.put("Product_Code", product.Product_Code);
        productMap.put("Description", product.Description);
        productMap.put("Vendor", product.Vendor.Vendor_Name);
        productMap.put("Vendor_ID", product.Vendor.ID);
        productMap.put("Cost_Price", product.Cost_Price);
        productMap.put("Selling_Price", product.Selling_Price);
        productMap.put("Markup_Percent", product.Markup_Percent);
        productMap.put("Category", product.Category);
        productMap.put("Match_Score", matchScore);
        
        resultList.add(productMap);
    }
}

// Sort by match score (desc), then selling price (asc)
resultList = resultList.sort("Match_Score", false);

// Get top 100 results
if(resultList.size() > 100)
{
    resultList = resultList.subList(0, 100);
}

// Re-sort by price and mark cheapest
resultList = resultList.sort("Selling_Price", true);

if(resultList.size() > 0)
{
    cheapestPrice = resultList.get(0).get("Selling_Price");
    for each item in resultList
    {
        item.put("Is_Cheapest", item.get("Selling_Price") == cheapestPrice);
    }
}

return resultList;
```

---

### Script 4: Import Excel File
**Location:** Create a separate form for Excel Import

**Form: Import_Excel**
| Field Name | Field Type |
|------------|------------|
| Excel_File | File Upload |
| Vendor | Lookup → Vendors |
| Product_Code_Column | Single Line |
| Description_Column | Single Line |
| Price_Column | Single Line |
| Markup_Percent | Decimal (Default: 45) |

**Workflow Script (On Submit):**

```javascript
// ============================================
// IMPORT PRODUCTS FROM EXCEL
// Parses uploaded Excel and creates products
// ============================================

// Get the uploaded file
excelFile = input.Excel_File;
vendorID = input.Vendor;
vendorRecord = Vendors[ID == vendorID];
vendorName = vendorRecord.Vendor_Name;

// Column mappings from user input
codeCol = ifnull(input.Product_Code_Column, "Product Code");
descCol = ifnull(input.Description_Column, "Description");
priceCol = ifnull(input.Price_Column, "Price");
markupPercent = ifnull(input.Markup_Percent, 45);

// Parse Excel file
// Note: Zoho Creator can parse Excel using built-in functions
fileContent = excelFile.getFileContent();

// For CSV files, you can use:
// rows = fileContent.toCSV();

// For Excel, use Zoho Sheet integration or manual parsing
// This example assumes CSV format

productsImported = 0;
errorCount = 0;
priceListID = null;

// Create Price List record
priceListMap = Map();
priceListMap.put("File_Name", excelFile.getFileName());
priceListMap.put("Vendor", vendorID);
priceListMap.put("Upload_Date", zoho.currenttime);
priceListMap.put("Status", "Active");
priceListRecord = insert into Price_Lists [priceListMap];
priceListID = priceListRecord.ID;

// Parse rows (assuming CSV)
try
{
    rows = fileContent.toList("\n");
    headerRow = rows.get(0).toList(",");
    
    // Find column indexes
    codeIndex = headerRow.indexOf(codeCol);
    descIndex = headerRow.indexOf(descCol);
    priceIndex = headerRow.indexOf(priceCol);
    
    // Process each row (skip header)
    for each row in rows.subList(1, rows.size())
    {
        try
        {
            columns = row.toList(",");
            
            productCode = columns.get(codeIndex).trim();
            description = if(descIndex >= 0, columns.get(descIndex).trim(), productCode);
            priceStr = columns.get(priceIndex).replaceAll("[^0-9.]", "");
            costPrice = priceStr.toDecimal();
            
            // Skip invalid rows
            if(productCode.isEmpty() || costPrice <= 0)
            {
                continue;
            }
            
            // Calculate selling price
            sellingPrice = costPrice * (1 + markupPercent / 100);
            
            // Create product
            productMap = Map();
            productMap.put("Product_Code", productCode);
            productMap.put("Description", description);
            productMap.put("Cost_Price", costPrice.round(2));
            productMap.put("Selling_Price", sellingPrice.round(2));
            productMap.put("Markup_Percent", markupPercent);
            productMap.put("Vendor", vendorID);
            productMap.put("Category", "Imported");
            productMap.put("Upload_Date", zoho.currenttime);
            
            insert into Products [productMap];
            productsImported = productsImported + 1;
            
            // Also add to price history
            historyMap = Map();
            historyMap.put("Product_Code", productCode);
            historyMap.put("Description", description);
            historyMap.put("Cost_Price", costPrice.round(2));
            historyMap.put("Selling_Price", sellingPrice.round(2));
            historyMap.put("Vendor", vendorID);
            historyMap.put("Recorded_Date", zoho.currenttime);
            
            insert into Price_History [historyMap];
        }
        catch (e)
        {
            errorCount = errorCount + 1;
        }
    }
    
    // Update price list with count
    update Price_Lists [ID == priceListID]
    (
        Product_Count = productsImported
    );
    
    info "Import complete: " + productsImported + " products imported, " + errorCount + " errors";
}
catch (e)
{
    info "Error parsing file: " + e;
}

// Show result to user
if(productsImported > 0)
{
    openUrl("#Page:Import_Success?count=" + productsImported, "same window");
}
```

---

### Script 5: Apply Markup to All Products
**Function Name:** `applyMarkupToAll`
**Parameters:** `markupPercent` (Decimal)

```javascript
// ============================================
// APPLY MARKUP TO ALL EXISTING PRODUCTS
// Updates all products with new markup %
// ============================================

updatedCount = 0;

allProducts = Products[ID != 0];

for each product in allProducts
{
    costPrice = ifnull(product.Cost_Price, product.Selling_Price / (1 + ifnull(product.Markup_Percent, 45) / 100));
    
    if(costPrice > 0)
    {
        newSellingPrice = costPrice * (1 + markupPercent / 100);
        
        update Products [ID == product.ID]
        (
            Cost_Price = costPrice.round(2),
            Selling_Price = newSellingPrice.round(2),
            Markup_Percent = markupPercent
        );
        
        updatedCount = updatedCount + 1;
    }
}

return "Updated " + updatedCount + " products with " + markupPercent + "% markup";
```

---

### Script 6: Get Dashboard Stats
**Function Name:** `getDashboardStats`

```javascript
// ============================================
// GET DASHBOARD STATISTICS
// Returns vendor, product, price list counts
// ============================================

stats = Map();

stats.put("vendor_count", Vendors[ID != 0].count());
stats.put("product_count", Products[ID != 0].count());
stats.put("pricelist_count", Price_Lists[ID != 0].count());

// Get recent uploads
recentLists = Price_Lists[ID != 0].sort(Upload_Date, false).subList(0, 5);
stats.put("recent_uploads", recentLists);

// Get cheapest products by category
// Add more stats as needed

return stats;
```

---

### Script 7: Record Price History
**Location:** Products Form → Workflow → On Edit

```javascript
// ============================================
// RECORD PRICE HISTORY ON PRICE CHANGE
// Triggered when product price is updated
// ============================================

// Check if price changed
oldCost = ifnull(input.Cost_Price_old, 0);
newCost = ifnull(input.Cost_Price, 0);

if(oldCost != newCost && newCost > 0)
{
    // Record in price history
    historyMap = Map();
    historyMap.put("Product_Code", input.Product_Code);
    historyMap.put("Description", input.Description);
    historyMap.put("Cost_Price", newCost);
    historyMap.put("Selling_Price", input.Selling_Price);
    historyMap.put("Vendor", input.Vendor);
    historyMap.put("Recorded_Date", zoho.currenttime);
    
    insert into Price_History [historyMap];
    
    info "Price history recorded for " + input.Product_Code;
}
```

---

### Script 8: Compare Prices Across Vendors
**Function Name:** `comparePrices`
**Parameters:** `productCode` (String)

```javascript
// ============================================
// COMPARE PRICES ACROSS ALL VENDORS
// For a specific product code
// ============================================

resultList = List();

// Search with fuzzy matching
searchTermClean = productCode.toUpperCase().replaceAll("-", "").replaceAll(" ", "");

matchingProducts = Products[ID != 0];

for each product in matchingProducts
{
    codeClean = product.Product_Code.toUpperCase().replaceAll("-", "").replaceAll(" ", "");
    
    // Check for match (first 10 chars)
    matchLength = min(10, min(codeClean.length(), searchTermClean.length()));
    
    if(matchLength >= 6 && codeClean.subString(0, matchLength) == searchTermClean.subString(0, matchLength))
    {
        priceMap = Map();
        priceMap.put("Product_Code", product.Product_Code);
        priceMap.put("Description", product.Description);
        priceMap.put("Vendor", product.Vendor.Vendor_Name);
        priceMap.put("Cost_Price", product.Cost_Price);
        priceMap.put("Selling_Price", product.Selling_Price);
        
        resultList.add(priceMap);
    }
}

// Sort by selling price
resultList = resultList.sort("Selling_Price", true);

// Mark cheapest
if(resultList.size() > 0)
{
    cheapest = resultList.get(0).get("Selling_Price");
    for each item in resultList
    {
        item.put("Is_Cheapest", item.get("Selling_Price") == cheapest);
        
        // Calculate savings vs most expensive
        if(resultList.size() > 1)
        {
            mostExpensive = resultList.get(resultList.size() - 1).get("Selling_Price");
            savings = mostExpensive - item.get("Selling_Price");
            item.put("Potential_Savings", savings);
        }
    }
}

return resultList;
```

---

## 5. Workflows & Automation

### Workflow 1: Auto-Calculate Selling Price
**Form:** Products
**Trigger:** On Create and On Edit

1. Go to Products Form → Workflow
2. Add New Workflow
3. Set trigger: "On successful form submission" + "On record edit"
4. Add Script (use Script 1 from above)

---

### Workflow 2: Record Price Changes
**Form:** Products
**Trigger:** On Edit

1. Go to Products Form → Workflow
2. Add condition: `Cost_Price != Cost_Price_old`
3. Add Script (use Script 7 from above)

---

### Workflow 3: Welcome Email to New Vendors
**Form:** Vendors
**Trigger:** On Create

```javascript
// Send welcome email
if(input.Contact_Email != null && input.Contact_Email != "")
{
    sendmail
    [
        from: zoho.adminuserid
        to: input.Contact_Email
        subject: "Welcome to Price Check System"
        message: "Dear " + input.Vendor_Name + ",\n\nYou have been added to our vendor list.\n\nBest regards"
    ];
}
```

---

## 6. Testing

### Test 1: Add a Vendor
1. Go to Vendors form
2. Add: "Test Vendor", "test@email.com"
3. Verify it appears in vendor list

### Test 2: Add a Product
1. Go to Products form
2. Add: Code="TEST-001", Cost=R100, Vendor=Test Vendor
3. Verify Selling Price = R145 (with 45% markup)

### Test 3: Search Products
1. Go to Search page
2. Search for "TEST"
3. Verify product appears with correct prices

### Test 4: Import Excel
1. Create test CSV with columns: Product Code, Description, Price
2. Upload via Import form
3. Verify products are created with markup

---

## 7. Additional Tips

### Zoho Creator Best Practices:
1. **Use Lookup fields** instead of storing vendor names directly
2. **Create Reports** for each major view (Products, Search Results, History)
3. **Use Stateless functions** for reusable logic
4. **Enable audit trail** on Products form for change tracking

### Integration with Zoho Inventory:
```javascript
// Push product to Zoho Inventory
inventoryItem = Map();
inventoryItem.put("name", product.Description);
inventoryItem.put("sku", product.Product_Code);
inventoryItem.put("purchase_rate", product.Cost_Price);
inventoryItem.put("rate", product.Selling_Price);

response = zoho.inventory.createItem(inventoryItem, "your_org_id");
```

### Export Data as CSV:
```javascript
// Export all products to CSV
csvContent = "Product Code,Description,Vendor,Cost Price,Selling Price,Markup %\n";

allProducts = Products[ID != 0];
for each p in allProducts
{
    csvContent = csvContent + p.Product_Code + "," + p.Description + "," + p.Vendor.Vendor_Name + "," + p.Cost_Price + "," + p.Selling_Price + "," + p.Markup_Percent + "\n";
}

return csvContent;
```

---

## Quick Reference Card

| Feature | Zoho Creator Location |
|---------|----------------------|
| Add Vendor | Forms → Vendors → Add |
| Add Product | Forms → Products → Add |
| Search | Pages → Search Page |
| Import Excel | Forms → Import_Excel |
| View History | Reports → Price_History |
| Change Markup | Functions → applyMarkupToAll(45) |
| Dashboard | Pages → Dashboard |

---

**Need Help?**
- Zoho Creator Documentation: https://www.zoho.com/creator/help/
- Deluge Reference: https://www.zoho.com/deluge/help/
