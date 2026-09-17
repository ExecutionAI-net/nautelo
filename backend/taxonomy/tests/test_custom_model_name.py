import unicodedata

import pytest
from django.core.exceptions import ValidationError

from taxonomy.services import normalize_custom_model_name


def test_collapses_internal_whitespace_and_trims_ends():
    assert (
        normalize_custom_model_name("  McKenzie   40   Flybridge  ")
        == "McKenzie 40 Flybridge"
    )


def test_unicode_normalizes_to_nfc():
    decomposed = unicodedata.normalize("NFD", "Catamarán")
    assert normalize_custom_model_name(decomposed) == unicodedata.normalize(
        "NFC", "Catamarán"
    )


def test_rejects_a_punctuation_only_value():
    with pytest.raises(ValidationError):
        normalize_custom_model_name("---")


def test_rejects_a_whitespace_only_value():
    with pytest.raises(ValidationError):
        normalize_custom_model_name("   ")


def test_accepts_a_value_with_at_least_one_alphanumeric_character():
    assert normalize_custom_model_name("40-XR") == "40-XR"
