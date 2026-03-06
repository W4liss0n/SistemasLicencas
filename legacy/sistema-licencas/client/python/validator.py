"""
License Validator - Main license validation class.

This module handles:
- License validation (online and offline)
- User authentication (login/activate)
- Device management (transfer/deactivate)
- JWT token validation with RSA signatures
- High water mark protection against clock manipulation

Compatible with license_client v3.3.
"""

import hashlib
import json
import platform
from datetime import datetime
from datetime import timezone as tz
from typing import Any, Callable, Dict, Optional, Tuple

import jwt
import requests

from src.licensing.cache import LicenseCache
from src.licensing.constants import ERROR_MESSAGES
from src.licensing.exceptions import SecurityException
from src.licensing.fingerprint import FingerprintGenerator
from src.licensing.logger import logger, obfuscate_license_key, obfuscate_token


class LicenseValidator:
    """Main license validation class (v3.3 modular)"""

    # Security constants
    SOFT_CHECK_INTERVAL_DAYS = 7  # Try to reconnect every N days (before JWT expires)

    # Export ERROR_MESSAGES as class variable for compatibility
    ERROR_MESSAGES = ERROR_MESSAGES

    def __init__(
        self,
        program_id: str,
        program_name: str,
        version: str,
        api_url: str = "http://localhost:3000",
    ):
        """Initialize License Validator

        Args:
            program_id: Unique program UUID
            program_name: Program name for cache directory
            version: Program version string
            api_url: API base URL (default: http://localhost:3000)
        """
        self.program_id = program_id
        self.program_name = program_name
        self.version = version
        self.api_url = api_url.rstrip("/")
        self.cache = LicenseCache(program_name)
        self.fingerprint = FingerprintGenerator.generate()
        self.license_key: Optional[str] = None
        self.last_error: Optional[Dict[str, Any]] = None
        self.last_error_message: Optional[str] = None

        logger.info(f"LicenseValidator initialized for {program_name} v{version}")

    def _make_request(
        self, endpoint: str, data: Dict[str, Any]
    ) -> Tuple[bool, Dict[str, Any]]:
        """Make API request to license server

        Args:
            endpoint: API endpoint (e.g., 'validate', 'authenticate')
            data: Request payload dict

        Returns:
            Tuple of (success: bool, response_data: dict)
        """
        headers = {
            "Content-Type": "application/json",
            "X-Program-ID": self.program_id,
        }

        # Log request (obfuscate sensitive data)
        safe_data = data.copy()
        if "license_key" in safe_data:
            safe_data["license_key"] = obfuscate_license_key(safe_data["license_key"])
        if "password" in safe_data:
            safe_data["password"] = "***"
        logger.info(f"Making API request to endpoint: {endpoint}")
        logger.debug(f"Request data: {safe_data}")

        try:
            response = requests.post(
                f"{self.api_url}/api/v1/license/{endpoint}",
                json=data,
                headers=headers,
                timeout=10,
            )

            logger.debug(f"Response status: {response.status_code}")

            if response.status_code == 200:
                logger.info(f"Request to {endpoint} successful")
                return True, response.json()
            elif response.status_code == 429:
                logger.warning(f"Rate limit exceeded for endpoint: {endpoint}")
                return False, {"error": "rate_limit"}
            else:
                logger.warning(
                    f"Request to {endpoint} failed with status {response.status_code}"
                )
                return False, response.json() if response.text else {"error": "unknown"}

        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error for endpoint {endpoint}: {e}")
            return False, {"error": "connection_error"}
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout for endpoint {endpoint}: {e}")
            return False, {"error": "timeout"}
        except Exception as e:
            logger.error(
                f"Unexpected error for endpoint {endpoint}: {type(e).__name__} - {e}"
            )
            return False, {"error": "exception", "message": str(e)}

    def validate(self, force_online: bool = False, silent: bool = False) -> bool:
        """Validate license - SEMPRE tenta online primeiro, depois offline

        Fluxo de validação:
        1. Tenta validação online primeiro (a menos que explicitamente offline)
        2. Se online falhar por conexão, tenta offline com JWT
        3. Se offline também falhar, limpa cache e força login

        Args:
            force_online: Força apenas validação online (sem fallback offline)
            silent: Modo silencioso (não imprime mensagens)

        Returns:
            bool: True se validação bem-sucedida, False caso contrário
        """
        logger.info(f"Starting license validation (force_online={force_online}, silent={silent})")

        # Clear previous error state
        self.last_error = None
        self.last_error_message = None

        # NEW v3.0: Simplified cache loading - no parameters needed
        try:
            cached = self.cache.load()
            if cached:
                logger.debug("Cache loaded successfully")
            else:
                logger.debug("No cache found")
        except Exception as e:
            logger.error(f"Failed to load cache: {e}")
            if not silent:
                print(f"[VALIDATE] Erro ao carregar cache: {e}")
            cached = None

        # Se não tem cache, precisa fazer login
        if not cached or not cached.get("license_key"):
            logger.warning("No cached license found - login required")
            self._set_error("no_cached_license")
            if not silent:
                print(self.last_error_message)
            return False

        self.license_key = cached.get("license_key")
        logger.info(f"Validating license: {obfuscate_license_key(self.license_key)}")

        # SEMPRE tentar validação online primeiro
        # IMPORTANTE: Regenerar fingerprint para ter raw_components atualizados
        fresh_fingerprint = FingerprintGenerator.generate()

        success, response = self._make_request(
            "validate",
            {
                "license_key": self.license_key,
                "device_fingerprint": fresh_fingerprint,  # Usar fingerprint fresco
                "program_version": self.version,
                "os_info": f"{platform.system()} {platform.release()}",
            },
        )

        if success and response.get("valid"):
            # Validação online bem-sucedida
            logger.info("Online validation successful")
            server_fingerprint = response.get("fingerprint", {})

            if server_fingerprint:
                self.fingerprint = server_fingerprint
                logger.debug("Server fingerprint received and updated")

            if server_fingerprint and isinstance(server_fingerprint, dict):
                hashes = server_fingerprint.get("hashes") or {}
                fingerprint_hash = (
                    server_fingerprint.get("primary_hash")
                    or hashes.get("v2")
                    or hashes.get("primary")
                    or server_fingerprint.get("hash")
                )
            else:
                fingerprint_hash = (
                    self.fingerprint.get("hash")
                    if isinstance(self.fingerprint, dict)
                    else None
                )

            if not fingerprint_hash and server_fingerprint:
                components_str = json.dumps(
                    server_fingerprint.get("components", {}), sort_keys=True
                )
                fingerprint_hash = hashlib.sha256(components_str.encode()).hexdigest()

            now_utc = datetime.now(tz.utc)

            # Extract offline_token from response
            offline_token = response.get("offline_token")

            # Get client info from response
            client_info = response.get("client", {})
            client_username = client_info.get(
                "username", client_info.get("usuario", "")
            )
            client_name = client_info.get("nome", "")
            client_email = client_info.get("email", "")
            client_plan = client_info.get("plano", "")

            cache_data = {
                "version": "3.0",  # Updated to v3.0
                "license_key": self.license_key,
                "offline_token": offline_token,
                "fingerprint": server_fingerprint,
                "public_key": response.get("public_key"),
                "validated_at": datetime.now().isoformat(),
                "expires_at": response.get("license_info", {}).get("expiration"),
                "fingerprint_hash": fingerprint_hash,
                "high_water_mark": now_utc.isoformat(),
                "last_online_check": now_utc.isoformat(),
                # User/client information
                "client_username": client_username,
                "client_name": client_name,
                "client_email": client_email,
                "client_plan": client_plan,
            }

            # NEW v3.0: Simplified save - no parameters needed
            self.cache.save(cache_data)

            # NEW v3.3: Save HWM directly to registry (no file)
            self.cache._save_hwm_to_registry(now_utc.isoformat())

            if not silent:
                print("Licença validada online com sucesso")
            return True

        # Validação online falhou - verificar motivo
        if not success and response.get("error") in ["connection_error", "timeout"]:
            print("\n" + "=" * 60)
            print("[VALIDATE] VALIDAÇÃO ONLINE FALHOU - SEM CONEXÃO")
            print("   Motivo: " + response.get("error", "desconhecido"))
            print("   Tentando validação OFFLINE com JWT...")
            print("=" * 60 + "\n")

            # Sem conexão - tentar validação offline
            if force_online:
                # Modo force_online: não permite fallback offline
                logger.warning("Force online mode - offline validation not allowed")
                self._set_error("connection_error")
                if not silent:
                    print(self.last_error_message)
                return False

            # Tentar validação offline com JWT
            logger.info("Attempting offline validation with JWT token")
            cached_fingerprint_hash = cached.get("fingerprint_hash")

            if cached_fingerprint_hash and isinstance(self.fingerprint, dict):
                self.fingerprint["hash"] = cached_fingerprint_hash
                self.fingerprint["primary_hash"] = cached_fingerprint_hash
                hashes = self.fingerprint.get("hashes")
                if not isinstance(hashes, dict):
                    hashes = {}
                hashes["v2"] = cached_fingerprint_hash
                hashes["primary"] = cached_fingerprint_hash
                self.fingerprint["hashes"] = hashes

            offline_token = cached.get("offline_token")
            public_key = cached.get("public_key")

            if offline_token and self._validate_offline_token(
                offline_token, public_key, cached
            ):
                # Validação offline bem-sucedida
                logger.info("Offline validation successful")
                cached["last_validation"] = datetime.now().isoformat()
                # NEW v3.0: Simplified save
                self.cache.save(cached)

                if not silent:
                    print("Modo offline: Validação com cache local")
                return True
            else:
                # Token offline inválido/expirado - limpar e forçar login
                logger.error("Offline token validation failed - clearing cache")
                self.cache.clear()
                self._disconnect()
                if not silent:
                    print(
                        self.last_error_message
                        if self.last_error_message
                        else "Token offline inválido: Faça login novamente"
                    )
                return False
        else:
            # Erro do servidor (licença bloqueada, expirada, etc)
            if not success:
                self._set_error_from_response(response)
            elif not response.get("valid"):
                self._set_error_from_response(response)

            # Se o erro é crítico (bloqueio, expiração, dispositivo não registrado), limpar cache
            critical_errors = [
                "license_blocked",
                "subscription_expired",
                "license_not_found",
                "device_not_registered",
                "max_devices_reached",
            ]
            if response.get("error") in critical_errors:
                self.cache.clear()
                self._disconnect()

            if self.last_error_message and not silent:
                print(self.last_error_message)

            return False

    def login(self, username: str, password: str) -> Tuple[bool, str]:
        """Login with username/email and password

        Authenticates the user and retrieves the license key automatically.
        The license is then activated on this device.

        Args:
            username: Email or username of the client
            password: Password of the client

        Returns:
            Tuple of (success: bool, message: str)
        """
        logger.info(f"Login attempt for user: {username}")

        # Clear previous error state
        self.last_error = None
        self.last_error_message = None

        # Always send fresh raw components to server
        fresh_fingerprint = FingerprintGenerator.generate()

        success, response = self._make_request(
            "authenticate",
            {
                "username": username,
                "password": password,
                "device_fingerprint": fresh_fingerprint,
                "program_version": self.version,
                "os_info": f"{platform.system()} {platform.release()}",
            },
        )

        if success and response.get("success") and response.get("authenticated"):
            # Extract license key from response
            license_key = response.get("license_key")
            if not license_key:
                logger.error("License key not found in server response")
                return False, "Erro: Licença não encontrada na resposta do servidor"

            self.license_key = license_key
            logger.info(f"Login successful - License: {obfuscate_license_key(license_key)}")

            # Get client info
            client_info = response.get("client", {})
            client_username = client_info.get(
                "username", client_info.get("usuario", "")
            )
            client_name = client_info.get("nome", "")
            client_email = client_info.get("email", "")
            client_plan = client_info.get("plano", "")

            # NEW v2.0: Cache with all consolidated data
            # Get fingerprint from response (server-processed)
            server_fingerprint = response.get("fingerprint", {})

            # Update self.fingerprint with server-processed version (includes hash)
            if server_fingerprint:
                self.fingerprint = server_fingerprint

            # Extract hash for encryption key
            if server_fingerprint and isinstance(server_fingerprint, dict):
                hashes = server_fingerprint.get("hashes") or {}
                fingerprint_hash = (
                    server_fingerprint.get("primary_hash")
                    or hashes.get("v2")
                    or hashes.get("primary")
                    or server_fingerprint.get("hash")
                )
            else:
                # Fallback: use local fingerprint hash
                fingerprint_hash = (
                    self.fingerprint.get("hash")
                    if isinstance(self.fingerprint, dict)
                    else None
                )

            # If still no hash, calculate from raw components
            if not fingerprint_hash and server_fingerprint:
                components_str = json.dumps(
                    server_fingerprint.get("components", {}), sort_keys=True
                )
                fingerprint_hash = hashlib.sha256(components_str.encode()).hexdigest()

            now_utc = datetime.now(tz.utc)

            # Extract offline_token from response
            offline_token = response.get("offline_token")

            cache_data = {
                "version": "3.0",  # Updated to v3.0
                "license_key": license_key,
                "offline_token": offline_token,  # JWT from server
                "fingerprint": server_fingerprint,  # Server-processed fingerprint
                "public_key": response.get("public_key"),  # RSA public key
                "validated_at": datetime.now().isoformat(),
                "expires_at": response.get("license_info", {}).get("expiration"),
                "fingerprint_hash": fingerprint_hash,
                "high_water_mark": now_utc.isoformat(),  # Initialize high water mark
                "last_online_check": now_utc.isoformat(),  # Track last successful online check
                "needs_soft_check": False,  # Reset soft check flag
                # User/client information
                "client_username": client_username,
                "client_name": client_name,
                "client_email": client_email,
                "client_plan": client_plan,
            }

            # NEW v3.0: Simplified save - no parameters needed
            if not self.cache.save(cache_data):
                return False, "Erro: Não foi possível salvar cache local"

            # NEW v3.3: Save HWM directly to registry (no file)
            self.cache._save_hwm_to_registry(now_utc.isoformat())

            welcome_msg = f"Login realizado com sucesso!<br>Bem-vindo(a), {client_name}!"
            if client_plan:
                welcome_msg += f"<br>Plano: {client_plan}"

            return True, welcome_msg

        # Handle error
        self._set_error_from_response(response)
        return False, self.last_error_message or "Falha no login"

    def activate(self, license_key: str) -> Tuple[bool, str]:
        """Activate a new license key"""
        logger.info(f"Attempting to activate license: {obfuscate_license_key(license_key)}")

        # Clear previous error state
        self.last_error = None
        self.last_error_message = None

        # Always send fresh raw components to server
        fresh_fingerprint = FingerprintGenerator.generate()

        success, response = self._make_request(
            "activate",
            {
                "license_key": license_key,
                "device_fingerprint": fresh_fingerprint,
                "program_version": self.version,
                "os_info": f"{platform.system()} {platform.release()}",
            },
        )

        if success and response.get("success"):
            logger.info("License activation successful")
            self.license_key = license_key

            # NEW v2.0: Cache with all consolidated data
            # Get fingerprint from response (server-processed)
            server_fingerprint = response.get("fingerprint", {})

            # Update self.fingerprint with server-processed version (includes hash)
            if server_fingerprint:
                self.fingerprint = server_fingerprint

            # Extract hash for encryption key
            if server_fingerprint and isinstance(server_fingerprint, dict):
                hashes = server_fingerprint.get("hashes") or {}
                fingerprint_hash = (
                    server_fingerprint.get("primary_hash")
                    or hashes.get("v2")
                    or hashes.get("primary")
                    or server_fingerprint.get("hash")
                )
            else:
                # Fallback: use local fingerprint hash
                fingerprint_hash = (
                    self.fingerprint.get("hash")
                    if isinstance(self.fingerprint, dict)
                    else None
                )

            # If still no hash, calculate from raw components
            if not fingerprint_hash and server_fingerprint:
                components_str = json.dumps(
                    server_fingerprint.get("components", {}), sort_keys=True
                )
                fingerprint_hash = hashlib.sha256(components_str.encode()).hexdigest()

            now_utc = datetime.now(tz.utc)

            cache_data = {
                "version": "3.0",  # Updated to v3.0
                "license_key": license_key,
                "offline_token": response.get("offline_token"),  # JWT from server
                "fingerprint": server_fingerprint,  # Server-processed fingerprint
                "public_key": response.get("public_key"),  # RSA public key
                "validated_at": datetime.now().isoformat(),
                "expires_at": response.get("license_info", {}).get("expiration"),
                "fingerprint_hash": fingerprint_hash,
                "high_water_mark": now_utc.isoformat(),  # Initialize high water mark
                "last_online_check": now_utc.isoformat(),  # Track last successful online check
                "needs_soft_check": False,  # Reset soft check flag
            }

            # NEW v3.0: Simplified save - no parameters needed
            save_result = self.cache.save(cache_data)

            if not save_result:
                return False, "Erro: Não foi possível salvar cache local"

            # NEW v3.3: Save HWM directly to registry (no file)
            self.cache._save_hwm_to_registry(now_utc.isoformat())

            return True, "Licença ativada com sucesso!"

        # Handle error
        self._set_error_from_response(response)
        return False, self.last_error_message or "Falha na ativação da licença"

    def deactivate(self) -> Tuple[bool, str]:
        """Deactivate current device

        NEW v2.0: Clears consolidated cache
        """
        logger.info("Attempting to deactivate license")

        if not self.license_key:
            logger.warning("No active license to deactivate")
            return False, "Erro: Nenhuma licença ativa para desativar"

        # Regenerar fingerprint fresco com componentes raw (não usar cache)
        fresh_fingerprint = FingerprintGenerator.generate()

        success, response = self._make_request(
            "deactivate",
            {"license_key": self.license_key, "device_fingerprint": fresh_fingerprint},
        )

        if success:
            # Clear local data (consolidated cache)
            logger.info("Deactivation successful - clearing local cache")
            self.cache.clear()
            self.license_key = None
            return True, "Licença desativada com sucesso!"

        self._set_error_from_response(response)
        return False, self.last_error_message or "Falha na desativação"

    def transfer(self) -> Tuple[bool, str]:
        """Transfer license to current device (deactivate old device)

        NEW v2.0: Reads license from consolidated cache
        """
        if not self.license_key:
            # NEW v3.0: Simplified load
            cached = self.cache.load()
            if not cached or not cached.get("license_key"):
                return False, "Erro: Nenhuma licença encontrada para transferir"
            self.license_key = cached.get("license_key")

        # Always send fresh raw components to server
        fresh_fingerprint = FingerprintGenerator.generate()

        success, response = self._make_request(
            "transfer",
            {
                "license_key": self.license_key,
                "new_device_fingerprint": fresh_fingerprint,
            },
        )

        if success and response.get("success"):
            # NEW v2.0: Update cache with new device, offline_token, and public key
            server_fingerprint = response.get("fingerprint", {})

            # Update self.fingerprint with server-processed version (includes hash)
            if server_fingerprint:
                self.fingerprint = server_fingerprint

            # Extract hash for encryption key
            if server_fingerprint and isinstance(server_fingerprint, dict):
                hashes = server_fingerprint.get("hashes") or {}
                fingerprint_hash = (
                    server_fingerprint.get("primary_hash")
                    or hashes.get("v2")
                    or hashes.get("primary")
                    or server_fingerprint.get("hash")
                )
            else:
                fingerprint_hash = (
                    self.fingerprint.get("hash")
                    if isinstance(self.fingerprint, dict)
                    else None
                )

            # If still no hash, calculate from raw components
            if not fingerprint_hash and server_fingerprint:
                components_str = json.dumps(
                    server_fingerprint.get("components", {}), sort_keys=True
                )
                fingerprint_hash = hashlib.sha256(components_str.encode()).hexdigest()

            now_utc = datetime.now(tz.utc)

            cache_data = {
                "version": "3.0",  # Updated to v3.0
                "license_key": self.license_key,
                "offline_token": response.get("offline_token"),  # JWT from server
                "fingerprint": server_fingerprint,  # Server-processed fingerprint
                "public_key": response.get("public_key"),  # RSA public key
                "validated_at": datetime.now().isoformat(),
                "fingerprint_hash": fingerprint_hash,
                "high_water_mark": now_utc.isoformat(),  # Initialize high water mark
            }
            # NEW v3.0: Simplified save
            self.cache.save(cache_data)

            # NEW v3.3: Save HWM directly to registry (no file)
            self.cache._save_hwm_to_registry(now_utc.isoformat())

            return True, "Licença transferida com sucesso!"

        # Handle transfer limit error specially
        error_code = response.get("error")
        if error_code == "transfer_limit_exceeded":
            transfers_used = response.get("transfers_used", 0)
            max_transfers = response.get("max_transfers", 3)
            return (
                False,
                f"Limite de transferências excedido: Você usou {transfers_used} de {max_transfers} transferências este mês",
            )

        self._set_error_from_response(response)
        return False, self.last_error_message or "Falha na transferência"

    def heartbeat(self) -> bool:
        """Send heartbeat to server"""
        if not self.license_key:
            return False

        fresh_fingerprint = FingerprintGenerator.generate()

        success, response = self._make_request(
            "heartbeat",
            {
                "license_key": self.license_key,
                "device_fingerprint": fresh_fingerprint,
                "program_version": self.version,
            },
        )

        return success and response.get("success", False)

    def check_license(self) -> bool:
        """Check if license is valid (main entry point)

        NEW v2.0: Reads from consolidated cache
        """
        # First try to validate
        if self.validate():
            return True

        # If validation fails, check if we have a cached license
        # NEW v3.0: Simplified load
        cached = self.cache.load()

        if cached and cached.get("license_key"):
            # Try to reactivate or transfer
            self.license_key = cached.get("license_key")
            # Check if it's a fingerprint mismatch (device change)
            # Error messages already shown by validate()
            return self._handle_device_change()

        # Error already shown by validate()
        return False

    def _disconnect(self):
        """Force disconnect and clear session

        Called when:
        - Token expires (7 days offline)
        - Token signature verification fails
        - Device fingerprint mismatch
        - Any security violation

        This will force the user to show the login screen
        """
        self.license_key = None
        self.last_error = None
        self.last_error_message = None
        # Cache already cleared by caller

    def _handle_device_change(self) -> bool:
        """Handle device change scenario"""
        # This would show a dialog asking user if they want to transfer
        # For now, attempt automatic transfer
        success, message = self.transfer()
        return success

    def validate_background(self, on_error_callback=None) -> bool:
        """Validação em background após login com cache

        Esta função é chamada ao iniciar o programa quando há cache válido.
        Tenta conectar ao servidor e validar. Se houver problemas, notifica via callback.

        Args:
            on_error_callback: Função callback(error_dict) chamada se houver erro

        Returns:
            bool: True se validação bem-sucedida (online ou offline)
        """
        try:
            # Tentar validação online silenciosamente
            result = self.validate(force_online=False, silent=True)

            if not result:
                # Validação falhou - notificar via callback
                if on_error_callback and self.last_error:
                    on_error_callback(self.last_error)

            return result

        except (ValueError, TypeError, OSError, IOError) as e:
            # Erro inesperado - notificar via callback
            if on_error_callback:
                error_dict = {
                    "error": "exception",
                    "message": str(e),
                    "timestamp": datetime.now().isoformat(),
                }
                on_error_callback(error_dict)
            return False

    def _try_soft_check_silent(self, offline_token: str, public_key: str) -> None:
        """REMOVIDO - substituído por validate_background()

        A validação agora é sempre online-first, então este método não é mais necessário.
        Mantido como stub para compatibilidade com código antigo.
        """
        # Não faz nada - validate() já tenta online primeiro
        pass

    def _validate_offline_token(
        self,
        offline_token: str,
        public_key: Optional[str] = None,
        cached_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Validate JWT offline token from server with RSA signature verification

        NEW v2.0: Token MUST be signed with RSA private key by server
        Client verifies signature using RSA public key
        Token cannot be forged without the server's private key

        SECURITY: No fallback without signature verification
        - If signature verification fails, token is rejected
        - Old v1.0 tokens without RSA are rejected
        - Forces user to reconnect and get new v2.0 token

        NEW v2.1: High Water Mark protection
        - Detects clock manipulation (time travel attacks)
        - Timestamp that never goes backwards
        - Prevents offline token reuse after moving clock back

        Args:
            offline_token: JWT token from server
            public_key: RSA public key (PEM format) for signature verification
            cached_data: Cache data dict (needed to update high_water_mark)
        """
        logger.info("Validating offline JWT token")
        try:
            # REQUIRE RSA verification (v2.0 tokens only)
            if not public_key:
                # No public key - old v1.0 cache, force online validation
                logger.error("RSA public key not found - old cache version")
                self.cache.clear()
                self._set_error(
                    "cache_tampered",
                    {"reason": "Missing RSA public key - reconnect required"},
                )
                return False

            logger.debug("RSA public key found - decoding JWT")

            # Verify JWT signature with RSA public key
            # Add leeway to handle clock skew between server and client
            payload = jwt.decode(
                offline_token,
                key=public_key,
                algorithms=["RS256"],
                issuer="sistema-licencas",
                audience="license-client",
                leeway=60,  # Allow 60 seconds clock skew tolerance
            )

            logger.info("JWT decoded successfully")
            logger.debug(f"JWT payload: {payload}")

        except jwt.InvalidSignatureError:
            # Signature verification failed - token was tampered or forged
            logger.error("JWT signature validation failed - token tampered")
            self.cache.clear()
            self._set_error("cache_tampered", {"reason": "Invalid JWT signature"})
            return False
        except jwt.ExpiredSignatureError:
            # Token expired (7 days passed) - force disconnect
            logger.error("JWT token expired - more than 7 days offline")
            self.cache.clear()
            self._disconnect()
            self._set_error(
                "cache_expired", {"reason": "Token expired - reconnect required"}
            )
            return False
        except jwt.DecodeError as e:
            # Invalid token format - clear cache and force reconnection
            logger.error(f"JWT decode error: {e}")
            self.cache.clear()
            self._set_error(
                "cache_tampered",
                {"reason": "Invalid token format - reconnect required"},
            )
            return False
        except Exception as e:
            # Any other JWT error - clear cache and force reconnection
            logger.error(f"JWT validation error: {type(e).__name__} - {e}")
            self.cache.clear()
            error_details = f"Invalid JWT token: {type(e).__name__}: {str(e)}"
            self._set_error("cache_tampered", {"reason": error_details})
            return False

        # Verify token type
        try:
            if payload.get("tokenType") != "offline_license":
                # Invalid token - clear cache silently
                logger.error(f"Invalid token type: {payload.get('tokenType')}")
                self.cache.clear()
                self._set_error("cache_tampered", {"reason": "Invalid token type"})
                return False

            logger.debug("Token type validated: offline_license")

            # Get current time (UTC)
            now = datetime.now(tz.utc)
            logger.debug(f"Current time (UTC): {now.isoformat()}")

            # NEW v3.0: HIGH WATER MARK in separate encrypted file
            # Validate using persistent HWM (not stored in cache)
            # NEW v3.1: Also validate against JWT iat to prevent cache restore attacks
            logger.debug("Validating HWM...")
            try:
                # Extract JWT iat (issued at) timestamp
                jwt_iat = None
                if payload.get("iat"):
                    jwt_iat_ts = payload.get("iat")
                    jwt_iat = datetime.fromtimestamp(jwt_iat_ts, tz.utc).isoformat()
                    logger.debug(f"JWT iat extracted: {jwt_iat}")
                else:
                    logger.warning("JWT iat not found in payload")

                hwm_valid = self.cache.validate_hwm(now.isoformat(), _jwt_iat=jwt_iat)
                if not hwm_valid:
                    # HWM validation failed (shouldn't happen if validate_hwm raises exception)
                    logger.error("HWM validation returned False")
                    self.cache.clear()
                    self._disconnect()
                    self._set_error(
                        "cache_tampered",
                        {"reason": "High water mark validation failed"},
                    )
                    return False
                logger.debug("HWM validation successful")
            except SecurityException as e:
                # Clock manipulation detected by HWM system
                logger.error(f"SecurityException during HWM validation: {e}")
                self.cache.clear()
                self._disconnect()
                self._set_error("cache_tampered", {"reason": str(e)})
                return False

            # LEGACY: Update cache high_water_mark for migration compatibility
            # (Not used for validation anymore, only for informational purposes)
            if cached_data:
                cached_data["high_water_mark"] = now.isoformat()

            # Check expiration (7 DAYS based on valid_until timestamp)
            valid_until_str = payload.get("valid_until")

            if not valid_until_str:
                # Tampered token - clear cache and force disconnect
                self.cache.clear()
                self._disconnect()
                self._set_error("cache_tampered", {"reason": "Missing expiration"})
                return False

            valid_until = datetime.fromisoformat(valid_until_str.replace("Z", "+00:00"))
            if valid_until.tzinfo is None:
                valid_until = valid_until.replace(tzinfo=tz.utc)

            if now > valid_until:
                # Token expired (7 days passed) - clear cache and force disconnect
                days_expired = (
                    now - valid_until
                ).total_seconds() / 86400  # Convert to days
                self.cache.clear()
                self._disconnect()
                self._set_error(
                    "cache_expired",
                    {
                        "days_expired": days_expired,
                        "valid_until": valid_until.strftime("%d/%m/%Y %H:%M"),
                    },
                )
                return False

            # Check fingerprint matches (verify device hasn't changed)
            token_fingerprint = payload.get("fingerprint_hash")
            accepted_fingerprints = payload.get("accepted_fingerprint_hashes") or [
                token_fingerprint
            ]
            current_fingerprint = None
            if isinstance(self.fingerprint, dict):
                hashes = self.fingerprint.get("hashes") or {}
                current_fingerprint = (
                    self.fingerprint.get("primary_hash")
                    or hashes.get("v2")
                    or hashes.get("primary")
                    or self.fingerprint.get("hash")
                )

            if not current_fingerprint or current_fingerprint not in accepted_fingerprints:
                # Device mismatch - clear cache and force disconnect
                self.cache.clear()
                self._disconnect()
                self._set_error("cache_device_mismatch")
                return False

            # NEW v3.0: Extract ALL fields from JWT (server now sends complete data)
            # This allows offline display of user information
            logger.debug("Extracting data from JWT...")

            # Extract license information
            license_key = payload.get("license_key")
            license_expires_at = payload.get("license_expires_at")

            # Extract client information (NEW - from server)
            client_id = payload.get("client_id")
            client_username = payload.get("client_username")
            client_name = payload.get("client_name")
            client_email = payload.get("client_email")
            client_plan = payload.get("client_plan")

            logger.debug(f"License: {obfuscate_license_key(license_key)}, Expires: {license_expires_at}")
            logger.debug(f"Client: {client_name} ({client_email}), Plan: {client_plan}")

            # Check if license has expired (separate from JWT expiration)
            if license_expires_at:
                license_expiry = datetime.fromisoformat(
                    license_expires_at.replace("Z", "+00:00")
                )
                if license_expiry.tzinfo is None:
                    license_expiry = license_expiry.replace(tzinfo=tz.utc)

                if now > license_expiry:
                    # License expired (not JWT, but subscription/license itself)
                    logger.error(f"License expired on {license_expiry.strftime('%d/%m/%Y %H:%M')}")
                    self.cache.clear()
                    self._disconnect()
                    self._set_error(
                        "cache_expired",
                        {
                            "reason": "License expired",
                            "expiration_date": license_expiry.strftime(
                                "%d/%m/%Y %H:%M"
                            ),
                        },
                    )
                    return False

            # Update cached data with extracted fields (if cached_data provided)
            if cached_data:
                cached_data["license_key"] = license_key
                cached_data["license_expires_at"] = license_expires_at
                cached_data["client_id"] = client_id
                cached_data["client_username"] = client_username
                cached_data["client_name"] = client_name
                cached_data["client_email"] = client_email
                cached_data["client_plan"] = client_plan

            logger.info("Offline token validation successful - continuing offline")

            # Token is valid - can continue offline
            return True

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            # Catch all other errors - clear cache and force disconnect
            self.cache.clear()
            self._disconnect()
            error_details = f"Token validation error: {type(e).__name__}: {str(e)}"
            self._set_error("cache_tampered", {"reason": error_details})
            return False

    # REMOVED v2.0: Methods below are obsolete
    # All data now consolidated in license.dat cache file
    # - _save_license() -> data in cache
    # - _load_stored_license() -> data in cache
    # - _clear_stored_license() -> cache.clear()
    # - _get_offline_validation_count() -> data in cache['validation_count']
    # - _increment_offline_validation_count() -> data in cache
    # - _reset_offline_validation_count() -> data in cache

    def is_activated(self) -> bool:
        """Check if license is activated"""
        return self.license_key is not None and self.validate()

    def get_license_info(self) -> Optional[Dict[str, Any]]:
        """Get cached license information

        NEW v2.0: Reads from consolidated cache
        Returns info about current license session
        """
        # NEW v3.0: Simplified cache loading
        cached = self.cache.load()

        if cached:
            # Validate using offline_token with RSA signature
            offline_token = cached.get("offline_token")
            public_key = cached.get("public_key")

            if offline_token and self._validate_offline_token(
                offline_token, public_key, cached
            ):
                # NEW v3.0: Save updated cache (simplified)
                self.cache.save(cached)

                return {
                    "license_key": cached.get("license_key"),
                    "validated_at": cached.get("validated_at"),
                    "expires_at": cached.get("expires_at"),
                    "days_remaining": self._calculate_days_remaining(
                        cached.get("expires_at")
                    ),
                    # User/client information
                    "client_username": cached.get("client_username"),
                    "client_name": cached.get("client_name"),
                    "client_email": cached.get("client_email"),
                    "client_plan": cached.get("client_plan"),
                }
        return None

    def _calculate_days_remaining(self, expires_at: Optional[str]) -> Optional[int]:
        """Calculate days remaining until expiration"""
        if not expires_at:
            return None
        try:
            expiry = datetime.fromisoformat(expires_at)
            remaining = (expiry - datetime.now()).days
            return max(0, remaining)
        except (ValueError, TypeError, AttributeError):
            return None

    def _set_error(self, error_code: str, details: Optional[Dict[str, Any]] = None):
        """Set error state with Portuguese message"""
        self.last_error = {
            "error": error_code,
            "details": details or {},
            "timestamp": datetime.now().isoformat(),
        }

        # Get base message
        message: str = self.ERROR_MESSAGES.get(
            error_code, self.ERROR_MESSAGES["unknown_error"]
        )

        # Add specific details if available
        if details:
            if "hours_expired" in details:
                hours = details["hours_expired"]
                message += f" (expirado há {hours:.1f} horas)"
            elif "expiration_date" in details:
                message += f" (expirou em {details['expiration_date']})"

        self.last_error_message = message

    def _set_error_from_response(self, response: Dict[str, Any]):
        """Set error from server response"""
        error_code = response.get("error", "unknown_error")

        # Handle case where error is a dict instead of string
        if isinstance(error_code, dict):
            # Extract error code from nested dict if present
            error_code = error_code.get(
                "code", error_code.get("error", "unknown_error")
            )

        # Ensure error_code is always a string
        if not isinstance(error_code, str):
            error_code = "unknown_error"

        reason: str = str(response.get("reason", ""))
        message: str = str(response.get("message", ""))

        # Set error with server details
        self.last_error = {
            "error": error_code,
            "reason": reason,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }

        # PRIORITY: Use message from server if available, otherwise use local dictionary
        if message:
            # Server sent a Portuguese message - use it directly
            self.last_error_message = message
        else:
            # Fallback to local dictionary (only for connection/cache errors)
            fallback_message: str = self.ERROR_MESSAGES.get(
                error_code,
                self.ERROR_MESSAGES.get("unknown_error", "Erro desconhecido"),
            )
            self.last_error_message = fallback_message

    def get_last_error(self) -> Optional[Dict[str, Any]]:
        """Get details of the last error that occurred

        Returns:
            Dictionary with error details or None if no error occurred
            Contains: error code, reason, message, timestamp, and other details
        """
        return self.last_error
