import pytest
from channels.testing import WebsocketCommunicator

from config.asgi import application


@pytest.mark.asyncio
async def test_echo_consumer_echoes_message():
    communicator = WebsocketCommunicator(application, "/ws/health/")
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"ping": "pong"})
    response = await communicator.receive_json_from()

    assert response == {"echo": {"ping": "pong"}}
    await communicator.disconnect()
