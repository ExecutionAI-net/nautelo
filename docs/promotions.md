# Featured listings (promotions)

- **Plans**: Django admin > Promotions > Promotion plans. Days, price, currency, names (EN/IT/ES), "Most popular" mark and order are editable; defaults 7 days 99 EUR, 14 days 149 EUR (popular), 30 days 199 EUR. The amount sent to Stripe is read from the plan at checkout (`price_data`), so no Stripe price has to be created or kept in sync.
- **Buying**: sell form, before "Submit for review" a pop-up offers the plans (Skip continues without buying); "Promote this boat" on live and in-review listings in the dashboard. `POST /api/v1/promotions/checkout/`.
- **Webhook**: `checkout.session.completed` with metadata `kind=listing_promotion` marks the purchase PAID after checking amount and currency (a mismatch goes to status REVIEW in admin and never features the listing).
- **Clock**: starts when the listing is live (immediately if it already is; on first publication otherwise); a second purchase stacks after the running one. A listing is featured while `featured_until` is in the future, so nothing has to expire it.
- **Where it shows**: home page Featured strip (newest activation first, slides on its own, pauses on hover or focus, respects reduced motion); until any promotion runs the strip shows the newest boats; "Featured" badge on cards; running promotions lead the everyday listings on /boats (not when sorting by price).
- **Refunds**: not automatic. A purchase for a listing that is rejected before ever going live is refunded by staff in Stripe, then set to CANCELED in admin.
- **Not done yet**: impressions/click counters and the "your boat was seen N times" report, renewal reminders, broker plan allowances, VAT handling (decide with your accountant whether Stripe Tax is needed).
