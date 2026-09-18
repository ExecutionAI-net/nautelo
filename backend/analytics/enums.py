from django.db import models


class ViewerType(models.TextChoices):
    """Spec §11.7: `viewer_type USER | ANONYMOUS`."""

    USER = "USER", "Authenticated user"
    ANONYMOUS = "ANONYMOUS", "Anonymous"


class UserAgentClass(models.TextChoices):
    """Spec §11.7: `user_agent_class HUMAN | BOT | UNKNOWN`.

    UNKNOWN is a real, populated value, not a fallback nobody writes: spec §36.2
    says "uncertain clients may count and are labeled operational limitation", so
    a request with no User-Agent at all is recorded as UNKNOWN and counted. BOT
    rows are never written by the request path (a bot is refused before any
    identity is resolved); the member exists so that a future verified-bot
    pipeline, or a staff correction, has the vocabulary the spec names.
    """

    HUMAN = "HUMAN", "Human"
    BOT = "BOT", "Bot"
    UNKNOWN = "UNKNOWN", "Unknown"
