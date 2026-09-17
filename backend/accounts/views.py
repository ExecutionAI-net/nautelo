from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import (
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
