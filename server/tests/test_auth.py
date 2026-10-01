from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.user import User  # noqa: F401

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


def setup_function() -> None:
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)


def test_register_login_and_current_user() -> None:
    client = TestClient(app)
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


def test_rejects_invalid_credentials_and_protected_request() -> None:
    client = TestClient(app)
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "missing@example.com", "password": "not-a-password"},
    )
    assert bad_login.status_code == 401
    assert client.get("/api/auth/me").status_code == 401
