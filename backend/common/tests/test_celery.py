from common.tasks import ping


def test_ping_task_returns_pong():
    result = ping.delay()
    assert result.get(timeout=5) == "pong"
