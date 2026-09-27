"""Run: python -m anichain_scraper [--once]"""

from __future__ import annotations

import argparse
import logging
import random
import signal
import threading
import urllib.request

from .backend import BackendClient, BackendError
from .config import Config
from .detector import ChangeDetector
from .sources import SOURCES, CommodityMap

log = logging.getLogger("anichain_scraper")


def fetch(url: str, timeout: float) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "AniChain-PriceMonitor/0.1 (Davao City market prices)"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode(res.headers.get_content_charset() or "utf-8")


def run_cycle(cfg: Config, detector: ChangeDetector, backend: BackendClient, cmap: CommodityMap) -> None:
    body = fetch(cfg.source_url, cfg.request_timeout)
    observations = SOURCES[cfg.source_format](body, cmap, cfg.default_market)
    changed = detector.changed(observations)
    if not changed:
        log.info("Fetched %d prices, no changes", len(observations))
        return

    results = backend.ingest(changed)
    # "unchanged" means the backend already had this price (e.g. an admin entered it first).
    detector.commit([o for o, r in zip(changed, results) if r["status"] in ("changed", "unchanged")])
    for o, r in zip(changed, results):
        if r["status"] == "changed":
            log.info("CHANGE %s @ %s: %s -> %s", o.slug, o.market, r.get("previousPrice"), r["price"])
        elif r["status"] == "unknown_commodity":
            log.warning("Backend has no commodity %r; create it via POST /api/admin/commodities", o.slug)
    written = sum(r["status"] == "changed" for r in results)
    log.info("Fetched %d prices, posted %d candidates, %d written", len(observations), len(changed), written)


def main() -> None:
    ap = argparse.ArgumentParser(description="AniChain change-detection scraper")
    ap.add_argument("--once", action="store_true", help="run a single fetch/compare/post cycle and exit")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )

    cfg = Config.from_env()
    if cfg.source_format not in SOURCES:
        raise SystemExit(f"Unknown SOURCE_FORMAT {cfg.source_format!r}; choose from {sorted(SOURCES)}")
    backend = BackendClient(cfg.backend_url, cfg.ingest_token, cfg.request_timeout)
    detector = ChangeDetector(cfg.state_file)
    cmap = CommodityMap(cfg.commodity_map_file)

    try:
        detector.seed(backend.snapshot())
        log.info("Seeded baseline with %d prices from backend", len(detector.last))
    except BackendError as exc:
        log.warning("Could not seed baseline from backend (%s); using local state", exc)

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())

    log.info("Polling %s every ~%ss (%s)", cfg.source_url, cfg.interval_seconds, cfg.source_format)
    while not stop.is_set():
        try:
            run_cycle(cfg, detector, backend, cmap)
        except BackendError as exc:
            log.error("Backend error, will retry next cycle: %s", exc)
        except Exception:  # keep polling through source hiccups (timeouts, layout changes)
            log.exception("Cycle failed, will retry next cycle")
        if args.once:
            break
        # +/-10% jitter so multiple scrapers don't hit the source in lockstep.
        stop.wait(cfg.interval_seconds * random.uniform(0.9, 1.1))
    log.info("Stopped.")


if __name__ == "__main__":
    main()
