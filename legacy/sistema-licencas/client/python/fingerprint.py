"""
Device fingerprint generation for license validation.

This module handles hardware fingerprint generation for device identification.
Compatible with license_client v3.3.
"""

import os
import platform
import re
import socket
import subprocess
import uuid
from typing import Any, Dict, Optional


class FingerprintGenerator:
    """Generate unique device fingerprint for license validation"""

    _UNKNOWN = "UNKNOWN"

    @staticmethod
    def _run_command(
        command: Any,
        shell: bool = False,
        first_line: bool = True,
    ) -> Optional[str]:
        """Run a command and return command output."""
        try:
            output = subprocess.check_output(command, shell=shell, stderr=subprocess.DEVNULL)
            text = output.decode(errors="ignore").strip()
            if not text:
                return None

            if not first_line:
                return text

            lines = [line.strip() for line in text.splitlines() if line.strip()]
            for line in lines:
                lower = line.lower()
                if lower in {"serialnumber", "processorid", "uuid"}:
                    continue
                return line
            return lines[0] if lines else None
        except (subprocess.CalledProcessError, OSError, UnicodeDecodeError):
            return None

    @classmethod
    def _clean_identifier(cls, value: Optional[str]) -> str:
        """Normalize identifier and collapse invalid placeholders."""
        if value is None:
            return cls._UNKNOWN

        cleaned = str(value).strip()
        if not cleaned:
            return cls._UNKNOWN

        invalid_values = {
            "",
            "none",
            "null",
            "unknown",
            "default string",
            "to be filled by o.e.m.",
            "system serial number",
            "0",
            "00000000-0000-0000-0000-000000000000",
        }
        if cleaned.lower() in invalid_values:
            return cls._UNKNOWN

        return cleaned

    @staticmethod
    def _normalize_mac(mac: Optional[str]) -> Optional[str]:
        """Return canonical XX:XX:XX:XX:XX:XX or None."""
        if not mac:
            return None

        stripped = re.sub(r"[^0-9A-Fa-f]", "", mac)
        if len(stripped) != 12:
            return None

        if stripped.lower() in {"000000000000", "ffffffffffff"}:
            return None

        # Locally administered or multicast MACs are not ideal for identity.
        first_octet = int(stripped[0:2], 16)
        if first_octet & 1:
            return None

        groups = [stripped[i : i + 2].upper() for i in range(0, 12, 2)]
        return ":".join(groups)

    @classmethod
    def get_machine_id(cls) -> str:
        """Get unique machine identifier."""
        if platform.system() == "Windows":
            # 1) CIM UUID is the preferred stable source on modern Windows.
            cim_uuid = cls._run_command(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_ComputerSystemProduct).UUID",
                ]
            )
            cleaned = cls._clean_identifier(cim_uuid)
            if cleaned != cls._UNKNOWN:
                return cleaned

            # 2) Registry MachineGuid as secondary source.
            machine_guid = cls._run_command(
                "reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
                shell=True,
            )
            if machine_guid:
                parts = machine_guid.split()
                if parts:
                    cleaned = cls._clean_identifier(parts[-1])
                    if cleaned != cls._UNKNOWN:
                        return cleaned

            # 3) WMIC baseboard serial (legacy fallback).
            baseboard_serial = cls._run_command(
                "wmic baseboard get serialnumber",
                shell=True,
            )
            cleaned = cls._clean_identifier(baseboard_serial)
            if cleaned != cls._UNKNOWN:
                return cleaned

            # 4) WMIC CPU ProcessorId (legacy fallback).
            processor_id = cls._run_command(
                "wmic cpu get processorid",
                shell=True,
            )
            cleaned = cls._clean_identifier(processor_id)
            if cleaned != cls._UNKNOWN:
                return cleaned

            # 5) Last resort: MAC-derived node id.
            return cls._clean_identifier(f"{uuid.getnode():012x}")

        # Linux/Mac
        try:
            if os.path.exists("/etc/machine-id"):
                with open("/etc/machine-id", "r", encoding="utf-8") as f:
                    cleaned = cls._clean_identifier(f.read().strip())
                    if cleaned != cls._UNKNOWN:
                        return cleaned
            if platform.system() == "Darwin":
                hw_uuid = cls._run_command(
                    ["system_profiler", "SPHardwareDataType"],
                    first_line=False,
                )
                if hw_uuid:
                    for line in hw_uuid.split("\n"):
                        if "Hardware UUID" in line:
                            cleaned = cls._clean_identifier(line.split(":")[-1].strip())
                            if cleaned != cls._UNKNOWN:
                                return cleaned
        except (IOError, OSError):
            pass

        return cls._clean_identifier(f"{uuid.getnode():012x}")

    @classmethod
    def get_disk_serial(cls) -> str:
        """Get primary disk serial number."""
        if platform.system() == "Windows":
            # Preferred: CIM.
            cim_serial = cls._run_command(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_DiskDrive | Select-Object -First 1 -ExpandProperty SerialNumber)",
                ]
            )
            cleaned = cls._clean_identifier(cim_serial)
            if cleaned != cls._UNKNOWN:
                return cleaned

            # Legacy fallback: WMIC.
            wmic_serial = cls._run_command(
                "wmic diskdrive get serialnumber",
                shell=True,
            )
            cleaned = cls._clean_identifier(wmic_serial)
            if cleaned != cls._UNKNOWN:
                return cleaned

            return cls._UNKNOWN

        try:
            if platform.system() == "Linux":
                device = cls._run_command(
                    ["findmnt", "-n", "-o", "SOURCE", "/"],
                    shell=False,
                )
                if device:
                    disk_uuid = cls._run_command(
                        ["lsblk", "-no", "UUID", device],
                        shell=False,
                    )
                    cleaned = cls._clean_identifier(disk_uuid)
                    if cleaned != cls._UNKNOWN:
                        return cleaned
            elif platform.system() == "Darwin":
                disk_info = cls._run_command(
                    ["diskutil", "info", "/"],
                    first_line=False,
                )
                if disk_info:
                    for line in disk_info.split("\n"):
                        if "Volume UUID" in line:
                            cleaned = cls._clean_identifier(line.split(":")[-1].strip())
                            if cleaned != cls._UNKNOWN:
                                return cleaned
        except (subprocess.CalledProcessError, OSError):
            pass

        return cls._UNKNOWN

    @classmethod
    def get_mac_address(cls) -> str:
        """Get canonical primary MAC address."""
        # Primary source: uuid.getnode() (works cross-platform).
        mac_from_node = cls._normalize_mac(f"{uuid.getnode():012x}")
        if mac_from_node:
            return mac_from_node

        # Windows fallback: getmac output.
        if platform.system() == "Windows":
            raw_getmac = cls._run_command("getmac /fo csv /nh", shell=True)
            if raw_getmac:
                for line in raw_getmac.splitlines():
                    candidate = line.split(",")[0].replace('"', "").strip()
                    normalized = cls._normalize_mac(candidate)
                    if normalized:
                        return normalized

        return cls._UNKNOWN

    @classmethod
    def generate(cls) -> Dict[str, Any]:
        """Generate device fingerprint with components in root."""
        machine_id = cls.get_machine_id()
        disk_serial = cls.get_disk_serial()
        mac_address = cls.get_mac_address()

        return {
            "machine_id": cls._clean_identifier(machine_id),
            "disk_serial": cls._clean_identifier(disk_serial),
            "mac_address": cls._clean_identifier(mac_address),
            "hostname": cls._clean_identifier(socket.gethostname()),
            "platform": cls._clean_identifier(f"{platform.system()}-{platform.machine()}"),
        }
