"""What a brokerage profile still needs before it can be submitted for review."""

from professionals.enums import SubscriptionStatus

LIVE_SUBSCRIPTION = (SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
MIN_ABOUT = 50
TOTAL = 6


def missing_items(broker) -> list[str]:
    missing = []
    if not broker.tagline.strip():
        missing.append("tagline")
    if len(broker.about.strip()) < MIN_ABOUT:
        missing.append("about")
    if not broker.public_email or not broker.public_phone:
        missing.append("contact")
    if not broker.city.strip():
        missing.append("city")
    if not broker.country_code:
        missing.append("country_code")
    if not broker.specialties:
        missing.append("specialties")
    return missing


def completeness(broker) -> dict:
    missing = missing_items(broker)
    return {"percent": round(100 * (TOTAL - len(missing)) / TOTAL), "missing": missing}


def subscription_is_live(broker) -> bool:
    subscription = getattr(broker, "subscription", None)
    return subscription is not None and subscription.status in LIVE_SUBSCRIPTION
