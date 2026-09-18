import unicodedata


def normalize_comparison_text(value) -> str:
    """Casefolded, accent-stripped, whitespace-collapsed key for comparing
    human-entered names and addresses.

    Used by the legacy directory import to decide whether two records describe
    the same organization. taxonomy.services.normalize_taxonomy_name does the
    same job for boat brands; collapsing that duplicate into this function is
    queued for a cleanup pass, not done here (this plan does not modify
    already-merged apps, and importing the taxonomy copy would give
    services_catalog a dependency on the boat-brand app for a string utility).
    """
    if not value:
        return ""
    collapsed = " ".join(str(value).split())
    decomposed = unicodedata.normalize("NFKD", collapsed)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return without_accents.casefold()
