from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from smart_home.contracts import include_scene_contract
from smart_home.db import session_factory
from smart_home.errors import ErrorResponse, install_error_handlers
from smart_home.modules.auth.router import router as auth_router
from smart_home.modules.customers.router import router as customers_router
from smart_home.modules.products.router import router as products_router
from smart_home.modules.projects.router import router as projects_router
from smart_home.modules.users.router import router as users_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="智能家居 API",
        responses={
            code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 503)
        },
    )
    install_error_handlers(app)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(customers_router)
    app.include_router(products_router)
    app.include_router(projects_router)
    include_scene_contract(app)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    def ready():
        try:
            with session_factory()() as session:
                session.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return JSONResponse(
                status_code=503,
                content={
                    "error": {
                        "code": "database_unavailable",
                        "message": "Database unavailable",
                        "details": [],
                    }
                },
            )
        return {"status": "ready"}

    return app


app = create_app()
