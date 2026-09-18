from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

GENERIC_VALIDATION_MESSAGE = "The submitted data is invalid."
GENERIC_ERROR_MESSAGE = "Request failed."
NON_FIELD_ERRORS_KEY = "non_field_errors"
_MAX_UNWRAP_DEPTH = 5


def _as_list(value):
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _field_map(detail):
    """Normalize DRF's three ValidationError detail shapes into {field: [str, ...]}.

    DRF accepts all three of `ValidationError({"email": [...]})`,
    `ValidationError("some message")` and `ValidationError(["a", "b"])`, and all
    three are common inside `validate()` methods. Only the first is keyed by field
    name; the other two are non-field errors and must NOT be silently dropped into
    an empty `fields: {}` - they carry the only explanation the client gets. Map
    them onto `non_field_errors`, matching Django/DRF's own convention.
    """
    if detail is None:
        return {}
    if isinstance(detail, dict):
        return {
            str(key): [str(item) for item in _as_list(value)]
            for key, value in detail.items()
        }
    return {NON_FIELD_ERRORS_KEY: [str(item) for item in _as_list(detail)]}


def _safe_message(detail, fallback):
    """Extract a user-safe string from an exception detail of ANY shape.

    Critical for SimpleJWT: `InvalidToken`/`TokenError` inherit `DetailDictMixin`,
    whose `.detail` is ALWAYS a dict - {"detail": ..., "code": ..., "messages": [...]}
    - even when the exception is raised with a plain string. A bare `str(detail)` on
    that dict emits a raw Python repr such as
    "{'detail': ErrorDetail(string='Given token not valid...', code='token_not_valid'), ...}"
    straight to API clients. That is the app's single most frequent error path (every
    logged-in user hits it roughly every 15 minutes, when the access token expires),
    and a repr is not the "user-safe message" spec 30.2 requires. So unwrap first and
    only ever fall back to `str()` for a scalar.
    """
    for _ in range(_MAX_UNWRAP_DEPTH):
        if isinstance(detail, dict):
            if not detail:
                return fallback
            detail = detail["detail"] if "detail" in detail else next(iter(detail.values()))
        elif isinstance(detail, (list, tuple)):
            if not detail:
                return fallback
            detail = detail[0]
        else:
            break
    if detail is None or isinstance(detail, (dict, list, tuple)):
        return fallback
    return str(detail)


def _safe_code(detail, exc):
    """Prefer an explicit code, wherever the exception chose to put it."""
    if isinstance(detail, dict) and isinstance(detail.get("code"), str):
        return detail["code"]
    return str(getattr(detail, "code", "") or getattr(exc, "default_code", "error"))


def nauta_exception_handler(exc, context):
    """Render every DRF error as spec 30.2's envelope."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    request_id = getattr(request, "request_id", "") or ""

    if isinstance(exc, ValidationError):
        code = "validation_error"
        message = GENERIC_VALIDATION_MESSAGE
        fields = _field_map(exc.detail)
    else:
        detail = getattr(exc, "detail", None)
        code = _safe_code(detail, exc)
        message = _safe_message(detail, GENERIC_ERROR_MESSAGE)
        fields = {}

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "fields": fields,
            "request_id": request_id,
        }
    }

    # Optional, exception-supplied extra context. Spec 20.5 requires a stale
    # edit to return "current version metadata", for which 30.2's envelope has
    # no other slot. Only exceptions that explicitly define a non-empty dict
    # `meta` contribute one, so the key is absent otherwise and no client is
    # tempted to branch on a permanently-null field.
    meta = getattr(exc, "meta", None)
    if isinstance(meta, dict) and meta:
        response.data["error"]["meta"] = meta

    response["X-Request-ID"] = request_id
    return response
