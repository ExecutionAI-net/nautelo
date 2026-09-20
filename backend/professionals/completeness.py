"""What a professional profile still needs before it can be submitted for review."""

from .enums import SubscriptionStatus

LIVE_SUBSCRIPTION = (SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
MIN_DESCRIPTION = 50


def missing_items(profile) -> list[str]:
    missing = []
    if not profile.display_name.strip():
        missing.append("display_name")
    if not profile.short_description.strip():
        missing.append("short_description")
    if len(profile.description.strip()) < MIN_DESCRIPTION:
        missing.append("description")
    if not profile.public_email or not profile.public_phone:
        missing.append("contact")
    if not profile.city.strip():
        missing.append("city")
    if not profile.service_area:
        missing.append("service_area")
    if not profile.services.filter(is_active=True).exists():
        missing.append("services")
    return missing


TOTAL = 7


def completeness(profile) -> dict:
    missing = missing_items(profile)
    return {"percent": round(100 * (TOTAL - len(missing)) / TOTAL), "missing": missing}


def subscription_is_live(profile) -> bool:
    subscription = getattr(profile, "subscription", None)
    return subscription is not None and subscription.status in LIVE_SUBSCRIPTION
