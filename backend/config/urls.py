"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

from common.views import HealthCheckView
from finance.views import FinanceQuoteView
from payments.views import StripeWebhookView
from platform_settings.views import PublicPlatformSettingsView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path(
        "api/v1/platform/public-settings/",
        PublicPlatformSettingsView.as_view(),
        name="platform-public-settings",
    ),
    path("api/v1/finance/quotes/", FinanceQuoteView.as_view(), name="finance-quote"),
    path("api/v1/", include("content.urls")),
    path("api/v1/", include("staffops.urls")),
    path("api/v1/", include("translation.urls")),
    path("api/v1/", include("taxonomy.urls")),
    path("api/v1/", include("listings.urls")),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("brokers.urls")),
    path("api/v1/", include("contactdesk.urls")),
    path("api/v1/", include("places.urls")),
    path("api/v1/", include("promotions.urls")),
    path("api/v1/", include("services_catalog.urls")),
    path("api/v1/", include("services_catalog.provider_urls")),
    path("api/v1/", include("professionals.urls")),
    path("api/v1/", include("entitlements.urls")),
    path("api/v1/", include("payments.urls")),
    path("api/v1/", include("messaging.urls")),
    path("api/v1/", include("notifications.urls")),
]
