from rest_framework import serializers

from .models import BoatBrand


class BoatBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatBrand
        fields = ["id", "name", "slug"]


from .models import BoatModel


class BoatModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatModel
        fields = ["id", "name", "slug"]
