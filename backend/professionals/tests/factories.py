from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile


def make_professional(
    owner_user,
    *,
    display_name="Marine Survey Co",
    slug="marine-survey-co",
    status=ProfessionalProfileStatus.ACTIVE,
    service_area=None,
    **extra,
):
    return ProfessionalProfile.objects.create(
        owner_user=owner_user,
        display_name=display_name,
        slug=slug,
        status=status,
        public_email=extra.pop("public_email", "hello@marine-survey.example"),
        public_phone=extra.pop("public_phone", "+39055000000"),
        country_code=extra.pop("country_code", "IT"),
        service_area=["IT-52"] if service_area is None else service_area,
        **extra,
    )
