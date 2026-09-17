from django.core.cache import cache
from django.db import transaction
from django.db.models import Max

from .models import FinanceConfigurationVersion

ACTIVE_CONFIGURATION_CACHE_KEY = "finance:active_configuration_version"
ACTIVE_CONFIGURATION_CACHE_TTL_SECONDS = 300


class FinanceConfigurationService:
    """Reads and mutates the single active `FinanceConfigurationVersion`."""

    @staticmethod
    def get_active_configuration() -> FinanceConfigurationVersion:
        cached = cache.get(ACTIVE_CONFIGURATION_CACHE_KEY)
        if cached is not None:
            return cached

        config = FinanceConfigurationVersion.objects.get(is_active=True)
        cache.set(
            ACTIVE_CONFIGURATION_CACHE_KEY,
            config,
            ACTIVE_CONFIGURATION_CACHE_TTL_SECONDS,
        )
        return config

    @staticmethod
    def activate(new_config: FinanceConfigurationVersion) -> FinanceConfigurationVersion:
        """Persists `new_config` as the new active version.

        `new_config` must be an unsaved `FinanceConfigurationVersion` instance
        with `annual_rate_percent`, `term_months`, `down_payment_percent`
        and (optionally) `created_by_user_id` already set — this method
        assigns `version` and `is_active` itself,
        deactivates whichever version was previously active, and invalidates
        the cache once the transaction actually commits.
        """
        with transaction.atomic():
            previous_active = (
                FinanceConfigurationVersion.objects.select_for_update()
                .filter(is_active=True)
                .first()
            )
            next_version = (
                FinanceConfigurationVersion.objects.aggregate(Max("version"))["version__max"]
                or 0
            ) + 1

            if previous_active is not None:
                previous_active.is_active = False
                previous_active.save(update_fields=["is_active"])

            new_config.version = next_version
            new_config.is_active = True
            new_config.save()

            transaction.on_commit(FinanceConfigurationService._invalidate_cache)

        return new_config

    @staticmethod
    def _invalidate_cache():
        cache.delete(ACTIVE_CONFIGURATION_CACHE_KEY)
