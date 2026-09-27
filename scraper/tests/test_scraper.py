import json
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from anichain_scraper.detector import ChangeDetector
from anichain_scraper.models import Observation
from anichain_scraper.sources import CommodityMap, parse_html_table, parse_json, parse_price

MAP = Path(__file__).resolve().parent.parent / "commodity_map.json"


def obs(slug: str, price: str, market: str = "bankerohan") -> Observation:
    return Observation(slug=slug, market=market, price=Decimal(price))


class ChangeDetectorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = Path(self.tmp.name) / "state.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_only_changed_prices_pass(self):
        d = ChangeDetector(self.state)
        d.seed({("tomato", "bankerohan"): Decimal("80.00")})
        changed = d.changed([obs("tomato", "80.00"), obs("tomato", "80.00", "agdao"), obs("bangus", "220.00")])
        self.assertEqual({o.key for o in changed}, {("tomato", "agdao"), ("bangus", "bankerohan")})

    def test_commit_persists_and_suppresses_repeats(self):
        d = ChangeDetector(self.state)
        d.commit([obs("tomato", "85.00")])
        reloaded = ChangeDetector(self.state)
        self.assertEqual(reloaded.changed([obs("tomato", "85.00")]), [])
        self.assertEqual(len(reloaded.changed([obs("tomato", "85.50")])), 1)

    def test_uncommitted_changes_are_retried(self):
        d = ChangeDetector(self.state)
        first = d.changed([obs("tomato", "90.00")])
        # Backend failed, so no commit: the same change must be offered again next cycle.
        self.assertEqual(d.changed([obs("tomato", "90.00")]), first)

    def test_duplicate_rows_last_wins(self):
        d = ChangeDetector(self.state)
        changed = d.changed([obs("tomato", "90.00"), obs("tomato", "95.00")])
        self.assertEqual([o.price for o in changed], [Decimal("95.00")])


class ParsingTest(unittest.TestCase):
    def setUp(self):
        self.cmap = CommodityMap(MAP)

    def test_parse_price_formats(self):
        self.assertEqual(parse_price("₱1,250.5"), Decimal("1250.50"))
        self.assertEqual(parse_price("180-200"), Decimal("190.00"))
        self.assertIsNone(parse_price("n/a"))
        self.assertIsNone(parse_price(""))
        self.assertIsNone(parse_price("0"))

    def test_json_labels_slugs_and_markets(self):
        body = json.dumps({"items": [
            {"name": "Pork Kasim", "market": "Bankerohan Public Market", "price": "340"},
            {"slug": "tomato", "price": 80},
            {"name": "Unmapped Thing", "price": 5},
        ]})
        result = parse_json(body, self.cmap, "davao-city")
        self.assertEqual(
            [(o.slug, o.market, o.price) for o in result],
            [("pork-kasim", "bankerohan", Decimal("340.00")), ("tomato", "davao-city", Decimal("80.00"))],
        )

    def test_html_table(self):
        html = """<p>DCAFC bulletin</p><table>
          <tr><th>Item</th><th>Unit</th><th>Market</th><th>Prevailing Price</th></tr>
          <tr><td>Bangus</td><td>kg</td><td>Agdao</td><td>&#8369;220.00</td></tr>
          <tr><td> Red  Onion </td><td>kg</td><td>Agdao</td><td>140-160</td></tr>
          <tr><td>Pechay</td><td>kg</td><td>Agdao</td><td>n/a</td></tr>
        </table>"""
        result = parse_html_table(html, self.cmap, "davao-city")
        self.assertEqual(
            [(o.slug, o.market, o.price) for o in result],
            [("bangus", "agdao", Decimal("220.00")), ("onion-red", "agdao", Decimal("150.00"))],
        )


if __name__ == "__main__":
    unittest.main()
