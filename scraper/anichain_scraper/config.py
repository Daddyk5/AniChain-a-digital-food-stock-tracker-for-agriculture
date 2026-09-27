from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

SCRAPER_DIR = Path(__file__).resolve().parent.parent


def load_dotenv(*paths: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines). Real environment variables always win,
    and the first file that defines a key wins over later ones."""
    for path in paths:
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Config:
    backend_url: str
    ingest_token: str
    source_url: str
    source_format: str  # "json" | "html_table"
    default_market: str
    interval_seconds: float
    state_file: Path
    commodity_map_file: Path
    request_timeout: float = 20.0

    @classmethod
    def from_env(cls) -> "Config":
        load_dotenv(SCRAPER_DIR / ".env", SCRAPER_DIR.parent / ".env")
        missing = [k for k in ("INGEST_TOKEN", "SOURCE_URL") if not os.environ.get(k)]
        if missing:
            raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")
        interval = float(os.environ.get("SCRAPE_INTERVAL", "90"))
        if interval < 30:
            raise SystemExit("SCRAPE_INTERVAL must be at least 30 seconds (be polite to the source).")
        return cls(
            backend_url=os.environ.get("BACKEND_URL", "http://localhost:3000").rstrip("/"),
            ingest_token=os.environ["INGEST_TOKEN"],
            source_url=os.environ["SOURCE_URL"],
            source_format=os.environ.get("SOURCE_FORMAT", "json"),
            default_market=os.environ.get("SOURCE_MARKET", "davao-city"),
            interval_seconds=interval,
            state_file=Path(os.environ.get("SCRAPER_STATE_FILE", SCRAPER_DIR / "state" / "last_prices.json")),
            commodity_map_file=Path(os.environ.get("COMMODITY_MAP_FILE", SCRAPER_DIR / "commodity_map.json")),
        )
