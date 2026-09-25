from django.contrib import admin

from .models import City, Region


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name_en", "country_code", "admin1_code")
    list_filter = ("country_code",)
    search_fields = ("name_en", "name_it", "name_es")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name_en", "country_code", "region", "population")
    list_filter = ("country_code",)
    search_fields = ("name_en", "ascii_name", "search_text")
