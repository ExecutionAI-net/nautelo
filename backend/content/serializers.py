from rest_framework import serializers

from .models import Advertisement, GuideArticle


class PublicGuideListSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuideArticle
        fields = ["slug", "title", "excerpt", "category", "hero_image_url", "author_name", "published_at"]


class PublicGuideDetailSerializer(PublicGuideListSerializer):
    class Meta(PublicGuideListSerializer.Meta):
        fields = PublicGuideListSerializer.Meta.fields + ["body"]


class StaffGuideSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuideArticle
        fields = [
            "id", "slug", "title", "excerpt", "body", "category", "hero_image_url",
            "author_name", "status", "published_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "published_at", "created_at", "updated_at"]


class PublicAdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Advertisement
        fields = ["id", "placement", "sponsor", "headline", "body", "cta_label", "cta_url", "image_url"]


class StaffAdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Advertisement
        fields = [
            "id", "placement", "sponsor", "headline", "body", "cta_label", "cta_url",
            "image_url", "is_active", "starts_at", "ends_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        starts, ends = attrs.get("starts_at"), attrs.get("ends_at")
        if starts and ends and ends <= starts:
            raise serializers.ValidationError({"ends_at": "The end must be after the start."})
        return attrs
