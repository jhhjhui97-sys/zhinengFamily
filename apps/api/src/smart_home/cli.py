import argparse
import getpass

from sqlalchemy import select
from sqlalchemy.orm import Session

from smart_home.db import session_factory
from smart_home.models import Merchant, User
from smart_home.modules.auth.security import hash_password
from smart_home.modules.users.schemas import UserCreate


def bootstrap(
    session: Session, merchant_name: str, email: str, password: str
) -> tuple[Merchant, User]:
    data = UserCreate(email=email.strip(), password=password, role="owner")
    name = merchant_name.strip()
    if not name or len(name) > 200:
        raise ValueError("Merchant name must contain 1 to 200 characters")
    if session.scalar(select(Merchant.id).where(Merchant.name == name)) is not None:
        raise ValueError("Merchant name already exists; use its existing owner account")
    try:
        merchant = Merchant(name=name)
        session.add(merchant)
        session.flush()
        user = User(
            merchant_id=merchant.id,
            email=str(data.email),
            role="owner",
            password_hash=hash_password(data.password.get_secret_value()),
        )
        session.add(user)
        session.commit()
        session.refresh(merchant)
        session.refresh(user)
        return merchant, user
    except Exception:
        session.rollback()
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Merchant provisioning")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("bootstrap")
    create.add_argument("--merchant-name", required=True)
    create.add_argument("--email", required=True)
    args = parser.parse_args()
    password = getpass.getpass("Owner password (12-128 characters): ")
    if password != getpass.getpass("Confirm password: "):
        parser.exit(1, "Passwords do not match\n")
    try:
        with session_factory()() as session:
            merchant, user = bootstrap(
                session, args.merchant_name, args.email, password
            )
        print(f"merchant_id={merchant.id}\nuser_id={user.id}")
    except ValueError:
        parser.exit(1, "Invalid input or merchant already exists\n")


if __name__ == "__main__":
    main()
