from smart_home.errors import commit

from .models import Product


def product_values(payload, *, partial=False):
    values = payload.model_dump(exclude_unset=partial)
    if "metadata" in values:
        values["product_metadata"] = values.pop("metadata")
    return values


def create_product(session, actor, payload):
    product = Product(merchant_id=actor.merchant_id, **product_values(payload))
    session.add(product)
    commit(session)
    session.refresh(product)
    return product


def update_product(session, product, payload):
    for name, value in product_values(payload, partial=True).items():
        setattr(product, name, value)
    commit(session)
    session.refresh(product)
    return product
