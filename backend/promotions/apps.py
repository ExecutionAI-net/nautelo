from django.apps import AppConfig


class PromotionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "promotions"

    def ready(self):
        from . import receivers  # noqa: F401
