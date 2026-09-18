"""Optimistic locking for listing edits (spec §20.5).

"All edit submissions include listing/revision version. Stale updates return
409 conflict with current version metadata. Do not silently overwrite another
browser/session edit."
"""

from django.db.models import F
from rest_framework import status
from rest_framework.exceptions import APIException


class StaleVersionConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing was changed somewhere else. Reload it and try again."
    default_code = "stale_version"

    def __init__(self, *, resource: str, current_version: int | None):
        super().__init__()
        # Copied into the error envelope by common.exceptions.nauta_exception_handler.
        self.meta = {"resource": resource, "current_version": current_version}


def bump_version(instance, *, expected_version: int, resource: str, **updates) -> None:
    """Apply `updates` to `instance` only if its stored version still matches.

    One atomic `UPDATE … WHERE pk = … AND version = …` statement, so two
    concurrent writers can never both succeed. Callers that must *read* related
    rows before deciding should additionally hold `select_for_update()` on this
    row, so the loser blocks rather than races.
    """
    model = type(instance)
    changed = model.objects.filter(pk=instance.pk, version=expected_version).update(
        version=F("version") + 1, **updates
    )
    if changed == 0:
        current = (
            model.objects.filter(pk=instance.pk)
            .values_list("version", flat=True)
            .first()
        )
        raise StaleVersionConflict(resource=resource, current_version=current)
    instance.refresh_from_db()
