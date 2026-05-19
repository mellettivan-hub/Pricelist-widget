"""
Zoho Inventory API Client
Handles OAuth token refresh and API calls to Zoho Inventory
"""
import os
import httpx
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

class ZohoInventoryClient:
    def __init__(self, db=None):
        self.client_id = os.getenv("ZOHO_CLIENT_ID")
        self.client_secret = os.getenv("ZOHO_CLIENT_SECRET")
        self.organization_id = os.getenv("ZOHO_ORGANIZATION_ID")
        self.api_domain = os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com")
        self.accounts_url = "https://accounts.zoho.com"
        self.db = db
        self._access_token = None
        self._token_expires_at = None
        
    async def _get_stored_token(self) -> Optional[Dict]:
        """Get stored token from database"""
        if self.db is not None:
            token_doc = await self.db.zoho_tokens.find_one({"_id": "inventory_token"})
            return token_doc
        return None
    
    async def _store_token(self, access_token: str, refresh_token: str, expires_in: int):
        """Store token in database"""
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        token_doc = {
            "_id": "inventory_token",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "updated_at": datetime.now(timezone.utc)
        }
        if self.db is not None:
            await self.db.zoho_tokens.update_one(
                {"_id": "inventory_token"},
                {"$set": token_doc},
                upsert=True
            )
        self._access_token = access_token
        self._token_expires_at = expires_at
        
    async def _refresh_access_token(self) -> str:
        """Refresh the access token using refresh token"""
        # Try to get refresh token from DB first, then from env
        stored = await self._get_stored_token()
        refresh_token = stored.get("refresh_token") if stored else None
        if not refresh_token:
            refresh_token = os.getenv("ZOHO_REFRESH_TOKEN")
            
        if not refresh_token:
            raise Exception("No refresh token available")
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.accounts_url}/oauth/v2/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token
                }
            )
            
            if response.status_code != 200:
                raise Exception(f"Token refresh failed: {response.text}")
                
            data = response.json()
            access_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            # Use existing refresh token if new one not provided
            new_refresh = data.get("refresh_token", refresh_token)
            
            await self._store_token(access_token, new_refresh, expires_in)
            return access_token
    
    async def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary"""
        # Check stored token first
        stored = await self._get_stored_token()
        if stored:
            expires_at = stored.get("expires_at")
            if expires_at:
                # Make sure both datetimes are timezone-aware for comparison
                now = datetime.now(timezone.utc)
                if hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
                    # expires_at is naive, assume UTC
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at > now + timedelta(seconds=60):
                    return stored["access_token"]
        
        # Check memory cache
        if self._access_token and self._token_expires_at:
            if self._token_expires_at > datetime.now(timezone.utc) + timedelta(seconds=60):
                return self._access_token
                
        # Need to refresh
        return await self._refresh_access_token()
    
    async def _make_request(self, method: str, endpoint: str, params: Dict = None, json_data: Dict = None) -> Dict:
        """Make an authenticated request to Zoho Inventory API"""
        access_token = await self.get_access_token()
        
        url = f"{self.api_domain}/inventory/v1{endpoint}"
        headers = {
            "Authorization": f"Zoho-oauthtoken {access_token}",
            "Content-Type": "application/json"
        }
        
        # Always include organization_id
        if params is None:
            params = {}
        params["organization_id"] = self.organization_id
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "PUT":
                response = await client.put(url, headers=headers, params=params, json=json_data)
            elif method == "POST":
                response = await client.post(url, headers=headers, params=params, json=json_data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Handle 401 - try refresh and retry once
            if response.status_code == 401:
                access_token = await self._refresh_access_token()
                headers["Authorization"] = f"Zoho-oauthtoken {access_token}"
                if method == "GET":
                    response = await client.get(url, headers=headers, params=params)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, params=params, json=json_data)
                elif method == "POST":
                    response = await client.post(url, headers=headers, params=params, json=json_data)
            
            if response.status_code != 200 and response.status_code != 201:
                raise Exception(f"Zoho API error ({response.status_code}): {response.text}")
                
            return response.json()
    
    async def get_items(self, page: int = 1, per_page: int = 200, status: str = "active") -> Dict:
        """Get items from Zoho Inventory"""
        params = {
            "page": page,
            "per_page": per_page
        }
        if status:
            params["filter_by"] = f"Status.{status.capitalize()}"
            
        return await self._make_request("GET", "/items", params=params)
    
    async def get_all_active_items(self) -> List[Dict]:
        """Get all active items with pagination"""
        all_items = []
        page = 1
        
        while True:
            result = await self.get_items(page=page, per_page=200, status="active")
            items = result.get("items", [])
            all_items.extend(items)
            
            page_context = result.get("page_context", {})
            if not page_context.get("has_more_page", False):
                break
            page += 1
            
        return all_items
    
    async def update_item_prices(self, item_id: str, purchase_rate: float, rate: float) -> Dict:
        """Update item's cost price (purchase_rate) and selling price (rate)"""
        data = {
            "purchase_rate": purchase_rate,
            "rate": rate
        }
        return await self._make_request("PUT", f"/items/{item_id}", json_data=data)
    
    async def update_item(self, item_id: str, data: Dict) -> Dict:
        """Update item with any fields"""
        return await self._make_request("PUT", f"/items/{item_id}", json_data=data)
    
    async def get_item(self, item_id: str) -> Dict:
        """Get a single item by ID with full details"""
        return await self._make_request("GET", f"/items/{item_id}")
