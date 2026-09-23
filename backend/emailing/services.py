"""Look up a staff-authored template, substitute its variables, and wrap it
in the shared layout. Returns None on a total miss (no row for this key in
either the requested locale or the English fallback) so a caller can fall
back to its own hardcoded copy - the old behavior - rather than crash a
Celery task over a template nobody has migrated/seeded yet in some
environment.
"""

from django.template import Context, Template

from .layout import wrap_in_layout
from .models import EmailTemplate


def render_email(key: str, locale: str, context: dict) -> tuple[str, str] | None:
    row = (
        EmailTemplate.objects.filter(key=key, locale=locale).first()
        or EmailTemplate.objects.filter(key=key, locale="EN").first()
    )
    if row is None:
        return None
    rendered_context = Context(context)
    subject = Template(row.subject).render(rendered_context)
    body = Template(row.html_body).render(rendered_context)
    return subject, wrap_in_layout(body)
