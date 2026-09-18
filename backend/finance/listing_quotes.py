"""Listing-aware finance rules (spec §17.2, §18.2, §18.5).

This module is the `FinanceQuoteService` spec §31's traceability matrix names
for the "Estimated installment" and "Finance assumptions" rows. Phase 8 owns
the arithmetic (finance.calculations) and the stored global defaults
(finance.models / finance.services); everything that depends on *a listing*
lives here.

Import direction (load-bearing): this module may import listings.models,
listings.enums and accounts.enums, and NOTHING else from the listings app.
listings.serializers imports this module, so importing listings.serializers or
listings.views from here would close an import cycle. The single consumer that
needs listings.views.published_listings_queryset is finance.views, which
nothing in listings imports.
"""

from dataclasses import dataclass
from decimal import Decimal

from accounts.enums import SellerType
from listings.enums import ListingStatus
from listings.models import BoatListing, ListingSnapshot
from platform_settings.services import get_setting_value, is_feature_enabled

from .calculations import calculate_finance_quote
from .models import FinanceConfigurationVersion
from .serializers import SUPPORTED_CURRENCIES
from .services import FinanceConfigurationService

FINANCE_ESTIMATES_FLAG = "finance_estimates"
FINANCE_ENABLED_SETTING = "finance.enabled"
BROKER_OVERRIDES_SETTING = "finance.broker_overrides_enabled"

#: Spec §17.2: "Store/return the effective source of each value: GLOBAL or
#: LISTING_OVERRIDE." REQUESTED is this plan's third value, used only by the
#: finance page's exploration mode (spec §36.1's "the finance page may let user
#: explore alternative rate/term/down payment values"), so a response can never
#: present a viewer's own input as a platform assumption.
GLOBAL = "GLOBAL"
LISTING_OVERRIDE = "LISTING_OVERRIDE"
REQUESTED = "REQUESTED"

ASSUMPTION_FIELDS = ("annual_rate_percent", "term_months", "down_payment_percent")

# Spec §17.3's validation ranges, restated here because this module applies them
# to values that were validated when they were *stored* and must be re-checked
# when they are *read* (a validator can change; a stored row does not).
MIN_PRICE = Decimal("0.01")
MAX_PRICE = Decimal("999999999.99")
MIN_RATE_PERCENT = Decimal(0)
MAX_RATE_PERCENT = Decimal(100)
MIN_DOWN_PAYMENT_PERCENT = Decimal(0)
MAX_DOWN_PAYMENT_PERCENT = Decimal("99.99")
MIN_TERM_MONTHS = 1
MAX_TERM_MONTHS = 360


class FinanceConfigurationUnavailable(RuntimeError):
    """Raised when effective assumptions are asked for with no active
    configuration to resolve them against.

    This never reaches a public response. Every public path checks
    FinanceQuoteService.is_visible() first (which implies FinancePolicy.active,
    which implies a configuration), and card_block() answers {"visible": False}
    instead of raising. It exists so that a later phase calling the exported
    resolve_effective_assumptions() without that precondition fails loudly at
    its own call site, with a sentence naming what is missing, rather than
    dereferencing None deep inside this module.
    """


@dataclass(frozen=True)
class FinancePolicy:
    """The request-scoped answer to "is finance on, and may brokers override?".

    Loaded once per request and passed down, because get_setting_value() hits
    Postgres on every call: resolving it per card would cost two queries per
    row of a 24-card page.
    """

    estimates_enabled: bool
    finance_enabled: bool
    broker_overrides_enabled: bool
    configuration: FinanceConfigurationVersion | None

    @property
    def active(self) -> bool:
        return (
            self.estimates_enabled
            and self.finance_enabled
            and self.configuration is not None
        )

    @classmethod
    def load(cls) -> "FinancePolicy":
        estimates_enabled = is_feature_enabled(FINANCE_ESTIMATES_FLAG, default=False)
        finance_enabled = bool(get_setting_value(FINANCE_ENABLED_SETTING))
        configuration = None
        if estimates_enabled and finance_enabled:
            try:
                configuration = FinanceConfigurationService.get_active_configuration()
            except FinanceConfigurationVersion.DoesNotExist:
                # Phase 8's migration 0002 always seeds a version, but staff can
                # delete rows in Django admin. A public card degrades to "no
                # finance"; it never 500s.
                configuration = None
        return cls(
            estimates_enabled=estimates_enabled,
            finance_enabled=finance_enabled,
            broker_overrides_enabled=bool(get_setting_value(BROKER_OVERRIDES_SETTING)),
            configuration=configuration,
        )


@dataclass(frozen=True)
class EffectiveAssumptions:
    """The three numbers a quote is calculated from, plus where each came from."""

    annual_rate_percent: Decimal
    term_months: int
    down_payment_percent: Decimal
    configuration_version: int
    sources: dict[str, str]


def _in_range(value, *, minimum, maximum):
    """Spec §17.2 step 2: only *valid* stored overrides are applied."""
    if value is None:
        return None
    return value if minimum <= value <= maximum else None


def resolve_effective_assumptions(
    *, snapshot: ListingSnapshot | None, policy: FinancePolicy
) -> EffectiveAssumptions:
    """Spec §17.2's precedence: global configuration, then valid listing
    overrides when staff permit them.

    Precondition: `policy.configuration is not None` — equivalently,
    `policy.active` is True. Both call sites in this phase reach here only after
    FinanceQuoteService.is_visible() returned True, which implies it. The
    precondition is *enforced* rather than documented because this function is
    exported to later phases (see the Phase 9 plan's Contract summary), and a
    caller who does not know the implicit rule would otherwise get an
    AttributeError on None from inside a module it did not write.
    """
    configuration = policy.configuration
    if configuration is None:
        raise FinanceConfigurationUnavailable(
            "resolve_effective_assumptions() requires an active finance "
            "configuration to resolve against. Check FinancePolicy.active — or "
            "call FinanceQuoteService.is_visible() first, which implies it — "
            "before calling this. policy.configuration is None whenever finance "
            "is globally disabled, the finance_estimates flag is off, or no "
            "active FinanceConfigurationVersion row exists."
        )
    values = {
        "annual_rate_percent": configuration.annual_rate_percent,
        "term_months": configuration.term_months,
        "down_payment_percent": configuration.down_payment_percent,
    }
    sources = {field: GLOBAL for field in ASSUMPTION_FIELDS}

    if policy.broker_overrides_enabled and snapshot is not None:
        overrides = {
            "annual_rate_percent": _in_range(
                snapshot.finance_rate_override_percent,
                minimum=MIN_RATE_PERCENT,
                maximum=MAX_RATE_PERCENT,
            ),
            "term_months": _in_range(
                snapshot.finance_term_override_months,
                minimum=MIN_TERM_MONTHS,
                maximum=MAX_TERM_MONTHS,
            ),
            "down_payment_percent": _in_range(
                snapshot.finance_down_payment_override_percent,
                minimum=MIN_DOWN_PAYMENT_PERCENT,
                maximum=MAX_DOWN_PAYMENT_PERCENT,
            ),
        }
        for field, override in overrides.items():
            if override is not None:
                values[field] = override
                sources[field] = LISTING_OVERRIDE

    return EffectiveAssumptions(
        annual_rate_percent=values["annual_rate_percent"],
        term_months=values["term_months"],
        down_payment_percent=values["down_payment_percent"],
        configuration_version=configuration.version,
        sources=sources,
    )


def is_financeable_price(price, currency) -> bool:
    """Spec §18.2's "listing.price is valid AND listing.currency is supported"."""
    return (
        price is not None
        and MIN_PRICE <= price <= MAX_PRICE
        and currency in SUPPORTED_CURRENCIES
    )


def format_percent(value: Decimal) -> str:
    """Spec §30.2: rates are decimal strings; §11.6 stores them at 4 places."""
    return f"{value.quantize(Decimal('0.0001')):f}"


class FinanceQuoteService:
    """Spec §31's named backend source for the estimated installment."""

    @staticmethod
    def is_visible(listing: BoatListing, *, policy: FinancePolicy) -> bool:
        """Spec §18.2's conjunction, in the order the spec writes it.

        Every condition is checked independently — in particular seller_type is
        not inferred from the snapshot's flag, even though a database constraint
        keeps that flag off private listings today.
        """
        snapshot = listing.current_public_snapshot
        return (
            listing.seller_type == SellerType.BROKER
            and snapshot is not None
            and snapshot.show_finance_estimate
            and policy.active
            and is_financeable_price(snapshot.price, snapshot.currency)
            and listing.status == ListingStatus.PUBLISHED
        )

    @staticmethod
    def card_block(listing: BoatListing, *, policy: FinancePolicy) -> dict:
        """Spec §18.5's `finance` block: six keys when eligible, one when not.

        Nothing between those two shapes is ever returned — spec §18.2: "Do not
        show zeros or disabled finance placeholders."
        """
        if not FinanceQuoteService.is_visible(listing, policy=policy):
            return {"visible": False}

        snapshot = listing.current_public_snapshot
        assumptions = resolve_effective_assumptions(snapshot=snapshot, policy=policy)
        result = calculate_finance_quote(
            price=snapshot.price,
            down_payment_percent=assumptions.down_payment_percent,
            annual_rate_percent=assumptions.annual_rate_percent,
            term_months=assumptions.term_months,
        )
        return {
            "visible": True,
            "monthly_payment": f"{result.monthly_payment:f}",
            "annual_rate_percent": format_percent(assumptions.annual_rate_percent),
            "term_months": assumptions.term_months,
            "down_payment_percent": format_percent(assumptions.down_payment_percent),
            "configuration_version": assumptions.configuration_version,
        }
