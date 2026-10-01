def test_manual_lead_can_be_created(client):
    response = client.post(
        "/api/leads",
        json={"name": "Анна", "contact": "@anna", "request": "Нужен лендинг", "source": "manual"},
    )
    assert response.status_code == 201
    lead = response.json()
    assert lead["name"] == "Анна"
    assert lead["source"] == "manual"
    assert lead["tags"] == []


def test_telegram_lead_is_visible_in_crm(client):
    response = client.post(
        "/api/leads",
        json={
            "name": "Иван",
            "contact": "+79990000000",
            "request": "Нужно настроить рекламу",
            "source": "telegram_bot",
            "external_id": "telegram:42:100",
            "telegram_user_id": "42",
            "telegram_username": "ivan",
        },
    )
    assert response.status_code == 201

    leads = client.get("/api/leads?source=telegram_bot").json()
    assert len(leads) == 1
    assert leads[0]["contact"] == "+79990000000"


def test_external_id_is_idempotent(client):
    payload = {
        "name": "Иван",
        "contact": "@ivan",
        "request": "Первичная заявка",
        "source": "telegram_bot",
        "external_id": "telegram:42:100",
    }
    first = client.post("/api/leads", json=payload).json()
    second = client.post("/api/leads", json=payload).json()
    assert first["id"] == second["id"]
    assert len(client.get("/api/leads").json()) == 1


def test_tags_can_be_assigned_and_filtered(client):
    lead = client.post(
        "/api/leads",
        json={"name": "Мария", "contact": "maria@example.com", "request": "Нужен SMM", "source": "manual"},
    ).json()

    tagged = client.put(f"/api/leads/{lead['id']}/tags", json={"tags": ["hot", "SMM"]})
    assert tagged.status_code == 200
    assert {tag["name"] for tag in tagged.json()["tags"]} == {"hot", "SMM"}

    filtered = client.get("/api/leads", params={"tag": "hot"}).json()
    assert [item["id"] for item in filtered] == [lead["id"]]


def test_metrics_split_sources(client):
    client.post(
        "/api/leads",
        json={"name": "Анна", "contact": "@anna", "request": "Запрос вручную", "source": "manual"},
    )
    client.post(
        "/api/leads",
        json={"name": "Иван", "contact": "@ivan", "request": "Запрос из Telegram", "source": "telegram_bot"},
    )
    metrics = client.get("/api/metrics").json()
    assert metrics == {"total": 2, "new": 2, "telegram": 1, "manual": 1}
