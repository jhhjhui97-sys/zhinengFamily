from smart_home.errors import commit
from smart_home.modules.customers.models import Customer
from smart_home.tenant import assigned_user, get_record

from .models import DesignProject


def create_project(session, actor, payload):
    get_record(session, Customer, payload.customer_id, actor.merchant_id)
    values = payload.model_dump()
    values["sales_user_id"] = assigned_user(
        session, actor, payload.sales_user_id or actor.id
    )
    project = DesignProject(merchant_id=actor.merchant_id, **values)
    session.add(project)
    commit(session)
    session.refresh(project)
    return project


def update_project(session, actor, project, payload):
    values = payload.model_dump(exclude_unset=True)
    if "customer_id" in values:
        get_record(session, Customer, values["customer_id"], actor.merchant_id)
    if "sales_user_id" in values:
        assigned_user(session, actor, values["sales_user_id"], project.sales_user_id)
    for name, value in values.items():
        setattr(project, name, value)
    commit(session)
    session.refresh(project)
    return project
