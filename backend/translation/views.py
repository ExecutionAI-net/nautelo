from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .models import TranslationSettings
from .services import LANGUAGES, TranslationFailed, TranslationUnavailable, translate_listing_text

CODES = list(LANGUAGES)


class TranslateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, allow_blank=True, default="")
    description = serializers.CharField(max_length=4000, allow_blank=True, default="")
    source = serializers.ChoiceField(choices=CODES)
    targets = serializers.ListField(child=serializers.ChoiceField(choices=CODES), min_length=1, max_length=2)

    def validate(self, attrs):
        if not (attrs["title"].strip() or attrs["description"].strip()):
            raise serializers.ValidationError("Provide a title or a description to translate.")
        attrs["targets"] = [code for code in dict.fromkeys(attrs["targets"]) if code != attrs["source"]]
        if not attrs["targets"]:
            raise serializers.ValidationError("Choose at least one target language other than the source.")
        return attrs


class TranslateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsEmailVerified]
    throttle_scope = "translation"

    def post(self, request):
        payload = TranslateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        try:
            translations = translate_listing_text(
                title=data["title"], description=data["description"], source=data["source"], targets=data["targets"]
            )
        except TranslationUnavailable:
            return Response({"error": {"code": "translation_unavailable", "message": "Translation is not available right now."}}, status=503)
        except TranslationFailed:
            return Response({"error": {"code": "translation_failed", "message": "The translation could not be produced. Try again."}}, status=502)
        return Response({"translations": translations})


class TranslateStatusView(APIView):
    """Lets the form hide the button when translation is off."""

    permission_classes = [IsAuthenticated, IsActiveUser]
    throttle_scope = "translation_status"

    def get(self, request):
        config = TranslationSettings.load()
        return Response({"enabled": bool(config.enabled and config.model_id)})
