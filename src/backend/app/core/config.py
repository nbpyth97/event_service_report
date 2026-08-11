from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    db_pool_size: int = 10
    db_max_overflow: int = 20

    secret_key: str
    access_token_expire_minutes: int = 10
    refresh_token_expire_minutes: int = 10080

    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:5173"]

    environment: Literal["local", "staging", "production"] = "local"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
