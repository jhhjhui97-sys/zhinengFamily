from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    secret_key: SecretStr = Field(min_length=32)
    environment: str = "development"
    token_issuer: str = "smart-home-api"
    token_audience: str = "smart-home-client"


@lru_cache
def get_settings() -> Settings:
    return Settings()
