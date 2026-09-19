from decimal import Decimal

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService

from .services import get_public_settings


def _active_finance_configuration() -> dict | None:
    """Spec §1's global finance defaults as the platform currently holds them.

    Published because spec §2.1 forbids a production surface from showing
    invented or hard-coded operational data and spec §17.5 requires a staff
    change to reach "boat cards and the finance page" automatically. The
    standalone /financing/ calculator (spec §4.1) has no listing to read
    assumptions from, so without this it would have to either hard-code a stale
    copy of these numbers or show an empty form. Nothing new is disclosed: the
    same four values already appear on every eligible boat card in spec §18.5's
    finance block, on the same unauthenticated endpoint family.

    Read-only. Staff still change the defaults the one supported way, by
    activating a new FinanceConfigurationVersion.
    """
    try:
        configuration = FinanceConfigurationService.get_active_configuration()
    except FinanceConfigurationVersion.DoesNotExist:
        # Degrade, never 500 — same choice FinancePolicy.load() makes on the
        # card path. The caller renders an un-prefilled form rather than
        # inventing numbers.
        return None
    return {
        "version": configuration.version,
        # Spec §30.2: rates are decimal strings; §11.6 stores them at four
        # places. Matches finance.listing_quotes.format_percent exactly, so the
        # finance page and a boat card can never render one rate two ways.
        "annual_rate_percent": f"{configuration.annual_rate_percent.quantize(Decimal('0.0001')):f}",
        "term_months": configuration.term_months,
        "down_payment_percent": f"{configuration.down_payment_percent.quantize(Decimal('0.0001')):f}",
    }


class PublicPlatformSettingsView(APIView):
    throttle_scope = "public_settings"

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        # Composed here rather than inside get_public_settings() on purpose.
        # That function caches its whole payload under "platform_settings:public"
        # with timeout=None and is invalidated only by update_setting(), which
        # activating a FinanceConfigurationVersion does not call — folding the
        # configuration in there would freeze it forever and quietly break spec
        # §17.5. Read through FinanceConfigurationService instead, which owns a
        # 300-second TTL that activate() invalidates on commit.
        return Response(
            {
                **get_public_settings(),
                "finance_configuration": _active_finance_configuration(),
            }
        )
