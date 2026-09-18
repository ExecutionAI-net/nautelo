from rest_framework import serializers

from .models import ServiceCategory
from .services import localized


class ServiceCategorySerializer(serializers.ModelSerializer):
    """Collapses the three name/description columns to the requested locale.

    Requires context["locale"] — supplied by LocalizedContextMixin.
    """

    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "icon_key",
            "display_order",
            "has_seo_page",
            "url",
        ]

    def get_name(self, obj) -> str:
        return localized(obj, "name", self.context["locale"])

    def get_description(self, obj) -> str:
        return localized(obj, "description", self.context["locale"])

    def get_url(self, obj):
        # Only the approved SEO categories have a public detail page.
        return obj.get_absolute_url() if obj.has_seo_page else None


class ServiceCategoryDetailSerializer(ServiceCategorySerializer):
    seo_title = serializers.SerializerMethodField()
    seo_description = serializers.SerializerMethodField()

    class Meta(ServiceCategorySerializer.Meta):
        fields = ServiceCategorySerializer.Meta.fields + ["seo_title", "seo_description"]

    def get_seo_title(self, obj) -> str:
        return localized(obj, "seo_title", self.context["locale"])

    def get_seo_description(self, obj) -> str:
        return localized(obj, "seo_description", self.context["locale"])
