from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import or_

from smart_home.modules.auth.dependencies import CurrentUser, Database
from smart_home.schemas import Page
from smart_home.tenant import get_record, page_records

from .models import Customer
from .schemas import CustomerCreate, CustomerPatch, CustomerRead
from .service import create_customer, update_customer

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("", response_model=CustomerRead, status_code=201)
def create(payload: CustomerCreate, session: Database, user: CurrentUser):
    return create_customer(session, user, payload)


@router.get("", response_model=Page[CustomerRead])
def listing(
    session: Database,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
):
    criteria = ()
    if search:
        escaped = (
            search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        if escaped:
            pattern = f"%{escaped}%"
            criteria = (
                or_(
                    Customer.name.ilike(pattern, escape="\\"),
                    Customer.phone.ilike(pattern, escape="\\"),
                    Customer.wechat.ilike(pattern, escape="\\"),
                ),
            )
    return page_records(session, Customer, user.merchant_id, limit, offset, *criteria)


@router.get("/{customer_id}", response_model=CustomerRead)
def get(customer_id: UUID, session: Database, user: CurrentUser):
    return get_record(session, Customer, customer_id, user.merchant_id)


@router.patch("/{customer_id}", response_model=CustomerRead)
def update(
    customer_id: UUID, payload: CustomerPatch, session: Database, user: CurrentUser
):
    customer = get_record(session, Customer, customer_id, user.merchant_id)
    return update_customer(session, user, customer, payload)
