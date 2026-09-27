from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import or_

from smart_home.modules.auth.dependencies import CurrentUser, Database
from smart_home.schemas import Page
from smart_home.tenant import get_record, page_records

from .models import Product
from .schemas import ProductCreate, ProductPatch, ProductRead
from .service import create_product, update_product

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("", response_model=ProductRead, status_code=201)
def create(payload: ProductCreate, session: Database, user: CurrentUser):
    return create_product(session, user, payload)


@router.get("", response_model=Page[ProductRead])
def listing(
    session: Database,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    category: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
):
    criteria = []
    if search:
        escaped = (
            search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        if escaped:
            pattern = f"%{escaped}%"
            criteria.append(
                or_(
                    Product.name.ilike(pattern, escape="\\"),
                    Product.sku.ilike(pattern, escape="\\"),
                    Product.brand.ilike(pattern, escape="\\"),
                )
            )
    if category:
        criteria.append(Product.category == category.strip())
    return page_records(session, Product, user.merchant_id, limit, offset, *criteria)


@router.get("/{product_id}", response_model=ProductRead)
def get(product_id: UUID, session: Database, user: CurrentUser):
    return get_record(session, Product, product_id, user.merchant_id)


@router.patch("/{product_id}", response_model=ProductRead)
def update(
    product_id: UUID, payload: ProductPatch, session: Database, user: CurrentUser
):
    return update_product(
        session, get_record(session, Product, product_id, user.merchant_id), payload
    )
