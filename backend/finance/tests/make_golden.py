"""Writes frontend/src/lib/finance/golden.json from the Python simulator (run from backend/ with DJANGO_SETTINGS set)."""

import json
from pathlib import Path

from finance.simulator import simulate

BASE = {"opening_fee_percent": 0, "residual_percent": 0, "vat_percent": None, "vat_on_installment": False}
CASES = [
    ({**BASE, "product": "LOAN", "tin_percent": 6.5}, 180000, 20, 10),
    ({**BASE, "product": "LOAN", "tin_percent": 5.9}, 50000, 0, 5),
    ({**BASE, "product": "LOAN", "tin_percent": 0}, 60000, 10, 5),
    ({**BASE, "product": "LOAN", "tin_percent": 7.1, "opening_fee_percent": 1.5}, 120000, 25, 7),
    ({**BASE, "product": "LEASING", "tin_percent": 5.5, "residual_percent": 5, "vat_percent": 21, "vat_on_installment": True}, 250000, 20, 10),
    ({**BASE, "product": "LEASING", "tin_percent": 6.5, "residual_percent": 1, "vat_percent": 22, "vat_on_installment": True}, 90000, 30, 8),
    ({**BASE, "product": "LEASING", "tin_percent": 5.0, "residual_percent": 10}, 400000, 35, 12),
    ({**BASE, "product": "LOAN", "tin_percent": 9.9}, 15000, 50, 15),
]

out = []
for rule, price, down, years in CASES:
    result = simulate(rule, price=price, down_percent=down, term_years=years)
    out.append({"rule": rule, "input": {"price": price, "down_percent": down, "term_years": years}, "expected": {k: str(v) for k, v in result.items()}})
target = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "finance" / "golden.json"
target.write_text(json.dumps(out, indent=2) + "\n", encoding="utf8")
print("wrote", target, len(out))
