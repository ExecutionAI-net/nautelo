"""Reconcile the plans/packages configured in Django against the Stripe
Products Staff created by hand in the Stripe Dashboard.

Staff creates a Product (with a recurring or one-off default Price) in Stripe
first — that is the only place a human enters a price today. This command
then makes the platform's own rows agree with it: it fetches every active
Stripe Product with its default Price and, for each one this command
recognizes by name, writes `stripe_product_id` / `stripe_price_id` and copies
the amount/currency onto the matching row. Stripe is the amount authority
(see payments.gateway's module docstring and payments/models.py's
`MarketplaceProduct` docstring) — this command is how that authority reaches
BrokerPlan, ProfessionalPlan and ListingPackage, which (unlike
MarketplaceProduct) have no admin flow of their own for it yet.

Safe to re-run: every row is upserted by its own slug/stripe_product_id, never
duplicated, and a Stripe Product this command does not recognize by name is
left alone (not an error — Staff may have test products in the sandbox this
command has no opinion about).

    python manage.py link_stripe_products
    python manage.py link_stripe_products --dry-run
"""

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from brokers.models import BrokerPlan
from payments.gateway import ProductWithPrice, StripeUnavailable, default_gateway
from payments.models import ListingPackage
from professionals.models import ProfessionalPlan

# Local slug for each Stripe Product name this command recognizes. A name not
# in either map is skipped, not an error (spec: see the module docstring).
BROKER_PLAN_SLUG_BY_PRODUCT_NAME = {
    "Boutique Broker": "boutique-broker",
    "Premier Fleet": "premier-fleet",
    "Sovereign Agency": "sovereign-agency",
}
PROFESSIONAL_PLAN_PRODUCT_NAME = "Professional Membership"
PROFESSIONAL_PLAN_SLUG = "professional-membership"

# New ListingPackage rows this command creates/updates, keyed by the Stripe
# Product name Staff gave it. The existing 1/2/3-month rows (seeded by
# payments/migrations/0007_seed_listing_packages.py) were never priced
# (display_amount=0, is_active=False) and are superseded by this weekly/
# monthly line-up; this command does not touch or delete them, so they stay
# exactly as they are — inactive and, in effect, archived.
LISTING_PACKAGE_BY_PRODUCT_NAME = {
    "Paid listing right 1week": {"slug": "listing-1-week", "publication_days": 7},
    "Paid listing right 2 weeks": {"slug": "listing-2-weeks", "publication_days": 14},
    "Paid listing right 1 Month": {"slug": "listing-1-month", "publication_days": 30},
}


class Command(BaseCommand):
    help = "Link BrokerPlan/ProfessionalPlan/ListingPackage rows to the matching Stripe Products."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        try:
            products = default_gateway().list_active_products_with_prices()
        except StripeUnavailable as exc:
            raise CommandError(str(exc)) from exc

        by_name: dict[str, ProductWithPrice] = {}
        for product in products:
            # Two active Stripe Products sharing a name would make the
            # mapping ambiguous; refuse rather than silently pick one.
            if product.product_name in by_name:
                raise CommandError(f"Two active Stripe Products are both named {product.product_name!r}.")
            by_name[product.product_name] = product

        missing = [
            name
            for name in (
                *BROKER_PLAN_SLUG_BY_PRODUCT_NAME,
                PROFESSIONAL_PLAN_PRODUCT_NAME,
                *LISTING_PACKAGE_BY_PRODUCT_NAME,
            )
            if name not in by_name
        ]
        if missing:
            seen = ", ".join(sorted(by_name)) or "(none)"
            raise CommandError(
                "Missing Stripe Products (create them in the Dashboard first): "
                + ", ".join(missing)
                + f". Active Stripe Products seen: {seen}."
            )

        changes = []
        with transaction.atomic():
            for name, slug in BROKER_PLAN_SLUG_BY_PRODUCT_NAME.items():
                changes.append(self._link_broker_plan(slug, by_name[name], dry_run=dry_run))
            changes.append(
                self._link_professional_plan(by_name[PROFESSIONAL_PLAN_PRODUCT_NAME], dry_run=dry_run)
            )
            for name, spec in LISTING_PACKAGE_BY_PRODUCT_NAME.items():
                changes.append(self._link_listing_package(spec, by_name[name], dry_run=dry_run))
            if dry_run:
                transaction.set_rollback(True)

        for line in changes:
            self.stdout.write(line)
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run: nothing was written."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Linked {len(changes)} plans/packages to Stripe."))

    @staticmethod
    def _amount(product: ProductWithPrice) -> Decimal:
        if product.unit_amount is None:
            raise CommandError(
                f"Stripe Product {product.product_name!r} has a tiered/custom price; "
                "give it a flat amount before linking."
            )
        return Decimal(product.unit_amount) / Decimal(100)

    def _link_broker_plan(self, slug: str, product: ProductWithPrice, *, dry_run: bool) -> str:
        try:
            plan = BrokerPlan.objects.get(slug=slug)
        except BrokerPlan.DoesNotExist as exc:
            raise CommandError(f"No BrokerPlan with slug {slug!r} — seed it before linking.") from exc
        before = (plan.monthly_price, plan.stripe_product_id, plan.stripe_price_id)
        plan.monthly_price = self._amount(product)
        plan.currency = product.currency.upper()
        plan.stripe_product_id = product.product_id
        plan.stripe_price_id = product.price_id
        if not dry_run:
            plan.save(update_fields=["monthly_price", "currency", "stripe_product_id", "stripe_price_id"])
        return f"BrokerPlan[{slug}] {before} -> ({plan.monthly_price}, {plan.stripe_product_id}, {plan.stripe_price_id})"

    def _link_professional_plan(self, product: ProductWithPrice, *, dry_run: bool) -> str:
        try:
            plan = ProfessionalPlan.objects.get(slug=PROFESSIONAL_PLAN_SLUG)
        except ProfessionalPlan.DoesNotExist as exc:
            raise CommandError("No ProfessionalPlan seeded — run the platform's own migrations first.") from exc
        before = (plan.monthly_price, plan.is_active, plan.stripe_product_id, plan.stripe_price_id)
        plan.monthly_price = self._amount(product)
        plan.currency = product.currency.upper()
        plan.stripe_product_id = product.product_id
        plan.stripe_price_id = product.price_id
        plan.is_active = True
        if not dry_run:
            plan.save(
                update_fields=["monthly_price", "currency", "stripe_product_id", "stripe_price_id", "is_active"]
            )
        return f"ProfessionalPlan[{PROFESSIONAL_PLAN_SLUG}] {before} -> ({plan.monthly_price}, {plan.is_active}, {plan.stripe_product_id}, {plan.stripe_price_id})"

    def _link_listing_package(self, spec: dict, product: ProductWithPrice, *, dry_run: bool) -> str:
        slug = spec["slug"]
        amount = self._amount(product)
        defaults = {
            "name_en": product.product_name,
            "publication_days": spec["publication_days"],
            "image_limit": 20,
            "video_limit": 1,
            "description_en": f"Your boat online for {spec['publication_days']} days with up to 20 photos and 1 video.",
            "display_amount": amount,
            "currency": product.currency.upper(),
            "stripe_product_id": product.product_id,
            "stripe_price_id": product.price_id,
            "is_active": True,
            "display_order": spec["publication_days"],
        }
        if dry_run:
            existed = ListingPackage.objects.filter(slug=slug).exists()
            return f"ListingPackage[{slug}] {'update' if existed else 'create'} -> {defaults}"
        package, created = ListingPackage.objects.update_or_create(slug=slug, defaults=defaults)
        return f"ListingPackage[{slug}] {'created' if created else 'updated'} -> ({package.display_amount}, {package.stripe_product_id}, {package.stripe_price_id})"
