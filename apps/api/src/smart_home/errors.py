from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[dict] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorBody


def fail(status: int, code: str, message: str) -> None:
    raise HTTPException(
        status_code=status, detail={"code": code, "message": message, "details": []}
    )


def commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        fail(409, "conflict", "Data conflicts with an existing record or reference")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, error: StarletteHTTPException):
        body = (
            error.detail
            if isinstance(error.detail, dict)
            else {
                "code": f"http_{error.status_code}",
                "message": str(error.detail),
                "details": [],
            }
        )
        return JSONResponse(
            status_code=error.status_code,
            content={"error": body},
            headers=error.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError):
        details = [
            {"loc": list(item["loc"]), "message": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Invalid request",
                    "details": details,
                }
            },
        )
