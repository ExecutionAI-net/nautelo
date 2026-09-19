from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

GENERIC_VALIDATION_MESSAGE = "The submitted data is invalid."
GENERIC_ERROR_MESSAGE = "Request failed."
NON_FIELD_ERRORS_KEY = "non_field_errors"
_MAX_UNWRAP_DEPTH = 5


def _as_list(value):
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _field_error(item):
    """Render one field error as `{"message": str, "code": str}`.

    DRF's `ErrorDetail` is a `str` subclass carrying a `.code` (e.g.
    `"required"`, `"invalid_verification_token"`). A bare `str(item)` - the
    previous behavior - returns a plain string and silently discards `.code`,
    breaking spec 30.2's promise of "a stable machine code" for every
    field-level error. `.code` defaults to `"invalid"` for items that never had
    an explicit one (e.g. `ValidationError({"email": ["some message"]})`),
    matching DRF's own default for untyped errors.
    """
    return {"message": str(item), "code": str(getattr(item, "code", "") or "invalid")}


def _field_map(detail):
    """Normalize DRF's three ValidationError detail shapes into
    `{field: [{"message": str, "code": str}, ...]}`.

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
            str(key): [_field_error(item) for item in _as_list(value)]
            for key, value in detail.items()
        }
    return {NON_FIELD_ERRORS_KEY: [_field_error(item) for item in _as_list(detail)]}


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


def _normalized(exc):
    """Rebind Django-core exceptions onto their DRF equivalents.

    DRF's own `exception_handler` performs exactly this rebinding, but only onto
    its *local* name - the caller's exception object is untouched. So by the time
    this handler inspects `.detail`/`.default_code`, a `get_object_or_404` miss is
    still a raw `django.http.Http404`: a bare `class Http404(Exception): pass`
    with none of those attributes. Every 404 therefore rendered as the generic
    `code: "error"` / "Request failed." envelope, and the frontend
    (`lib/api/client.ts`) branches on `error.code`, so it could not tell "not
    found" apart from any other failure. Normalizing here - before both DRF's
    handler and the envelope-building below - fixes it once for every view.

    The replacements are built WITHOUT `exc.args`, which is the one place this
    deliberately differs from DRF: `get_object_or_404` composes its message from
    the model class ("No BrokerOrganization matches the given query."), and an
    internal model name has no business in a public API response.
    """
    if isinstance(exc, Http404):
        return NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return PermissionDenied()
    return exc


def nauta_exception_handler(exc, context):
    """Render every DRF error as spec 30.2's envelope."""
    exc = _normalized(exc)
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

    # Optional, exception-supplied next step. Spec 30.2's worked example for
    # `listing_entitlement_required` carries
    # {"type": "PURCHASE", "product_code": "INDIVIDUAL_LISTING_RIGHT"} at the
    # error level, and the envelope had no slot for it. Same contract as `meta`
    # above: only an exception that defines a non-empty dict `action`
    # contributes one, so the key is absent otherwise.
    action = getattr(exc, "action", None)
    if isinstance(action, dict) and action:
        response.data["error"]["action"] = action

    response["X-Request-ID"] = request_id
    return response
