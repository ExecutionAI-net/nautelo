"""Look up a staff-authored template, substitute its variables, and wrap it
in the shared layout. Returns None on a total miss (no row for this key in
either the requested locale or the English fallback) so a caller can fall
back to its own hardcoded copy - the old behavior - rather than crash a
Celery task over a template nobody has migrated/seeded yet in some
environment.
"""

from django.conf import settings
from django.template import Context, Template

from .layout import wrap_in_layout
from .models import EmailTemplate

#: Stand-in values the staff editor's preview/test-send uses for a template's
#: declared variables (models.TEMPLATE_KEYS) - realistic enough to judge the
#: design without a real user/token in hand. An undeclared variable falls
#: back to a bracketed placeholder so a typo in the HTML is visible, not silent.
SAMPLE_VALUES = {
    "name": "Alex Morgan",
    "url": f"{settings.PUBLIC_BASE_URL}/example-link",
    "org": "Blue Marine Brokers",
}


def sample_context(variables) -> dict:
    return {var: SAMPLE_VALUES.get(var, f"[{var}]") for var in variables}


def render_preview(subject_template: str, html_template: str, context: dict) -> tuple[str, str]:
    rendered_context = Context(context)
    subject = Template(subject_template).render(rendered_context)
    body = Template(html_template).render(rendered_context)
    return subject, wrap_in_layout(body)


def render_email(key: str, locale: str, context: dict) -> tuple[str, str] | None:
    row = (
        EmailTemplate.objects.filter(key=key, locale=locale).first()
        or EmailTemplate.objects.filter(key=key, locale="EN").first()
    )
    if row is None:
        return None
    return render_preview(row.subject, row.html_body, context)
