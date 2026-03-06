from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import keyring


class SessionStorage:
    def load(self) -> dict[str, Any] | None:
        raise NotImplementedError

    def save(self, data: dict[str, Any]) -> None:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError


@dataclass
class KeyringSessionStorage(SessionStorage):
    service_name: str = "sistema-licencas-sdk"
    account_name: str = "default-session"

    def load(self) -> dict[str, Any] | None:
        payload = keyring.get_password(self.service_name, self.account_name)
        if not payload:
            return None
        return json.loads(payload)

    def save(self, data: dict[str, Any]) -> None:
        keyring.set_password(self.service_name, self.account_name, json.dumps(data))

    def clear(self) -> None:
        try:
            keyring.delete_password(self.service_name, self.account_name)
        except keyring.errors.PasswordDeleteError:
            return


@dataclass
class FileSessionStorage(SessionStorage):
    path: str

    def load(self) -> dict[str, Any] | None:
        file_path = Path(self.path)
        if not file_path.exists():
            return None
        return json.loads(file_path.read_text(encoding="utf-8"))

    def save(self, data: dict[str, Any]) -> None:
        file_path = Path(self.path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(json.dumps(data), encoding="utf-8")

    def clear(self) -> None:
        file_path = Path(self.path)
        if file_path.exists():
            file_path.unlink()
