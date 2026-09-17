from django.urls import path

from .views import BoatBrandListView, BoatModelListView

urlpatterns = [
    path("boat-brands/", BoatBrandListView.as_view(), name="boat-brand-list"),
    path("boat-models/", BoatModelListView.as_view(), name="boat-model-list"),
]
