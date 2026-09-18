import pytest

from common.text import normalize_comparison_text


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Bénéteau", "beneteau"),
        ("  Ocean   Legal  ", "ocean legal"),
        ("OCEAN LEGAL", "ocean legal"),
        ("Málaga", "malaga"),
        ("", ""),
        (None, ""),
    ],
)
def test_normalize_comparison_text(raw, expected):
    assert normalize_comparison_text(raw) == expected
