"""
Encrypted local license cache management with HMAC and Registry HWM.

This module handles:
- Encrypted cache storage with Fernet (AES-256-GCM)
- HMAC integrity verification
- Registry-based High Water Mark (Windows only)
- Clock manipulation detection

Compatible with license_client v3.3.
"""

import base64
import hashlib
import hmac
import json
import os
import platform
import random
import threading
from datetime import datetime, timedelta
from datetime import timezone as tz
from pathlib import Path
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from src.licensing.exceptions import SecurityException
from src.licensing.fingerprint import FingerprintGenerator
from src.licensing.logger import logger

# Conditional import for Windows Registry
if platform.system() == "Windows":
    import winreg
else:
    winreg = None  # type: ignore[assignment]


class LicenseCache:
    """Manage encrypted local license cache with HMAC and Registry HWM"""

    # SECURITY v3.0: Secret salt for HMAC (obfuscated)
    _SECRET_SALT = b"\x7a\x3f\x9e\x21\x4c\x8b\x6d\x12\xf3\xa7\x5e\x82\xc4\xd6\x1f\x38"

    def __init__(self, app_name: str):
        """Initialize cache manager

        Args:
            app_name: Application name for cache directory
        """
        self.app_name = app_name
        self.cache_dir = self._get_cache_dir()
        self.cache_file = self.cache_dir / "license.dat"
        self.error_log_file = self.cache_dir / "errors.log"
        self._cache_lock = threading.RLock()  # Reentrant lock for nested calls

    def _get_cache_dir(self) -> Path:
        """Get appropriate cache directory for the OS

        Returns:
            Path: Cache directory path
        """
        if platform.system() == "Windows":
            base_dir = Path(os.environ.get("APPDATA", "~"))
        elif platform.system() == "Darwin":
            base_dir = Path.home() / "Library" / "Application Support"
        else:
            base_dir = Path.home() / ".config"

        cache_dir = base_dir / self.app_name
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir

    def _derive_key(self) -> bytes:
        """Derive encryption key from hardware ONLY (v3.0)

        NEW v3.0: Simplified - no license_key or fingerprint_hash needed
        - Key derived ONLY from hardware (machine_id + disk_serial)
        - Cache is automatically invalidated if hardware changes
        - No need for .license_meta file anymore

        Security:
        - Cache cannot be transferred between different PCs
        - If hardware changes significantly, cache is lost (user needs to re-login)
        - This is acceptable since cache is disposable (temporary offline storage)

        Returns:
            bytes: Fernet-compatible encryption key
        """
        machine_id = FingerprintGenerator.get_machine_id()
        disk_serial = FingerprintGenerator.get_disk_serial()

        # Key material: app_name + hardware identifiers
        key_material = f"{self.app_name}|{machine_id}|{disk_serial}"

        # Fixed salt for v3.0
        salt = b"license_cache_v3.0"

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend(),
        )

        key = base64.urlsafe_b64encode(kdf.derive(key_material.encode()))
        return key

    def _calculate_hmac(self, data: Dict[str, Any]) -> str:
        """Calculate HMAC signature for cache integrity (v3.0)

        NEW v3.0: HMAC for tamper detection
        - Uses hardware + secret salt
        - Detects any modification to critical fields
        - Secret salt is obfuscated in code

        Security:
        - Hacker needs to find SECRET_SALT via reverse engineering
        - Even if found, still protected by JWT RSA signature
        - Acts as an additional layer of defense

        Args:
            data: Cache data to sign

        Returns:
            str: HMAC signature (hex)
        """
        machine_id = FingerprintGenerator.get_machine_id()

        # HMAC key = hash(machine_id + secret_salt)
        hmac_key = hashlib.sha256(machine_id.encode() + self._SECRET_SALT).digest()

        # Critical fields to sign
        critical_fields = {
            "offline_token": data.get("offline_token"),
            "public_key": data.get("public_key"),
            "license_key": data.get("license_key"),
            "fingerprint_hash": data.get("fingerprint_hash"),
        }

        # Serialize in deterministic order
        data_str = json.dumps(critical_fields, sort_keys=True)

        # Calculate HMAC-SHA256
        signature = hmac.new(hmac_key, data_str.encode(), hashlib.sha256).hexdigest()

        return signature

    def save(self, data: Dict[str, Any]) -> bool:
        """Save encrypted data to cache with HMAC integrity check (v3.0)

        NEW v3.0: Simplified - no parameters needed
        - Encryption key derived ONLY from hardware
        - HMAC signature added for tamper detection
        - No .license_meta file needed
        - Thread-safe with lock

        Args:
            data: Data to cache (must include offline_token, public_key, license_key)

        Returns:
            bool: True if saved successfully
        """
        logger.debug("Saving cache data")
        with self._cache_lock:
            return self._save_unlocked(data)

    def _save_unlocked(self, data: Dict[str, Any]) -> bool:
        """Internal save implementation (called with lock held)

        Args:
            data: Cache data to save

        Returns:
            bool: True if saved successfully
        """
        try:
            # Ensure version field
            if "version" not in data:
                data["version"] = "3.0"

            # Calculate HMAC signature BEFORE encrypting
            data["_signature"] = self._calculate_hmac(data)

            # Derive key from hardware only
            key = self._derive_key()

            # Encrypt entire data (including HMAC)
            fernet = Fernet(key)
            encrypted_data = fernet.encrypt(json.dumps(data).encode())

            # Write to file
            with open(self.cache_file, "wb") as f:
                f.write(encrypted_data)

            # Set file permissions (read/write for owner only)
            if platform.system() != "Windows":
                os.chmod(self.cache_file, 0o600)

            logger.info("Cache saved successfully")
            return True

        except (IOError, OSError, ValueError, TypeError, json.JSONDecodeError) as e:
            # Log error for debugging
            logger.error(f"Failed to save cache: {e}")
            self.log_error("cache_save_failed", str(e))
            return False

    def load(self) -> Optional[Dict[str, Any]]:
        """Load and decrypt cached data with HMAC validation (v3.0)

        NEW v3.0: Simplified - no parameters needed
        - Decryption key derived from hardware only
        - HMAC signature validated for tamper detection
        - Automatic migration from v2.x to v3.0
        - Thread-safe with lock

        Returns:
            dict: Cached data or None if not found/invalid
        """
        logger.debug("Loading cache data")
        with self._cache_lock:
            return self._load_unlocked()

    def _load_unlocked(self) -> Optional[Dict[str, Any]]:
        """Internal load implementation (called with lock held)

        Returns:
            dict: Cached data or None if not found/invalid
        """
        if not self.cache_file.exists():
            logger.debug("Cache file does not exist")
            return None

        try:
            # Read encrypted file
            with open(self.cache_file, "rb") as f:
                encrypted_data = f.read()

            # Derive key from hardware
            key = self._derive_key()

            # Decrypt
            fernet = Fernet(key)
            decrypted_data = fernet.decrypt(encrypted_data)
            data = json.loads(decrypted_data)

            # Check version
            version = data.get("version", "2.1")

            # Migrate old versions to v3.0
            if version in ["1.0", "2.0", "2.1"]:
                # Old cache - migrate to v3.0
                # Note: v1.0/v2.0 caches without offline_token will be rejected
                if not data.get("offline_token"):
                    # No JWT token - cannot migrate, force re-login
                    self.cache_file.unlink(missing_ok=True)
                    return None

                # Update version
                data["version"] = "3.0"

                # Calculate and add HMAC (missing in old versions)
                # Skip HMAC validation for migration (add it now)
                data["_signature"] = self._calculate_hmac(data)

                # Save migrated cache
                self.save(data)

                # Remove old .license_meta if exists
                meta_file = self.cache_dir / ".license_meta"
                if meta_file.exists():
                    meta_file.unlink(missing_ok=True)

                return data  # type: ignore[no-any-return]

            # v3.0 cache - validate HMAC
            stored_signature: Optional[str] = data.pop("_signature", None)

            if not stored_signature:
                # No HMAC signature - corrupted cache
                self.log_error("cache_tampered", "Missing HMAC signature")
                self.cache_file.unlink(missing_ok=True)
                return None

            # Calculate expected HMAC
            expected_signature = self._calculate_hmac(data)

            if stored_signature != expected_signature:
                # HMAC mismatch - cache was tampered!
                logger.error("Cache HMAC mismatch - cache was tampered")
                self.log_error(
                    "cache_tampered",
                    "HMAC mismatch - cache modified",
                    {
                        "expected": expected_signature[:16],
                        "stored": stored_signature[:16],
                    },
                )
                self.cache_file.unlink(missing_ok=True)
                return None

            # HMAC valid - return data
            logger.info("Cache loaded and validated successfully")
            return data  # type: ignore[no-any-return]

        except (IOError, OSError, ValueError, TypeError, json.JSONDecodeError) as e:
            # Decryption failed or corrupted cache
            logger.error(f"Failed to load cache: {e}")
            self.log_error("cache_load_failed", str(e))
            self.cache_file.unlink(missing_ok=True)
            return None

    def clear(self) -> None:
        """Clear cache file (v3.0)

        NEW v3.0: Simplified - only clears license.dat
        - No .license_meta to delete
        - Cleans up old v1.0/v2.0 files if they exist
        - HWM file is NEVER deleted (security anchor)
        """
        logger.info("Clearing cache files")
        self.cache_file.unlink(missing_ok=True)

        # Clean up old files if they exist
        meta_file = self.cache_dir / ".license_meta"  # v2.x
        config_file = self.cache_dir / "config.json"  # v1.0
        counter_file = self.cache_dir / "validation_counter.dat"  # v1.0

        meta_file.unlink(missing_ok=True)
        config_file.unlink(missing_ok=True)
        counter_file.unlink(missing_ok=True)

        # IMPORTANT v3.0: HWM file is NEVER deleted
        # It must persist to prevent time manipulation attacks
        # Even if user clears cache, HWM remains as security anchor

    # =====================================================================
    # REGISTRY HIGH WATER MARK (HWM) - Windows Only
    # =====================================================================

    def _derive_registry_key(self) -> bytes:
        """Derive encryption key for registry HWM value (v3.0 obfuscated)

        Security:
        - Key derived from hardware (machine_id + disk_serial)
        - Different salt than file/cache to prevent key reuse
        - Deterministic (same key on same machine)

        Returns:
            bytes: Fernet-compatible encryption key
        """
        machine_id = FingerprintGenerator.get_machine_id()
        disk_serial = FingerprintGenerator.get_disk_serial()

        # Key material: hardware identifiers
        key_material = f"{self.app_name}|{machine_id}|{disk_serial}|registry"

        # Unique salt for registry (different from file)
        salt = b"registry_hwm_v3.0_obfuscated"

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend(),
        )

        return base64.urlsafe_b64encode(kdf.derive(key_material.encode()))

    def _get_real_registry_value_name(self) -> str:
        """Get deterministic name for the REAL registry value (v3.0)

        The real value is hidden among decoys.
        Name is derived from machine_id so it's consistent across runs.

        Returns:
            str: Value name (e.g., "Cache_a3f9e21c")
        """
        machine_id = FingerprintGenerator.get_machine_id()
        hash_real = hashlib.sha256(
            f"{self.app_name}_{machine_id}_hwm_real_v3".encode()
        ).hexdigest()[:8]
        return f"Cache_{hash_real}"

    def _encrypt_registry_hwm(self, hwm_timestamp: str) -> str:
        """Encrypt HWM timestamp for registry with integrity check (v3.0)

        Security:
        1. Fernet encryption (AES-256-GCM with authentication)
        2. Internal hash for integrity verification
        3. Metadata for validation

        Args:
            hwm_timestamp: UTC timestamp string

        Returns:
            str: Encrypted blob (base64)
        """
        # Prepare data with metadata
        data = {
            "hwm_utc": hwm_timestamp,
            "version": "3.0",
            "created_at": datetime.now().isoformat(),
        }

        # Calculate integrity hash
        data_str = json.dumps(data, sort_keys=True)
        integrity_hash = hashlib.sha256(data_str.encode()).hexdigest()[:16]

        # Add hash to data
        data["_integrity"] = integrity_hash

        # Encrypt
        key = self._derive_registry_key()
        fernet = Fernet(key)
        encrypted = fernet.encrypt(json.dumps(data).encode())

        result: str = encrypted.decode("utf-8")
        return result

    def _decrypt_registry_hwm(self, encrypted_blob: str) -> Optional[str]:
        """Decrypt and validate HWM from registry (v3.0)

        Validates:
        1. Fernet decryption (authenticated encryption)
        2. Internal integrity hash

        Args:
            encrypted_blob: Base64 encrypted string

        Returns:
            str: HWM timestamp or None if failed/invalid
        """
        try:
            # Decrypt
            key = self._derive_registry_key()
            fernet = Fernet(key)
            decrypted = fernet.decrypt(encrypted_blob.encode())
            data = json.loads(decrypted)

            # Validate integrity hash
            stored_hash = data.pop("_integrity", None)

            # Recalculate expected hash
            data_str = json.dumps(data, sort_keys=True)
            expected_hash = hashlib.sha256(data_str.encode()).hexdigest()[:16]

            if stored_hash != expected_hash:
                # Integrity check failed
                return None

            hwm_result: Optional[str] = data.get("hwm_utc")
            return hwm_result

        except (ValueError, TypeError, json.JSONDecodeError, OSError):
            return None

    def _create_decoys(self, reg_key, real_value_name: str, count: int = 7) -> None:
        """Create fake registry values (decoys) (v3.0)

        Creates multiple encrypted fake HWM values to hide the real one.
        Each decoy looks identical to the real value.

        Args:
            reg_key: Open registry key handle
            real_value_name: Name of real value (to avoid overwriting)
            count: Number of decoys to create (default: 7)
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        try:
            for i in range(count):
                # Generate unique decoy name
                decoy_hash = hashlib.sha256(
                    f"{random.random()}_{i}_{datetime.now()}".encode()
                ).hexdigest()[:8]
                decoy_name = f"Cache_{decoy_hash}"

                # Don't overwrite the real value
                if decoy_name == real_value_name:
                    continue

                # Generate fake timestamp (1-180 days ago)
                fake_days = random.randint(1, 180)
                fake_time = (datetime.now() - timedelta(days=fake_days)).isoformat()

                # Encrypt fake timestamp (looks real!)
                encrypted_fake = self._encrypt_registry_hwm(fake_time)

                # Save decoy
                winreg.SetValueEx(reg_key, decoy_name, 0, winreg.REG_SZ, encrypted_fake)

        except (OSError, AttributeError, ValueError):
            # Silently fail (decoys are optional)
            pass

    def _delete_old_decoys(self, reg_key, real_value_name: str) -> None:
        """Delete old decoy values before creating new ones (v3.0)

        Keeps only:
        - Real value
        - Legitimate values (InstallDate, Version, etc.)

        Args:
            reg_key: Open registry key handle
            real_value_name: Name of real value (to preserve)
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        try:
            # Legitimate values to preserve
            legitimate_values = {"InstallDate", "Version", "LastUpdate"}

            # List all values
            i = 0
            values_to_delete = []

            try:
                while True:
                    value_name, _, _ = winreg.EnumValue(reg_key, i)

                    # Delete if:
                    # - Starts with "Cache_" (decoy pattern)
                    # - Is NOT the real value
                    if (
                        value_name.startswith("Cache_")
                        and value_name != real_value_name
                        and value_name not in legitimate_values
                    ):
                        values_to_delete.append(value_name)

                    i += 1
            except OSError:
                # No more values
                pass

            # Delete old decoys
            for value_name in values_to_delete:
                try:
                    winreg.DeleteValue(reg_key, value_name)
                except OSError:
                    pass

        except (OSError, AttributeError):
            # Silently fail
            pass

    def _save_hwm_to_registry(self, hwm_timestamp: str) -> bool:
        """Save HWM to Windows Registry with obfuscation + decoys (v3.0)

        NEW v3.0: Complete obfuscation system
        1. Encrypts timestamp with Fernet (hardware-derived key)
        2. Adds integrity hash
        3. Hides real value among 5-10 fake decoys
        4. Rotates decoys on each save
        5. Uses deterministic name for real value

        Security:
        - Attacker cannot easily find which value is real
        - All values look identical (encrypted blobs)
        - Decoys change each time (confuses)
        - Even if found, encrypted with hardware key

        Args:
            hwm_timestamp: UTC timestamp string

        Returns:
            bool: True if saved successfully
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        try:
            # Get deterministic name for real value
            real_value_name = self._get_real_registry_value_name()

            # Encrypt timestamp with integrity check
            encrypted_real = self._encrypt_registry_hwm(hwm_timestamp)

            # Open/create registry key
            key_path = f"SOFTWARE\\{self.app_name}"
            reg_key = winreg.CreateKeyEx(
                winreg.HKEY_CURRENT_USER,
                key_path,
                0,
                winreg.KEY_WRITE | winreg.KEY_READ,
            )

            # Save legitimate values (once)
            try:
                winreg.QueryValueEx(reg_key, "InstallDate")
            except FileNotFoundError:
                # First time - create InstallDate
                winreg.SetValueEx(
                    reg_key,
                    "InstallDate",
                    0,
                    winreg.REG_SZ,
                    datetime.now().isoformat(),
                )

            # Save version
            winreg.SetValueEx(reg_key, "Version", 0, winreg.REG_SZ, "3.0")

            # Save REAL value
            winreg.SetValueEx(
                reg_key, real_value_name, 0, winreg.REG_SZ, encrypted_real
            )

            # Delete old decoys
            self._delete_old_decoys(reg_key, real_value_name)

            # Create new decoys (5-10 random)
            decoy_count = random.randint(5, 10)
            self._create_decoys(reg_key, real_value_name, count=decoy_count)

            # Update LastUpdate
            winreg.SetValueEx(
                reg_key, "LastUpdate", 0, winreg.REG_SZ, datetime.now().isoformat()
            )

            winreg.CloseKey(reg_key)
            return True

        except (OSError, AttributeError, ValueError) as e:
            self.log_error("registry_save_failed", str(e))
            return False

    def _load_hwm_from_registry(self) -> Optional[str]:
        """Load HWM from Windows Registry with decryption (v3.0)

        NEW v3.0: Finds and decrypts real value among decoys
        - Uses deterministic name to find real value
        - Decrypts with hardware-derived key
        - Validates integrity hash

        Returns:
            str: HWM timestamp or None if not found/invalid
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        try:
            # Get deterministic name of real value
            real_value_name = self._get_real_registry_value_name()

            # Open registry key
            key_path = f"SOFTWARE\\{self.app_name}"
            reg_key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ
            )

            # Read real value (encrypted blob)
            encrypted_blob, _ = winreg.QueryValueEx(reg_key, real_value_name)
            winreg.CloseKey(reg_key)

            # Decrypt and validate
            hwm_timestamp = self._decrypt_registry_hwm(encrypted_blob)

            return hwm_timestamp

        except FileNotFoundError:
            # Registry key doesn't exist
            return None
        except (OSError, AttributeError, ValueError):
            # Value not found or decryption failed
            return None

    def _registry_install_exists(self) -> bool:
        """Check if registry confirms previous installation

        Returns:
            bool: True if InstallDate exists in registry
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        try:
            key_path = r"SOFTWARE\{}".format(self.app_name)

            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ)

            install_date, _ = winreg.QueryValueEx(key, "InstallDate")
            winreg.CloseKey(key)

            return install_date is not None

        except (OSError, FileNotFoundError, AttributeError):
            return False

    def validate_hwm(
        self, current_utc_str: str, _jwt_iat: Optional[str] = None
    ) -> bool:
        """Validate HWM during license validation (v3.3 - Registry Only)

        NEW v3.3: Simplified - apenas atualiza registro após validação bem-sucedida
        - update_hwm_on_startup() já fez toda a validação pesada no início
        - Este método apenas atualiza o registro do Windows com o tempo atual
        - Mantém sincronização entre execuções durante validações offline

        Args:
            current_utc_str: Current time in UTC ISO format
            _jwt_iat: JWT issued-at timestamp (mantido por compatibilidade, mas não usado)

        Returns:
            bool: True if updated successfully

        Raises:
            SecurityException: Se houver problema crítico ao atualizar registro
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        # v3.3: Validação simplificada - apenas atualiza registro
        # update_hwm_on_startup() já validou tudo no início do programa
        try:
            logger.debug(f"Updating HWM registry after validation: {current_utc_str}")

            # Simply update registry with current time
            result = self._save_hwm_to_registry(current_utc_str)

            if result:
                logger.info("HWM registry updated successfully")
            else:
                logger.warning("Failed to update HWM registry (non-critical)")

            return result

        except Exception as e:
            self.log_error("hwm_update_failed", str(e))
            # Non-critical - don't block validation if registry update fails
            logger.error(f"Error updating HWM: {e}")
            return False

    def update_hwm_on_startup(self) -> bool:
        """Update HWM on program startup (v3.3 - Registry Only)

        NEW v3.3: Registry-only HWM validation (arquivo HWM removido)
        - Registry do Windows é a ÚNICA âncora de segurança
        - Se registro não existe → Limpa cache + força login
        - Se relógio voltou → Limpa cache + força login
        - Usuário não pode restaurar backup de cache sem registro válido

        SECURITY LOGIC:
        1. Tenta carregar HWM do registro do Windows
        2. Se registro NÃO existe → Suspeito!
           → Limpa cache e força login online
        3. Se registro existe mas tempo voltou → Ataque!
           → Limpa cache e força login online
        4. Se tudo OK → Atualiza registro com tempo atual

        Returns:
            bool: True if updated successfully

        Raises:
            SecurityException: If registry missing or clock rollback detected
                              (caller must clear cache and force login)
        """
        if platform.system() != "Windows" or winreg is None:
            raise SecurityException("Offline cache only supported on Windows")

        try:
            logger.info("Validating HWM on startup")

            # Get current time
            now_utc = datetime.now(tz.utc)
            now_utc_str = now_utc.isoformat()
            logger.debug(f"Current system time: {now_utc_str}")

            # CRITICAL: Load HWM from REGISTRY (single source of truth v3.3)
            registry_hwm_str = self._load_hwm_from_registry()

            if not registry_hwm_str:
                # REGISTRY DOES NOT EXIST - SUSPICIOUS!
                logger.warning(
                    "Registry HWM anchor missing - possible first run or tampering"
                )
                raise SecurityException(
                    "Registry HWM anchor missing - online validation required"
                )

            # Parse registry HWM timestamp
            registry_hwm = datetime.fromisoformat(
                registry_hwm_str.replace("Z", "+00:00")
            )
            logger.debug(f"Registry HWM: {registry_hwm_str}")

            # CRITICAL CHECK: Current time MUST be >= Registry HWM
            time_diff = (now_utc - registry_hwm).total_seconds()
            logger.debug(f"Time difference: {time_diff:.2f} seconds")

            # Allow small tolerance for clock drift (30 seconds)
            TOLERANCE_SECONDS = 30
            if time_diff < -TOLERANCE_SECONDS:
                # ATTACK DETECTED: Clock went backwards!
                logger.error(
                    f"Clock rollback detected! System time is {abs(time_diff)/3600:.2f} hours behind registry HWM"
                )
                raise SecurityException(
                    "Clock rollback detected - system time is older than registry HWM"
                )

            if time_diff < 0:
                # Small negative drift within tolerance - warn but allow
                logger.warning(
                    f"Clock drift detected ({time_diff:.2f}s) - within tolerance"
                )

            # Update registry with current timestamp
            result = self._save_hwm_to_registry(now_utc_str)

            if result:
                logger.info("HWM updated successfully on startup")
            else:
                logger.warning("Failed to update HWM on startup (non-critical)")

            return result

        except SecurityException:
            # CRITICAL: Re-raise security exceptions to block program startup
            raise
        except Exception as e:
            # Non-critical error - log but don't block startup
            logger.error(f"Error updating HWM on startup: {e}")
            return False

    def log_error(
        self,
        error_type: str,
        error_message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log error using standard logger

        Args:
            error_type: Type of error (e.g., 'cache_save_failed')
            error_message: Error message
            details: Optional dict with additional details
        """
        if details:
            logger.error(f"[{error_type}] {error_message} - Details: {details}")
        else:
            logger.error(f"[{error_type}] {error_message}")
