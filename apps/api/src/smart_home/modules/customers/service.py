from smart_home.errors import commit
from smart_home.tenant import assigned_user

from .models import Customer


def create_customer(session, actor, payload):
    values = payload.model_dump()
    values["owner_user_id"] = assigned_user(
        session, actor, payload.owner_user_id or actor.id
    )
    customer = Customer(merchant_id=actor.merchant_id, **values)
    session.add(customer)
    commit(session)
    session.refresh(customer)
    return customer


def update_customer(session, actor, customer, payload):
    values = payload.model_dump(exclude_unset=True)
    if "owner_user_id" in values:
        assigned_user(session, actor, values["owner_user_id"], customer.owner_user_id)
    for name, value in values.items():
        setattr(customer, name, value)
    commit(session)
    session.refresh(customer)
    return customer
