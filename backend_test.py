import requests
import sys
import json
from datetime import datetime
import io

class PriceCheckAPITester:
    def __init__(self, base_url="https://price-compare-273.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.vendor_id = None
        self.vendor_name = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, params=params)
                else:
                    response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")

            return success, response.json() if response.text and response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_stats_endpoint(self):
        """Test stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET", 
            "stats",
            200
        )
        if success:
            required_keys = ['vendors', 'price_lists', 'products']
            for key in required_keys:
                if key not in response:
                    print(f"❌ Missing key '{key}' in stats response")
                    return False
        return success

    def test_create_vendor(self):
        """Test vendor creation"""
        test_vendor = {
            "name": f"Test Vendor {datetime.now().strftime('%H%M%S')}",
            "contact_email": "test@vendor.com",
            "contact_phone": "+27 11 123 4567"
        }
        
        success, response = self.run_test(
            "Create Vendor",
            "POST",
            "vendors",
            200,
            data=test_vendor
        )
        
        if success and 'id' in response:
            self.vendor_id = response['id']
            self.vendor_name = response['name']
            print(f"   Created vendor ID: {self.vendor_id}")
        
        return success

    def test_get_vendors(self):
        """Test get all vendors"""
        success, response = self.run_test(
            "Get All Vendors",
            "GET",
            "vendors", 
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} vendors")
        
        return success

    def test_get_vendor_by_id(self):
        """Test get vendor by ID"""
        if not self.vendor_id:
            print("❌ No vendor ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Vendor by ID",
            "GET",
            f"vendors/{self.vendor_id}",
            200
        )
        return success

    def test_search_products_empty(self):
        """Test search with no products"""
        success, response = self.run_test(
            "Search Products (Empty DB)",
            "GET",
            "search",
            200,
            params={"q": "test", "search_type": "both"}
        )
        
        if success:
            if 'results' not in response:
                print("❌ Missing 'results' key in search response")
                return False
            if 'count' not in response:
                print("❌ Missing 'count' key in search response")
                return False
        
        return success

    def test_price_lists_empty(self):
        """Test get price lists when empty"""
        success, response = self.run_test(
            "Get Price Lists (Empty)",
            "GET",
            "price-lists",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} price lists")
        
        return success

    def test_price_history_empty(self):
        """Test get price history when empty"""
        success, response = self.run_test(
            "Get Price History (Empty)",
            "GET",
            "price-history",
            200,
            params={"limit": 10}
        )
        
        if success:
            if 'history' not in response:
                print("❌ Missing 'history' key in price history response")
                return False
        
        return success

    def test_upload_without_file(self):
        """Test upload endpoint without file (should fail)"""
        if not self.vendor_id:
            print("❌ No vendor ID available for upload testing")
            return False
            
        success, response = self.run_test(
            "Upload Without File (Should Fail)",
            "POST",
            "upload",
            422,  # Expecting validation error
            params={"vendor_id": self.vendor_id, "vendor_name": self.vendor_name}
        )
        return success

    def test_delete_vendor(self):
        """Test vendor deletion"""
        if not self.vendor_id:
            print("❌ No vendor ID available for deletion testing")
            return False
            
        success, response = self.run_test(
            "Delete Vendor",
            "DELETE",
            f"vendors/{self.vendor_id}",
            200
        )
        return success

    def test_invalid_endpoints(self):
        """Test invalid endpoints"""
        success, response = self.run_test(
            "Invalid Endpoint (Should 404)",
            "GET",
            "invalid-endpoint",
            404
        )
        return success

def main():
    print("🚀 Starting Price Check API Tests")
    print("=" * 50)
    
    tester = PriceCheckAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_stats_endpoint,
        tester.test_create_vendor,
        tester.test_get_vendors,
        tester.test_get_vendor_by_id,
        tester.test_search_products_empty,
        tester.test_price_lists_empty,
        tester.test_price_history_empty,
        tester.test_upload_without_file,
        tester.test_delete_vendor,
        tester.test_invalid_endpoints
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())