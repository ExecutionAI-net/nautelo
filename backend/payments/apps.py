from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "payments"
    verbose_name = "Payments and products"

    def ready(self):
        from . import fulfillment  # noqa: F401
        from . import notification_receivers  # noqa: F401
        from . import refunds  # noqa: F401
