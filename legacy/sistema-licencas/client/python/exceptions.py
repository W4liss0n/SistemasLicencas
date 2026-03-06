"""
Custom exceptions for license system.

Compatible with license_client v3.3.
"""


class SecurityException(Exception):
    """Raised when security violation detected (time manipulation, tampering, etc)

    This exception is raised when:
    - Clock rollback detected (time went backwards)
    - Registry HWM anchor missing
    - Cache tampering detected
    - Any other security violation
    """

    pass
