from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from smart_home.db import session_factory


def create_app() -> FastAPI:
    app = FastAPI(title="智能家居 API")

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
