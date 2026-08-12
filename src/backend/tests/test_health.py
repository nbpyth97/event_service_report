async def test_health(client):
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_health_live(client):
    res = await client.get("/api/health/live")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_health_ready(client):
    res = await client.get("/api/health/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
