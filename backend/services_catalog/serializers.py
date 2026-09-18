from rest_framework import serializers

from professionals.models import ProfessionalProfile

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


class ProfessionalCardSerializer(serializers.ModelSerializer):
    """One result card in the combined directory (spec §31: "Professional
    result cards | ProfessionalProfile + ProfessionalService").

    Deliberately omits public_email, public_phone and website_url: contact
    data is never public (spec §1) and is served by Phase 7's
    ContactAccessService once a grant exists.
    """

    categories = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    active_service_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProfessionalProfile
        fields = [
            "id",
            "slug",
            "display_name",
            "short_description",
            "city",
            "region",
            "country_code",
            "service_area",
            "categories",
            "active_service_count",
            "url",
        ]

    def get_url(self, obj) -> str:
        return obj.get_absolute_url()

    def get_categories(self, obj):
        # Iterate the prefetched relation in Python (never re-filter with the
        # ORM here) so the view's prefetch_related actually saves the queries.
        locale = self.context["locale"]
        seen = set()
        categories = []
        for service in obj.services.all():
            category = service.category
            if not service.is_active or not category.is_active:
                continue
            if category.slug in seen:
                continue
            seen.add(category.slug)
            categories.append(
                {"slug": category.slug, "name": localized(category, "name", locale)}
            )
        return sorted(categories, key=lambda item: item["name"])
