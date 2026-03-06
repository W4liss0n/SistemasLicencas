"""
License management module - v3.3 Modularized

This package provides license validation and management functionality:
- LicenseValidator: Main validation class
- LicenseCache: Encrypted local cache with HMAC and Registry HWM
- FingerprintGenerator: Device fingerprint generation
- SecurityException: Custom exception for security violations
- Constants: ERROR_MESSAGES, SOFT_CHECK_INTERVAL_DAYS

Compatible with license_client v3.3.
"""

# Import all modular components
from src.licensing.cache import LicenseCache
from src.licensing.constants import ERROR_MESSAGES, SOFT_CHECK_INTERVAL_DAYS
from src.licensing.exceptions import SecurityException
from src.licensing.fingerprint import FingerprintGenerator
from src.licensing.logger import logger, obfuscate_license_key, obfuscate_token
from src.licensing.validator import LicenseValidator

__all__ = [
    "LicenseValidator",
    "LicenseCache",
    "FingerprintGenerator",
    "SecurityException",
    "ERROR_MESSAGES",
    "SOFT_CHECK_INTERVAL_DAYS",
    "logger",
    "obfuscate_license_key",
    "obfuscate_token",
]

__version__ = "3.3.0"
