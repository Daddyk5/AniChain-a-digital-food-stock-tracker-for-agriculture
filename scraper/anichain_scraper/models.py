from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENTAVO = Decimal("0.01")


def to_price(value: object) -> Decimal:
    """Normalizes a scraped price ("₱ 1,250.5", 1250.5) to 2 decimal places, matching numeric(12,2)."""
    text = str(value).replace("₱", "").replace("PHP", "").replace(",", "").strip()
    return Decimal(text).quantize(CENTAVO, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Observation:
    slug: str
    market: str
    price: Decimal

    @property
    def key(self) -> tuple[str, str]:
        return (self.slug, self.market)

    def to_payload(self) -> dict:
        return {"slug": self.slug, "marketLocation": self.market, "price": str(self.price)}
