from services_catalog.models import ServiceCategory


def make_service_category(
    *,
    slug="generic-service",
    name_en="Generic Service",
    display_order=0,
    is_active=True,
    has_seo_page=False,
    **extra,
):
    return ServiceCategory.objects.create(
        slug=slug,
        name_en=name_en,
        display_order=display_order,
        is_active=is_active,
        has_seo_page=has_seo_page,
        **extra,
    )
