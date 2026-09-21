from rest_framework import serializers

from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .models import ProfessionalService, ServiceCategory
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
    logo_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    active_service_count = serializers.IntegerField(read_only=True)
    is_featured = serializers.SerializerMethodField()

    def get_is_featured(self, obj) -> bool:
        from django.utils import timezone

        return bool(obj.featured_until and obj.featured_until > timezone.now())

    def get_logo_url(self, obj):
        from common.org_images import resolve_url

        return resolve_url(obj.logo_key)

    def get_cover_url(self, obj):
        from common.org_images import resolve_url

        return resolve_url(obj.cover_key)

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
            "logo_url",
            "cover_url",
            "is_featured",
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


RELATED_PROFESSIONAL_LIMIT = 4


class ProfessionalServiceSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = ProfessionalService
        fields = ["id", "title", "description", "service_area", "category"]

    def get_title(self, obj) -> str:
        return localized(obj, "title", self.context["locale"])

    def get_description(self, obj) -> str:
        return localized(obj, "description", self.context["locale"])

    def get_category(self, obj) -> dict:
        return {
            "slug": obj.category.slug,
            "name": localized(obj.category, "name", self.context["locale"]),
        }


class ProfessionalDetailSerializer(ProfessionalCardSerializer):
    """Spec §14.2's professional detail template, minus the two sections other
    phases own: the shared inquiry form (Phase 6) and the contact panel
    governed by ContactAccessService (Phase 7). Portfolio/gallery is absent
    because no media records exist — spec §14.2 permits it "only when real
    backend records exist".
    """

    services = serializers.SerializerMethodField()
    related = serializers.SerializerMethodField()
    team = serializers.SerializerMethodField()

    class Meta(ProfessionalCardSerializer.Meta):
        fields = ProfessionalCardSerializer.Meta.fields + [
            "description",
            "team",
            "services",
            "related",
        ]

    def get_team(self, obj):
        return [
            # No e-mail address here: contact details are released only through the gated contact panel.
            {"name": m.user.full_name or "Team member", "role": m.role}
            for m in obj.memberships.select_related("user").filter(is_active=True, show_on_profile=True)
        ]

    def get_services(self, obj):
        active = [
            service
            for service in obj.services.all()
            if service.is_active and service.category.is_active
        ]
        active.sort(key=lambda service: (service.category.display_order, service.title_en))
        return ProfessionalServiceSerializer(active, many=True, context=self.context).data

    def get_related(self, obj):
        category_ids = {
            service.category_id for service in obj.services.all() if service.is_active
        }
        if not category_ids:
            return []
        peers = (
            type(obj)
            .objects.filter(
                status=ProfessionalProfileStatus.ACTIVE,
                services__is_active=True,
                # The peer's shared category must itself still be active, the
                # same check get_categories and get_services already make. A
                # peer whose only shared category was deactivated is otherwise
                # surfaced as "related" with no reachable category behind it.
                services__category__is_active=True,
                services__category_id__in=category_ids,
            )
            .exclude(pk=obj.pk)
            # `display_name` isn't unique, so `id` is appended as a final
            # tiebreak, matching the directory search view's ordering: without
            # it two peers sharing a name could swap places between requests
            # and change which ones survive the RELATED_PROFESSIONAL_LIMIT cut.
            .order_by("display_name", "id")
            .distinct()[:RELATED_PROFESSIONAL_LIMIT]
        )
        return [
            {
                "slug": peer.slug,
                "display_name": peer.display_name,
                "city": peer.city,
                "url": peer.get_absolute_url(),
            }
            for peer in peers
        ]
