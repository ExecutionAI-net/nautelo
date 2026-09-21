# Financing simulator

Home page band ("See what your boat could cost per month") and the top of `/financing/`. It is an indicative estimate, not an offer; Nauta does not lend money.

## How it works
- The rulebook is `finance.FinanceRule` (Django admin > Finance > Finance rules). The browser reads it once from `GET /api/v1/finance/simulator-config/` (cached 5 minutes)
  and calculates every slider move locally, so nothing is sent to the server while a slider moves.
- `frontend/src/lib/finance/simulator.ts` and `backend/finance/simulator.py` are the same formulas. `frontend/src/lib/finance/golden.json` holds shared vectors
  that both test suites check (regenerate with `finance/tests/make_golden.py` if the formula ever changes on purpose).
- Loan: fixed-rate annuity. Leasing: the same annuity on what is left after the purchase option (`residual_percent` of the price, paid at the end), VAT added to the instalments when `vat_on_installment` is set.
- "I have a monthly budget" runs the formula backwards (the payment is linear in the price) and links to `/boats/?price_max=...` with the number of boats listed at that price.
- "Ask for a financing study" opens `/financing/?price=...&down=...&term=...#study`. The form stores the request, and the server recalculates from the rulebook and keeps it in `details.calculated`.

## Changing it (no deploy needed)
| To do this | Do this in the admin |
|---|---|
| Change a rate or fee | Edit `tin_percent`, `tae_percent`, `opening_fee_percent` on the row |
| Add a market | Add rows for the new `country_code` (the country switch appears by itself) |
| Add a term or limit the ages | `terms_years`, `age_plus_term_limit`, `max_age_at_end_years` |
| Change VAT | `vat_percent`, `vat_on_installment`, `vat_recoverable` (companies see the instalment without VAT first) |
| Rule for new vs used, private vs company | Add a row with that `condition` / `use`; the most specific matching row wins, "Any" is the fallback |
| Wording under the result | `note_en`, `note_it`, `note_es` |

Seeded rows (migration `0005`) are illustrative assumptions from public bank and broker pages: Spain and Italy, loan and leasing, new and used, private and company.
Replace them with the lender's real figures before this goes in front of customers.

A new *question* for the visitor (not just a number) is a small code change in `FinanceSimulator.tsx`; everything data-shaped above needs none.
