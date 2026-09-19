from rest_framework import serializers


class NotificationSerializer(serializers.Serializer):
    """Spec 11.10's row. The wire name of `notification_type` is `type`."""

    id = serializers.UUIDField(read_only=True)
    type = serializers.CharField(source="notification_type", read_only=True)
    title_key = serializers.CharField(read_only=True)
    body_key = serializers.CharField(read_only=True)
    payload = serializers.JSONField(read_only=True)
    target_url = serializers.CharField(read_only=True)
    read_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
