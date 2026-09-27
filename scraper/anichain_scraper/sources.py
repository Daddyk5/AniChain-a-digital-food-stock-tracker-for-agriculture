"""Source adapters: turn a fetched document into Observations.

Each Davao source publishes in its own format (JSON feed, HTML table, and eventually PDF
bulletins). Add an adapter here and register it in SOURCES; the change detection and posting
stay the same."""

from __future__ import annotations

import json
import logging
import re
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable

from .models import Observation, to_price

log = logging.getLogger(__name__)

RANGE = re.compile(r"^\s*([\d,.]+)\s*[-–]\s*([\d,.]+)\s*$")
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


class CommodityMap:
    """Maps source labels ("Pork Kasim", "BANGUS") to backend slugs and market keys."""

    def __init__(self, path: Path):
        data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
        self.aliases = {self._norm(k): v for k, v in data.get("commodities", {}).items()}
        self.markets = {self._norm(k): v for k, v in data.get("markets", {}).items()}
        self._warned: set[str] = set()

    @staticmethod
    def _norm(label: str) -> str:
        return re.sub(r"\s+", " ", label).strip().lower()

    def slug(self, label: str) -> str | None:
        norm = self._norm(label)
        if norm in self.aliases:
            return self.aliases[norm]
        # Already a slug (e.g. JSON feeds that use backend slugs directly).
        if SLUG.fullmatch(label.strip()):
            return label.strip()
        if norm not in self._warned:
            self._warned.add(norm)
            log.warning("No slug mapping for source label %r (add it to commodity_map.json)", label)
        return None

    def market(self, label: str | None, default: str) -> str:
        if not label:
            return default
        return self.markets.get(self._norm(label), label.strip().lower())


def parse_price(value: object) -> Decimal | None:
    """Accepts plain prices and ranges ("180-200" -> midpoint 190.00). None for blanks/"n/a"."""
    text = str(value).replace("₱", "").replace("PHP", "").strip()
    try:
        if m := RANGE.match(text):
            low, high = to_price(m.group(1)), to_price(m.group(2))
            return to_price((low + high) / 2)
        price = to_price(text)
        return price if price > 0 else None
    except (InvalidOperation, ValueError):
        return None


def _observations(rows: list[dict], cmap: CommodityMap, default_market: str) -> list[Observation]:
    out: list[Observation] = []
    for row in rows:
        label = row.get("slug") or row.get("commodity") or row.get("name")
        price = parse_price(row.get("price", ""))
        if not label or price is None:
            continue
        slug = cmap.slug(str(label))
        if slug:
            out.append(Observation(slug=slug, market=cmap.market(row.get("market"), default_market), price=price))
    return out


def parse_json(body: str, cmap: CommodityMap, default_market: str) -> list[Observation]:
    """`[{name|commodity|slug, price, market?}]` or `{"items": [...]}`."""
    data = json.loads(body)
    rows = data.get("items", []) if isinstance(data, dict) else data
    return _observations(rows, cmap, default_market)


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def _find(cells: list[str], *needles: str) -> int | None:
    for needle in needles:
        for i, c in enumerate(cells):
            if needle in c:
                return i
    return None


def parse_html_table(body: str, cmap: CommodityMap, default_market: str) -> list[Observation]:
    """The first row with a commodity + price header defines the columns. Header matching is
    loose ("Commodity"/"Item", "Prevailing Price"/"Price", optional "Market")."""
    parser = _TableParser()
    parser.feed(body)
    columns: dict[str, int] | None = None
    rows: list[dict] = []
    for cells in parser.rows:
        if columns is None:
            lowered = [c.lower() for c in cells]
            name, price = _find(lowered, "commodity", "item"), _find(lowered, "prevailing", "price")
            if name is not None and price is not None:
                columns = {"name": name, "price": price}
                if (market := _find(lowered, "market")) is not None:
                    columns["market"] = market
            continue
        rows.append({k: cells[i] for k, i in columns.items() if i < len(cells)})
    if columns is None:
        log.warning("No price table header found in source document")
    return _observations(rows, cmap, default_market)


Parser = Callable[[str, CommodityMap, str], list[Observation]]
SOURCES: dict[str, Parser] = {"json": parse_json, "html_table": parse_html_table}
