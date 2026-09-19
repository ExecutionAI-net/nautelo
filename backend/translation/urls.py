from django.urls import path

from .views import TranslateStatusView, TranslateView

urlpatterns = [
    path("translate/", TranslateView.as_view(), name="translate"),
    path("translate/status/", TranslateStatusView.as_view(), name="translate-status"),
]
