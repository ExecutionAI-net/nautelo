"""Spec §16's two mask shapes, plus the length-non-disclosure rules this phase
adds on top of them (see the two mask rulings in the plan)."""

import pytest

from messaging import masking
from messaging.masking import MASK_CHARACTER, mask_email, mask_phone

FIXED_PHONE_WIDTH = len("+34 ••• ••• ••2")
ALL_MASKED_PHONE = "+•• ••• ••• •••"
ALL_MASKED_EMAIL = "•••••"


def test_spec_16_email_example_is_reproduced_exactly():
    assert mask_email("info@example.com") == "i••••@example.com"


def test_email_mask_width_does_not_depend_on_the_local_part_length():
    """A length-preserving mask would leak the local part's length to anyone
    enumerating a known address list. Both masks must be the same width."""
    short = mask_email("info@example.com")
    long = mask_email("verylongaddressindeed@example.com")

    assert len(short.split("@")[0]) == len(long.split("@")[0])


def test_a_one_character_local_part_keeps_nothing():
    """Keeping "the first character" of a one-character local part would
    reveal the entire local part."""
    assert mask_email("a@example.com") == "•••••@example.com"


def test_a_two_character_local_part_keeps_only_its_first_character():
    assert mask_email("ab@example.com") == "a••••@example.com"


def test_the_domain_is_preserved_because_spec_16s_own_example_preserves_it():
    assert mask_email("office@blue-marine.example") == "o••••@blue-marine.example"


def test_a_value_that_is_not_an_address_is_masked_entirely():
    assert mask_email("not-an-email") == "•••••"
    assert mask_email("") == "•••••"
    assert mask_email(None) == "•••••"


def test_spec_16_phone_example_shape_is_reproduced():
    assert mask_phone("+34900111222") == "+34 ••• ••• ••2"


def test_only_the_country_code_and_the_final_digit_survive():
    masked = mask_phone("+39055123456")

    assert [character for character in masked if character.isdigit()] == ["3", "9", "6"]


def test_separators_in_the_stored_number_do_not_change_the_mask():
    assert mask_phone("+34 900 111 222") == mask_phone("+34900111222")
    assert mask_phone("(+34) 900-111-222") == mask_phone("+34900111222")


def test_phone_mask_width_does_not_depend_on_the_number_length():
    """The mask is fixed width. A mask whose width tracked the real number
    would leak its length to anyone comparing two profiles."""
    nine_national_digits = mask_phone("+34900111222")
    twelve_national_digits = mask_phone("+390551234567890")

    assert len(nine_national_digits) == len(twelve_national_digits)
    assert nine_national_digits.count(MASK_CHARACTER) == twelve_national_digits.count(
        MASK_CHARACTER
    )


def test_a_short_number_masks_the_country_code_too_and_keeps_the_same_width():
    """With a short or malformed number, "+CC plus the last digit" is too large
    a fraction of the secret — and a narrower mask would itself announce "this
    one is short"."""
    assert mask_phone("+3412") == "+•• ••• ••• •••"
    assert mask_phone("") == "+•• ••• ••• •••"
    assert mask_phone(None) == "+•• ••• ••• •••"
    assert len(mask_phone("+3412")) == len(mask_phone("+34900111222"))


def test_the_mask_character_is_the_bullet_spec_16_uses():
    assert MASK_CHARACTER == "•"
    assert "*" not in mask_email("info@example.com")
    assert "*" not in mask_phone("+34900111222")


# --- Disclosure budget, pinned with literals so a constant drifting by one fails.


def test_the_disclosure_budget_constants_are_pinned():
    assert masking.EMAIL_MASK_WIDTH == 5
    assert masking.PHONE_COUNTRY_CODE_DIGITS == 2
    assert masking.PHONE_TRAILING_DIGITS == 1
    assert masking.PHONE_MASKED_DIGITS == 9
    assert masking.PHONE_MINIMUM_DIGITS == 6
    assert masking.PHONE_GROUP_SIZE == 3


def test_phone_minimum_digits_boundary_is_exact():
    """Five digits are masked entirely; six are the first that disclose."""
    assert mask_phone("+34123") == ALL_MASKED_PHONE  # 5 digits
    assert mask_phone("+341234") == "+34 ••• ••• ••4"  # 6 digits
    assert mask_phone("+3412345") == "+34 ••• ••• ••5"  # 7 digits


def test_phone_groups_are_three_by_three_with_single_spaces():
    masked = mask_phone("+34900111222")

    assert masked.split(" ") == ["+34", "•••", "•••", "••2"]


def test_phone_country_code_keeps_exactly_two_digits():
    assert mask_phone("+123456789012") == "+12 ••• ••• ••2"


def test_phone_trailing_disclosure_is_exactly_one_digit():
    masked = mask_phone("+34900111987")

    assert masked == "+34 ••• ••• ••7"
    assert "8" not in masked and "9" not in masked


def test_the_masked_email_local_part_is_exactly_the_configured_width():
    assert len(mask_email("info@example.com").split("@")[0]) == 5
    assert len(mask_email("a@example.com").split("@")[0]) == 5


# --- Hostile and edge inputs.

HOSTILE_EMAILS = [
    None,
    "",
    " ",
    "   \t\n",
    "@",
    "@example.com",
    "info@",
    "info",
    "a@b@c.example",
    "@@",
    "  info@example.com",
    "\tinfo@example.com",
    " @example.com",
    "üñíçødé@example.com",
    "日本語@example.jp",
    "😀secret@example.com",
    "x" * 10_000 + "@example.com",
    "x" * 10_000,
    "a@" + "d" * 10_000,
]


@pytest.mark.parametrize("value", HOSTILE_EMAILS, ids=lambda v: repr(v)[:30])
def test_email_mask_never_exceeds_the_disclosure_budget(value):
    masked = mask_email(value)
    local = masked.partition("@")[0]

    assert len(local) == 5
    # At most one source character before the "@".
    assert sum(1 for character in local if character != MASK_CHARACTER) <= 1
    assert not any(character.isspace() for character in local)


def test_email_without_a_usable_domain_reveals_nothing():
    for value in (None, "", " ", "@", "info@", "info", "x" * 10_000, "   secret   "):
        assert mask_email(value) == ALL_MASKED_EMAIL


def test_whitespace_is_never_disclosed_as_the_kept_character():
    assert mask_email(" @example.com") == "•••••@example.com"
    assert mask_email("  info@example.com") == "i••••@example.com"


def test_surrounding_whitespace_never_changes_or_widens_the_mask():
    assert mask_email("info@example.com  ") == "i••••@example.com"
    assert mask_email("info@   ") == ALL_MASKED_EMAIL
    assert mask_email("a @example.com") == "•••••@example.com"
    assert mask_email("ab @example.com") == "a••••@example.com"


def test_a_leading_at_sign_has_an_empty_local_part_and_keeps_nothing():
    assert mask_email("@example.com") == "•••••@example.com"


def test_multiple_at_signs_split_on_the_first_and_disclose_one_character():
    assert mask_email("a@b@c.example") == "•••••@b@c.example"
    assert mask_email("ab@c@d.example") == "a••••@c@d.example"


def test_unicode_local_parts_disclose_at_most_one_character():
    assert mask_email("üñíçødé@example.com") == "ü••••@example.com"
    assert mask_email("日本語@example.jp") == "日••••@example.jp"
    assert mask_email("😀secret@example.com") == "😀••••@example.com"


def test_a_ten_thousand_character_local_part_masks_to_the_fixed_width():
    assert mask_email("x" * 10_000 + "@example.com") == "x••••@example.com"


HOSTILE_PHONES = [
    None,
    "",
    " ",
    "+",
    "abc",
    "+34 ABC DEF GHI",
    "1-800-FLOWERS",
    "+34900111222 ext. 55",
    "+34900111222;ext=987654",
    "0034900111222",
    "900111222",
    "12345",
    "+34\t900\n111\n222",
    "+٣٤٩٠٠١١١٢٢٢",
    "+34²²²²²²²²²",
    "+" + "9" * 10_000,
    "9" * 10_000,
    "+34" + " " * 10_000 + "900111222",
]


@pytest.mark.parametrize("value", HOSTILE_PHONES, ids=lambda v: repr(v)[:30])
def test_phone_mask_is_always_fixed_width_and_discloses_at_most_three_digits(value):
    masked = mask_phone(value)

    assert len(masked) == FIXED_PHONE_WIDTH
    assert masked[0] == "+"
    assert masked[3] == " " and masked[7] == " " and masked[11] == " "
    assert sum(1 for character in masked if character.isdigit()) <= 3
    assert sum(1 for character in masked if character.isalpha()) == 0


def test_letters_do_not_count_as_digits_or_survive():
    assert mask_phone("+34 ABC DEF GHI") == ALL_MASKED_PHONE
    assert mask_phone("1-800-FLOWERS") == ALL_MASKED_PHONE


def test_non_ascii_digits_are_not_disclosed():
    assert mask_phone("+٣٤٩٠٠١١١٢٢٢") == ALL_MASKED_PHONE
    assert mask_phone("+34²²²²²²²²²") == ALL_MASKED_PHONE


def test_an_extension_adds_no_more_disclosure_than_the_budget():
    assert mask_phone("+34900111222 ext. 55") == "+34 ••• ••• ••5"


def test_a_very_long_number_masks_to_the_same_fixed_shape():
    assert mask_phone("+" + "9" * 10_000) == "+99 ••• ••• ••9"


@pytest.mark.parametrize(
    "value",
    ["+34900111222", "+390551234567890", "+12025550123", "+441632960961"],
)
def test_no_masked_phone_character_comes_from_the_hidden_middle(value):
    digits = "".join(c for c in value if c.isdigit())
    masked = mask_phone(value)
    disclosed = [c for c in masked if c.isdigit()]

    assert disclosed == list(digits[:2]) + [digits[-1]]


@pytest.mark.parametrize(
    "value",
    ["info@example.com", "verylongaddressindeed@example.com", "üñíçødé@example.com"],
)
def test_no_masked_email_local_character_beyond_the_first_is_disclosed(value):
    local = value.partition("@")[0]
    masked_local = mask_email(value).partition("@")[0]

    disclosed = [c for c in masked_local if c != MASK_CHARACTER]
    assert disclosed == [local[0]]
    assert masked_local[1:] == MASK_CHARACTER * 4


def test_the_mask_character_is_the_only_filler_used():
    assert set(mask_email("info@example.com").partition("@")[0]) == {"i", MASK_CHARACTER}
    assert set(mask_phone("+34900111222")) <= set("+34 2") | {MASK_CHARACTER}
    assert set(mask_phone("")) == {"+", " ", MASK_CHARACTER}
