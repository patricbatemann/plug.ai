from fastapi.testclient import TestClient


def test_register_login_and_current_user(client: TestClient) -> None:
    registered = client.post(
        "/api/auth/register",
        json={"email": "starter@example.com", "password": "safe-password"},
    )
    assert registered.status_code == 201
    assert registered.json()["user"]["email"] == "starter@example.com"
    assert "hashed_password" not in registered.json()["user"]

    duplicate = client.post(
        "/api/auth/register",
        json={"email": "starter@example.com", "password": "safe-password"},
    )
    assert duplicate.status_code == 409

    login = client.post(
        "/api/auth/login",
        json={"email": "STARTER@example.com", "password": "safe-password"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "starter@example.com"

    # The same session as an HttpOnly cookie, for the client's same-origin chat and data calls.
    assert "httponly" in login.headers["set-cookie"].lower()
    assert client.get("/api/auth/me").json()["email"] == "starter@example.com"
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401


def test_rejects_invalid_credentials_and_protected_request(client: TestClient) -> None:
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "missing@example.com", "password": "not-a-password"},
    )
    assert bad_login.status_code == 401
    assert client.get("/api/auth/me").status_code == 401
