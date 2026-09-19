"""Authenticated notification socket (spec 27.2).

Authentication is the project's own JWT access token, sent as the FIRST message
(`{"type": "auth", "token": "..."}`) rather than in the URL, so a bearer token
never lands in a proxy or access log. Until it arrives the socket is accepted
but subscribed to nothing, and it is closed if no valid token comes within
AUTH_TIMEOUT_SECONDS. A socket is only ever added to the group derived from
its own authenticated user id - there is no client-supplied group name.
"""

import asyncio
import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.authentication import JWTAuthentication

from notifications.push import user_group_name

AUTH_TIMEOUT_SECONDS = 10
CLOSE_UNAUTHORIZED = 4401


@database_sync_to_async
def _user_for_token(raw: str):
    auth = JWTAuthentication()
    try:
        validated = auth.get_validated_token(raw)
        user = auth.get_user(validated)
    except Exception:  # noqa: BLE001 - any failure means unauthenticated
        return None
    return user if user.is_active else None


class NotificationConsumer(AsyncWebsocketConsumer):
    group = None
    _timeout_task = None

    async def connect(self):
        await self.accept()
        self._timeout_task = asyncio.ensure_future(self._expire_unauthenticated())

    async def _expire_unauthenticated(self):
        await asyncio.sleep(AUTH_TIMEOUT_SECONDS)
        if self.group is None:
            await self.close(code=CLOSE_UNAUTHORIZED)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "")
        except ValueError:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        if self.group is not None or data.get("type") != "auth":
            return
        token = data.get("token")
        user = await _user_for_token(token) if isinstance(token, str) else None
        if user is None:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        self.group = user_group_name(user.pk)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.send(text_data=json.dumps({"type": "auth_ok"}))

    async def disconnect(self, code):
        if self._timeout_task is not None:
            self._timeout_task.cancel()
        if self.group is not None:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def notification_message(self, event):
        await self.send(
            text_data=json.dumps({"kind": "notification", **event["payload"]})
        )
