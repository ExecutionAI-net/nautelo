"""Reference geography (GeoNames, CC BY 4.0), refreshed by `sync_places`.

Rows are keyed by the stable GeoNames id, so a refresh updates names and
coordinates in place and never breaks anything that points at a place.
"""

from django.db import models


class Region(models.Model):
    """First-level administrative division (province, region, state)."""

    geoname_id = models.PositiveBigIntegerField(unique=True)
    country_code = models.CharField(max_length=2, db_index=True)
    admin1_code = models.CharField(max_length=20)
    name_en = models.CharField(max_length=150)
    name_it = models.CharField(max_length=150, blank=True, default="")
    name_es = models.CharField(max_length=150, blank=True, default="")

    class Meta:
        ordering = ["country_code", "name_en"]
        constraints = [models.UniqueConstraint(fields=["country_code", "admin1_code"], name="places_region_unique_code")]

    def name(self, locale: str = "en") -> str:
        return getattr(self, f"name_{locale}", "") or self.name_en

    def __str__(self) -> str:
        return f"{self.name_en} ({self.country_code})"


class City(models.Model):
    geoname_id = models.PositiveBigIntegerField(unique=True)
    country_code = models.CharField(max_length=2, db_index=True)
    region = models.ForeignKey(Region, null=True, blank=True, related_name="cities", on_delete=models.SET_NULL)
    name_en = models.CharField(max_length=200)
    name_it = models.CharField(max_length=200, blank=True, default="")
    name_es = models.CharField(max_length=200, blank=True, default="")
    ascii_name = models.CharField(max_length=200)
    # Lower-cased, space-joined spellings used for accent- and language-insensitive search.
    search_text = models.TextField(blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    population = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-population", "name_en"]
        indexes = [models.Index(fields=["country_code", "region"], name="places_city_country_region")]

    def name(self, locale: str = "en") -> str:
        return getattr(self, f"name_{locale}", "") or self.name_en

    def __str__(self) -> str:
        return f"{self.name_en} ({self.country_code})"
