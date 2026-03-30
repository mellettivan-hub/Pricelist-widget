# Zoho Creator - Price List Uploader Widget Installation Guide

## Overview
This widget adds Excel upload functionality to your Zoho Creator app with:
- ✅ Excel file parsing (multi-sheet support)
- ✅ Automatic column detection
- ✅ 45% markup calculation (configurable)
- ✅ Creates Price List records
- ✅ Creates Product records

---

## Step 1: Download the Widget

Download the widget ZIP file from:
**https://price-compare-273.preview.emergentagent.com/api/download/zoho_widget**

---

## Step 2: Upload Widget to Zoho Creator

1. Go to your **Forbtech Pricelist Manager** app in Zoho Creator
2. Click **Settings** (gear icon) in the top menu
3. In the left sidebar, click **Widgets**
4. Click **Create Widget** button
5. Select **Upload** option
6. Upload the `zoho_pricelist_widget.zip` file
7. Click **Create**

---

## Step 3: Create a Page for the Widget

1. Click the **+** button → **Page** → **Blank**
2. Name it: **Upload Price List**
3. In the Page Builder, drag **Widget** from the left sidebar
4. Select **PriceListUploader** widget
5. Click **Done**

---

## Step 4: Test the Widget

1. Click **Access this application**
2. Navigate to **Upload Price List** page
3. Upload an Excel file
4. Select the sheet, map columns
5. Set the vendor name and markup percentage
6. Click **Import Products**

---

## Important: Update Form Names

The widget expects these exact form names:
- **Products** (for product records)
- **Price_Lists** (for price list tracking)

If your form names are different, you'll need to update them in the widget code.

### To check your form names:
1. Go to **Design** mode
2. Look at the form names in the left sidebar
3. If they're different (e.g., "products_export"), rename them:
   - Right-click → **Rename** → Enter new name

---

## Troubleshooting

### "API Error" when importing
- Make sure form names match exactly: `Products` and `Price_Lists`
- Check that all required fields exist in your forms

### Products not showing up
- Go to the Products Report to verify records were created
- Check the Zoho Creator logs for errors

### Widget not loading
- Clear browser cache
- Make sure the widget is properly uploaded
- Check browser console for JavaScript errors

---

## Widget Features

| Feature | Description |
|---------|-------------|
| Multi-sheet detection | Shows all sheets in your Excel file |
| Auto-detect columns | Automatically finds Product Code, Description, Price columns |
| Configurable markup | Default 45%, change as needed |
| Progress tracking | Shows import progress in real-time |
| Batch processing | Imports products efficiently |

---

## Need Help?

If you encounter issues, check:
1. Zoho Creator Settings → Widgets → Logs
2. Browser Developer Console (F12)
3. Form field names match the widget code
