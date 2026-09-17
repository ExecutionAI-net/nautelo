from django.urls import re_path

from common.consumers import EchoConsumer

websocket_urlpatterns = [
    re_path(r"ws/health/$", EchoConsumer.as_asgi()),
]
