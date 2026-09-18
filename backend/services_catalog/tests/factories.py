from services_catalog.models import ProfessionalService, ServiceCategory


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


def make_professional_service(
    professional,
    category,
    *,
    title_en="Vessel registration support",
    is_active=True,
    service_area=None,
    **extra,
):
    return ProfessionalService.objects.create(
        professional=professional,
        category=category,
        title_en=title_en,
        is_active=is_active,
        service_area=["IT-52"] if service_area is None else service_area,
        **extra,
    )
