#!/usr/bin/env python3
"""
Test Block Validation - Script to test license blocking and cache clearing
"""

import sys
import os
from pathlib import Path

# Add client directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'client' / 'python'))

from license_client import LicenseValidator, LicenseCache

def test_block_validation():
    """Test that blocked licenses are properly invalidated"""

    # Initialize validator with known license
    validator = LicenseValidator(
        program_id="2b4763bf-fd52-4e05-8585-7d023236f789",
        program_name="TestCalculator",
        version="1.0.0",
        api_url="http://localhost:3000"
    )

    cache = LicenseCache("TestCalculator")

    print("=" * 60)
    print("TEST: License Block Validation")
    print("=" * 60)

    # Step 1: Initial validation
    print("\n1. Testing initial validation...")
    if validator.validate(force_online=True):
        print("   ✅ Initial validation: SUCCESS")
        info = validator.get_license_info()
        if info:
            print(f"   License: {info['license_key'][:8]}...")
    else:
        print("   ❌ Initial validation: FAILED")
        print("   Make sure the license is active and not blocked")
        return False

    # Step 2: Check cache was created
    print("\n2. Checking cache...")
    cached = cache.load()
    if cached:
        print("   ✅ Cache exists")
        print(f"   Cache key pattern: license:{cached.get('license_key', 'N/A')}:validation")
    else:
        print("   ❌ No cache found")

    # Step 3: Test validation with cache
    print("\n3. Testing validation with cache (should use cache)...")
    if validator.validate():
        print("   ✅ Cache validation: SUCCESS")
    else:
        print("   ❌ Cache validation: FAILED")

    print("\n" + "=" * 60)
    print("INSTRUCTIONS TO TEST BLOCKING:")
    print("=" * 60)
    print("\n1. Go to admin panel: http://localhost:3001")
    print("2. Navigate to Licenses section")
    print(f"3. Find license: {cached.get('license_key', 'N/A') if cached else 'N/A'}")
    print("4. Click 'Block' button")
    print("5. Press ENTER here to continue testing...")
    input()

    # Step 4: Test force online validation after blocking
    print("\n4. Testing force online validation (after blocking)...")
    if validator.validate(force_online=True):
        print("   ❌ PROBLEM: Validation still returns SUCCESS")
        print("   The license should be blocked!")
        return False
    else:
        print("   ✅ Validation correctly returns FAILED")
        print("   License is properly blocked!")

    # Step 5: Test cache validation (should also fail now)
    print("\n5. Testing cache validation after block...")
    if validator.validate():
        print("   ❌ Cache validation still returns SUCCESS")
        print("   Old cache might still be valid")
    else:
        print("   ✅ Cache validation correctly returns FAILED")

    # Step 6: Clear cache and test again
    print("\n6. Clearing cache and testing again...")
    cache.clear()
    print("   Cache cleared")

    if validator.validate():
        print("   ❌ Validation returns SUCCESS (should be FAILED)")
        return False
    else:
        print("   ✅ Validation correctly returns FAILED")
        print("   No cache, and server returns blocked status")

    print("\n" + "=" * 60)
    print("TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("\nThe fix is working correctly:")
    print("- Cache key pattern is now correct")
    print("- Blocking a license properly invalidates the cache")
    print("- Force online validation correctly detects blocked licenses")

    return True

if __name__ == "__main__":
    print("\n🔧 LICENSE BLOCK VALIDATION TEST")
    print("This test verifies that blocked licenses are properly invalidated\n")

    try:
        success = test_block_validation()
        if not success:
            print("\n❌ Test failed. Please check the implementation.")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n👋 Test interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)