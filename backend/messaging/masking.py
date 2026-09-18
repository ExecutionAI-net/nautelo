"""Mask helpers for spec §16's LOCKED contact payload.

Pure functions: no Django import, no database, no I/O — so every masking rule
is exhaustively testable without fixtures, and the module can never grow a
query. The two rules implemented here are rulings recorded in this phase's
plan, derived from spec §16's two example strings:

* the email mask is FIXED WIDTH (it does not preserve the local part's length);
* the phone mask keeps only "+CC" and the final digit.
"""

#: U+2022 BULLET — the character spec §16's own examples use. Never "*" or ".".
MASK_CHARACTER = "•"

#: Total width of the masked local part. `info` and a 40-character local part
#: therefore produce masks of identical width.
EMAIL_MASK_WIDTH = 5

#: Digits kept as the country calling code, behind a literal "+". Exact for the
#: two launch markets (ES +34, IT +39); for a longer calling code the split is
#: cosmetic and still reveals no more than two leading digits.
PHONE_COUNTRY_CODE_DIGITS = 2
#: Trailing digits kept, exactly as spec §16's "+34 ••• ••• ••7" keeps one.
PHONE_TRAILING_DIGITS = 1
#: FIXED number of mask positions after the country code, whatever the real
#: number's length — spec §16's example shows nine, in three groups of three.
#: Deriving this from len(digits) would make the mask's width the number's
#: length, which is the disclosure this mask exists to prevent.
PHONE_MASKED_DIGITS = 9
#: Below this many digits, the country code is masked as well.
PHONE_MINIMUM_DIGITS = 6
#: Spec §16's example groups the masked positions in threes.
PHONE_GROUP_SIZE = 3

_ASCII_DIGITS = frozenset("0123456789")


def mask_email(value: str | None) -> str:
    """"info@example.com" -> "i••••@example.com" (spec §16)."""
    local, _, domain = (value or "").strip().partition("@")
    local = local.strip()
    if not domain:
        return MASK_CHARACTER * EMAIL_MASK_WIDTH
    kept = local[:1] if len(local) > 1 else ""
    return f"{kept}{MASK_CHARACTER * (EMAIL_MASK_WIDTH - len(kept))}@{domain}"


def mask_phone(value: str | None) -> str:
    """"+34900111222" -> "+34 ••• ••• ••2" (spec §16's shape), at a FIXED width.

    The output is always "+" + 2 characters + " " + three groups of three, so
    two numbers of different lengths are indistinguishable by their masks.
    Only ASCII digits count: other Unicode "digits" are never disclosed.
    """
    digits = "".join(character for character in (value or "") if character in _ASCII_DIGITS)
    if len(digits) < PHONE_MINIMUM_DIGITS:
        # Even the country code is masked: a narrower or differently shaped
        # mask here would announce "this number is short or malformed".
        country = MASK_CHARACTER * PHONE_COUNTRY_CODE_DIGITS
        masked = MASK_CHARACTER * PHONE_MASKED_DIGITS
    else:
        country = digits[:PHONE_COUNTRY_CODE_DIGITS]
        masked = (
            MASK_CHARACTER * (PHONE_MASKED_DIGITS - PHONE_TRAILING_DIGITS)
            + digits[-PHONE_TRAILING_DIGITS:]
        )

    groups = [
        masked[index : index + PHONE_GROUP_SIZE]
        for index in range(0, PHONE_MASKED_DIGITS, PHONE_GROUP_SIZE)
    ]
    return f"+{country} {' '.join(groups)}"
