from __future__ import annotations

from dataclasses import dataclass


@dataclass(eq=False)
class ApiProblemError(RuntimeError):
    status: int
    title: str
    detail: str | None = None
    code: str | None = None

    def __post_init__(self) -> None:
        parts = [self.title]
        if self.code:
            parts.append(f"[{self.code}]")
        if self.detail:
            parts.append(self.detail)
        super().__init__(" ".join(parts))


@dataclass(eq=False)
class AccessPendingError(ApiProblemError):
    pass
