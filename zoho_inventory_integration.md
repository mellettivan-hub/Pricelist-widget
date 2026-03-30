# Zoho Inventory Integration Guide

## Overview
This guide shows how to sync products from your Price Check app to Zoho Inventory.

---

## 1. Setup Zoho Inventory Connection

### Step 1: Get API Credentials
1. Go to Zoho Inventory → Settings → API
2. Note your **Organization ID**
3. Create a **Self Client** in Zoho API Console:
   - Go to: https://api-console.zoho.com/
   - Click "Add Client" → "Self Client"
   - Generate tokens with scopes:
     - `ZohoInventory.items.CREATE`
     - `ZohoInventory.items.UPDATE`
     - `ZohoInventory.items.READ`

### Step 2: Store Credentials in Zoho Creator
Create a form called `API_Settings`:

| Field | Type |
|-------|------|
| Zoho_Inventory_Org_ID | Single Line |
| Access_Token | Multi Line |
| Refresh_Token | Multi Line |

---

## 2. Deluge Scripts for Zoho Inventory

### Script 1: Create Item in Zoho Inventory
**Function Name:** `createInventoryItem`
**Parameters:** `productID` (BigInt)

```javascript
// ============================================
// CREATE ITEM IN ZOHO INVENTORY
// Syncs a product to Zoho Inventory
// ============================================

// Get product details
product = Products[ID == productID];

if(product.count() == 0)
{
    return {"status": "error", "message": "Product not found"};
}

prod = product.first();

// Get API settings
settings = API_Settings[ID != 0].first();
orgID = settings.Zoho_Inventory_Org_ID;

// Build item payload
itemData = Map();
itemData.put("name", prod.Description);
itemData.put("sku", prod.Product_Code);
itemData.put("unit", "pcs");
itemData.put("status", "active");

// Pricing
itemData.put("purchase_rate", prod.Cost_Price);
itemData.put("rate", prod.Selling_Price);

// Category (if you have item groups in Inventory)
// itemData.put("group_id", "your_group_id");

// Custom fields (if configured in Inventory)
customFields = List();
customField1 = Map();
customField1.put("label", "Vendor");
customField1.put("value", prod.Vendor.Vendor_Name);
customFields.add(customField1);

customField2 = Map();
customField2.put("label", "Markup Percent");
customField2.put("value", prod.Markup_Percent.toString());
customFields.add(customField2);

itemData.put("custom_fields", customFields);

// Make API call
jsonPayload = Map();
jsonPayload.put("item", itemData);

response = invokeurl
[
    url: "https://inventory.zoho.com/api/v1/items?organization_id=" + orgID
    type: POST
    parameters: jsonPayload.toString()
    headers: {"Authorization": "Zoho-oauthtoken " + settings.Access_Token, "Content-Type": "application/json"}
];

// Parse response
if(response.get("code") == 0)
{
    inventoryItemID = response.get("item").get("item_id");
    
    // Store Inventory ID in Creator
    update Products [ID == productID]
    (
        Zoho_Inventory_ID = inventoryItemID
    );
    
    return {"status": "success", "inventory_id": inventoryItemID};
}
else
{
    return {"status": "error", "message": response.get("message")};
}
```

---

### Script 2: Sync All Products to Inventory
**Function Name:** `syncAllToInventory`

```javascript
// ============================================
// SYNC ALL PRODUCTS TO ZOHO INVENTORY
// Bulk sync all products
// ============================================

syncedCount = 0;
errorCount = 0;
errorList = List();

// Get all products without Inventory ID
productsToSync = Products[Zoho_Inventory_ID == null || Zoho_Inventory_ID == ""];

info "Products to sync: " + productsToSync.count();

for each product in productsToSync
{
    try
    {
        result = thisapp.createInventoryItem(product.ID);
        
        if(result.get("status") == "success")
        {
            syncedCount = syncedCount + 1;
        }
        else
        {
            errorCount = errorCount + 1;
            errorList.add(product.Product_Code + ": " + result.get("message"));
        }
        
        // Rate limiting - Zoho allows ~100 calls/minute
        if(syncedCount % 50 == 0)
        {
            // Wait 30 seconds every 50 items
            // Note: Deluge doesn't have sleep, so use scheduled function for large batches
        }
    }
    catch(e)
    {
        errorCount = errorCount + 1;
        errorList.add(product.Product_Code + ": " + e);
    }
}

return {
    "synced": syncedCount,
    "errors": errorCount,
    "error_details": errorList
};
```

---

### Script 3: Update Inventory Item Price
**Function Name:** `updateInventoryPrice`
**Parameters:** `productID` (BigInt)

```javascript
// ============================================
// UPDATE ITEM PRICE IN ZOHO INVENTORY
// Called when price changes in Creator
// ============================================

product = Products[ID == productID].first();
inventoryID = product.Zoho_Inventory_ID;

if(inventoryID == null || inventoryID == "")
{
    return {"status": "error", "message": "Product not synced to Inventory"};
}

settings = API_Settings[ID != 0].first();
orgID = settings.Zoho_Inventory_Org_ID;

// Build update payload
itemData = Map();
itemData.put("purchase_rate", product.Cost_Price);
itemData.put("rate", product.Selling_Price);

jsonPayload = Map();
jsonPayload.put("item", itemData);

response = invokeurl
[
    url: "https://inventory.zoho.com/api/v1/items/" + inventoryID + "?organization_id=" + orgID
    type: PUT
    parameters: jsonPayload.toString()
    headers: {"Authorization": "Zoho-oauthtoken " + settings.Access_Token, "Content-Type": "application/json"}
];

if(response.get("code") == 0)
{
    return {"status": "success"};
}
else
{
    return {"status": "error", "message": response.get("message")};
}
```

---

### Script 4: Get Item from Inventory
**Function Name:** `getInventoryItem`
**Parameters:** `sku` (String)

```javascript
// ============================================
// GET ITEM FROM ZOHO INVENTORY BY SKU
// Check if item exists
// ============================================

settings = API_Settings[ID != 0].first();
orgID = settings.Zoho_Inventory_Org_ID;

response = invokeurl
[
    url: "https://inventory.zoho.com/api/v1/items?organization_id=" + orgID + "&sku=" + sku
    type: GET
    headers: {"Authorization": "Zoho-oauthtoken " + settings.Access_Token}
];

if(response.get("code") == 0)
{
    items = response.get("items");
    if(items.size() > 0)
    {
        return items.get(0);
    }
}

return null;
```

---

### Script 5: Bulk Create Items (Batch API)
**Function Name:** `bulkCreateItems`
**Parameters:** `productIDs` (List)

```javascript
// ============================================
// BULK CREATE ITEMS IN ZOHO INVENTORY
// Uses batch API for efficiency
// ============================================

settings = API_Settings[ID != 0].first();
orgID = settings.Zoho_Inventory_Org_ID;

itemsList = List();

for each productID in productIDs
{
    product = Products[ID == productID].first();
    
    itemData = Map();
    itemData.put("name", product.Description);
    itemData.put("sku", product.Product_Code);
    itemData.put("unit", "pcs");
    itemData.put("purchase_rate", product.Cost_Price);
    itemData.put("rate", product.Selling_Price);
    
    itemsList.add(itemData);
}

// Zoho Inventory batch limit is 25 items per request
batchSize = 25;
batches = List();

for(i = 0; i < itemsList.size(); i = i + batchSize)
{
    endIndex = min(i + batchSize, itemsList.size());
    batch = itemsList.subList(i, endIndex);
    batches.add(batch);
}

results = List();

for each batch in batches
{
    jsonPayload = Map();
    jsonPayload.put("items", batch);
    
    response = invokeurl
    [
        url: "https://inventory.zoho.com/api/v1/items?organization_id=" + orgID
        type: POST
        parameters: jsonPayload.toString()
        headers: {"Authorization": "Zoho-oauthtoken " + settings.Access_Token, "Content-Type": "application/json"}
    ];
    
    results.add(response);
}

return results;
```

---

### Script 6: Auto-Sync on Product Create
**Workflow on Products Form - On Create**

```javascript
// ============================================
// AUTO-SYNC NEW PRODUCT TO INVENTORY
// Triggered when product is created
// ============================================

// Check if auto-sync is enabled
settings = API_Settings[ID != 0].first();

if(settings != null && settings.Auto_Sync_Enabled == true)
{
    // Sync to Inventory
    result = thisapp.createInventoryItem(input.ID);
    
    if(result.get("status") == "error")
    {
        // Log error but don't block creation
        info "Failed to sync to Inventory: " + result.get("message");
    }
}
```

---

### Script 7: Refresh OAuth Token
**Function Name:** `refreshInventoryToken`

```javascript
// ============================================
// REFRESH ZOHO INVENTORY OAUTH TOKEN
// Call this before token expires
// ============================================

settings = API_Settings[ID != 0].first();
refreshToken = settings.Refresh_Token;
clientID = "your_client_id";
clientSecret = "your_client_secret";

response = invokeurl
[
    url: "https://accounts.zoho.com/oauth/v2/token"
    type: POST
    parameters: {
        "refresh_token": refreshToken,
        "client_id": clientID,
        "client_secret": clientSecret,
        "grant_type": "refresh_token"
    }
];

if(response.containKey("access_token"))
{
    newToken = response.get("access_token");
    
    update API_Settings [ID == settings.ID]
    (
        Access_Token = newToken
    );
    
    return {"status": "success", "token": newToken};
}

return {"status": "error", "message": response};
```

---

## 3. Add Inventory ID Field to Products Form

Add this field to your Products form in Zoho Creator:

| Field Name | Type | Properties |
|------------|------|------------|
| Zoho_Inventory_ID | Single Line | Read Only, Hidden in form |

---

## 4. Create Sync Button on Products Page

Add a button to your Products report:

**Button Settings:**
- Name: "Sync to Inventory"
- On Click: Execute Deluge

```javascript
// Button click handler
selectedIDs = input.Selected_Records;

if(selectedIDs.size() == 0)
{
    alert "Please select products to sync";
    return;
}

result = thisapp.bulkCreateItems(selectedIDs);
alert "Sync complete! Check results.";
```

---

## 5. Scheduled Sync (Optional)

Create a Scheduled Workflow to sync products daily:

**Schedule Settings:**
- Frequency: Daily
- Time: 2:00 AM

```javascript
// ============================================
// SCHEDULED DAILY SYNC TO INVENTORY
// Syncs new/updated products
// ============================================

// Get products updated in last 24 hours
yesterday = zoho.currenttime.addDay(-1);
recentProducts = Products[Modified_Time >= yesterday && Zoho_Inventory_ID == null];

info "Products to sync: " + recentProducts.count();

for each product in recentProducts
{
    thisapp.createInventoryItem(product.ID);
}
```

---

## 6. Error Handling & Logging

Create a form to log sync errors:

**Form: Sync_Log**
| Field | Type |
|-------|------|
| Product_Code | Single Line |
| Action | Dropdown (Create/Update/Delete) |
| Status | Dropdown (Success/Error) |
| Error_Message | Multi Line |
| Timestamp | Date-Time |

**Updated createInventoryItem with logging:**

```javascript
// Add at the end of createInventoryItem function

logEntry = Map();
logEntry.put("Product_Code", prod.Product_Code);
logEntry.put("Action", "Create");
logEntry.put("Timestamp", zoho.currenttime);

if(response.get("code") == 0)
{
    logEntry.put("Status", "Success");
}
else
{
    logEntry.put("Status", "Error");
    logEntry.put("Error_Message", response.get("message"));
}

insert into Sync_Log [logEntry];
```

---

## 7. Quick Reference

| Action | Function | Trigger |
|--------|----------|---------|
| Create item | createInventoryItem(ID) | Manual/Auto |
| Update price | updateInventoryPrice(ID) | On price change |
| Bulk sync | syncAllToInventory() | Button click |
| Check item | getInventoryItem(SKU) | Before create |
| Refresh token | refreshInventoryToken() | Scheduled |

---

## 8. API Rate Limits

Zoho Inventory API limits:
- **100 requests/minute** per organization
- **Batch operations**: Max 25 items per request

For large imports (>1000 products), use:
1. Scheduled functions
2. Batch API calls
3. Queue system with delays

---

## Need More Help?

- Zoho Inventory API Docs: https://www.zoho.com/inventory/api/v1/
- Zoho Creator Connections: https://www.zoho.com/creator/help/connections/
- OAuth Setup: https://www.zoho.com/accounts/protocol/oauth.html
