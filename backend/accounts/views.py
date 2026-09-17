from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from accounts.models import User
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
        data = dict(request.data)
        if not data.get("refresh"):
            raw = request.COOKIES.get(REFRESH_COOKIE_NAME) or ""
            if not raw:
                # Do NOT hand the serializer an empty string: `refresh` is required
                # and non-blank, so that would surface as a 400 validation_error
                # instead of the 401 token_not_valid a missing credential must be.
                raise InvalidToken("No refresh token was provided.")
            data["refresh"] = raw
        serializer = self.get_serializer(data=data)
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
        raw = request.data.get("refresh") or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # An already-invalid token means the session is already gone.
        return clear_refresh_cookie(Response(status=status.HTTP_204_NO_CONTENT))
