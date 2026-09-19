from django.urls import re_path

from common.consumers import EchoConsumer
from notifications.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r"ws/health/$", EchoConsumer.as_asgi()),
    re_path(r"ws/notifications/$", NotificationConsumer.as_asgi()),
]
