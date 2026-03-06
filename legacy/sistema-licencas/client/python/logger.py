"""
Logging configuration for license system.

Compatible with license_client v3.3.
"""

import logging
import os
import sys


def setup_logger() -> logging.Logger:
    """Configure logger for license client (console only)

    Level controlled by environment variable LICENSE_CLIENT_DEBUG:
    - LICENSE_CLIENT_DEBUG=1 -> DEBUG level (verbose)
    - Default -> INFO level (important events only)

    Returns:
        logging.Logger: Configured logger instance
    """
    # Determine log level from environment
    debug_mode = os.getenv("LICENSE_CLIENT_DEBUG") == "1"
    level = logging.DEBUG if debug_mode else logging.INFO

    # Create logger
    logger = logging.getLogger("LicenseClient")
    logger.setLevel(level)

    # Remove any existing handlers to avoid duplicates
    logger.handlers.clear()

    # Create console handler that writes to stdout (not stderr)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    # Create formatter
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(formatter)

    # Add handler to logger
    logger.addHandler(console_handler)

    # Prevent propagation to root logger
    logger.propagate = False

    return logger


def obfuscate_license_key(key: str | None) -> str:
    """Obfuscate license key for logging (show only first 3 chars)

    Args:
        key: License key to obfuscate

    Returns:
        str: Obfuscated key (e.g., "ABC***")
    """
    if not key or len(key) < 3:
        return "***"
    return f"{key[:3]}***"


def obfuscate_token(token: str | None) -> str:
    """Obfuscate JWT token for logging (show only first 10 chars)

    Args:
        token: JWT token to obfuscate

    Returns:
        str: Obfuscated token (e.g., "eyJhbGciOi...")
    """
    if not token or len(token) < 10:
        return "***"
    return f"{token[:10]}..."


# Create global logger instance
logger = setup_logger()
