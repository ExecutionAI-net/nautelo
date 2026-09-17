from django.urls import path

from .views import BoatBrandListView

urlpatterns = [
    path("boat-brands/", BoatBrandListView.as_view(), name="boat-brand-list"),
]
