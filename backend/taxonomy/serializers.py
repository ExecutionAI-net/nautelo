from rest_framework import serializers

from .models import BoatBrand


class BoatBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatBrand
        fields = ["id", "name", "slug"]
