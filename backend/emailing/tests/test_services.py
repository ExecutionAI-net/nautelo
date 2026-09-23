import pytest

from emailing.models import EmailTemplate
from emailing.services import render_email

pytestmark = pytest.mark.django_db


def test_render_email_returns_none_when_no_row_exists_for_the_key():
    assert render_email("does_not_exist", "EN", {}) is None


def test_render_email_substitutes_variables_into_subject_and_body():
    EmailTemplate.objects.create(
        key="p_test_template", locale="EN",
        subject="Reset for {{ name }}", html_body="<p>Hi {{ name }}, go to {{ url }}</p>",
    )

    subject, html = render_email("p_test_template", "EN", {"name": "Alex", "url": "https://nautelo.com/reset"})

    assert subject == "Reset for Alex"
    assert "Hi Alex" in html
    assert "https://nautelo.com/reset" in html


def test_render_email_falls_back_to_english_when_the_locale_is_missing():
    EmailTemplate.objects.create(key="p_test_template", locale="EN", subject="EN subject", html_body="<p>EN body</p>")

    subject, html = render_email("p_test_template", "IT", {})

    assert subject == "EN subject"
    assert "EN body" in html


def test_render_email_prefers_the_exact_locale_over_the_english_fallback():
    EmailTemplate.objects.create(key="p_test_template", locale="EN", subject="EN subject", html_body="<p>EN</p>")
    EmailTemplate.objects.create(key="p_test_template", locale="IT", subject="IT subject", html_body="<p>IT</p>")

    subject, html = render_email("p_test_template", "IT", {})

    assert subject == "IT subject"
    assert "IT" in html and "EN" not in html


def test_render_email_wraps_the_body_in_the_shared_layout():
    EmailTemplate.objects.create(key="p_test_template", locale="EN", subject="s", html_body="<p>unique-marker</p>")

    _, html = render_email("p_test_template", "EN", {})

    assert "unique-marker" in html
    assert "Nautelo" in html
    assert "support@nautelo.com" in html


def test_render_email_escapes_html_in_a_variable_value():
    EmailTemplate.objects.create(key="p_test_template", locale="EN", subject="s", html_body="<p>{{ name }}</p>")

    _, html = render_email("p_test_template", "EN", {"name": "<script>alert(1)</script>"})

    assert "<script>" not in html
