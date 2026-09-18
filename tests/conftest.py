import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from db_support import validate_test_database_url
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@pytest.fixture(scope="session")
def test_url():
    return validate_test_database_url(
        os.environ["TEST_DATABASE_URL"], os.environ["DATABASE_URL"]
    )


@pytest.fixture(scope="session")
def migration_config(test_url):
    config = Config(str(Path(__file__).resolve().parents[1] / "apps/api/alembic.ini"))
    config.attributes["database_url"] = test_url
    return config


@pytest.fixture(scope="session")
def db_engine(test_url, migration_config):
    command.upgrade(migration_config, "head")
    engine = create_engine(test_url, connect_args={"options": "-c timezone=UTC"})
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    from smart_home.db import Base

    with Session(db_engine, expire_on_commit=False) as session:
        yield session
        session.rollback()
    with db_engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(delete(table))


@pytest.fixture
def tenants(db_session):
    from smart_home.models import Merchant, User

    users = []
    for name in ("A", "B"):
        merchant = Merchant(name=name)
        db_session.add(merchant)
        db_session.flush()
        user = User(
            merchant_id=merchant.id,
            email="owner@example.com",
            password_hash="test-hash",
            role="owner",
        )
        db_session.add(user)
        db_session.flush()
        users.append(user)
    return users


@pytest.fixture
def client(test_url, db_engine, monkeypatch):
    from smart_home.config import get_settings
    from smart_home.db import session_factory
    from smart_home.main import create_app

    monkeypatch.setenv("DATABASE_URL", test_url)
    get_settings.cache_clear()
    session_factory.cache_clear()
    with TestClient(create_app()) as client:
        yield client
    session_factory().kw["bind"].dispose()
    session_factory.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def accounts(db_session):
    from argon2 import PasswordHasher
    from smart_home.models import Merchant, User

    users = []
    for name in ("auth-A", "auth-B"):
        merchant = Merchant(name=name)
        db_session.add(merchant)
        db_session.flush()
        user = User(
            merchant_id=merchant.id,
            email="owner@example.com",
            password_hash=PasswordHasher().hash("Test-Password-1234"),
            role="owner",
        )
        db_session.add(user)
        db_session.flush()
        users.append(user)
    db_session.commit()
    return users
