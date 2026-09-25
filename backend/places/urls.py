from django.urls import path

from .views import CitySearchView, RegionListView

urlpatterns = [
    path("places/regions/", RegionListView.as_view(), name="places-regions"),
    path("places/cities/", CitySearchView.as_view(), name="places-cities"),
]
