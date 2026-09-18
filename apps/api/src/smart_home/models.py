"""Explicit model registration for Alembic and test cleanup."""

from .modules.customers.models import Customer
from .modules.merchants.models import Merchant
from .modules.products.models import Product
from .modules.projects.models import DesignProject
from .modules.users.models import User

__all__ = ["Customer", "Merchant", "Product", "DesignProject", "User"]
