"""LOCAL TESTING ONLY: a fake Davao price bulletin so the scraper can be exercised end to end
before a real source is wired up. Prices are synthetic.

    python mock_source.py [--port 8765]

  GET  /bulletin.json   JSON feed   (SOURCE_FORMAT=json)
  GET  /bulletin.html   HTML table  (SOURCE_FORMAT=html_table)
  POST /bump            change one random price, so the next scrape sees exactly one change
"""

from __future__ import annotations

import argparse
import json
import random
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PRICES: dict[tuple[str, str], Decimal] = {
    ("Pork Kasim", "Bankerohan"): Decimal("340.00"),
    ("Bangus", "Bankerohan"): Decimal("220.00"),
    ("Tomato", "Agdao"): Decimal("80.00"),
    ("Red Onion", "Agdao"): Decimal("150.00"),
    ("Chicken Egg (Medium)", "Bankerohan"): Decimal("8.50"),
    ("Durian", "Agdao"): Decimal("95.00"),
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: str, content_type: str) -> None:
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/bulletin.json":
            items = [{"name": n, "market": m, "price": str(p)} for (n, m), p in PRICES.items()]
            self._send(200, json.dumps({"items": items}), "application/json")
        elif self.path == "/bulletin.html":
            rows = "".join(f"<tr><td>{n}</td><td>{m}</td><td>&#8369;{p}</td></tr>" for (n, m), p in PRICES.items())
            html = f"<table><tr><th>Commodity</th><th>Market</th><th>Prevailing Price</th></tr>{rows}</table>"
            self._send(200, f"<html><body>{html}</body></html>", "text/html")
        else:
            self._send(404, "not found", "text/plain")

    def do_POST(self):
        if self.path != "/bump":
            return self._send(404, "not found", "text/plain")
        key = random.choice(list(PRICES))
        old = PRICES[key]
        PRICES[key] = max(Decimal("1.00"), old + Decimal(random.choice([-10, -5, 5, 10])) / (10 if old < 20 else 1))
        self._send(200, json.dumps({"item": key[0], "market": key[1], "from": str(old), "to": str(PRICES[key])}), "application/json")

    def log_message(self, fmt, *args):  # quieter default logging
        print("[mock-source]", fmt % args)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    port = ap.parse_args().port
    print(f"Mock Davao bulletin on http://localhost:{port}/bulletin.json (and /bulletin.html)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
