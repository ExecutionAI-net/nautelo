"""Payment signals (spec §23.3 step 9, §23.4).

There is no `notifications` app yet (Phase 6/18), so this phase does what Phase
13 did for listing expiry: define the signal, fire it with everything a receiver
needs, and let Phase 18 connect the receivers. Both are fired inside
transaction.on_commit() — a receiver that emailed "your right is ready" from
inside the transaction would send it even when the transaction later rolled back.
"""

import django.dispatch

# sender = payments.models.PaymentOrder
#   order:       the fulfilled PaymentOrder
#   entitlement: the UserEntitlement it created
payment_fulfilled = django.dispatch.Signal()

# sender = payments.models.PaymentOrder
#   order:  the PaymentOrder needing attention
#   reason: a short machine string ("amount_mismatch", "refund_of_consumed_right",
#           "dispute", "currency_mismatch", ...)
#   detail: a short human string, free of secrets and of anything Stripe sent
payment_needs_staff_review = django.dispatch.Signal()
