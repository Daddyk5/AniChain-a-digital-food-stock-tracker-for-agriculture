from __future__ import annotations

import json
import urllib.error
import urllib.request
from decimal import Decimal

from .models import Observation, to_price

MAX_BATCH = 500  # matches the backend's limit on /api/ingest/prices


class BackendError(RuntimeError):
    pass


class BackendClient:
    def __init__(self, base_url: str, token: str, timeout: float):
        self.base_url = base_url
        self.token = token
        self.timeout = timeout

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        req = urllib.request.Request(
            self.base_url + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as exc:
            raise BackendError(f"{method} {path} -> HTTP {exc.code}: {exc.read()[:300]!r}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise BackendError(f"{method} {path} failed: {exc}") from exc

    def snapshot(self) -> dict[tuple[str, str], Decimal]:
        """Latest stored price per (slug, market): the authoritative baseline for change detection."""
        items = self._request("GET", "/api/commodities")["items"]
        return {(i["slug"], i["marketLocation"]): to_price(i["price"]) for i in items}

    def ingest(self, observations: list[Observation]) -> list[dict]:
        results: list[dict] = []
        for i in range(0, len(observations), MAX_BATCH):
            batch = observations[i : i + MAX_BATCH]
            res = self._request("POST", "/api/ingest/prices", {"observations": [o.to_payload() for o in batch]})
            results.extend(res["results"])
        return results
