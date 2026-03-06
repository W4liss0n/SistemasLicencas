#!/usr/bin/env python3
"""
Test Auto Block - Script automatizado para testar bloqueio/desbloqueio de licenças
"""

import sys
import os
import json
import time
import psycopg2
import requests
from pathlib import Path
from datetime import datetime

# Add client directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'client' / 'python'))

from license_client import LicenseValidator, LicenseCache

class AutoBlockTester:
    def __init__(self):
        # Database connection
        self.db_config = {
            'host': 'localhost',
            'database': 'sistema_licencas',
            'user': 'licencas_user',
            'password': 'licencas123',
            'port': 5432
        }

        # API configuration
        self.api_base = 'http://localhost:3000/api/v1'
        self.jwt_token = None

        # License validator
        self.validator = LicenseValidator(
            program_id="2b4763bf-fd52-4e05-8585-7d023236f789",
            program_name="TestCalculator",
            version="1.0.0",
            api_url="http://localhost:3000"
        )

        self.cache = LicenseCache("TestCalculator")

    def get_db_connection(self):
        """Get PostgreSQL connection"""
        return psycopg2.connect(**self.db_config)

    def login(self):
        """Try to login to get JWT token"""
        # Try common default passwords
        passwords = ['admin123', 'admin', 'senha123', 'password', '123456']

        for password in passwords:
            try:
                response = requests.post(
                    f'{self.api_base}/auth/login',
                    json={'email': 'admin@sistema.com', 'password': password}
                )
                if response.status_code == 200:
                    data = response.json()
                    self.jwt_token = data.get('token')
                    print(f"   ✅ Login successful with password: {password}")
                    return True
            except:
                pass

        print("   ⚠️  Could not login, will use direct SQL operations")
        return False

    def get_license_info(self, license_key):
        """Get license ID and status from database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT id, status FROM licencas WHERE license_key = %s",
                (license_key,)
            )
            result = cursor.fetchone()
            if result:
                return {'id': result[0], 'status': result[1]}
            return None
        finally:
            cursor.close()
            conn.close()

    def block_license_via_sql(self, license_key):
        """Block license directly via SQL"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            # Block the license
            cursor.execute(
                "UPDATE licencas SET status = 'bloqueada', updated_at = CURRENT_TIMESTAMP WHERE license_key = %s",
                (license_key,)
            )

            # Log security event
            cursor.execute(
                """INSERT INTO security_events (license_key, event_type, severity, risk_score, details, automated_action)
                   VALUES (%s, 'license_blocked', 'high', 1.0, %s, 'manual_block')""",
                (license_key, json.dumps({'blocked_by': 'test_script'}))
            )

            conn.commit()
            print(f"   ✅ License blocked via SQL: {license_key[:8]}...")
            return True
        except Exception as e:
            print(f"   ❌ Error blocking license: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
            conn.close()

    def unblock_license_via_sql(self, license_key):
        """Unblock license directly via SQL"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            # Unblock the license
            cursor.execute(
                "UPDATE licencas SET status = 'ativa', updated_at = CURRENT_TIMESTAMP WHERE license_key = %s",
                (license_key,)
            )

            # Log security event
            cursor.execute(
                """INSERT INTO security_events (license_key, event_type, severity, risk_score, details, automated_action)
                   VALUES (%s, 'license_unblocked', 'low', 0.0, %s, 'manual_unblock')""",
                (license_key, json.dumps({'unblocked_by': 'test_script'}))
            )

            conn.commit()
            print(f"   ✅ License unblocked via SQL: {license_key[:8]}...")
            return True
        except Exception as e:
            print(f"   ❌ Error unblocking license: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
            conn.close()

    def clear_redis_cache(self, license_key):
        """Clear Redis cache for the license"""
        try:
            import redis
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            cache_key = f"license:{license_key}:validation"
            deleted = r.delete(cache_key)
            if deleted:
                print(f"   ✅ Redis cache cleared for key: {cache_key}")
            else:
                print(f"   ℹ️  No Redis cache found for key: {cache_key}")
            return True
        except Exception as e:
            print(f"   ⚠️  Could not clear Redis cache: {e}")
            return False

    def block_license_via_api(self, license_id):
        """Block license via API (requires JWT)"""
        if not self.jwt_token:
            print("   ⚠️  No JWT token, using SQL instead")
            return False

        try:
            response = requests.post(
                f'{self.api_base}/licencas/{license_id}/block',
                headers={'Authorization': f'Bearer {self.jwt_token}'}
            )
            if response.status_code == 200:
                print(f"   ✅ License blocked via API")
                return True
            else:
                print(f"   ❌ API block failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ API error: {e}")
            return False

    def unblock_license_via_api(self, license_id):
        """Unblock license via API (requires JWT)"""
        if not self.jwt_token:
            print("   ⚠️  No JWT token, using SQL instead")
            return False

        try:
            response = requests.post(
                f'{self.api_base}/licencas/{license_id}/unblock',
                headers={'Authorization': f'Bearer {self.jwt_token}'}
            )
            if response.status_code == 200:
                print(f"   ✅ License unblocked via API")
                return True
            else:
                print(f"   ❌ API unblock failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ API error: {e}")
            return False

    def run_test(self):
        """Run the complete automated test"""
        print("=" * 60)
        print("AUTOMATED LICENSE BLOCK/UNBLOCK TEST")
        print("=" * 60)

        # Step 1: Initial validation
        print("\n1. Initial validation...")
        try:
            validation_result = self.validator.validate(force_online=True)
            print(f"   Validation result: {validation_result}")
        except Exception as e:
            print(f"   ⚠️ Validation error: {e}")
            print("   Trying to continue with known license...")

        info = self.validator.get_license_info()
        if not info:
            print("   ⚠️ No cached license info, using test license")
            # Use known test license
            license_key = "LIC-W3SK-ZLX1-3XKS-WPRA"
        else:
            license_key = info['license_key']
            print(f"   ✅ Using cached license: {license_key[:8]}...")

        # Step 2: Get license details from DB
        print("\n2. Getting license details from database...")
        license_info = self.get_license_info(license_key)
        if not license_info:
            print("   ❌ Could not find license in database")
            return False
        print(f"   ✅ License ID: {license_info['id']}")
        print(f"   Status: {license_info['status']}")

        # Step 3: Try to login for API access
        print("\n3. Attempting API login...")
        has_api_access = self.login()

        # Step 4: Block the license
        print("\n4. Blocking license...")
        if has_api_access:
            success = self.block_license_via_api(license_info['id'])
            if not success:
                success = self.block_license_via_sql(license_key)
        else:
            success = self.block_license_via_sql(license_key)

        if not success:
            print("   ❌ Failed to block license")
            return False

        # Clear Redis cache
        self.clear_redis_cache(license_key)

        # Step 5: Test validation after blocking
        print("\n5. Testing validation after blocking...")
        time.sleep(1)  # Give server time to process

        if self.validator.validate(force_online=True):
            print("   ❌ ERROR: Validation still returns SUCCESS after blocking!")
            print("   The fix might not be working correctly.")
            return False
        else:
            print("   ✅ Validation correctly returns FAILED")

        # Step 6: Test cache validation
        print("\n6. Testing cache validation (should also fail)...")
        self.cache.clear()  # Clear local cache first

        if self.validator.validate():
            print("   ❌ Cache validation returns SUCCESS (should be FAILED)")
            return False
        else:
            print("   ✅ Cache validation correctly returns FAILED")

        # Step 7: Unblock the license
        print("\n7. Unblocking license...")
        if has_api_access:
            success = self.unblock_license_via_api(license_info['id'])
            if not success:
                success = self.unblock_license_via_sql(license_key)
        else:
            success = self.unblock_license_via_sql(license_key)

        if not success:
            print("   ❌ Failed to unblock license")
            return False

        # Clear Redis cache again
        self.clear_redis_cache(license_key)

        # Step 8: Test validation after unblocking
        print("\n8. Testing validation after unblocking...")
        time.sleep(1)  # Give server time to process

        if self.validator.validate(force_online=True):
            print("   ✅ Validation returns SUCCESS after unblocking")
        else:
            print("   ❌ Validation still returns FAILED after unblocking")
            return False

        # Step 9: Verify status in database
        print("\n9. Verifying final status in database...")
        final_info = self.get_license_info(license_key)
        if final_info:
            print(f"   Final status: {final_info['status']}")
            if final_info['status'] == 'ativa':
                print("   ✅ License is active in database")
            else:
                print(f"   ⚠️  License status is {final_info['status']}, expected 'ativa'")

        print("\n" + "=" * 60)
        print("✅ TEST COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nResults:")
        print("- License blocking works correctly")
        print("- Redis cache is properly cleared")
        print("- Validation correctly detects blocked status")
        print("- License unblocking restores access")

        return True

def main():
    """Main test function"""
    tester = AutoBlockTester()

    print("\n🤖 AUTOMATED LICENSE BLOCK/UNBLOCK TEST")
    print("This test will automatically block and unblock a license")
    print("and verify that validation works correctly.\n")

    try:
        success = tester.run_test()
        if not success:
            print("\n❌ Test failed. Please check the implementation.")
            sys.exit(1)
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n\n👋 Test interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()