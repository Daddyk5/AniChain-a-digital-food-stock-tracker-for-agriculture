from __future__ import annotations

import json
import logging
from decimal import Decimal
from pathlib import Path

from .models import Observation, to_price

log = logging.getLogger(__name__)


class ChangeDetector:
    """Remembers the last known price per (commodity slug, market) and filters a fetch down to the
    observations that actually changed. State is persisted to disk so restarts don't re-post, and
    seeded from the backend on startup so the backend stays the source of truth.

    The backend repeats this comparison under a lock, so this is an optimization (skip needless
    POSTs), not the guarantee."""

    def __init__(self, state_file: Path):
        self.state_file = state_file
        self.last: dict[tuple[str, str], Decimal] = {}
        self._load()

    def seed(self, snapshot: dict[tuple[str, str], Decimal]) -> None:
        self.last.update(snapshot)
        self._save()

    def changed(self, observations: list[Observation]) -> list[Observation]:
        # If a source lists the same commodity twice, the last row wins.
        latest = {o.key: o for o in observations}
        return [o for o in latest.values() if self.last.get(o.key) != o.price]

    def commit(self, observations: list[Observation]) -> None:
        """Record prices once the backend has accepted them. Not called on failure, so they retry."""
        for o in observations:
            self.last[o.key] = o.price
        self._save()

    def _load(self) -> None:
        if not self.state_file.is_file():
            return
        try:
            raw = json.loads(self.state_file.read_text(encoding="utf-8"))
            self.last = {tuple(k.split("|", 1)): to_price(v) for k, v in raw.items()}  # type: ignore[misc]
        except (ValueError, OSError) as exc:
            log.warning("Ignoring unreadable state file %s: %s", self.state_file, exc)

    def _save(self) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.state_file.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({f"{s}|{m}": str(p) for (s, m), p in sorted(self.last.items())}, indent=2),
            encoding="utf-8",
        )
        tmp.replace(self.state_file)
