from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from accounts.models import User
from accounts.selectors import build_session_payload
from accounts.serializers import (
    EmailTokenObtainPairSerializer,
    RegistrationSerializer,
    ResendVerificationSerializer,
    UserSummarySerializer,
    VerifyEmailSerializer,
)
from accounts.services import (
    consume_email_verification_token,
    queue_email_verification,
    register_user,
)


def body_refresh_token(request):
    """Read the `refresh` credential off a request body of any shape.

    Never `dict(request.data)`: for a form-encoded body request.data is an
    immutable QueryDict whose dict() copy wraps EVERY value in a list, so a
    valid token would reach the serializer as ["<jwt>"] and be rejected with
    400 "Not a valid string.". Both QueryDict.get() and dict.get() hand back the
    scalar, so JSON and form encodings behave identically.

    A JSON body is also not required to be an object: `[1, 2]` parses to a list,
    which has no .get() and would raise an uncaught AttributeError - a bare 500
    with none of spec 30.2's envelope. A non-mapping body carries no refresh
    token, so it is treated as absent rather than allowed to crash.

    A value that IS present but is not a string (e.g. `{"refresh": ["a", "b"]}`)
    is returned unchanged, so DRF's own field validation rejects it as a 400
    validation_error instead of this helper silently swallowing it.
    """
    data = request.data
    if not hasattr(data, "get"):
        return ""
    return data.get("refresh") or ""


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Every argument is named explicitly rather than splatted with
        # `register_user(**data)`. UserManager.create_user() forwards **extra_fields
        # straight onto the model by design, so the ONLY thing standing between a
        # request body and `is_staff=True` is what reaches it here. Naming the five
        # fields keeps that guarantee even if someone later adds a field to
        # RegistrationSerializer without re-reading create_user() (spec 2.2).
        user = register_user(
            email=data["email"],
            password=data["password"],
            full_name=data["full_name"],
            locale=data["locale"],
            primary_role=data["primary_role"],
        )
        return Response(UserSummarySerializer(user).data, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = consume_email_verification_token(serializer.validated_data["token"])
        return Response(UserSummarySerializer(user).data, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email=serializer.validated_data["email"].strip().lower(),
            is_active=True,
            email_verified_at__isnull=True,
        ).first()
        if user is not None:
            queue_email_verification(user)
        # Always 202: the response must not reveal whether the address is registered.
        return Response(status=status.HTTP_202_ACCEPTED)


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop("refresh", None)
        if refresh:
            set_refresh_cookie(response, refresh)
        return response


class RefreshView(TokenRefreshView):
    authentication_classes = []
    permission_classes = [AllowAny]
    # Deliberately NOT the "auth" scope: silent refresh runs on every page load.
    throttle_scope = "auth-refresh"

    def post(self, request, *args, **kwargs):
        # `refresh` is the only field the serializer reads, so hand it that one
        # value rather than a copy of the whole body - see body_refresh_token().
        raw = body_refresh_token(request) or request.COOKIES.get(REFRESH_COOKIE_NAME) or ""
        if not raw:
            # Do NOT hand the serializer an empty string: `refresh` is required
            # and non-blank, so that would surface as a 400 validation_error
            # instead of the 401 token_not_valid a missing credential must be.
            raise InvalidToken("No refresh token was provided.")
        serializer = self.get_serializer(data={"refresh": raw})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        payload = dict(serializer.validated_data)
        rotated = payload.pop("refresh", None)
        response = Response(payload, status=status.HTTP_200_OK)
        if rotated:
            set_refresh_cookie(response, rotated)
        return response


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        raw = body_refresh_token(request) or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # An already-invalid token means the session is already gone.
        return clear_refresh_cookie(Response(status=status.HTTP_204_NO_CONTENT))


class SessionView(APIView):
    """user, role, permissions, locale (spec 30.1). Answers guests with 200."""

    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        return Response(build_session_payload(user), status=status.HTTP_200_OK)
